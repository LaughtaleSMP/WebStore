/* ════════════════════════════════════════════════════════════════
   admin-banner.js — Manajemen Banner Popup Halaman Utama
   Menyimpan ke site_config key='banner_popup'
   Gambar di-upload ke Supabase Storage bucket 'banners'
   (buat bucket 'banners' di Supabase → Storage → New bucket,
    centang "Public bucket")
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  let dirty = false;
  let currentImageUrl = '';

  function getSb() { return window._adminSb; }

  function toast(msg, type = 'success') {
    if (typeof window.showAdminToast === 'function') {
      window.showAdminToast(msg, type); return;
    }
    const el = document.createElement('div');
    el.className = 'toast-item toast-' + type;
    el.textContent = msg;
    const c = document.getElementById('toast');
    if (c) { c.appendChild(el); setTimeout(() => el.remove(), 3200); }
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Inject nav ── */
  document.addEventListener('DOMContentLoaded', () => {
    injectNav();
    injectSection();
  });

  function injectNav() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || document.getElementById('nav-banner')) return;

    const item = document.createElement('div');
    item.className = 'nav-item';
    item.id = 'nav-banner';
    item.innerHTML = `
      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M9 21V9"/>
      </svg>
      Banner Popup`;
    item.onclick = () => showBannerSection(item);

    /* Masukkan setelah nav server-status atau di akhir grup Server */
    const anchor = document.querySelector('.nav-item[onclick*="season"]');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(item, anchor.nextSibling);
    } else {
      sidebar.appendChild(item);
    }
  }

  function showBannerSection(el) {
    if (typeof showSection === 'function') {
      showSection('banner', el);
    } else {
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const sec = document.getElementById('sec-banner');
      if (sec) sec.classList.add('active');
      if (el) el.classList.add('active');
      const bc = document.getElementById('topbar-section');
      if (bc) bc.textContent = 'Banner Popup';
    }
    loadBanner();
  }

  /* ── Inject Section HTML ── */
  function injectSection() {
    const main = document.querySelector('.main-content');
    if (!main || document.getElementById('sec-banner')) return;

    const sec = document.createElement('div');
    sec.className = 'section';
    sec.id = 'sec-banner';
    sec.innerHTML = `
      <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div class="page-title">Banner Popup</div>
          <div class="page-sub">Gambar popup yang tampil saat pengunjung pertama kali membuka website</div>
        </div>
        <button class="save-btn" id="bn-save-btn" onclick="window._bnSave()" style="opacity:.4;cursor:not-allowed" disabled>
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          Simpan
        </button>
      </div>

      <div id="bn-loading" style="padding:2rem;color:var(--text-faint);font-size:13px">Memuat konfigurasi…</div>

      <div id="bn-body" style="display:none;max-width:860px">

        <!-- Toggle aktif -->
        <div class="card" style="margin-bottom:14px">
          <div class="card-header">
            <div class="card-title">Status Banner</div>
          </div>
          <div class="toggle-row">
            <div class="toggle-label">
              <strong>Tampilkan Banner Popup</strong>
              <span>Popup akan muncul kepada pengunjung saat membuka halaman utama</span>
            </div>
            <div class="toggle" id="bn-toggle-active" onclick="this.classList.toggle('on');window._bnDirty()"></div>
          </div>
          <div class="toggle-row">
            <div class="toggle-label">
              <strong>Tampilkan Hanya Sekali per Sesi</strong>
              <span>Popup hanya muncul sekali, tidak berulang tiap halaman di-refresh</span>
            </div>
            <div class="toggle on" id="bn-toggle-once" onclick="this.classList.toggle('on');window._bnDirty()"></div>
          </div>
        </div>

        <!-- Upload gambar -->
        <div class="card" style="margin-bottom:14px">
          <div class="card-header">
            <div class="card-title">Gambar Banner</div>
          </div>

          <!-- Preview gambar saat ini -->
          <div id="bn-img-preview-wrap" style="margin-bottom:16px;display:none">
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Gambar Saat Ini</div>
            <div style="position:relative;display:inline-block">
              <img id="bn-img-preview" src="" alt="preview"
                style="max-width:100%;max-height:280px;border-radius:10px;
                       border:1px solid var(--border);display:block;object-fit:contain">
              <button onclick="window._bnRemoveImage()"
                style="position:absolute;top:6px;right:6px;
                       background:rgba(239,68,68,.85);border:none;border-radius:6px;
                       color:#fff;font-size:12px;font-weight:700;padding:4px 8px;
                       cursor:pointer;font-family:inherit">✕ Hapus</button>
            </div>
          </div>

          <!-- Upload baru -->
          <div class="field" style="margin-bottom:14px">
            <label>Upload Gambar Baru (JPG / PNG / WebP, maks 3 MB)</label>
            <div id="bn-drop-zone"
              style="border:2px dashed var(--border2);border-radius:10px;padding:28px 20px;
                     text-align:center;cursor:pointer;transition:border-color .2s,background .2s;
                     background:var(--surface2);margin-top:6px"
              onclick="document.getElementById('bn-file-input').click()"
              ondragover="event.preventDefault();this.style.borderColor='var(--accent)';this.style.background='var(--accent-muted)'"
              ondragleave="this.style.borderColor='var(--border2)';this.style.background='var(--surface2)'"
              ondrop="window._bnHandleDrop(event)">
              <div style="font-size:28px;margin-bottom:8px;opacity:.4">📷</div>
              <div style="font-size:13px;color:var(--text-muted)">Klik atau drag & drop gambar ke sini</div>
              <div style="font-size:11px;color:var(--text-faint);margin-top:4px">Rekomendasi: 800×600px atau 1200×900px</div>
              <input type="file" id="bn-file-input" accept="image/*" style="display:none"
                onchange="window._bnHandleFile(this.files[0])">
            </div>
            <div id="bn-upload-progress" style="display:none;margin-top:10px">
              <div style="background:var(--surface3);border-radius:20px;height:6px;overflow:hidden">
                <div id="bn-upload-bar" style="height:100%;background:var(--accent);width:0%;transition:width .3s;border-radius:20px"></div>
              </div>
              <div id="bn-upload-status" style="font-size:12px;color:var(--text-muted);margin-top:5px">Mengupload…</div>
            </div>
          </div>

          <!-- Atau masukkan URL langsung -->
          <div class="field">
            <label>Atau Masukkan URL Gambar Langsung</label>
            <input id="bn-image-url" type="url" placeholder="https://example.com/banner.jpg"
              oninput="window._bnUrlChange(this.value)"
              style="width:100%;box-sizing:border-box">
            <div class="field-hint">Gunakan URL publik yang dapat diakses pengunjung</div>
          </div>
        </div>

        <!-- Pengaturan popup -->
        <div class="card" style="margin-bottom:14px">
          <div class="card-header">
            <div class="card-title">Pengaturan Popup</div>
          </div>
          <div class="field" style="margin-bottom:12px">
            <label>Judul Popup (Opsional)</label>
            <input id="bn-title" type="text" placeholder="Contoh: 🎉 Event Spesial Season 12!"
              oninput="window._bnDirty()" style="width:100%;box-sizing:border-box">
          </div>
          <div class="field" style="margin-bottom:12px">
            <label>Teks Tombol Aksi (Opsional)</label>
            <input id="bn-btn-text" type="text" placeholder="Contoh: Lihat Selengkapnya"
              oninput="window._bnDirty()" style="width:100%;box-sizing:border-box">
          </div>
          <div class="field" style="margin-bottom:12px">
            <label>URL Tombol Aksi (Opsional)</label>
            <input id="bn-btn-url" type="url" placeholder="https://..."
              oninput="window._bnDirty()" style="width:100%;box-sizing:border-box">
          </div>
          <div class="field">
            <label>Delay Tampil (detik, default: 1)</label>
            <input id="bn-delay" type="number" min="0" max="30" value="1"
              oninput="window._bnDirty()"
              style="width:120px">
          </div>
        </div>

        <!-- Preview popup -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">Preview Popup</div>
          </div>
          <div style="padding:16px 0 8px">
            <button class="btn-ghost" style="font-size:12px" onclick="window._bnPreview()">
              👁 Tampilkan Preview Popup
            </button>
            <span style="font-size:11.5px;color:var(--text-faint);margin-left:10px">
              Preview akan tampil di tab baru / halaman utama
            </span>
          </div>
        </div>

      </div>
    `;

    injectStyles();
    main.appendChild(sec);
    registerGlobals();
  }

  function injectStyles() {
    if (document.getElementById('bn-styles')) return;
    const s = document.createElement('style');
    s.id = 'bn-styles';
    s.textContent = `
      #bn-save-btn.dirty {
        opacity:1 !important; cursor:pointer !important;
        background:var(--accent) !important;
        animation:savePulse 1.5s ease-in-out infinite;
      }
      #bn-drop-zone:hover {
        border-color: var(--accent) !important;
        background: var(--accent-muted) !important;
      }
    `;
    document.head.appendChild(s);
  }

  /* ── Load dari Supabase ── */
  async function loadBanner() {
    const loadEl = document.getElementById('bn-loading');
    const bodyEl = document.getElementById('bn-body');
    if (loadEl) { loadEl.style.display = 'block'; loadEl.textContent = 'Memuat konfigurasi…'; }
    if (bodyEl) bodyEl.style.display = 'none';

    const sb = getSb();
    if (!sb) { if (loadEl) loadEl.textContent = 'Supabase belum siap.'; return; }

    const { data, error } = await sb
      .from('site_config')
      .select('value')
      .eq('key', 'banner_popup')
      .maybeSingle();

    let cfg = {
      active: false,
      show_once: true,
      image_url: '',
      title: '',
      btn_text: '',
      btn_url: '',
      delay: 1,
    };

    if (!error && data?.value) {
      try { Object.assign(cfg, JSON.parse(data.value)); } catch (e) { /* noop */ }
    }

    /* Apply ke form */
    setToggle('bn-toggle-active', cfg.active);
    setToggle('bn-toggle-once',   cfg.show_once !== false);
    document.getElementById('bn-image-url').value = cfg.image_url || '';
    document.getElementById('bn-title').value     = cfg.title     || '';
    document.getElementById('bn-btn-text').value  = cfg.btn_text  || '';
    document.getElementById('bn-btn-url').value   = cfg.btn_url   || '';
    document.getElementById('bn-delay').value     = cfg.delay ?? 1;

    currentImageUrl = cfg.image_url || '';
    updateImagePreview(currentImageUrl);

    dirty = false;
    updateSaveBtn();

    if (loadEl) loadEl.style.display = 'none';
    if (bodyEl) bodyEl.style.display = 'block';
  }

  /* ── Simpan ke Supabase ── */
  async function saveBanner() {
    const sb = getSb();
    if (!sb) { toast('Supabase belum siap.', 'error'); return; }

    const cfg = {
      active:     document.getElementById('bn-toggle-active').classList.contains('on'),
      show_once:  document.getElementById('bn-toggle-once').classList.contains('on'),
      image_url:  currentImageUrl || document.getElementById('bn-image-url').value.trim(),
      title:      document.getElementById('bn-title').value.trim(),
      btn_text:   document.getElementById('bn-btn-text').value.trim(),
      btn_url:    document.getElementById('bn-btn-url').value.trim(),
      delay:      parseInt(document.getElementById('bn-delay').value) || 1,
    };

    const btn = document.getElementById('bn-save-btn');
    btn.disabled = true; btn.textContent = 'Menyimpan…';

    const { error } = await sb.from('site_config').upsert(
      { key: 'banner_popup', value: JSON.stringify(cfg), description: 'Popup banner halaman utama' },
      { onConflict: 'key' }
    );

    btn.disabled = false;
    btn.innerHTML = saveBtnInner();

    if (error) { toast('Gagal: ' + error.message, 'error'); markDirty(); return; }

    dirty = false;
    btn.classList.remove('dirty');
    btn.disabled = true; btn.style.opacity = '.4'; btn.style.cursor = 'not-allowed';
    toast('Banner popup berhasil disimpan ✅');

    window.logAdminActivity?.('config_save', 'banner_popup', null, { active: cfg.active });
  }

  function saveBtnInner() {
    return `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Simpan`;
  }

  /* ── Upload gambar ke Supabase Storage ── */
  async function uploadImage(file) {
    const sb = getSb();
    if (!sb) { toast('Supabase belum siap.', 'error'); return null; }

    /* Validasi */
    if (file.size > 3 * 1024 * 1024) {
      toast('Ukuran file terlalu besar (maks 3 MB)', 'error'); return null;
    }
    if (!file.type.startsWith('image/')) {
      toast('File harus berupa gambar', 'error'); return null;
    }

    /* Progress UI */
    const progressWrap = document.getElementById('bn-upload-progress');
    const progressBar  = document.getElementById('bn-upload-bar');
    const progressTxt  = document.getElementById('bn-upload-status');
    progressWrap.style.display = 'block';
    progressBar.style.width = '20%';
    progressTxt.textContent = 'Mengupload gambar…';

    /* Nama file unik */
    const ext      = file.name.split('.').pop().toLowerCase();
    const fileName = `banner_${Date.now()}.${ext}`;
    const path     = `popups/${fileName}`;

    try {
      progressBar.style.width = '50%';
      const { error: uploadError } = await sb.storage
        .from('banners')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        progressWrap.style.display = 'none';
        if (uploadError.message?.includes('Bucket not found')) {
          toast('Bucket "banners" belum dibuat. Buat dulu di Supabase → Storage → New bucket → nama "banners", centang Public.', 'error');
        } else {
          toast('Upload gagal: ' + uploadError.message, 'error');
        }
        return null;
      }

      progressBar.style.width = '90%';
      const { data: urlData } = sb.storage.from('banners').getPublicUrl(path);
      progressBar.style.width = '100%';
      progressTxt.textContent = 'Upload berhasil!';
      setTimeout(() => { progressWrap.style.display = 'none'; }, 1800);

      return urlData?.publicUrl || null;
    } catch (e) {
      progressWrap.style.display = 'none';
      toast('Error upload: ' + e.message, 'error');
      return null;
    }
  }

  /* ── Handle file input / drop ── */
  async function handleFile(file) {
    if (!file) return;
    const url = await uploadImage(file);
    if (!url) return;
    currentImageUrl = url;
    document.getElementById('bn-image-url').value = url;
    updateImagePreview(url);
    markDirty();
    toast('Gambar berhasil diupload ✅');
  }

  function handleDrop(event) {
    event.preventDefault();
    const zone = document.getElementById('bn-drop-zone');
    if (zone) { zone.style.borderColor = 'var(--border2)'; zone.style.background = 'var(--surface2)'; }
    const file = event.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }

  function handleUrlChange(url) {
    currentImageUrl = url.trim();
    updateImagePreview(currentImageUrl);
    markDirty();
  }

  function removeImage() {
    currentImageUrl = '';
    document.getElementById('bn-image-url').value = '';
    updateImagePreview('');
    markDirty();
  }

  /* ── Update preview image ── */
  function updateImagePreview(url) {
    const wrap = document.getElementById('bn-img-preview-wrap');
    const img  = document.getElementById('bn-img-preview');
    if (!wrap || !img) return;
    if (url) {
      img.src = url;
      wrap.style.display = 'block';
    } else {
      wrap.style.display = 'none';
      img.src = '';
    }
  }

  /* ── Preview popup di halaman utama ── */
  function previewPopup() {
    const url = currentImageUrl || document.getElementById('bn-image-url').value.trim();
    if (!url) { toast('Belum ada gambar untuk dipreview.', 'error'); return; }

    /* Buat overlay preview langsung di admin panel */
    const old = document.getElementById('bn-preview-overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'bn-preview-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '10001',
      background: 'rgba(0,0,0,0.78)', backdFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    });

    const title   = document.getElementById('bn-title')?.value.trim() || '';
    const btnText = document.getElementById('bn-btn-text')?.value.trim() || '';
    const btnUrl  = document.getElementById('bn-btn-url')?.value.trim() || '';

    overlay.innerHTML = `
      <div style="background:#1a1a2e;border:1px solid rgba(168,85,247,0.25);border-radius:16px;
                  max-width:520px;width:100%;overflow:hidden;position:relative;
                  box-shadow:0 24px 64px rgba(0,0,0,0.6)">
        <button onclick="document.getElementById('bn-preview-overlay').remove()"
          style="position:absolute;top:10px;right:10px;background:rgba(255,255,255,0.15);
                 border:none;border-radius:50%;width:32px;height:32px;font-size:16px;
                 color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;
                 z-index:1;font-family:inherit">✕</button>
        <img src="${esc(url)}" alt="banner preview"
          style="width:100%;display:block;max-height:400px;object-fit:contain;background:#000">
        ${title ? `<div style="padding:16px 20px 8px;font-size:15px;font-weight:700;color:#fff">${esc(title)}</div>` : ''}
        ${btnText ? `
          <div style="padding:${title ? '0' : '16px'} 20px 20px">
            <a href="${esc(btnUrl || '#')}" target="_blank"
              style="display:inline-block;background:linear-gradient(135deg,#a855f7,#7c3aed);
                     color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;
                     font-size:13px;font-weight:600">${esc(btnText)}</a>
          </div>` : (title ? '<div style="height:16px"></div>' : '')}
        ${!title && !btnText ? '<div style="height:4px"></div>' : ''}
      </div>
      <div style="position:absolute;bottom:20px;left:50%;transform:translateX(-50%);
                  font-size:12px;color:rgba(255,255,255,0.5)">Klik di luar untuk tutup</div>
    `;

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  /* ── Helpers ── */
  function setToggle(id, on) {
    const el = document.getElementById(id);
    if (!el) return;
    on ? el.classList.add('on') : el.classList.remove('on');
  }

  function markDirty() {
    dirty = true;
    updateSaveBtn();
  }

  function updateSaveBtn() {
    const btn = document.getElementById('bn-save-btn');
    if (!btn) return;
    if (dirty) {
      btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer';
      btn.classList.add('dirty');
    } else {
      btn.disabled = true; btn.style.opacity = '.4'; btn.style.cursor = 'not-allowed';
      btn.classList.remove('dirty');
    }
  }

  function registerGlobals() {
    window._bnSave        = saveBanner;
    window._bnDirty       = markDirty;
    window._bnHandleFile  = handleFile;
    window._bnHandleDrop  = handleDrop;
    window._bnUrlChange   = handleUrlChange;
    window._bnRemoveImage = removeImage;
    window._bnPreview     = previewPopup;
  }

})();
