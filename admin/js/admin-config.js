// ==================== CONFIG ====================
async function loadAllConfig() {
  const { data, error } = await sb.from('site_config').select('*');
  if (error) { toast('Gagal memuat konfigurasi: ' + error.message, 'error'); return; }

  configData = {};
  (data || []).forEach(row => { configData[row.key] = row; });

  const fields = [
    'server_ip','server_name','server_type',
    'maintenance_mode','maintenance_message','maintenance_eta','maintenance_contact',
    'motd_text','motd_type','motd_btn','motd_url',
    'season','seed','season_start','season_status','season_desc',
    'status_api_provider','status_refresh_interval','status_custom_url'
  ];
  fields.forEach(key => {
    const el = document.getElementById('cfg-' + key);
    if (!el) return;
    const val = configData[key]?.value || '';
    el.value = val;
  });

  // Maintenance toggle
  const maint = configData['maintenance_mode']?.value === 'true';
  const maintToggle = document.getElementById('toggle-maintenance');
  maint ? maintToggle.classList.add('on') : maintToggle.classList.remove('on');
  document.getElementById('maint-on-preview').style.display = maint ? 'block' : 'none';
  const pill = document.getElementById('maint-status-pill');
  pill.className = 'status-pill ' + (maint ? 'pill-maintenance' : 'pill-online');
  pill.innerHTML = '<span class="pill-dot"></span>' + (maint ? 'Maintenance' : 'Normal');

  // Status config toggles
  const showLatency    = configData['status_show_latency']?.value    !== 'false';
  const showPlayerlist = configData['status_show_playerlist']?.value !== 'false';
  const pauseHidden    = configData['status_pause_hidden']?.value    !== 'false';
  const tLatency    = document.getElementById('toggle-status_show_latency');
  const tPlayerlist = document.getElementById('toggle-status_show_playerlist');
  const tPause      = document.getElementById('toggle-status_pause_hidden');
  if (tLatency)    showLatency    ? tLatency.classList.add('on')    : tLatency.classList.remove('on');
  if (tPlayerlist) showPlayerlist ? tPlayerlist.classList.add('on') : tPlayerlist.classList.remove('on');
  if (tPause)      pauseHidden    ? tPause.classList.add('on')      : tPause.classList.remove('on');
  onProviderChange();
  updateStatusPreview();

  // MOTD toggle
  const motdActive = configData['motd_active']?.value === 'true';
  const motdToggle = document.getElementById('toggle-motd-active');
  motdActive ? motdToggle.classList.add('on') : motdToggle.classList.remove('on');

  updateServerPreview();
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

async function saveSection(section) {
  const btn = event.target;
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  let updates = {};

  if (section === 'server') {
    updates = {
      server_ip:   getVal('cfg-server_ip'),
      server_name: getVal('cfg-server_name'),
      server_type: getVal('cfg-server_type'),
    };
  } else if (section === 'maintenance') {
    updates = {
      maintenance_mode:    document.getElementById('toggle-maintenance').classList.contains('on') ? 'true' : 'false',
      maintenance_message: getVal('cfg-maintenance_message'),
      maintenance_eta:     getVal('cfg-maintenance_eta'),
      maintenance_contact: getVal('cfg-maintenance_contact'),
    };
  } else if (section === 'motd') {
    updates = {
      motd_active: document.getElementById('toggle-motd-active').classList.contains('on') ? 'true' : 'false',
      motd_text:   getVal('cfg-motd_text'),
      motd_type:   getVal('cfg-motd_type'),
      motd_btn:    getVal('cfg-motd_btn'),
      motd_url:    getVal('cfg-motd_url'),
    };
  } else if (section === 'server-status') {
    updates = {
      status_api_provider:      getVal('cfg-status_api_provider'),
      status_refresh_interval:  getVal('cfg-status_refresh_interval') || '60',
      status_custom_url:        getVal('cfg-status_custom_url'),
      status_show_latency:      document.getElementById('toggle-status_show_latency').classList.contains('on') ? 'true' : 'false',
      status_show_playerlist:   document.getElementById('toggle-status_show_playerlist').classList.contains('on') ? 'true' : 'false',
      status_pause_hidden:      document.getElementById('toggle-status_pause_hidden').classList.contains('on') ? 'true' : 'false',
    };
  } else if (section === 'season') {
    updates = {
      season:         getVal('cfg-season'),
      seed:           getVal('cfg-seed'),
      season_start:   getVal('cfg-season_start'),
      season_status:  getVal('cfg-season_status'),
      season_desc:    getVal('cfg-season_desc'),
    };
  }

  let hasError = false;
  for (const [key, value] of Object.entries(updates)) {
    if (configData[key]) {
      const { error } = await sb.from('site_config').update({ value }).eq('key', key);
      if (error) { toast('Gagal simpan ' + key + ': ' + error.message, 'error'); hasError = true; }
      else configData[key].value = value;
    } else {
      const { error } = await sb.from('site_config').insert({ key, value, description: key });
      if (error) { toast('Gagal buat ' + key + ': ' + error.message, 'error'); hasError = true; }
      else configData[key] = { key, value };
    }
  }

  if (!hasError) toast('Konfigurasi berhasil disimpan.');

  await loadAllConfig();
  btn.disabled = false;
  btn.textContent = origText;
}

// ==================== MAINTENANCE TOGGLE ====================
function toggleMaintenance(el) {
  el.classList.toggle('on');
  const on = el.classList.contains('on');
  document.getElementById('maint-on-preview').style.display = on ? 'block' : 'none';
  const pill = document.getElementById('maint-status-pill');
  pill.className = 'status-pill ' + (on ? 'pill-maintenance' : 'pill-online');
  pill.innerHTML = '<span class="pill-dot"></span>' + (on ? 'Maintenance' : 'Normal');
}

// ==================== SERVER PREVIEW ====================
function updateServerPreview() {
  document.getElementById('pv-ip').textContent   = getVal('cfg-server_ip')   || '—';
  document.getElementById('pv-type').textContent = getVal('cfg-server_type') || '—';
  document.getElementById('pv-name').textContent = getVal('cfg-server_name') || '—';
}

// ==================== LIVE STATUS ====================
async function fetchLiveStatus() {
  const ip = (configData['server_ip']?.value || 'laughtale.my.id:19214');
  const [host, port] = ip.split(':');
  const start = Date.now();
  const orbDot = document.getElementById('live-orb-dot');
  try {
    const res  = await fetch(`https://api.mcsrvstat.us/bedrock/3/${host}:${port||19214}`, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    const lat  = Date.now() - start;
    const txt  = document.getElementById('live-status-text');
    const ipEl = document.getElementById('live-ip-text');
    const pl   = document.getElementById('live-players');
    const ltEl = document.getElementById('live-latency');
    if (data.online) {
      orbDot.className = 'live-indicator-dot green pulse';
      txt.textContent = 'Server Online';
      ipEl.textContent = host + ':' + (port||19214);
      pl.textContent   = (data.players?.online||0) + ' / ' + (data.players?.max||'?') + ' pemain';
      ltEl.textContent = lat + ' ms';
    } else {
      orbDot.className = 'live-indicator-dot red';
      txt.textContent = 'Server Offline';
      ipEl.textContent = host + ':' + (port||19214);
      pl.textContent   = '0 pemain';
      ltEl.textContent = lat + ' ms';
    }
  } catch(e) {
    orbDot.className = 'live-indicator-dot red';
    document.getElementById('live-status-text').textContent = 'Gagal mengambil status';
    document.getElementById('live-ip-text').textContent = 'Periksa koneksi atau IP server';
  }
}