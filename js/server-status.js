/* ══════════════════════════════════════════════════════
   server-status.js — Realtime server status via mcsrvstat.us
   ══════════════════════════════════════════════════════ */

// ⚙ Ganti dengan IP/domain server kamu
const SERVER_HOST = 'laughtale.my.id';
const SERVER_PORT = 19214; // Port Bedrock default

async function fetchServerStatus() {
  const btn = document.getElementById('refresh-btn');
  btn.textContent = '↻ MEMUAT...';
  btn.style.pointerEvents = 'none';

  const startTime = Date.now();

  try {
    const res = await fetch(`https://api.mcsrvstat.us/bedrock/2/${SERVER_HOST}`);
    const latency = Date.now() - startTime;
    const data = await res.json();

    document.getElementById('latency-display').textContent = latency;

    if (data.online) {
      // ── ONLINE ──
      const dot = document.getElementById('status-dot-emoji');
      dot.textContent = '🟢';
      dot.style.background = 'var(--emerald)';
      dot.style.boxShadow = '0 0 20px rgba(23,221,98,0.5)';

      const label = document.getElementById('status-text-label');
      label.textContent = 'ONLINE';
      label.style.color = 'var(--emerald)';

      const onlinePlayers = data.players?.online ?? 0;
      const maxPlayers   = data.players?.max ?? '?';
      const version      = data.version ?? 'Bedrock';

      document.getElementById('online-players').textContent  = onlinePlayers;
      document.getElementById('max-players').textContent     = maxPlayers;
      document.getElementById('server-version').textContent  = version;
      document.getElementById('server-address-display').textContent = `📌 ${SERVER_HOST}:${SERVER_PORT}`;
      document.getElementById('hero-player-count').textContent = onlinePlayers;

      // Player list
      if (data.players?.list && data.players.list.length > 0) {
        const listWrap = document.getElementById('player-list-wrap');
        const listEl   = document.getElementById('player-list');
        listWrap.style.display = 'block';
        listEl.innerHTML = data.players.list.map(p =>
          `<span style="background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:4px 10px;font-size:0.82rem;font-weight:700;">👤 ${p}</span>`
        ).join('');
      }

    } else {
      // ── OFFLINE ──
      const dot = document.getElementById('status-dot-emoji');
      dot.textContent = '🔴';
      dot.style.background = 'var(--redstone)';
      dot.style.boxShadow = '0 0 20px rgba(255,58,58,0.5)';

      const label = document.getElementById('status-text-label');
      label.textContent = 'OFFLINE';
      label.style.color = 'var(--redstone)';

      document.getElementById('online-players').textContent = '0';
      document.getElementById('hero-player-count').textContent = '0';
      document.getElementById('server-address-display').textContent = `📌 ${SERVER_HOST} — Server sedang mati`;
    }

    const now = new Date();
    document.getElementById('uptime-display').textContent = now.toLocaleTimeString('id-ID');
    document.getElementById('last-updated-text').textContent =
      `Terakhir diperbarui: ${now.toLocaleTimeString('id-ID')} WIB • Auto-refresh setiap 60 detik`;

  } catch (err) {
    document.getElementById('status-dot-emoji').textContent = '🟡';

    const label = document.getElementById('status-text-label');
    label.textContent = 'ERROR';
    label.style.color = 'var(--gold)';

    document.getElementById('last-updated-text').textContent = 'Gagal mengambil data — coba refresh manual';
    document.getElementById('server-address-display').textContent = '⚠ Tidak dapat terhubung ke API';
  }

  btn.textContent = '↻ REFRESH STATUS';
  btn.style.pointerEvents = 'auto';
}

// Auto-fetch saat halaman dimuat & setiap 60 detik
fetchServerStatus();
setInterval(fetchServerStatus, 60000);
