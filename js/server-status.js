/* ══════════════════════════════════════════════════════
   server-status.js — Realtime server status via mcsrvstat.us
   ══════════════════════════════════════════════════════ */

// Cache data terakhir agar bisa ditampilkan saat error
let _lastServerData = null;
let _lastFetchTime  = null;
let _lastRefreshTime = 0;

/* Ambil IP terbaru — prioritas: supabase-sync > SERVER_CONFIG > hardcode */
function getServerHost() {
  const ip = window._serverIP
    || (window.SERVER_CONFIG && window.SERVER_CONFIG.ip)
    || 'laughtale.my.id:19214';
  return ip.split(':')[0] || 'laughtale.my.id';
}
function getServerPort() {
  const ip = window._serverIP
    || (window.SERVER_CONFIG && window.SERVER_CONFIG.ip)
    || 'laughtale.my.id:19214';
  return parseInt(ip.split(':')[1]) || 19214;
}

function setOrbState(dot, label, state, text, color) {
  if (dot)   dot.className      = 'status-dot ' + state;
  if (label) label.textContent  = text;
  if (label) label.style.color  = color;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function fetchServerStatus() {
  const btn = document.getElementById('refresh-btn');

  // Cooldown 10 detik — cegah spam klik
  const now = Date.now();
  if (now - _lastRefreshTime < 10000 && _lastRefreshTime !== 0) {
    const wait = Math.ceil((10000 - (now - _lastRefreshTime)) / 1000);
    if (btn) btn.textContent = `↻ TUNGGU ${wait}s...`;
    setTimeout(() => { if (btn) btn.textContent = '↻ REFRESH STATUS'; }, wait * 1000);
    return;
  }
  _lastRefreshTime = now;

  if (btn) { btn.textContent = '↻ MEMUAT...'; btn.disabled = true; }

  // Baca IP secara dinamis saat fetch — bukan saat script load
  const SERVER_HOST = getServerHost();
  const SERVER_PORT = getServerPort();

  const startTime  = Date.now();
  const controller = new AbortController();
  const fetchTimeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res     = await fetch(
      `https://api.mcsrvstat.us/bedrock/3/${SERVER_HOST}:${SERVER_PORT}`,
      { signal: controller.signal }
    );
    clearTimeout(fetchTimeout);
    const latency = Date.now() - startTime;
    const data    = await res.json();

    const dot   = document.getElementById('status-dot-emoji');
    const label = document.getElementById('status-text-label');

    const latEl = document.getElementById('latency-display');
    if (latEl) latEl.textContent = latency;

    _lastServerData = data;
    _lastFetchTime  = new Date();

    if (data.online) {
      // ── ONLINE ─────────────────────────────────────────
      setOrbState(dot, label, 'is-online', 'ONLINE', 'var(--green)');
      document.querySelectorAll('.skel-val').forEach(el => el.classList.add('loaded'));

      const onlinePlayers = data.players?.online ?? 0;
      const maxPlayers    = data.players?.max    ?? '?';
      const version       = data.version         ?? 'Bedrock';

      const onlineEl  = document.getElementById('online-players');
      const maxEl     = document.getElementById('max-players');
      const versionEl = document.getElementById('server-version');
      const addrEl    = document.getElementById('server-address-display');

      if (onlineEl)  onlineEl.textContent  = onlinePlayers;
      if (maxEl)     maxEl.textContent     = maxPlayers;
      if (versionEl) versionEl.textContent = version;
      if (addrEl)    addrEl.textContent    = `${SERVER_HOST}:${SERVER_PORT}`;

      // Player list
      const listWrap = document.getElementById('player-list-wrap');
      const listEl   = document.getElementById('player-list');
      if (data.players?.list && data.players.list.length > 0) {
        if (listWrap) listWrap.style.display = 'block';
        if (listEl) listEl.innerHTML = data.players.list
          .map(p => `<span class="player-tag">${escHtml(p)}</span>`)
          .join('');
      } else {
        if (listWrap) listWrap.style.display = 'none';
      }

    } else {
      // ── OFFLINE ────────────────────────────────────────
      setOrbState(dot, label, 'is-offline', 'OFFLINE', 'var(--redstone)');
      document.querySelectorAll('.skel-val').forEach(el => el.classList.add('loaded'));

      const onlineEl = document.getElementById('online-players');
      if (onlineEl) onlineEl.textContent = '0';

      const addrEl = document.getElementById('server-address-display');
      if (addrEl) addrEl.textContent = `${SERVER_HOST} — Server sedang mati`;

      const listWrap = document.getElementById('player-list-wrap');
      if (listWrap) listWrap.style.display = 'none';
    }

    // Update timestamp
    const timeStr = new Date().toLocaleTimeString('id-ID');
    const uptime  = document.getElementById('uptime-display');
    const lastUpd = document.getElementById('last-updated-text');
    if (uptime)  uptime.textContent  = timeStr;
    if (lastUpd) lastUpd.textContent = `Terakhir diperbarui: ${timeStr} WIB • Auto-refresh setiap 60 detik`;

  } catch (err) {
    clearTimeout(fetchTimeout);
    const dot   = document.getElementById('status-dot-emoji');
    const label = document.getElementById('status-text-label');
    setOrbState(dot, label, 'is-error', 'ERROR', 'var(--gold)');

    const lastUpd = document.getElementById('last-updated-text');
    const addrEl  = document.getElementById('server-address-display');

    if (_lastServerData && _lastFetchTime) {
      const minsAgo = Math.round((Date.now() - _lastFetchTime) / 60000);
      if (lastUpd) lastUpd.textContent = `Gagal refresh — data dari ${minsAgo} menit lalu • Coba refresh manual`;
      if (addrEl)  addrEl.textContent  = `${getServerHost()}:${getServerPort()} (data lama)`;
    } else {
      if (lastUpd) lastUpd.textContent = 'Gagal mengambil data — coba refresh manual';
      if (addrEl)  addrEl.textContent  = 'Tidak dapat terhubung ke API';
    }

  } finally {
    if (btn) { btn.textContent = '↻ REFRESH STATUS'; btn.disabled = false; }
  }
}

// Mulai fetch pertama
fetchServerStatus();

// Auto-refresh setiap 60 detik, pause saat tab tidak aktif
let _fetchTimer = setInterval(fetchServerStatus, 60000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearInterval(_fetchTimer);
  } else {
    fetchServerStatus();
    _fetchTimer = setInterval(fetchServerStatus, 60000);
  }
});
