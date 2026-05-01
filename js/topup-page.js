const SB = 'https://jlxtnbnrirxhwuyqjlzw.supabase.co',
  SK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpseHRuYm5yaXJ4aHd1eXFqbHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NjYzOTAsImV4cCI6MjA5MTQ0MjM5MH0.MRhoVRDju41J8nWp4WTgiKOvxy7AgwGYH-el2zVsbWI';
const EP = `${SB}/rest/v1/topup_queue`;
const $ = id => document.getElementById(id);
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML }
const fmt = n => (n || 0).toLocaleString('id-ID');

let accessToken = '';
let adminName = '';
let adminRole = '';
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
    setInterval(fetchHistory, 15000);
    setInterval(fetchPlayers, 60000);

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
  if (/["\\n]/.test(name)) { toast('Nama mengandung karakter tidak valid', false); return; }
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
      admin_key: adminName,
      admin_note: note || '',
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
    const r = await fetch(EP + '?order=created_at.desc&limit=20',
      { headers: authHeaders() });
    const rows = await r.json();
    if (!rows.length) { el.innerHTML = '<div class="emp">Belum ada riwayat topup</div>'; return; }
    el.innerHTML = rows.map(function (h, i) {
      const st = h.status || 'pending';
      const stCls = st === 'done' ? 'done' : st === 'failed' ? 'failed' : 'pending';
      const stLabel = st === 'done' ? '\u2713 Selesai' : st === 'failed' ? '\u2717 Gagal' : '\u23f3 Pending';
      const cur = h.currency === 'coin' ? 'Koin' : 'Gem';
      const curCls = h.currency === 'coin' ? 'coin' : 'gem';
      const ago = timeAgo(h.created_at);
      const admin = h.admin_key ? ' \u00b7 oleh ' + esc(h.admin_key) : '';
      return '<div class="h-row" style="animation:fs .25s ' + (i * 30) + 'ms ease both">' +
        '<div class="h-status ' + stCls + '">' + stLabel + '</div>' +
        '<div class="h-body">' +
        '<div class="h-main"><span class="h-name">' + esc(h.player_name || '?') + '</span> <span class="h-amount ' + curCls + '">+' + fmt(h.amount) + ' ' + cur + '</span></div>' +
        '<div class="h-detail">' + (h.result_msg ? esc(h.result_msg) + ' \u00b7 ' : '') + ago + (h.admin_note ? ' \u00b7 "' + esc(h.admin_note) + '"' : '') + admin + '</div>' +
        '</div></div>';
    }).join('');
  } catch (ex) {
    el.innerHTML = '<div class="emp">Error: ' + esc(ex.message) + '</div>';
  }
}

function timeAgo(ts) {
  if (!ts) return '?';
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return s + 's lalu';
  if (s < 3600) return Math.floor(s / 60) + 'm lalu';
  if (s < 86400) return Math.floor(s / 3600) + 'j lalu';
  return Math.floor(s / 86400) + 'h lalu';
}
