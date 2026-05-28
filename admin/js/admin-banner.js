/* ================================================================
   admin-banner.js — Multi-image Banner Popup via Supabase Storage
   Stores config in site_config key='banner_popup'
   Images uploaded to Supabase Storage bucket 'banners' (public)
================================================================ */
(function () {
  'use strict';

  let dirty = false;
  let bannerImages = []; // [{url}]

  function getSb() { return window._adminSb; }
  function toast(msg, type = 'success') {
    if (typeof window.showAdminToast === 'function') { window.showAdminToast(msg, type); return; }
    const el = document.createElement('div');
    el.className = 'toast-item toast-' + type;
    el.textContent = msg;
    const c = document.getElementById('toast');
    if (c) { c.appendChild(el); setTimeout(() => el.remove(), 3200); }
  }
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /* ── Inject nav ── */
  document.addEventListener('DOMContentLoaded', () => { injectNav(); injectSection(); });

  function injectNav() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || document.getElementById('nav-banner')) return;
    const item = document.createElement('div');
    item.className = 'nav-item'; item.id = 'nav-banner';
    item.innerHTML = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg> Banner Popup`;
    item.onclick = () => showBannerSection(item);
    const anchor = document.querySelector('.nav-item[onclick*="season"]');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(item, anchor.nextSibling);
    else sidebar.appendChild(item);
  }

  function showBannerSection(el) {
    if (typeof showSection === 'function') showSection('banner', el);
    else {
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const sec = document.getElementById('sec-banner'); if (sec) sec.classList.add('active');
      if (el) el.classList.add('active');
      const bc = document.getElementById('topbar-section'); if (bc) bc.textContent = 'Banner Popup';
    }
    loadBanner();
  }

  /* ── Inject Section HTML ── */
  function injectSection() {
    const main = document.querySelector('.main-content');
    if (!main || document.getElementById('sec-banner')) return;
    const sec = document.createElement('div');
    sec.className = 'section'; sec.id = 'sec-banner';
    sec.innerHTML = `
      <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="page-title">Banner Popup</div>
          <div class="page-sub">Gambar popup yang tampil saat pengunjung membuka website. Bisa upload banyak gambar (carousel).</div>
        </div>
        <button class="save-btn" id="bn-save-btn" onclick="window._bnSave()" style="opacity:.4;cursor:not-allowed" disabled>
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Simpan
        </button>
      </div>

      <div id="bn-loading" style="padding:2rem;color:var(--text-faint);font-size:13px">Memuat konfigurasi…</div>

      <div id="bn-body" style="display:none;max-width:860px">

        <!-- Toggle aktif -->
        <div class="card" style="margin-bottom:14px">
          <div class="card-header"><div class="card-title">Status Banner</div></div>
          <div class="toggle-row">
            <div class="toggle-label"><strong>Tampilkan Banner Popup</strong><span>Popup akan muncul kepada pengunjung saat membuka halaman utama</span></div>
            <div class="toggle" id="bn-toggle-active" onclick="this.classList.toggle('on');window._bnDirty()"></div>
          </div>
          <div class="toggle-row">
            <div class="toggle-label"><strong>Tampilkan Hanya Sekali per Sesi</strong><span>Popup hanya muncul sekali, tidak berulang tiap halaman di-refresh</span></div>
            <div class="toggle on" id="bn-toggle-once" onclick="this.classList.toggle('on');window._bnDirty()"></div>
          </div>
        </div>

        <!-- Multi-image upload -->
        <div class="card" style="margin-bottom:14px">
          <div class="card-header">
            <div class="card-title">Gambar Banner</div>
            <span style="font-size:11px;color:var(--text-faint)">Upload via Supabase Storage (aman &amp; cepat)</span>
          </div>

          <!-- Gallery preview -->
          <div id="bn-gallery" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:14px"></div>

          <!-- Upload area -->
          <div id="bn-drop-zone"
            style="border:2px dashed var(--border2);border-radius:10px;padding:24px 20px;text-align:center;cursor:pointer;transition:border-color .2s,background .2s;background:var(--surface2)"
            onclick="document.getElementById('bn-file-input').click()"
            ondragover="event.preventDefault();this.style.borderColor='var(--accent)';this.style.background='var(--accent-muted)'"
            ondragleave="this.style.borderColor='var(--border2)';this.style.background='var(--surface2)'"
            ondrop="window._bnHandleDrop(event)">
            <div style="margin-bottom:6px;opacity:.5"><svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>
            <div style="font-size:13px;color:var(--text-muted)">Klik atau drag & drop gambar ke sini</div>
            <div style="font-size:11px;color:var(--text-faint);margin-top:4px">Bisa upload banyak gambar sekaligus (maks 3MB per file)</div>
            <input type="file" id="bn-file-input" accept="image/*" multiple style="display:none"
              onchange="window._bnHandleFiles(this.files)">
          </div>
          <div id="bn-upload-progress" style="display:none;margin-top:10px">
            <div style="background:var(--surface3);border-radius:20px;height:6px;overflow:hidden">
              <div id="bn-upload-bar" style="height:100%;background:var(--accent);width:0%;transition:width .3s;border-radius:20px"></div>
            </div>
            <div id="bn-upload-status" style="font-size:12px;color:var(--text-muted);margin-top:5px">Mengupload…</div>
          </div>
        </div>

        <!-- Pengaturan popup -->
        <div class="card" style="margin-bottom:14px">
          <div class="card-header"><div class="card-title">Pengaturan Popup</div></div>
          <div class="field" style="margin-bottom:12px">
            <label>Judul Popup (Opsional)</label>
            <input id="bn-title" type="text" placeholder="Contoh: Event Spesial Season 12!" oninput="window._bnDirty()" style="width:100%;box-sizing:border-box">
          </div>
          <div class="field" style="margin-bottom:12px">
            <label>Teks Tombol Aksi (Opsional)</label>
            <input id="bn-btn-text" type="text" placeholder="Contoh: Lihat Selengkapnya" oninput="window._bnDirty()" style="width:100%;box-sizing:border-box">
          </div>
          <div class="field" style="margin-bottom:12px">
            <label>URL Tombol Aksi (Opsional)</label>
            <input id="bn-btn-url" type="url" placeholder="https://..." oninput="window._bnDirty()" style="width:100%;box-sizing:border-box">
          </div>
          <div class="field">
            <label>Delay Tampil (detik, default: 1)</label>
            <input id="bn-delay" type="number" min="0" max="30" value="1" oninput="window._bnDirty()" style="width:120px">
          </div>
        </div>

        <!-- Preview -->
        <div class="card">
          <div class="card-header"><div class="card-title">Preview Popup</div></div>
          <div style="padding:16px 0 8px">
            <button class="btn-ghost" style="font-size:12px;display:inline-flex;align-items:center;gap:5px" onclick="window._bnPreview()">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              Tampilkan Preview
            </button>
            <span style="font-size:11.5px;color:var(--text-faint);margin-left:10px">Preview langsung di panel ini</span>
          </div>
        </div>
      </div>`;
    injectStyles(); main.appendChild(sec); registerGlobals();
  }

  function injectStyles() {
    if (document.getElementById('bn-styles')) return;
    const s = document.createElement('style'); s.id = 'bn-styles';
    s.textContent = `
      #bn-save-btn.dirty { opacity:1!important;cursor:pointer!important;background:var(--accent)!important;animation:savePulse 1.5s ease-in-out infinite; }
      #bn-drop-zone:hover { border-color:var(--accent)!important;background:var(--accent-muted)!important; }
      .bn-thumb { position:relative;border-radius:8px;overflow:hidden;border:1px solid var(--border);aspect-ratio:16/10;background:var(--surface2); }
      .bn-thumb img { width:100%;height:100%;object-fit:cover;display:block; }
      .bn-thumb-del { position:absolute;top:4px;right:4px;background:rgba(239,68,68,.85);border:none;border-radius:5px;color:#fff;font-size:11px;font-weight:700;padding:3px 7px;cursor:pointer;font-family:inherit;opacity:0;transition:opacity .15s; }
      .bn-thumb:hover .bn-thumb-del { opacity:1; }
      .bn-thumb-order { position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,.6);color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px; }
      .bn-card { border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--surface2); }
      .bn-link-input { width:100%;box-sizing:border-box;padding:6px 8px;font-size:11px;border:none;border-top:1px solid var(--border);background:var(--surface);color:var(--text);font-family:inherit;outline:none; }
      .bn-link-input:focus { background:var(--surface2);box-shadow:inset 0 0 0 1px var(--accent); }
      .bn-link-input::placeholder { color:var(--text-faint); }
    `;
    document.head.appendChild(s);
  }

  /* ── Render gallery ── */
  function renderGallery() {
    const el = document.getElementById('bn-gallery');
    if (!el) return;
    if (bannerImages.length === 0) { el.innerHTML = '<div style="color:var(--text-faint);font-size:12px;grid-column:1/-1">Belum ada gambar. Upload atau drag gambar di bawah.</div>'; return; }
    el.innerHTML = bannerImages.map((img, i) => `
      <div class="bn-card" data-idx="${i}"
        draggable="true"
        ondragstart="event.dataTransfer.setData('text/plain','${i}')"
        ondragover="event.preventDefault()"
        ondrop="window._bnReorder(event,${i})">
        <div class="bn-thumb">
          <img src="${esc(img.url)}" alt="banner ${i+1}" loading="lazy">
          <button class="bn-thumb-del" onclick="window._bnRemoveImage(${i})">&#10005;</button>
          <div class="bn-thumb-order">${i+1}</div>
        </div>
        <input class="bn-link-input" type="url" placeholder="Link tujuan (opsional)" value="${esc(img.link || '')}" oninput="window._bnSetLink(${i},this.value)">
      </div>
    `).join('');
  }

  /* ── Upload to Supabase Storage (bucket 'banners') ── */
  async function uploadImage(file) {
    if (file.size > 5 * 1024 * 1024) { toast('File terlalu besar (maks 5MB): ' + file.name, 'error'); return null; }
    if (!file.type.startsWith('image/')) { toast('Bukan file gambar: ' + file.name, 'error'); return null; }

    const sb = getSb();
    if (!sb) { toast('Supabase belum siap.', 'error'); return null; }

    const ext = file.name.split('.').pop().toLowerCase();
    const fileName = `banner_${Date.now()}_${Math.random().toString(36).slice(2,6)}.${ext}`;
    const path = `popups/${fileName}`;

    try {
      const { error: uploadError } = await sb.storage
        .from('banners')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        if (uploadError.message?.includes('Bucket not found')) {
          toast('Bucket "banners" belum dibuat di Supabase Storage. Buat dulu: Storage → New bucket → nama "banners" → centang Public.', 'error');
        } else {
          toast('Upload gagal: ' + uploadError.message, 'error');
        }
        return null;
      }

      const { data: urlData } = sb.storage.from('banners').getPublicUrl(path);
      return urlData?.publicUrl ? { url: urlData.publicUrl } : null;
    } catch (e) {
      toast('Error upload: ' + e.message, 'error');
      return null;
    }
  }

  /* ── Handle multiple files ── */
  async function handleFiles(files) {
    if (!files || files.length === 0) return;
    const progressWrap = document.getElementById('bn-upload-progress');
    const progressBar = document.getElementById('bn-upload-bar');
    const progressTxt = document.getElementById('bn-upload-status');
    progressWrap.style.display = 'block';
    const total = files.length;
    let done = 0;
    progressTxt.textContent = `Mengupload 0/${total}…`;
    progressBar.style.width = '5%';

    for (const file of files) {
      const result = await uploadImage(file);
      done++;
      progressBar.style.width = Math.round((done / total) * 100) + '%';
      progressTxt.textContent = `Mengupload ${done}/${total}…`;
      if (result) bannerImages.push(result);
    }

    progressTxt.textContent = `${done} gambar selesai diupload`;
    setTimeout(() => { progressWrap.style.display = 'none'; }, 2000);
    renderGallery(); markDirty();
    // Reset file input
    const fi = document.getElementById('bn-file-input'); if (fi) fi.value = '';
  }

  function handleDrop(event) {
    event.preventDefault();
    const zone = document.getElementById('bn-drop-zone');
    if (zone) { zone.style.borderColor = 'var(--border2)'; zone.style.background = 'var(--surface2)'; }
    if (event.dataTransfer?.files?.length) handleFiles(event.dataTransfer.files);
  }

  function removeImage(idx) {
    bannerImages.splice(idx, 1);
    renderGallery(); markDirty();
  }

  function reorderImages(event, toIdx) {
    event.preventDefault();
    const fromIdx = parseInt(event.dataTransfer.getData('text/plain'));
    if (isNaN(fromIdx) || fromIdx === toIdx) return;
    const [item] = bannerImages.splice(fromIdx, 1);
    bannerImages.splice(toIdx, 0, item);
    renderGallery(); markDirty();
  }

  /* ── Load from Supabase ── */
  async function loadBanner() {
    const loadEl = document.getElementById('bn-loading');
    const bodyEl = document.getElementById('bn-body');
    if (loadEl) { loadEl.style.display = 'block'; loadEl.textContent = 'Memuat konfigurasi…'; }
    if (bodyEl) bodyEl.style.display = 'none';
    const sb = getSb();
    if (!sb) { if (loadEl) loadEl.textContent = 'Supabase belum siap.'; return; }

    const { data, error } = await sb.from('site_config').select('value').eq('key', 'banner_popup').maybeSingle();
    let cfg = { active: false, show_once: true, images: [], image_url: '', title: '', btn_text: '', btn_url: '', delay: 1 };
    if (!error && data?.value) { try { Object.assign(cfg, JSON.parse(data.value)); } catch(e){} }

    setToggle('bn-toggle-active', cfg.active);
    setToggle('bn-toggle-once', cfg.show_once !== false);
    document.getElementById('bn-title').value = cfg.title || '';
    document.getElementById('bn-btn-text').value = cfg.btn_text || '';
    document.getElementById('bn-btn-url').value = cfg.btn_url || '';
    document.getElementById('bn-delay').value = cfg.delay ?? 1;

    // Migrate: old single image_url → new images array
    if (cfg.images && cfg.images.length > 0) {
      bannerImages = cfg.images.map(i => typeof i === 'string' ? { url: i } : i);
    } else if (cfg.image_url) {
      bannerImages = [{ url: cfg.image_url }];
    } else {
      bannerImages = [];
    }
    renderGallery();

    dirty = false; updateSaveBtn();
    if (loadEl) loadEl.style.display = 'none';
    if (bodyEl) bodyEl.style.display = 'block';
  }

  /* ── Save to Supabase ── */
  async function saveBanner() {
    const sb = getSb();
    if (!sb) { toast('Supabase belum siap.', 'error'); return; }
    const cfg = {
      active: document.getElementById('bn-toggle-active').classList.contains('on'),
      show_once: document.getElementById('bn-toggle-once').classList.contains('on'),
      images: bannerImages,
      image_url: bannerImages.length > 0 ? bannerImages[0].url : '',
      title: document.getElementById('bn-title').value.trim(),
      btn_text: document.getElementById('bn-btn-text').value.trim(),
      btn_url: document.getElementById('bn-btn-url').value.trim(),
      delay: parseInt(document.getElementById('bn-delay').value) || 1,
    };
    const btn = document.getElementById('bn-save-btn');
    btn.disabled = true; btn.textContent = 'Menyimpan…';
    const { error } = await sb.from('site_config').upsert(
      { key: 'banner_popup', value: JSON.stringify(cfg), description: 'Popup banner halaman utama' },
      { onConflict: 'key' }
    );
    btn.disabled = false; btn.innerHTML = saveBtnHTML();
    if (error) { toast('Gagal: ' + error.message, 'error'); markDirty(); return; }
    dirty = false; btn.classList.remove('dirty');
    btn.disabled = true; btn.style.opacity = '.4'; btn.style.cursor = 'not-allowed';
    toast('Banner popup berhasil disimpan');
    window.logAdminActivity?.('config_save', 'banner_popup', null, { active: cfg.active, count: cfg.images.length });
  }

  function saveBtnHTML() {
    return `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Simpan`;
  }

  /* ── Preview ── */
  function previewPopup() {
    if (bannerImages.length === 0) { toast('Belum ada gambar untuk dipreview.', 'error'); return; }
    const old = document.getElementById('bn-preview-overlay'); if (old) old.remove();
    const overlay = document.createElement('div');
    overlay.id = 'bn-preview-overlay';
    Object.assign(overlay.style, {
      position:'fixed',inset:'0',zIndex:'10001',background:'rgba(0,0,0,0.78)',
      display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',
    });
    const title = document.getElementById('bn-title')?.value.trim() || '';
    const btnText = document.getElementById('bn-btn-text')?.value.trim() || '';
    const btnUrl = document.getElementById('bn-btn-url')?.value.trim() || '';
    let idx = 0;
    const imgs = bannerImages;

    function renderSlide() {
      const nav = imgs.length > 1 ? `
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:10px">
          <button onclick="document.getElementById('bn-preview-overlay')._prev()" style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);border-radius:6px;color:#fff;padding:4px 12px;cursor:pointer;font-family:inherit;font-size:13px">&larr;</button>
          <span style="font-size:12px;color:rgba(255,255,255,.6)" id="bn-pv-counter">${idx+1} / ${imgs.length}</span>
          <button onclick="document.getElementById('bn-preview-overlay')._next()" style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);border-radius:6px;color:#fff;padding:4px 12px;cursor:pointer;font-family:inherit;font-size:13px">&rarr;</button>
        </div>` : '';
      overlay.innerHTML = `
        <div style="background:#1a1a2e;border:1px solid rgba(168,85,247,0.25);border-radius:16px;max-width:520px;width:100%;overflow:hidden;position:relative;box-shadow:0 24px 64px rgba(0,0,0,0.6)">
          <button onclick="document.getElementById('bn-preview-overlay').remove()" style="position:absolute;top:10px;right:10px;background:rgba(255,255,255,0.15);border:none;border-radius:50%;width:32px;height:32px;font-size:16px;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:1;font-family:inherit">&#10005;</button>
          <img id="bn-pv-img" src="${esc(imgs[idx].url)}" alt="banner preview" style="width:100%;display:block;max-height:400px;object-fit:contain;background:#000">
          ${nav}
          ${title ? `<div style="padding:12px 20px 6px;font-size:15px;font-weight:700;color:#fff">${esc(title)}</div>` : ''}
          ${btnText ? `<div style="padding:${title?'0':'12px'} 20px 16px"><a href="${esc(btnUrl||'#')}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#a855f7,#7c3aed);color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:600">${esc(btnText)}</a></div>` : (title ? '<div style="height:12px"></div>' : '')}
          ${!title && !btnText ? '<div style="height:4px"></div>' : ''}
        </div>
        <div style="position:absolute;bottom:20px;left:50%;transform:translateX(-50%);font-size:12px;color:rgba(255,255,255,0.5)">Klik di luar untuk tutup</div>`;
    }
    renderSlide();
    overlay._prev = () => { idx = (idx - 1 + imgs.length) % imgs.length; const img = overlay.querySelector('#bn-pv-img'); if(img)img.src=imgs[idx].url; const c=overlay.querySelector('#bn-pv-counter'); if(c)c.textContent=`${idx+1} / ${imgs.length}`; };
    overlay._next = () => { idx = (idx + 1) % imgs.length; const img = overlay.querySelector('#bn-pv-img'); if(img)img.src=imgs[idx].url; const c=overlay.querySelector('#bn-pv-counter'); if(c)c.textContent=`${idx+1} / ${imgs.length}`; };
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  /* ── Helpers ── */
  function setToggle(id, on) { const el = document.getElementById(id); if (!el) return; on ? el.classList.add('on') : el.classList.remove('on'); }
  function markDirty() { dirty = true; updateSaveBtn(); }
  function updateSaveBtn() {
    const btn = document.getElementById('bn-save-btn'); if (!btn) return;
    if (dirty) { btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer'; btn.classList.add('dirty'); }
    else { btn.disabled = true; btn.style.opacity = '.4'; btn.style.cursor = 'not-allowed'; btn.classList.remove('dirty'); }
  }

  function registerGlobals() {
    window._bnSave = saveBanner;
    window._bnDirty = markDirty;
    window._bnHandleFiles = handleFiles;
    window._bnHandleFile = (f) => handleFiles([f]);
    window._bnHandleDrop = handleDrop;
    window._bnRemoveImage = removeImage;
    window._bnReorder = reorderImages;
    window._bnPreview = previewPopup;
    window._bnSetLink = function(idx, val) {
      if (bannerImages[idx]) { bannerImages[idx].link = val.trim(); markDirty(); }
    };
  }
})();
