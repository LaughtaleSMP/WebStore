/* ══════════════════════════════════════════════════════
   server-status.js — Realtime server status via mcsrvstat.us
   (Embedded inline — orb CSS class version)
══════════════════════════════════════════════════════ */

// Sync dari SERVER_CONFIG agar tidak perlu ganti di 2 tempat
const SERVER_HOST = (window.SERVER_CONFIG && window.SERVER_CONFIG.ip)
  ? window.SERVER_CONFIG.ip.split(':')[0]
  : 'laughtale.my.id';
const SERVER_PORT = (window.SERVER_CONFIG && window.SERVER_CONFIG.ip)
  ? parseInt(window.SERVER_CONFIG.ip.split(':')[1]) || 19214
  : 19214;

// Stale data cache — pertahankan data terakhir saat error
let _lastServerData = null;
let _lastFetchTime  = null;

function setOrbState(dot, label, state, text, color) {
  dot.className = 'status-dot ' + state;
  label.textContent = text;
  label.style.color = color;
}

let _lastRefreshTime = 0;

async function fetchServerStatus() {
  const btn = document.getElementById('refresh-btn');
  if (!btn) return;

  // Cooldown 10 detik — cegah spam klik
  const now = Date.now();
  if (now - _lastRefreshTime < 10000 && _lastRefreshTime !== 0) {
    const wait = Math.ceil((10000 - (now - _lastRefreshTime)) / 1000);
    btn.textContent = `↻ TUNGGU ${wait}s...`;
    setTimeout(() => { if(btn) btn.textContent = '↻ REFRESH STATUS'; }, wait * 1000);
    return;
  }
  _lastRefreshTime = now;

  btn.textContent = '↻ MEMUAT...';
  btn.disabled = true;

  const startTime = Date.now();

  // Timeout 8 detik agar tombol tidak stuck "MEMUAT..." selamanya
  const controller = new AbortController();
  const fetchTimeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`https://api.mcsrvstat.us/bedrock/3/${SERVER_HOST}:${SERVER_PORT}`, { signal: controller.signal });
    clearTimeout(fetchTimeout);
    const latency = Date.now() - startTime;
    const data = await res.json();

    const dot   = document.getElementById('status-dot-emoji');
    const label = document.getElementById('status-text-label');

    document.getElementById('latency-display').textContent = latency;

    // Simpan data valid terakhir
    _lastServerData = data;
    _lastFetchTime  = new Date();

    if (data.online) {
      // ── ONLINE ──
      setOrbState(dot, label, 'is-online', 'ONLINE', 'var(--green)');
      // Remove skeleton shimmer from live-stat values
      document.querySelectorAll('.skel-val').forEach(el => el.classList.add('loaded'));

      const onlinePlayers = data.players?.online ?? 0;
      const maxPlayers    = data.players?.max ?? '?';
      const version       = data.version ?? 'Bedrock';

      document.getElementById('online-players').textContent  = onlinePlayers;
      document.getElementById('max-players').textContent     = maxPlayers;
      document.getElementById('server-version').textContent  = version;
      document.getElementById('server-address-display').textContent = `${SERVER_HOST}:${SERVER_PORT}`;
      // hero-player-count locked to 6

      // Player list
      const listWrap = document.getElementById('player-list-wrap');
      const listEl   = document.getElementById('player-list');
      if (data.players?.list && data.players.list.length > 0) {
        if (listWrap) listWrap.style.display = 'block';
        // XSS-safe: escape HTML sebelum inject ke DOM
        function escHtml(s) {
          return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
                          .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        }
        if (listEl) listEl.innerHTML = data.players.list.map(p =>
          `<span style="font-size:0.82rem;padding:4px 10px;background:rgba(255,255,255,0.05);border-radius:6px;border:1px solid var(--border)">${escHtml(p)}</span>`
        ).join('');
      } else {
        if (listWrap) listWrap.style.display = 'none';
      }

    } else {
      // ── OFFLINE ──
      setOrbState(dot, label, 'is-offline', 'OFFLINE', 'var(--redstone)');
      document.querySelectorAll('.skel-val').forEach(el => el.classList.add('loaded'));
      document.getElementById('online-players').textContent  = '0';
      // hero-player-count locked to 6
      document.getElementById('server-address-display').textContent = `${SERVER_HOST} — Server sedang mati`;
      const listWrap = document.getElementById('player-list-wrap');
      if (listWrap) listWrap.style.display = 'none';
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID');
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
    const addr    = document.getElementById('server-address-display');
    // Tampilkan data lama jika tersedia (stale data)
    if (_lastServerData && _lastFetchTime) {
      const minsAgo = Math.round((Date.now() - _lastFetchTime) / 60000);
      if (lastUpd) lastUpd.textContent = `⚠ Gagal refresh — data dari ${minsAgo} menit lalu • Coba refresh manual`;
      if (addr)    addr.textContent    = `${SERVER_HOST}:${SERVER_PORT} (data lama)`;
    } else {
      if (lastUpd) lastUpd.textContent = 'Gagal mengambil data — coba refresh manual';
      if (addr)    addr.textContent    = '⚠ Tidak dapat terhubung ke API';
    }
  } finally {
    if (btn) {
      btn.textContent = '↻ REFRESH STATUS';
      btn.disabled = false;
    }
  }
}

// Mulai fetch pertama
fetchServerStatus();

// Pause auto-refresh saat tab tidak aktif — hemat bandwidth
let _fetchTimer = setInterval(fetchServerStatus, 60000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearInterval(_fetchTimer);
  } else {
    // Tab aktif lagi — fetch langsung lalu set ulang interval
    fetchServerStatus();
    _fetchTimer = setInterval(fetchServerStatus, 60000);
  }
});
