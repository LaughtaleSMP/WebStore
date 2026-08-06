// ==================== WA ADMINS ====================
async function loadWAAdmins() {
  const mainRow = configData['whatsapp_admins'];
  const gemRow  = configData['whatsapp_gem_admins'];
  try { waAdmins.main = JSON.parse(mainRow?.value || '[]'); } catch { waAdmins.main = []; }
  try { waAdmins.gem  = JSON.parse(gemRow?.value  || '[]'); } catch { waAdmins.gem  = []; }

  // Fallback to shop_config if site_config is empty
  if ((!waAdmins.main || !waAdmins.main.length) || (!waAdmins.gem || !waAdmins.gem.length)) {
    try {
      const { data: cfgRow } = await sb.from("shop_config").select("value").eq("key", "main").single();
      if (cfgRow?.value) {
        const parsed = JSON.parse(cfgRow.value);
        if ((!waAdmins.main || !waAdmins.main.length) && parsed.admins) {
          waAdmins.main = parsed.admins;
        }
        if ((!waAdmins.gem || !waAdmins.gem.length) && parsed.gemAdmins) {
          waAdmins.gem = parsed.gemAdmins;
        }
      }
    } catch(e) {
      console.warn('[AdminWA] Fallback shop_config load error:', e);
    }
  }

  renderWAList('main');
  renderWAList('gem');
}

function renderWAList(type) {
  const container = document.getElementById('wa-' + type + '-list');
  const list = waAdmins[type];
  if (!list || !list.length) {
    container.innerHTML = '<div class="empty-state">Belum ada admin ' + (type==='gem' ? 'Gem Coins' : '') + ' terdaftar.</div>';
    return;
  }
  container.innerHTML = list.map((a, i) => `
    <div class="admin-item">
      <div class="admin-avatar">${esc(a.name ? a.name[0] : 'A')}</div>
      <div class="admin-info">
        <strong>${esc(a.name || 'Admin')}</strong>
        <span>+${esc(a.number || '')}</span>
      </div>
      <span class="admin-badge ${type==='gem'?'badge-gem':'badge-admin'}">${type==='gem'?'Gem':'Shop'}</span>
      <button class="btn-icon" onclick="removeAdminWA('${type}', ${i})" title="Hapus">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      </button>
    </div>`).join('');
}

function addAdminWA(type) {
  waAddingFor = type;
  document.getElementById('wa-add-title').textContent = 'Tambah Admin ' + (type==='gem' ? 'Gem Coins' : 'Shop');
  document.getElementById('wa-new-name').value   = '';
  document.getElementById('wa-new-number').value = '';
  document.getElementById('wa-add-form').style.display = 'block';
  document.getElementById('wa-new-name').focus();
}

function cancelAddWA() {
  document.getElementById('wa-add-form').style.display = 'none';
  waAddingFor = null;
}

async function saveAdminWA() {
  const name   = document.getElementById('wa-new-name').value.trim();
  const number = document.getElementById('wa-new-number').value.trim();
  if (!name || !number) { toast('Nama dan nomor wajib diisi.', 'error'); return; }
  if (!/^62/.test(number)) { toast('Nomor harus diawali 62 (contoh: 6281xxx)', 'error'); return; }

  if (!waAdmins[waAddingFor]) waAdmins[waAddingFor] = [];
  waAdmins[waAddingFor].push({ name, number });
  await saveWAAdmins(waAddingFor);
  renderWAList(waAddingFor);
  cancelAddWA();
  toast('Admin berhasil ditambahkan.');
}

async function removeAdminWA(type, idx) {
  if (!confirm('Hapus admin "' + waAdmins[type][idx].name + '"?')) return;
  waAdmins[type].splice(idx, 1);
  await saveWAAdmins(type);
  renderWAList(type);
  toast('Admin dihapus.');
}

async function saveWAAdmins(type) {
  const key   = type === 'gem' ? 'whatsapp_gem_admins' : 'whatsapp_admins';
  const value = JSON.stringify(waAdmins[type]);
  
  // 1. Update/insert to site_config
  if (configData[key]) {
    await sb.from('site_config').update({ value }).eq('key', key);
    configData[key].value = value;
  } else {
    await sb.from('site_config').insert({ key, value, description: 'Admin WhatsApp ' + type });
    configData[key] = { key, value };
  }

  // 2. Dual-sync to shop_config (key='main') to keep both in sync
  try {
    const { data: cfgRow } = await sb.from("shop_config").select("value").eq("key", "main").single();
    let shopMeta = cfgRow?.value ? JSON.parse(cfgRow.value) : {};
    if (type === 'gem') shopMeta.gemAdmins = waAdmins.gem;
    else shopMeta.admins = waAdmins.main;
    await sb.from("shop_config").upsert({ key: "main", value: JSON.stringify(shopMeta) });
  } catch(e) {
    console.warn('[AdminWA] shop_config dual-sync error:', e);
  }
}