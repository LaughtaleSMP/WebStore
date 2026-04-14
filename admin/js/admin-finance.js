/* ═══════════════════════════════════════════════════════════
   admin-finance.js  —  Advanced Finance Management
   Laughtale SMP Admin Panel
   ═══════════════════════════════════════════════════════════ */

'use strict';

/* ── Helpers ── */
const fmt = n => 'Rp ' + (Number(n)||0).toLocaleString('id-ID');
const fmtShort = n => {
  n = Number(n)||0;
  if (n >= 1_000_000) return 'Rp ' + (n/1_000_000).toFixed(1).replace('.0','') + 'jt';
  if (n >= 1_000)     return 'Rp ' + (n/1_000).toFixed(1).replace('.0','') + 'rb';
  return 'Rp ' + n.toLocaleString('id-ID');
};
const esc = s => { const d=document.createElement('div');d.textContent=s||'';return d.innerHTML; };
const today = () => new Date().toISOString().split('T')[0];
const nowTs  = () => new Date().toISOString();

/* ── State ── */
let _finChart = null;   // reserved for chart canvas if needed
let _finSub   = null;   // realtime subscription

/* ═══════════════════════════════════════════════════════════
   1. SUPABASE MIGRATION HELPER
   Call once from console: window.financeRunMigration()
   ═══════════════════════════════════════════════════════════ */
window.financeRunMigration = async function() {
  /* Table: finance_transactions
     id            uuid PK
     type          text  (income | expense | donation | transfer | adjustment)
     category      text  (shop | donation | sponsorship | operational | server | misc)
     amount        numeric
     note          text
     reference     text  (order id, donor name, etc)
     recorded_by   text  (admin display name)
     created_at    timestamptz
  */
  const sql = `
    CREATE TABLE IF NOT EXISTS finance_transactions (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      type         text NOT NULL CHECK (type IN ('income','expense','donation','transfer','adjustment')),
      category     text NOT NULL DEFAULT 'misc',
      amount       numeric NOT NULL,
      note         text,
      reference    text,
      recorded_by  text,
      created_at   timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_ft_created ON finance_transactions(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ft_type    ON finance_transactions(type);
  `;
  console.log('[Finance] SQL to run in Supabase SQL Editor:\n', sql);
  alert('Buka Supabase → SQL Editor, lalu jalankan SQL yang sudah di-console.log. Setelah itu refresh halaman ini.');
};

/* ═══════════════════════════════════════════════════════════
   2. INIT — dipanggil saat section finance-v2 dibuka
   ═══════════════════════════════════════════════════════════ */
window.financeV2Init = async function() {
  await Promise.all([
    financeV2LoadSummary(),
    financeV2LoadList()
  ]);
  financeV2SubscribeRealtime();
};

/* ── Cleanup saat pindah section ── */
window.financeV2Destroy = function() {
  if (_finSub) { try { _finSub.unsubscribe(); } catch(e){} _finSub = null; }
};

/* ═══════════════════════════════════════════════════════════
   3. SUMMARY CARDS
   ═══════════════════════════════════════════════════════════ */
window.financeV2LoadSummary = async function(period) {
  period = period || document.getElementById('fv2-period')?.value || 'month';
  const now = new Date();
  let from;
  if (period === 'today') {
    from = today() + 'T00:00:00';
  } else if (period === 'week') {
    const d = new Date(now); d.setDate(d.getDate() - 6);
    from = d.toISOString().split('T')[0] + 'T00:00:00';
  } else if (period === 'month') {
    from = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-01T00:00:00';
  } else if (period === 'year') {
    from = now.getFullYear() + '-01-01T00:00:00';
  } else {
    from = null;
  }

  let q = sb.from('finance_transactions').select('type,amount');
  if (from) q = q.gte('created_at', from);
  const { data, error } = await q;

  if (error) {
    console.warn('[Finance] summary error:', error.message);
    _finShowTableError('Tabel belum dibuat. Klik tombol "Setup Database" di bawah.');
    return;
  }

  let totalIn=0, totalOut=0, totalDon=0, totalAdj=0;
  (data||[]).forEach(r => {
    const a = Number(r.amount)||0;
    if (r.type === 'income')     totalIn  += a;
    if (r.type === 'expense')    totalOut += a;
    if (r.type === 'donation')   { totalIn += a; totalDon += a; }
    if (r.type === 'transfer')   totalOut += a;
    if (r.type === 'adjustment') totalAdj += a;
  });
  const balance = totalIn - totalOut;

  _setSum('fv2-sum-in',  fmtShort(totalIn));
  _setSum('fv2-sum-out', fmtShort(totalOut));
  _setSum('fv2-sum-don', fmtShort(totalDon));
  _setSum('fv2-sum-bal', fmtShort(balance), balance >= 0 ? 'pos' : 'neg');
};

