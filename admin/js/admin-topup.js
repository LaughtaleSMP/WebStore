// ==================== ADMIN TOPUP GEM/KOIN ====================
// Uses sb (supabase client) from supabase-config.js
// Uses showAdminToast, escHtml from supabase-config.js

const GT_ADMIN_KEY = 'laughtale-topup';
const GT_TABLE = 'topup_queue';
let _gtLoaded = false;
let _gtRefTimer = null;

// ── Init (called when section is shown) ──
window.gtInit = function () {
  if (!_gtLoaded) {
    _gtLoaded = true;
    _gtBindForm();
    _gtFetchPlayers();
  }
  _gtLoadHistory();
  // Auto-refresh every 10s while on this section
  clearInterval(_gtRefTimer);
  _gtRefTimer = setInterval(() => {
    const sec = document.getElementById('sec-gem-topup');
    if (sec && sec.classList.contains('active')) _gtLoadHistory();
    else clearInterval(_gtRefTimer);
  }, 10000);
};

// ── Refresh button ──
window.gtRefresh = function () {
  _gtLoadHistory();
};

// ── Bind form submit ──
function _gtBindForm() {
  const form = document.getElementById('gt-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('gt-submit');
    const name = (document.getElementById('gt-player').value || '').trim();
    const amount = Math.floor(Number(document.getElementById('gt-amount').value));
    const currency = document.getElementById('gt-currency').value;
    const note = (document.getElementById('gt-note').value || '').trim();

    if (!name) { showAdminToast('Nama player wajib diisi', 'error'); return; }
    if (/["\\\n]/.test(name)) { showAdminToast('Nama mengandung karakter tidak valid', 'error'); return; }
    if (!amount || amount < 1) { showAdminToast('Jumlah minimal 1', 'error'); return; }
    if (amount > 100000) { showAdminToast('Jumlah maksimal 100.000', 'error'); return; }

    btn.disabled = true;
    btn.textContent = 'Mengirim...';

    try {
      const adminLabel = (window.currentRole && window.currentRole.display_name)
        || (window.currentUser && window.currentUser.email && window.currentUser.email.split('@')[0])
        || 'admin';
      const { error } = await sb.from(GT_TABLE).insert({
        player_name: name,
        amount,
        currency,
        status: 'pending',
        admin_key: GT_ADMIN_KEY,
        admin_note: (note ? note + ' ' : '') + '[' + adminLabel + ']',
      });
      if (error) throw error;

      showAdminToast(`✓ Topup ${amount.toLocaleString('id-ID')} ${currency} → ${name} dikirim!`);
      document.getElementById('gt-player').value = '';
      document.getElementById('gt-amount').value = '';
      document.getElementById('gt-note').value = '';
      setTimeout(_gtLoadHistory, 2000);
    } catch (err) {
      showAdminToast('Gagal: ' + (err.message || err), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Kirim Topup';
    }
  });
}

// ── Fetch registered players for autocomplete ──
async function _gtFetchPlayers() {
  try {
    const { data } = await sb.from('leaderboard_sync')
      .select('gacha_lb')
      .eq('id', 'current')
      .single();
    if (!data || !data.gacha_lb) return;
    const lb = typeof data.gacha_lb === 'string' ? JSON.parse(data.gacha_lb) : data.gacha_lb;
    const names = new Set();
    for (const cat of Object.values(lb)) {
      if (Array.isArray(cat)) cat.forEach(p => { if (p.name) names.add(p.name); });
    }
    const dl = document.getElementById('gt-player-list');
    if (dl) dl.innerHTML = [...names].sort().map(n => `<option value="${escHtml(n)}">`).join('');
  } catch {}
}

// ── Load history ──
async function _gtLoadHistory() {
  const el = document.getElementById('gt-history');
  if (!el) return;

  try {
    const { data, error } = await sb.from(GT_TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;

    if (!data || !data.length) {
      el.innerHTML = '<div class="empty-state">Belum ada riwayat topup</div>';
      _gtUpdateBadge(0);
      return;
    }

    const pendingCount = data.filter(r => r.status === 'pending').length;
    _gtUpdateBadge(pendingCount);

    el.innerHTML = `
      <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr>
          <th style="padding:8px 10px;color:var(--text-faint);font-size:11px;border-bottom:1px solid var(--border);text-align:left">STATUS</th>
          <th style="padding:8px 10px;color:var(--text-faint);font-size:11px;border-bottom:1px solid var(--border);text-align:left">PLAYER</th>
          <th style="padding:8px 10px;color:var(--text-faint);font-size:11px;border-bottom:1px solid var(--border);text-align:left">JUMLAH</th>
          <th style="padding:8px 10px;color:var(--text-faint);font-size:11px;border-bottom:1px solid var(--border);text-align:left">CATATAN</th>
          <th style="padding:8px 10px;color:var(--text-faint);font-size:11px;border-bottom:1px solid var(--border);text-align:left">WAKTU</th>
          <th style="padding:8px 10px;color:var(--text-faint);font-size:11px;border-bottom:1px solid var(--border);text-align:left">DELIVERY</th>
          <th style="padding:8px 10px;color:var(--text-faint);font-size:11px;border-bottom:1px solid var(--border);text-align:center">AKSI</th>
        </tr></thead>
        <tbody>${data.map(r => _gtRow(r)).join('')}</tbody>
      </table></div>`;
  } catch (err) {
    el.innerHTML = `<div class="empty-state">Error: ${escHtml(err.message)}</div>`;
  }
}

function _gtRow(r) {
  const st = r.status || 'pending';
  const rm = r.result_msg || '';
  const _s = {
    gem: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:-1px"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M2 9h20"/></svg>',
    box: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05"/><path d="M12 22.08V12"/></svg>',
    hr: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    ok: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="vertical-align:-1px"><polyline points="20 6 9 17 4 12"/></svg>',
    no: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="vertical-align:-1px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  };
  let stHtml, deliveryHtml;
  const isOnline = rm.includes('(online');
  const isOffline = !isOnline && rm.includes('(offline');
  if (st === 'done') {
    if (isOnline) {
      const isDeliveredOnLogin = rm.includes('delivered on login');
      stHtml = `<span style="color:#2dd4bf;font-weight:600;font-size:11px">${_s.gem} Masuk</span>`;
      deliveryHtml = isDeliveredOnLogin
        ? `<span style="color:#2dd4bf;font-size:11px">${_s.ok} Masuk saat player login</span>`
        : `<span style="color:#2dd4bf;font-size:11px">${_s.ok} Diterima player (online)</span>`;
    } else if (isOffline) {
      stHtml = `<span style="color:#a78bfa;font-weight:600;font-size:11px">${_s.box} Antri</span>`;
      deliveryHtml = '<span style="color:#a78bfa;font-size:11px">Menunggu player login</span>';
    } else {
      stHtml = `<span style="color:var(--green);font-weight:600;font-size:11px">${_s.ok} Selesai</span>`;
      deliveryHtml = '<span style="color:var(--green);font-size:11px">Berhasil</span>';
    }
  } else if (st === 'failed') {
    stHtml = `<span style="color:var(--red);font-weight:600;font-size:11px">${_s.no} Gagal</span>`;
    deliveryHtml = `<span style="color:var(--red);font-size:11px" title="${escHtml(rm)}">${escHtml(rm || 'Error')}</span>`;
  } else {
    stHtml = `<span style="color:#facc15;font-weight:600;font-size:11px;animation:pulse 2s infinite">${_s.hr} Server...</span>`;
    deliveryHtml = '<span style="color:#facc15;font-size:11px">Menunggu proses (~30 dtk)</span>';
  }

  const cur = r.currency === 'coin' ? 'Koin' : 'Gem';
  const curColor = r.currency === 'coin' ? 'var(--gold)' : 'var(--accent)';
  const amt = (r.amount || 0).toLocaleString('id-ID');
  const time = r.created_at ? new Date(r.created_at).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  }) : '—';
  const note = r.admin_note || '';

  const canCancel = (st === 'pending') || isOffline;
  const cancelHtml = canCancel
    ? `<button onclick="window._gtCancel(${r.id})" style="font-family:inherit;font-size:10px;font-weight:600;padding:3px 10px;border-radius:5px;border:1px solid rgba(248,113,113,.2);background:rgba(248,113,113,.06);color:var(--red);cursor:pointer;transition:all .15s;white-space:nowrap;display:inline-flex;align-items:center;gap:3px" onmouseover="this.style.background='rgba(248,113,113,.18)'" onmouseout="this.style.background='rgba(248,113,113,.06)'">${_s.no} Cancel</button>`
    : '<span style="color:var(--text-faint);font-size:11px">&mdash;</span>';

  return `<tr style="border-bottom:1px solid var(--border)">
    <td style="padding:9px 10px">${stHtml}</td>
    <td style="padding:9px 10px;font-weight:500">${escHtml(r.player_name)}</td>
    <td style="padding:9px 10px;font-weight:700;color:${curColor}">+${amt} ${cur}</td>
    <td style="padding:9px 10px;color:var(--text-faint);font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(note)}</td>
    <td style="padding:9px 10px;color:var(--text-muted);font-size:12px;white-space:nowrap">${time}</td>
    <td style="padding:9px 10px;font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${deliveryHtml}</td>
    <td style="padding:9px 10px;text-align:center">${cancelHtml}</td>
  </tr>`;
}

// ── Badge counter ──
function _gtUpdateBadge(count) {
  const badge = document.getElementById('topup-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

// ── Poll pending count for badge (runs globally) ──
async function _gtPollBadge() {
  try {
    const { count, error } = await sb.from(GT_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (!error) _gtUpdateBadge(count || 0);
  } catch {}
}

// Start polling badge every 30s after login
document.addEventListener('DOMContentLoaded', () => {
  // Wait for admin login before polling
  const checkLogin = setInterval(() => {
    if (window.currentUser) {
      clearInterval(checkLogin);
      _gtPollBadge();
      setInterval(_gtPollBadge, 30000);
    }
  }, 2000);
});
// ── Cancel topup entry ──
window._gtCancel = async function(id) {
  const doCancel = async () => {
    try {
      const { error } = await sb.from(GT_TABLE).delete().eq('id', id);
      if (error) {
        showAdminToast('Gagal cancel: ' + error.message, 'error');
        return;
      }
      showAdminToast('Topup dibatalkan');
      _gtFetchHistory();
    } catch (ex) {
      showAdminToast('Error: ' + ex.message, 'error');
    }
  };
  if (typeof window.showMgrConfirm === 'function') {
    window.showMgrConfirm({
      title: 'Cancel Topup',
      message: 'Batalkan topup ini? Entry akan dihapus dari antrian.',
      confirmText: 'Cancel Topup',
      danger: true,
      onConfirm: doCancel,
    });
  } else {
    if (!confirm('Batalkan topup ini?')) return;
    doCancel();
  }
};
