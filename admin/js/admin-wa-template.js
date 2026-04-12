/* ════════════════════════════════════════════════════════════════
   admin-wa-template.js — Editor Format Pesan Pemesanan WA
   Menyimpan template ke shop_config key='wa_template' di Supabase.
   Frontend (shop-supabase.js) membaca key ini lalu override
   fungsi buildOrderMessage() di shop.js.
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const DEFAULT_TEMPLATE =
    'Halo Admin Laughtale Store!\n\n' +
    'Saya ingin memesan:\n' +
    'Item    : {item}\n' +
    'Jumlah  : {qty}x\n' +
    'Harga   : Rp {harga}\n' +
    'Username: {username}\n' +
    'Catatan : {catatan}\n\n' +
    'Mohon konfirmasi pesanan saya. Terima kasih!';

  const DEFAULT_GREETING =
    'Halo Admin, saya ingin bertanya tentang item di Laughtale Store.';

  let templateDirty = false;

  function getSb() { return window._adminSb; }

  /* ── Inject nav sidebar ── */
  document.addEventListener('DOMContentLoaded', () => {
    injectNav();
    injectSection();
  });

  function injectNav() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    const item = document.createElement('div');
    item.className = 'nav-item';
    item.id = 'nav-wa-template';
    item.innerHTML = `
      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      Format Pesan`;
    item.onclick = () => showTemplateSection(item);
    sidebar.appendChild(item);
  }

  function showTemplateSection(el) {
    if (typeof showSection === 'function') {
      showSection('wa-template', el);
    } else {
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const sec = document.getElementById('sec-wa-template');
      if (sec) sec.classList.add('active');
      if (el) el.classList.add('active');
      const bc = document.getElementById('topbar-section');
      if (bc) bc.textContent = 'Format Pesan';
    }
    loadTemplate();
  }

  /* ── Inject HTML section ── */
  function injectSection() {
    const main = document.querySelector('.main-content');
    if (!main) return;

    const sec = document.createElement('div');
    sec.className = 'section';
    sec.id = 'sec-wa-template';
    sec.innerHTML = `
      <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="page-title">Format Pesan Pemesanan</div>
          <div class="page-sub">Atur template pesan WhatsApp yang dikirim pembeli saat checkout</div>
        </div>
        <button class="save-btn" id="wt-save-btn" onclick="window._wtSave()" style="opacity:.4;cursor:not-allowed" disabled>
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Simpan Perubahan
        </button>
      </div>

      <div id="wt-loading" style="padding:2rem;color:var(--text-faint);font-size:13px">Memuat template…</div>

      <div id="wt-body" style="display:none">

        <!-- Greeting -->
        <div class="scfg-card" style="max-width:720px;margin-bottom:14px">
          <div class="scfg-card-title">Pesan Sapaan (Greeting)</div>
          <div class="field">
            <label>Pesan yang tampil saat pembeli klik tombol tanya/chat admin tanpa order spesifik</label>
            <textarea id="wt-greeting" rows="3" oninput="window._wtDirty()"
              style="font-family:monospace;font-size:13px;line-height:1.6"></textarea>
          </div>
        </div>

        <!-- Template -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;max-width:960px" id="wt-grid">

          <div class="scfg-card">
            <div class="scfg-card-title">Template Pesan Pesanan</div>
            <div class="field">
              <label>Gunakan placeholder di bawah. Tekan Reset untuk kembali ke default.</label>
              <textarea id="wt-template" rows="14" oninput="window._wtDirty();window._wtPreview()"
                style="font-family:monospace;font-size:13px;line-height:1.7;resize:vertical"></textarea>
            </div>
            <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn-ghost" style="font-size:12px" onclick="window._wtReset()">Reset ke Default</button>
            </div>
            <!-- Placeholder chips -->
            <div style="margin-top:12px">
              <div style="font-size:11px;color:var(--text-faint);margin-bottom:6px;font-weight:600;letter-spacing:.5px">PLACEHOLDER TERSEDIA</div>
              <div style="display:flex;flex-wrap:wrap;gap:6px" id="wt-chips"></div>
            </div>
          </div>

          <div class="scfg-card">
            <div class="scfg-card-title">Preview Pesan</div>
            <div style="font-size:11px;color:var(--text-faint);margin-bottom:10px">Tampilan hasil pesan yang akan dikirim pembeli</div>
            <div id="wt-preview-box"
              style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);
                     padding:14px;font-size:13px;line-height:1.8;white-space:pre-wrap;
                     color:var(--text);min-height:200px;font-family:monospace">
            </div>
            <div style="margin-top:10px;font-size:11px;color:var(--text-faint)">
              Preview menggunakan data contoh. Nilai sebenarnya diisi pembeli saat checkout.
            </div>
          </div>

        </div>
      </div>
    `;

    injectStyles();
    main.appendChild(sec);
    registerGlobals();
    buildChips();
    applyGridResponsive();
  }

  function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      #wt-save-btn.dirty {
        opacity:1 !important; cursor:pointer !important;
        background:var(--accent) !important;
        animation:savePulse 1.5s ease-in-out infinite;
      }
      .wt-chip {
        display:inline-block; padding:3px 9px;
        background:var(--surface2); border:1px solid var(--border2);
        border-radius:20px; font-size:11.5px; font-family:monospace;
        color:var(--text-muted); cursor:pointer; transition:all .15s;
        user-select:none;
      }
      .wt-chip:hover {
        background:var(--accent-muted); border-color:rgba(79,125,240,.3);
        color:var(--accent);
      }
      @media(max-width:680px){
        #wt-grid { grid-template-columns:1fr !important; }
      }
    `;
    document.head.appendChild(s);
  }

  const PLACEHOLDERS = [
    { key: '{item}',      label: 'Nama item' },
    { key: '{qty}',       label: 'Jumlah' },
    { key: '{harga}',     label: 'Harga total (Rp)' },
    { key: '{username}',  label: 'Username MC' },
    { key: '{catatan}',   label: 'Catatan pembeli' },
    { key: '{kategori}',  label: 'Kategori item' },
  ];

  const PREVIEW_SAMPLE = {
    '{item}':     'Name Style (Chat)',
    '{qty}':      '2',
    '{harga}':    '30.000',
    '{username}': 'SteveCraft123',
    '{catatan}':  'Warna merah & putih',
    '{kategori}': 'Custom Nametag',
  };

  function buildChips() {
    const el = document.getElementById('wt-chips');
    if (!el) return;
    el.innerHTML = PLACEHOLDERS.map(p =>
      `<span class="wt-chip" title="${p.label}" onclick="window._wtInsert('${p.key}')">${p.key}</span>`
    ).join('');
  }

  function applyGridResponsive() {
    /* handled by CSS media query */
  }

  /* ── Load template dari Supabase ── */
  async function loadTemplate() {
    const loadEl = document.getElementById('wt-loading');
    const bodyEl = document.getElementById('wt-body');
    loadEl.style.display = 'block';
    loadEl.textContent   = 'Memuat template…';
    bodyEl.style.display = 'none';

    const sb = getSb();
    if (!sb) { loadEl.textContent = 'Supabase belum siap.'; return; }

    const { data, error } = await sb
      .from('shop_config')
      .select('value')
      .eq('key', 'wa_template')
      .maybeSingle();

    let tpl = DEFAULT_TEMPLATE;
    let greeting = DEFAULT_GREETING;

    if (!error && data?.value) {
      try {
        const parsed = JSON.parse(data.value);
        tpl      = parsed.template || DEFAULT_TEMPLATE;
        greeting = parsed.greeting || DEFAULT_GREETING;
      } catch { tpl = data.value; }
    }

    document.getElementById('wt-template').value = tpl;
    document.getElementById('wt-greeting').value  = greeting;
    templateDirty = false;
    updateSaveBtn();
    updatePreview(tpl);

    loadEl.style.display = 'none';
    bodyEl.style.display = 'block';
  }

  /* ── Preview ── */
  function updatePreview(tpl) {
    let result = tpl || '';
    Object.entries(PREVIEW_SAMPLE).forEach(([k, v]) => {
      result = result.split(k).join(v);
    });
    const box = document.getElementById('wt-preview-box');
    if (box) box.textContent = result;
  }

  /* ── Simpan ke Supabase ── */
  async function saveTemplate() {
    const sb = getSb();
    if (!sb) { toast('Supabase belum siap.', 'error'); return; }

    const tpl      = document.getElementById('wt-template').value;
    const greeting = document.getElementById('wt-greeting').value.trim();

    const btn = document.getElementById('wt-save-btn');
    btn.disabled    = true;
    btn.textContent = 'Menyimpan…';

    const value = JSON.stringify({ template: tpl, greeting });

    const { error } = await sb.from('shop_config').upsert(
      { key: 'wa_template', value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );

    btn.disabled    = false;
    btn.innerHTML   = saveBtnInner();

    if (error) { toast('Gagal: ' + error.message, 'error'); markDirty(); return; }

    templateDirty = false;
    btn.classList.remove('dirty');
    btn.disabled = true;
    btn.style.opacity = '.4';
    btn.style.cursor  = 'not-allowed';
    toast('Template berhasil disimpan.');
  }

  function saveBtnInner() {
    return `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Simpan Perubahan`;
  }

  /* ── Insert placeholder ke cursor posisi textarea ── */
  function insertPlaceholder(key) {
    const ta = document.getElementById('wt-template');
    if (!ta) return;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    ta.value = ta.value.substring(0, start) + key + ta.value.substring(end);
    ta.selectionStart = ta.selectionEnd = start + key.length;
    ta.focus();
    markDirty();
    updatePreview(ta.value);
  }

  function markDirty() {
    templateDirty = true;
    updateSaveBtn();
  }

  function updateSaveBtn() {
    const btn = document.getElementById('wt-save-btn');
    if (!btn) return;
    if (templateDirty) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor  = 'pointer';
      btn.classList.add('dirty');
    } else {
      btn.disabled = true;
      btn.style.opacity = '.4';
      btn.style.cursor  = 'not-allowed';
      btn.classList.remove('dirty');
    }
  }

  function resetTemplate() {
    if (!confirm('Reset template ke default? Perubahan yang belum disimpan akan hilang.')) return;
    document.getElementById('wt-template').value = DEFAULT_TEMPLATE;
    markDirty();
    updatePreview(DEFAULT_TEMPLATE);
  }

  function registerGlobals() {
    window._wtSave    = saveTemplate;
    window._wtDirty   = markDirty;
    window._wtPreview = () => updatePreview(document.getElementById('wt-template').value);
    window._wtReset   = resetTemplate;
    window._wtInsert  = insertPlaceholder;
  }

  function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = 'toast-item toast-' + type;
    el.textContent = msg;
    const c = document.getElementById('toast');
    if (c) { c.appendChild(el); setTimeout(() => el.remove(), 3200); }
  }

})();
