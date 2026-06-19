const SB = window.SB_URL,
  SK = window.SB_KEY;
const EP = `${SB}/rest/v1/topup_queue`;
const $ = id => document.getElementById(id);
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML }
const fmt = n => (n || 0).toLocaleString('id-ID');

let accessToken = '';
let adminName = '';
let adminRole = '';
let adminEmail = '';
let adminUserId = '';
let playerList = [];

// ── Toast ──
function toast(msg, ok = true) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast ' + (ok ? 'ok' : 'err') + ' show';
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Auth headers helper ──
function authHeaders(extra) {
  const h = { apikey: SK, Authorization: 'Bearer ' + (accessToken || SK) };
  if (extra) Object.assign(h, extra);
  return h;
}

// ── Login via Supabase Auth REST API ──
async function doLogin() {
  const email = $('login-email').value.trim();
  const pw = $('login-password').value;
  const errEl = $('login-error');
  const btn = $('login-btn');

  errEl.style.display = 'none';

  if (!email || !pw) {
    errEl.textContent = 'Email dan password wajib diisi.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'MEMVERIFIKASI...';

  try {
    const authRes = await fetch(SB + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: SK, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: pw }),
    });

    if (!authRes.ok) {
      const err = await authRes.json();
      throw new Error(err.error_description || err.msg || 'Email atau password salah.');
    }

    const authData = await authRes.json();
    accessToken = authData.access_token;
    const userId = authData.user && authData.user.id;
    if (!userId) throw new Error('Gagal mendapatkan data user.');
    adminEmail = (authData.user && authData.user.email) || '';
    adminUserId = userId;

    const roleRes = await fetch(
      SB + '/rest/v1/admin_roles?user_id=eq.' + userId + '&select=role,display_name',
      { headers: authHeaders() }
    );
    const roles = await roleRes.json();

    if (!Array.isArray(roles) || !roles.length) {
      throw new Error('Akun ini tidak terdaftar sebagai admin.');
    }

    adminName = roles[0].display_name || email.split('@')[0];
    adminRole = roles[0].role;

    $('login-screen').style.display = 'none';
    $('main-content').style.display = 'block';
    $('admin-info').textContent = adminName + ' (' + adminRole + ')';

    fetchHistory();
    fetchPlayers();
    fetchGemOrders();
    setInterval(fetchHistory, 15000);
    setInterval(fetchPlayers, 60000);
    setInterval(fetchGemOrders, 15000);

  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'MASUK';
  }
}

// ── Logout ──
function doLogout() {
  fetch(SB + '/auth/v1/logout', {
    method: 'POST',
    headers: authHeaders(),
  }).finally(function () {
    accessToken = '';
    adminName = '';
    adminRole = '';
    location.reload();
  });
}
window.doLogout = doLogout;

// ── Event listeners ──
$('login-btn').addEventListener('click', doLogin);
$('login-password').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
$('login-email').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('login-password').focus(); });

// ── Fetch registered players for autocomplete ──
async function fetchPlayers() {
  try {
    const r = await fetch(SB + '/rest/v1/leaderboard_sync?id=eq.current&select=gacha_lb',
      { headers: authHeaders() });
    const d = await r.json();
    if (d && d[0] && d[0].gacha_lb) {
      const lb = typeof d[0].gacha_lb === 'string' ? JSON.parse(d[0].gacha_lb) : d[0].gacha_lb;
      const names = new Set();
      for (const cat of Object.values(lb)) {
        if (Array.isArray(cat)) cat.forEach(function (p) { if (p.name) names.add(p.name); });
      }
      playerList = [...names].sort();
      renderSuggestions();
    }
  } catch (e) { /* silent */ }
}

function renderSuggestions() {
  var dl = $('player-suggestions');
  dl.innerHTML = playerList.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('');
}

