// ==================== SERVER STATUS CONFIG ====================
function onProviderChange() {
  const provider = document.getElementById('cfg-status_api_provider')?.value || 'mcsrvstat';
  const wrap = document.getElementById('ss-custom-url-wrap');
  if (wrap) wrap.style.display = provider === 'custom' ? 'block' : 'none';
  updateStatusPreview();
}

function updateStatusPreview() {
  const provider = document.getElementById('cfg-status_api_provider')?.value || 'mcsrvstat';
  const interval = document.getElementById('cfg-status_refresh_interval')?.value || '60';
  const customUrl= document.getElementById('cfg-status_custom_url')?.value || '';
  const ip = configData['server_ip']?.value || 'laughtale.my.id:19214';
  const [host, port] = ip.split(':');

  let apiUrl = '';
  if (provider === 'mcsrvstat') {
    apiUrl = `https://api.mcsrvstat.us/bedrock/3/${host}:${port||19214}`;
  } else if (provider === 'mcstatus') {
    apiUrl = `https://api.mcstatus.io/v2/status/bedrock/${host}:${port||19214}`;
  } else {
    apiUrl = customUrl
      .replace('{host}', host || 'laughtale.my.id')
      .replace('{port}', port || '19214') || '(belum diisi)';
  }

  const pvUrl = document.getElementById('pv-api-url');
  const pvInt = document.getElementById('pv-refresh-interval');
  if (pvUrl) pvUrl.textContent = apiUrl;
  if (pvInt) pvInt.textContent = interval + ' detik';
}

async function testStatusConnection() {
  const provider = document.getElementById('cfg-status_api_provider')?.value || 'mcsrvstat';
  const customUrl= document.getElementById('cfg-status_custom_url')?.value || '';
  const ip = configData['server_ip']?.value || 'laughtale.my.id:19214';
  const [host, port] = ip.split(':');

  let apiUrl = '';
  if (provider === 'mcsrvstat') {
    apiUrl = `https://api.mcsrvstat.us/bedrock/3/${host}:${port||19214}`;
  } else if (provider === 'mcstatus') {
    apiUrl = `https://api.mcstatus.io/v2/status/bedrock/${host}:${port||19214}`;
  } else {
    apiUrl = customUrl.replace('{host}', host).replace('{port}', port||'19214');
  }

  const orbDot = document.getElementById('ss-orb-dot');
  const statusTxt = document.getElementById('ss-status-text');
  const ipTxt = document.getElementById('ss-ip-text');
  const plTxt = document.getElementById('ss-players');
  const latTxt = document.getElementById('ss-latency');

  if (orbDot) orbDot.className = 'live-indicator-dot';
  if (statusTxt) statusTxt.textContent = 'Mengecek...';
  if (ipTxt) ipTxt.textContent = apiUrl;

  const start = Date.now();
  try {
    const res  = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    const lat  = Date.now() - start;

    // Support mcsrvstat & mcstatus.io response format
    const online  = data.online ?? data.online;
    const players = data.players?.online ?? data.players?.online ?? 0;
    const maxPl   = data.players?.max ?? '?';

    if (online) {
      if (orbDot)    orbDot.className    = 'live-indicator-dot green pulse';
      if (statusTxt) statusTxt.textContent = 'Server Online ✓';
      if (ipTxt)     ipTxt.textContent   = apiUrl;
      if (plTxt)     plTxt.textContent   = players + ' / ' + maxPl + ' pemain';
      if (latTxt)    latTxt.textContent  = lat + ' ms';
      toast('Koneksi berhasil! Server online, latency ' + lat + 'ms.');
    } else {
      if (orbDot)    orbDot.className    = 'live-indicator-dot red';
      if (statusTxt) statusTxt.textContent = 'Server Offline';
      if (ipTxt)     ipTxt.textContent   = 'API berhasil dihubungi tapi server offline';
      if (plTxt)     plTxt.textContent   = '0 pemain';
      if (latTxt)    latTxt.textContent  = lat + ' ms';
      toast('API OK tapi server offline saat ini.', 'error');
    }
  } catch(e) {
    if (orbDot)    orbDot.className    = 'live-indicator-dot red';
    if (statusTxt) statusTxt.textContent = 'Gagal terhubung';
    if (ipTxt)     ipTxt.textContent   = e.message || 'Timeout / CORS error';
    toast('Gagal test koneksi: ' + (e.message || 'timeout'), 'error');
  }
}

// ==================== UTILS ====================
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toast(msg, type='success') {
  const el = document.createElement('div');
  el.className = 'toast-item toast-' + type;
  el.textContent = msg;
  document.getElementById('toast').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}