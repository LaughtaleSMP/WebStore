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
    if (tries > 40) return;
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

        if (cfg.show_once !== false) {
          const shown = sessionStorage.getItem(STORAGE_KEY);
          if (shown) return;
        }

        const delay = Math.max(0, (cfg.delay ?? 1)) * 1000;
        setTimeout(() => showPopup(cfg), delay);

      } catch (e) { /* diam-diam abaikan */ }
    });
  }

  /* ── Render popup ── */
  function showPopup(cfg) {
    if (document.getElementById('banner-popup-overlay')) return;

    if (cfg.show_once !== false) {
      try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
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
        <div class="bp-img-wrap">
          <img src="${escHtml(cfg.image_url)}" alt="${escHtml(cfg.title || 'Banner')}"
            class="bp-img" loading="lazy"
            onerror="this.closest('.bp-modal').style.display='none'">
        </div>
        ${titleHtml}
        ${btnHtml}
        <button class="bp-close" aria-label="Tutup popup" onclick="window._bpClose()">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.classList.add('bp-visible');
      });
    });

    overlay.querySelector('.bp-backdrop').addEventListener('click', closePopup);

    function onKey(e) {
      if (e.key === 'Escape') {
        closePopup();
        document.removeEventListener('keydown', onKey);
      }
    }
    document.addEventListener('keydown', onKey);

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
        padding: 20px;
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
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        cursor: pointer;
      }
      .bp-modal {
        position: relative;
        z-index: 1;
        background: #0d1117;
        border: 1px solid rgba(168, 85, 247, 0.25);
        border-radius: 18px;
        /* Lebar mengikuti gambar, max 480px agar tidak terlalu besar */
        width: min(480px, calc(100vw - 40px));
        max-height: calc(100vh - 40px);
        overflow: hidden;
        box-shadow:
          0 0 0 1px rgba(168, 85, 247, 0.08),
          0 24px 80px rgba(0, 0, 0, 0.7),
          0 8px 32px rgba(0, 0, 0, 0.5);
        transform: scale(0.92) translateY(20px);
        transition: transform 0.34s cubic-bezier(0.34, 1.2, 0.64, 1);
        display: flex;
        flex-direction: column;
      }
      .bp-overlay.bp-visible .bp-modal {
        transform: scale(1) translateY(0);
      }
      .bp-overlay.bp-closing .bp-modal {
        transform: scale(0.96) translateY(8px);
      }

      /* ── Tombol close: sudut kanan atas, tetap di DALAM modal ── */
      .bp-close {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 20;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.18s, transform 0.18s, border-color 0.18s;
        flex-shrink: 0;
      }
      .bp-close:hover {
        background: rgba(168, 85, 247, 0.5);
        border-color: rgba(168, 85, 247, 0.6);
        transform: scale(1.1);
      }
      .bp-close:focus {
        outline: 2px solid rgba(168, 85, 247, 0.8);
        outline-offset: 2px;
      }

      /* ── Gambar: full-width, proporsional, tanpa letterbox hitam ── */
      .bp-img-wrap {
        width: 100%;
        overflow: hidden;
        border-radius: 18px 18px 0 0;
        background: #0d1117;
        /* Kalau tidak ada title/btn, radius bawah juga rounded */
        line-height: 0;
      }
      .bp-img-wrap:last-child {
        border-radius: 18px;
      }
      .bp-img {
        width: 100%;
        height: auto;
        display: block;
        object-fit: cover;
        max-height: calc(100vh - 100px);
      }

      /* ── Title ── */
      .bp-title {
        padding: 14px 20px 10px;
        font-family: 'Press Start 2P', monospace, sans-serif;
        font-size: 0.68rem;
        color: #e8eaf0;
        line-height: 1.5;
        letter-spacing: 0.02em;
        border-top: 1px solid rgba(168, 85, 247, 0.12);
      }

      /* ── Footer tombol ── */
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
        opacity: 0.88;
        transform: translateY(-1px);
      }

      /* ── Mobile ── */
      @media (max-width: 520px) {
        .bp-overlay { padding: 12px; }
        .bp-modal   { border-radius: 14px; }
        .bp-img-wrap { border-radius: 14px 14px 0 0; }
        .bp-img-wrap:last-child { border-radius: 14px; }
        .bp-title   { font-size: 0.58rem; padding: 10px 14px 8px; }
        .bp-footer  { padding: 8px 14px 14px; }
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

  window._bpClose = closePopup;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
