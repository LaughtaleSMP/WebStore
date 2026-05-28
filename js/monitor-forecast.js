/* monitor-forecast.js — Advanced weather forecast (Atmosphere card)
   Pipeline: state → merge history (Supabase 30d + server cache + localStorage)
   → conditional stats per ToD → Markov + Monte Carlo 200 jalur → CI ETA + timeline.
   Public: window.AtmoForecast.{update, tickLive}. Deps: window.{SB_URL,SB_KEY,lastMetrics} */
(function(){
'use strict';

// ───────────── Config / Priors ─────────────
var LS_STATE='dwelve_atmo_wx_v2',LS_HIST='dwelve_atmo_hist_v1',LS_HIST_CAP=200;
var SUPA_HIST_CACHE_KEY='dwelve_wx_supa_v1',SUPA_HIST_TTL_MS=5*60*1000;
var FORECAST_HORIZON_MS=60*60*1000,FORECAST_INTERVAL_MS=5*60*1000;
var MC_SIM_COUNT=200,MC_MAX_STEPS=12;

// Prior MC default — Bayesian smoothing weight pseudo-count saat sample minim.
var WX_PRIOR={clear:{mean:1500000,weight:5},rain:{mean:900000,weight:5},thunder:{mean:450000,weight:5}};
var WX_TRANS_PRIOR={clear:{rain:0.85,thunder:0.15},rain:{clear:0.85,thunder:0.15},thunder:{rain:0.55,clear:0.45}};
var WX_KEYS=['clear','rain','thunder'];

// ───────────── State ─────────────
var _supaCache=null,_fetchInflight=false;

// ───────────── Storage helpers ─────────────
function loadState(){ try{ var r=localStorage.getItem(LS_STATE); return r?JSON.parse(r):null; } catch(e){ return null; } }
function saveState(st){ try{ localStorage.setItem(LS_STATE,JSON.stringify(st)); } catch(e){} }
function loadLocal(){ try{ var a=JSON.parse(localStorage.getItem(LS_HIST)||'[]'); return Array.isArray(a)?a:[]; } catch(e){ return []; } }
function logLocal(wx,startMs,endMs,tod){
  if(!wx||!startMs||!endMs||endMs<=startMs)return;
  var dur=endMs-startMs;
  if(dur<30000||dur>7200000)return;
  var arr=loadLocal();
  arr.push({wx:wx,startMs:startMs,endMs:endMs,dur:dur,tod:tod});
  if(arr.length>LS_HIST_CAP)arr=arr.slice(arr.length-LS_HIST_CAP);
  try{ localStorage.setItem(LS_HIST,JSON.stringify(arr)); } catch(e){}
}

// ───────────── Supabase fetch (cached 5min in-mem + localStorage) ─────────────
function fetchSupabaseHistory(){
  var cached=_supaCache;
  if(cached&&(Date.now()-cached.ts)<SUPA_HIST_TTL_MS) return Promise.resolve(cached.hist);
  try{
    var raw=localStorage.getItem(SUPA_HIST_CACHE_KEY);
    if(raw){ var c=JSON.parse(raw);
      if(c&&c.ts&&(Date.now()-c.ts)<SUPA_HIST_TTL_MS&&Array.isArray(c.hist)){ _supaCache=c; return Promise.resolve(c.hist); }
    }
  } catch(e){}
  if(_fetchInflight)return _fetchInflight;
  if(!window.SB_URL||!window.SB_KEY)return Promise.resolve([]);
  // 30 hari, limit 1000 row — sudah cukup untuk Markov stable
  var since=new Date(Date.now()-30*86400000).toISOString();
  var url=window.SB_URL+'/rest/v1/weather_history?select=wx,start_ts,dur_ms,tod,dow'
    +'&start_ts=gte.'+encodeURIComponent(since)+'&order=start_ts.desc&limit=1000';
  _fetchInflight=fetch(url,{headers:{apikey:window.SB_KEY,Authorization:'Bearer '+window.SB_KEY}})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(rows){
      if(!Array.isArray(rows))rows=[];
      var hist=[];
      for(var i=0;i<rows.length;i++){
        var r=rows[i];
        if(!r||!r.wx||!r.start_ts||!r.dur_ms)continue;
        var startMs=new Date(r.start_ts).getTime();
        if(!startMs)continue;
        hist.push({wx:r.wx,startMs:startMs,endMs:startMs+Number(r.dur_ms),dur:Number(r.dur_ms),
          tod:typeof r.tod==='number'?r.tod:todFromMs(startMs)});
      }
      _supaCache={ts:Date.now(),hist:hist};
      try{ localStorage.setItem(SUPA_HIST_CACHE_KEY,JSON.stringify(_supaCache)); } catch(e){}
      _fetchInflight=false;
      return hist;
    })
    .catch(function(){ _fetchInflight=false; return []; });
  return _fetchInflight;
}

// ───────────── Time-of-day mapping (0=pagi,1=siang,2=sore,3=malam) ─────────────
function todFromMs(ms){ var h=new Date(ms).getHours(); return h<6?3:h<12?0:h<18?1:2; }
function todFromWorldTime(wt){
  var td=((Number(wt)||0)%24000+24000)%24000;
  return td<6000?0:td<12000?1:td<18000?2:3;
}

// ───────────── Merge histories ─────────────
// Dedup by (wx, startMs ±5s) — server-side log mungkin overlap dengan localStorage.
function mergeHistory(arrays){
  var seen = {};
  var out = [];
  function k(e){ return e.wx + '|' + Math.floor(e.startMs / 5000); }
  for (var i = 0; i < arrays.length; i++) {
    var a = arrays[i]; if (!Array.isArray(a)) continue;
    for (var j = 0; j < a.length; j++) {
      var e = a[j];
      if (!e || !e.wx || !e.startMs || !e.endMs || e.endMs <= e.startMs) continue;
      var key = k(e);
      if (seen[key]) continue;
      seen[key] = true;
      out.push(e);
    }
  }
  out.sort(function(a, b){ return a.startMs - b.startMs; });
  return out;
}

// ───────────── Statistics ─────────────
function quantile(sorted, q){
  if (!sorted.length) return 0;
  var idx = (sorted.length - 1) * q, lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Build statistik durasi cuaca, optional conditional pada tod.
 * Bayesian blend dengan prior: weight pseudo-count w merates prior, n sample observed.
 * @param {array} hist
 * @param {number} todFilter — null = aggregate semua, 0..3 = filter per phase
 * @returns {{clear:Stats, rain:Stats, thunder:Stats, totalN:number}}
 */
function buildStats(hist, todFilter){
  var out = { totalN: 0 };
  for (var i = 0; i < WX_KEYS.length; i++) {
    var k = WX_KEYS[i];
    var samples = [];
    for (var j = 0; j < hist.length; j++) {
      var e = hist[j];
      if (e.wx !== k) continue;
      if (todFilter !== null && todFilter !== undefined && e.tod !== todFilter) continue;
      samples.push(e.dur);
    }
    var prior = WX_PRIOR[k];
    var n = samples.length;
    if (n === 0) {
      out[k] = {
        mean: prior.mean,
        p25: prior.mean * 0.55,
        p50: prior.mean,
        p75: prior.mean * 1.6,
        p90: prior.mean * 2.4,
        n: 0,
      };
      continue;
    }
    samples.sort(function(a, b){ return a - b; });
    var sampleMean = samples.reduce(function(s, v){ return s + v; }, 0) / n;
    var w = prior.weight, total = w + n;
    var mean = (w * prior.mean + n * sampleMean) / total;
    out[k] = {
      mean: mean,
      p25: quantile(samples, 0.25),
      p50: quantile(samples, 0.50),
      p75: quantile(samples, 0.75),
      p90: quantile(samples, 0.90),
      n: n,
    };
    out.totalN += n;
  }
  return out;
}

/**
 * Build Markov transition matrix conditional pada tod (nullable).
 * Dirichlet smoothing: prior * 3 pseudo-count + observed counts.
 */
function buildTransitions(hist, todFilter){
  var counts = {
    clear:   { clear: 0, rain: 0, thunder: 0 },
    rain:    { clear: 0, rain: 0, thunder: 0 },
    thunder: { clear: 0, rain: 0, thunder: 0 },
  };
  for (var i = 1; i < hist.length; i++) {
    var prev = hist[i - 1], next = hist[i];
    if (todFilter !== null && todFilter !== undefined && prev.tod !== todFilter) continue;
    if (counts[prev.wx] && counts[prev.wx][next.wx] !== undefined) counts[prev.wx][next.wx]++;
  }
  var out = {};
  WX_KEYS.forEach(function(prev){
    var prior = WX_TRANS_PRIOR[prev], total = 0, row = {};
    WX_KEYS.forEach(function(next){
      if (prev === next) { row[next] = 0; return; }
      var p = (prior[next] || 0) * 3 + (counts[prev][next] || 0);
      row[next] = p; total += p;
    });
    if (total > 0) WX_KEYS.forEach(function(k){ row[k] = row[k] / total; });
    out[prev] = row;
  });
  return out;
}

// ───────────── Estimate remaining duration ─────────────
// Quantile-based confidence interval. Bila elapsed lewat p50, geser ke ekor distribusi.
function estimateRemaining(elapsed, sCur){
  function clamp(v){ return Math.max(0, v); }
  function rem(p){ return elapsed < p ? p - elapsed : 0; }
  return {
    p25: clamp(rem(sCur.p25 < elapsed ? sCur.p50 : sCur.p25)),
    p50: clamp(rem(sCur.p50)),
    p75: clamp(rem(Math.max(sCur.p75, elapsed * 1.05))),
    p90: clamp(rem(Math.max(sCur.p90, elapsed * 1.2))),
  };
}

// ───────────── Monte Carlo simulation ─────────────
// N simulasi forward; tiap step sample next state + sample durasi via quantile.
// Output: bucket FORECAST_INTERVAL_MS, tiap bucket = {clear, rain, thunder} probability.
function monteCarloDist(curWx, remainingP50, stats, trans, nowMs, simCount){
  var nBuckets = Math.ceil(FORECAST_HORIZON_MS / FORECAST_INTERVAL_MS);
  var dist = [];
  for (var i = 0; i < nBuckets; i++) dist.push({ clear: 0, rain: 0, thunder: 0 });

  // Sample weighted state pakai prob row
  function sampleNext(cur){
    var row = trans[cur] || {};
    var r = Math.random(), cum = 0;
    for (var i = 0; i < WX_KEYS.length; i++) {
      var k = WX_KEYS[i];
      cum += (row[k] || 0);
      if (r < cum) return k;
    }
    // Fallback (sum ≠ 1 due float)
    return cur === 'clear' ? 'rain' : 'clear';
  }
  // Sample duration: lognormal-ish via interpolasi quantile (exponential approximation).
  function sampleDur(wx){
    var s = stats[wx]; if (!s) return WX_PRIOR[wx].mean;
    var u = Math.random();
    if (u < 0.25) return s.p25 * (0.5 + Math.random() * 0.5); // 0..p25
    if (u < 0.50) return s.p25 + (s.p50 - s.p25) * Math.random();
    if (u < 0.75) return s.p50 + (s.p75 - s.p50) * Math.random();
    if (u < 0.90) return s.p75 + (s.p90 - s.p75) * Math.random();
    return s.p90 + (s.mean * 0.5) * Math.random();
  }

  for (var sim = 0; sim < simCount; sim++) {
    var t = 0;                                  // ms from now
    var wx = curWx;
    var remaining = remainingP50 + (Math.random() - 0.5) * remainingP50 * 0.3; // jitter
    if (remaining < 0) remaining = 0;
    var stepCount = 0;
    while (t < FORECAST_HORIZON_MS && stepCount < MC_MAX_STEPS) {
      var phaseEnd = Math.min(t + remaining, FORECAST_HORIZON_MS);
      // Tally seluruh bucket yang ter-cover state ini
      var startBucket = Math.floor(t / FORECAST_INTERVAL_MS);
      var endBucket = Math.min(nBuckets, Math.ceil(phaseEnd / FORECAST_INTERVAL_MS));
      for (var b = startBucket; b < endBucket; b++) {
        if (dist[b][wx] !== undefined) dist[b][wx]++;
      }
      t = phaseEnd;
      if (t >= FORECAST_HORIZON_MS) break;
      // Transition ke state baru
      wx = sampleNext(wx);
      remaining = sampleDur(wx);
      stepCount++;
    }
  }
  // Normalize ke probability
  for (var i = 0; i < nBuckets; i++) {
    var b = dist[i], sum = b.clear + b.rain + b.thunder;
    if (sum > 0) {
      b.clear /= sum; b.rain /= sum; b.thunder /= sum;
    }
  }
  return dist;
}

// ───────────── Confidence ─────────────
function computeConfidence(stats){
  // Sigmoid-ish: confidence naik dengan total sample, plateau di 95%.
  var n = stats.totalN || 0;
  // 0 sample → 30%, 50 sample → ~70%, 200 sample → ~88%, 500+ → ~95%
  return Math.min(0.95, 0.30 + Math.tanh(n / 80) * 0.65);
}

// ───────────── Format helpers ─────────────
function fmtDur(ms){
  if(ms<60000)return Math.max(1,Math.round(ms/1000))+'s';
  var m=Math.round(ms/60000); if(m<60)return m+'m';
  var h=Math.floor(m/60),mm=m%60; return h+'j'+(mm?' '+mm+'m':'');
}
function label(wx){ return wx==='thunder'?'Petir':wx==='rain'?'Hujan':'Cerah'; }
function colorFor(wx){ return wx==='thunder'?'#ef4444':wx==='rain'?'#3b82f6':'#facc15'; }

// ───────────── Main entry: update() ─────────────
function update(weather, serverTs, worldTime){
  var fcEl = document.getElementById('atmo-forecast');
  var txEl = document.getElementById('atmo-forecast-text');
  var etaEl = document.getElementById('atmo-forecast-eta');
  var tlEl = document.getElementById('atmo-forecast-timeline');
  if (!fcEl || !txEl || !etaEl) return;

  var nowMs = serverTs ? (new Date(serverTs).getTime() || Date.now()) : Date.now();
  var curTod = todFromWorldTime(worldTime != null ? worldTime : (window.lastMetrics && window.lastMetrics.world_time));

  // 1) State current
  var serverSince = window.lastMetrics && window.lastMetrics.weather_since_ms ? Number(window.lastMetrics.weather_since_ms) : 0;
  var st = loadState();
  if (serverSince && (!st || st.wx !== weather || Math.abs(serverSince - st.sinceMs) > 30000)) {
    st = { wx: weather, sinceMs: serverSince, fromServer: true };
    saveState(st);
  } else if (!st || st.wx !== weather) {
    if (st && st.wx && st.sinceMs) logLocal(st.wx, st.sinceMs, nowMs, st.tod || curTod);
    st = { wx: weather, sinceMs: nowMs, tod: curTod };
    saveState(st);
  }

  // 2) Build forecast — async kalau Supabase belum cached
  buildAndRender(weather, st, nowMs, curTod);
}

function buildAndRender(weather, st, nowMs, curTod){
  fetchSupabaseHistory().then(function(supaHist){
    var serverHist = Array.isArray(window.lastMetrics && window.lastMetrics.weather_log) ? window.lastMetrics.weather_log : [];
    var localHist = loadLocal();
    var hist = mergeHistory([supaHist, serverHist, localHist]);

    // Conditional stats: prefer per-tod kalau sample cukup (≥5), fallback aggregate.
    var statsTod = buildStats(hist, curTod);
    var stats = (statsTod.totalN >= 5) ? statsTod : buildStats(hist, null);
    var trans = buildTransitions(hist, curTod).clear ? buildTransitions(hist, curTod) : buildTransitions(hist, null);

    var elapsed = Math.max(0, nowMs - st.sinceMs);
    var sCur = stats[weather] || stats.clear;
    var rem = estimateRemaining(elapsed, sCur);
    var conf = computeConfidence(stats);

    // Monte Carlo distribution
    var dist = monteCarloDist(weather, rem.p50, stats, trans, nowMs, MC_SIM_COUNT);

    render(weather, st, elapsed, rem, conf, dist, stats, curTod);
  });
}

function render(weather, st, elapsed, rem, conf, dist, stats, curTod){
  var txEl = document.getElementById('atmo-forecast-text');
  var etaEl = document.getElementById('atmo-forecast-eta');
  var tlEl = document.getElementById('atmo-forecast-timeline');

  var totalN = stats.totalN || 0;
  var todName = ['pagi','siang','sore','malam'][curTod] || '';
  var label1 = label(weather);

  // ETA range string. p50=median, p25..p75=likely range, p90=upper safety.
  var etaTxt;
  if (rem.p50 <= 0) etaTxt = 'segera';
  else if (rem.p25 <= 0) etaTxt = '<' + fmtDur(rem.p75);
  else                   etaTxt = fmtDur(rem.p25) + '–' + fmtDur(rem.p75);

  // Label next prediction = state dengan probability tertinggi di bucket pertama setelah elapsed
  var nextWx = 'clear';
  if (dist.length > 0) {
    var b0 = dist[0];
    if (b0.rain > b0.clear && b0.rain > b0.thunder) nextWx = 'rain';
    else if (b0.thunder > b0.clear && b0.thunder > b0.rain) nextWx = 'thunder';
  }
  // Kalau next sama dengan current, ambil bucket berikutnya
  if (nextWx === weather && dist.length > 1) {
    for (var i = 1; i < dist.length; i++) {
      var b = dist[i];
      var maxK = 'clear', maxV = b.clear;
      if (b.rain > maxV) { maxK = 'rain'; maxV = b.rain; }
      if (b.thunder > maxV) { maxK = 'thunder'; maxV = b.thunder; }
      if (maxK !== weather) { nextWx = maxK; break; }
    }
  }

  txEl.innerHTML = '<span class="atmo-forecast-live"></span>'
    + '<span class="atmo-forecast-prefix">Cuaca:</span> '
    + '<b>' + label1 + '</b>'
    + '<span class="atmo-forecast-elapsed">sudah ' + fmtDur(elapsed) + '</span>'
    + '<span class="atmo-forecast-arrow" aria-hidden="true">→</span>'
    + '<span class="atmo-forecast-next">' + label(nextWx) + '</span>'
    + '<span class="atmo-forecast-conf" title="Akurasi prediksi: ' + Math.round(conf * 100)
    + '% (sample n=' + totalN + ', fase=' + todName + '). Naik seiring data terkumpul.">'
    + Math.round(conf * 100) + '%</span>';

  etaEl.textContent = '~' + etaTxt;

  if (tlEl) renderTimeline(tlEl, weather, dist, totalN);
}

// ───────────── Timeline render — stacked probability per bucket ─────────────
function renderTimeline(el, curWx, dist, totalN){
  var nBuckets = dist.length;
  var horizonMin = FORECAST_HORIZON_MS / 60000;
  var bucketMin = FORECAST_INTERVAL_MS / 60000;

  // Build segments: untuk tiap bucket render mini stacked-bar (3 cuaca) sebagai gradient
  var segs = '';
  for (var i = 0; i < nBuckets; i++) {
    var b = dist[i];
    var w = (1 / nBuckets) * 100;
    var dom = null, domP = 0;
    WX_KEYS.forEach(function(k){ if (b[k] > domP) { domP = b[k]; dom = k; } });
    var bg;
    if (domP >= 0.70) {
      bg = colorFor(dom);
    } else {
      var sorted = WX_KEYS.slice().sort(function(a, c){ return b[c] - b[a]; });
      var c1 = colorFor(sorted[0]), c2 = colorFor(sorted[1]);
      bg = 'linear-gradient(180deg,' + c1 + ' 0%,' + c1 + ' ' + Math.round(b[sorted[0]] * 100) + '%,' + c2 + ' 100%)';
    }
    var atMin = i * bucketMin;
    // Tooltip lebih natural: "Dalam 15 menit: 65% Cerah, 30% Hujan, 5% Petir"
    var probs = WX_KEYS.slice().sort(function(a, c){ return b[c] - b[a]; })
      .filter(function(k){ return b[k] > 0.02; })
      .map(function(k){ return Math.round(b[k] * 100) + '% ' + label(k); }).join(', ');
    var title = (atMin === 0 ? 'Sekarang' : 'Dalam ' + atMin + ' menit') + ': ' + probs;
    var op = 0.55 + domP * 0.4;
    segs += '<span class="atmo-tl-seg" style="width:' + w.toFixed(2) + '%;background:' + bg + ';opacity:' + op.toFixed(2) + '" title="' + title + '"></span>';
  }
  var ticks = '';
  [15, 30, 45].forEach(function(m){
    var pct = m / horizonMin * 100;
    ticks += '<span class="atmo-tl-tick" style="left:' + pct + '%"></span>';
  });
  // Header eksplisit + help popup collapsible
  var helpItems = [
    'Bar dibagi 12 segmen, masing-masing mewakili interval 5 menit ke depan.',
    'Warna segmen menunjukkan cuaca paling mungkin di interval itu (lihat legend).',
    'Warna pekat = prediksi yakin. Pudar / gradient = ada beberapa kemungkinan.',
    'Hover (atau tap di mobile) tiap segmen untuk lihat probabilitas tepat.',
  ].map(function(t){ return '<li>' + t + '</li>'; }).join('');
  var hdr = '<div class="atmo-tl-hdr">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">'
    + '<path d="M3 12h2M5 12a7 7 0 0 1 14 0M19 12h2M12 3v2M5.6 5.6l1.4 1.4M18.4 5.6l-1.4 1.4"/></svg>'
    + '<span class="atmo-tl-hdr-title">Prediksi cuaca 60 menit ke depan</span>'
    + '<button type="button" class="atmo-tl-hdr-hint" id="atmo-tl-hint-btn" aria-expanded="false" aria-controls="atmo-tl-help" aria-label="Penjelasan prediksi cuaca">?</button>'
    + '</div>'
    + '<div class="atmo-tl-help" id="atmo-tl-help" hidden>'
    +   '<p><b>Cara membaca</b></p><ul>' + helpItems + '</ul>'
    +   '<p><b>Akurasi (%)</b> = tingkat keyakinan model. Naik seiring data sample bertambah.</p>'
    +   '<p style="opacity:.7;font-size:.40rem">Model: Markov chain + Bayesian smoothing + Monte Carlo (200 simulasi).</p>'
    + '</div>';
  var legend = '<div class="atmo-tl-legend">'
    + '<span class="atmo-tl-lg"><i style="background:#facc15"></i>Cerah</span>'
    + '<span class="atmo-tl-lg"><i style="background:#3b82f6"></i>Hujan</span>'
    + '<span class="atmo-tl-lg"><i style="background:#ef4444"></i>Petir</span>'
    + '<span class="atmo-tl-lg-spacer"></span>'
    + '<span class="atmo-tl-lg-note">warna pekat = prediksi lebih yakin</span>'
    + '</div>';
  // Hint placeholder saat sample minim — beri tahu user kenapa akurasi rendah.
  var n = totalN || 0;
  var hint = '';
  if (n < 20) {
    var msg, status;
    if (n < 5)       { status = 'Belajar'; msg = 'Model baru mulai mengumpulkan data — akurasi prediksi rendah. Estimasi cuaca server masih kasar.'; }
    else if (n < 12) { status = 'Belajar'; msg = 'Model masih belajar (' + n + ' transisi cuaca terekam). Akurasi akan naik signifikan setelah ~50 sample.'; }
    else             { status = 'Berkembang'; msg = 'Akurasi mulai membaik (' + n + ' sample). Tunggu beberapa hari lagi untuk prediksi yang lebih tajam.'; }
    hint = '<div class="atmo-tl-hint" role="note">'
      + '<span class="atmo-tl-hint-tag">' + status + '</span>'
      + '<span class="atmo-tl-hint-msg">' + msg + '</span>'
      + '</div>';
  }
  el.innerHTML = hdr
    + hint
    + '<div class="atmo-tl-bar">' + segs + '</div>'
    + '<div class="atmo-tl-ticks">' + ticks + '</div>'
    + '<div class="atmo-tl-scale"><span>sekarang</span><span>+15m</span><span>+30m</span><span>+45m</span><span>+60m</span></div>'
    + legend;
}

// ───────────── Live tick (elapsed update tanpa rebuild forecast) ─────────────
function tickLive(){
  var st = loadState(); if (!st || !st.wx) return;
  var txEl = document.getElementById('atmo-forecast-text');
  if (!txEl) return;
  var elapsed = Math.max(0, Date.now() - st.sinceMs);
  var elapsedSpan = txEl.querySelector('.atmo-forecast-elapsed');
  if (elapsedSpan) elapsedSpan.textContent = 'sudah ' + fmtDur(elapsed);
}

// ───────────── Help popup toggle (event delegation) ─────────────
function _closeHelp(){
  var help = document.getElementById('atmo-tl-help');
  if (help && !help.hidden) {
    help.hidden = true;
    var b = document.getElementById('atmo-tl-hint-btn');
    if (b) b.setAttribute('aria-expanded', 'false');
  }
}
document.addEventListener('click', function(e){
  var btn = e.target.closest && e.target.closest('#atmo-tl-hint-btn');
  if (btn) {
    var help = document.getElementById('atmo-tl-help'); if (!help) return;
    var open = !help.hidden;
    help.hidden = open;
    btn.setAttribute('aria-expanded', String(!open));
    e.stopPropagation();
    return;
  }
  if (e.target.closest && !e.target.closest('.atmo-tl-help')) _closeHelp();
});
document.addEventListener('keydown', function(e){ if (e.key === 'Escape') _closeHelp(); });

// ───────────── Public API ─────────────
window.AtmoForecast = {
  update: update,
  tickLive: tickLive,
};

})();