function _setSum(id, val, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = val;
  el.className = 'fv2-sum-val' + (cls ? ' ' + cls : '');
}

/* ═══════════════════════════════════════════════════════════
   4. TRANSACTION LIST
   ═══════════════════════════════════════════════════════════ */
window.financeV2LoadList = async function() {
  const container = document.getElementById('fv2-list');
  if (!container) return;
  container.innerHTML = '<div class="empty-state">Memuat...</div>';

  const typeF  = document.getElementById('fv2-filter-type')?.value  || '';
  const catF   = document.getElementById('fv2-filter-cat')?.value   || '';
  const searchF= document.getElementById('fv2-search')?.value?.trim()|| '';
  const fromF  = document.getElementById('fv2-from')?.value || '';
  const toF    = document.getElementById('fv2-to')?.value   || '';

  let q = sb.from('finance_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (typeF) q = q.eq('type', typeF);
  if (catF)  q = q.eq('category', catF);
  if (fromF) q = q.gte('created_at', fromF + 'T00:00:00');
  if (toF)   q = q.lte('created_at', toF   + 'T23:59:59');

  const { data, error } = await q;
  if (error) { container.innerHTML = '<div class="empty-state" style="color:#f87171">' + esc(error.message) + '</div>'; return; }

  let rows = data || [];
  if (searchF) {
    const kw = searchF.toLowerCase();
    rows = rows.filter(r =>
      (r.note||'').toLowerCase().includes(kw) ||
      (r.reference||'').toLowerCase().includes(kw) ||
      (r.category||'').toLowerCase().includes(kw) ||
      (r.recorded_by||'').toLowerCase().includes(kw)
    );
  }

  if (!rows.length) {
    container.innerHTML = '<div class="empty-state">Tidak ada transaksi ditemukan.</div>';
    return;
  }

  const typeIcon  = { income:'💰', expense:'💸', donation:'🎁', transfer:'🔄', adjustment:'⚙️' };
  const typeColor = { income:'var(--green)', expense:'#f87171', donation:'#a78bfa', transfer:'#60a5fa', adjustment:'#fbbf24' };
  const typeLbl   = { income:'Pemasukan', expense:'Pengeluaran', donation:'Donasi', transfer:'Transfer', adjustment:'Penyesuaian' };

  container.innerHTML = `
  <div class="fv2-table-wrap">
    <table class="fv2-table">
      <thead>
        <tr>
          <th>Tanggal</th>
          <th>Tipe</th>
          <th>Kategori</th>
          <th>Nominal</th>
          <th>Catatan / Referensi</th>
          <th>Oleh</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => {
          const isOut = r.type === 'expense' || r.type === 'transfer';
          const dt = new Date(r.created_at);
          const dtStr = dt.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) + ' ' + dt.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
          return `<tr>
            <td style="white-space:nowrap;font-size:12px;color:var(--text-faint)">${dtStr}</td>
            <td><span class="fv2-type-badge" style="color:${typeColor[r.type]||'#888'};background:${typeColor[r.type]||'#888'}22">${typeIcon[r.type]||'•'} ${typeLbl[r.type]||r.type}</span></td>
            <td><span class="fv2-cat-badge">${esc(r.category)}</span></td>
            <td style="font-weight:700;color:${isOut?'#f87171':'var(--green)'};white-space:nowrap">${isOut?'-':'+'} ${fmt(r.amount)}</td>
            <td style="font-size:12.5px;max-width:260px">${esc(r.note||'—')}${r.reference?'<br><span style="font-size:11px;color:var(--text-faint)">ref: '+esc(r.reference)+'</span>':''}</td>
            <td style="font-size:12px;color:var(--text-faint)">${esc(r.recorded_by||'—')}</td>
            <td><button class="fv2-del-btn" onclick="financeV2Delete('${r.id}')" title="Hapus"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
};

/* ═══════════════════════════════════════════════════════════
   5. ADD TRANSACTION
   ═══════════════════════════════════════════════════════════ */
window.financeV2ShowForm = function(type) {
  const modal = document.getElementById('fv2-modal');
  const title = document.getElementById('fv2-modal-title');
  const typeInput = document.getElementById('fv2-form-type');
  const catSel = document.getElementById('fv2-form-cat');

  const titles = { income:'Tambah Pemasukan', expense:'Tambah Pengeluaran', donation:'Catat Donasi', transfer:'Catat Transfer', adjustment:'Penyesuaian Saldo' };
  const catOptions = {
    income:     ['shop','sponsorship','event','misc'],
    expense:    ['server','operational','plugin','content','misc'],
    donation:   ['donation'],
    transfer:   ['bank','ewallet','misc'],
    adjustment: ['correction','misc']
  };
  const catLabels = { shop:'Toko', sponsorship:'Sponsorship', event:'Event', misc:'Lainnya', server:'Server', operational:'Operasional', plugin:'Plugin/Tools', content:'Konten', bank:'Bank', ewallet:'E-Wallet', donation:'Donasi', correction:'Koreksi', content:'Konten' };

  title.textContent = titles[type] || 'Tambah Transaksi';
  typeInput.value = type;
  catSel.innerHTML = (catOptions[type]||['misc']).map(c => `<option value="${c}">${catLabels[c]||c}</option>`).join('');

  // reset form
  ['fv2-form-amount','fv2-form-note','fv2-form-ref','fv2-form-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id === 'fv2-form-date' ? today() : '';
  });

  // show donor field only for donation
  const donorRow = document.getElementById('fv2-donor-row');
  if (donorRow) donorRow.style.display = type === 'donation' ? '' : 'none';
  const refLabel = document.getElementById('fv2-ref-label');
  if (refLabel) refLabel.textContent = type === 'donation' ? 'Nama Donatur' : type === 'income' ? 'ID Order (opsional)' : 'Referensi (opsional)';

  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('open'), 10);
  document.getElementById('fv2-form-amount')?.focus();
};

