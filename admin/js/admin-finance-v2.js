/* ════════════════════════════════════════════════════════════════
   admin-finance-v2.js  —  Finance V2 UI Renderer
   Meng-inject HTML ke #fv2-root lalu admin-finance.js
   menangani semua logika & data.
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── HTML struktur untuk #fv2-root ── */
  var FINANCE_HTML = [
    /* ── Summary Cards ── */
    '<div class="fv2-summary">',
      '<div class="fv2-sum-card c-in">',
        '<div class="fv2-sum-icon">📈</div>',
        '<div class="fv2-sum-label">Pemasukan</div>',
        '<div class="fv2-sum-val" id="fv2-sum-in">—</div>',
        '<div class="fv2-sum-delta" id="fv2-delta-in">—</div>',
      '</div>',
      '<div class="fv2-sum-card c-out">',
        '<div class="fv2-sum-icon">📉</div>',
        '<div class="fv2-sum-label">Pengeluaran</div>',
        '<div class="fv2-sum-val" id="fv2-sum-out">—</div>',
        '<div class="fv2-sum-delta" id="fv2-delta-out">—</div>',
      '</div>',
      '<div class="fv2-sum-card c-don">',
        '<div class="fv2-sum-icon">💜</div>',
        '<div class="fv2-sum-label">Donasi</div>',
        '<div class="fv2-sum-val" id="fv2-sum-don">—</div>',
        '<div class="fv2-sum-delta" id="fv2-delta-don">—</div>',
      '</div>',
      '<div class="fv2-sum-card c-bal">',
        '<div class="fv2-sum-icon">💰</div>',
        '<div class="fv2-sum-label">Saldo Bersih</div>',
        '<div class="fv2-sum-val" id="fv2-sum-bal">—</div>',
        '<div class="fv2-sum-delta" id="fv2-delta-bal">—</div>',
      '</div>',
    '</div>',

    /* ── Period selector ── */
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap">',
      '<label style="font-size:11px;font-weight:600;color:var(--text-faint)">Periode:</label>',
      '<select id="fv2-period"',
        ' style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;',
        'color:var(--text);padding:6px 10px;font-size:12px;outline:none;font-family:inherit">',
        '<option value="today">Hari ini</option>',
        '<option value="week">7 Hari Terakhir</option>',
        '<option value="month" selected>Bulan ini</option>',
        '<option value="year">Tahun ini</option>',
      '</select>',
    '</div>',

    /* ── Charts Row A: Line + Pie ── */
    '<div class="fv2-charts-row">',
      '<div class="fv2-chart-card">',
        '<div class="fv2-chart-title">Tren Keuangan</div>',
        '<div class="fv2-chart-sub">Pemasukan vs Pengeluaran per periode</div>',
        '<div class="fv2-chart-legend">',
          '<div class="fv2-leg-item"><span class="fv2-leg-dot" style="background:#34d399"></span>Pemasukan</div>',
          '<div class="fv2-leg-item"><span class="fv2-leg-dot" style="background:#f87171"></span>Pengeluaran</div>',
        '</div>',
        '<div style="height:180px;position:relative"><canvas id="fv2-line-chart"></canvas></div>',
      '</div>',
      '<div class="fv2-chart-card">',
        '<div class="fv2-chart-title">Distribusi Kategori</div>',
        '<div class="fv2-chart-sub">Breakdown pemasukan per kategori</div>',
        '<div style="height:130px;position:relative"><canvas id="fv2-pie-chart"></canvas></div>',
        '<div class="fv2-pie-legend" id="fv2-pie-legend"></div>',
      '</div>',
    '</div>',

    /* ── Charts Row B: Bar (player card removed — duplikat dengan metrics_history) ── */
    '<div class="fv2-charts-row-b">',
      '<div class="fv2-bar-card">',
        '<div class="fv2-chart-title">Top Kategori Pemasukan</div>',
        '<div class="fv2-chart-sub">Bar chart berdasarkan kategori</div>',
        '<div style="height:160px;position:relative"><canvas id="fv2-bar-chart"></canvas></div>',
        '<div id="fv2-mini-bars" style="margin-top:14px"></div>',
      '</div>',
    '</div>',

    /* ── Tabs ── */
    '<div class="fv2-tabs" style="margin-top:22px">',
      '<button class="fv2-tab active" data-tab="transactions"',
        ' onclick="window._fv2Tab(\'transactions\',this)">',
        '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
        ' Transaksi</button>',
      '<button class="fv2-tab" data-tab="revenue"',
        ' onclick="window._fv2Tab(\'revenue\',this)">',
        '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>',
        ' Revenue Produk</button>',
      '<button class="fv2-tab" data-tab="cashflow"',
        ' onclick="window._fv2Tab(\'cashflow\',this)">',
        '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
        ' Cashflow Bulanan</button>',
      '<button class="fv2-tab" data-tab="setup"',
        ' onclick="window._fv2Tab(\'setup\',this)">',
        '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
        ' Setup DB</button>',
    '</div>',

    /* ════ TAB: Transaksi ════ */
    '<div class="fv2-tab-panel active" id="fv2-panel-transactions">',
      '<div class="fv2-actions" style="margin-top:14px">',
        '<button class="fv2-btn fv2-btn-in"',
          ' onclick="if(typeof window.financeV2ShowForm===\'function\')window.financeV2ShowForm(\'income\')">',
          '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">',
            '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
          '</svg>Pemasukan</button>',
        '<button class="fv2-btn fv2-btn-out"',
          ' onclick="if(typeof window.financeV2ShowForm===\'function\')window.financeV2ShowForm(\'expense\')">',
          '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">',
            '<line x1="5" y1="12" x2="19" y2="12"/>',
          '</svg>Pengeluaran</button>',
        '<button class="fv2-btn fv2-btn-don"',
          ' onclick="if(typeof window.financeV2ShowForm===\'function\')window.financeV2ShowForm(\'donation\')">',
          '♦ Donasi</button>',
        '<button class="fv2-btn fv2-btn-tr"',
          ' onclick="if(typeof window.financeV2ShowForm===\'function\')window.financeV2ShowForm(\'transfer\')">',
          '⇄ Transfer</button>',
        '<button class="fv2-btn fv2-btn-adj"',
          ' onclick="if(typeof window.financeV2ShowForm===\'function\')window.financeV2ShowForm(\'adjustment\')">',
          '⚙ Penyesuaian</button>',
        '<button class="fv2-btn fv2-btn-exp" style="margin-left:auto"',
          ' onclick="if(typeof window.financeV2Export===\'function\')window.financeV2Export()">',
          '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">',
            '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>',
            '<polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
          '</svg>Export Excel</button>',
      '</div>',

      '<div class="fv2-filter-bar">',
        '<label>Tipe:</label>',
        '<select id="fv2-filter-type" onchange="if(typeof window.financeV2LoadList===\'function\')window.financeV2LoadList()">',
          '<option value="">Semua Tipe</option>',
          '<option value="income">Pemasukan</option>',
          '<option value="expense">Pengeluaran</option>',
          '<option value="donation">Donasi</option>',
          '<option value="transfer">Transfer</option>',
          '<option value="adjustment">Penyesuaian</option>',
        '</select>',
        '<label>Kategori:</label>',
        '<select id="fv2-filter-cat" onchange="if(typeof window.financeV2LoadList===\'function\')window.financeV2LoadList()">',
          '<option value="">Semua Kategori</option>',
          '<option value="shop">Toko</option>',
          '<option value="sponsorship">Sponsorship</option>',
          '<option value="event">Event</option>',
          '<option value="server">Server</option>',
          '<option value="operational">Operasional</option>',
          '<option value="plugin">Plugin/Tools</option>',
          '<option value="content">Konten</option>',
          '<option value="donation">Donasi</option>',
          '<option value="misc">Lainnya</option>',
        '</select>',
        '<input id="fv2-search" placeholder="🔍 Cari keterangan..." oninput="if(typeof window.financeV2LoadList===\'function\')window.financeV2LoadList()" style="min-width:150px">',
        '<label>Dari:</label>',
        '<input type="date" id="fv2-from" onchange="if(typeof window.financeV2LoadList===\'function\')window.financeV2LoadList()">',
        '<label>Sampai:</label>',
        '<input type="date" id="fv2-to" onchange="if(typeof window.financeV2LoadList===\'function\')window.financeV2LoadList()">',
        '<button class="btn-ghost" style="font-size:11px;padding:5px 10px" onclick="if(typeof window.financeV2LoadList===\'function\')window.financeV2LoadList()">',
          '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">',
            '<polyline points="23 4 23 10 17 10"/>',
            '<path d="M20.49 15a9 9 0 1 1-.08-5.96"/>',
          '</svg> Refresh</button>',
      '</div>',

      '<div id="fv2-list"><div class="empty-state">Pilih periode dan klik Refresh.</div></div>',

      '<div class="fv2-pagination" id="fv2-pagination" style="display:none">',
        '<span style="font-size:12px;color:var(--text-faint)" id="fv2-pg-info"></span>',
        '<div class="fv2-pg-btns">',
          '<button class="fv2-pg-btn" id="fv2-pg-prev" onclick="if(typeof window.financeV2PgPrev===\'function\')window.financeV2PgPrev()">← Prev</button>',
          '<button class="fv2-pg-btn" id="fv2-pg-next" onclick="if(typeof window.financeV2PgNext===\'function\')window.financeV2PgNext()">Next →</button>',
        '</div>',
      '</div>',
    '</div>',

    /* ════ TAB: Revenue Produk ════ */
    '<div class="fv2-tab-panel" id="fv2-panel-revenue">',
      '<div style="margin-top:14px">',
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px">',
          '<div>',
            '<div style="font-size:14px;font-weight:700;color:var(--text)">Ranking Revenue per Produk</div>',
            '<div style="font-size:12px;color:var(--text-faint);margin-top:2px">Data dari semua pesanan selesai</div>',
          '</div>',
          '<select id="fv2-rev-period" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:6px 10px;font-size:12px;outline:none;font-family:inherit" onchange="if(typeof window._fv2LoadRevenue===\'function\')window._fv2LoadRevenue()">',
            '<option value="all">Semua Waktu</option>',
            '<option value="month" selected>Bulan Ini</option>',
            '<option value="week">7 Hari Terakhir</option>',
            '<option value="today">Hari Ini</option>',
          '</select>',
        '</div>',
        '<div id="fv2-rev-table" style="margin-top:10px"><div class="empty-state">Memuat data revenue...</div></div>',
      '</div>',
    '</div>',

    '<div class="fv2-tab-panel" id="fv2-panel-cashflow">',
      '<div style="margin-top:14px" id="fv2-cashflow"><div class="empty-state">Memuat cashflow bulanan...</div></div>',
    '</div>',

    '<div class="fv2-tab-panel" id="fv2-panel-setup">',
      '<div class="card" style="margin-top:14px">',
        '<div class="card-header"><div class="card-title">Setup Tabel Database</div></div>',
        '<div style="padding:16px">',
          '<p style="font-size:13px;color:var(--text-muted);margin-bottom:14px;line-height:1.65">',
            'Jika tabel <code style="background:var(--surface2);padding:1px 5px;border-radius:4px;font-size:11.5px">finance_transactions</code> belum ada, jalankan SQL berikut di Supabase SQL Editor.',
          '</p>',
          '<button class="save-btn" onclick="if(typeof window.financeV2SetupDB===\'function\')window.financeV2SetupDB()">Lihat SQL Setup</button>',
          '<div id="fv2-sql-box" style="display:none;margin-top:16px">',
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">',
              '<span style="font-size:12px;font-weight:600;color:var(--text-muted)">SQL Setup</span>',
              '<button class="btn-ghost" style="font-size:11px;padding:4px 10px" onclick="if(typeof window.financeV2CopySQL===\'function\')window.financeV2CopySQL()">Copy SQL</button>',
            '</div>',
            '<pre id="fv2-sql-code" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:14px;font-size:11.5px;overflow-x:auto;color:var(--text);white-space:pre-wrap;font-family:var(--mono);line-height:1.6"></pre>',
          '</div>',
        '</div>',
      '</div>',
    '</div>',

    '<div class="fv2-modal-overlay" id="fv2-modal" style="display:none" onclick="if(event.target===this&&typeof window.financeV2CloseModal===\'function\')window.financeV2CloseModal()">',
      '<div class="fv2-modal">',
        '<div class="fv2-modal-header">',
          '<span class="fv2-modal-title" id="fv2-modal-title">Tambah Transaksi</span>',
          '<button class="fv2-modal-close" onclick="if(typeof window.financeV2CloseModal===\'function\')window.financeV2CloseModal()">×</button>',
        '</div>',
        '<div class="fv2-modal-body">',
          '<input type="hidden" id="fv2-form-type">',
          '<div class="field" style="margin-bottom:12px">',
            '<label>Nominal (Rp) <span style="color:var(--red)">*</span></label>',
            '<input id="fv2-form-amount" type="number" min="0" placeholder="0" style="width:100%;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:8px 11px;color:var(--text);font-size:13px;outline:none">',
          '</div>',
          '<div class="field" style="margin-bottom:12px">',
            '<label>Kategori</label>',
            '<select id="fv2-form-cat" style="width:100%;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:8px 11px;color:var(--text);font-size:13px;outline:none;font-family:inherit"></select>',
          '</div>',
          '<div class="field" style="margin-bottom:12px">',
            '<label>Keterangan</label>',
            '<input id="fv2-form-note" placeholder="Catatan singkat transaksi..." style="width:100%;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:8px 11px;color:var(--text);font-size:13px;outline:none">',
          '</div>',
          '<div class="field" style="margin-bottom:12px">',
            '<label id="fv2-ref-label">Referensi (opsional)</label>',
            '<input id="fv2-form-ref" placeholder="ID Order / nama donatur..." style="width:100%;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:8px 11px;color:var(--text);font-size:13px;outline:none">',
          '</div>',
          '<div class="field">',
            '<label>Tanggal Transaksi</label>',
            '<input id="fv2-form-date" type="date" style="width:100%;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:8px 11px;color:var(--text);font-size:13px;outline:none;color-scheme:dark">',
          '</div>',
        '</div>',
        '<div class="fv2-modal-footer">',
          '<button class="btn-ghost" onclick="if(typeof window.financeV2CloseModal===\'function\')window.financeV2CloseModal()">Batal</button>',
          '<button class="save-btn" id="fv2-submit-btn" onclick="if(typeof window.financeV2Submit===\'function\')window.financeV2Submit()">Simpan Transaksi</button>',
        '</div>',
      '</div>',
    '</div>',
  ].join('');

  window._fv2Tab = function (tab, btn) {
    var root = document.getElementById('fv2-root');
    if (!root) return;
    root.querySelectorAll('.fv2-tab').forEach(function (b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    root.querySelectorAll('.fv2-tab-panel').forEach(function (p) { p.classList.remove('active'); });
    var panel = document.getElementById('fv2-panel-' + tab);
    if (panel) panel.classList.add('active');
    if (tab === 'cashflow' && typeof window.financeV2LoadCashflow === 'function') {
      window.financeV2LoadCashflow();
    }
    if (tab === 'revenue' && typeof window._fv2LoadRevenue === 'function') {
      window._fv2LoadRevenue();
    }
  };

  function injectRoot() {
    var root = document.getElementById('fv2-root');
    if (!root || root.dataset.fv2Injected) return;
    root.dataset.fv2Injected = '1';
    root.innerHTML = FINANCE_HTML;
    bindListeners();
  }

  function bindListeners() {
    var periodEl = document.getElementById('fv2-period');
    if (periodEl) {
      periodEl.addEventListener('change', function () {
        var period = this.value;
        if (typeof window.financeV2LoadSummary === 'function') window.financeV2LoadSummary(period);
        if (typeof window.financeV2Init === 'function') window.financeV2Init();
      });
    }

    var exportBtn = document.getElementById('fv2-export-btn');
    if (exportBtn && !exportBtn.dataset.fv2Bound) {
      exportBtn.dataset.fv2Bound = '1';
      exportBtn.addEventListener('click', function () {
        if (typeof window.financeV2Export === 'function') window.financeV2Export();
      });
    }

    var monthEl = document.getElementById('finance-month');
    if (monthEl && !monthEl.dataset.fv2Bound) {
      monthEl.dataset.fv2Bound = '1';
      monthEl.addEventListener('change', function () {
        if (typeof window.financeV2LoadList === 'function') window.financeV2LoadList();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectRoot);
  } else {
    injectRoot();
  }

  window._fv2Inject = injectRoot;

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      var origShow = window.showSection;
      if (origShow && !origShow._fv2Hooked) {
        window.showSection = function (name, el) {
          origShow(name, el);
          if (name === 'finance-v2') {
            injectRoot();
            setTimeout(function () {
              if (typeof window._fv2PlayerRefresh === 'function') window._fv2PlayerRefresh();
            }, 200);
          }
        };
        window.showSection._fv2Hooked = true;
      }
    }, 200);
  });

  /* ════════════════════════════════════════════════════════════════
     Revenue per Product — loads from orders (status=selesai)
  ════════════════════════════════════════════════════════════════ */
  window._fv2LoadRevenue = async function () {
    var tableEl = document.getElementById('fv2-rev-table');
    if (!tableEl) return;
    tableEl.innerHTML = '<div class="empty-state">Memuat data revenue...</div>';

    var sb = window._adminSb;
    if (!sb) { tableEl.innerHTML = '<div class="empty-state">Supabase belum siap.</div>'; return; }

    var periodEl = document.getElementById('fv2-rev-period');
    var period = periodEl ? periodEl.value : 'month';

    var query = sb.from('orders').select('item_name,qty,total_price,created_at').eq('status', 'selesai');

    // Date filter
    var now = new Date();
    if (period === 'today') {
      var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      query = query.gte('created_at', todayStart);
    } else if (period === 'week') {
      var weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
      query = query.gte('created_at', weekAgo);
    } else if (period === 'month') {
      var monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      query = query.gte('created_at', monthStart);
    }
    // 'all' = no date filter

    var { data: orders, error } = await query;
    if (error) { tableEl.innerHTML = '<div class="empty-state">Gagal memuat: ' + error.message + '</div>'; return; }
    if (!orders || orders.length === 0) { tableEl.innerHTML = '<div class="empty-state">Belum ada pesanan selesai di periode ini.</div>'; return; }

    // Aggregate
    var map = {};
    orders.forEach(function (o) {
      var name = o.item_name || 'Unknown';
      if (!map[name]) map[name] = { revenue: 0, qty: 0, count: 0 };
      map[name].revenue += Number(o.total_price) || 0;
      map[name].qty += Number(o.qty) || 1;
      map[name].count++;
    });

    var list = Object.keys(map).map(function (name) {
      return { name: name, revenue: map[name].revenue, qty: map[name].qty, count: map[name].count };
    });
    list.sort(function (a, b) { return b.revenue - a.revenue; });

    var maxRev = list[0] ? list[0].revenue : 1;
    var totalRev = list.reduce(function (s, i) { return s + i.revenue; }, 0);
    var totalQty = list.reduce(function (s, i) { return s + i.qty; }, 0);

    var fmt = function (n) { return 'Rp ' + Number(n).toLocaleString('id-ID'); };

    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:16px">';
    html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px">';
    html += '<div style="font-size:11px;color:var(--text-faint);margin-bottom:4px">Total Revenue</div>';
    html += '<div style="font-size:18px;font-weight:700;color:#34d399">' + fmt(totalRev) + '</div>';
    html += '</div>';
    html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px">';
    html += '<div style="font-size:11px;color:var(--text-faint);margin-bottom:4px">Total Terjual</div>';
    html += '<div style="font-size:18px;font-weight:700;color:var(--accent)">' + totalQty + ' item</div>';
    html += '</div>';
    html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px">';
    html += '<div style="font-size:11px;color:var(--text-faint);margin-bottom:4px">Produk Unik</div>';
    html += '<div style="font-size:18px;font-weight:700;color:var(--text)">' + list.length + '</div>';
    html += '</div>';
    html += '</div>';

    html += '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;touch-action:pan-x"><table style="width:100%;border-collapse:collapse;font-size:13px;min-width:520px">';
    html += '<thead><tr style="border-bottom:2px solid var(--border);text-align:left">';
    html += '<th style="padding:10px 8px;color:var(--text-faint);font-size:11px;font-weight:600">#</th>';
    html += '<th style="padding:10px 8px;color:var(--text-faint);font-size:11px;font-weight:600">Produk</th>';
    html += '<th style="padding:10px 8px;color:var(--text-faint);font-size:11px;font-weight:600;text-align:right">Revenue</th>';
    html += '<th style="padding:10px 8px;color:var(--text-faint);font-size:11px;font-weight:600;text-align:center">Terjual</th>';
    html += '<th style="padding:10px 8px;color:var(--text-faint);font-size:11px;font-weight:600;text-align:right">Rata-rata</th>';
    html += '<th style="padding:10px 8px;color:var(--text-faint);font-size:11px;font-weight:600;min-width:120px">Proporsi</th>';
    html += '</tr></thead><tbody>';

    list.forEach(function (item, i) {
      var pct = totalRev > 0 ? ((item.revenue / totalRev) * 100).toFixed(1) : '0';
      var barW = maxRev > 0 ? Math.round((item.revenue / maxRev) * 100) : 0;
      var avg = item.count > 0 ? Math.round(item.revenue / item.count) : 0;

      var medal = '';
      if (i === 0) medal = '<span style="color:#fbbf24;font-weight:700">1</span>';
      else if (i === 1) medal = '<span style="color:#94a3b8;font-weight:700">2</span>';
      else if (i === 2) medal = '<span style="color:#d97706;font-weight:700">3</span>';
      else medal = '<span style="color:var(--text-faint)">' + (i + 1) + '</span>';

      html += '<tr style="border-bottom:1px solid var(--border)">';
      html += '<td style="padding:10px 8px">' + medal + '</td>';
      html += '<td style="padding:10px 8px;font-weight:600;color:var(--text)">' + item.name + '</td>';
      html += '<td style="padding:10px 8px;text-align:right;font-weight:600;color:#34d399">' + fmt(item.revenue) + '</td>';
      html += '<td style="padding:10px 8px;text-align:center;color:var(--text-muted)">' + item.qty + 'x <span style="font-size:11px;color:var(--text-faint)">(' + item.count + ' order)</span></td>';
      html += '<td style="padding:10px 8px;text-align:right;color:var(--text-muted)">' + fmt(avg) + '</td>';
      html += '<td style="padding:10px 8px">';
      html += '<div style="display:flex;align-items:center;gap:6px">';
      html += '<div style="flex:1;background:var(--surface);border-radius:4px;height:6px;overflow:hidden">';
      html += '<div style="width:' + barW + '%;height:100%;background:linear-gradient(90deg,#a855f7,#7c3aed);border-radius:4px;transition:width .3s"></div>';
      html += '</div>';
      html += '<span style="font-size:11px;color:var(--text-faint);min-width:36px;text-align:right">' + pct + '%</span>';
      html += '</div></td>';
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    tableEl.innerHTML = html;
  };

})();

