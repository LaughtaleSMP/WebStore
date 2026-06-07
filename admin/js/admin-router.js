/**
 * Admin Router — Lazy Loading Panel System
 * 
 * Features:
 * - Hash-based routing (#/dashboard, #/orders, etc.)
 * - Lazy load panel HTML via fetch
 * - In-memory cache (fetch once, reuse)
 * - Breadcrumb + sidebar state sync
 * - Prefetch on hover (optional)
 * 
 * Usage:
 *   Router.navigate('dashboard');
 *   Router.init();
 */

const Router = {
  // ── Route Registry ──
  routes: {
    'dashboard':        'partials/dashboard.html',
    'server':           'partials/server-info.html',
    'server-status':    'partials/server-status.html',
    'maintenance':      'partials/maintenance.html',
    'season':           'partials/season.html',
    'orders':           'partials/orders.html',
    'all-orders':       'partials/all-orders.html',
    'gem-topup':        'partials/gem-topup.html',
    'shop-items':       'partials/shop-items.html',
    'shop-categories':  'partials/shop-categories.html',
    'admins-wa':        'partials/admins-wa.html',
    'finance-v2':       'partials/finance-v2.html',
    'access-requests':  'partials/access-requests.html',
    'mimi-inka':        'partials/mimi-inka.html',
    'glyph-sheets':     'partials/glyph-sheets.html',
  },

  // ── Panel Titles (for breadcrumb) ──
  titles: {
    'dashboard':        'Dashboard',
    'server':           'Info Server',
    'server-status':    'Server Status',
    'maintenance':      'Maintenance',
    'season':           'Season & World',
    'orders':           'Pesanan Masuk',
    'all-orders':       'Semua Pesanan',
    'gem-topup':        'Topup Gem / Koin',
    'shop-items':       'Item Toko',
    'shop-categories':  'Kategori Toko',
    'admins-wa':        'Admin WhatsApp',
    'finance-v2':       'Keuangan',
    'access-requests':  'Permintaan Akses',
    'mimi-inka':        'Mimi Inka',
    'glyph-sheets':     'Glyph Sheets',
  },

  // ── State ──
  cache: new Map(),
  currentRoute: null,
  prefetchQueue: new Set(),

  // ── Navigate to Route ──
  async navigate(routeName) {
    // Validate route
    if (!this.routes[routeName]) {
      console.error('[Router] Unknown route:', routeName);
      return;
    }

    // Same route? Skip
    if (this.currentRoute === routeName) {
      console.log('[Router] Already on route:', routeName);
      return;
    }

    // Check cache
    if (this.cache.has(routeName)) {
      console.log('[Router] Cache hit:', routeName);
      this.render(routeName, this.cache.get(routeName));
      return;
    }

    // Show loading
    this.showLoading();

    // Fetch partial
    try {
      const url = this.routes[routeName];
      console.log('[Router] Fetching:', url);
      
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const html = await res.text();

      // Cache it
      this.cache.set(routeName, html);
      console.log('[Router] Cached:', routeName);

      // Render
      this.render(routeName, html);
    } catch (err) {
      console.error('[Router] Fetch failed:', err);
      this.showError(routeName, err.message);
    }
  },

  // ── Render Panel ──
  render(routeName, html) {
    const container = document.getElementById('main-content');
    if (!container) {
      console.error('[Router] Container #main-content not found');
      return;
    }

    // Inject HTML
    container.innerHTML = html;
    this.currentRoute = routeName;

    // Update URL hash (no reload)
    window.location.hash = '#/' + routeName;

    // Update UI
    this.updateBreadcrumb(routeName);
    this.updateSidebarActive(routeName);

    // Scroll to top
    container.scrollTop = 0;

    // Dispatch event (for analytics, hooks, etc.)
    window.dispatchEvent(new CustomEvent('routeChanged', {
      detail: { route: routeName }
    }));

    console.log('[Router] Rendered:', routeName);
  },

  // ── Loading State ──
  showLoading() {
    const container = document.getElementById('main-content');
    if (!container) return;

    container.innerHTML = `
      <div class="section-loading" style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 400px;
        gap: 12px;
      ">
        <div class="spinner" style="
          width: 32px;
          height: 32px;
          border: 3px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        "></div>
        <p style="
          font-size: 13px;
          color: var(--text-muted);
          font-weight: 500;
        ">Memuat panel...</p>
      </div>
    `;
  },

  // ── Error State ──
  showError(routeName, errorMsg) {
    const container = document.getElementById('main-content');
    if (!container) return;

    container.innerHTML = `
      <div class="error-state" style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 400px;
        gap: 12px;
        text-align: center;
        padding: 24px;
      ">
        <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color: var(--red)">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div>
          <p style="font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 4px">
            Gagal memuat panel
          </p>
          <p style="font-size: 12px; color: var(--text-muted)">
            ${errorMsg}
          </p>
        </div>
        <button class="btn-primary" onclick="Router.navigate('${routeName}')" style="margin-top: 8px">
          Coba Lagi
        </button>
      </div>
    `;
  },

  // ── Update Breadcrumb ──
  updateBreadcrumb(routeName) {
    const breadcrumb = document.getElementById('topbar-section');
    if (!breadcrumb) return;

    breadcrumb.textContent = this.titles[routeName] || routeName;
  },

  // ── Update Sidebar Active State ──
  updateSidebarActive(routeName) {
    // Remove active from all
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.remove('active');
    });

    // Add active to current
    const navItem = document.querySelector(`.nav-item[data-route="${routeName}"]`);
    if (navItem) {
      navItem.classList.add('active');
    }
  },

  // ── Prefetch (Background Load) ──
  async prefetch(routeName) {
    // Already cached or in queue? Skip
    if (this.cache.has(routeName) || this.prefetchQueue.has(routeName)) {
      return;
    }

    // Validate route
    if (!this.routes[routeName]) return;

    // Add to queue
    this.prefetchQueue.add(routeName);

    try {
      const url = this.routes[routeName];
      console.log('[Router] Prefetching:', url);

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const html = await res.text();

      // Cache it
      this.cache.set(routeName, html);
      console.log('[Router] Prefetched:', routeName);
    } catch (err) {
      console.warn('[Router] Prefetch failed:', routeName, err.message);
    } finally {
      this.prefetchQueue.delete(routeName);
    }
  },

  // ── Initialize Router ──
  init() {
    console.log('[Router] Initializing...');

    // Handle hash changes
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.slice(2); // remove "#/"
      if (hash && this.routes[hash]) {
        this.navigate(hash);
      } else if (!hash) {
        // No hash → go to dashboard
        this.navigate('dashboard');
      }
    });

    // Attach click listeners to sidebar nav items
    document.querySelectorAll('.nav-item[data-route]').forEach(item => {
      const route = item.dataset.route;

      // Click → navigate
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigate(route);
      });

      // Hover → prefetch (optional, enable if desired)
      // item.addEventListener('mouseenter', () => {
      //   this.prefetch(route);
      // });
    });

    // Initial route from hash or default to dashboard
    const hash = window.location.hash.slice(2) || 'dashboard';
    if (this.routes[hash]) {
      this.navigate(hash);
    } else {
      this.navigate('dashboard');
    }

    console.log('[Router] Ready');
  },

  // ── Clear Cache (for dev/debug) ──
  clearCache() {
    this.cache.clear();
    console.log('[Router] Cache cleared');
  }
};

// ── Export to Window ──
window.Router = Router;

// ── Auto-init (if DOM ready) ──
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Router.init());
} else {
  Router.init();
}