window.financeV2CloseModal = function() {
  const modal = document.getElementById('fv2-modal');
  modal.classList.remove('open');
  setTimeout(() => modal.style.display = 'none', 280);
};

window.financeV2Submit = async function() {
  const btn = document.getElementById('fv2-submit-btn');
  const type   = document.getElementById('fv2-form-type').value;
  const cat    = document.getElementById('fv2-form-cat').value;
  const amount = parseFloat(document.getElementById('fv2-form-amount').value);
  const note   = document.getElementById('fv2-form-note').value.trim();
  const ref    = document.getElementById('fv2-form-ref').value.trim();
  const dateVal= document.getElementById('fv2-form-date').value;

  if (!amount || amount <= 0) { _finToast('Nominal harus diisi dan lebih dari 0', 'error'); return; }

  // Get current admin name
  const adminName = document.getElementById('topbar-email')?.textContent || 'admin';

  btn.disabled = true; btn.textContent = 'Menyimpan...';

  const payload = {
    type, category: cat, amount,
    note: note || null,
    reference: ref || null,
    recorded_by: adminName,
    created_at: dateVal ? dateVal + 'T' + new Date().toTimeString().slice(0,8) : nowTs()
  };

  const { error } = await sb.from('finance_transactions').insert([payload]);
  btn.disabled = false; btn.textContent = 'Simpan Transaksi';

  if (error) { _finToast('Gagal: ' + error.message, 'error'); return; }

  _finToast('Transaksi berhasil dicatat ✓', 'success');
  financeV2CloseModal();
  await Promise.all([financeV2LoadSummary(), financeV2LoadList()]);
};

/* ═══════════════════════════════════════════════════════════
   6. DELETE
   ═══════════════════════════════════════════════════════════ */
window.financeV2Delete = async function(id) {
  if (!confirm('Hapus transaksi ini?')) return;
  const { error } = await sb.from('finance_transactions').delete().eq('id', id);
  if (error) { _finToast('Gagal hapus: ' + error.message, 'error'); return; }
  _finToast('Dihapus.', 'success');
  await Promise.all([financeV2LoadSummary(), financeV2LoadList()]);
};

/* ═══════════════════════════════════════════════════════════
   7. REALTIME
   ═══════════════════════════════════════════════════════════ */
function financeV2SubscribeRealtime() {
  if (_finSub) return;
  try {
    _finSub = sb.channel('finance-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_transactions' }, async () => {
        await Promise.all([financeV2LoadSummary(), financeV2LoadList()]);
      })
      .subscribe();
  } catch(e) { console.warn('[Finance RT]', e); }
}

/* ═══════════════════════════════════════════════════════════
   8. CASHFLOW REPORT (by month)
   ═══════════════════════════════════════════════════════════ */
