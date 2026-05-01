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
      const { error } = await sb.from(GT_TABLE).insert({
        player_name: name,
        amount,
        currency,
        status: 'pending',
        admin_key: GT_ADMIN_KEY,
        admin_note: note,
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
          <th style="padding:8px 10px;color:var(--text-faint);font-size:11px;border-bottom:1px solid var(--border);text-align:left">HASIL</th>
        </tr></thead>
        <tbody>${data.map(r => _gtRow(r)).join('')}</tbody>
      </table></div>`;
  } catch (err) {
    el.innerHTML = `<div class="empty-state">Error: ${escHtml(err.message)}</div>`;
  }
}

function _gtRow(r) {
  const st = r.status || 'pending';
  let stHtml;
  if (st === 'done') {
    stHtml = '<span style="color:var(--green);font-weight:600;font-size:11px">✓ Selesai</span>';
  } else if (st === 'failed') {
    stHtml = '<span style="color:var(--red);font-weight:600;font-size:11px">✗ Gagal</span>';
  } else {
    stHtml = '<span style="color:#facc15;font-weight:600;font-size:11px;animation:pulse 2s infinite">⏳ Pending</span>';
  }

  const cur = r.currency === 'coin' ? 'Koin' : 'Gem';
  const curColor = r.currency === 'coin' ? 'var(--gold)' : 'var(--accent)';
  const amt = (r.amount || 0).toLocaleString('id-ID');
  const time = r.created_at ? new Date(r.created_at).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  }) : '—';
  const note = r.admin_note || '';
  const result = r.result_msg || '';

  return `<tr style="border-bottom:1px solid var(--border)">
    <td style="padding:9px 10px">${stHtml}</td>
    <td style="padding:9px 10px;font-weight:500">${escHtml(r.player_name)}</td>
    <td style="padding:9px 10px;font-weight:700;color:${curColor}">+${amt} ${cur}</td>
    <td style="padding:9px 10px;color:var(--text-faint);font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(note)}</td>
    <td style="padding:9px 10px;color:var(--text-muted);font-size:12px;white-space:nowrap">${time}</td>
    <td style="padding:9px 10px;color:var(--text-faint);font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(result)}</td>
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
