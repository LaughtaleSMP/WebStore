/* ═══════════════════════════════════════════════════════════
   admin-finance.js  —  Finance Dashboard V2
   Laughtale SMP Admin Panel
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

  /* ── Chart instances (destroyed on re-render) ── */
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
  var _finSub       = null;
  var _playerTimer  = null;   // ← interval auto-update grafik pemain
  var PLAYER_INTERVAL_MS = 5 * 60 * 1000; // 5 menit

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

  /* ── Internal: Summary fallback ── */
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
    _stopPlayerAutoUpdate(); // clear dulu kalau ada yang lama
    _playerTimer = setInterval(function () {
      console.log('[Finance] Auto-update grafik pemain — ' + new Date().toLocaleTimeString('id-ID'));
      window.financeV2RecordPlayer();
    }, PLAYER_INTERVAL_MS);
    console.log('[Finance] Auto-update grafik pemain aktif (setiap 5 menit)');
  }

  function _stopPlayerAutoUpdate() {
    if (_playerTimer) {
      clearInterval(_playerTimer);
      _playerTimer = null;
      console.log('[Finance] Auto-update grafik pemain dihentikan');
    }
  }

  /* ══════════════════════════════════════════════════════════
     2. SUMMARY CARDS (with delta vs previous period)
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

    _setSum('fv2-sum-in',  _fmtShort(cur.in));
    _setSum('fv2-sum-out', _fmtShort(cur.out));
    _setSum('fv2-sum-don', _fmtShort(cur.don));
    _setSum('fv2-sum-bal', _fmtShort(cur.bal), cur.bal >= 0 ? 'pos' : 'neg');

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
    if (_lineChart) { _lineChart.destroy(); _lineChart = null; }

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
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4a5568', font: { size: 10 }, callback: function (v) { return _fmtShort(v); } }, border: { color: 'rgba(255,255,255,0.06)' }, beginAtZero: true },
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
    if (_pieChart) { _pieChart.destroy(); _pieChart = null; }

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
    if (_barChart) { _barChart.destroy(); _barChart = null; }

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
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4a5568', font: { size: 10 }, callback: function (v) { return _fmtShort(v); } }, border: { color: 'rgba(255,255,255,0.06)' }, beginAtZero: true },
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
          '<span class="fv2-mbar-val" style="color:' + barColors[i].replace('0.75','1') + '">' + _fmtShort(e[1]) + '</span>' +
          '</div>';
      }).join('');
    }
  }

  /* ══════════════════════════════════════════════════════════
     3B. PLAYER ONLINE CHART
     ══════════════════════════════════════════════════════════ */
  async function _loadPlayerData() {
    _fetchLivePlayerCount();
    var result = await sb
      .from('player_snapshots')
      .select('player_count, max_players, recorded_at')
      .order('recorded_at', { ascending: true })
      .limit(60);
    if (result.error) { _buildPlayerChart([]); return; }
    _buildPlayerChart(result.data || []);
    _updateCountdownLabel();
  }

  function _updateCountdownLabel() {
    var lbl = document.getElementById('fv2-player-next-update');
    if (!lbl) return;
    var sisa = Math.round(PLAYER_INTERVAL_MS / 1000 / 60);
    lbl.textContent = 'Update otomatis dalam ~' + sisa + ' menit';
  }

  function _fetchLivePlayerCount() {
    var ip = _getServerIp();
    var parts = ip.split(':');
    var host  = parts[0];
    var port  = parts[1] || '19214';
    var dotEl = document.getElementById('fv2-player-dot');
    var numEl = document.getElementById('fv2-player-num');
    var lblEl = document.getElementById('fv2-player-label');
    fetch('https://api.mcsrvstat.us/bedrock/3/' + host + ':' + port, { signal: AbortSignal.timeout(8000) })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.online) {
          var onl = data.players ? (data.players.online || 0) : 0;
          var max = data.players ? (data.players.max || '?') : '?';
          if (dotEl) dotEl.className = 'fv2-player-dot online';
          if (numEl) numEl.textContent = onl + ' / ' + max;
          if (lblEl) lblEl.textContent = 'Pemain online sekarang';
        } else {
          if (dotEl) dotEl.className = 'fv2-player-dot offline';
          if (numEl) numEl.textContent = 'Offline';
          if (lblEl) lblEl.textContent = 'Server tidak dapat dijangkau';
        }
      })
      .catch(function () {
        if (dotEl) dotEl.className = 'fv2-player-dot offline';
        if (numEl) numEl.textContent = '—';
        if (lblEl) lblEl.textContent = 'Gagal mengambil status server';
      });
  }

  function _buildPlayerChart(rows) {
    if (typeof Chart === 'undefined') return;
    var canvas = document.getElementById('fv2-player-chart');
    if (!canvas) return;
    if (_playerChart) { _playerChart.destroy(); _playerChart = null; }
    var labels, data, isEmpty;
    if (!rows || !rows.length) {
      isEmpty = true; labels = ['Belum ada data']; data = [0];
    } else {
      isEmpty = false;
      labels = rows.map(function (r) {
        var d = new Date(r.recorded_at);
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) +
               ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      });
      data = rows.map(function (r) { return Number(r.player_count) || 0; });
    }
    _playerChart = new Chart(canvas, {
      type: 'line',
      data: { labels: labels, datasets: [{ label: 'Pemain Online', data: data, borderColor: '#4a8fff', backgroundColor: 'rgba(74,143,255,0.1)', borderWidth: 2, pointRadius: isEmpty ? 0 : (rows.length > 20 ? 2 : 4), pointBackgroundColor: '#4a8fff', pointBorderWidth: 0, tension: 0.4, fill: true }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: !isEmpty, callbacks: { label: function (ctx) { return ' ' + ctx.parsed.y + ' pemain online'; } } } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4a5568', font: { size: 9 }, maxTicksLimit: 8, maxRotation: 30 }, border: { color: 'rgba(255,255,255,0.06)' } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4a5568', font: { size: 10 }, stepSize: 1, precision: 0 }, border: { color: 'rgba(255,255,255,0.06)' }, beginAtZero: true, min: 0 },
        },
      },
    });
    if (isEmpty) {
      var wrap = canvas.parentElement;
      if (wrap && !wrap.querySelector('.fv2-player-empty')) {
        var msg = document.createElement('div');
        msg.className = 'fv2-player-empty';
        msg.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--text-faint);pointer-events:none;text-align:center;padding:8px';
        msg.textContent = 'Klik "Catat" untuk merekam jumlah pemain pertama';
        wrap.appendChild(msg);
      }
    } else {
      var existing = canvas.parentElement && canvas.parentElement.querySelector('.fv2-player-empty');
      if (existing) existing.remove();
    }
  }

  window.financeV2RecordPlayer = async function () {
    var btn = document.querySelector('.fv2-player-record-btn');
    if (btn) { btn.disabled = true; btn.style.opacity = '.5'; }
    var ip = _getServerIp(); var parts = ip.split(':');
    var host = parts[0]; var port = parts[1] || '19214';
    var dotEl = document.getElementById('fv2-player-dot');
    var numEl = document.getElementById('fv2-player-num');
    var lblEl = document.getElementById('fv2-player-label');
    try {
      var r = await fetch('https://api.mcsrvstat.us/bedrock/3/' + host + ':' + port, { signal: AbortSignal.timeout(8000) });
      var data = await r.json();
      var playerCount = data.online ? (data.players ? (data.players.online || 0) : 0) : 0;
      var maxPlayers  = data.online ? (data.players ? (data.players.max   || 0) : 0) : 0;
      if (dotEl) dotEl.className = data.online ? 'fv2-player-dot online' : 'fv2-player-dot offline';
      if (numEl) numEl.textContent = data.online ? (playerCount + ' / ' + maxPlayers) : 'Offline';
      if (lblEl) lblEl.textContent = 'Diperbarui baru saja';
      var ins = await sb.from('player_snapshots').insert([{ player_count: playerCount, max_players: maxPlayers, recorded_at: new Date().toISOString() }]);
      if (ins.error) { _finToast('Gagal simpan snapshot: Setup DB player terlebih dahulu.', 'error'); }
      else { _finToast('Snapshot dicatat: ' + playerCount + ' pemain ✓', 'success'); await _loadPlayerData(); }
    } catch (e) {
      if (dotEl) dotEl.className = 'fv2-player-dot offline';
      if (numEl) numEl.textContent = '—';
      if (lblEl) lblEl.textContent = 'Gagal terhubung ke server';
      _finToast('Gagal ambil data server: ' + (e.message || 'timeout'), 'error');
    }
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  };

  /* ══════════════════════════════════════════════════════════
     4. TRANSACTION LIST (with pagination)
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
            '<th>#</th>' +
            '<th>Tanggal</th>' +
            '<th>Keterangan</th>' +
            '<th>Tipe</th>' +
            '<th>Kategori</th>' +
            '<th>Jumlah</th>' +
            '<th></th>' +
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
    var rowsHtml = keys.map(function (m, idx) {
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

    var colgroup = '<colgroup>' +
      '<col style="width:140px">' +
      '<col style="width:130px">' +
      '<col style="width:120px">' +
      '<col style="width:130px">' +
      '<col style="width:120px">' +
      '<col>' +
      '</colgroup>';

    container.innerHTML =
      '<div class="fv2-table-wrap">' +
        '<table class="fv2-table" style="table-layout:fixed">' +
          colgroup +
          '<thead><tr>' +
            '<th>Bulan</th>' +
            '<th style="text-align:right">Pemasukan</th>' +
            '<th style="text-align:right">Donasi</th>' +
            '<th style="text-align:right">Pengeluaran</th>' +
            '<th style="text-align:right">Cashflow</th>' +
            '<th style="text-align:right">Saldo Berjalan</th>' +
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
      keyCell.value     = item.label;
      keyCell.font      = { bold: true, size: 10, color: { argb: 'FF374151' } };
      keyCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
      keyCell.alignment = { horizontal: 'left', vertical: 'middle' };
      keyCell.border    = _border();
      var valCell = ws.getCell(rNum, 4);
      valCell.value      = item.val;
      valCell.font       = { bold: item.bold, size: 10, color: { argb: item.color } };
      valCell.fill       = { type: 'pattern', pattern: 'solid', fgColor: { argb: item.bg } };
      valCell.alignment  = { horizontal: 'right', vertical: 'middle' };
      valCell.border     = _border();
      valCell.numFmt     = '#,##0';
    });

    ws.addRow([]);

    var headerRow = ws.addRow([
      'No', 'Tanggal & Waktu', 'Tipe', 'Kategori',
      'Nominal (Rp)', 'Catatan', 'Referensi / Donatur',
      'Dicatat Oleh', 'ID Transaksi'
    ]);
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
      var dataRow = ws.addRow([
        i + 1, _fmtDate(r.created_at),
        TYPE_LABEL[r.type] || r.type,
        CAT_LABEL[r.category] || r.category || '',
        Number(r.amount) || 0,
        r.note || '', r.reference || '', r.recorded_by || '', r.id || '',
      ]);
      dataRow.height = 16;
      dataRow.eachCell(function(cell, colNum) {
        cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgBase } };
        cell.border = _border();
        cell.font   = { size: 10, color: { argb: 'FF1F2937' } };
        if (colNum === 5) {
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
        else if (typeof val === 'object' && val.richText) { len = val.richText.map(function(rt) { return (rt.text || '').length; }).join('').length; }
        else { len = String(val).length; }
        var isBold = cell.font && cell.font.bold;
        if (isBold) len = Math.ceil(len * 1.1);
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(maxLen + PADDING, MAX_WIDTH);
    });

    var dateTag = now.getFullYear() + '-' +
      String(now.getMonth()+1).padStart(2,'0') + '-' +
      String(now.getDate()).padStart(2,'0');

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

  // ─── REMOVED: window.financeLoad = window.financeV2Init ───
  // Baris ini dihapus karena menimpa fungsi financeLoad() legacy
  // yang sudah didefinisikan di index.html inline script.

})();
