/* ═══════════════════════════════════════════════
   admin-player-graph.js — Grafik Player Online
   Auto-refresh tiap 5 menit, Page Visibility API
   Tabel: player_snapshots (player_count, recorded_at)
═══════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Konstanta ── */
  const REFRESH_MS   = 5 * 60 * 1000; // 5 menit
  const SUPABASE_URL = 'https://jlxtnbnrirxhwuyqjlzw.supabase.co';

  let chartInstance  = null;
  let refreshTimer   = null;
  let countdownTimer = null;
  let secondsLeft    = REFRESH_MS / 1000;
  let currentRange   = '6h';
  let isVisible      = true;
  let needsRefresh   = false;

  /* ── Helpers ── */
  function getAnonKey() {
    if (window.SUPABASE_ANON_KEY) return window.SUPABASE_ANON_KEY;
    if (window._supabaseClient?._headers?.apikey) return window._supabaseClient._headers.apikey;
    const scripts = document.querySelectorAll('script[src]');
    return null;
  }

  function getSupabaseKey() {
    // Ambil dari window yang di-set supabase-config.js
    return window.SUPABASE_ANON_KEY
      || (window.supabase && window.supabase.supabaseKey)
      || '';
  }

  async function fetchSnapshots(range) {
    const now = new Date();
    const map = { '1h': 1, '6h': 6, '24h': 24, '7d': 168 };
    const hours = map[range] || 6;
    const since = new Date(now.getTime() - hours * 3600 * 1000).toISOString();

    // Tentukan limit & interval grouping
    const limit = range === '7d' ? 336 : 500;

    const key = getSupabaseKey();
    const url = `${SUPABASE_URL}/rest/v1/player_snapshots?select=player_count,recorded_at&recorded_at=gte.${encodeURIComponent(since)}&order=recorded_at.asc&limit=${limit}`;

    const res = await fetch(url, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  /* ── Render Chart ── */
  function renderChart(data) {
    const canvas = document.getElementById('pg-chart-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const labels = data.map(d => {
      const dt = new Date(d.recorded_at);
      return dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    });
    const values = data.map(d => d.player_count);

    // Warna dari CSS variable (fallback ke teal)
    const style = getComputedStyle(document.documentElement);
    const accent = style.getPropertyValue('--accent').trim() || '#4a8fff';
    const green  = style.getPropertyValue('--green').trim()  || '#4ade80';

    if (chartInstance) {
      chartInstance.data.labels = labels;
      chartInstance.data.datasets[0].data = values;
      chartInstance.update('active');
      return;
    }

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Player Online',
          data: values,
          borderColor: accent,
          backgroundColor: (ctx2) => {
            const g = ctx2.chart.ctx.createLinearGradient(0, 0, 0, ctx2.chart.height);
            g.addColorStop(0, accent.replace(')', ', 0.25)').replace('rgb', 'rgba').replace('#', '').length > 7
              ? accent + '40'
              : accent + '40');
            g.addColorStop(1, 'transparent');
            return g;
          },
          borderWidth: 2,
          pointRadius: data.length > 60 ? 0 : 3,
          pointHoverRadius: 5,
          pointBackgroundColor: accent,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.75)',
            titleColor: '#fff',
            bodyColor: '#ccc',
            padding: 10,
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                const dt  = new Date(data[idx].recorded_at);
                return dt.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
              },
              label: (item) => ` ${item.raw} pemain online`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: style.getPropertyValue('--text-faint').trim() || '#666',
              maxTicksLimit: 8,
              maxRotation: 0,
              font: { size: 11 }
            }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: style.getPropertyValue('--text-faint').trim() || '#666',
              stepSize: 1,
              font: { size: 11 }
            }
          }
        }
      }
    });
  }

  /* ── Update Stats Cards ── */
  function updateStats(data) {
    if (!data.length) {
      setText('pg-stat-now',  '—');
      setText('pg-stat-peak', '—');
      setText('pg-stat-avg',  '—');
      setText('pg-stat-total','—');
      return;
    }
    const counts = data.map(d => d.player_count);
    const now    = counts[counts.length - 1];
    const peak   = Math.max(...counts);
    const avg    = (counts.reduce((a,b) => a+b, 0) / counts.length).toFixed(1);
    setText('pg-stat-now',   now);
    setText('pg-stat-peak',  peak);
    setText('pg-stat-avg',   avg);
    setText('pg-stat-total', data.length);

    // Status dot
    const dot = document.getElementById('pg-status-dot');
    if (dot) {
      dot.classList.toggle('pg-dot-online',  now > 0);
      dot.classList.toggle('pg-dot-offline', now === 0);
    }
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /* ── Loading state ── */
  function setLoading(yes) {
    const wrap = document.getElementById('pg-chart-wrap');
    const spin = document.getElementById('pg-loading');
    if (spin) spin.style.display = yes ? 'flex' : 'none';
    if (wrap) wrap.style.opacity = yes ? '0.4' : '1';
  }

  function setError(msg) {
    const el = document.getElementById('pg-error-msg');
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? 'flex' : 'none';
  }

  /* ── Load Data ── */
  async function loadData(range) {
    setLoading(true);
    setError('');
    try {
      const data = await fetchSnapshots(range);
      if (!data.length) {
        setError('Belum ada data untuk rentang waktu ini.');
        setLoading(false);
        return;
      }
      renderChart(data);
      updateStats(data);
      setText('pg-last-update', new Date().toLocaleTimeString('id-ID'));
    } catch (e) {
      setError('Gagal memuat data: ' + e.message);
      console.error('[PlayerGraph]', e);
    } finally {
      setLoading(false);
    }
  }

  /* ── Countdown ── */
  function startCountdown() {
    clearInterval(countdownTimer);
    secondsLeft = REFRESH_MS / 1000;
    updateCountdownUI();
    countdownTimer = setInterval(() => {
      if (!isVisible) return;
      secondsLeft--;
      if (secondsLeft <= 0) secondsLeft = REFRESH_MS / 1000;
      updateCountdownUI();
    }, 1000);
  }

  function updateCountdownUI() {
    const el = document.getElementById('pg-countdown');
    if (!el) return;
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    el.textContent = `Refresh dalam ${m}:${String(s).padStart(2,'0')}`);

    // SVG ring progress
    const ring = document.getElementById('pg-countdown-ring');
    if (ring) {
      const total = REFRESH_MS / 1000;
      const pct   = secondsLeft / total;
      const circ  = 2 * Math.PI * 10; // r=10
      ring.style.strokeDashoffset = circ * (1 - pct);
    }
  }

  /* ── Auto Refresh ── */
  function startAutoRefresh() {
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      if (!isVisible) { needsRefresh = true; return; }
      loadData(currentRange);
      startCountdown();
    }, REFRESH_MS);
    startCountdown();
  }

  /* ── Page Visibility API ── */
  document.addEventListener('visibilitychange', () => {
    isVisible = !document.hidden;
    if (isVisible && needsRefresh) {
      needsRefresh = false;
      loadData(currentRange);
      startCountdown();
    }
  });

  /* ── Range Buttons ── */
  window.pgSetRange = function (range, btn) {
    currentRange = range;
    document.querySelectorAll('.pg-range-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    loadData(range);
  };

  window.pgRefreshNow = function () {
    loadData(currentRange);
    startCountdown();
  };

  /* ── Init saat section dibuka ── */
  window.initPlayerGraph = function () {
    if (!document.getElementById('pg-chart-canvas')) return;
    if (chartInstance) return; // sudah diinit
    loadData(currentRange);
    startAutoRefresh();
  };

})();
