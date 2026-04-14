/* ═══════════════════════════════════════════════════════════
   admin-finance.js  —  Advanced Finance Management
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

  /* ── Private State ── */
  var _finSub = null;

  /* ── Internal: Toast ── */
  function _finToast(msg, type) {
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

  /* ══════════════════════════════════════════════════════════
     1. INIT / DESTROY
     ══════════════════════════════════════════════════════════ */
  window.financeV2Init = async function () {
    await Promise.all([
      window.financeV2LoadSummary(),
      window.financeV2LoadList()
    ]);
    _finSubscribeRealtime();
  };

  window.financeV2Destroy = function () {
    if (_finSub) {
      try { _finSub.unsubscribe(); } catch (e) { /* noop */ }
      _finSub = null;
    }
  };

  /* ══════════════════════════════════════════════════════════
     2. SUMMARY CARDS
     ══════════════════════════════════════════════════════════ */
  window.financeV2LoadSummary = async function (period) {
    period = period || (document.getElementById('fv2-period') && document.getElementById('fv2-period').value) || 'month';
    var now = new Date();
    var from = null;

    if (period === 'today') {
      from = _today() + 'T00:00:00';
    } else if (period === 'week') {
      var d = new Date(now);
      d.setDate(d.getDate() - 6);
      from = d.toISOString().split('T')[0] + 'T00:00:00';
    } else if (period === 'month') {
      from = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01T00:00:00';
    } else if (period === 'year') {
      from = now.getFullYear() + '-01-01T00:00:00';
    }

    var q = sb.from('finance_transactions').select('type,amount');
    if (from) q = q.gte('created_at', from);

    var result = await q;
    if (result.error) {
      console.warn('[Finance] summary error:', result.error.message);
      _finShowTableError();
      return;
    }

    var totalIn = 0, totalOut = 0, totalDon = 0;
    (result.data || []).forEach(function (r) {
      var a = Number(r.amount) || 0;
      if (r.type === 'income')                              totalIn  += a;
      if (r.type === 'expense' || r.type === 'transfer')    totalOut += a;
      if (r.type === 'donation')                            { totalIn += a; totalDon += a; }
    });
    var balance = totalIn - totalOut;

    _setSum('fv2-sum-in',  _fmtShort(totalIn));
    _setSum('fv2-sum-out', _fmtShort(totalOut));
    _setSum('fv2-sum-don', _fmtShort(totalDon));
    _setSum('fv2-sum-bal', _fmtShort(balance), balance >= 0 ? 'pos' : 'neg');
  };

  /* ══════════════════════════════════════════════════════════
     3. TRANSACTION LIST
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

    var q = sb.from('finance_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (typeF) q = q.eq('type', typeF);
    if (catF)  q = q.eq('category', catF);
    if (fromF) q = q.gte('created_at', fromF + 'T00:00:00');
    if (toF)   q = q.lte('created_at', toF   + 'T23:59:59');

    var result = await q;
    if (result.error) {
      container.innerHTML = '<div class="empty-state" style="color:#f87171">' + _esc(result.error.message) + '</div>';
      return;
    }

    var rows = result.data || [];
    if (searchF) {
      var kw = searchF.toLowerCase();
      rows = rows.filter(function (r) {
        return (r.note       || '').toLowerCase().includes(kw) ||
               (r.reference  || '').toLowerCase().includes(kw) ||
               (r.category   || '').toLowerCase().includes(kw) ||
               (r.recorded_by|| '').toLowerCase().includes(kw);
      });
    }

    if (!rows.length) {
      container.innerHTML = '<div class="empty-state">Tidak ada transaksi ditemukan.</div>';
      return;
    }

    var typeIcon  = { income: '💰', expense: '💸', donation: '🎁', transfer: '🔄', adjustment: '⚙️' };
    var typeColor = { income: 'var(--green)', expense: '#f87171', donation: '#a78bfa', transfer: '#60a5fa', adjustment: '#fbbf24' };
    var typeLbl   = { income: 'Pemasukan', expense: 'Pengeluaran', donation: 'Donasi', transfer: 'Transfer', adjustment: 'Penyesuaian' };

    var rowsHtml = rows.map(function (r) {
      var isOut  = r.type === 'expense' || r.type === 'transfer';
      var dt     = new Date(r.created_at);
      var dtStr  = dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
                   ' ' + dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      var color  = typeColor[r.type] || '#888';
      var refHtml = r.reference
        ? '<br><span style="font-size:11px;color:var(--text-faint)">ref: ' + _esc(r.reference) + '</span>'
        : '';
      return '<tr>' +
        '<td style="white-space:nowrap;font-size:12px;color:var(--text-faint)">' + dtStr + '</td>' +
        '<td><span class="fv2-type-badge" style="color:' + color + ';background:' + color + '22">' +
          (typeIcon[r.type] || '•') + ' ' + (typeLbl[r.type] || r.type) + '</span></td>' +
        '<td><span class="fv2-cat-badge">' + _esc(r.category) + '</span></td>' +
        '<td style="font-weight:700;color:' + (isOut ? '#f87171' : 'var(--green)') + ';white-space:nowrap">' +
          (isOut ? '-' : '+') + ' ' + _fmt(r.amount) + '</td>' +
        '<td style="font-size:12.5px;max-width:260px">' + _esc(r.note || '—') + refHtml + '</td>' +
        '<td style="font-size:12px;color:var(--text-faint)">' + _esc(r.recorded_by || '—') + '</td>' +
        '<td><button class="fv2-del-btn" onclick="financeV2Delete(\'' + r.id + '\')" title="Hapus">' +
          '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' +
          '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>' +
          '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>' +
          '</svg></button></td>' +
        '</tr>';
    }).join('');

    container.innerHTML =
      '<div class="fv2-table-wrap">' +
        '<table class="fv2-table">' +
          '<thead><tr>' +
            '<th>Tanggal</th><th>Tipe</th><th>Kategori</th>' +
            '<th>Nominal</th><th>Catatan / Referensi</th><th>Oleh</th><th></th>' +
          '</tr></thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
        '</table>' +
      '</div>';
  };

  /* ══════════════════════════════════════════════════════════
     4. SHOW FORM MODAL
     ══════════════════════════════════════════════════════════ */
  window.financeV2ShowForm = function (type) {
    var modal    = document.getElementById('fv2-modal');
    var titleEl  = document.getElementById('fv2-modal-title');
    var typeInput= document.getElementById('fv2-form-type');
    var catSel   = document.getElementById('fv2-form-cat');

    var titles = {
      income: 'Tambah Pemasukan', expense: 'Tambah Pengeluaran',
      donation: 'Catat Donasi', transfer: 'Catat Transfer', adjustment: 'Penyesuaian Saldo'
    };
    var catOptions = {
      income:     ['shop', 'sponsorship', 'event', 'misc'],
      expense:    ['server', 'operational', 'plugin', 'content', 'misc'],
      donation:   ['donation'],
      transfer:   ['bank', 'ewallet', 'misc'],
      adjustment: ['correction', 'misc']
    };
    var catLabels = {
      shop: 'Toko', sponsorship: 'Sponsorship', event: 'Event', misc: 'Lainnya',
      server: 'Server', operational: 'Operasional', plugin: 'Plugin/Tools',
      content: 'Konten', bank: 'Bank', ewallet: 'E-Wallet',
      donation: 'Donasi', correction: 'Koreksi'
    };

    titleEl.textContent  = titles[type] || 'Tambah Transaksi';
    typeInput.value      = type;
    catSel.innerHTML     = (catOptions[type] || ['misc']).map(function (c) {
      return '<option value="' + c + '">' + (catLabels[c] || c) + '</option>';
    }).join('');

    ['fv2-form-amount', 'fv2-form-note', 'fv2-form-ref', 'fv2-form-date'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = (id === 'fv2-form-date') ? _today() : '';
    });

    var refLabel = document.getElementById('fv2-ref-label');
    if (refLabel) {
      refLabel.textContent = type === 'donation' ? 'Nama Donatur'
        : type === 'income' ? 'ID Order (opsional)'
        : 'Referensi (opsional)';
    }

    modal.style.display = 'flex';
    setTimeout(function () { modal.classList.add('open'); }, 10);
    var amtEl = document.getElementById('fv2-form-amount');
    if (amtEl) amtEl.focus();
  };

  window.financeV2CloseModal = function () {
    var modal = document.getElementById('fv2-modal');
    modal.classList.remove('open');
    setTimeout(function () { modal.style.display = 'none'; }, 280);
  };

  /* ══════════════════════════════════════════════════════════
     5. SUBMIT TRANSACTION
     ══════════════════════════════════════════════════════════ */
  window.financeV2Submit = async function () {
    var btn      = document.getElementById('fv2-submit-btn');
    var type     = document.getElementById('fv2-form-type').value;
    var cat      = document.getElementById('fv2-form-cat').value;
    var amount   = parseFloat(document.getElementById('fv2-form-amount').value);
    var note     = document.getElementById('fv2-form-note').value.trim();
    var ref      = document.getElementById('fv2-form-ref').value.trim();
    var dateVal  = document.getElementById('fv2-form-date').value;

    if (!amount || amount <= 0) {
      _finToast('Nominal harus diisi dan lebih dari 0', 'error');
      return;
    }

    var adminName = (document.getElementById('topbar-email') || {}).textContent || 'admin';
    btn.disabled  = true;
    btn.textContent = 'Menyimpan...';

    var payload = {
      type:        type,
      category:    cat,
      amount:      amount,
      note:        note || null,
      reference:   ref  || null,
      recorded_by: adminName,
      created_at:  dateVal
        ? dateVal + 'T' + new Date().toTimeString().slice(0, 8)
        : _nowTs()
    };

    var result = await sb.from('finance_transactions').insert([payload]);
    btn.disabled    = false;
    btn.textContent = 'Simpan Transaksi';

    if (result.error) {
      _finToast('Gagal: ' + result.error.message, 'error');
      return;
    }

    _finToast('Transaksi berhasil dicatat ✓', 'success');
    window.financeV2CloseModal();
    await Promise.all([window.financeV2LoadSummary(), window.financeV2LoadList()]);
  };

  /* ══════════════════════════════════════════════════════════
     6. DELETE
     ══════════════════════════════════════════════════════════ */
  window.financeV2Delete = async function (id) {
    if (!confirm('Hapus transaksi ini?')) return;
    var result = await sb.from('finance_transactions').delete().eq('id', id);
    if (result.error) {
      _finToast('Gagal hapus: ' + result.error.message, 'error');
      return;
    }
    _finToast('Dihapus.', 'success');
    await Promise.all([window.financeV2LoadSummary(), window.financeV2LoadList()]);
  };

  /* ══════════════════════════════════════════════════════════
     7. REALTIME  — pakai object config baru (non-deprecated)
     ══════════════════════════════════════════════════════════ */
  function _finSubscribeRealtime() {
    if (_finSub) return;
    try {
      _finSub = sb
        .channel('finance-rt-v2')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'finance_transactions' },
          function () {
            Promise.all([window.financeV2LoadSummary(), window.financeV2LoadList()]);
          }
        )
        .subscribe(function (status) {
          if (status === 'SUBSCRIBED') {
            console.log('[Finance RT] realtime connected');
          }
        });
    } catch (e) {
      console.warn('[Finance RT]', e);
    }
  }

  /* ══════════════════════════════════════════════════════════
     8. CASHFLOW MONTHLY REPORT
     ══════════════════════════════════════════════════════════ */
  window.financeV2LoadCashflow = async function () {
    var container = document.getElementById('fv2-cashflow');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Memuat...</div>';

    var result = await sb.from('finance_transactions')
      .select('type,amount,created_at')
      .order('created_at', { ascending: true });

    if (result.error) {
      container.innerHTML = '<div class="empty-state" style="color:#f87171">' + _esc(result.error.message) + '</div>';
      return;
    }
    if (!result.data || !result.data.length) {
      container.innerHTML = '<div class="empty-state">Belum ada data.</div>';
      return;
    }

    var months = {};
    result.data.forEach(function (r) {
      var m = r.created_at.slice(0, 7);
      if (!months[m]) months[m] = { in: 0, out: 0, don: 0 };
      var a = Number(r.amount) || 0;
      if (r.type === 'income')                            months[m].in  += a;
      if (r.type === 'donation')                          { months[m].in += a; months[m].don += a; }
      if (r.type === 'expense' || r.type === 'transfer')  months[m].out += a;
    });

    var keys   = Object.keys(months).sort();
    var runBal = 0;
    var rowsHtml = keys.map(function (m) {
      var row  = months[m];
      var flow = row.in - row.out;
      runBal  += flow;
      var parts = m.split('-');
      var label = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1)
        .toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      return '<tr>' +
        '<td style="font-weight:600">'                                             + label          + '</td>' +
        '<td style="color:var(--green);font-weight:600">'                          + _fmt(row.in)   + '</td>' +
        '<td style="color:#a78bfa">'  + (row.don ? _fmt(row.don) : '—')           + '</td>' +
        '<td style="color:#f87171;font-weight:600">'                               + _fmt(row.out)  + '</td>' +
        '<td style="font-weight:700;color:' + (flow   >= 0 ? 'var(--green)' : '#f87171') + '">' +
          (flow >= 0 ? '+' : '') + _fmt(flow)   + '</td>' +
        '<td style="font-weight:700;color:' + (runBal >= 0 ? 'var(--green)' : '#f87171') + '">' +
          _fmt(runBal) + '</td>' +
        '</tr>';
    }).join('');

    container.innerHTML =
      '<div class="fv2-table-wrap">' +
        '<table class="fv2-table">' +
          '<thead><tr>' +
            '<th>Bulan</th><th>Pemasukan</th><th>Donasi</th>' +
            '<th>Pengeluaran</th><th>Cashflow</th><th>Saldo Berjalan</th>' +
          '</tr></thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
        '</table>' +
      '</div>';
  };

  /* ══════════════════════════════════════════════════════════
     9. EXPORT CSV
     ══════════════════════════════════════════════════════════ */
  window.financeV2Export = async function () {
    var result = await sb.from('finance_transactions')
      .select('*').order('created_at', { ascending: false });
    if (result.error || !result.data) {
      _finToast('Gagal export', 'error');
      return;
    }

    var headers = ['Tanggal', 'Tipe', 'Kategori', 'Nominal', 'Catatan', 'Referensi', 'Dicatat Oleh'];
    var csvRows = result.data.map(function (r) {
      return [
        new Date(r.created_at).toLocaleString('id-ID'),
        r.type,
        r.category,
        r.amount,
        (r.note        || '').replace(/,/g, ';'),
        (r.reference   || '').replace(/,/g, ';'),
        (r.recorded_by || '')
      ].join(',');
    });

    var csv  = [headers.join(',')].concat(csvRows).join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href     = url;
    a.download = 'keuangan-laughtale-' + _today() + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    _finToast('Export berhasil ✓', 'success');
  };

  /* ══════════════════════════════════════════════════════════
     10. SETUP DB HELPER
     ══════════════════════════════════════════════════════════ */
  window.financeV2SetupDB = function () {
    var sql = [
      "CREATE TABLE IF NOT EXISTS finance_transactions (",
      "  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),",
      "  type         text NOT NULL CHECK (type IN ('income','expense','donation','transfer','adjustment')),",
      "  category     text NOT NULL DEFAULT 'misc',",
      "  amount       numeric NOT NULL,",
      "  note         text,",
      "  reference    text,",
      "  recorded_by  text,",
      "  created_at   timestamptz NOT NULL DEFAULT now()",
      ");",
      "CREATE INDEX IF NOT EXISTS idx_ft_created ON finance_transactions(created_at DESC);",
      "CREATE INDEX IF NOT EXISTS idx_ft_type    ON finance_transactions(type);",
      "-- RLS (opsional)",
      "-- ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;"
    ].join('\n');

    var box = document.getElementById('fv2-sql-box');
    if (box) {
      box.style.display = 'block';
      document.getElementById('fv2-sql-code').textContent = sql;
    }
  };

  window.financeV2CopySQL = function () {
    var code = (document.getElementById('fv2-sql-code') || {}).textContent;
    if (!code) return;
    navigator.clipboard.writeText(code).then(function () {
      _finToast('SQL disalin ✓', 'success');
    });
  };

})(); /* end IIFE */
