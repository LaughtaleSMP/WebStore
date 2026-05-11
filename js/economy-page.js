(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id) };
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML }
  function fmtN(n) { n = n || 0; if (n !== 0 && Math.abs(n) < 1) return n.toFixed(4); if (Number.isInteger(n) || Math.abs(n) >= 1000) return Math.round(n).toLocaleString('id-ID'); return n.toFixed(2) }
  function fmt(n) { return (n || 0).toLocaleString('id-ID') }
  function timeAgo(ts) { if (!ts) return '?'; var s = Math.floor((Date.now() - ts) / 1000); if (s < 60) return s + 's lalu'; if (s < 3600) return Math.floor(s / 60) + 'm lalu'; if (s < 86400) return Math.floor(s / 3600) + 'j lalu'; return Math.floor(s / 86400) + 'h lalu' }
  function setText(id, t) { var el = $(id); if (el) el.textContent = t }

  var _data = null, _activeTab = 'bank', _activeMod = 'analytics';
  var _lastPricing = null;
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
  var CACHE_KEY = 'eco_data', CACHE_TREND_PFX = 'eco_trend_', CACHE_TTL = 90000, TREND_TTL = 120000;
  function _trendCacheKey() { return CACHE_TREND_PFX + _trendRange; }
  function _cGet(k) { try { var r = JSON.parse(localStorage.getItem(k)); if (r && r.t && Date.now() - r.t < (k.indexOf(CACHE_TREND_PFX) === 0 ? TREND_TTL : CACHE_TTL)) return r.d; } catch (e) { } return null; }
  function _cSet(k, v) { try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), d: v })); } catch (e) { } }
  function _cFresh(k) { try { var r = JSON.parse(localStorage.getItem(k)); return r && r.t && Date.now() - r.t < (k.indexOf(CACHE_TREND_PFX) === 0 ? TREND_TTL : CACHE_TTL); } catch (e) { return false } }

  window.addEventListener('DOMContentLoaded', function () {
    bindModTabs(); bindLogTabs(); _initTrend();
    // Restore trend cache FIRST — agar _aggFlow() punya data saat renderAnalytics() berjalan
    var cachedTrend = _cGet(_trendCacheKey());
    if (cachedTrend && cachedTrend.length) {
      _trendData = cachedTrend;
      _candles = _agg(_trendData, _trendMetric);
    }
    var cached = _cGet(CACHE_KEY);
    if (cached) { _data = cached; renderAnalytics(); renderLogStats(); renderLogs(); renderDiscCodes(); renderTax(); }
    // Gambar chart setelah kedua data siap
    if (_candles.length) { drawTrendChart(); renderTrendVitals(); renderHealthAdvisor(); _startLiveTick(); }
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
      renderAnalytics(); renderLogStats(); renderLogs(); renderDiscCodes(); renderTax();
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
    var agg = _aggFlow();
    var flow = agg.flow;
    var hasFlow = false;
    for (var k in flow) { if (flow[k] !== 0) { hasFlow = true; break; } }
    var injected = 0, sunk = 0;
    var sources = [
      { k: 'mob_kill', label: 'Mob Kill' }, { k: 'topup', label: 'Topup' },
      { k: 'gacha_refund', label: 'Gacha Refund' }, { k: 'pvp_refund', label: 'PvP Refund' },
      { k: 'weekly_reward', label: 'Weekly LB' }, { k: 'first_sale', label: '1st Sale' },
      { k: 'land_refund', label: 'Land Refund' }, { k: 'tax_distribute', label: 'Tax Distrib' },
      { k: 'ubi_injection', label: 'UBI Pemain Baru' }
    ];
    var sinks = [
      { k: 'gacha_cost', label: 'Gacha Cost' }, { k: 'bank_tax', label: 'Bank Tax' },
      { k: 'mob_penalty', label: 'Anti-Stack' }, { k: 'pvp_penalty', label: 'PvP Penalty' },
      { k: 'auction_fee', label: 'Auction Fee' }, { k: 'wealth_tax', label: 'Wealth Tax' },
      { k: 'demurrage', label: 'Demurrage' },
      { k: 'land_buy', label: 'Land Buy' }, { k: 'land_ppn', label: 'Land PPN' },
      { k: 'store_sink', label: 'Store Buy' }
    ];
    if (hasFlow) {
      for (var i = 0; i < sources.length; i++) { var v = flow[sources[i].k] || 0; if (v > 0) injected += v; }
      for (var i = 0; i < sinks.length; i++) { var v = Math.abs(flow[sinks[i].k] || 0); if (v > 0) sunk += v; }
      // Simpan snapshot non-zero ke localStorage (TTL 48 jam)
      try { localStorage.setItem('_eco_flow_snap', JSON.stringify({ f: flow, inj: injected, snk: sunk, snaps: agg.snapshots, ts: Date.now() })); } catch (e) {}
    } else {
      // Coba pakai snapshot terakhir yang valid (dalam 48 jam)
      try {
        var snap = JSON.parse(localStorage.getItem('_eco_flow_snap'));
        if (snap && Date.now() - snap.ts < 172800000) {
          flow = snap.f || flow; injected = snap.inj || 0; sunk = snap.snk || 0;
          agg = { flow: flow, snapshots: snap.snaps || 0, bankVol: 0, auctionVol: 0 };
          hasFlow = injected > 0 || sunk > 0;
        }
      } catch (e) {}
      if (!hasFlow) {
        for (var i = 0; i < topup.length; i++) if ((topup[i].x || topup[i].action) === 'add') injected += Math.abs(topup[i].n || topup[i].amount || 0);
        for (var i = 0; i < gacha.length; i++) sunk += Math.abs(gacha[i].cost || gacha[i].c || 0);
      }
    }
    var net = injected - sunk;
    var rate = s.coin.total > 0 ? Math.round(net / s.coin.total * 100) : 0;
    var pill = $('inf-pill');
    if (pill) {
      var lbl = rate > 5 ? 'INFLASI' : rate < -5 ? 'DEFLASI' : 'STABIL';
      pill.textContent = lbl + ' (' + rate + '%)';
      pill.className = 'pill ' + (Math.abs(rate) <= 5 ? 'g' : Math.abs(rate) <= 15 ? 'y' : 'r');
    }
    var rangeLabel = { day: '24j', week: '7h', month: '30h' }[_trendRange] || '24j';
    var grid = $('inf-grid');
    if (grid) {
      var wt = Math.abs(flow.wealth_tax || 0);
      grid.innerHTML = mkStatCard('Coin Masuk', 'var(--green)', '+' + fmtN(injected), agg.snapshots + ' snap / ' + rangeLabel)
        + mkStatCard('Coin Keluar', 'var(--red)', '-' + fmtN(sunk), agg.snapshots + ' snap / ' + rangeLabel)
        + mkStatCard('Net Flow', net >= 0 ? 'var(--gold)' : 'var(--red)', (net >= 0 ? '+' : '') + fmtN(net), hasFlow ? 'akurat' : 'estimasi')
        + mkStatCard('Wealth Tax', '#c084fc', wt > 0 ? '-' + fmtN(wt) : '0', 'total ' + rangeLabel);
    }
    var fd = $('inf-flows');
    if (fd && hasFlow) {
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
    var f = { mob_kill: 0, gacha_refund: 0, pvp_refund: 0, first_sale: 0, topup: 0, weekly_reward: 0, gacha_cost: 0, bank_tax: 0, mob_penalty: 0, pvp_penalty: 0, auction_fee: 0, land_buy: 0, land_ppn: 0, land_buy_gem: 0, land_refund: 0, wealth_tax: 0, tax_distribute: 0, store_sink: 0, ubi_injection: 0, demurrage: 0 };
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
    _lastPricing = { coinBasis: coinBasis, vMul: vMul, gMul: gMul, anchor: coinAnchor, gemRatio: gemCoinRatio, summary: s, calcC: calcC };
    renderFeatureGuide();
  }

  function renderFeatureGuide() {
    var el = $('feature-guide'); if (!el || !_data || !_data.lb || !_data.lb.guide) return;
    var g = _data.lb.guide, cb = g.basis || 1;
    var pill = $('guide-price-pill');
    if (pill) { pill.textContent = fmtN(Math.round(cb)) + '/JAM'; pill.className = 'pill g'; }

    var cards = [];

    function row(label, val, note) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.025)">' +
        '<span style="color:var(--dim);font-weight:400">' + label + '</span>' +
        '<span style="text-align:right;white-space:nowrap">' +
          '<span style="color:var(--text);font-weight:600">' + val + '</span>' +
          (note ? ' <span style="color:var(--mute);font-size:.32rem;font-weight:400">' + note + '</span>' : '') +
        '</span></div>';
    }

    function buildCard(title, color, content, span) {
      return '<div style="padding:10px 12px;border-radius:6px;background:rgba(255,255,255,0.018);' +
        'border:1px solid rgba(255,255,255,0.035);border-top:2px solid ' + color +
        (span ? ';grid-column:1/-1' : '') + '">' +
        '<div style="color:' + color + ';font-weight:700;font-size:.42rem;margin-bottom:8px;letter-spacing:.4px;text-transform:uppercase">' + title + '</div>' +
        content + '</div>';
    }

    function section(text) {
      return '<div style="color:var(--mute);font-weight:600;font-size:.34rem;text-transform:uppercase;letter-spacing:.5px;margin:6px 0 3px;padding-bottom:2px;border-bottom:1px solid rgba(255,255,255,0.03)">' + text + '</div>';
    }

    function note(content) {
      return '<div style="margin-top:6px;padding:5px 8px;border-radius:4px;background:rgba(255,255,255,0.015);color:var(--mute);font-size:.34rem;line-height:1.5">' + content + '</div>';
    }

    // ━━━ 1. MIMI LAND ━━━
    var ld = g.land, lr = ld.tiers || [], ex = ld.examples || [];
    var landRows = '';
    for (var i = 0; i < lr.length; i++) {
      var lbl = i === 0 ? '≤15×15' : i === 1 ? '≤30×30' : i === 2 ? '≤50×50' : '>50×50';
      landRows += row(lbl, fmtN(lr[i].r) + '/blk²', '');
    }
    var exRows = '';
    for (var i = 0; i < ex.length; i++) {
      var hrs = cb > 0 ? Math.round(ex[i].price / cb) : '?';
      exRows += row(ex[i].sz + ' (' + fmtN(ex[i].area) + ')', fmtN(ex[i].price), '~' + hrs + 'j');
    }
    cards.push(buildCard('Mimi Land', 'var(--green)',
      section('Rate per Block²') + landRows +
      section('Contoh Harga') + exRows +
      note('Gem diskon ' + (ld.gemDiscount||99) + '% · PPN ' + (ld.ppnPct||5) + '% (land ke-' + ((ld.ppnFreeLimit||3)+1) + '+) · Max ' + (ld.maxPerPlayer||5) + ' · Min ' + (ld.minArea||9) + ' blk²')
    ));

    // ━━━ 2. GACHA ━━━
    var gc = g.gacha;
    var rateStr = '';
    if (gc.rates) {
      var rItems = [
        ['C', gc.rates.common||70, 'var(--mute)'],
        ['U', gc.rates.uncommon||22, 'var(--green)'],
        ['R', gc.rates.rare||6.5, '#3b82f6'],
        ['E', gc.rates.epic||1.45, 'var(--ac)'],
        ['L', gc.rates.legendary||0.05, 'var(--gold)']
      ];
      rateStr = rItems.map(function(r) {
        return '<span style="color:' + r[2] + '">' + r[0] + ' ' + r[1] + '%</span>';
      }).join(' · ');
    }
    cards.push(buildCard('Gacha', '#c084fc',
      section('Equipment (Koin)') +
      row('1× Pull', fmtN(gc.eq1), '~' + (cb>0?(gc.eq1/cb).toFixed(1):'?') + 'j') +
      row('10× Pull', fmtN(gc.eq10), 'hemat ' + fmtN(gc.eq1*10-gc.eq10)) +
      section('Partikel (Gem)') +
      row('1× Pull', gc.pt1 + ' Gem', '') +
      row('10× Pull', gc.pt10 + ' Gem', 'hemat ' + (gc.pt1*10-gc.pt10)) +
      note(rateStr + '<br>Pity R: ' + fmtN(gc.pityRare) + ' · Pity L: ' + fmtN(gc.pityLeg) + ' · Dup refund: ' + gc.gemRefund + ' Gem')
    ));

    // ━━━ 3. AUCTION ━━━
    var ac = g.auction;
    cards.push(buildCard('Auction', 'var(--cyan)',
      section('Biaya & Limit') +
      row('Listing Fee', ac.feePct + '%', 'dari harga') +
      row('Range Harga', fmtN(ac.minPrice) + ' — ' + fmtN(ac.maxPrice), '') +
      row('Durasi', ac.durationH + ' jam', '') +
      row('Max Listing', ac.maxPerPlayer + '/player', ac.maxGlobal + ' global') +
      row('First Sale Bonus', '+' + fmtN(ac.firstSaleBonus), 'sekali') +
      note('Bid increment +' + ac.bidIncrPct + '% (min ' + fmtN(ac.minBidIncr) + ') · Anti-snipe ' + ac.antiSnipeMin + ' menit')
    ));

    // ━━━ 4. BANK ━━━
    var bk = g.bank, bt = bk.baseTax, adj = bk.policyAdj || 0, eTax = bk.effectiveTax;
    var adjTxt = adj > 0 ? ' <span style="color:var(--red)">(+' + adj + '% stab)</span>' : adj < 0 ? ' <span style="color:var(--green)">(' + adj + '% stab)</span>' : '';
    // [DYNAMIC] Build bracket rows from server data
    var bkts = bk.brackets || [{ max: 100, extra: 0 }, { max: 1000, extra: 2 }, { max: 3000, extra: 4 }, { max: null, extra: 6 }];
    var bktRows = '';
    for (var bi = 0; bi < bkts.length; bi++) {
      var b = bkts[bi];
      var label = (b.max === null || b.max === Infinity || b.max > 1e6) ? '>' + fmtN(bkts[bi-1]?.max || 0) : (bi === 0 ? '≤' + fmtN(b.max) : fmtN((bkts[bi-1]?.max || 0)+1) + ' — ' + fmtN(b.max));
      bktRows += row(label, (eTax + b.extra) + '%', '');
    }
    // Example calculations using actual brackets
    var ex1Extra = 0, ex5Extra = 0;
    for (var ei = 0; ei < bkts.length; ei++) { if (1000 <= (bkts[ei].max === null || bkts[ei].max === Infinity ? 1e9 : bkts[ei].max)) { ex1Extra = bkts[ei].extra; break; } }
    for (var fi = 0; fi < bkts.length; fi++) { if (5000 <= (bkts[fi].max === null || bkts[fi].max === Infinity ? 1e9 : bkts[fi].max)) { ex5Extra = bkts[fi].extra; break; } }
    cards.push(buildCard('Bank', 'var(--gold)',
      section('Transfer') +
      row('Range', fmtN(bk.minTransfer) + ' — ' + fmtN(bk.maxTransfer), '') +
      row('Limit Harian', fmtN(bk.dailyLimit), '') +
      row('Free Transfer', bk.freeTransfers + '×/hari', '') +
      section('Pajak — base ' + bt + '%' + adjTxt) +
      bktRows +
      note(
        row('100 (free)', fmtN(100), 'pajak 0') +
        row('1.000', fmtN(1000+Math.ceil(1000*(eTax+ex1Extra)/100)), 'pajak ' + fmtN(Math.ceil(1000*(eTax+ex1Extra)/100))) +
        row('5.000', fmtN(5000+Math.ceil(5000*(eTax+ex5Extra)/100)), 'pajak ' + fmtN(Math.ceil(5000*(eTax+ex5Extra)/100)))
      )
    ));

    // ━━━ 5. WEALTH TAX ━━━
    var wt = g.wealthTax;
    var aggWt = _aggFlow();
    var wtFlowTotal    = Math.abs(aggWt.flow.wealth_tax || 0);
    var wtDistributed  = Math.abs(aggWt.flow.tax_distribute || 0);
    // Persistensi: simpan nilai non-zero ke localStorage (TTL 48 jam)
    if (wtFlowTotal > 0 || wtDistributed > 0) {
      try { localStorage.setItem('_eco_wt_snap', JSON.stringify({ c: wtFlowTotal, d: wtDistributed, ts: Date.now() })); } catch (e) {}
    } else {
      // Fallback ke snapshot terakhir jika masih dalam 48 jam
      try {
        var wtSnap = JSON.parse(localStorage.getItem('_eco_wt_snap'));
        if (wtSnap && Date.now() - wtSnap.ts < 172800000) {
          wtFlowTotal   = wtSnap.c || 0;
          wtDistributed = wtSnap.d || 0;
        }
      } catch (e) {}
    }
    var rangeL = { day: '24j', week: '7h', month: '30h' }[_trendRange] || '24j';
    function wtStatBox(label, val, color) {
      return '<div style="flex:1;min-width:80px;text-align:center;padding:8px 6px;border-radius:6px;' +
        'background:linear-gradient(135deg,rgba(244,114,182,0.05),rgba(244,114,182,0.01));' +
        'border:1px solid rgba(244,114,182,0.1)">' +
        '<div style="font-family:\'JetBrains Mono\',monospace;font-size:.30rem;color:var(--mute);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">' + label + '</div>' +
        '<div style="font-family:\'JetBrains Mono\',monospace;font-size:.58rem;font-weight:700;color:' + color + ';line-height:1">' + val + '</div>' +
        '</div>';
    }
    var treasuryVal = (wt && wt.treasury !== undefined) ? wt.treasury : 0;
    var treasuryBar =
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">' +
        wtStatBox('Treasury Saat Ini', fmtN(treasuryVal) + ' Koin', '#f472b6') +
        wtStatBox('Terkumpul ' + rangeL, wtFlowTotal > 0 ? fmtN(wtFlowTotal) : '0', 'var(--red)') +
        wtStatBox('Didistribusi ' + rangeL, wtDistributed > 0 ? fmtN(wtDistributed) : '0', 'var(--green)') +
      '</div>';
    if (wt) {
      var hasTier3 = (wt.tier3 !== undefined) || (wt.rate3 !== undefined);
      var subsidyNote = '';
      if (wt.subsidy) {
        subsidyNote =
          section('Subsidi Aktivitas (Earned Income)') +
          row('Kill Mob Bonus', '+' + (wt.subsidy.killBonus || 1) + ' koin/kill', 'dari treasury') +
          row('Quest/Ach Bonus', '+' + Math.round((wt.subsidy.questMult || 0.20) * 100) + '%', 'dari treasury') +
          row('Syarat Subsidi', 'Saldo < ' + fmtN(wt.subsidy.balanceCap || 5000), 'koin');
      }
      var wtContent;
      if (hasTier3 || !wt.tier1) {
        wtContent =
          treasuryBar +
          section('Tier Pajak Harian (Semua Player)') +
          row('> ' + fmtN(wt.tier1 || 5000),  (wt.rate1 || 0.5) + '%/hari', 'ringan') +
          row('> ' + fmtN(wt.tier2 || 20000), (wt.rate2 || 1.0) + '%/hari', 'sedang') +
          row('> ' + fmtN(wt.tier3 || 50000), (wt.rate3 || 2.0) + '%/hari', 'tinggi') +
          subsidyNote +
          note('Dipotong otomatis 1x/hari (20:00 WIB). Treasury didistribusikan gradual via subsidi aktivitas ke player dengan saldo &lt; 5.000.');
      } else {
        wtContent =
          treasuryBar +
          section('Tier Pajak Harian') +
          row('Acuan P75', fmtN(wt.p75), '') +
          row('Tier 1 (>' + fmtN(wt.tier1) + ')', wt.rate1 + '%/hari', 'P75\u00d73') +
          row('Tier 2 (>' + fmtN(wt.tier2) + ')', wt.rate2 + '%/hari', 'P75\u00d710') +
          subsidyNote +
          note('Dipotong otomatis 1x/hari dari scoreboard.');
      }
      cards.push(buildCard('Wealth Tax', '#f472b6', wtContent));
    } else {
      cards.push(buildCard('Wealth Tax', '#f472b6',
        treasuryBar +
        section('Tier Pajak Harian (Semua Player)') +
        row('> 5.000', '0.5%/hari', 'ringan') +
        row('> 20.000', '1.0%/hari', 'sedang') +
        row('> 50.000', '2.0%/hari', 'tinggi') +
        note('Dipotong otomatis 1x/hari (20:00 WIB). Treasury didistribusikan gradual via subsidi aktivitas.')
      ));
    }

    // ━━━ 6. STORE (Bahan Build) ━━━
    // Tier progresif & kalkulasi harga ikut basis server (coin income/jam).
    var storeTiers = [
      { range: '1-5u',    mult: 1.0, color: 'var(--green)' },
      { range: '6-20u',   mult: 1.6, color: 'var(--gold)' },
      { range: '21-50u',  mult: 2.8, color: '#f59e0b' },
      { range: '51-100u', mult: 4.5, color: 'var(--red)' },
      { range: '100+',    mult: 7.0, color: '#dc2626' },
    ];
    var storeTierRows = '';
    for (var si = 0; si < storeTiers.length; si++) {
      var t = storeTiers[si];
      storeTierRows += row(t.range, '<span style="color:' + t.color + '">×' + t.mult.toFixed(1) + '</span>', '');
    }
    // Contoh harga wool (baseW 0.55) dengan basis aktual
    var wBasis = cb;
    var woolBase = Math.max(1, Math.round(0.55 * wBasis));
    var woolRows =
      row('Wool 1-5 stack',   fmtN(woolBase) + '/stack',             '~' + (woolBase / Math.max(1,wBasis)).toFixed(1) + 'j') +
      row('Wool 6-20 stack',  fmtN(Math.ceil(woolBase * 1.6)) + '/stack', 'tier ×1.6') +
      row('Wool 21-50 stack', fmtN(Math.ceil(woolBase * 2.8)) + '/stack', 'tier ×2.8') +
      row('Wool 51+ stack',   fmtN(Math.ceil(woolBase * 4.5)) + '/stack', 'tier ×4.5');
    cards.push(buildCard('Store (Bahan Build)', '#10b981',
      section('Kategori & Limit') +
      row('Total Kategori', '6 kategori', 'Basic, Wool, Decor, Glass, Light, Utility') +
      row('Limit Harian', '200 unit/kategori', 'reset 20:00 WIB') +
      row('Max per Klik', '16 unit', 'anti accidental') +
      section('Tier Progresif (per kategori/hari)') +
      storeTierRows +
      section('Contoh Harga Wool (basis ' + fmtN(wBasis) + '/jam)') +
      woolRows +
      note('Beli sedikit → <b style="color:var(--green)">murah</b>. Borong banyak → <b style="color:var(--red)">mahal</b>. Anti-monopoli, ramah pemula, semua koin dibakar sebagai sink. Buka dengan <b style="color:var(--gold)">/store</b>.')
    ));

    el.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' + cards.join('') + '</div>';
  }

  function renderGacha(s) {
    var g = s.gacha; if (!g) return;
    var grid = $('gacha-grid');
    if (grid) grid.innerHTML = mkStatCard('Total Pulls', '#c084fc', fmtN(g.pulls), 'semua pemain') + mkStatCard('Pemain Gacha', 'var(--cyan)', g.active, 'dari ' + s.n) + mkStatCard('Participation', 'var(--green)', g.rate + '%', 'aktif gacha') + mkStatCard('Avg Pulls', 'var(--gold)', s.n > 0 ? Math.round(g.pulls / s.n) : 0, 'per pemain');
  }

  // ═══════════════════════════════════════════════════════════
  // WEALTH TAX MODULE — render from gacha_lb.guide.wealthTax
  // ═══════════════════════════════════════════════════════════
  function renderTax() {
    if (!_data || !_data.lb) return;
    var g = _data.lb.guide;
    if (!g || !g.wealthTax) return;
    var wt = g.wealthTax;
    var lb = _data.lb;
    var s = lb.summary || {};

    // ── KPI cards ──
    setText('tax-treasury', fmtN(wt.treasury || 0));

    // Hitung jumlah player yang masuk tiap tier (dari LB coin)
    var topCoin = (lb.coin || []);
    var tier1Count = 0, tier2Count = 0, tier3Count = 0;
    // Kita tidak punya full list, jadi estimate dari entries jika ada
    var entries = safeParse(lb.entries, []) || [];
    if (entries.length === 0 && topCoin.length > 0) entries = topCoin;
    for (var i = 0; i < entries.length; i++) {
      var bal = entries[i].coin || entries[i].c || 0;
      if (bal >= (wt.tier3 || 50000)) tier3Count++;
      else if (bal >= (wt.tier2 || 20000)) tier2Count++;
      else if (bal >= (wt.tier1 || 5000)) tier1Count++;
    }
    var totalCand = tier1Count + tier2Count + tier3Count;
    setText('tax-candidates', totalCand);

    // Estimasi harian dari entries
    var estDaily = 0;
    for (var j = 0; j < entries.length; j++) {
      var b = entries[j].coin || entries[j].c || 0;
      var rate = 0;
      if (b >= (wt.tier3 || 50000)) rate = (wt.rate3 || 2) / 100;
      else if (b >= (wt.tier2 || 20000)) rate = (wt.rate2 || 1) / 100;
      else if (b >= (wt.tier1 || 5000)) rate = (wt.rate1 || 0.5) / 100;
      estDaily += Math.floor(b * rate);
    }
    setText('tax-estimate', fmtN(estDaily));

    // Subsidy info
    var sub = wt.subsidy || {};
    setText('tax-subsidy', '+' + fmtN(sub.killBonus || 0));

    // ── Tabel tier ──
    var tiersBody = document.querySelector('#tbl-tax-tiers tbody');
    if (tiersBody) {
      tiersBody.innerHTML = ''
        + '<tr>'
        + '<td style="color:var(--green);font-weight:700">1</td>'
        + '<td style="color:var(--gold)">' + fmtN(wt.tier1 || 5000) + '</td>'
        + '<td style="text-align:right;color:var(--green);font-weight:700">' + (wt.rate1 || 0.5) + '%</td>'
        + '<td style="text-align:right;color:var(--dim)">' + tier1Count + '</td>'
        + '</tr>'
        + '<tr>'
        + '<td style="color:var(--gold);font-weight:700">2</td>'
        + '<td style="color:var(--gold)">' + fmtN(wt.tier2 || 20000) + '</td>'
        + '<td style="text-align:right;color:var(--gold);font-weight:700">' + (wt.rate2 || 1) + '%</td>'
        + '<td style="text-align:right;color:var(--dim)">' + tier2Count + '</td>'
        + '</tr>'
        + '<tr>'
        + '<td style="color:var(--red);font-weight:700">3</td>'
        + '<td style="color:var(--gold)">' + fmtN(wt.tier3 || 50000) + '</td>'
        + '<td style="text-align:right;color:var(--red);font-weight:700">' + (wt.rate3 || 2) + '%</td>'
        + '<td style="text-align:right;color:var(--dim)">' + tier3Count + '</td>'
        + '</tr>';
    }

    // ── Simulasi pajak ──
    var simBody = document.querySelector('#tbl-tax-sim tbody');
    if (simBody) {
      var samples = [
        { bal: wt.tier1 || 5000, rate: wt.rate1 || 0.5, color: 'var(--green)' },
        { bal: 10000, rate: wt.rate1 || 0.5, color: 'var(--green)' },
        { bal: wt.tier2 || 20000, rate: wt.rate2 || 1, color: 'var(--gold)' },
        { bal: 35000, rate: wt.rate2 || 1, color: 'var(--gold)' },
        { bal: wt.tier3 || 50000, rate: wt.rate3 || 2, color: 'var(--red)' },
        { bal: 100000, rate: wt.rate3 || 2, color: 'var(--red)' }
      ];
      var simHtml = '';
      for (var k = 0; k < samples.length; k++) {
        var sm = samples[k];
        var daily = Math.floor(sm.bal * sm.rate / 100);
        var weekly = daily * 7;
        simHtml += '<tr>'
          + '<td style="color:var(--text);font-weight:600">' + fmtN(sm.bal) + '</td>'
          + '<td style="color:' + sm.color + ';font-weight:700">' + sm.rate + '%</td>'
          + '<td style="text-align:right;color:var(--red)">−' + fmtN(daily) + '</td>'
          + '<td style="text-align:right;color:var(--red);opacity:.7">−' + fmtN(weekly) + '</td>'
          + '</tr>';
      }
      simBody.innerHTML = simHtml;
    }

    // ── Subsidy detail ──
    var subDet = $('tax-subsidy-detail');
    if (subDet) {
      var cap = sub.balanceCap || 1000;
      var qm = sub.questMult || 2;
      var kb = sub.killBonus || 1;
      subDet.innerHTML = ''
        + '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px">'
        + '<span style="color:var(--green);font-weight:700">◆</span>'
        + '<span><b style="color:var(--text)">Kill Bonus:</b> +' + fmtN(kb) + ' koin/kill untuk player dengan saldo &lt; ' + fmtN(cap) + '.</span>'
        + '</div>'
        + '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px">'
        + '<span style="color:var(--gold);font-weight:700">◆</span>'
        + '<span><b style="color:var(--text)">Quest Bonus:</b> ×' + qm + ' reward quest untuk player saldo rendah.</span>'
        + '</div>'
        + '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px">'
        + '<span style="color:var(--cyan);font-weight:700">◆</span>'
        + '<span><b style="color:var(--text)">Cap Saldo:</b> ' + fmtN(cap) + ' koin. Saldo di atas ini tidak dapat subsidy.</span>'
        + '</div>'
        + '<div style="display:flex;align-items:flex-start;gap:8px">'
        + '<span style="color:#f472b6;font-weight:700">◆</span>'
        + '<span><b style="color:var(--text)">Sumber:</b> treasury pajak kekayaan — terdistribusi gradual ke player aktif.</span>'
        + '</div>';
    }

    // ── [PhD-v2] UBI detail ──
    var ubiDet = $('ubi-detail');
    if (ubiDet) {
      var ubi = (g.welfare && g.welfare.ubi) || { amount: 100, days: 7 };
      ubiDet.innerHTML = ''
        + '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px">'
        + '<span style="color:var(--green);font-weight:700">◆</span>'
        + '<span><b style="color:var(--text)">Bonus:</b> +' + fmtN(ubi.amount) + ' koin/login untuk pemain baru.</span>'
        + '</div>'
        + '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px">'
        + '<span style="color:var(--gold);font-weight:700">◆</span>'
        + '<span><b style="color:var(--text)">Durasi:</b> ' + ubi.days + ' hari pertama sejak register.</span>'
        + '</div>'
        + '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px">'
        + '<span style="color:var(--cyan);font-weight:700">◆</span>'
        + '<span><b style="color:var(--text)">Total max:</b> ' + fmtN(ubi.amount * ubi.days) + ' koin — modal awal agar bisa gacha/land.</span>'
        + '</div>'
        + '<div style="display:flex;align-items:flex-start;gap:8px">'
        + '<span style="color:#86efac;font-weight:700">◆</span>'
        + '<span><b style="color:var(--text)">Rationale:</b> Banerjee–Duflo (Nobel 2019) — angkat lantai dulu, player retention naik.</span>'
        + '</div>';
    }

    // ── [PhD-v2] Demurrage detail ──
    var demDet = $('demurrage-detail');
    if (demDet) {
      var dem = (g.welfare && g.welfare.demurrage) || {
        threshold: 50000, graceDays: 7, rateLow: 1, rateHigh: 2, rateHighDay: 14
      };
      demDet.innerHTML = ''
        + '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px">'
        + '<span style="color:#c084fc;font-weight:700">◆</span>'
        + '<span><b style="color:var(--text)">Target:</b> saldo &gt; ' + fmtN(dem.threshold) + ' yang tidak bertransaksi.</span>'
        + '</div>'
        + '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px">'
        + '<span style="color:var(--gold);font-weight:700">◆</span>'
        + '<span><b style="color:var(--text)">Tarif:</b> hari ' + (dem.graceDays + 1) + '-' + dem.rateHighDay + ' tidak aktif = '
        + dem.rateLow + '%/hari. Hari ' + (dem.rateHighDay + 1) + '+ = ' + dem.rateHigh + '%/hari.</span>'
        + '</div>'
        + '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px">'
        + '<span style="color:var(--green);font-weight:700">◆</span>'
        + '<span><b style="color:var(--text)">Reset:</b> lakukan transfer/gacha/auction/land/store untuk reset activity.</span>'
        + '</div>'
        + '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px">'
        + '<span style="color:var(--cyan);font-weight:700">◆</span>'
        + '<span><b style="color:var(--text)">Grace:</b> ' + dem.graceDays + ' hari pertama bebas. Player aktif tidak pernah kena.</span>'
        + '</div>'
        + '<div style="display:flex;align-items:flex-start;gap:8px">'
        + '<span style="color:#f472b6;font-weight:700">◆</span>'
        + '<span><b style="color:var(--text)">Rationale:</b> Silvio Gesell (1916), Keynes — memaksa velocity, anti-hoarding.</span>'
        + '</div>';
    }
  }

  function mkStatCard(label, color, val, sub) {
    return '<div style="background:linear-gradient(135deg,var(--surface),rgba(255,255,255,0.015));border:1px solid var(--border);border-radius:var(--r-xs);padding:8px 10px;text-align:center;position:relative;overflow:hidden"><div style="position:absolute;top:0;left:20%;right:20%;height:1px;background:linear-gradient(90deg,transparent,' + color + ',transparent);opacity:0.2"></div><div style="font-family:\'JetBrains Mono\',monospace;font-size:.36rem;color:var(--mute);text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px;font-weight:500">' + label + '</div><div style="font-family:\'JetBrains Mono\',monospace;font-size:.78rem;font-weight:700;color:' + color + ';line-height:1">' + val + '</div><div style="font-size:.34rem;color:var(--dim);margin-top:3px">' + sub + '</div></div>';
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
  var _candleW = 14, _candleGap = 4, _zoomLevel = 1;

  function bindTrendTabs() {
    var el = $('trend-tabs'); if (!el) return;
    el.addEventListener('click', function (e) {
      var t = e.target.closest('.tab'); if (!t) return;
      el.querySelectorAll('.tab').forEach(function (b) { b.classList.remove('a') });
      t.classList.add('a'); _trendRange = t.dataset.range; _trendData = []; _stopLiveTick(); try { localStorage.removeItem(_trendCacheKey()) } catch (e) { } fetchTrend();
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

  // ── Outlier filter: remove data rows whose metric is a statistical anomaly ──
  // Uses IQR × fence to catch BDS-duplicate spikes without touching normal variance.
  function _filterOutliers(data, metric, fenceFactor) {
    if (data.length < 4) return { clean: data, removed: 0 };
    var fence = fenceFactor || 5;
    var vals = [];
    for (var i = 0; i < data.length; i++) {
      var v = _computeMetric(data[i], metric);
      if (isFinite(v) && v > 0) vals.push(v);
    }
    if (vals.length < 4) return { clean: data, removed: 0 };
    vals.sort(function(a, b) { return a - b; });
    var q1 = vals[Math.floor(vals.length * 0.25)];
    var q3 = vals[Math.floor(vals.length * 0.75)];
    var iqr = q3 - q1;
    var lo = q1 - fence * iqr;
    var hi = q3 + fence * iqr;
    // Never filter if IQR is too small (flat data)
    if (iqr < 1) return { clean: data, removed: 0 };
    var clean = [], removed = 0;
    for (var i = 0; i < data.length; i++) {
      var v2 = _computeMetric(data[i], metric);
      if (v2 >= lo && v2 <= hi) {
        clean.push(data[i]);
      } else {
        removed++;
      }
    }
    return { clean: clean, removed: removed };
  }

  function _agg(data, metric) {
    if (!data.length) return [];
    // Strip outliers caused by duplicate BDS instances before bucketing
    var filtered = _filterOutliers(data, metric, 5);
    var cleanData = filtered.clean;
    if (filtered.removed > 0) {
      _showOutlierWarning(filtered.removed);
    }
    var bms = _bucketMs(), bk = {};
    for (var i = 0; i < cleanData.length; i++) {
      var t = new Date(cleanData[i].ts).getTime(), k = Math.floor(t / bms) * bms;
      if (!bk[k]) bk[k] = { t: k, v: [] }; bk[k].v.push(_computeMetric(cleanData[i], metric));
    }
    var ks = Object.keys(bk).sort(function (a, b) { return a - b }), r = [];
    for (var i = 0; i < ks.length; i++) {
      var b = bk[ks[i]], v = b.v, hi = v[0], lo = v[0];
      for (var j = 1; j < v.length; j++) { if (v[j] > hi) hi = v[j]; if (v[j] < lo) lo = v[j] }
      r.push({ t: b.t, o: v[0], c: v[v.length - 1], h: hi, l: lo, n: v.length });
    }
    // ── Visual amplification ──
    // Exaggerate OHLC spread so candles look more dramatic & volatile
    if (r.length > 1) {
      var allVals = []; for (var i = 0; i < r.length; i++) allVals.push(r[i].o, r[i].c, r[i].h, r[i].l);
      allVals.sort(function(a,b){return a-b});
      var median = allVals[Math.floor(allVals.length/2)] || 1;
      var AMP = 3.5; // amplification factor — makes body/wicks ~3.5x more dramatic
      for (var i = 0; i < r.length; i++) {
        var mid = (r[i].o + r[i].c) / 2;
        r[i].o = mid + (r[i].o - mid) * AMP;
        r[i].c = mid + (r[i].c - mid) * AMP;
        // Ensure h/l always envelop the amplified body
        var bodyHi = Math.max(r[i].o, r[i].c), bodyLo = Math.min(r[i].o, r[i].c);
        var wickSpread = (r[i].h - r[i].l) * AMP;
        r[i].h = Math.max(bodyHi, mid + wickSpread / 2);
        r[i].l = Math.min(bodyLo, mid - wickSpread / 2);
        // Minimum body height: 0.08% of median (prevents flat doji)
        var minBody = median * 0.0008;
        if (Math.abs(r[i].c - r[i].o) < minBody) {
          var dir = (i > 0 && r[i].c >= r[i-1].c) ? 1 : -1;
          r[i].c = r[i].o + dir * minBody;
          r[i].h = Math.max(r[i].h, Math.max(r[i].o, r[i].c) + minBody * 0.5);
          r[i].l = Math.min(r[i].l, Math.min(r[i].o, r[i].c) - minBody * 0.5);
        }
      }
    }
    return r;
  }

  var _outlierWarnShown = false;
  function _showOutlierWarning(count) {
    if (_outlierWarnShown) return;
    _outlierWarnShown = true;
    var existing = document.getElementById('outlier-warn');
    if (existing) existing.remove();
    var warn = document.createElement('div');
    warn.id = 'outlier-warn';
    warn.style.cssText = 'font-family:\'JetBrains Mono\',monospace;font-size:.42rem;background:rgba(239,83,80,0.12);border:1px solid rgba(239,83,80,0.35);border-radius:6px;padding:8px 12px;margin-bottom:8px;color:#fca5a5;display:flex;align-items:center;gap:8px;line-height:1.4';
    warn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;color:#ef5350"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
      '<span><b style="color:#ef5350">PERINGATAN:</b> ' + count + ' snapshot anomali disaring otomatis (kemungkinan disebabkan BDS duplikat yang aktif bersamaan). Grafik ditampilkan tanpa data corrupt. Harap hapus data tersebut dari Supabase tabel <b>economy_history</b> untuk membersihkan permanen.</span>' +
      '<button onclick="this.parentNode.remove()" style="margin-left:auto;background:none;border:none;color:#ef5350;cursor:pointer;font-size:.5rem;padding:2px 6px;border-radius:4px;flex-shrink:0" title="Tutup">✕</button>';
    var trendCard = document.getElementById('trend-card');
    if (trendCard) trendCard.insertBefore(warn, trendCard.firstChild);
  }

  // ═══════════════════════════════════════════════════════════
  // LIVE CANDLE — Deterministic Market Simulator
  // Uses seeded PRNG so reload produces identical state.
  // Fast-forwards elapsed ticks silently on page load.
  // ═══════════════════════════════════════════════════════════
  var _liveCandle = null, _liveTimer = null;
  var _mktState = null;
  var _TICK_MS = 2800; // base ms between ticks (visible)

  // Seeded PRNG (Mulberry32) — deterministic from seed
  function _mkRng(seed) {
    var s = seed | 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var _rng = Math.random; // replaced per-session with seeded version

  function _boxMuller() {
    var u1 = _rng(), u2 = _rng();
    return Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
  }

  function _initMktState(candles) {
    var n = candles.length;
    var last = candles[n - 1];
    var basePrice = last.c;

    var lookback = Math.min(10, n);
    var bodySum = 0, trendDir = 0;
    for (var i = n - lookback; i < n; i++) {
      bodySum += Math.abs(candles[i].c - candles[i].o);
      trendDir += candles[i].c > candles[i].o ? 1 : -1;
    }
    var avgBody = bodySum / lookback || 1;
    var wickSum = 0;
    for (var i = n - lookback; i < n; i++) wickSum += (candles[i].h - candles[i].l);
    var avgWick = wickSum / lookback || avgBody * 1.5;

    var tickStep = avgBody / 50;

    var regime = trendDir > 2 ? 'trending_up' : trendDir < -2 ? 'trending_down' : 'ranging';

    return {
      price: basePrice,
      anchor: basePrice,
      tickStep: tickStep,
      avgBody: avgBody,
      regime: regime,
      regimeAge: 0,
      regimeLen: 20 + Math.floor(_rng() * 30),
      momentum: 0,
      bidAskFlip: 1,
      tickCount: 0,
      lastDelta: 0,
      consecutiveSameDir: 0,
      volMultiplier: 1,
    };
  }

  function _tickPrice(st) {
    var p = st.price;
    var step = st.tickStep;

    st.regimeAge++;
    if (st.regimeAge >= st.regimeLen) {
      var roll = _rng(), prev = st.regime;
      if (prev === 'trending_up') {
        st.regime = roll < 0.25 ? 'trending_down' : roll < 0.6 ? 'ranging' : 'trending_up';
      } else if (prev === 'trending_down') {
        st.regime = roll < 0.25 ? 'trending_up' : roll < 0.6 ? 'ranging' : 'trending_down';
      } else {
        st.regime = roll < 0.3 ? 'trending_up' : roll < 0.6 ? 'trending_down' : 'ranging';
      }
      st.regimeAge = 0;
      st.regimeLen = 15 + Math.floor(_rng() * 35);
      st.anchor = p;
      if (prev !== st.regime) st.momentum *= 0.2;
    }

    st.volMultiplier += (_boxMuller() * 0.04);
    st.volMultiplier = Math.max(0.5, Math.min(1.6, st.volMultiplier));
    st.volMultiplier = st.volMultiplier * 0.96 + 1.0 * 0.04;
    var effStep = step * st.volMultiplier;

    var drift = 0;
    if (st.regime === 'trending_up') {
      drift = effStep * (0.1 + _rng() * 0.12);
    } else if (st.regime === 'trending_down') {
      drift = -effStep * (0.1 + _rng() * 0.12);
    } else {
      drift = effStep * (_rng() - 0.5) * 0.05;
    }

    var reversion = (st.anchor - p) * 0.006;
    st.momentum = st.momentum * 0.6 + drift * 0.25;

    if (st.consecutiveSameDir > 4 + Math.floor(_rng() * 3)) {
      st.momentum *= -(0.2 + _rng() * 0.3);
      st.consecutiveSameDir = 0;
    }

    var noise = _boxMuller() * effStep * 0.6;
    st.bidAskFlip = _rng() < 0.6 ? -st.bidAskFlip : st.bidAskFlip;
    var bidAsk = st.bidAskFlip * effStep * 0.04;

    var delta = st.momentum + noise + reversion + bidAsk;
    var maxMove = effStep * 2.5;
    if (delta > maxMove) delta = maxMove;
    if (delta < -maxMove) delta = -maxMove;

    if ((delta > 0 && st.lastDelta > 0) || (delta < 0 && st.lastDelta < 0)) {
      st.consecutiveSameDir++;
    } else {
      st.consecutiveSameDir = 0;
    }
    st.lastDelta = delta;
    st.price = p + delta;
    st.tickCount++;
    return st.price;
  }

  function _startLiveTick() {
    _stopLiveTick();
    if (!_candles.length) return;
    var last = _candles[_candles.length - 1];
    var bms = _bucketMs();
    var nextT = last.t + bms;

    // Deterministic seed from last candle timestamp
    // Same seed = same sequence, even after reload
    var seed = Math.floor(last.t / 1000) ^ 0xDEAD;
    _rng = _mkRng(seed);

    _mktState = _initMktState(_candles);

    // Fast-forward: calculate how many ticks elapsed since candle start
    var elapsed = Date.now() - nextT;
    var ticksToSkip = Math.max(0, Math.floor(elapsed / _TICK_MS));
    // Cap fast-forward to prevent lag on very old data
    ticksToSkip = Math.min(ticksToSkip, 200);

    // Build live candle
    _liveCandle = { t: nextT, o: last.c, h: last.c, l: last.c, c: last.c, n: 0, _live: true };

    // Silently replay skipped ticks (no rendering)
    for (var i = 0; i < ticksToSkip; i++) {
      var p = _tickPrice(_mktState);
      _liveCandle.c = p;
      _liveCandle.h = Math.max(_liveCandle.h, p);
      _liveCandle.l = Math.min(_liveCandle.l, p);
      _liveCandle.n++;
    }

    // Now start visible ticking
    function tick() {
      if (!_liveCandle || !_mktState) return;
      var newPrice = _tickPrice(_mktState);
      _liveCandle.c = newPrice;
      _liveCandle.h = Math.max(_liveCandle.h, newPrice);
      _liveCandle.l = Math.min(_liveCandle.l, newPrice);
      _liveCandle.n++;
      drawTrendChart();
      if (_hoverIdx < 0) _updHdr(_liveCandle);

      // Slower, more natural interval with slight jitter
      var interval = _TICK_MS + Math.round((_rng() - 0.5) * 800);
      _liveTimer = setTimeout(tick, interval);
    }
    // Initial render with fast-forwarded state
    drawTrendChart();
    if (_hoverIdx < 0 && _liveCandle) _updHdr(_liveCandle);
    // First visible tick after a pause
    _liveTimer = setTimeout(tick, _TICK_MS);
  }

  function _stopLiveTick() {
    if (_liveTimer) { clearTimeout(_liveTimer); _liveTimer = null; }
    _liveCandle = null;
    _mktState = null;
  }

  async function fetchTrend() {
    // Skip network if cache is fresh
    if (_trendData.length > 0 && _cFresh(_trendCacheKey())) {
      _candles = _agg(_trendData, _trendMetric); _hoverIdx = -1;
      drawTrendChart(); renderTrendVitals(); renderHealthAdvisor();
      _startLiveTick(); return;
    }
    var hrs = { day: '24', week: '168', month: '720' }[_trendRange] || '168';
    var since = new Date(Date.now() - hrs * 3600000).toISOString();
    try {
      var r = await fetch(SB_URL + '/rest/v1/economy_history?ts=gte.' + since + '&order=ts.asc&limit=2000', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
      var d = await r.json();
      _trendData = (Array.isArray(d) && d.length > 0) ? d : _fbTrend();
    } catch (e) { _trendData = _fbTrend() }
    _cSet(_trendCacheKey(), _trendData);
    _candles = _agg(_trendData, _trendMetric); _hoverIdx = -1;
    var info = $('trend-info');
    if (info) {
      if (_candles.length > 1) info.textContent = _candles.length + ' candles (' + _trendData.length + ' snapshots, ~1 setiap 5 menit)';
      else if (_candles.length === 1) info.textContent = '1 candle (' + _trendData.length + ' snapshots) — candle baru setiap 15 menit';
      else info.textContent = 'Menunggu data dari BDS sync...';
    }
    drawTrendChart(); setTimeout(_scrollToEnd, 50); renderTrendVitals();
    if (_data && _data.lb && _data.lb.summary) renderPricing(_data.lb.summary);
    renderHealthAdvisor();
    _startLiveTick();
  }

  function _fbTrend() {
    if (!_data || !_data.lb || !_data.lb.summary) return [];
    var s = _data.lb.summary;
    return [{ ts: _data.synced || new Date().toISOString(), coin_total: s.coin ? s.coin.total : 0, player_count: s.n || 0, coin_median: s.coin ? s.coin.median : 0, coin_avg: s.coin ? s.coin.avg : 0 }];
  }

  function _updHdr(c) {
    var el = $('trend-hdr'); if (!el) return;
    if (!c) { el.innerHTML = '<span style="color:var(--mute);font-style:italic">— Menunggu data —</span>'; return }
    var d = c.c - c.o, pct = c.o > 0 ? ((d / c.o) * 100).toFixed(2) : '0.00', clr = d >= 0 ? CU : CD, sg = d >= 0 ? '+' : '';
    var t = new Date(c.t), ts = t.getDate() + '/' + (t.getMonth() + 1) + ' ' + String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
    var mkLbl = function(k, v, col) { return '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.04)"><span style="color:var(--mute);font-size:.36rem;font-weight:500">' + k + '</span><b style="color:' + col + '">' + v + '</b></span>' };
    el.innerHTML = '<span style="color:var(--mute);padding:2px 6px;border-radius:4px;background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.15);font-size:.38rem">' + ts + '</span> ' + mkLbl('O', fmtN(c.o), 'var(--dim)') + ' ' + mkLbl('H', fmtN(c.h), CU) + ' ' + mkLbl('L', fmtN(c.l), CD) + ' ' + mkLbl('C', fmtN(c.c), 'var(--text)') + ' <span style="color:' + clr + ';padding:2px 8px;border-radius:4px;background:' + (d >= 0 ? 'rgba(38,166,154,0.08)' : 'rgba(239,83,80,0.08)') + ';border:1px solid ' + (d >= 0 ? 'rgba(38,166,154,0.18)' : 'rgba(239,83,80,0.18)') + ';font-weight:700">' + sg + fmtN(Math.abs(d)) + ' <span style="font-size:.36rem;opacity:.7">(' + sg + pct + '%)</span></span>';
  }

  function _roundRect(ctx, x, y, w, h, r) {
    if (r > h / 2) r = h / 2; if (r > w / 2) r = w / 2;
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  function drawTrendChart() {
    var cv = $('trend-chart'); if (!cv) return;
    var scrollEl = $('trend-scroll');
    var viewW = scrollEl ? scrollEl.clientWidth : 600; if (viewW < 100) viewW = 600;
    var dpr = window.devicePixelRatio || 1;
    var H = 260;
    var pad = { t: 16, r: 58, b: 28, l: 8 };
    // Build combined array: historical + live candle
    var _drawCandles = _candles.slice();
    if (_liveCandle) _drawCandles.push(_liveCandle);
    var n = _drawCandles.length;

    var bw = Math.max(4, Math.round(_candleW * _zoomLevel));
    var gap = Math.max(2, Math.round(_candleGap * _zoomLevel));
    if (bw > 48) bw = 48;

    var chartAreaMin = viewW - pad.l - pad.r;
    var neededW = n > 0 ? n * bw + (n - 1) * gap : 0;
    var cw = Math.max(chartAreaMin, neededW);
    var W = cw + pad.l + pad.r;

    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    var ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    var ch = H - pad.t - pad.b;
    if (cw <= 0 || ch <= 0) return;

    // ── Background subtle gradient ──
    var bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, 'rgba(15,15,26,0.6)');
    bgGrad.addColorStop(1, 'rgba(9,9,15,0.8)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    if (!n) {
      cv.width = viewW * dpr; cv.style.width = viewW + 'px';
      ctx.scale(dpr, dpr);
      var ebg = ctx.createLinearGradient(0, 0, 0, H);
      ebg.addColorStop(0, 'rgba(15,15,26,0.6)'); ebg.addColorStop(1, 'rgba(9,9,15,0.8)');
      ctx.fillStyle = ebg; ctx.fillRect(0, 0, viewW, H);
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = 'rgba(255,255,255,0.035)'; ctx.lineWidth = 1;
      for (var g = 0; g <= 5; g++) { var gy = pad.t + ch * (g / 5); ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(viewW - pad.r, gy); ctx.stroke() }
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.font = '500 11px Inter,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Menunggu data dari BDS sync...', viewW / 2, H / 2);
      _updHdr(null); _updMinimap(); return;
    }

    var mn = Infinity, mx = -Infinity;
    for (var i = 0; i < n; i++) { if (_drawCandles[i].l < mn) mn = _drawCandles[i].l; if (_drawCandles[i].h > mx) mx = _drawCandles[i].h }
    if (mx <= mn) mx = mn + 1;
    var rng = mx - mn, pv = rng * 0.1; mn = Math.max(0, mn - pv); mx = mx + pv;
    function yOf(v) { return pad.t + ch * (1 - (v - mn) / (mx - mn)) }

    // ── Grid lines — dotted, refined ──
    var scrollLeft = scrollEl ? scrollEl.scrollLeft : 0;
    ctx.setLineDash([1, 4]);
    for (var g = 0; g <= 6; g++) {
      var gy = pad.t + ch * (g / 6);
      ctx.strokeStyle = g === 3 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.025)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, Math.round(gy) + .5); ctx.lineTo(W, Math.round(gy) + .5); ctx.stroke();
      var val = mx - (mx - mn) * (g / 6);
      var labelX = scrollLeft + viewW - pad.r + 5;
      if (labelX > W - pad.r + 5) labelX = W - pad.r + 5;
      // Y-axis label pill
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      _roundRect(ctx, labelX - 2, gy - 6, pad.r - 4, 12, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.font = '500 8px JetBrains Mono,monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(fmtN(val), labelX + 1, gy);
    }
    ctx.setLineDash([]);

    // ── Last close price reference line ──
    var lastC = _drawCandles[n - 1];
    var lastY = yOf(lastC.c);
    var lastUp = lastC.c >= lastC.o;
    var isLiveLast = lastC._live;
    ctx.setLineDash(isLiveLast ? [2, 4] : [4, 3]);
    var refAlpha = isLiveLast ? (0.15 + Math.sin(Date.now() / 400) * 0.1) : 0.25;
    ctx.strokeStyle = lastUp ? 'rgba(38,166,154,' + refAlpha + ')' : 'rgba(239,83,80,' + refAlpha + ')';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, Math.round(lastY) + .5); ctx.lineTo(W, Math.round(lastY) + .5); ctx.stroke();
    ctx.setLineDash([]);

    // ── Place candles ──
    var tw = n * bw + (n - 1) * gap;
    var ox = pad.l + (cw > tw ? Math.floor((cw - tw) / 2) : 0);
    if (neededW > chartAreaMin) ox = pad.l;

    for (var i = 0; i < n; i++) {
      var c = _drawCandles[i], x = ox + i * (bw + gap), cx = x + bw / 2, up = c.c >= c.o;
      var bt = yOf(up ? c.c : c.o), bb = yOf(up ? c.o : c.c), bh = Math.max(1, bb - bt);
      var isLive = c._live;

      // Wick (shadow)
      var wickGrad = ctx.createLinearGradient(0, yOf(c.h), 0, yOf(c.l));
      if (up) { wickGrad.addColorStop(0, 'rgba(38,166,154,0.3)'); wickGrad.addColorStop(0.5, 'rgba(38,166,154,0.6)'); wickGrad.addColorStop(1, 'rgba(38,166,154,0.3)'); }
      else { wickGrad.addColorStop(0, 'rgba(239,83,80,0.3)'); wickGrad.addColorStop(0.5, 'rgba(239,83,80,0.6)'); wickGrad.addColorStop(1, 'rgba(239,83,80,0.3)'); }
      ctx.strokeStyle = wickGrad; ctx.lineWidth = bw > 8 ? 1.5 : 1;
      ctx.beginPath(); ctx.moveTo(Math.round(cx) + .5, yOf(c.h)); ctx.lineTo(Math.round(cx) + .5, yOf(c.l)); ctx.stroke();

      // Body — gradient fill
      var bodyGrad = ctx.createLinearGradient(0, bt, 0, bt + bh);
      if (up) { bodyGrad.addColorStop(0, 'rgba(38,166,154,0.95)'); bodyGrad.addColorStop(1, 'rgba(22,130,120,0.80)'); }
      else { bodyGrad.addColorStop(0, 'rgba(239,83,80,0.95)'); bodyGrad.addColorStop(1, 'rgba(190,50,50,0.80)'); }
      ctx.fillStyle = bodyGrad;
      if (bw >= 6) { _roundRect(ctx, x, bt, bw, bh, Math.min(2, bh / 3)); ctx.fill(); }
      else { ctx.fillRect(x, bt, bw, bh); }

      // Subtle border on body
      ctx.strokeStyle = up ? 'rgba(38,166,154,0.5)' : 'rgba(239,83,80,0.5)'; ctx.lineWidth = 0.5;
      if (bw >= 6) { _roundRect(ctx, x + .25, bt + .25, bw - .5, Math.max(0, bh - .5), Math.min(2, bh / 3)); ctx.stroke(); }

      // Glow effect — enhanced for live candle with pulsing animation
      if (bw >= 10 && bh > 3) {
        ctx.save();
        var glowAlpha = isLive ? (0.3 + Math.sin(Date.now() / 300) * 0.2) : 0.25;
        ctx.shadowColor = up ? 'rgba(38,166,154,' + glowAlpha + ')' : 'rgba(239,83,80,' + glowAlpha + ')';
        ctx.shadowBlur = isLive ? 12 : 6;
        ctx.fillStyle = 'rgba(0,0,0,0)';
        _roundRect(ctx, x, bt, bw, bh, 2); ctx.fill();
        ctx.restore();
      }

      // Live candle: pulsing border + LIVE label
      if (isLive && bw >= 8) {
        var pulseAlpha = 0.4 + Math.sin(Date.now() / 250) * 0.3;
        ctx.strokeStyle = up ? 'rgba(38,166,154,' + pulseAlpha + ')' : 'rgba(239,83,80,' + pulseAlpha + ')';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        _roundRect(ctx, x - 1, bt - 1, bw + 2, bh + 2, 3); ctx.stroke();
        ctx.setLineDash([]);
      }

      // Hover highlight column
      if (i === _hoverIdx) {
        var hGrad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
        hGrad.addColorStop(0, 'rgba(168,85,247,0.04)');
        hGrad.addColorStop(0.5, 'rgba(168,85,247,0.07)');
        hGrad.addColorStop(1, 'rgba(168,85,247,0.02)');
        ctx.fillStyle = hGrad;
        ctx.fillRect(x - gap / 2, pad.t, bw + gap, ch);
      }
    }

    // ── X-axis time labels ──
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.font = '500 7.5px JetBrains Mono,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    var labelEvery = Math.max(1, Math.floor(70 / (bw + gap)));
    for (var i = 0; i < n; i += labelEvery) {
      var t = new Date(_drawCandles[i].t);
      var lb = _trendRange === 'day' ? String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') : _trendRange === 'week' ? (t.getDate() + '/' + (t.getMonth() + 1) + ' ' + t.getHours() + 'h') : t.getDate() + '/' + (t.getMonth() + 1);
      // Tick mark
      var tx = ox + i * (bw + gap) + bw / 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(Math.round(tx) + .5, H - pad.b); ctx.lineTo(Math.round(tx) + .5, H - pad.b + 4); ctx.stroke();
      ctx.fillText(lb, tx, H - pad.b + 6);
    }

    // ── Hover crosshair — premium ──
    if (_hoverIdx >= 0 && _hoverIdx < n) {
      var hc = _drawCandles[_hoverIdx], hx = ox + _hoverIdx * (bw + gap) + bw / 2;
      var hUp = hc.c >= hc.o;
      // Vertical crosshair
      ctx.setLineDash([2, 3]); ctx.strokeStyle = 'rgba(168,85,247,0.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(Math.round(hx) + .5, pad.t); ctx.lineTo(Math.round(hx) + .5, H - pad.b); ctx.stroke();
      // Horizontal crosshair at close
      var hy = yOf(hc.c);
      ctx.strokeStyle = hUp ? 'rgba(38,166,154,0.35)' : 'rgba(239,83,80,0.35)';
      ctx.beginPath(); ctx.moveTo(pad.l, Math.round(hy) + .5); ctx.lineTo(W - pad.r, Math.round(hy) + .5); ctx.stroke();
      ctx.setLineDash([]);

      // Price pill at right edge (sticky)
      var tagX = scrollLeft + viewW - pad.r;
      if (tagX > W - pad.r) tagX = W - pad.r;
      var pillW = pad.r - 2, pillH = 16, pillY = hy - pillH / 2;
      ctx.save();
      ctx.shadowColor = hUp ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = hUp ? 'rgba(38,166,154,0.92)' : 'rgba(239,83,80,0.92)';
      _roundRect(ctx, tagX, pillY, pillW, pillH, 4); ctx.fill();
      ctx.restore();
      // Arrow notch on pill
      ctx.fillStyle = hUp ? 'rgba(38,166,154,0.92)' : 'rgba(239,83,80,0.92)';
      ctx.beginPath(); ctx.moveTo(tagX, hy - 4); ctx.lineTo(tagX - 4, hy); ctx.lineTo(tagX, hy + 4); ctx.fill();
      // Text
      ctx.fillStyle = '#fff'; ctx.font = 'bold 8px JetBrains Mono,monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(fmtN(Math.round(hc.c)), tagX + 4, hy);

      // Time pill at bottom
      var hTime = new Date(hc.t);
      var hTxt = String(hTime.getHours()).padStart(2, '0') + ':' + String(hTime.getMinutes()).padStart(2, '0');
      var tPillW = ctx.measureText(hTxt).width + 12;
      ctx.fillStyle = 'rgba(168,85,247,0.15)';
      _roundRect(ctx, hx - tPillW / 2, H - pad.b + 1, tPillW, 14, 3); ctx.fill();
      ctx.strokeStyle = 'rgba(168,85,247,0.3)'; ctx.lineWidth = 0.5;
      _roundRect(ctx, hx - tPillW / 2, H - pad.b + 1, tPillW, 14, 3); ctx.stroke();
      ctx.fillStyle = 'rgba(168,85,247,0.85)'; ctx.font = '600 7.5px JetBrains Mono,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(hTxt, hx, H - pad.b + 8);
    }

    // ── Last close price pill (always visible) ──
    if (_hoverIdx < 0) {
      var lcTagX = scrollLeft + viewW - pad.r;
      if (lcTagX > W - pad.r) lcTagX = W - pad.r;
      var lcPillW = pad.r - 2, lcPillH = 16, lcPillY = lastY - lcPillH / 2;
      ctx.save();
      ctx.shadowColor = lastUp ? 'rgba(38,166,154,0.3)' : 'rgba(239,83,80,0.3)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = lastUp ? 'rgba(38,166,154,0.85)' : 'rgba(239,83,80,0.85)';
      _roundRect(ctx, lcTagX, lcPillY, lcPillW, lcPillH, 4); ctx.fill();
      ctx.restore();
      ctx.fillStyle = lastUp ? 'rgba(38,166,154,0.85)' : 'rgba(239,83,80,0.85)';
      ctx.beginPath(); ctx.moveTo(lcTagX, lastY - 4); ctx.lineTo(lcTagX - 4, lastY); ctx.lineTo(lcTagX, lastY + 4); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 8px JetBrains Mono,monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(fmtN(Math.round(lastC.c)), lcTagX + 4, lastY);
    }

    _updHdr(_hoverIdx >= 0 ? _drawCandles[_hoverIdx] : _drawCandles[n - 1]);
    _updMinimap();
    _updZoomLabel();
  }

  function _updMinimap() {
    var scrollEl = $('trend-scroll'), thumb = $('trend-minimap-thumb'), map = $('trend-minimap');
    if (!scrollEl || !thumb || !map) return;
    var sw = scrollEl.scrollWidth, vw = scrollEl.clientWidth;
    if (sw <= vw) { thumb.style.width = '100%'; thumb.style.left = '0'; return; }
    var ratio = vw / sw, left = scrollEl.scrollLeft / sw;
    thumb.style.width = Math.max(10, ratio * 100) + '%';
    thumb.style.left = (left * 100) + '%';
  }

  function _updZoomLabel() {
    var el = $('trend-zoom-label');
    if (el) el.textContent = Math.round(_zoomLevel * 100) + '%';
  }

  function _scrollToEnd() {
    var scrollEl = $('trend-scroll');
    if (scrollEl) scrollEl.scrollLeft = scrollEl.scrollWidth;
  }

  function renderTrendVitals() {
    var el = $('trend-vitals'); if (!el || !_trendData.length) return;
    if (_trendData.length < 4) { el.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--mute);font-size:.42rem;padding:8px">Minimal 4 data points untuk vitals.</div>'; return }
    var vitals = [
      { k: 'coin_total', label: 'Supply', color: 'var(--gold)', fmt: function(v){return fmtN(Math.round(v))} },
      { k: 'coin_median', label: 'Median', color: 'var(--green)', fmt: function(v){return fmtN(Math.round(v))} },
      { k: 'player_count', label: 'Pemain', color: 'var(--cyan)', fmt: function(v){return Math.round(v)+''} },
      { k: 'income_per_hour', label: 'Income/j', color: 'var(--ac)', fmt: function(v){return fmtN(Math.round(v))} },
      { k: 'velocity', label: 'Velocity', color: '#60a5fa', fmt: function(v){return v.toFixed(4)} },
      { k: 'net_flow', label: 'Net Flow', color: '#f472b6', fmt: function(v){var s=v>=0?'+':'';return s+fmtN(Math.round(v))} },
      { k: 'gini', label: 'Gini', color: '#fb923c', fmt: function(v){return v.toFixed(3)} },
      { k: 'purchasing_power', label: 'Purch.Pwr', color: '#a78bfa', fmt: function(v){return v.toFixed(2)} }
    ];
    var h = '';
    for (var i = 0; i < vitals.length; i++) {
      var vi = vitals[i];
      // Collect all values for this metric
      var vals = [];
      for (var j = 0; j < _trendData.length; j++) vals.push(_computeMetric(_trendData[j], vi.k));
      var last = vals[vals.length - 1];
      var first = vals[0];
      var delta = first !== 0 ? ((last - first) / Math.abs(first) * 100) : 0;
      var deltaStr = (delta >= 0 ? '+' : '') + delta.toFixed(1) + '%';
      var deltaClr = Math.abs(delta) < 1 ? 'var(--mute)' : delta > 0 ? 'var(--green)' : 'var(--red)';
      // Build mini sparkline SVG (sample ~20 points)
      var step = Math.max(1, Math.floor(vals.length / 20));
      var pts = []; for (var j = 0; j < vals.length; j += step) pts.push(vals[j]);
      if (pts[pts.length-1] !== last) pts.push(last);
      var svgW = 56, svgH = 18;
      var pMin = pts[0], pMax = pts[0];
      for (var j = 1; j < pts.length; j++) { if (pts[j] < pMin) pMin = pts[j]; if (pts[j] > pMax) pMax = pts[j]; }
      var pRng = pMax - pMin || 1;
      var pathD = '';
      for (var j = 0; j < pts.length; j++) {
        var sx = (j / (pts.length - 1)) * svgW;
        var sy = svgH - ((pts[j] - pMin) / pRng) * (svgH - 2) - 1;
        pathD += (j === 0 ? 'M' : 'L') + sx.toFixed(1) + ',' + sy.toFixed(1);
      }
      var sparkColor = delta >= 0 ? '#26a69a' : '#ef5350';
      var sparkSvg = '<svg width="' + svgW + '" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '" style="display:block"><defs><linearGradient id="sg' + i + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + sparkColor + '" stop-opacity="0.3"/><stop offset="1" stop-color="' + sparkColor + '" stop-opacity="0"/></linearGradient></defs><path d="' + pathD + 'L' + svgW + ',' + svgH + 'L0,' + svgH + 'Z" fill="url(#sg' + i + ')"/><path d="' + pathD + '" fill="none" stroke="' + sparkColor + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      h += '<div style="background:linear-gradient(135deg,var(--surface),rgba(255,255,255,0.012));border:1px solid var(--border);border-radius:var(--r-xs);padding:6px 8px;position:relative;overflow:hidden">' +
        '<div style="position:absolute;top:0;left:15%;right:15%;height:1px;background:linear-gradient(90deg,transparent,' + vi.color + ',transparent);opacity:0.15"></div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">' +
          '<span style="font-family:\'JetBrains Mono\',monospace;font-size:.32rem;color:var(--mute);text-transform:uppercase;letter-spacing:.5px;font-weight:500">' + vi.label + '</span>' +
          '<span style="font-family:\'JetBrains Mono\',monospace;font-size:.32rem;color:' + deltaClr + ';font-weight:600">' + deltaStr + '</span>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:end;gap:6px">' +
          '<span style="font-family:\'JetBrains Mono\',monospace;font-size:.54rem;font-weight:700;color:' + vi.color + ';line-height:1">' + vi.fmt(last) + '</span>' +
          '<div style="flex-shrink:0;opacity:0.85">' + sparkSvg + '</div>' +
        '</div>' +
      '</div>';
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
    var snkKeys = ['gacha_cost', 'bank_tax', 'mob_penalty', 'pvp_penalty', 'auction_fee', 'store_sink'];
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
      var srcLabel = { mob_kill: 'Farming', gacha_refund: 'Refund Gacha', pvp_refund: 'Refund PvP', first_sale: 'First Sale Bonus', topup: 'Admin Topup', weekly_reward: 'Reward Mingguan', ubi_injection: 'UBI Pemain Baru' };
      var snkLabel = { gacha_cost: 'Gacha', bank_tax: 'Pajak Transfer', mob_penalty: 'Anti-Stack', pvp_penalty: 'Penalti PvP', auction_fee: 'Fee Auction', store_sink: 'Store Beli' };
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
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { try { localStorage.removeItem(CACHE_KEY); ['day','week','month'].forEach(function(r){localStorage.removeItem(CACHE_TREND_PFX+r)}); } catch (e) { } _nextFetch = 0; } });

  function _initTrend() {
    bindTrendTabs();
    setTimeout(function() { drawTrendChart(); _scrollToEnd(); }, 100);
    var cv = $('trend-chart');
    var scrollEl = $('trend-scroll');
    if (!cv || !scrollEl) return;

    // ── Mouse hover on canvas ──
    cv.addEventListener('mousemove', function (e) {
      var totalN = _candles.length + (_liveCandle ? 1 : 0);
      if (!totalN) return;
      var rect = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      var sc = cv.width / dpr / rect.width;
      var sx = (e.clientX - rect.left) * sc, n = totalN;
      var pad_l = 8, pad_r = 58;
      var bw = Math.max(4, Math.round(_candleW * _zoomLevel)); if (bw > 48) bw = 48;
      var gap = Math.max(2, Math.round(_candleGap * _zoomLevel));
      var viewW = scrollEl.clientWidth || 600;
      var chartAreaMin = viewW - pad_l - pad_r;
      var neededW = n * bw + (n - 1) * gap;
      var cw = Math.max(chartAreaMin, neededW);
      var tw = n * bw + (n - 1) * gap;
      var ox = pad_l + (cw > tw ? Math.floor((cw - tw) / 2) : 0);
      if (neededW > chartAreaMin) ox = pad_l;
      var idx = Math.round((sx - ox - bw / 2) / (bw + gap));
      if (idx < 0) idx = 0; if (idx >= n) idx = n - 1;
      if (_hoverIdx !== idx) { _hoverIdx = idx; drawTrendChart() }
    });
    cv.addEventListener('mouseleave', function () { if (_hoverIdx !== -1) { _hoverIdx = -1; drawTrendChart() } });

    // ── Drag to scroll (mouse) ──
    var _dragging = false, _dragStartX = 0, _dragScrollLeft = 0;
    scrollEl.addEventListener('mousedown', function (e) {
      // Only drag on empty space / canvas, not on hover
      _dragging = true;
      _dragStartX = e.pageX;
      _dragScrollLeft = scrollEl.scrollLeft;
      scrollEl.classList.add('grabbing');
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!_dragging) return;
      var dx = e.pageX - _dragStartX;
      scrollEl.scrollLeft = _dragScrollLeft - dx;
    });
    document.addEventListener('mouseup', function () {
      if (_dragging) { _dragging = false; scrollEl.classList.remove('grabbing'); }
    });

    // ── Touch drag ──
    var _touchStartX = 0, _touchScrollLeft = 0;
    scrollEl.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) {
        _touchStartX = e.touches[0].pageX;
        _touchScrollLeft = scrollEl.scrollLeft;
      }
    }, { passive: true });
    scrollEl.addEventListener('touchmove', function (e) {
      if (e.touches.length === 1) {
        var dx = e.touches[0].pageX - _touchStartX;
        scrollEl.scrollLeft = _touchScrollLeft - dx;
      }
    }, { passive: true });

    // ── Scroll event → update minimap + redraw for sticky y-axis ──
    var _scrollRAF = 0;
    scrollEl.addEventListener('scroll', function () {
      _updMinimap();
      if (!_scrollRAF) {
        _scrollRAF = requestAnimationFrame(function () { _scrollRAF = 0; drawTrendChart(); });
      }
    });

    // ── Zoom controls ──
    var zIn = $('trend-zoom-in'), zOut = $('trend-zoom-out'), zFit = $('trend-zoom-fit'), zReset = $('trend-zoom-reset');
    function doZoom(newZoom) {
      var oldZoom = _zoomLevel;
      _zoomLevel = Math.max(0.3, Math.min(4, newZoom));
      // Preserve scroll center
      var scrollCenter = scrollEl.scrollLeft + scrollEl.clientWidth / 2;
      var ratio = _zoomLevel / oldZoom;
      drawTrendChart();
      scrollEl.scrollLeft = scrollCenter * ratio - scrollEl.clientWidth / 2;
      _updMinimap();
    }
    if (zIn) zIn.addEventListener('click', function () { doZoom(_zoomLevel + 0.25); });
    if (zOut) zOut.addEventListener('click', function () { doZoom(_zoomLevel - 0.25); });
    if (zReset) zReset.addEventListener('click', function () { doZoom(1); setTimeout(_scrollToEnd, 50); });
    if (zFit) zFit.addEventListener('click', function () {
      var n = _candles.length + (_liveCandle ? 1 : 0); if (!n) return;
      var viewW = scrollEl.clientWidth || 600;
      var chartArea = viewW - 8 - 58;
      var fitZoom = chartArea / (n * (_candleW + _candleGap));
      doZoom(Math.max(0.3, Math.min(4, fitZoom)));
      scrollEl.scrollLeft = 0;
    });

    // ── Mouse wheel zoom ──
    scrollEl.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        var delta = e.deltaY > 0 ? -0.15 : 0.15;
        doZoom(_zoomLevel + delta);
      }
    }, { passive: false });
  }
  window.addEventListener('resize', function () { drawTrendChart(); _updMinimap(); });
})();