window.financeV2LoadCashflow = async function() {
  const container = document.getElementById('fv2-cashflow');
  if (!container) return;
  container.innerHTML = '<div class="empty-state">Memuat...</div>';

  const { data, error } = await sb.from('finance_transactions')
    .select('type,amount,created_at')
    .order('created_at', { ascending: true });

  if (error) { container.innerHTML = '<div class="empty-state" style="color:#f87171">' + esc(error.message) + '</div>'; return; }
  if (!data || !data.length) { container.innerHTML = '<div class="empty-state">Belum ada data.</div>'; return; }

  // Group by YYYY-MM
  const months = {};
  data.forEach(r => {
    const m = r.created_at.slice(0,7);
    if (!months[m]) months[m] = { in:0, out:0, don:0 };
    const a = Number(r.amount)||0;
    if (r.type === 'income')   months[m].in  += a;
    if (r.type === 'donation') { months[m].in += a; months[m].don += a; }
    if (r.type === 'expense' || r.type === 'transfer') months[m].out += a;
  });

  const keys = Object.keys(months).sort();
  let runBal = 0;

  container.innerHTML = `
  <div class="fv2-table-wrap">
    <table class="fv2-table">
      <thead>
        <tr>
          <th>Bulan</th>
          <th>Pemasukan</th>
          <th>Donasi</th>
          <th>Pengeluaran</th>
          <th>Cashflow</th>
          <th>Saldo Berjalan</th>
        </tr>
      </thead>
      <tbody>
        ${keys.map(m => {
          const row = months[m];
          const flow = row.in - row.out;
          runBal += flow;
          const [y, mo] = m.split('-');
          const label = new Date(y, parseInt(mo)-1).toLocaleDateString('id-ID',{month:'long',year:'numeric'});
          return `<tr>
            <td style="font-weight:600">${label}</td>
            <td style="color:var(--green);font-weight:600">${fmt(row.in)}</td>
            <td style="color:#a78bfa">${row.don ? fmt(row.don) : '—'}</td>
            <td style="color:#f87171;font-weight:600">${fmt(row.out)}</td>
            <td style="font-weight:700;color:${flow>=0?'var(--green)':'#f87171'}">${flow>=0?'+':''}${fmt(flow)}</td>
            <td style="font-weight:700;color:${runBal>=0?'var(--green)':'#f87171'}">${fmt(runBal)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
};

/* ═══════════════════════════════════════════════════════════
   9. EXPORT CSV
   ═══════════════════════════════════════════════════════════ */
window.financeV2Export = async function() {
  const { data, error } = await sb.from('finance_transactions')
    .select('*').order('created_at', { ascending: false });
  if (error || !data) { _finToast('Gagal export', 'error'); return; }

  const headers = ['Tanggal','Tipe','Kategori','Nominal','Catatan','Referensi','Dicatat Oleh'];
  const rows = data.map(r => [
    new Date(r.created_at).toLocaleString('id-ID'),
    r.type, r.category, r.amount,
    (r.note||'').replace(/,/g,';'),
    (r.reference||'').replace(/,/g,';'),
    (r.recorded_by||'')
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'keuangan-laughtale-' + today() + '.csv';
  a.click(); URL.revokeObjectURL(url);
  _finToast('Export berhasil ✓', 'success');
};

/* ═══════════════════════════════════════════════════════════
   10. SETUP DB HELPER
   ═══════════════════════════════════════════════════════════ */
window.financeV2SetupDB = function() {
  const sql =
`CREATE TABLE IF NOT EXISTS finance_transactions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type         text NOT NULL CHECK (type IN ('income','expense','donation','transfer','adjustment')),
  category     text NOT NULL DEFAULT 'misc',
  amount       numeric NOT NULL,
  note         text,
  reference    text,
  recorded_by  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ft_created ON finance_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ft_type    ON finance_transactions(type);
-- RLS (opsional, aktifkan jika perlu)
-- ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;`;

  const box = document.getElementById('fv2-sql-box');
  if (box) {
    box.style.display = 'block';
    document.getElementById('fv2-sql-code').textContent = sql;
  }
};

window.financeV2CopySQL = function() {
  const code = document.getElementById('fv2-sql-code')?.textContent;
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => _finToast('SQL disalin ✓', 'success'));
};

/* ── Internal helpers ── */
function _finToast(msg, type) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast-show' + (type === 'error' ? ' toast-error' : '');
  clearTimeout(t._tt);
  t._tt = setTimeout(() => t.className = '', 3200);
}

function _finShowTableError(msg) {
  ['fv2-sum-in','fv2-sum-out','fv2-sum-don','fv2-sum-bal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '—';
  });
}