// ── Submit Topup ──
$('topup-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  const btn = $('submit-btn');
  const name = $('player-name').value.trim();
  const amount = Math.floor(Number($('amount').value));
  const currency = $('currency').value;
  const note = $('note').value.trim();

  if (!name) { toast('Nama player wajib diisi', false); return; }
  if (/["\\]/.test(name) || name.includes('\n')) { toast('Nama mengandung karakter tidak valid', false); return; }
  if (!amount || amount < 1) { toast('Jumlah minimal 1', false); return; }
  if (amount > 100000) { toast('Jumlah maksimal 100.000', false); return; }

  btn.disabled = true;
  btn.textContent = 'MEMPROSES...';

  try {
    const payload = {
      player_name: name,
      amount: amount,
      currency: currency,
      status: 'pending',
      admin_key: 'laughtale-topup',
      admin_note: (note ? note + ' ' : '') + '[' + adminName + ']',
    };
    const r = await fetch(EP, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      toast('\u2713 Topup ' + fmt(amount) + ' ' + currency + ' \u2192 ' + name + ' dikirim!');
      $('player-name').value = '';
      $('amount').value = '';
      $('note').value = '';
      setTimeout(fetchHistory, 2000);
    } else {
      const err = await r.text();
      toast('Gagal: ' + err.substring(0, 100), false);
    }
  } catch (ex) {
    toast('Error: ' + ex.message, false);
  } finally {
    btn.disabled = false;
    btn.textContent = 'KIRIM TOPUP';
  }
});

// ── History ──
async function fetchHistory() {
  const el = $('history');
  try {
    const r = await fetch(EP + '?order=created_at.desc&limit=30',
      { headers: authHeaders() });
    const rows = await r.json();
    if (!rows.length) { el.innerHTML = '<div class="emp">Belum ada riwayat topup</div>'; return; }
    var _iSvg = {
      gem: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:-1px"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M2 9h20"/></svg>',
      box: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05"/><path d="M12 22.08V12"/></svg>',
      hr: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
      ok: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="vertical-align:-1px"><polyline points="20 6 9 17 4 12"/></svg>',
      no: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="vertical-align:-1px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
    };
    el.innerHTML = rows.map(function (h, i) {
      var st = h.status || 'pending';
      var rm = h.result_msg || '';
      var stCls, stLabel;
      var isOnline = (rm.indexOf('(online') >= 0);
      var isOffline = (!isOnline && rm.indexOf('(offline') >= 0);
      if (st === 'done') {
        if (isOnline) { stCls = 'online'; stLabel = _iSvg.gem + ' Masuk'; }
        else if (isOffline) { stCls = 'queued'; stLabel = _iSvg.box + ' Antri'; }
        else { stCls = 'done'; stLabel = _iSvg.ok + ' Selesai'; }
      } else if (st === 'failed') {
        stCls = 'failed'; stLabel = _iSvg.no + ' Gagal';
      } else {
        stCls = 'pending'; stLabel = _iSvg.hr + ' Server...';
      }
      var cur = h.currency === 'coin' ? 'Koin' : 'Gem';
      var curCls = h.currency === 'coin' ? 'coin' : 'gem';
      var ago = timeAgo(h.created_at);
      var noteAdminMatch = (h.admin_note || '').match(/\[([^\]]+)\]$/);
      var adminLabel = noteAdminMatch ? noteAdminMatch[1] : (h.admin_key && h.admin_key !== 'laughtale-topup' ? h.admin_key : '');
      var admin = adminLabel ? ' \u00b7 oleh ' + esc(adminLabel) : '';
      var dInfo = '';
      if (st === 'done' && rm.indexOf('delivered on login') >= 0) dInfo = _iSvg.ok + ' Masuk saat login';
      else if (st === 'done' && isOnline) dInfo = _iSvg.ok + ' Diterima langsung saat online';
      else if (st === 'done' && isOffline) dInfo = _iSvg.box + ' Tercatat, masuk saat login';
      else if (st === 'pending') dInfo = _iSvg.hr + ' Menunggu server (~30 dtk)';
      else if (st === 'failed') dInfo = rm ? esc(rm) : 'Gagal diproses';
      else if (st === 'done') dInfo = _iSvg.ok + ' Berhasil diproses';
      var cancelBtn = '';
      var canCancel = (st === 'pending') || isOffline;
      if (canCancel) {
        cancelBtn = '<button class="h-cancel" onclick="window._cancelTopup(\'' + h.id + '\')" title="Batalkan topup ini">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          'CANCEL</button>';
      }
      return '<div class="h-row" style="animation:fs .25s ' + (i * 30) + 'ms ease both">' +
        '<div class="h-status ' + stCls + '">' + stLabel + '</div>' +
        '<div class="h-body">' +
        '<div class="h-main"><span class="h-name">' + esc(h.player_name || '?') + '</span> <span class="h-amount ' + curCls + '">+' + fmt(h.amount) + ' ' + cur + '</span></div>' +
        '<div class="h-detail">' + dInfo + ' \u00b7 ' + ago + admin + '</div>' +
        cancelBtn +
        '</div></div>';
    }).join('');
  } catch (ex) {
    el.innerHTML = '<div class="emp">Error: ' + esc(ex.message) + '</div>';
  }
}

