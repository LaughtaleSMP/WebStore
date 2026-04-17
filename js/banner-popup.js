/* ════════════════════════════════════════════════════════════════
   banner-popup.js — Popup Banner Halaman Utama
   Membaca site_config key='banner_popup' dari Supabase
   dan menampilkan modal popup kepada pengunjung.
   
   Cara pakai: tambahkan di index.html (SETELAH supabase client init):
   <script src="js/banner-popup.js" defer></script>
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const STORAGE_KEY = 'laughtale_banner_shown';

  /* ── Tunggu Supabase siap ── */
  function waitForSb(callback, tries) {
    tries = tries || 0;
    if (tries > 40) return; /* max 4 detik */
    const sb = window._sbClient || window._sb || window.sb || window._supabaseClient;
    if (sb) { callback(sb); return; }
    setTimeout(() => waitForSb(callback, tries + 1), 100);
  }

  /* ── Inisialisasi ── */
  function init() {
    waitForSb(async (sb) => {
      try {
        const { data, error } = await sb
          .from('site_config')
          .select('value')
          .eq('key', 'banner_popup')
          .maybeSingle();

        if (error || !data?.value) return;

        let cfg;
        try { cfg = JSON.parse(data.value); } catch (e) { return; }

        if (!cfg.active || !cfg.image_url) return;

        /* Cek show_once: jika sudah pernah ditampilkan di sesi ini, skip */
        if (cfg.show_once !== false) {
          const shown = sessionStorage.getItem(STORAGE_KEY);
          if (shown) return;
        }

        /* Tampilkan setelah delay */
        const delay = Math.max(0, (cfg.delay ?? 1)) * 1000;
        setTimeout(() => showPopup(cfg), delay);

      } catch (e) {
        /* Gagal load banner — diam-diam abaikan */
      }
    });
  }

  /* ── Render popup ── */
  function showPopup(cfg) {
    /* Hindari duplikat */
    if (document.getElementById('banner-popup-overlay')) return;

    /* Tandai sudah ditampilkan */
    if (cfg.show_once !== false) {
      try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (e) { /* noop */ }
    }

    injectStyles();

    const overlay = document.createElement('div');
    overlay.id = 'banner-popup-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', cfg.title || 'Pengumuman');
    overlay.className = 'bp-overlay';

    const titleHtml = cfg.title
      ? `<div class="bp-title">${escHtml(cfg.title)}</div>`
      : '';

    const btnHtml = (cfg.btn_text && cfg.btn_url)
      ? `<div class="bp-footer">
           <a href="${escHtml(cfg.btn_url)}" target="_blank" rel="noopener" class="bp-action-btn">
             ${escHtml(cfg.btn_text)}
             <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
               <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
               <polyline points="15 3 21 3 21 9"/>
               <line x1="10" y1="14" x2="21" y2="3"/>
             </svg>
           </a>
         </div>`
      : '';

    overlay.innerHTML = `
      <div class="bp-backdrop"></div>
      <div class="bp-modal" role="document">
        <button class="bp-close" aria-label="Tutup popup" onclick="window._bpClose()">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <div class="bp-img-wrap">
          <img src="${escHtml(cfg.image_url)}" alt="${escHtml(cfg.title || 'Banner')}"
            class="bp-img" loading="lazy"
            onerror="this.parentElement.parentElement.style.display='none'">
        </div>
        ${titleHtml}
        ${btnHtml}
      </div>
    `;

    document.body.appendChild(overlay);

    /* Animate in */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.classList.add('bp-visible');
      });
    });

    /* Close on backdrop click */
    overlay.querySelector('.bp-backdrop').addEventListener('click', closePopup);

    /* Close on Escape */
    function onKey(e) {
      if (e.key === 'Escape') {
        closePopup();
        document.removeEventListener('keydown', onKey);
      }
    }
    document.addEventListener('keydown', onKey);

    /* Focus trap */
    const closeBtn = overlay.querySelector('.bp-close');
    if (closeBtn) setTimeout(() => closeBtn.focus(), 150);
  }

  /* ── Tutup popup ── */
  function closePopup() {
    const overlay = document.getElementById('banner-popup-overlay');
    if (!overlay) return;
    overlay.classList.remove('bp-visible');
    overlay.classList.add('bp-closing');
    setTimeout(() => { overlay.remove(); }, 320);
  }

  /* ── Styles ── */
  function injectStyles() {
    if (document.getElementById('bp-styles')) return;
    const s = document.createElement('style');
    s.id = 'bp-styles';
    s.textContent = `
      .bp-overlay {
        position: fixed;
        inset: 0;
        z-index: 99990;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
      }
      .bp-overlay.bp-visible {
        opacity: 1;
        pointer-events: auto;
      }
      .bp-overlay.bp-closing {
        opacity: 0;
        pointer-events: none;
      }
      .bp-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.72);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        cursor: pointer;
      }
      .bp-modal {
        position: relative;
        z-index: 1;
        background: #0d1117;
        border: 1px solid rgba(168, 85, 247, 0.22);
        border-radius: 18px;
        max-width: 520px;
        width: 100%;
        max-height: calc(100vh - 40px);
        overflow: hidden;
        box-shadow:
          0 0 0 1px rgba(168, 85, 247, 0.08),
          0 24px 80px rgba(0, 0, 0, 0.6),
          0 8px 32px rgba(0, 0, 0, 0.4);
        transform: scale(0.94) translateY(16px);
        transition: transform 0.32s cubic-bezier(0.34, 1.2, 0.64, 1);
        display: flex;
        flex-direction: column;
      }
      .bp-overlay.bp-visible .bp-modal {
        transform: scale(1) translateY(0);
      }
      .bp-overlay.bp-closing .bp-modal {
        transform: scale(0.96) translateY(8px);
      }
      .bp-close {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 10;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.55);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.18s, transform 0.18s;
      }
      .bp-close:hover {
        background: rgba(168, 85, 247, 0.45);
        border-color: rgba(168, 85, 247, 0.5);
        transform: scale(1.08);
      }
      .bp-close:focus {
        outline: 2px solid rgba(168, 85, 247, 0.8);
        outline-offset: 2px;
      }
      .bp-img-wrap {
        flex: 1;
        overflow: hidden;
        background: #000;
        min-height: 80px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .bp-img {
        width: 100%;
        max-height: 420px;
        object-fit: contain;
        display: block;
      }
      .bp-title {
        padding: 16px 20px 10px;
        font-family: 'Press Start 2P', monospace, sans-serif;
        font-size: 0.7rem;
        color: #e8eaf0;
        line-height: 1.5;
        letter-spacing: 0.02em;
        border-top: 1px solid rgba(168, 85, 247, 0.1);
      }
      .bp-footer {
        padding: 10px 20px 18px;
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
      }
      .bp-action-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: linear-gradient(135deg, #a855f7, #7c3aed);
        color: #fff;
        text-decoration: none;
        padding: 10px 20px;
        border-radius: 10px;
        font-family: 'Press Start 2P', monospace, sans-serif;
        font-size: 0.55rem;
        letter-spacing: 0.05em;
        transition: opacity 0.18s, transform 0.18s;
        box-shadow: 0 4px 16px rgba(168, 85, 247, 0.35);
      }
      .bp-action-btn:hover {
        opacity: 0.9;
        transform: translateY(-1px);
      }
      @media (max-width: 480px) {
        .bp-modal { max-width: 100%; border-radius: 14px; }
        .bp-img   { max-height: 280px; }
        .bp-title { font-size: 0.58rem; padding: 12px 14px 8px; }
        .bp-footer { padding: 8px 14px 14px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .bp-overlay, .bp-modal { transition: none !important; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ── Escape HTML ── */
  function escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Global untuk tombol close di markup ── */
  window._bpClose = closePopup;

  /* ── Jalankan setelah DOM siap ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