/* ════════════════════════════════════════════════════════════════
   Player Online Card — FIXED VERSION
   FIX: Tertinggi, Rata-rata, Rekaman, Terakhir dicatat
════════════════════════════════════════════════════════════════ */
(function initFv2Player() {
  'use strict';

  var SERVER_HOST = 'laughtale.my.id';
  var SERVER_PORT = '19214';
  var playerChart = null;
  var _running    = false;

  function getSb() {
    return window._adminSb || null;
  }

  /* ── FIX: Update mini stats — sertakan live value dalam kalkulasi peak ── */
  function _updateMiniStats(live, snapshots) {
    /* Sekarang */
    var curEl = document.getElementById('fv2-pmini-current');
    if (curEl) curEl.textContent = (live !== null && live !== undefined) ? String(live) : '—';

    var liveNum = (live !== null && live !== undefined) ? Number(live) : null;

    if (!snapshots || !snapshots.length) {
      var peakEl0  = document.getElementById('fv2-pmini-peak');
      var avgEl0   = document.getElementById('fv2-pmini-avg');
      var countEl0 = document.getElementById('fv2-pmini-count');
      if (peakEl0)  peakEl0.textContent  = liveNum !== null ? String(liveNum) : '0';
      if (avgEl0)   avgEl0.textContent   = liveNum !== null ? String(liveNum) : '0';
      if (countEl0) countEl0.textContent = '0';
      return;
    }

    var counts = snapshots.map(function (s) { return Number(s.player_count) || 0; });

    /* FIX: Sertakan live value saat menghitung peak */
    var allForPeak = liveNum !== null ? counts.concat([liveNum]) : counts;
    var peak  = Math.max.apply(null, allForPeak);
    var avg   = Math.round(counts.reduce(function (a, b) { return a + b; }, 0) / counts.length);
    var total = snapshots.length;

    var peakEl  = document.getElementById('fv2-pmini-peak');
    var avgEl   = document.getElementById('fv2-pmini-avg');
    var countEl = document.getElementById('fv2-pmini-count');

    if (peakEl)  peakEl.textContent  = peak;
    if (avgEl)   avgEl.textContent   = avg;
    if (countEl) countEl.textContent = total;
  }

  /* ── Fetch live player count ── */
  function fetchLivePlayers() {
    return fetch(
      'https://api.mcsrvstat.us/bedrock/3/' + SERVER_HOST + ':' + SERVER_PORT,
      { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined }
    )
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.online) return 0;
        return (d.players && typeof d.players.online === 'number') ? d.players.online : 0;
      })
      .catch(function () { return null; });
  }

  /* ── Fetch snapshot (DEPRECATED — tabel player_snapshots di-drop) ──
   * Stub: return array kosong. Kartu player tetap berfungsi via
   * fetchLivePlayers() dari API mcsrvstat. Chart hanya tampil jika
   * ada data snapshot, jadi ini efektif menonaktifkan chart historis
   * tanpa merusak UI lainnya.
   */
  function loadPlayerSnapshots() {
    return Promise.resolve([]);
  }

  /* ── Destroy chart lama ── */
  function destroyChart() {
    var canvas = document.getElementById('fv2-player-chart');
    try { if (playerChart) playerChart.destroy(); } catch (e) {}
    playerChart = null;
    try {
      if (window.Chart && window.Chart.getChart && canvas) {
        var ex = window.Chart.getChart(canvas);
        if (ex) ex.destroy();
      }
    } catch (e) {}
  }

  /* ── Render line chart snapshot ── */
  function renderChart(snapshots) {
    var canvas = document.getElementById('fv2-player-chart');
    if (!canvas || !window.Chart) return;
    destroyChart();

    var labels = snapshots.map(function (d) {
      return new Date(d.recorded_at).toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit'
      });
    });
    var values = snapshots.map(function (d) { return d.player_count; });

    var ctx      = canvas.getContext('2d');
    var gradient = ctx.createLinearGradient(0, 0, 0, 130);
    gradient.addColorStop(0, 'rgba(74,143,255,0.30)');
    gradient.addColorStop(1, 'rgba(74,143,255,0.00)');

    playerChart = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          borderColor: '#4a8fff',
          backgroundColor: gradient,
          borderWidth: 2,
          pointRadius: snapshots.length > 30 ? 0 : 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#4a8fff',
          pointBorderColor: 'rgba(11,16,24,0.8)',
          pointBorderWidth: 1,
          fill: true,
          tension: 0.4,
          spanGaps: true,
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
            borderColor: 'rgba(74,143,255,0.3)',
            borderWidth: 1,
            titleColor: '#94adff',
            bodyColor: '#dde3ec',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              title: function (items) {
                if (!items[0]) return '';
                var d = new Date(snapshots[items[0].dataIndex].recorded_at);
                return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
              },
              label: function (item) { return '  ' + item.raw + ' pemain online'; }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: {
              color: '#3a4458',
              font: { size: 9 },
              maxTicksLimit: 6,
              maxRotation: 0
            },
            border: { color: 'rgba(255,255,255,0.05)' }
          },
          y: {
            beginAtZero: true,
            min: 0,
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: {
              color: '#3a4458',
              font: { size: 9 },
              stepSize: 1,
              precision: 0,
              callback: function (v) { return v % 1 === 0 ? v : ''; }
            },
            border: { color: 'rgba(255,255,255,0.05)' }
          }
        }
      }
    });
  }

  /* ── Update status dot & label ── */
  function _updateStatusDisplay(live) {
    var numEl   = document.getElementById('fv2-player-num');
    var labelEl = document.getElementById('fv2-player-label');
    var dotEl   = document.getElementById('fv2-player-dot');

    if (numEl) numEl.textContent = (live !== null && live !== undefined) ? String(live) : '—';

    if (labelEl) {
      if (live === null) {
        labelEl.textContent = 'gagal memuat status';
      } else if (live > 0) {
        labelEl.textContent = 'pemain online sekarang';
      } else {
        labelEl.textContent = 'server kosong / offline';
      }
    }

    if (dotEl) {
      dotEl.classList.remove('online', 'offline');
      if (live !== null && live > 0) {
        dotEl.classList.add('online');
      } else {
        dotEl.classList.add('offline');
      }
    }
  }

  /* ── FIX: Update label "Terakhir dicatat" dengan format lebih bersih ── */
  function _updateLastRecordedLabel(snapshots) {
    var nextEl = document.getElementById('fv2-player-next-update');
    if (!nextEl) return;

    if (!snapshots || !snapshots.length) return;

    var last = snapshots[snapshots.length - 1];
    var dt   = new Date(last.recorded_at);
    var dtStr = dt.toLocaleString('id-ID', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    }).replace(/\./g, ':');

    nextEl.innerHTML =
      '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="opacity:.5;flex-shrink:0">' +
        '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' +
      '</svg>' +
      ' Auto-catat dalam <strong id="fv2-next-countdown" style="color:var(--accent);font-variant-numeric:tabular-nums">—</strong>' +
      ' &nbsp;·&nbsp; Dicatat: <span style="color:var(--text-muted)">' + dtStr + '</span>';
  }

  /* ── Refresh seluruh kartu player ── */
  function refreshPlayerCard() {
    if (_running) return;
    _running = true;

    Promise.all([fetchLivePlayers(), loadPlayerSnapshots()])
      .then(function (results) {
        var live      = results[0];
        var snapshots = Array.isArray(results[1]) ? results[1] : [];

        /* Update status + dot */
        _updateStatusDisplay(live);

        /* FIX: Update mini stats dengan live value disertakan */
        _updateMiniStats(live, snapshots);

        /* Render chart */
        if (snapshots.length) {
          renderChart(snapshots);
        }

        /* Update label "Terakhir dicatat" */
        _updateLastRecordedLabel(snapshots);
      })
      .catch(function (e) {
        console.warn('[fv2-player] refreshPlayerCard error:', e);
      })
      .finally(function () { _running = false; });
  }

  /* ── Tombol Catat (DEPRECATED) ──
   * Player snapshots system removed — duplikat dengan metrics_history.online_players.
   * Stub jadi no-op untuk handle stale onclick yang mungkin masih ada di session lama.
   */
  window.financeV2RecordPlayer = function () {
    if (typeof window.showAdminToast === 'function') {
      window.showAdminToast('Fitur Player Online dipindah ke /monitor.html', 'success');
    }
  };

  /* ── _fv2PlayerRefresh stub (DEPRECATED) ── */
  window._fv2PlayerRefresh = function () { /* no-op */ };

  /* Original financeV2RecordPlayer body removed (player_snapshots tabel di-drop).
   * Stub di atas handle stale onclick. */

  /* ── Auto-init ── */
  function tryAutoInit() {
    if (document.getElementById('fv2-player-chart')) {
      refreshPlayerCard();
      return true;
    }
    return false;
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!tryAutoInit()) {
      var attempts = 0;
      var iv = setInterval(function () {
        attempts++;
        if (tryAutoInit() || attempts >= 20) clearInterval(iv);
      }, 300);
    }
  });

  /* ── Auto-refresh tiap 5 menit ── */
  setInterval(function () {
    if (document.getElementById('fv2-player-chart')) refreshPlayerCard();
  }, 5 * 60 * 1000);

})();