// ── Cancel topup ──
window._cancelTopup = async function(id) {
  if (!confirm('Batalkan topup ini? Entry akan dihapus dari antrian.')) return;
  try {
    const res = await fetch(EP + '?id=eq.' + id, {
      method: 'DELETE',
      headers: authHeaders({ 'Prefer': 'return=minimal' })
    });
    if (!res.ok) {
      const errText = await res.text();
      toast('Gagal cancel: ' + errText, false);
      return;
    }
    toast('Topup dibatalkan');
    fetchHistory();
  } catch (ex) {
    toast('Error: ' + ex.message, false);
  }
};

function timeAgo(ts) {
  if (!ts) return '?';
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return s + 's lalu';
  if (s < 3600) return Math.floor(s / 60) + 'm lalu';
  if (s < 86400) return Math.floor(s / 3600) + 'j lalu';
  return Math.floor(s / 86400) + 'h lalu';
}

// ── Gem Orders from Shop ──
const ORDERS_EP = SB + '/rest/v1/orders';
const TOPUP_KEY = 'laughtale-topup';

async function fetchGemOrders() {
  const el = $('gem-orders');
  if (!el) return;
  try {
    const r = await fetch(
      ORDERS_EP + '?status=eq.pending&order=created_at.asc&select=id,item_name,item_category,item_id,username,qty,total_price,created_at',
      { headers: authHeaders() }
    );
    const rows = await r.json();
    // Filter gem orders: name/category contains 'gem' or 'currency', or item_id=8
    const gems = (rows || []).filter(function (o) {
      const n = (o.item_name || '').toLowerCase();
      const c = (o.item_category || '').toLowerCase();
      const id = parseInt(o.item_id) || 0;
      return n.includes('gem') || c.includes('gem') || c.includes('currency') || id === 8;
    });

    if (!gems.length) {
      el.innerHTML = '<div class="emp">Tidak ada order gem pending</div>';
      return;
    }

    el.innerHTML = gems.map(function (o, i) {
      var name = esc(o.username || 'Anonim');
      var qty = o.qty || 0;
      var ago = timeAgo(o.created_at);
      var price = 'Rp ' + (o.total_price || 0).toLocaleString('id-ID');
      var shortId = 'LT-' + String(o.id).replace(/-/g, '').slice(-6).toUpperCase();
      return '<div class="go-card" id="go-' + esc(o.id) + '" style="animation:fs .25s ' + (i * 40) + 'ms ease both">' +
        '<div class="go-info">' +
          '<div class="go-name">' + name + '</div>' +
          '<div class="go-meta">' + shortId + ' · ' + esc(o.item_name || '?') + ' · ' + price + ' · ' + ago + '</div>' +
        '</div>' +
        '<div class="go-amount"><b>' + fmt(qty) + '</b> Gem</div>' +
        '<button class="go-btn go-btn-send" onclick="processGemOrder(\'' + esc(o.id) + '\')" title="Kirim ' + qty + ' Gem ke ' + name + '">KIRIM</button>' +
      '</div>';
    }).join('');
  } catch (ex) {
    el.innerHTML = '<div class="emp">Error: ' + esc(ex.message) + '</div>';
  }
}

