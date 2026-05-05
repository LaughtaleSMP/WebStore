(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id) };
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML }
  function fmtN(n) { n = n || 0; if (n !== 0 && Math.abs(n) < 1) return n.toFixed(4); if (Number.isInteger(n) || Math.abs(n) >= 1000) return Math.round(n).toLocaleString('id-ID'); return n.toFixed(2) }
  function fmt(n) { return (n || 0).toLocaleString('id-ID') }
  function timeAgo(ts) { if (!ts) return '?'; var s = Math.floor((Date.now() - ts) / 1000); if (s < 60) return s + 's lalu'; if (s < 3600) return Math.floor(s / 60) + 'm lalu'; if (s < 86400) return Math.floor(s / 3600) + 'j lalu'; return Math.floor(s / 86400) + 'h lalu' }
  function setText(id, t) { var el = $(id); if (el) el.textContent = t }

  var _data = null, _activeTab = 'bank', _activeMod = 'analytics';
  var RARITY_COLORS = { COMMON: 'var(--dim)', UNCOMMON: 'var(--green)', RARE: '#3b82f6', EPIC: 'var(--ac)', LEGENDARY: 'var(--gold)' };
  var _ic = {
    sent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>',
    sold: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12V8H6a2 2 0 010-4h12v4M4 6v12a2 2 0 002 2h14v-4"/><circle cx="18" cy="16" r="2"/></svg>',
    expired: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    pt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
    eq: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>',
    add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>',
    deduct: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>'
  };

  // ── localStorage cache helpers ──
  var CACHE_KEY = 'eco_data', CACHE_TREND = 'eco_trend', CACHE_TTL = 90000, TREND_TTL = 120000;
  function _cGet(k) { try { var r = JSON.parse(localStorage.getItem(k)); if (r && r.t && Date.now() - r.t < (k === CACHE_TREND ? TREND_TTL : CACHE_TTL)) return r.d; } catch (e) { } return null; }
  function _cSet(k, v) { try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), d: v })); } catch (e) { } }
  function _cFresh(k) { try { var r = JSON.parse(localStorage.getItem(k)); return r && r.t && Date.now() - r.t < (k === CACHE_TREND ? TREND_TTL : CACHE_TTL); } catch (e) { } return false; }

  window.addEventListener('DOMContentLoaded', function () {
    bindModTabs(); bindLogTabs(); _initTrend();
    var cached = _cGet(CACHE_KEY);
    if (cached) { _data = cached; renderAnalytics(); renderLogStats(); renderLogs(); renderDiscCodes(); }
    var cachedTrend = _cGet(CACHE_TREND);
    if (cachedTrend && cachedTrend.length) { _trendData = cachedTrend; _candles = _agg(_trendData, _trendMetric); drawTrendChart(); renderTrendDeltas(); renderHealthAdvisor(); }
    fetchAll();
    _startCountdown();
  });

  function bindModTabs() {
    var tabs = document.querySelectorAll('.mod-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () {
        document.querySelectorAll('.mod-tab').forEach(function (t) { t.classList.remove('active') });
        document.querySelectorAll('.mod').forEach(function (m) { m.classList.remove('active') });
        this.classList.add('active');
        _activeMod = this.dataset.mod;
        var mod = $('mod-' + _activeMod); if (mod) mod.classList.add('active');
      });
    }
  }

  function bindLogTabs() {
    var el = $('log-tabs'); if (!el) return;
    el.addEventListener('click', function (e) {
      var t = e.target.closest('.tab'); if (!t) return;
      document.querySelectorAll('#log-tabs .tab').forEach(function (b) { b.classList.remove('a') });
      t.classList.add('a'); _activeTab = t.dataset.cat; renderLogs();
    });
  }

  async function fetchAll() {
    try {
      // Skip if cache is fresh and data already loaded
      if (_data && _cFresh(CACHE_KEY)) { fetchTrend(); return; }
      var r = await fetch(SB_URL + '/rest/v1/leaderboard_sync?id=eq.current&select=gacha_lb,bank_log,auction_log,gacha_log,topup_log,disc_codes,synced_at', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
      var d = await r.json(); if (!d || !d[0]) return;
      var row = d[0];
      _data = {
        lb: safeParse(row.gacha_lb, {}),
        bank: safeParse(row.bank_log, []), auction: safeParse(row.auction_log, []),
        gacha: safeParse(row.gacha_log, []), topup: safeParse(row.topup_log, []),
        disc: safeParse(row.disc_codes, {}), synced: row.synced_at
      };
      _cSet(CACHE_KEY, _data);
      var el = $('eco-sync');
      if (el) el.textContent = 'Sync: ' + (row.synced_at ? new Date(row.synced_at).toLocaleString('id-ID') : '—');
      renderAnalytics(); renderLogStats(); renderLogs(); renderDiscCodes();
      fetchTrend();
    } catch (e) { console.warn('[Eco]', e) }
  }

  function safeParse(v, d) { if (!v) return d; if (typeof v === 'string') try { return JSON.parse(v) } catch (e) { return d } return v }

  function renderAnalytics() {
    if (!_data) return;
    var s = _data.lb.summary;
    if (!s || !s.coin) return;
    var c = s.coin, g = s.gem;

    setText('kpi-n', s.n); setText('kpi-n-sub', 'dari p_reg');
    setText('kpi-coin', fmtN(c.total)); setText('kpi-coin-sub', 'avg: ' + fmtN(c.avg) + ' / player');
    setText('kpi-gem', fmtN(g.total)); setText('kpi-gem-sub', 'avg: ' + fmtN(g.avg) + ' / player');
    setText('kpi-median', fmtN(c.median)); setText('kpi-median-sub', 'P25: ' + fmtN(c.p25) + ' | P75: ' + fmtN(c.p75));

    renderWealth(s); renderInflation(s); renderTxVolume(); renderTopHolders(); renderPricing(s); renderGacha(s);
  }

  function renderWealth(s) {
    var gini = s.gini, c = s.coin;
    var pill = $('gini-pill');
    if (pill) { pill.textContent = 'Gini: ' + gini.toFixed(3); pill.className = 'pill ' + (gini < .3 ? 'g' : gini < .5 ? 'y' : 'r') }

    var ranges = [
      { pct: c.p25 > 0 ? Math.round(c.p25 / c.total * 100 * s.n * .25) : 5, color: '#64748b', label: 'Bottom 25%' },
      { pct: c.median > 0 ? Math.round((c.median - c.p25) / c.total * 100 * s.n * .25) : 10, color: '#60a5fa', label: 'Lower Mid' },
      { pct: 20, color: '#34d399', label: 'Middle' },
      { pct: c.p75 > 0 ? Math.round((c.p75 - c.median) / c.total * 100 * s.n * .25) : 25, color: '#fbbf24', label: 'Upper Mid' },
      { pct: 40, color: '#f87171', label: 'Top 25%' }
    ];
    var total = ranges.reduce(function (a, b) { return a + b.pct }, 0) || 1;

    var bar = $('wealth-bar');
    if (bar) { var h = ''; for (var i = 0; i < ranges.length; i++) { h += '<div style="width:' + Math.max(2, Math.round(ranges[i].pct / total * 100)) + '%;background:' + ranges[i].color + '"></div>' } bar.innerHTML = h }

    var leg = $('wealth-legend');
    if (leg) { var lh = ''; for (var i = ranges.length - 1; i >= 0; i--) { lh += '<span style="font-family:\'JetBrains Mono\',monospace;font-size:.38rem;color:var(--text);display:flex;align-items:center;gap:3px"><span style="width:7px;height:7px;border-radius:2px;background:' + ranges[i].color + ';flex-shrink:0"></span>' + ranges[i].label + '</span>' } leg.innerHTML = lh }

    var det = $('wealth-detail');
    if (det) {
      var top1Pct = c.max > 0 && c.total > 0 ? Math.round(c.max / c.total * 100) : 0;
      det.innerHTML = 'Coin terbanyak: ' + fmtN(c.max) + ' (' + top1Pct + '% supply). Terendah: ' + fmtN(c.min) + '. ' + (gini >= .5 ? '<span style="color:var(--red)">Ketimpangan tinggi.</span>' : gini >= .3 ? '<span style="color:var(--gold)">Ketimpangan sedang.</span>' : '<span style="color:var(--green)">Distribusi merata.</span>');
    }
  }

  function renderInflation(s) {
    var bank = _data.bank, topup = _data.topup, gacha = _data.gacha;
    var flow = null;
    if (_trendData.length > 0) {
      var latest = _trendData[_trendData.length - 1];
      if (latest.coin_flow) flow = typeof latest.coin_flow === 'string' ? safeParse(latest.coin_flow, null) : latest.coin_flow;
    }
    var injected = 0, sunk = 0;
    var sources = [
      { k: 'mob_kill', label: 'Mob Kill' }, { k: 'topup', label: 'Topup' },
      { k: 'gacha_refund', label: 'Gacha Refund' }, { k: 'pvp_refund', label: 'PvP Refund' },
      { k: 'weekly_reward', label: 'Weekly LB' }, { k: 'first_sale', label: '1st Sale' }
    ];
    var sinks = [
      { k: 'gacha_cost', label: 'Gacha Cost' }, { k: 'bank_tax', label: 'Bank Tax' },
      { k: 'mob_penalty', label: 'Anti-Stack' }, { k: 'pvp_penalty', label: 'PvP Penalty' },
      { k: 'auction_fee', label: 'Auction Fee' }, { k: 'wealth_tax', label: 'Wealth Tax' }
    ];
    if (flow) {
      for (var i = 0; i < sources.length; i++) { var v = flow[sources[i].k] || 0; if (v > 0) injected += v; }
      for (var i = 0; i < sinks.length; i++) { var v = Math.abs(flow[sinks[i].k] || 0); if (v > 0) sunk += v; }
    } else {
      for (var i = 0; i < topup.length; i++) if ((topup[i].x || topup[i].action) === 'add') injected += Math.abs(topup[i].n || topup[i].amount || 0);
      for (var i = 0; i < gacha.length; i++) sunk += Math.abs(gacha[i].cost || gacha[i].c || 0);
    }
    var net = injected - sunk;
    var rate = s.coin.total > 0 ? Math.round(net / s.coin.total * 100) : 0;
    var pill = $('inf-pill');
    if (pill) {
      var lbl = rate > 5 ? 'INFLASI' : rate < -5 ? 'DEFLASI' : 'STABIL';
      pill.textContent = lbl + ' (' + rate + '%)';
      pill.className = 'pill ' + (Math.abs(rate) <= 5 ? 'g' : Math.abs(rate) <= 15 ? 'y' : 'r');
    }
    var grid = $('inf-grid');
    if (grid) {
      var wt = Math.abs(flow ? (flow.wealth_tax || 0) : 0);
      grid.innerHTML = mkStatCard('Coin Masuk', 'var(--green)', '+' + fmtN(injected), flow ? 'flow tracker' : 'log')
        + mkStatCard('Coin Keluar', 'var(--red)', '-' + fmtN(sunk), flow ? 'flow tracker' : 'log')
        + mkStatCard('Net Flow', net >= 0 ? 'var(--gold)' : 'var(--red)', (net >= 0 ? '+' : '') + fmtN(net), flow ? 'akurat' : 'estimasi')
        + mkStatCard('Wealth Tax', '#c084fc', wt > 0 ? '-' + fmtN(wt) : '0', 'harian');
    }
    var fd = $('inf-flows');
    if (fd && flow) {
      var srcH = '', snkH = '';
      for (var i = 0; i < sources.length; i++) {
        var v = flow[sources[i].k] || 0; if (v === 0) continue;
        srcH += '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border-radius:4px;background:rgba(52,211,153,0.08);margin:2px"><span style="color:var(--green);font-weight:600">+' + fmtN(v) + '</span><span style="color:var(--mute)">' + sources[i].label + '</span></span>';
      }
      for (var i = 0; i < sinks.length; i++) {
        var v = flow[sinks[i].k] || 0; if (v === 0) continue;
        snkH += '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border-radius:4px;background:rgba(239,68,68,0.08);margin:2px"><span style="color:var(--red)">' + fmtN(v) + '</span><span style="color:var(--mute)">' + sinks[i].label + '</span></span>';
      }
      fd.innerHTML = (srcH || snkH) ? '<div style="display:flex;flex-wrap:wrap;gap:2px;font-family:\'JetBrains Mono\',monospace;font-size:.38rem">' + srcH + snkH + '</div>' : '';
    }
  }

  function renderTxVolume() {
    var bank = _data.bank, auc = _data.auction, gacha = _data.gacha, topup = _data.topup;
    var bV = 0, aV = 0;
    for (var i = 0; i < bank.length; i++)bV += Math.abs(bank[i].amount || 0);
    for (var i = 0; i < auc.length; i++)aV += Math.abs(auc[i].price || 0);
    var traders = {};
    for (var i = 0; i < bank.length; i++) { if (bank[i].from) traders[bank[i].from] = 1; if (bank[i].to) traders[bank[i].to] = 1 }
    for (var i = 0; i < auc.length; i++) { if (auc[i].seller) traders[auc[i].seller] = 1; if (auc[i].buyer) traders[auc[i].buyer] = 1 }

    var grid = $('tx-grid');
    if (grid) grid.innerHTML = mkStatCard('Bank Volume', 'var(--cyan)', fmtN(bV), bank.length + ' tx') + mkStatCard('Auction Volume', 'var(--green)', fmtN(aV), auc.length + ' tx') + mkStatCard('Gacha Pulls', '#c084fc', gacha.length + 'x', 'total pulls') + mkStatCard('Trader Aktif', 'var(--gold)', Object.keys(traders).length, 'unique');
  }

  function renderTopHolders() {
    var lb = _data.lb; if (!lb) return;
    fillTbl('tbl-coin', lb.coin || [], function (p, i) { return '<tr><td style="color:var(--mute)">' + (i + 1) + '</td><td>' + esc(p.name) + '</td><td style="text-align:right;color:var(--gold);font-weight:700">' + fmtN(p.coin) + '</td></tr>' });
    fillTbl('tbl-gem', lb.gem || [], function (p, i) { return '<tr><td style="color:var(--mute)">' + (i + 1) + '</td><td>' + esc(p.name) + '</td><td style="text-align:right;color:#a855f7;font-weight:700">' + fmtN(p.gem) + '</td></tr>' });
  }

  function _aggFlow() {
    var f = { mob_kill: 0, gacha_refund: 0, pvp_refund: 0, first_sale: 0, topup: 0, weekly_reward: 0, gacha_cost: 0, bank_tax: 0, mob_penalty: 0, pvp_penalty: 0, auction_fee: 0 };
    var bv = 0, av = 0, cnt = 0, gini = 0, giniCnt = 0;
    for (var i = 0; i < _trendData.length; i++) {
      var row = _trendData[i], cf = row.coin_flow;
      if (cf) {
        var p = typeof cf === 'string' ? safeParse(cf, null) : cf;
        if (p) {
          for (var k in f) { if (p[k]) f[k] += p[k]; }
          bv += (p._bv || 0);
          av += (p._av || 0);
          if (p._gini) { gini += p._gini; giniCnt++; }
        }
      }
      bv += (row.bank_volume || 0);
      av += (row.auction_volume || 0);
      cnt++;
    }
    return { flow: f, bankVol: bv, auctionVol: av, snapshots: cnt, avgGini: giniCnt > 0 ? gini / giniCnt : 0 };
  }

  function renderPricing(s) {
    var agg = _aggFlow();
    var n = s.n || 1, gini = s.gini || 0;
    var c = s.coin, med = c.median, avg = c.avg;
    var org = (agg.flow.mob_kill || 0) + (agg.flow.gacha_refund || 0) + (agg.flow.pvp_refund || 0) + (agg.flow.first_sale || 0);
    var incPerSnap = n > 0 ? org / n : 0;
    var incPerHour = agg.snapshots >= 12 ? (org / n / agg.snapshots) * 12 : incPerSnap * 12;
    var txVol = agg.bankVol + agg.auctionVol;
    var vel = c.total > 0 ? txVol / c.total : 0.01;
    var vMul = Math.max(0.8, Math.min(1.3, vel * 20));
    var gMul = gini > 0.5 ? 0.7 : gini > 0.3 ? 0.85 : 1.0;
    // Coin triple-anchor
    var cA1 = incPerHour, cA2 = med > 0 ? med * 0.02 : 0, cA3 = avg > 0 ? avg * 0.01 : 0;
    var coinBasis = Math.max(cA1, cA2, cA3, 1);
    var coinAnchor = coinBasis === cA1 ? 'income' : coinBasis === cA2 ? 'median' : coinBasis === cA3 ? 'avg' : 'floor';
    function calcC(cat) {
      var t = { basic: [0.5, 1, 2], mid: [2, 4, 6], premium: [4, 8, 16], endgame: [12, 24, 48], luxury: [24, 48, 96] }[cat];
      return [Math.round(coinBasis * t[0] * vMul * gMul), Math.round(coinBasis * t[1] * vMul * gMul), Math.round(coinBasis * t[2] * vMul * gMul)];
    }
    var items = [
      ['Land 10x10', 'Land', calcC('premium'), '4-8j farming', ''],
      ['Land 30x30+', 'Land', calcC('luxury'), '24-48j farming', ''],
      ['Land Extend', 'Land', calcC('mid'), '2-4j farming', ''],
      ['EQ 1x Pull', 'Gacha', calcC('basic'), '0.5-1j farming', ''],
      ['EQ 10x Pull', 'Gacha', calcC('mid'), '2-4j farming', ''],
      ['PT 1x Pull', 'Gacha', [10, 10, 10], 'tetap (gem)', ''],
      ['PT 10x Pull', 'Gacha', [90, 90, 90], 'tetap (gem)', ''],
      ['Auction Listing', 'Market', calcC('basic'), '0.5-1j farming', ''],
      ['Rare Item (AH)', 'Market', calcC('endgame'), '12-24j farming', '']
    ];
    var colors = { Land: 'var(--green)', Gacha: '#c084fc', Market: 'var(--cyan)' };
    var body = document.querySelector('#tbl-price tbody'); if (!body) return;
    var h = '';
    for (var i = 0; i < items.length; i++) {
      var it = items[i], cc = colors[it[1]] || 'var(--mute)', pr = it[2];
      h += '<tr><td style="font-weight:600">' + it[0] + '</td><td style="color:' + cc + '">' + it[1] + '</td><td style="text-align:right;color:var(--dim)">' + fmtN(pr[0]) + it[4] + '</td><td style="text-align:right;color:var(--green);font-weight:700">' + fmtN(pr[1]) + it[4] + '</td><td style="text-align:right;color:var(--dim)">' + fmtN(pr[2]) + it[4] + '</td><td style="color:var(--mute);font-size:.36rem">' + it[3] + '</td></tr>';
    }
    body.innerHTML = h;
    var basisEl = $('pricing-basis');
    if (basisEl) {
      var g = s.gem || {};
      var gemCoinRatio = (g.avg && avg) ? Math.round(avg / g.avg) : 100;
      basisEl.innerHTML = 'Coin basis: ' + fmtN(Math.round(coinBasis)) + '/jam <span style="color:var(--cyan)">(' + coinAnchor + ')</span> | vMul: ' + vMul.toFixed(2) + ' | gMul: ' + gMul.toFixed(2) + ' | <span style="color:#c084fc">Gem: tetap</span> | 1 Gem ~ ' + fmtN(gemCoinRatio) + ' Coin';
    }
  }

  function renderGacha(s) {
    var g = s.gacha; if (!g) return;
    var grid = $('gacha-grid');
    if (grid) grid.innerHTML = mkStatCard('Total Pulls', '#c084fc', fmtN(g.pulls), 'semua pemain') + mkStatCard('Pemain Gacha', 'var(--cyan)', g.active, 'dari ' + s.n) + mkStatCard('Participation', 'var(--green)', g.rate + '%', 'aktif gacha') + mkStatCard('Avg Pulls', 'var(--gold)', s.n > 0 ? Math.round(g.pulls / s.n) : 0, 'per pemain');
  }

  function mkStatCard(label, color, val, sub) {
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xs);padding:7px 9px;text-align:center"><div style="font-family:\'JetBrains Mono\',monospace;font-size:.38rem;color:var(--mute);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">' + label + '</div><div style="font-family:\'JetBrains Mono\',monospace;font-size:.8rem;font-weight:700;color:' + color + '">' + val + '</div><div style="font-size:.35rem;color:var(--dim);margin-top:2px">' + sub + '</div></div>';
  }

  function fillTbl(id, arr, fn) {
    var el = $(id); if (!el) return; var tb = el.querySelector('tbody'); if (!tb) return;
    if (!arr.length) { tb.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--mute);padding:10px">—</td></tr>'; return }
    var h = ''; for (var i = 0; i < Math.min(arr.length, 10); i++)h += fn(arr[i], i); tb.innerHTML = h;
  }

  function renderLogStats() {
    var ids = ['st-bank', 'st-auction', 'st-gacha', 'st-topup'];
    var vals = [_data.bank.length, _data.auction.length, _data.gacha.length, _data.topup.length];
    for (var i = 0; i < ids.length; i++) { var el = $(ids[i]); if (el) { el.textContent = vals[i]; el.classList.remove('sk') } }
  }

  function renderLogs() {
    var renderers = { bank: renderBank, auction: renderAuction, gacha: renderGachaLog, topup: renderTopup };
    (renderers[_activeTab] || renderBank)(_data[_activeTab] || []);
    var meta = $('log-meta'); if (meta) meta.textContent = (_data[_activeTab] || []).length + ' log';
  }

  function renderBank(logs) {
    var el = $('log-content'); if (!logs.length) { el.innerHTML = '<div class="emp">Belum ada log transfer</div>'; return }
    el.innerHTML = logs.map(function (h, i) {
      var tax = (h.tax || 0) > 0 ? ' <span class="tx">pajak ' + fmt(h.tax) + '</span>' : '';
      return '<div class="log-row" style="animation:fs .3s ' + i * 30 + 'ms ease both"><div class="log-icon sent">' + _ic.sent + '</div><div class="log-body"><div class="log-main"><span class="pn">' + esc(h.from || '?') + '</span> <span class="arrow">→</span> <span class="pn">' + esc(h.to || '?') + '</span></div><div class="log-detail">' + (h.note ? '"' + esc(h.note) + '" · ' : '') + '<span class="log-time">' + timeAgo(h.ts) + '</span></div></div><div class="log-amount coin">+' + fmt(h.amount) + ' Coin' + tax + '</div></div>';
    }).join('');
  }

  function renderAuction(logs) {
    var el = $('log-content'); if (!logs.length) { el.innerHTML = '<div class="emp">Belum ada log auction</div>'; return }
    el.innerHTML = logs.map(function (h, i) {
      var cls = h.type === 'expired' ? 'expired' : 'sold';
      var detail = h.type === 'expired' ? '<span class="pn">' + esc(h.seller || '?') + '</span>' : '<span class="pn">' + esc(h.seller || '?') + '</span> <span class="arrow">→</span> <span class="pn">' + esc(h.buyer || '?') + '</span>' + (h.type === 'auction_won' ? ' <span class="badge bid">Lelang</span>' : '');
      var amt = h.type === 'expired' ? '<div class="log-amount expired">Expired</div>' : '<div class="log-amount coin">' + fmt(h.price) + ' Coin</div>';
      return '<div class="log-row" style="animation:fs .3s ' + i * 30 + 'ms ease both"><div class="log-icon ' + cls + '">' + (_ic[cls] || '') + '</div><div class="log-body"><div class="log-main">' + esc(h.item || '?') + '</div><div class="log-detail">' + detail + ' · <span class="log-time">' + timeAgo(h.ts) + '</span></div></div>' + amt + '</div>';
    }).join('');
  }

  function renderGachaLog(logs) {
    var el = $('log-content'); if (!logs.length) { el.innerHTML = '<div class="emp">Belum ada log gacha</div>'; return }
    el.innerHTML = logs.map(function (h, i) {
      var pName = h.player || h.p || '?', type = (h.type || h.t || 'EQ') === 'PT' ? 'Partikel' : 'Peralatan', typeCls = (h.type || h.t || 'EQ') === 'PT' ? 'pt' : 'eq';
      var items = h.items || [], rarity = h.r || 'COMMON', iName = h.name || h.n || '?', rarColor = RARITY_COLORS[rarity] || 'var(--dim)';
      if (items.length > 0) {
        var best = items.reduce(function (a, b) { var rk = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY']; return rk.indexOf(b.rarity || b.r || 'COMMON') > rk.indexOf(a.rarity || a.r || 'COMMON') ? b : a }, items[0]);
        var bestColor = RARITY_COLORS[best.rarity || best.r] || 'var(--dim)';
        var itemList = items.map(function (it) { var c = RARITY_COLORS[it.rarity || it.r] || 'var(--dim)'; return '<span class="pull-item" style="color:' + c + '">' + esc(it.name || it.n || '?') + (it.isDup || it.d ? ' <span class="dup">[D]</span>' : '') + '</span>' }).join('');
        return '<div class="log-row gacha-row" style="animation:fs .3s ' + i * 30 + 'ms ease both"><div class="log-icon ' + typeCls + '">' + (_ic[typeCls] || '') + '</div><div class="log-body"><div class="log-main"><span class="pn">' + esc(pName) + '</span> <span class="badge ' + typeCls + '">' + type + '</span> <span class="badge pull">' + items.length + 'x</span></div><div class="log-detail"><span class="log-time">' + timeAgo(h.ts) + '</span></div><div class="pull-items">' + itemList + '</div></div><div class="log-amount" style="color:' + bestColor + '">' + esc(best.name || best.n || '?') + '</div></div>';
      }
      return '<div class="log-row gacha-row" style="animation:fs .3s ' + i * 30 + 'ms ease both"><div class="log-icon ' + typeCls + '">' + (_ic[typeCls] || '') + '</div><div class="log-body"><div class="log-main"><span class="pn">' + esc(pName) + '</span> <span class="badge ' + typeCls + '">' + type + '</span></div><div class="log-detail"><span class="log-time">' + timeAgo(h.ts) + '</span></div></div><div class="log-amount" style="color:' + rarColor + '">' + esc(iName) + '</div></div>';
    }).join('');
  }

  function renderTopup(logs) {
    var el = $('log-content'); if (!logs.length) { el.innerHTML = '<div class="emp">Belum ada log topup</div>'; return }
    var sorted = logs.slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0) });
    el.innerHTML = sorted.map(function (h, i) {
      var cur = h.c === 'gem' ? 'Gem' : 'Koin', curCls = h.c === 'gem' ? 'gem' : 'coin', act = h.x === 'add' ? '+' : '-', actCls = h.x === 'add' ? 'add' : 'deduct';
      return '<div class="log-row" style="animation:fs .3s ' + i * 30 + 'ms ease both"><div class="log-icon ' + actCls + '">' + (_ic[actCls] || '') + '</div><div class="log-body"><div class="log-main"><span class="pn admin">' + esc(h.a || 'Admin') + '</span> <span class="arrow">→</span> <span class="pn">' + esc(h.t || '?') + '</span>' + (h.o ? ' <span class="badge offline">Offline</span>' : '') + '</div><div class="log-detail">' + fmt(h.b) + ' → ' + fmt(h.f) + ' ' + cur + ' · <span class="log-time">' + timeAgo(h.ts) + '</span></div></div><div class="log-amount ' + actCls + '">' + act + fmt(h.n) + ' <span class="cur ' + curCls + '">' + cur + '</span></div></div>';
    }).join('');
  }

  function renderDiscCodes() {
    var el = $('disc-content'), codes = _data.disc;
    var entries = Object.entries(codes || {});
    if (!entries.length) { el.innerHTML = '<div class="dc-empty">Tidak ada kode diskon aktif</div>'; return }
    el.innerHTML = '<div class="dc-grid">' + entries.map(function (e, i) {
      var code = e[0], info = e[1], pct = info.pct || 0, uses = info.uses || 0, type = info.type || 'ALL';
      var typeLabel = type === 'ALL' ? 'SEMUA' : type === 'PT' ? 'PARTIKEL' : 'EQUIPMENT';
      return '<div class="dc-card" style="animation:fs .3s ' + i * 60 + 'ms ease both"><div class="dc-top"><span class="dc-code" onclick="copyCode(\'' + esc(code).replace(/'/g, "\\'") + '\')" ><span>' + esc(code) + '</span><span class="copy-hint">KLIK SALIN</span></span><span class="dc-pct">-' + pct + '%</span></div><div class="dc-bottom"><span class="dc-type ' + type.toLowerCase() + '">' + typeLabel + '</span><span class="dc-uses">' + uses + ' sisa</span></div><div class="dc-bar"><div class="dc-bar-fill" style="width:' + Math.min(100, Math.max(5, uses / 50 * 100)) + '%"></div></div></div>';
    }).join('') + '</div>';
  }

  window.copyCode = function (code) { navigator.clipboard.writeText(code).then(function () { var t = $('dc-toast'); t.classList.add('show'); setTimeout(function () { t.classList.remove('show') }, 2000) }).catch(function () { }) };

  /* ═══ Economy Trend Chart ═══ */
  var _trendData = [], _trendRange = 'day', _trendMetric = 'coin_total';
  var _candles = [], _hoverIdx = -1;
  var CU = '#26a69a', CD = '#ef5350';

  function bindTrendTabs() {
    var el = $('trend-tabs'); if (!el) return;
    el.addEventListener('click', function (e) {
      var t = e.target.closest('.tab'); if (!t) return;
      el.querySelectorAll('.tab').forEach(function (b) { b.classList.remove('a') });
      t.classList.add('a'); _trendRange = t.dataset.range; try { localStorage.removeItem(CACHE_TREND) } catch (e) { } fetchTrend();
    });
    var mel = $('trend-metric-tabs');
    if (mel) mel.addEventListener('click', function (e) {
      var t = e.target.closest('.tab'); if (!t) return;
      mel.querySelectorAll('.tab').forEach(function (b) { b.classList.remove('a') });
      t.classList.add('a'); _trendMetric = t.dataset.metric;
      _candles = _agg(_trendData, _trendMetric); _hoverIdx = -1; drawTrendChart();
    });
  }

  function _bucketMs() { return { day: 900000, week: 7200000, month: 43200000 }[_trendRange] || 900000 }

  function _computeMetric(row, metric) {
    if (metric === 'income_per_hour') {
      var cf = row.coin_flow;
      var p = typeof cf === 'string' ? safeParse(cf, null) : cf;
      if (!p) return 0;
      var org = (p.mob_kill || 0) + (p.gacha_refund || 0) + (p.pvp_refund || 0) + (p.first_sale || 0);
      var n = row.player_count || 1;
      return parseFloat(((org / n) * 12).toFixed(2));
    }
    if (metric === 'velocity') {
      var cf3 = row.coin_flow;
      var p3 = typeof cf3 === 'string' ? safeParse(cf3, null) : cf3;
      var bv = (p3 && p3._bv) || row.bank_volume || 0;
      var av = (p3 && p3._av) || row.auction_volume || 0;
      var ct = row.coin_total || 1;
      return parseFloat(((bv + av) / ct).toFixed(6));
    }
    if (metric === 'net_flow') {
      var cf2 = row.coin_flow;
      var p2 = typeof cf2 === 'string' ? safeParse(cf2, null) : cf2;
      if (!p2) return 0;
      var total = 0;
      for (var k in p2) { if (k[0] !== '_') total += p2[k]; }
      return Math.round(total);
    }
    if (metric === 'gini') {
      var cf4 = row.coin_flow;
      var p4 = typeof cf4 === 'string' ? safeParse(cf4, null) : cf4;
      if (p4 && p4._gini) return parseFloat(p4._gini.toFixed(4));
      return row.coin_gini || 0;
    }
    if (metric === 'inflation_rate') {
      var cf5 = row.coin_flow;
      var p5 = typeof cf5 === 'string' ? safeParse(cf5, null) : cf5;
      if (!p5) return 0;
      var nf = 0;
      for (var k2 in p5) { if (k2[0] !== '_') nf += p5[k2]; }
      var sup = row.coin_total || 1;
      return parseFloat(((nf / sup) * 100 * 12).toFixed(4));
    }
    if (metric === 'purchasing_power') {
      var med2 = row.coin_median || 0, ct2 = row.coin_total || 1, n2 = row.player_count || 1;
      return parseFloat(((med2 / ct2) * n2 * 100).toFixed(4));
    }
    return row[metric] || 0;
  }

  function _agg(data, metric) {
    if (!data.length) return [];
    var bms = _bucketMs(), bk = {};
    for (var i = 0; i < data.length; i++) {
      var t = new Date(data[i].ts).getTime(), k = Math.floor(t / bms) * bms;
      if (!bk[k]) bk[k] = { t: k, v: [] }; bk[k].v.push(_computeMetric(data[i], metric));
    }
    var ks = Object.keys(bk).sort(function (a, b) { return a - b }), r = [];
    for (var i = 0; i < ks.length; i++) {
      var b = bk[ks[i]], v = b.v, hi = v[0], lo = v[0];
      for (var j = 1; j < v.length; j++) { if (v[j] > hi) hi = v[j]; if (v[j] < lo) lo = v[j] }
      r.push({ t: b.t, o: v[0], c: v[v.length - 1], h: hi, l: lo, n: v.length });
    }
    return r;
  }

  async function fetchTrend() {
    // Skip network if cache is fresh
    if (_trendData.length > 0 && _cFresh(CACHE_TREND)) {
      _candles = _agg(_trendData, _trendMetric); _hoverIdx = -1;
      drawTrendChart(); renderTrendDeltas(); renderHealthAdvisor(); return;
    }
    var hrs = { day: '24', week: '168', month: '720' }[_trendRange] || '168';
    var since = new Date(Date.now() - hrs * 3600000).toISOString();
    try {
      var r = await fetch(SB_URL + '/rest/v1/economy_history?ts=gte.' + since + '&order=ts.asc&limit=2000', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
      var d = await r.json();
      _trendData = (Array.isArray(d) && d.length > 0) ? d : _fbTrend();
    } catch (e) { _trendData = _fbTrend() }
    _cSet(CACHE_TREND, _trendData);
    _candles = _agg(_trendData, _trendMetric); _hoverIdx = -1;
    var info = $('trend-info');
    if (info) {
      if (_candles.length > 1) info.textContent = _candles.length + ' candles (' + _trendData.length + ' snapshots, +1 setiap 5 menit)';
      else if (_candles.length === 1) info.textContent = '1 candle (' + _trendData.length + ' snapshots) — candle baru setiap 15 menit';
      else info.textContent = 'Menunggu data dari BDS sync...';
    }
    drawTrendChart(); renderTrendDeltas();
    if (_data && _data.lb && _data.lb.summary) renderPricing(_data.lb.summary);
    renderHealthAdvisor();
  }

  function _fbTrend() {
    if (!_data || !_data.lb || !_data.lb.summary) return [];
    var s = _data.lb.summary;
    return [{ ts: _data.synced || new Date().toISOString(), coin_total: s.coin ? s.coin.total : 0, player_count: s.n || 0, coin_median: s.coin ? s.coin.median : 0, coin_avg: s.coin ? s.coin.avg : 0 }];
  }

  function _updHdr(c) {
    var el = $('trend-hdr'); if (!el) return;
    if (!c) { el.innerHTML = '<span style="color:var(--mute)">— Menunggu data —</span>'; return }
    var d = c.c - c.o, pct = c.o > 0 ? ((d / c.o) * 100).toFixed(2) : '0.00', clr = d >= 0 ? CU : CD, sg = d >= 0 ? '+' : '';
    var t = new Date(c.t), ts = t.getDate() + '/' + (t.getMonth() + 1) + ' ' + String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
    el.innerHTML = '<span style="color:var(--mute)">' + ts + '</span> <span>O:<b style="color:var(--dim)">' + fmtN(c.o) + '</b></span> <span>H:<b style="color:' + CU + '">' + fmtN(c.h) + '</b></span> <span>L:<b style="color:' + CD + '">' + fmtN(c.l) + '</b></span> <span>C:<b style="color:var(--text)">' + fmtN(c.c) + '</b></span> <span style="color:' + clr + '">' + sg + fmtN(Math.abs(d)) + ' (' + sg + pct + '%)</span>';
  }

  function drawTrendChart() {
    var cv = $('trend-chart'); if (!cv) return;
    var par = cv.parentElement;
    var W = par ? (par.clientWidth || 600) : 600; if (W < 100) W = 600;
    var H = 220;
    cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    var pad = { t: 12, r: 52, b: 20, l: 6 }, cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
    if (cw <= 0 || ch <= 0) return;
    var n = _candles.length;
    if (!n) {
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
      for (var g = 0; g <= 5; g++) { var gy = pad.t + ch * (g / 5); ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(W - pad.r, gy); ctx.stroke() }
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.font = '600 11px JetBrains Mono,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Menunggu data dari BDS sync...', W / 2, H / 2);
      _updHdr(null); return;
    }
    var mn = Infinity, mx = -Infinity;
    for (var i = 0; i < n; i++) { if (_candles[i].l < mn) mn = _candles[i].l; if (_candles[i].h > mx) mx = _candles[i].h }
    if (mx <= mn) mx = mn + 1;
    var rng = mx - mn, pv = rng * 0.08; mn = Math.max(0, mn - pv); mx = mx + pv;
    function yOf(v) { return pad.t + ch * (1 - (v - mn) / (mx - mn)) }
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.font = '9px JetBrains Mono,monospace'; ctx.textAlign = 'left';
    for (var g = 0; g <= 5; g++) {
      var gy = pad.t + ch * (g / 5); ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(W - pad.r, gy); ctx.stroke();
      var val = mx - (mx - mn) * (g / 5); ctx.fillText(fmtN(val), W - pad.r + 4, gy + 3);
    }
    var gap = Math.max(1, Math.round(cw * 0.12 / n));
    var bw = Math.max(3, Math.floor((cw - gap * (n - 1)) / n)); if (bw > 28) bw = 28;
    var tw = n * bw + (n - 1) * gap, ox = pad.l + Math.floor((cw - tw) / 2);
    for (var i = 0; i < n; i++) {
      var c = _candles[i], x = ox + i * (bw + gap), cx = x + bw / 2, up = c.c >= c.o, clr = up ? CU : CD;
      ctx.strokeStyle = clr; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(Math.round(cx) + .5, yOf(c.h)); ctx.lineTo(Math.round(cx) + .5, yOf(c.l)); ctx.stroke();
      var bt = yOf(up ? c.c : c.o), bb = yOf(up ? c.o : c.c), bh = Math.max(1, bb - bt);
      ctx.fillStyle = up ? 'rgba(38,166,154,0.85)' : 'rgba(239,83,80,0.85)';
      ctx.fillRect(x, bt, bw, bh);
      ctx.strokeRect(x + .5, bt + .5, bw - 1, Math.max(0, bh - 1));
      if (i === _hoverIdx) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(x - 1, pad.t, bw + 2, ch) }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.font = '8px JetBrains Mono,monospace'; ctx.textAlign = 'center';
    var ls = Math.max(1, Math.floor(n / 7));
    for (var i = 0; i < n; i += ls) {
      var t = new Date(_candles[i].t);
      var lb = _trendRange === 'day' ? String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') : _trendRange === 'week' ? (t.getDate() + '/' + (t.getMonth() + 1) + ' ' + t.getHours() + 'h') : t.getDate() + '/' + (t.getMonth() + 1);
      ctx.fillText(lb, ox + i * (bw + gap) + bw / 2, H - pad.b + 14);
    }
    if (_hoverIdx >= 0 && _hoverIdx < n) {
      var hc = _candles[_hoverIdx], hx = ox + _hoverIdx * (bw + gap) + bw / 2;
      ctx.setLineDash([2, 2]); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hx, pad.t); ctx.lineTo(hx, pad.t + ch); ctx.stroke();
      var hy = yOf(hc.c); ctx.beginPath(); ctx.moveTo(pad.l, hy); ctx.lineTo(W - pad.r, hy); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = hc.c >= hc.o ? 'rgba(38,166,154,0.9)' : 'rgba(239,83,80,0.9)';
      ctx.fillRect(W - pad.r, hy - 7, pad.r, 14);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 8px JetBrains Mono,monospace'; ctx.textAlign = 'left';
      ctx.fillText(fmtN(Math.round(hc.c)), W - pad.r + 3, hy + 3);
    }
    _updHdr(_hoverIdx >= 0 ? _candles[_hoverIdx] : _candles[n - 1]);
  }

  function renderTrendDeltas() {
    var el = $('trend-deltas'); if (!el || !_trendData.length) return;
    if (_trendData.length < 4) { el.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--mute);font-size:.45rem;padding:8px">Minimal 4 data points untuk delta.</div>'; return }
    var mid = Math.floor(_trendData.length / 2);
    var keys = [
      { k: 'coin_total', label: 'Coin Supply', color: 'var(--gold)' },
      { k: 'player_count', label: 'Pemain', color: 'var(--cyan)' },
      { k: 'coin_median', label: 'Median Coin', color: 'var(--green)' },
      { k: 'coin_avg', label: 'Avg Coin', color: 'var(--ac)' }
    ];
    var h = '';
    for (var i = 0; i < keys.length; i++) {
      var ki = keys[i], sA = 0, cA = 0, sB = 0, cB = 0;
      for (var j = 0; j < mid; j++) { sA += _computeMetric(_trendData[j], ki.k); cA++ }
      for (var j = mid; j < _trendData.length; j++) { sB += _computeMetric(_trendData[j], ki.k); cB++ }
      var aA = cA ? sA / cA : 0, aB = cB ? sB / cB : 0, d = aB - aA, pct = aA > 0 ? Math.round(d / aA * 100) : 0;
      var sg = d > 0 ? '+' : '', cl = Math.abs(pct) < 2 ? 'var(--mute)' : d > 0 ? 'var(--green)' : 'var(--red)';
      var last = _computeMetric(_trendData[_trendData.length - 1], ki.k);
      h += mkStatCard(ki.label, ki.color, fmtN(last), '<span style="color:' + cl + '">' + sg + pct + '%</span>');
    }
    el.innerHTML = h;
  }

  function renderHealthAdvisor() {
    var el = $('health-content'), pill = $('health-pill');
    if (!el) return;
    if (!_trendData.length || !_data || !_data.lb || !_data.lb.summary) {
      el.innerHTML = '<span style="color:var(--mute)">Menunggu data trend...</span>'; return;
    }
    var s = _data.lb.summary, c = s.coin, last = _trendData[_trendData.length - 1], first = _trendData[0];
    var agg = _aggFlow(), fl = agg.flow;
    var cf = last.coin_flow, p = typeof cf === 'string' ? safeParse(cf, null) : cf;
    var gini = (p && p._gini) || s.gini || 0;
    var med = last.coin_median || c.median || 0, ct = last.coin_total || c.total || 1;
    var n = last.player_count || s.n || 1, avg = ct / n;
    var pp = (med / ct) * n * 100;
    var topPct = c.max > 0 ? (c.max / ct * 100) : 0;
    var totalIn = 0, totalOut = 0;
    var srcKeys = ['mob_kill', 'gacha_refund', 'pvp_refund', 'first_sale', 'topup', 'weekly_reward'];
    var snkKeys = ['gacha_cost', 'bank_tax', 'mob_penalty', 'pvp_penalty', 'auction_fee'];
    for (var i = 0; i < srcKeys.length; i++) totalIn += (fl[srcKeys[i]] || 0);
    for (var i = 0; i < snkKeys.length; i++) totalOut += Math.abs(fl[snkKeys[i]] || 0);
    var netAll = totalIn - totalOut;
    var hrs = _trendData.length > 1 ? (new Date(last.ts || 0) - new Date(first.ts || 0)) / 3600000 : 0;
    var supplyDelta = (last.coin_total || 0) - (first.coin_total || 0);
    var playerDelta = (last.player_count || 0) - (first.player_count || 0);
    var medDelta = (last.coin_median || 0) - (first.coin_median || 0);
    var bv = (p && p._bv) || 0, av = (p && p._av) || 0;
    var vel = (bv + av) / ct;
    var infRate = hrs > 0 ? (supplyDelta / ct * 100) / hrs : 0;
    var issues = [], score = 100;
    var sevC = { r: 'var(--red)', y: 'var(--gold)', g: 'var(--green)' };
    function tag(color, text) { return '<span style="color:' + color + ';font-weight:600">' + text + '</span>'; }
    function num(v) { return '<b>' + fmtN(v) + '</b>'; }
    function mkIss(sev, title, lines) { issues.push({ sev: sev, title: title, lines: lines }); }

    // ── 1. KOEFISIEN GINI ──
    var giniDesc = [];
    var giniAnalog = gini >= 0.8 ? 'setara negara paling timpang di dunia' : gini >= 0.6 ? 'setara negara berkembang dengan ketimpangan tinggi' : gini >= 0.4 ? 'setara negara maju pada umumnya' : 'kondisi sangat egaliter';
    giniDesc.push('Koefisien Gini saat ini: ' + tag(gini >= 0.5 ? sevC.r : sevC.g, gini.toFixed(3)) + ' (' + giniAnalog + '). Gini mengukur seberapa merata kekayaan — 0 berarti semua orang punya sama rata, 1 berarti satu orang menguasai semuanya.');
    giniDesc.push('Top holder menguasai ' + num(c.max) + ' koin (' + tag(topPct > 10 ? sevC.r : sevC.y, topPct.toFixed(1) + '%') + ' dari total supply ' + num(ct) + '). Sementara ' + tag(sevC.y, '25% populasi terbawah') + ' hanya punya ≤ ' + num(c.p25) + ' koin per orang.');
    var avgMedRatio = med > 0 ? (avg / med).toFixed(1) : '∞';
    giniDesc.push('Rasio Mean/Median: ' + tag(avg > med * 5 ? sevC.r : sevC.g, avgMedRatio + 'x') + '. Dalam ekonomi sehat, rasio ini mendekati 1. Semakin besar artinya distribusi semakin miring ke kanan (skewed) — segelintir player mendistorsi rata-rata.');
    if (gini >= 0.8) {
      score -= 30;
      giniDesc.push('');
      giniDesc.push(tag(sevC.r, '⚠ Analisis:') + ' Struktur ekonomi menunjukkan pola Pareto ekstrem. Tanpa intervensi redistribusi, ketimpangan akan terus melebar karena player kaya memiliki akses ke mekanisme compounding (auction flipping, land investment).');
      giniDesc.push(tag('var(--cyan)', '↳ Rekomendasi:') + ' (1) Terapkan pajak progresif pada transfer besar (contoh: >10.000 koin dikenakan 3-5%). (2) Perkenalkan mekanisme "floor income" — bonus harian otomatis untuk player di bawah median (' + num(med) + '). (3) Cap penghasilan mob kill per jam agar top player tidak bisa farm tanpa batas.');
      mkIss('r', '① Distribusi Kekayaan — Gini ' + gini.toFixed(3), giniDesc);
    } else if (gini >= 0.5) {
      score -= 15; giniDesc.push('');
      giniDesc.push(tag('var(--cyan)', '↳ Rekomendasi:') + ' Monitor tren Gini. Jika stabil atau menurun, tidak perlu intervensi. Jika naik konsisten, pertimbangkan kebijakan redistribusi ringan.');
      mkIss('y', '① Distribusi Kekayaan — Gini ' + gini.toFixed(3), giniDesc);
    } else { mkIss('g', '① Distribusi Kekayaan — Gini ' + gini.toFixed(3), giniDesc); }

    // ── 2. DAYA BELI (PURCHASING POWER) ──
    var ppDesc = [];
    ppDesc.push('Player median memiliki ' + num(med) + ' koin. Dengan ' + n + ' player dan supply ' + num(ct) + ', daya beli median berada di ' + tag(pp < 0.5 ? sevC.r : pp < 2 ? sevC.y : sevC.g, pp.toFixed(2) + '%') + '.');
    ppDesc.push('Apa artinya? Bayangkan seluruh koin di server dibagi rata ke semua player — masing-masing dapat ' + num(Math.round(avg)) + '. Tapi kenyataannya player median hanya punya ' + num(med) + '. ' + (avg > med * 5 ? 'Ini berarti kekayaan ' + tag(sevC.r, 'terkonsentrasi di atas') + ' dan mayoritas player jauh di bawah rata-rata.' : 'Perbedaan ini masih dalam batas normal.'));
    if (pp < 0.5) {
      score -= 25; ppDesc.push('');
      ppDesc.push(tag(sevC.r, '⚠ Analisis:') + ' Daya beli di bawah 0.5% menandakan mayoritas populasi berada dalam kondisi "subsisten" — mereka bisa farming, tapi tidak mampu mengakses fitur ekonomi utama (land, gacha, auction). Ini menciptakan dua kelas ekonomi yang terpisah.');
      ppDesc.push(tag('var(--cyan)', '↳ Rekomendasi:') + ' (1) Tingkatkan base income farming 2-3x. (2) Perkenalkan "starter fund" — bonus satu kali untuk player baru agar bisa berpartisipasi sejak awal. (3) Turunkan floor price land agar terjangkau oleh player median.');
      mkIss('r', '② Daya Beli Median — ' + pp.toFixed(2) + '%', ppDesc);
    } else if (pp < 2) {
      score -= 10; ppDesc.push('');
      ppDesc.push(tag('var(--cyan)', '↳ Rekomendasi:') + ' Daya beli marginal. Pertimbangkan insentif sementara (event bonus, diskon) untuk meningkatkan partisipasi ekonomi kelas menengah.');
      mkIss('y', '② Daya Beli Median — ' + pp.toFixed(2) + '%', ppDesc);
    } else { mkIss('g', '② Daya Beli Median — ' + pp.toFixed(2) + '%', ppDesc); }

    // ── 3. STABILITAS MONETER ──
    var infDesc = [];
    if (hrs > 0.1) {
      infDesc.push('Periode observasi: ' + tag('var(--cyan)', hrs.toFixed(1) + ' jam') + ' (' + _trendData.length + ' data points).');
      infDesc.push('Money supply: ' + num(first.coin_total) + ' → ' + num(last.coin_total) + ' (Δ ' + tag(supplyDelta >= 0 ? sevC.g : sevC.r, (supplyDelta >= 0 ? '+' : '') + fmtN(supplyDelta)) + '). Laju: ' + tag(Math.abs(infRate) > 1 ? sevC.r : sevC.g, infRate.toFixed(4) + '%/jam') + '.');
    }
    if (totalIn > 0 || totalOut > 0) {
      infDesc.push('');
      var srcLabel = { mob_kill: 'Farming', gacha_refund: 'Refund Gacha', pvp_refund: 'Refund PvP', first_sale: 'First Sale Bonus', topup: 'Admin Topup', weekly_reward: 'Reward Mingguan' };
      var snkLabel = { gacha_cost: 'Gacha', bank_tax: 'Pajak Transfer', mob_penalty: 'Anti-Stack', pvp_penalty: 'Penalti PvP', auction_fee: 'Fee Auction' };
      infDesc.push('Sumber penciptaan koin (injection):');
      for (var i = 0; i < srcKeys.length; i++) { var v = fl[srcKeys[i]] || 0; if (v > 0) infDesc.push('  • ' + (srcLabel[srcKeys[i]] || srcKeys[i]) + ': ' + tag(sevC.g, '+' + fmtN(v))); }
      if (totalOut > 0) {
        infDesc.push('Mekanisme penyerapan koin (sink):');
        for (var i = 0; i < snkKeys.length; i++) { var v = fl[snkKeys[i]] || 0; if (v !== 0) infDesc.push('  • ' + (snkLabel[snkKeys[i]] || snkKeys[i]) + ': ' + tag(sevC.r, fmtN(v))); }
      }
      var sinkRatio = totalIn > 0 ? (totalOut / totalIn * 100).toFixed(0) : 0;
      infDesc.push('Rasio sink/source: ' + tag(sinkRatio > 70 ? sevC.g : sinkRatio > 40 ? sevC.y : sevC.r, sinkRatio + '%') + '. ' + (sinkRatio > 80 ? 'Keseimbangan fiskal sangat baik.' : sinkRatio > 50 ? 'Cukup seimbang.' : 'Koin masuk jauh lebih banyak dari yang diserap. Tekanan inflasi tinggi.'));
    }
    if (infRate > 1) {
      score -= 20; infDesc.push('');
      infDesc.push(tag(sevC.r, '⚠ Analisis:') + ' Laju inflasi ' + infRate.toFixed(2) + '%/jam berarti dalam 24 jam, money supply bertambah ~' + (infRate * 24).toFixed(1) + '%. Jika dibiarkan, nilai koin akan menurun dan harga barang di pasar sekunder (auction) akan naik — merugikan player yang menabung.');
      infDesc.push(tag('var(--cyan)', '↳ Rekomendasi:') + ' Perkuat mekanisme sink: (1) Naikkan biaya gacha. (2) Perkenalkan item prestige dengan harga tinggi. (3) Terapkan "demurrage" — biaya penyimpanan kecil untuk saldo sangat besar.');
      mkIss('r', '③ Stabilitas Moneter — Inflasi ' + infRate.toFixed(2) + '%/jam', infDesc);
    } else if (infRate > 0.1) {
      score -= 5; infDesc.push('');
      infDesc.push(tag('var(--cyan)', '↳ Catatan:') + ' Inflasi ringan (' + infRate.toFixed(2) + '%/jam) adalah hal yang wajar dalam ekonomi yang tumbuh. Monitor agar tetap di bawah 1%.');
      mkIss('y', '③ Stabilitas Moneter — Inflasi ' + infRate.toFixed(2) + '%/jam', infDesc);
    } else if (infRate < -0.5) {
      score -= 15; infDesc.push('');
      infDesc.push(tag(sevC.r, '⚠ Analisis:') + ' Terjadi kontraksi moneter signifikan. Koin diserap lebih cepat dari yang diciptakan. Player akan merasa penghasilan mereka tidak cukup, yang bisa menurunkan aktivitas ekonomi secara keseluruhan.');
      infDesc.push(tag('var(--cyan)', '↳ Rekomendasi:') + ' (1) Kurangi tax/fee sementara. (2) Tambah sumber income baru. (3) Berikan stimulus berupa event bonus.');
      mkIss('r', '③ Stabilitas Moneter — Deflasi ' + Math.abs(infRate).toFixed(2) + '%/jam', infDesc);
    } else if (infRate < -0.1) {
      score -= 5; infDesc.push('');
      infDesc.push(tag('var(--cyan)', '↳ Catatan:') + ' Deflasi ringan terdeteksi. Pantau apakah tren ini berlanjut.');
      mkIss('y', '③ Stabilitas Moneter — Deflasi ringan', infDesc);
    } else { mkIss('g', '③ Stabilitas Moneter — Ekuilibrium', infDesc); }

    // ── 4. VELOCITY OF MONEY ──
    var velDesc = [];
    velDesc.push('Mengacu pada persamaan Fisher (MV=PQ): Velocity mengukur seberapa sering uang berpindah tangan. Volume terakhir: Bank ' + num(bv) + ' + Auction ' + num(av) + ' = ' + num(bv + av) + ' dari supply ' + num(ct) + '.');
    velDesc.push('V = ' + tag(vel < 0.001 ? sevC.y : sevC.g, vel.toFixed(6)) + '. ' + (vel < 0.001 ? 'Velocity sangat rendah — ekonomi mengalami "liquidity trap". Player memiliki koin tapi tidak membelanjakannya. Uang yang tidak berputar sama saja dengan uang yang tidak ada.' : vel < 0.01 ? 'Velocity rendah — aktivitas perdagangan terbatas. Ekonomi bergerak, tapi lambat.' : 'Velocity sehat — uang berputar aktif, menandakan ekonomi yang dinamis dan partisipatif.'));
    if (vel < 0.001) {
      score -= 10; velDesc.push('');
      velDesc.push(tag('var(--cyan)', '↳ Rekomendasi:') + ' (1) Buat insentif untuk bertransaksi — misalnya cashback kecil per transaksi auction. (2) Perkenalkan limited-time items yang mendorong urgensi belanja. (3) Kurangi friction: turunkan fee auction sementara untuk mendorong partisipasi.');
      mkIss('y', '④ Velocity of Money — ' + vel.toFixed(4), velDesc);
    } else { mkIss('g', '④ Velocity of Money — ' + vel.toFixed(4), velDesc); }

    // ── 5. DEMOGRAFI & TREN ──
    if (hrs > 0.1) {
      var popDesc = [];
      popDesc.push('Populasi: ' + num(first.player_count) + ' → ' + num(last.player_count) + ' (' + tag(playerDelta >= 0 ? sevC.g : sevC.r, (playerDelta >= 0 ? '+' : '') + playerDelta) + ' dalam ' + hrs.toFixed(1) + ' jam). Median koin: ' + num(first.coin_median) + ' → ' + num(last.coin_median) + '.');
      if (playerDelta > 0 && medDelta < 0) {
        popDesc.push(tag(sevC.y, '↳ Catatan:') + ' Terjadi "dilution effect" — player baru masuk dengan saldo rendah, menekan median ke bawah. Ini wajar saat server tumbuh, namun perlu dipastikan jalur income yang memadai tersedia agar mereka tidak terjebak di strata bawah.');
      } else if (playerDelta > 0 && medDelta >= 0) {
        popDesc.push(tag(sevC.g, '↳ Observasi:') + ' Pertumbuhan populasi diiringi kenaikan median — indikasi positif bahwa ekonomi mampu menyerap pemain baru tanpa penurunan standar hidup.');
      } else if (playerDelta <= 0) {
        popDesc.push(tag(sevC.y, '↳ Observasi:') + ' Populasi stagnan atau menurun. Perlu evaluasi apakah ada faktor eksternal atau masalah retensi yang perlu ditangani.');
      }
      mkIss(playerDelta >= 0 && medDelta >= 0 ? 'g' : 'y', '⑤ Demografi & Tren — ' + (playerDelta >= 0 ? '+' : '') + playerDelta + ' player', popDesc);
    }

    // ── SCORE ──
    score = Math.max(0, Math.min(100, score));
    var grade = score >= 80 ? 'SEHAT' : score >= 50 ? 'PERLU PERHATIAN' : 'KRITIS';
    var gc = score >= 80 ? 'g' : score >= 50 ? 'y' : 'r';
    if (pill) { pill.textContent = grade + ' (' + score + '/100)'; pill.className = 'pill ' + gc; }

    // ── RENDER ──
    var h = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">';
    var meters = [
      { label: 'Gini', val: gini.toFixed(3), sev: gini >= 0.8 ? 'r' : gini >= 0.5 ? 'y' : 'g' },
      { label: 'Daya Beli', val: pp.toFixed(2) + '%', sev: pp < 0.5 ? 'r' : pp < 2 ? 'y' : 'g' },
      { label: 'Inflasi', val: infRate.toFixed(2) + '%/jam', sev: Math.abs(infRate) > 1 ? 'r' : Math.abs(infRate) > 0.1 ? 'y' : 'g' },
      { label: 'Velocity', val: vel.toFixed(4), sev: vel < 0.001 ? 'y' : 'g' },
      { label: 'Skor', val: score + '/100', sev: gc }
    ];
    for (var i = 0; i < meters.length; i++) {
      var m = meters[i];
      h += '<div style="flex:1;min-width:80px;text-align:center;padding:6px 4px;border-radius:6px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04)">';
      h += '<div style="font-size:.34rem;color:var(--mute);text-transform:uppercase;letter-spacing:.5px">' + m.label + '</div>';
      h += '<div style="font-size:.56rem;font-weight:700;color:' + sevC[m.sev] + '">' + m.val + '</div></div>';
    }
    h += '</div>';
    for (var i = 0; i < issues.length; i++) {
      var iss = issues[i], col = sevC[iss.sev];
      h += '<div style="margin-bottom:10px;padding:10px 12px;border-radius:8px;background:rgba(255,255,255,0.015);border-left:3px solid ' + col + '">';
      h += '<div style="color:' + col + ';font-weight:700;font-size:.46rem;margin-bottom:6px">' + iss.title + '</div>';
      for (var j = 0; j < iss.lines.length; j++) {
        var ln = iss.lines[j];
        if (ln === '') h += '<div style="height:6px"></div>';
        else h += '<div style="margin-bottom:2px;line-height:1.6">' + ln + '</div>';
      }
      h += '</div>';
    }
    el.innerHTML = h;
  }

  var _nextFetch = 120, _countdownId = null;
  function _startCountdown() {
    _nextFetch = 120;
    if (_countdownId) clearInterval(_countdownId);
    _countdownId = setInterval(function () {
      _nextFetch--;
      var el = $('eco-countdown');
      if (el) el.textContent = _nextFetch + 's';
      if (_nextFetch <= 0) { _nextFetch = 120; fetchAll(); }
    }, 1000);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { try { localStorage.removeItem(CACHE_KEY); localStorage.removeItem(CACHE_TREND) } catch (e) { } _nextFetch = 0; } });

  function _initTrend() {
    bindTrendTabs();
    setTimeout(drawTrendChart, 100);
    var cv = $('trend-chart');
    if (cv) {
      cv.addEventListener('mousemove', function (e) {
        if (!_candles.length) return;
        var rect = cv.getBoundingClientRect(), sc = cv.width / rect.width;
        var sx = (e.clientX - rect.left) * sc, n = _candles.length;
        var pad_l = 6, pad_r = 52, cw = cv.width - pad_l - pad_r;
        var gap = Math.max(1, Math.round(cw * 0.12 / n));
        var bw = Math.max(3, Math.floor((cw - gap * (n - 1)) / n)); if (bw > 28) bw = 28;
        var tw = n * bw + (n - 1) * gap, ox = pad_l + Math.floor((cw - tw) / 2);
        var idx = Math.round((sx - ox - bw / 2) / (bw + gap));
        if (idx < 0) idx = 0; if (idx >= n) idx = n - 1;
        if (_hoverIdx !== idx) { _hoverIdx = idx; drawTrendChart() }
      });
      cv.addEventListener('mouseleave', function () { if (_hoverIdx !== -1) { _hoverIdx = -1; drawTrendChart() } });
    }
  }
  window.addEventListener('resize', function () { drawTrendChart() });
})();