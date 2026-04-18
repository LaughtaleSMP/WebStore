/* ═══════════════════════════════════════════════════════════
   admin-finance.js  —  Finance Dashboard V2
   Laughtale SMP Admin Panel
   FIXED: Tertinggi/Peak sekarang menyertakan live value
   FIXED: _loadPlayerData menggunakan Promise.all (concurrent)
   FIXED: Tidak duplikat label "Terakhir dicatat"
   ═══════════════════════════════════════════════════════════ */

(function () {

  /* ── Private Helpers ── */
  function _fmt(n) {
    return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');
  }
  function _fmtShort(n) {
    n = Number(n) || 0;
    if (n >= 1000000) return 'Rp ' + (n / 1000000).toFixed(1).replace('.0', '') + 'jt';
    if (n >= 1000)    return 'Rp ' + (n / 1000).toFixed(1).replace('.0', '') + 'rb';
    return 'Rp ' + n.toLocaleString('id-ID');
  }
  function _esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }
  function _today() {
    return new Date().toISOString().split('T')[0];
  }
  function _nowTs() {
    return new Date().toISOString();
  }

  /* ── Chart instances ── */
  var _lineChart   = null;
  var _pieChart    = null;
  var _barChart    = null;
  var _playerChart = null;

  /* ── Chart colors ── */
  var PIE_COLORS = ['#4a8fff','#34d399','#a78bfa','#fbbf24','#f87171','#60a5fa'];

  /* ── Pagination state ── */
  var _allRows   = [];
  var _pgSize    = 8;
  var _pgCurrent = 1;

  /* ── Private State ── */
  var _finSub            = null;
  var _playerTimer       = null;
  var _countdownTimer    = null;
  var _nextUpdateTime    = null;
  var _lastPlayerData    = [];
  var PLAYER_INTERVAL_MS = 5 * 60 * 1000;

  /* FIX: Simpan live count agar bisa digunakan di _renderPlayerMiniStats */
  var _currentLiveCount  = null;

  /* ── Internal: Toast ── */
  function _finToast(msg, type) {
    if (typeof window.showAdminToast === 'function') {
      window.showAdminToast(msg, type || 'success');
      return;
    }
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast-show' + (type === 'error' ? ' toast-error' : '');
    clearTimeout(t._tt);
    t._tt = setTimeout(function () { t.className = ''; }, 3200);
  }

  function _finShowTableError() {
    ['fv2-sum-in', 'fv2-sum-out', 'fv2-sum-don', 'fv2-sum-bal'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = '—';
    });
  }

  function _setSum(id, val, cls) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = val;
    el.className = 'fv2-sum-val' + (cls ? ' ' + cls : '');
  }

  /* ── Period → date range ── */
  function _periodRange(period) {
    var now = new Date();
    var from = null;
    var prevFrom = null;
    var prevTo = null;

    if (period === 'today') {
      from = _today() + 'T00:00:00';
      var y = new Date(now); y.setDate(y.getDate() - 1);
      prevFrom = y.toISOString().split('T')[0] + 'T00:00:00';
      prevTo   = _today() + 'T00:00:00';
    } else if (period === 'week' || period === '7d') {
      var d = new Date(now); d.setDate(d.getDate() - 6);
      from = d.toISOString().split('T')[0] + 'T00:00:00';
      var pd = new Date(d); pd.setDate(pd.getDate() - 7);
      prevFrom = pd.toISOString().split('T')[0] + 'T00:00:00';
      prevTo   = d.toISOString().split('T')[0] + 'T00:00:00';
    } else if (period === 'month' || period === '30d') {
      from = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01T00:00:00';
      var pm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevFrom = pm.getFullYear() + '-' + String(pm.getMonth() + 1).padStart(2, '0') + '-01T00:00:00';
      prevTo   = from;
    } else if (period === 'year') {
      from = now.getFullYear() + '-01-01T00:00:00';
      prevFrom = (now.getFullYear() - 1) + '-01-01T00:00:00';
      prevTo   = from;
    }
    return { from: from, prevFrom: prevFrom, prevTo: prevTo };
  }

  /* ── Get server IP helper ── */
  function _getServerIp() {
    if (window.configData && window.configData['server_ip'] && window.configData['server_ip'].value) {
      return window.configData['server_ip'].value;
    }
    return 'laughtale.my.id:19214';
  }

  /* ══════════════════════════════════════════════════════════
     1. INIT / DESTROY
     ══════════════════════════════════════════════════════════ */
  window.financeV2Init = async function () {
    var period = (document.getElementById('fv2-period') || {}).value || 'month';
    await Promise.all([
      window.financeV2LoadSummary(period),
      window.financeV2LoadList(),
      _loadCharts(period),
      _loadPlayerData(),
    ]);
    _finSubscribeRealtime();
    _startPlayerAutoUpdate();
  };

  window.financeV2Destroy = function () {
    if (_finSub) {
      try { _finSub.unsubscribe(); } catch (e) { /* noop */ }
      _finSub = null;
    }
    _stopPlayerAutoUpdate();
    [_lineChart, _pieChart, _barChart, _playerChart].forEach(function (c) {
      if (c) { try { c.destroy(); } catch (e) {} }
    });
    _lineChart = _pieChart = _barChart = _playerChart = null;
  };

  /* ══════════════════════════════════════════════════════════
     1B. PLAYER AUTO-UPDATE TIMER
     ══════════════════════════════════════════════════════════ */
  function _startPlayerAutoUpdate() {
    _stopPlayerAutoUpdate();
    _nextUpdateTime = Date.now() + PLAYER_INTERVAL_MS;

    _playerTimer = setInterval(function () {
      console.log('[Finance] Auto-update grafik pemain — ' + new Date().toLocaleTimeString('id-ID'));
      window.financeV2RecordPlayer();
      _nextUpdateTime = Date.now() + PLAYER_INTERVAL_MS;
    }, PLAYER_INTERVAL_MS);

    _countdownTimer = setInterval(function () {
      _updateCountdownLabel();
    }, 1000);

    _updateCountdownLabel();
    console.log('[Finance] Auto-update grafik pemain aktif (setiap 5 menit)');
  }

  function _stopPlayerAutoUpdate() {
    if (_playerTimer) { clearInterval(_playerTimer); _playerTimer = null; }
    if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }
    console.log('[Finance] Auto-update grafik pemain dihentikan');
  }

  /* ── Countdown label MM:SS ── */
  function _updateCountdownLabel() {
    /* FIX: Update elemen #fv2-next-countdown yang diinjeksi admin-finance-v2.js */
    var cdEl = document.getElementById('fv2-next-countdown');
    if (!cdEl || !_nextUpdateTime) return;
    var remaining = Math.max(0, Math.ceil((_nextUpdateTime - Date.now()) / 1000));
    var mins = Math.floor(remaining / 60);
    var secs = remaining % 60;
    cdEl.textContent = mins + ':' + String(secs).padStart(2, '0');
  }

  /* ══════════════════════════════════════════════════════════
     2. SUMMARY CARDS
     ══════════════════════════════════════════════════════════ */
  window.financeV2LoadSummary = async function (period) {
    period = period || (document.getElementById('fv2-period') && document.getElementById('fv2-period').value) || 'month';
    var range = _periodRange(period);

    var q = sb.from('finance_transactions').select('type,amount');
    if (range.from) q = q.gte('created_at', range.from);
    var result = await q;

    var prevResult = { data: [] };
    if (range.prevFrom) {
      var pq = sb.from('finance_transactions').select('type,amount')
        .gte('created_at', range.prevFrom);
      if (range.prevTo) pq = pq.lt('created_at', range.prevTo);
      prevResult = await pq;
    }

    if (result.error) {
      console.warn('[Finance] summary error:', result.error.message);
      _finShowTableError();
      return;
    }

    function _agg(rows) {
      var totalIn = 0, totalOut = 0, totalDon = 0;
      (rows || []).forEach(function (r) {
        var a = Number(r.amount) || 0;
        if (r.type === 'income')                              totalIn  += a;
        if (r.type === 'expense' || r.type === 'transfer')    totalOut += a;
        if (r.type === 'donation') { totalIn += a; totalDon += a; }
      });
      return { in: totalIn, out: totalOut, don: totalDon, bal: totalIn - totalOut };
    }

    var cur  = _agg(result.data);
    var prev = _agg(prevResult.data || []);

    function _delta(cur, prev) {
      if (!prev || prev === 0) return null;
      return Math.round(((cur - prev) / prev) * 100);
    }

    function _renderDelta(id, cur, prev) {
      var el = document.getElementById(id);
      if (!el) return;
      var pct = _delta(cur, prev);
      if (pct === null) { el.innerHTML = '<span style="color:var(--text-faint)">—</span>'; return; }
      if (pct > 0) {
        el.innerHTML = '<span class="up">▲ ' + pct + '%</span> vs periode lalu';
      } else if (pct < 0) {
        el.innerHTML = '<span class="dn">▼ ' + Math.abs(pct) + '%</span> vs periode lalu';
      } else {
        el.innerHTML = '<span style="color:var(--text-faint)">± 0%</span> vs periode lalu';
      }
    }

    _setSum('fv2-sum-in',  _fmt(cur.in));
    _setSum('fv2-sum-out', _fmt(cur.out));
    _setSum('fv2-sum-don', _fmt(cur.don));
    _setSum('fv2-sum-bal', _fmt(cur.bal), cur.bal >= 0 ? 'pos' : 'neg');

    _renderDelta('fv2-delta-in',  cur.in,  prev.in);
    _renderDelta('fv2-delta-out', cur.out, prev.out);
    _renderDelta('fv2-delta-don', cur.don, prev.don);

    var totalTx = (result.data || []).length;
    var balEl = document.getElementById('fv2-delta-bal');
    if (balEl) balEl.innerHTML = 'Total transaksi: <strong>' + totalTx + '</strong>';
  };

  /* ══════════════════════════════════════════════════════════
     3. CHARTS
     ══════════════════════════════════════════════════════════ */
  async function _loadCharts(period) {
    if (typeof Chart === 'undefined') return;

    var range = _periodRange(period);
    var q = sb.from('finance_transactions').select('type,amount,category,created_at');
    if (range.from) q = q.gte('created_at', range.from);
    q = q.order('created_at', { ascending: true });
    var result = await q;
    if (result.error) return;

    var rows = result.data || [];
    _buildLineChart(rows, period);
    _buildPieChart(rows);
    _buildBarChart(rows);
  }

  function _buildLineChart(rows, period) {
    var groupFn;
    if (period === 'year') {
      groupFn = function (iso) { return iso.slice(0, 7); };
    } else {
      groupFn = function (iso) { return iso.slice(0, 10); };
    }

    var incMap  = {};
    var expMap  = {};
    rows.forEach(function (r) {
      var key = groupFn(r.created_at);
      if (r.type === 'income' || r.type === 'donation') {
        incMap[key] = (incMap[key] || 0) + (Number(r.amount) || 0);
      } else if (r.type === 'expense' || r.type === 'transfer') {
        expMap[key] = (expMap[key] || 0) + (Number(r.amount) || 0);
      }
    });

    var labels = Array.from(new Set(Object.keys(incMap).concat(Object.keys(expMap)))).sort();
    if (!labels.length) {
      var now = new Date();
      for (var i = 6; i >= 0; i--) {
        var d = new Date(now); d.setDate(d.getDate() - i);
        labels.push(d.toISOString().slice(0, 10));
      }
    }

    var incData = labels.map(function (l) { return incMap[l] || 0; });
    var expData = labels.map(function (l) { return expMap[l] || 0; });

    var dispLabels = labels.map(function (l) {
      if (l.length === 7) {
        var parts = l.split('-');
        var months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
        return months[parseInt(parts[1]) - 1] + ' ' + parts[0];
      }
      var parts = l.split('-');
      return parts[2] + '/' + parts[1];
    });

    var canvas = document.getElementById('fv2-line-chart');
    if (!canvas) return;
    if (_lineChart) { try { _lineChart.destroy(); } catch(e){} _lineChart = null; }
    try { var ex = Chart.getChart(canvas); if (ex) ex.destroy(); } catch(e) {}

    _lineChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: dispLabels,
        datasets: [
          {
            label: 'Pemasukan',
            data: incData,
            borderColor: '#34d399',
            backgroundColor: 'rgba(52,211,153,0.1)',
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#34d399',
            tension: 0.4,
            fill: true,
          },
          {
            label: 'Pengeluaran',
            data: expData,
            borderColor: '#f87171',
            backgroundColor: 'rgba(248,113,113,0.06)',
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#f87171',
            tension: 0.4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ' ' + ctx.dataset.label + ': ' + _fmt(ctx.parsed.y);
              },
            },
          },
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4a5568', font: { size: 10 } }, border: { color: 'rgba(255,255,255,0.06)' } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4a5568', font: { size: 10 }, callback: function (v) { return _fmt(v); } }, border: { color: 'rgba(255,255,255,0.06)' }, beginAtZero: true },
        },
      },
    });
  }

  function _buildPieChart(rows) {
    var catMap = {};
    rows.forEach(function (r) {
      if (r.type !== 'income' && r.type !== 'donation') return;
      var cat = r.category || 'misc';
      catMap[cat] = (catMap[cat] || 0) + (Number(r.amount) || 0);
    });

    var entries = Object.entries(catMap).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
    if (!entries.length) entries = [['(belum ada)', 1]];

    var total = entries.reduce(function (s, e) { return s + e[1]; }, 0);
    var labels = entries.map(function (e) { return e[0]; });
    var vals   = entries.map(function (e) { return e[1]; });
    var colors = entries.map(function (_, i) { return PIE_COLORS[i % PIE_COLORS.length]; });

    var canvas = document.getElementById('fv2-pie-chart');
    if (!canvas) return;
    if (_pieChart) { try { _pieChart.destroy(); } catch(e){} _pieChart = null; }
    try { var ex = Chart.getChart(canvas); if (ex) ex.destroy(); } catch(e) {}

    _pieChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{ data: vals, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: { legend: { display: false } },
      },
    });

    var legendEl = document.getElementById('fv2-pie-legend');
    if (legendEl) {
      legendEl.innerHTML = entries.map(function (e, i) {
        var pct = total > 0 ? Math.round((e[1] / total) * 100) : 0;
        return '<div class="fv2-pie-leg-row">' +
          '<span class="fv2-pie-leg-dot" style="background:' + colors[i] + '"></span>' +
          '<span class="fv2-pie-leg-label">' + _esc(e[0]) + '</span>' +
          '<span class="fv2-pie-leg-pct">' + pct + '%</span>' +
          '</div>';
      }).join('');
    }
  }

  function _buildBarChart(rows) {
    var catMap = {};
    rows.forEach(function (r) {
      if (r.type !== 'income' && r.type !== 'donation') return;
      var cat = r.category || 'misc';
      catMap[cat] = (catMap[cat] || 0) + (Number(r.amount) || 0);
    });

    var entries = Object.entries(catMap).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
    if (!entries.length) entries = [['(belum ada)', 0]];

    var max = entries[0][1] || 1;
    var barColors = entries.map(function (_, i) {
      var palette = ['rgba(74,143,255,0.75)','rgba(52,211,153,0.75)','rgba(167,139,250,0.75)','rgba(251,191,36,0.75)','rgba(248,113,113,0.75)','rgba(96,165,250,0.75)'];
      return palette[i % palette.length];
    });

    var canvas = document.getElementById('fv2-bar-chart');
    if (!canvas) return;
    if (_barChart) { try { _barChart.destroy(); } catch(e){} _barChart = null; }
    try { var ex = Chart.getChart(canvas); if (ex) ex.destroy(); } catch(e) {}

    _barChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: entries.map(function (e) { return e[0]; }),
        datasets: [{
          label: 'Pemasukan',
          data: entries.map(function (e) { return e[1]; }),
          backgroundColor: barColors,
          borderRadius: 5,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) { return ' ' + _fmt(ctx.parsed.y); } } },
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4a5568', font: { size: 10 } }, border: { color: 'rgba(255,255,255,0.06)' } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4a5568', font: { size: 10 }, callback: function (v) { return _fmt(v); } }, border: { color: 'rgba(255,255,255,0.06)' }, beginAtZero: true },
        },
      },
    });

    var barsEl = document.getElementById('fv2-mini-bars');
    if (barsEl) {
      barsEl.innerHTML = entries.slice(0, 5).map(function (e, i) {
        var w = max > 0 ? Math.round((e[1] / max) * 100) : 0;
        return '<div class="fv2-mbar-wrap">' +
          '<span class="fv2-mbar-label">' + _esc(e[0]) + '</span>' +
          '<div class="fv2-mbar-bg"><div class="fv2-mbar-fill" style="width:' + w + '%;background:' + barColors[i] + '"></div></div>' +
          '<span class="fv2-mbar-val" style="color:' + barColors[i].replace('0.75','1') + '">' + _fmt(e[1]) + '</span>' +
          '</div>';
      }).join('');
    }
  }

  /* ══════════════════════════════════════════════════════════
     3B. PLAYER ONLINE CHART — FIXED
     FIX: Concurrent fetch live+snapshots, peak menyertakan live
     ══════════════════════════════════════════════════════════ */

  /* ── FIX: _renderPlayerMiniStats sekarang menerima liveCount ── */
  function _renderPlayerMiniStats(rows, liveCount) {
    var liveNum = (liveCount !== null && liveCount !== undefined) ? Number(liveCount) : null;

    /* Update "Sekarang" */
    var curEl = document.getElementById('fv2-pmini-current');
    if (curEl && liveNum !== null) curEl.textContent = String(liveNum);

    if (!rows || !rows.length) {
      var peakEl0  = document.getElementById('fv2-pmini-peak');
      var avgEl0   = document.getElementById('fv2-pmini-avg');
      var countEl0 = document.getElementById('fv2-pmini-count');
      if (peakEl0)  peakEl0.textContent  = liveNum !== null ? String(liveNum) : '0';
      if (avgEl0)   avgEl0.textContent   = liveNum !== null ? String(liveNum) : '0';
      if (countEl0) countEl0.textContent = '0';
      return;
    }

    var counts = rows.map(function(r) { return Number(r.player_count) || 0; });

    /* FIX: Sertakan live value dalam kalkulasi peak */
    var allForPeak = liveNum !== null ? counts.concat([liveNum]) : counts;
    var peak  = Math.max.apply(null, allForPeak);
    var avg   = Math.round(counts.reduce(function (a, b) { return a + b; }, 0) / counts.length);
    var total = rows.length;

    var peakEl  = document.getElementById('fv2-pmini-peak');
    var avgEl   = document.getElementById('fv2-pmini-avg');
    var countEl = document.getElementById('fv2-pmini-count');

    if (peakEl)  peakEl.textContent  = peak;
    if (avgEl)   avgEl.textContent   = avg;
    if (countEl) countEl.textContent = total;
  }

  /* ── FIX: _loadPlayerData sekarang concurrent fetch live+snapshots ── */
  async function _loadPlayerData() {
    var ip    = _getServerIp();
    var parts = ip.split(':');
    var host  = parts[0];
    var port  = parts[1] || '19214';

    /* Fetch live + snapshots secara concurrent */
    var livePromise = fetch(
      'https://api.mcsrvstat.us/bedrock/3/' + host + ':' + port,
      { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined }
    )
    .then(function(r) { return r.json(); })
    .catch(function() { return null; });

    var snapshotPromise = sb
      .from('player_snapshots')
      .select('player_count, max_players, recorded_at')
      .order('recorded_at', { ascending: true })
      .limit(60);

    /* Tunggu keduanya selesai */
    var results = await Promise.all([livePromise, snapshotPromise]);
    var liveData     = results[0];
    var snapshotResult = results[1];

    /* Proses live data */
    var dotEl  = document.getElementById('fv2-player-dot');
    var numEl  = document.getElementById('fv2-player-num');
    var lblEl  = document.getElementById('fv2-player-label');
    var maxEl  = document.getElementById('fv2-player-max-info');
    var curEl  = document.getElementById('fv2-pmini-current');

    var liveCount = null;

    if (liveData) {
      var onl = liveData.online ? (liveData.players ? (liveData.players.online || 0) : 0) : 0;
      var max = liveData.online ? (liveData.players ? (liveData.players.max   || 0) : 0) : 0;
      liveCount = onl;
      _currentLiveCount = onl;

      if (liveData.online) {
        if (dotEl) { dotEl.className = 'fv2-player-dot online'; }
        if (numEl) { numEl.textContent = onl; numEl.className = 'fv2-player-big-num online-color'; }
        if (lblEl) { lblEl.textContent = 'pemain online sekarang'; }
        if (maxEl) { maxEl.textContent = max ? '/ ' + max + ' maks' : ''; }
        if (curEl) { curEl.textContent = onl; }
      } else {
        if (dotEl) { dotEl.className = 'fv2-player-dot offline'; }
        if (numEl) { numEl.textContent = '0'; numEl.className = 'fv2-player-big-num offline-color'; }
        if (lblEl) { lblEl.textContent = 'Server offline'; }
        if (maxEl) { maxEl.textContent = ''; }
        if (curEl) { curEl.textContent = '0'; }
      }
    } else {
      _currentLiveCount = null;
      if (dotEl) { dotEl.className = 'fv2-player-dot offline'; }
      if (numEl) { numEl.textContent = '—'; numEl.className = 'fv2-player-big-num offline-color'; }
      if (lblEl) { lblEl.textContent = 'Gagal memuat status'; }
    }

    /* Proses snapshot */
    if (snapshotResult.error) {
      _buildPlayerChart([], liveCount);
      return;
    }
    _lastPlayerData = snapshotResult.data || [];
    _buildPlayerChart(_lastPlayerData, liveCount);
    _updateCountdownLabel();
  }

  /* ── Inject CSS styles ── */
  function _injectPlayerStyles() {
    if (document.getElementById('fv2-player-enhanced-styles')) return;
    var s = document.createElement('style');
    s.id = 'fv2-player-enhanced-styles';
    s.textContent = [
      '.fv2-player-mini-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;}',
      '@media(max-width:560px){.fv2-player-mini-stats{grid-template-columns:repeat(2,1fr);}}',
      '.fv2-pmini-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:8px 10px;text-align:center;transition:border-color 160ms;}',
      '.fv2-pmini-card:hover{border-color:rgba(74,143,255,0.2);}',
      '.fv2-pmini-val{font-size:1.1rem;font-weight:800;color:var(--text-main);letter-spacing:-0.5px;line-height:1.1;font-variant-numeric:tabular-nums;}',
      '.fv2-pmini-label{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--text-faint);margin-top:3px;}',
      '.fv2-player-stat-row{display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(74,143,255,0.05);border:1px solid rgba(74,143,255,0.12);border-radius:9px;margin-bottom:12px;}',
      '.fv2-player-stat-main{display:flex;align-items:baseline;gap:6px;flex:1;}',
      '.fv2-player-big-num{font-size:1.6rem;font-weight:800;color:var(--text-main);line-height:1;letter-spacing:-1px;font-variant-numeric:tabular-nums;transition:color 300ms;}',
      '.fv2-player-big-num.online-color{color:#4a8fff;}',
      '.fv2-player-big-num.offline-color{color:var(--text-faint);}',
      '.fv2-player-stat-label{font-size:11px;color:var(--text-muted);line-height:1.3;}',
      '.fv2-player-max-info{font-size:10.5px;color:var(--text-faint);font-variant-numeric:tabular-nums;}',
      '.fv2-player-dot{width:10px;height:10px;border-radius:50%;background:var(--text-faint);flex-shrink:0;transition:background 300ms,box-shadow 300ms;position:relative;}',
      '.fv2-player-dot.online{background:#4a8fff;box-shadow:0 0 0 3px rgba(74,143,255,0.2);animation:playerDotPulseBlue 2s ease-in-out infinite;}',
      '.fv2-player-dot.offline{background:#f87171;box-shadow:0 0 0 3px rgba(248,113,113,0.15);}',
      '@keyframes playerDotPulseBlue{0%,100%{box-shadow:0 0 0 3px rgba(74,143,255,0.2);}50%{box-shadow:0 0 0 7px rgba(74,143,255,0.04);}}',
      '.fv2-player-chart-wrap{position:relative;width:100%;height:140px;border-radius:8px;overflow:hidden;}',
      '.fv2-player-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;font-size:12px;color:var(--text-faint);pointer-events:none;text-align:center;padding:8px;background:rgba(11,16,24,0.7);border-radius:8px;}',
      '.fv2-player-empty-icon{font-size:22px;opacity:.35;}',
    ].join('');
    document.head.appendChild(s);
  }

  /* ── Inject improved player card HTML ── */
  function _ensurePlayerCardStructure() {
    _injectPlayerStyles();

    var card = document.querySelector('.fv2-player-card');
    if (!card || card.dataset.enhanced) return;
    card.dataset.enhanced = '1';

    var oldStat   = document.getElementById('fv2-player-stat');
    var oldCanvas = document.getElementById('fv2-player-chart');
    var canvasParent = oldCanvas ? oldCanvas.parentElement : null;

    if (oldStat) {
      oldStat.outerHTML =
        '<div class="fv2-player-stat-row" id="fv2-player-stat">' +
          '<div class="fv2-player-dot" id="fv2-player-dot"></div>' +
          '<div class="fv2-player-stat-main">' +
            '<div class="fv2-player-big-num" id="fv2-player-num">—</div>' +
          '</div>' +
          '<div class="fv2-player-stat-info">' +
            '<div class="fv2-player-stat-label" id="fv2-player-label">Memuat status server…</div>' +
            '<div class="fv2-player-max-info" id="fv2-player-max-info"></div>' +
          '</div>' +
        '</div>';
    }

    if (canvasParent && !document.getElementById('fv2-player-mini-stats-wrap')) {
      var miniWrap = document.createElement('div');
      miniWrap.id = 'fv2-player-mini-stats-wrap';
      miniWrap.className = 'fv2-player-mini-stats';
      miniWrap.innerHTML =
        '<div class="fv2-pmini-card">' +
          '<div class="fv2-pmini-val" id="fv2-pmini-current">—</div>' +
          '<div class="fv2-pmini-label">Sekarang</div>' +
        '</div>' +
        '<div class="fv2-pmini-card">' +
          '<div class="fv2-pmini-val" id="fv2-pmini-peak" style="color:#fbbf24">—</div>' +
          '<div class="fv2-pmini-label">Tertinggi</div>' +
        '</div>' +
        '<div class="fv2-pmini-card">' +
          '<div class="fv2-pmini-val" id="fv2-pmini-avg" style="color:#a78bfa">—</div>' +
          '<div class="fv2-pmini-label">Rata-rata</div>' +
        '</div>' +
        '<div class="fv2-pmini-card">' +
          '<div class="fv2-pmini-val" id="fv2-pmini-count" style="color:#34d399">—</div>' +
          '<div class="fv2-pmini-label">Rekaman</div>' +
        '</div>';
      canvasParent.parentNode.insertBefore(miniWrap, canvasParent);

      var chartWrap = document.createElement('div');
      chartWrap.className = 'fv2-player-chart-wrap';
      canvasParent.parentNode.insertBefore(chartWrap, canvasParent);
      chartWrap.appendChild(canvasParent);

      if (oldCanvas) {
        canvasParent.style.cssText = 'position:relative;width:100%;height:140px';
      }
    }
  }

  /* ── FIX: _buildPlayerChart sekarang menerima liveCount ── */
  function _buildPlayerChart(rows, liveCount) {
    _ensurePlayerCardStructure();

    if (typeof Chart === 'undefined') return;
    var canvasEl = document.getElementById('fv2-player-chart');
    if (!canvasEl) return;

    if (_playerChart) { try { _playerChart.destroy(); } catch (e) {} _playerChart = null; }
    try {
      var orphan = Chart.getChart(canvasEl);
      if (orphan) orphan.destroy();
    } catch (e) {}

    /* FIX: Render mini stats dengan live value */
    _renderPlayerMiniStats(rows, liveCount !== undefined ? liveCount : _currentLiveCount);

    var labels, data, isEmpty;
    if (!rows || !rows.length) {
      isEmpty = true;
      labels  = ['', '', '', '', '', '', ''];
      data    = [0, 0, 0, 0, 0, 0, 0];
    } else {
      isEmpty = false;
      labels  = rows.map(function (r) {
        var d = new Date(r.recorded_at);
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) +
               ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      });
      data = rows.map(function (r) { return Number(r.player_count) || 0; });
    }

    var ctx     = canvasEl.getContext('2d');
    var maxVal  = data.length ? Math.max.apply(null, data) : 10;
    /* FIX: Sertakan live value dalam yMax agar grafik tidak terpotong */
    var liveCnt = (liveCount !== null && liveCount !== undefined) ? Number(liveCount) : (_currentLiveCount || 0);
    var effectiveMax = Math.max(maxVal, liveCnt);
    var yMax    = Math.max(effectiveMax + Math.ceil(effectiveMax * 0.25), 5);

    var gradient = ctx.createLinearGradient(0, 0, 0, 140);
    gradient.addColorStop(0, 'rgba(74,143,255,0.35)');
    gradient.addColorStop(0.6, 'rgba(74,143,255,0.08)');
    gradient.addColorStop(1, 'rgba(74,143,255,0.0)');

    _playerChart = new Chart(canvasEl, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Pemain Online',
            data: data,
            borderColor: '#4a8fff',
            backgroundColor: gradient,
            borderWidth: isEmpty ? 1 : 2,
            pointRadius: isEmpty ? 0 : (rows.length > 30 ? 2 : (rows.length > 15 ? 3 : 4)),
            pointHoverRadius: isEmpty ? 0 : 6,
            pointBackgroundColor: '#4a8fff',
            pointBorderColor: 'rgba(11,16,24,0.8)',
            pointBorderWidth: 2,
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#4a8fff',
            pointHoverBorderWidth: 2,
            tension: 0.45,
            fill: true,
            spanGaps: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        animation: { duration: isEmpty ? 0 : 600, easing: 'easeInOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: !isEmpty,
            backgroundColor: 'rgba(12,16,23,0.95)',
            borderColor: 'rgba(74,143,255,0.3)',
            borderWidth: 1,
            titleColor: '#94adff',
            bodyColor: '#dde3ec',
            padding: 10,
            cornerRadius: 8,
            titleFont: { size: 10, weight: '600' },
            bodyFont: { size: 12, weight: '700' },
            callbacks: {
              title: function (items) { return items[0] ? items[0].label : ''; },
              label: function (ctx) { return '  ' + ctx.parsed.y + ' pemain online'; },
              afterLabel: function (ctx) {
                if (!_lastPlayerData.length) return '';
                var r = _lastPlayerData[ctx.dataIndex];
                if (r && r.max_players) return '  Kapasitas: ' + r.max_players;
                return '';
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.03)', drawBorder: false },
            ticks: { color: '#2e3848', font: { size: 9 }, maxTicksLimit: rows && rows.length > 20 ? 6 : 8, maxRotation: 30, display: !isEmpty },
            border: { color: 'rgba(255,255,255,0.04)' },
          },
          y: {
            grid: {
              color: function(ctx) { return ctx.tick.value === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)'; },
              drawBorder: false,
            },
            ticks: { color: '#2e3848', font: { size: 9 }, stepSize: 1, precision: 0, display: !isEmpty, callback: function(v) { return v % 1 === 0 ? v : ''; } },
            border: { color: 'rgba(255,255,255,0.04)' },
            beginAtZero: true,
            min: 0,
            max: isEmpty ? 10 : yMax,
            suggestedMax: yMax,
          },
        },
      },
    });

    var chartWrap = canvasEl.parentElement;
    var existingEmpty = chartWrap && chartWrap.querySelector('.fv2-player-empty');
    if (isEmpty) {
      if (chartWrap && !existingEmpty) {
        var msg = document.createElement('div');
        msg.className = 'fv2-player-empty';
        msg.innerHTML =
          '<div class="fv2-player-empty-icon">📊</div>' +
          '<div>Belum ada data rekaman</div>' +
          '<div style="font-size:10.5px;opacity:.7">Klik <strong>Catat</strong> untuk merekam snapshot pertama</div>';
        chartWrap.appendChild(msg);
      }
    } else {
      if (existingEmpty) existingEmpty.remove();
    }

    /* FIX: Tidak lagi memanggil _updateLastRecordedLabel karena
       admin-finance-v2.js sudah menangani label "Terakhir dicatat"
       via _updateLastRecordedLabel di dalam _updateNextUpdateLabel */
  }

  /* ── Record player snapshot ── */
  window.financeV2RecordPlayer = async function () {
    var btn = document.querySelector('.fv2-player-record-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML =
        '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="animation:spin .8s linear infinite">' +
          '<path d="M21 12a9 9 0 1 1-2.12-5.86"/>' +
        '</svg> Mencatat…';
      if (!document.getElementById('fv2-spin-kf')) {
        var ks = document.createElement('style');
        ks.id = 'fv2-spin-kf';
        ks.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
        document.head.appendChild(ks);
      }
    }

    var ip    = _getServerIp();
    var parts = ip.split(':');
    var host  = parts[0];
    var port  = parts[1] || '19214';
    var dotEl = document.getElementById('fv2-player-dot');
    var numEl = document.getElementById('fv2-player-num');
    var lblEl = document.getElementById('fv2-player-label');
    var maxEl = document.getElementById('fv2-player-max-info');

    try {
      var r    = await fetch('https://api.mcsrvstat.us/bedrock/3/' + host + ':' + port, { signal: AbortSignal.timeout(8000) });
      var data = await r.json();
      var playerCount = data.online ? (data.players ? (data.players.online || 0) : 0) : 0;
      var maxPlayers  = data.online ? (data.players ? (data.players.max   || 0) : 0) : 0;

      _currentLiveCount = playerCount;

      if (dotEl) { dotEl.className = data.online ? 'fv2-player-dot online' : 'fv2-player-dot offline'; }
      if (numEl) {
        numEl.textContent = playerCount;
        numEl.className = 'fv2-player-big-num ' + (data.online ? 'online-color' : 'offline-color');
      }
      if (lblEl) { lblEl.textContent = data.online ? 'pemain online sekarang' : 'Server offline'; }
      if (maxEl) { maxEl.textContent = data.online && maxPlayers ? '/ ' + maxPlayers + ' maks' : ''; }

      var ins = await sb.from('player_snapshots').insert([{
        player_count: playerCount,
        max_players:  maxPlayers,
        recorded_at:  new Date().toISOString(),
      }]);

      if (ins.error) {
        _finToast('Gagal simpan snapshot — jalankan Setup DB terlebih dahulu.', 'error');
      } else {
        _finToast('✅ Snapshot: ' + playerCount + ' pemain online', 'success');
        var result = await sb
          .from('player_snapshots')
          .select('player_count, max_players, recorded_at')
          .order('recorded_at', { ascending: true })
          .limit(60);
        if (!result.error) {
          _lastPlayerData = result.data || [];
          _buildPlayerChart(_lastPlayerData, playerCount);
          /* Trigger refresh kartu player di admin-finance-v2.js */
          if (typeof window._fv2PlayerRefresh === 'function') {
            window._fv2PlayerRefresh();
          }
        }
      }
    } catch (e) {
      if (dotEl) { dotEl.className = 'fv2-player-dot offline'; }
      if (numEl) { numEl.textContent = '—'; numEl.className = 'fv2-player-big-num offline-color'; }
      if (lblEl) { lblEl.textContent = 'Gagal terhubung ke server'; }
      _finToast('Gagal: ' + (e.message || 'timeout'), 'error');
    }

    if (btn) {
      btn.disabled = false;
      btn.innerHTML =
        '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">' +
          '<polyline points="23 4 23 10 17 10"/>' +
          '<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>' +
        '</svg> Catat';
    }
  };

  /* ══════════════════════════════════════════════════════════
     4. TRANSACTION LIST
     ══════════════════════════════════════════════════════════ */
  window.financeV2LoadList = async function () {
    var container = document.getElementById('fv2-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Memuat...</div>';
    var typeF   = (document.getElementById('fv2-filter-type')  || {}).value || '';
    var catF    = (document.getElementById('fv2-filter-cat')   || {}).value || '';
    var searchF = ((document.getElementById('fv2-search')      || {}).value || '').trim();
    var fromF   = (document.getElementById('fv2-from')         || {}).value || '';
    var toF     = (document.getElementById('fv2-to')           || {}).value || '';
    var q = sb.from('finance_transactions').select('*').order('created_at', { ascending: false }).limit(500);
    if (typeF) q = q.eq('type', typeF);
    if (catF)  q = q.eq('category', catF);
    if (fromF) q = q.gte('created_at', fromF + 'T00:00:00');
    if (toF)   q = q.lte('created_at', toF   + 'T23:59:59');
    var result = await q;
    if (result.error) { container.innerHTML = '<div class="empty-state" style="color:#f87171">' + _esc(result.error.message) + '</div>'; return; }
    var rows = result.data || [];
    if (searchF) {
      var kw = searchF.toLowerCase();
      rows = rows.filter(function (r) {
        return (r.note || '').toLowerCase().includes(kw) || (r.reference || '').toLowerCase().includes(kw) ||
               (r.category || '').toLowerCase().includes(kw) || (r.recorded_by || '').toLowerCase().includes(kw);
      });
    }
    _allRows = rows; _pgCurrent = 1; _renderPage();
  };

  function _renderPage() {
    var container = document.getElementById('fv2-list');
    if (!container) return;
    if (!_allRows.length) {
      container.innerHTML = '<div class="empty-state">Tidak ada transaksi ditemukan.</div>';
      var pgEl = document.getElementById('fv2-pagination');
      if (pgEl) pgEl.style.display = 'none';
      return;
    }
    var totalPages = Math.ceil(_allRows.length / _pgSize);
    var start      = (_pgCurrent - 1) * _pgSize;
    var pageRows   = _allRows.slice(start, start + _pgSize);

    var typeIcon = { income:'▲', expense:'▼', donation:'♦', transfer:'⇄', adjustment:'⚙' };
    var typeLbl  = { income:'Masuk', expense:'Keluar', donation:'Donasi', transfer:'Transfer', adjustment:'Penyesuaian' };
    var typeCls  = { income:'tb-in', expense:'tb-out', donation:'tb-don', transfer:'tb-tr', adjustment:'tb-adj' };

    var rowsHtml = pageRows.map(function (r, idx) {
      var isOut = r.type === 'expense' || r.type === 'transfer';
      var dt    = new Date(r.created_at);
      var dtStr = dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
      var icon  = typeIcon[r.type] || '•';
      var lbl   = typeLbl[r.type] || r.type;
      var cls   = typeCls[r.type] || '';
      var refHtml  = r.reference ? '<div class="fv2-tx-item-sub">ref: ' + _esc(r.reference) + '</div>' : '';
      return '<tr>' +
        '<td>' + (start + idx + 1) + '</td>' +
        '<td>' + dtStr + '</td>' +
        '<td><div class="fv2-tx-item-name">' + _esc(r.note || r.category || '—') + '</div>' + refHtml + '</td>' +
        '<td><span class="fv2-type-badge ' + cls + '">' + icon + ' ' + lbl + '</span></td>' +
        '<td><span class="fv2-cat-badge">' + _esc(r.category || '—') + '</span></td>' +
        '<td style="color:' + (isOut ? 'var(--red)' : 'var(--green)') + '">' + (isOut ? '− ' : '+ ') + _fmt(r.amount) + '</td>' +
        '<td><button class="fv2-del-btn" onclick="financeV2Delete(\'' + r.id + '\')" title="Hapus">✕</button></td>' +
        '</tr>';
    }).join('');

    var colgroup = '<colgroup>' +
      '<col class="col-no">' +
      '<col class="col-date">' +
      '<col class="col-desc">' +
      '<col class="col-type">' +
      '<col class="col-cat">' +
      '<col class="col-amount">' +
      '<col class="col-action">' +
      '</colgroup>';

    container.innerHTML =
      '<div class="fv2-table-wrap">' +
        '<table class="fv2-table">' +
          colgroup +
          '<thead><tr>' +
            '<th>#</th><th>Tanggal</th><th>Keterangan</th><th>Tipe</th><th>Kategori</th><th>Jumlah</th><th></th>' +
          '</tr></thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
        '</table>' +
      '</div>';

    var pgEl   = document.getElementById('fv2-pagination');
    var pgInfo = document.getElementById('fv2-pg-info');
    var pgPrev = document.getElementById('fv2-pg-prev');
    var pgNext = document.getElementById('fv2-pg-next');
    if (pgEl)   pgEl.style.display = '';
    if (pgInfo) pgInfo.textContent = 'Menampilkan ' + (start + 1) + '–' + Math.min(start + _pgSize, _allRows.length) + ' dari ' + _allRows.length + ' transaksi';
    if (pgPrev) pgPrev.disabled = _pgCurrent <= 1;
    if (pgNext) pgNext.disabled = _pgCurrent >= totalPages;
  }

  window.financeV2PgPrev = function () { if (_pgCurrent > 1) { _pgCurrent--; _renderPage(); } };
  window.financeV2PgNext = function () { var tp = Math.ceil(_allRows.length / _pgSize); if (_pgCurrent < tp) { _pgCurrent++; _renderPage(); } };

  /* ══════════════════════════════════════════════════════════
     5. SHOW FORM MODAL
     ══════════════════════════════════════════════════════════ */
  window.financeV2ShowForm = function (type) {
    var modal = document.getElementById('fv2-modal');
    var titleEl = document.getElementById('fv2-modal-title');
    var typeInput = document.getElementById('fv2-form-type');
    var catSel = document.getElementById('fv2-form-cat');
    var titles = { income:'Tambah Pemasukan', expense:'Tambah Pengeluaran', donation:'Catat Donasi', transfer:'Catat Transfer', adjustment:'Penyesuaian Saldo' };
    var catOptions = { income:['shop','sponsorship','event','misc'], expense:['server','operational','plugin','content','misc'], donation:['donation'], transfer:['bank','ewallet','misc'], adjustment:['correction','misc'] };
    var catLabels = { shop:'Toko', sponsorship:'Sponsorship', event:'Event', misc:'Lainnya', server:'Server', operational:'Operasional', plugin:'Plugin/Tools', content:'Konten', bank:'Bank', ewallet:'E-Wallet', donation:'Donasi', correction:'Koreksi' };
    titleEl.textContent = titles[type] || 'Tambah Transaksi';
    typeInput.value = type;
    catSel.innerHTML = (catOptions[type] || ['misc']).map(function (c) { return '<option value="' + c + '">' + (catLabels[c] || c) + '</option>'; }).join('');
    ['fv2-form-amount','fv2-form-note','fv2-form-ref','fv2-form-date'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = (id === 'fv2-form-date') ? _today() : ''; });
    var refLabel = document.getElementById('fv2-ref-label');
    if (refLabel) refLabel.textContent = type === 'donation' ? 'Nama Donatur' : type === 'income' ? 'ID Order (opsional)' : 'Referensi (opsional)';
    modal.style.display = 'flex';
    setTimeout(function () { modal.classList.add('open'); }, 10);
    var amtEl = document.getElementById('fv2-form-amount'); if (amtEl) amtEl.focus();
  };

  window.financeV2CloseModal = function () {
    var modal = document.getElementById('fv2-modal');
    modal.classList.remove('open');
    setTimeout(function () { modal.style.display = 'none'; }, 280);
  };

  /* ══════════════════════════════════════════════════════════
     6. SUBMIT TRANSACTION
     ══════════════════════════════════════════════════════════ */
  window.financeV2Submit = async function () {
    var btn = document.getElementById('fv2-submit-btn');
    var type = document.getElementById('fv2-form-type').value;
    var cat  = document.getElementById('fv2-form-cat').value;
    var amount  = parseFloat(document.getElementById('fv2-form-amount').value);
    var note    = document.getElementById('fv2-form-note').value.trim();
    var ref     = document.getElementById('fv2-form-ref').value.trim();
    var dateVal = document.getElementById('fv2-form-date').value;
    if (!amount || amount <= 0) { _finToast('Nominal harus diisi dan lebih dari 0', 'error'); return; }
    var adminName = (document.getElementById('topbar-email') || {}).textContent || 'admin';
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    var payload = { type: type, category: cat, amount: amount, note: note || null, reference: ref || null, recorded_by: adminName, created_at: dateVal ? dateVal + 'T' + new Date().toTimeString().slice(0, 8) : _nowTs() };
    var result = await sb.from('finance_transactions').insert([payload]);
    btn.disabled = false; btn.textContent = 'Simpan Transaksi';
    if (result.error) { _finToast('Gagal: ' + result.error.message, 'error'); return; }
    _finToast('Transaksi berhasil dicatat ✓', 'success');
    window.financeV2CloseModal();
    var period = (document.getElementById('fv2-period') || {}).value || 'month';
    await Promise.all([window.financeV2LoadSummary(period), window.financeV2LoadList(), _loadCharts(period)]);
  };

  /* ══════════════════════════════════════════════════════════
     7. DELETE
     ══════════════════════════════════════════════════════════ */
  window.financeV2Delete = async function (id) {
    if (!confirm('Hapus transaksi ini?')) return;
    var result = await sb.from('finance_transactions').delete().eq('id', id);
    if (result.error) { _finToast('Gagal hapus: ' + result.error.message, 'error'); return; }
    _finToast('Dihapus.', 'success');
    var period = (document.getElementById('fv2-period') || {}).value || 'month';
    await Promise.all([window.financeV2LoadSummary(period), window.financeV2LoadList(), _loadCharts(period)]);
  };

  /* ══════════════════════════════════════════════════════════
     8. REALTIME
     ══════════════════════════════════════════════════════════ */
  function _finSubscribeRealtime() {
    if (_finSub) return;
    try {
      _finSub = sb.channel('finance-rt-v2')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_transactions' }, function () {
          var period = (document.getElementById('fv2-period') || {}).value || 'month';
          Promise.all([window.financeV2LoadSummary(period), window.financeV2LoadList(), _loadCharts(period)]);
        })
        .subscribe(function (status) { if (status === 'SUBSCRIBED') console.log('[Finance RT] realtime connected'); });
    } catch (e) { console.warn('[Finance RT]', e); }
  }

  /* ══════════════════════════════════════════════════════════
     9. CASHFLOW MONTHLY REPORT
     ══════════════════════════════════════════════════════════ */
  window.financeV2LoadCashflow = async function () {
    var container = document.getElementById('fv2-cashflow');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Memuat...</div>';
    var result = await sb.from('finance_transactions').select('type,amount,created_at').order('created_at', { ascending: true });
    if (result.error) { container.innerHTML = '<div class="empty-state" style="color:#f87171">' + _esc(result.error.message) + '</div>'; return; }
    if (!result.data || !result.data.length) { container.innerHTML = '<div class="empty-state">Belum ada data.</div>'; return; }
    var months = {};
    result.data.forEach(function (r) {
      var m = r.created_at.slice(0, 7);
      if (!months[m]) months[m] = { in: 0, out: 0, don: 0 };
      var a = Number(r.amount) || 0;
      if (r.type === 'income')   months[m].in  += a;
      if (r.type === 'donation') { months[m].in += a; months[m].don += a; }
      if (r.type === 'expense' || r.type === 'transfer') months[m].out += a;
    });
    var keys = Object.keys(months).sort(); var runBal = 0;
    var rowsHtml = keys.map(function (m) {
      var row = months[m]; var flow = row.in - row.out; runBal += flow;
      var parts = m.split('-');
      var label = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      return '<tr>' +
        '<td style="font-weight:600">' + label + '</td>' +
        '<td style="color:var(--green);font-weight:600;text-align:right">' + _fmt(row.in) + '</td>' +
        '<td style="color:#a78bfa;text-align:right">' + (row.don ? _fmt(row.don) : '—') + '</td>' +
        '<td style="font-weight:600;color:#f87171;text-align:right">' + _fmt(row.out) + '</td>' +
        '<td style="font-weight:700;color:' + (flow >= 0 ? 'var(--green)' : '#f87171') + ';text-align:right">' + (flow >= 0 ? '+' : '') + _fmt(flow) + '</td>' +
        '<td style="font-weight:700;color:' + (runBal >= 0 ? 'var(--green)' : '#f87171') + ';text-align:right">' + _fmt(runBal) + '</td>' +
        '</tr>';
    }).join('');

    container.innerHTML =
      '<div class="fv2-table-wrap">' +
        '<table class="fv2-table" style="table-layout:fixed">' +
          '<colgroup><col style="width:140px"><col style="width:130px"><col style="width:120px"><col style="width:130px"><col style="width:120px"><col></colgroup>' +
          '<thead><tr>' +
            '<th>Bulan</th><th style="text-align:right">Pemasukan</th><th style="text-align:right">Donasi</th><th style="text-align:right">Pengeluaran</th><th style="text-align:right">Cashflow</th><th style="text-align:right">Saldo Berjalan</th>' +
          '</tr></thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
        '</table>' +
      '</div>';
  };

  /* ══════════════════════════════════════════════════════════
     10. EXPORT EXCEL
     ══════════════════════════════════════════════════════════ */
  window.financeV2Export = async function () {
    if (typeof ExcelJS === 'undefined') {
      _finToast('Library ExcelJS belum dimuat. Tambahkan CDN ExcelJS di index.html', 'error');
      return;
    }

    _finToast('Menyiapkan laporan Excel...', 'success');

    var result = await sb.from('finance_transactions')
      .select('*').order('created_at', { ascending: false });

    if (result.error || !result.data) {
      _finToast('Gagal export: ' + (result.error ? result.error.message : 'data kosong'), 'error');
      return;
    }

    var rows = result.data;
    var now  = new Date();

    var TYPE_LABEL = { income:'Pemasukan', expense:'Pengeluaran', donation:'Donasi', transfer:'Transfer', adjustment:'Penyesuaian' };
    var CAT_LABEL  = { shop:'Toko', sponsorship:'Sponsorship', event:'Event', misc:'Lainnya', server:'Server', operational:'Operasional', plugin:'Plugin/Tools', content:'Konten', bank:'Bank', ewallet:'E-Wallet', donation:'Donasi', correction:'Koreksi' };

    function _fmtDate(iso) {
      if (!iso) return '';
      return new Date(iso).toLocaleString('id-ID', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' });
    }

    var totalIn = 0, totalOut = 0, totalDon = 0;
    rows.forEach(function(r) {
      var a = Number(r.amount) || 0;
      if (r.type === 'income')                              { totalIn  += a; }
      if (r.type === 'donation')                            { totalIn  += a; totalDon += a; }
      if (r.type === 'expense' || r.type === 'transfer')    { totalOut += a; }
    });
    var balance = totalIn - totalOut;

    var wb = new ExcelJS.Workbook();
    wb.creator = 'Laughtale SMP Admin Panel';
    wb.created = now;
    var ws = wb.addWorksheet('Laporan Keuangan', {
      views: [{ state: 'frozen', ySplit: 10 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 }
    });

    ws.columns = [
      { width: 5  }, { width: 28 }, { width: 14 }, { width: 14 },
      { width: 20 }, { width: 34 }, { width: 24 }, { width: 18 }, { width: 38 },
    ];

    function _border(style) {
      style = style || 'thin';
      var b = { style: style, color: { argb: 'FFB0B8C1' } };
      return { top: b, bottom: b, left: b, right: b };
    }

    ws.addRow([]);
    ws.mergeCells('A1:I1');
    var titleCell = ws.getCell('A1');
    titleCell.value     = 'LAPORAN KEUANGAN LAUGHTALE SMP';
    titleCell.font      = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 28;

    ws.addRow([]);
    ws.mergeCells('A2:I2');
    var subCell = ws.getCell('A2');
    subCell.value     = 'Diekspor: ' + _fmtDate(now.toISOString()) + '   |   Total: ' + rows.length + ' transaksi';
    subCell.font      = { size: 10, color: { argb: 'FFA0AEC0' } };
    subCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 18;

    ws.addRow([]);
    ws.addRow([]);
    ws.mergeCells('A4:I4');
    var secCell = ws.getCell('A4');
    secCell.value     = 'RINGKASAN KEUANGAN';
    secCell.font      = { bold: true, size: 10, color: { argb: 'FF1E3A5F' } };
    secCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
    secCell.alignment = { horizontal: 'left', vertical: 'middle' };
    secCell.border    = _border();

    var summaryItems = [
      { label: 'Total Pemasukan (termasuk donasi)', val: totalIn,   color: 'FF15803D', bg: 'FFF0FDF4', bold: true },
      { label: 'Total Pengeluaran',                 val: totalOut,  color: 'FFB91C1C', bg: 'FFFEF2F2', bold: true },
      { label: 'Total Donasi',                      val: totalDon,  color: 'FF1D4ED8', bg: 'FFEFF6FF', bold: false },
      { label: 'Saldo Bersih',                      val: balance,   color: balance >= 0 ? 'FF15803D' : 'FFB91C1C', bg: balance >= 0 ? 'FFF0FDF4' : 'FFFEF2F2', bold: true },
    ];
    summaryItems.forEach(function(item, i) {
      ws.addRow([]);
      var rNum = 5 + i;
      ws.mergeCells(rNum, 1, rNum, 3);
      var keyCell = ws.getCell(rNum, 1);
      keyCell.value = item.label; keyCell.font = { bold: true, size: 10, color: { argb: 'FF374151' } };
      keyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
      keyCell.alignment = { horizontal: 'left', vertical: 'middle' }; keyCell.border = _border();
      var valCell = ws.getCell(rNum, 4);
      valCell.value = item.val; valCell.font = { bold: item.bold, size: 10, color: { argb: item.color } };
      valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: item.bg } };
      valCell.alignment = { horizontal: 'right', vertical: 'middle' };
      valCell.border = _border(); valCell.numFmt = '#,##0';
    });

    ws.addRow([]);

    var headerRow = ws.addRow(['No','Tanggal & Waktu','Tipe','Kategori','Nominal (Rp)','Catatan','Referensi / Donatur','Dicatat Oleh','ID Transaksi']);
    headerRow.height = 20;
    headerRow.eachCell(function(cell, colNum) {
      cell.font      = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      cell.border    = _border('medium');
      cell.alignment = { horizontal: (colNum === 5) ? 'right' : 'center', vertical: 'middle', wrapText: true };
    });

    rows.forEach(function(r, i) {
      var isOut  = r.type === 'expense' || r.type === 'transfer';
      var isEven = i % 2 === 0;
      var bgBase = isEven ? 'FFF8FAFC' : 'FFFFFFFF';
      var STATUS_COLOR = { income:{ fg:'FFF0FDF4', font:'FF15803D' }, expense:{ fg:'FFFEF2F2', font:'FFB91C1C' }, donation:{ fg:'FFEFF6FF', font:'FF1D4ED8' }, transfer:{ fg:'FFDBEAFE', font:'FF1E40AF' }, adjustment:{ fg:'FFFEFCE8', font:'FF854D0E' } };
      var dataRow = ws.addRow([
        i + 1, _fmtDate(r.created_at), TYPE_LABEL[r.type] || r.type, CAT_LABEL[r.category] || r.category || '',
        Number(r.amount) || 0, r.note || '', r.reference || '', r.recorded_by || '', r.id || '',
      ]);
      dataRow.height = 16;
      dataRow.eachCell(function(cell, colNum) {
        cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgBase } };
        cell.border = _border();
        cell.font   = { size: 10, color: { argb: 'FF1F2937' } };
        if (colNum === 5) {
          var sc = STATUS_COLOR[r.type] || {};
          cell.font      = { bold: true, size: 10, color: { argb: isOut ? 'FFB91C1C' : 'FF15803D' } };
          cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: isOut ? 'FFFEF2F2' : 'FFF0FDF4' } };
          cell.numFmt    = '#,##0';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (colNum === 1) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (colNum === 3 || colNum === 4 || colNum === 8) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    });

    var MIN_WIDTH = 8, MAX_WIDTH = 60, PADDING = 4;
    ws.columns.forEach(function(col, colIdx) {
      var maxLen = MIN_WIDTH;
      ws.eachRow(function(row) {
        var cell = row.getCell(colIdx + 1);
        if (!cell || cell.isMerged) return;
        var val = cell.value;
        var len = 0;
        if (val === null || val === undefined) { len = 0; }
        else if (typeof val === 'number') { len = val.toLocaleString('id-ID').length + 2; }
        else if (val instanceof Date) { len = 20; }
        else { len = String(val).length; }
        if (cell.font && cell.font.bold) len = Math.ceil(len * 1.1);
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(maxLen + PADDING, MAX_WIDTH);
    });

    var dateTag = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
    var buf  = await wb.xlsx.writeBuffer();
    var blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var a    = document.createElement('a');
    a.href   = URL.createObjectURL(blob);
    a.download = 'Laporan-Keuangan-LaughtaleSMP-' + dateTag + '.xlsx';
    a.click();
    URL.revokeObjectURL(a.href);
    _finToast('Export Excel berhasil — ' + rows.length + ' transaksi ✓', 'success');
  };

  /* ══════════════════════════════════════════════════════════
     11. SETUP DB HELPER
     ══════════════════════════════════════════════════════════ */
  window.financeV2SetupDB = function () {
    var sql = [
      '-- Tabel transaksi keuangan',
      'CREATE TABLE IF NOT EXISTS finance_transactions (',
      '  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),',
      '  type         text NOT NULL CHECK (type IN (\'income\',\'expense\',\'donation\',\'transfer\',\'adjustment\')),',
      '  category     text NOT NULL DEFAULT \'misc\',',
      '  amount       numeric NOT NULL,',
      '  note         text,',
      '  reference    text,',
      '  recorded_by  text,',
      '  created_at   timestamptz NOT NULL DEFAULT now()',
      ');',
      'CREATE INDEX IF NOT EXISTS idx_ft_created ON finance_transactions(created_at DESC);',
      'CREATE INDEX IF NOT EXISTS idx_ft_type    ON finance_transactions(type);',
      '',
      '-- Tabel snapshot pemain online',
      'CREATE TABLE IF NOT EXISTS player_snapshots (',
      '  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),',
      '  player_count integer NOT NULL DEFAULT 0,',
      '  max_players  integer NOT NULL DEFAULT 0,',
      '  recorded_at  timestamptz NOT NULL DEFAULT now()',
      ');',
      'CREATE INDEX IF NOT EXISTS idx_ps_recorded ON player_snapshots(recorded_at DESC);',
    ].join('\n');
    var box = document.getElementById('fv2-sql-box');
    if (box) { box.style.display = 'block'; document.getElementById('fv2-sql-code').textContent = sql; }
  };

  window.financeV2CopySQL = function () {
    var code = (document.getElementById('fv2-sql-code') || {}).textContent;
    if (!code) return;
    navigator.clipboard.writeText(code).then(function () { _finToast('SQL disalin ✓', 'success'); });
  };

})();
