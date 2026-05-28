/* ================================================================
   admin-dashboard.js — Dashboard landing page logic (Enhanced v2)
   Loads key stats on section open: orders pending, done today,
   revenue today, server players, recent orders list,
   PLUS: revenue sparkline (7 hari), conversion rate, top items
================================================================ */
(function () {
  'use strict';

  function getSb() { return window._adminSb || null; }
  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function fmtRp(n) { return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID'); }
  function fmtShort(n) {
    n = Number(n) || 0;
    if (n >= 1000000) return 'Rp ' + (n / 1000000).toFixed(1).replace('.0', '') + 'jt';
    if (n >= 1000)    return 'Rp ' + (n / 1000).toFixed(1).replace('.0', '') + 'rb';
    return 'Rp ' + n.toLocaleString('id-ID');
  }

  var _sparkChart = null;

  const STATUS_BADGE = {
    pending:   '<span style="background:rgba(251,191,36,.12);color:#fbbf24;border:1px solid rgba(251,191,36,.2);padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700">Pending</span>',
    selesai:   '<span style="background:rgba(52,211,153,.12);color:#34d399;border:1px solid rgba(52,211,153,.2);padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700">Selesai</span>',
    refund:    '<span style="background:rgba(248,113,113,.12);color:#f87171;border:1px solid rgba(248,113,113,.2);padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700">Refund</span>',
    cancelled: '<span style="background:rgba(160,174,192,.12);color:#a0aec0;border:1px solid rgba(160,174,192,.2);padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700">Cancelled</span>',
  };

  /* ── WIB Clock ── */
  function updateClock() {
    const el = document.getElementById('dash-clock');
    if (!el) return;
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    el.innerHTML = `
      <span style="font-size:1.6rem;font-weight:800;color:var(--text);letter-spacing:-1px;font-variant-numeric:tabular-nums">${pad(now.getHours())}:${pad(now.getMinutes())}</span>
      <span style="font-size:.72rem;color:var(--text-faint);font-weight:600">${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} WIB</span>
    `;
  }

  /* ── Load Dashboard Data ── */
  window.dashboardLoad = async function () {
    const sb = getSb();
    if (!sb) return;

    updateClock();
    clearInterval(window._dashClockTimer);
    window._dashClockTimer = setInterval(updateClock, 30000);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    /* Tanggal 7 hari lalu untuk sparkline + konversi */
    const d7ago = new Date();
    d7ago.setDate(d7ago.getDate() - 7);
    d7ago.setHours(0, 0, 0, 0);

    try {
      const [pendingRes, doneRes, revRes, recentRes, reqRes, weekOrdersRes, weekFinRes] = await Promise.all([
        sb.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        sb.from('orders').select('id', { count: 'exact', head: true })
          .eq('status', 'selesai')
          .gte('completed_at', today.toISOString())
          .lt('completed_at', todayEnd.toISOString()),
        sb.from('orders').select('total_price')
          .eq('status', 'selesai')
          .gte('completed_at', today.toISOString())
          .lt('completed_at', todayEnd.toISOString()),
        sb.from('orders').select('*').order('created_at', { ascending: false }).limit(5),
        sb.from('admin_pending_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        /* 7-day orders for conversion + top items */
        sb.from('orders').select('status,item_name,total_price,created_at,completed_at')
          .gte('created_at', d7ago.toISOString())
          .order('created_at', { ascending: true }),
        /* 7-day finance for sparkline */
        sb.from('finance_transactions').select('type,amount,created_at')
          .gte('created_at', d7ago.toISOString())
          .order('created_at', { ascending: true }),
      ]);

      // ── Stat cards ──
      const pending = pendingRes.count || 0;
      const done = doneRes.count || 0;
      const rev = (revRes.data || []).reduce((s, r) => s + (r.total_price || 0), 0);
      const pendingReq = reqRes.count || 0;

      _setVal('dash-pending', pending, pending > 0 ? 'color:#fbbf24' : '');
      _setVal('dash-done', done, '');
      _setVal('dash-revenue', fmtRp(rev), 'color:#34d399');
      _setVal('dash-requests', pendingReq, pendingReq > 0 ? 'color:#fbbf24' : '');

      // ── Recent orders ──
      const recentEl = document.getElementById('dash-recent-orders');
      if (recentEl && recentRes.data) {
        if (recentRes.data.length === 0) {
          recentEl.innerHTML = '<div style="color:var(--text-faint);font-size:12px;padding:12px 0;text-align:center">Belum ada pesanan.</div>';
        } else {
          recentEl.innerHTML = recentRes.data.map(o => `
            <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
              <div style="flex:1;min-width:0">
                <div style="font-size:12.5px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(o.item_name || '—')}</div>
                <div style="font-size:11px;color:var(--text-faint);display:flex;gap:8px;margin-top:2px">
                  <span>${esc(o.username || 'Anonim')}</span>
                  <span>${fmtRp(o.total_price)}</span>
                </div>
              </div>
              <div>${STATUS_BADGE[o.status] || esc(o.status || '—')}</div>
            </div>
          `).join('');
        }
      }

      // ── Server status (reuse existing live data if available) ──
      const playerEl = document.getElementById('dash-players');
      const liveEl = document.getElementById('live-players');
      if (playerEl && liveEl) {
        playerEl.textContent = liveEl.textContent || '—';
      }

      // ── NEW: Revenue Sparkline (7 hari) ──
      _buildRevenueSparkline(weekFinRes.data || []);

      // ── NEW: Conversion Rate & Top Items ──
      _buildInsightsPanel(weekOrdersRes.data || []);

    } catch (e) {
      console.warn('[Dashboard]', e);
    }
  };

  /* ── Revenue Sparkline ── */
  function _buildRevenueSparkline(rows) {
    var container = document.getElementById('dash-sparkline-wrap');
    if (!container) {
      /* Inject container after stats strip */
      var statsStrip = document.querySelector('#sec-dashboard .orders-stats-strip');
      if (!statsStrip) return;
      container = document.createElement('div');
      container.id = 'dash-sparkline-wrap';
      container.innerHTML = `
        <div class="card" style="margin-top:12px;padding:16px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <div>
              <div style="font-size:12.5px;font-weight:700;color:var(--text)">Revenue 7 Hari</div>
              <div style="font-size:11px;color:var(--text-faint)" id="dash-spark-total">—</div>
            </div>
            <div style="font-size:18px;font-weight:800;color:var(--green)" id="dash-spark-today-val">—</div>
          </div>
          <div style="height:90px;position:relative">
            <canvas id="dash-spark-canvas"></canvas>
          </div>
        </div>
      `;
      statsStrip.parentNode.insertBefore(container, statsStrip.nextSibling);
    }

    /* Aggregate revenue per day */
    var dayMap = {};
    for (var i = 6; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      dayMap[d.toISOString().split('T')[0]] = 0;
    }
    rows.forEach(function (r) {
      var key = (r.created_at || '').split('T')[0];
      var amt = Number(r.amount) || 0;
      if (r.type === 'income' || r.type === 'donation') {
        if (dayMap.hasOwnProperty(key)) dayMap[key] += amt;
      }
    });

    var labels = Object.keys(dayMap);
    var values = labels.map(function (k) { return dayMap[k]; });
    var totalWeek = values.reduce(function (a, b) { return a + b; }, 0);
    var todayVal = values[values.length - 1] || 0;

    var totalEl = document.getElementById('dash-spark-total');
    if (totalEl) totalEl.textContent = 'Total 7 hari: ' + fmtShort(totalWeek);
    var todayEl = document.getElementById('dash-spark-today-val');
    if (todayEl) todayEl.textContent = fmtShort(todayVal);

    /* Render chart */
    var canvas = document.getElementById('dash-spark-canvas');
    if (!canvas || typeof Chart === 'undefined') return;

    try { if (_sparkChart) _sparkChart.destroy(); } catch (e) {}
    try {
      var ex = Chart.getChart && Chart.getChart(canvas);
      if (ex) ex.destroy();
    } catch (e) {}

    var ctx = canvas.getContext('2d');
    var grad = ctx.createLinearGradient(0, 0, 0, 90);
    grad.addColorStop(0, 'rgba(52,211,153,0.25)');
    grad.addColorStop(1, 'rgba(52,211,153,0.00)');

    var shortLabels = labels.map(function (l) {
      var d = new Date(l);
      return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    });

    _sparkChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: shortLabels,
        datasets: [{
          data: values,
          borderColor: '#34d399',
          backgroundColor: grad,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#34d399',
          pointBorderColor: 'rgba(11,16,24,0.8)',
          pointBorderWidth: 1,
          fill: true,
          tension: 0.4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(12,16,23,0.95)',
            borderColor: 'rgba(52,211,153,0.3)',
            borderWidth: 1,
            titleColor: '#94ffcc',
            bodyColor: '#dde3ec',
            padding: 8,
            cornerRadius: 8,
            callbacks: {
              label: function (item) { return '  ' + fmtRp(item.raw); }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#3a4458', font: { size: 9 }, maxRotation: 0 },
            border: { color: 'rgba(255,255,255,0.05)' }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: {
              color: '#3a4458', font: { size: 9 }, maxTicksLimit: 4,
              callback: function (v) { return fmtShort(v); }
            },
            border: { color: 'rgba(255,255,255,0.05)' }
          }
        }
      }
    });
  }

  /* ── Insights Panel: Conversion + Top Items ── */
  function _buildInsightsPanel(orders) {
    var container = document.getElementById('dash-insights-wrap');
    if (!container) {
      /* Inject before recent orders card */
      var recentCard = document.querySelector('#sec-dashboard .card');
      if (!recentCard) return;
      container = document.createElement('div');
      container.id = 'dash-insights-wrap';
      container.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px';
      recentCard.parentNode.insertBefore(container, recentCard);
    }

    /* Conversion rate */
    var total = orders.length;
    var completed = orders.filter(function (o) { return o.status === 'selesai'; }).length;
    var convRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    /* Pending age — oldest pending */
    var pendingOrders = orders.filter(function (o) { return o.status === 'pending'; });
    var oldestAge = '—';
    if (pendingOrders.length) {
      var oldestDate = new Date(pendingOrders[0].created_at);
      var diffMs = Date.now() - oldestDate.getTime();
      var diffH = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffH < 1) oldestAge = Math.floor(diffMs / (1000 * 60)) + ' menit';
      else if (diffH < 24) oldestAge = diffH + ' jam';
      else oldestAge = Math.floor(diffH / 24) + ' hari';
    }

    /* Top 3 selling items (by count) */
    var itemCounts = {};
    var itemRevenue = {};
    orders.forEach(function (o) {
      if (o.status !== 'selesai') return;
      var name = o.item_name || 'Unknown';
      itemCounts[name] = (itemCounts[name] || 0) + 1;
      itemRevenue[name] = (itemRevenue[name] || 0) + (Number(o.total_price) || 0);
    });
    var topItems = Object.keys(itemCounts)
      .map(function (name) { return { name: name, count: itemCounts[name], revenue: itemRevenue[name] }; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, 3);

    var rankColors = ['#fbbf24', '#a0aec0', '#cd7f32'];
    function _rankSvg(i) {
      var c = rankColors[i] || 'var(--text-faint)';
      var n = i + 1;
      return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="flex-shrink:0">' +
        '<circle cx="12" cy="12" r="10" fill="' + c + '" opacity=".18"/>' +
        '<circle cx="12" cy="12" r="8" fill="' + c + '" opacity=".35"/>' +
        '<text x="12" y="16" text-anchor="middle" font-size="11" font-weight="800" fill="' + c + '">' + n + '</text>' +
      '</svg>';
    }

    container.innerHTML = `
      <div class="card" style="padding:14px">
        <div style="font-size:11px;font-weight:700;color:var(--text-faint);text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px">Konversi 7 Hari</div>
        <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:6px">
          <span style="font-size:1.8rem;font-weight:800;color:${convRate >= 70 ? 'var(--green)' : convRate >= 40 ? '#fbbf24' : '#f87171'};font-variant-numeric:tabular-nums">${convRate}%</span>
          <span style="font-size:11px;color:var(--text-faint)">${completed}/${total} order</span>
        </div>
        <div style="height:5px;background:var(--surface2);border-radius:4px;overflow:hidden;margin-bottom:10px">
          <div style="height:100%;width:${convRate}%;background:${convRate >= 70 ? 'var(--green)' : convRate >= 40 ? '#fbbf24' : '#f87171'};border-radius:4px;transition:width .5s"></div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-faint)">
          <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Pending tertua: <strong style="color:${pendingOrders.length > 0 ? '#fbbf24' : 'var(--text-faint)'}">${oldestAge}</strong>
        </div>
      </div>
      <div class="card" style="padding:14px">
        <div style="font-size:11px;font-weight:700;color:var(--text-faint);text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px">Top Item 7 Hari</div>
        ${topItems.length === 0
          ? '<div style="font-size:11.5px;color:var(--text-faint);text-align:center;padding:8px 0">Belum ada penjualan</div>'
          : topItems.map(function (item, i) {
              return `
                <div style="display:flex;align-items:center;gap:8px;padding:4px 0;${i < topItems.length - 1 ? 'border-bottom:1px solid var(--border);margin-bottom:4px' : ''}">
                  ${_rankSvg(i)}
                  <div style="flex:1;min-width:0">
                    <div style="font-size:11.5px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(item.name)}</div>
                    <div style="font-size:10px;color:var(--text-faint)">${item.count}× · ${fmtShort(item.revenue)}</div>
                  </div>
                </div>`;
            }).join('')
        }
      </div>
    `;
  }

  function _setVal(id, val, style) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = val;
    if (style) el.style.cssText = style;
  }

})();