async function processGemOrder(orderId) {
  // Fetch full order data
  try {
    const r = await fetch(ORDERS_EP + '?id=eq.' + orderId + '&select=*', { headers: authHeaders() });
    const rows = await r.json();
    if (!rows || !rows.length) { toast('Order tidak ditemukan', false); return; }
    const o = rows[0];

    var playerName = (o.username || '').trim();
    if (!playerName || playerName === 'Anonim') { toast('Username Minecraft kosong, tidak bisa topup', false); return; }

    var amount = parseInt(o.qty) || 0;
    if (amount <= 0) { toast('Jumlah gem = 0', false); return; }

    // Disable button
    var btn = document.querySelector('#go-' + orderId + ' .go-btn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    // Idempotency check
    var noteTag = 'order:' + orderId;
    var checkR = await fetch(EP + '?admin_note=like.*' + encodeURIComponent(noteTag) + '*&limit=1', { headers: authHeaders() });
    var existing = await checkR.json();
    if (existing && existing.length > 0) {
      toast('Topup sudah pernah dikirim untuk order ini', false);
      if (btn) { btn.disabled = false; btn.textContent = 'KIRIM'; }
      return;
    }

    // Insert topup queue
    var shortId = 'LT-' + String(orderId).replace(/-/g, '').slice(-6).toUpperCase();
    var payload = {
      player_name: playerName,
      amount: amount,
      currency: 'gem',
      status: 'pending',
      admin_key: TOPUP_KEY,
      admin_note: 'Topup page ' + shortId + ': ' + (o.item_name || '?') + ' x' + amount + ' (' + noteTag + ') [' + adminName + ']',
    };
    var insertR = await fetch(EP, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify(payload),
    });
    if (!insertR.ok) { toast('Gagal insert topup: ' + (await insertR.text()).substring(0, 80), false); return; }

    // Mark order as selesai
    var completedAt = new Date().toISOString();
    var updatePayload = {
      status: 'selesai',
      completed_at: completedAt,
      completed_by_name: adminName || 'topup-page',
      completed_by_user_id: adminUserId || null,
      completed_by_display_name: adminName || null,
      completed_by_email: adminEmail || null,
    };
    await fetch(ORDERS_EP + '?id=eq.' + orderId, {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify(updatePayload),
    });

    // Record finance transaction (sinkron dengan admin panel)
    if (o.total_price && Number(o.total_price) > 0) {
      var finRef = 'order:' + orderId;
      try {
        var finCheckR = await fetch(SB + '/rest/v1/finance_transactions?reference=eq.' + encodeURIComponent(finRef) + '&select=id&limit=1', { headers: authHeaders() });
        var finExisting = await finCheckR.json();
        if (!finExisting || !finExisting.length) {
          var finCategory = (o.item_name || '').toLowerCase().includes('gem') ? 'gem' : 'shop';
          await fetch(SB + '/rest/v1/finance_transactions', {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
            body: JSON.stringify({
              type: 'income',
              category: finCategory,
              amount: Number(o.total_price),
              note: 'Order: ' + (o.item_name || '?'),
              reference: finRef,
              recorded_by: adminName || 'topup-page',
              created_at: completedAt,
            }),
          });
        }
      } catch (finErr) { console.warn('[TopupPage] Finance record error:', finErr); }
    }

    toast(fmt(amount) + ' Gem → ' + playerName + ' (terkirim!)');

    // Remove card with animation
    var card = document.getElementById('go-' + orderId);
    if (card) {
      card.style.transition = 'opacity .25s, transform .25s';
      card.style.opacity = '0';
      card.style.transform = 'translateX(12px)';
      setTimeout(function () { card.remove(); }, 280);
    }

    setTimeout(function () { fetchGemOrders(); fetchHistory(); }, 1500);

  } catch (ex) {
    toast('Error: ' + ex.message, false);
    var btn2 = document.querySelector('#go-' + orderId + ' .go-btn');
    if (btn2) { btn2.disabled = false; btn2.textContent = 'KIRIM'; }
  }
}
window.processGemOrder = processGemOrder;
