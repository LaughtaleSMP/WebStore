/**
 * Laughtale SMP — Mobile Bottom Navigation Hub
 * Auto-injects and manages the floating ergonomic thumb-zone navigation bar
 * across all public pages.
 */

(function () {
  'use strict';

  function initMobileBottomNav() {
    // Avoid double injection
    if (document.getElementById('laughtale-mobile-bottom-nav')) return;

    // Detect current path
    var path = window.location.pathname.toLowerCase();
    var isHome = path === '/' || path.endsWith('/index.html') || path === '' || (!path.includes('shop') && !path.includes('monitor') && !path.includes('economy') && !path.includes('admin'));
    var isShop = path.includes('shop') || path.includes('topup');
    var isMonitor = path.includes('monitor') || path.includes('radar');
    var isEconomy = path.includes('economy') || path.includes('leaderboard') || path.includes('status');

    var navEl = document.createElement('nav');
    navEl.id = 'laughtale-mobile-bottom-nav';
    navEl.className = 'mobile-bottom-nav';
    navEl.setAttribute('aria-label', 'Mobile Hub Navigation');

    navEl.innerHTML = [
      '<a href="index.html" class="mobile-nav-item ' + (isHome ? 'active' : '') + '" data-page="home">',
      '  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">',
      '    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>',
      '    <polyline points="9 22 9 12 15 12 15 22"></polyline>',
      '  </svg>',
      '  <span>Hub</span>',
      '</a>',
      '<a href="shop.html" class="mobile-nav-item ' + (isShop ? 'active' : '') + '" data-page="shop">',
      '  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">',
      '    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>',
      '    <line x1="3" y1="6" x2="21" y2="6"></line>',
      '    <path d="M16 10a4 4 0 0 1-8 0"></path>',
      '  </svg>',
      '  <span>Store</span>',
      '</a>',
      '<a href="monitor.html" class="mobile-nav-item ' + (isMonitor ? 'active' : '') + '" data-page="monitor">',
      '  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">',
      '    <circle cx="12" cy="12" r="10"></circle>',
      '    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>',
      '  </svg>',
      '  <span>Radar</span>',
      '</a>',
      '<a href="economy.html" class="mobile-nav-item ' + (isEconomy ? 'active' : '') + '" data-page="economy">',
      '  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">',
      '    <line x1="18" y1="20" x2="18" y2="10"></line>',
      '    <line x1="12" y1="20" x2="12" y2="4"></line>',
      '    <line x1="6" y1="20" x2="6" y2="14"></line>',
      '  </svg>',
      '  <span>Ekonomi</span>',
      '</a>'
    ].join('\n');

    // Add haptic feedback on touch
    navEl.addEventListener('click', function (e) {
      var item = e.target.closest('.mobile-nav-item');
      if (item && 'vibrate' in navigator) {
        try { navigator.vibrate(15); } catch (_) {}
      }
    });

    document.body.appendChild(navEl);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileBottomNav);
  } else {
    initMobileBottomNav();
  }
})();
