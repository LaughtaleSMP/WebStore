/**
 * Lazy Section Loader
 * 
 * Loads below-fold sections on-demand using IntersectionObserver.
 * Reduces initial HTML payload from 75KB → 15KB.
 * 
 * Usage:
 *   <section id="fitur" data-lazy-section="features">
 *     <div class="section-skeleton">Loading...</div>
 *   </section>
 */

const SectionLoader = {
  // ── Section Registry ──
  sections: {
    'features': 'sections/features.html',
    'rules': 'sections/rules.html',
    'shop': 'sections/shop.html',
    'community': 'sections/community.html',
    'donation': 'sections/donation.html',
    'footer': 'sections/footer.html',
  },

  // ── State ──
  cache: new Map(),
  observer: null,
  loading: new Set(),

  // ── Initialize ──
  init() {
    console.log('[SectionLoader] Initializing...');

    // Check browser support
    if (!('IntersectionObserver' in window)) {
      console.warn('[SectionLoader] IntersectionObserver not supported, loading all sections immediately');
      this.loadAllSections();
      return;
    }

    // Create observer
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const section = entry.target;
          const sectionId = section.dataset.lazySection;
          
          if (sectionId && !this.loading.has(sectionId)) {
            this.load(sectionId, section);
          }
        }
      });
    }, {
      rootMargin: '300px 0px', // Load 300px before section enters viewport
      threshold: 0.01
    });

    // Observe all lazy sections
    const lazySections = document.querySelectorAll('[data-lazy-section]');
    console.log(`[SectionLoader] Found ${lazySections.length} lazy sections`);
    
    lazySections.forEach(el => {
      this.observer.observe(el);
    });

    // Prefetch on hover (optional optimization)
    this.setupPrefetch();

    console.log('[SectionLoader] Ready');
  },

  // ── Load Section ──
  async load(sectionId, container) {
    // Check cache
    if (this.cache.has(sectionId)) {
      console.log(`[SectionLoader] Cache hit: ${sectionId}`);
      container.innerHTML = this.cache.get(sectionId);
      this.observer?.unobserve(container);
      this.triggerSectionReady(sectionId, container);
      return;
    }

    // Mark as loading
    this.loading.add(sectionId);
    console.log(`[SectionLoader] Loading: ${sectionId}`);

    // Fetch section HTML
    try {
      const url = this.sections[sectionId];
      const start = Date.now();
      
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const html = await res.text();
      const duration = Date.now() - start;

      // Cache it
      this.cache.set(sectionId, html);

      // Render
      container.innerHTML = html;

      // Stop observing
      this.observer?.unobserve(container);

      // Cleanup loading state
      this.loading.delete(sectionId);

      // Trigger ready event
      this.triggerSectionReady(sectionId, container);

      console.log(`[SectionLoader] Loaded: ${sectionId} (${duration}ms)`);
    } catch (err) {
      console.error(`[SectionLoader] Failed to load ${sectionId}:`, err);
      
      // Show error state
      container.innerHTML = `
        <div style="text-align:center;padding:3rem;color:var(--text-muted)">
          <p style="font-size:1.2rem;margin-bottom:0.5rem">⚠️</p>
          <p>Gagal memuat konten</p>
          <button onclick="SectionLoader.retry('${sectionId}', this.closest('[data-lazy-section]'))" 
                  style="margin-top:1rem;padding:0.5rem 1rem;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer">
            Coba Lagi
          </button>
        </div>
      `;

      this.loading.delete(sectionId);
    }
  },

  // ── Retry Load ──
  retry(sectionId, container) {
    // Clear cache for retry
    this.cache.delete(sectionId);
    
    // Show loading state
    container.innerHTML = '<div class="section-skeleton">Memuat...</div>';
    
    // Retry
    this.load(sectionId, container);
  },

  // ── Trigger Section Ready Event ──
  triggerSectionReady(sectionId, container) {
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('sectionLoaded', {
      detail: {
        section: sectionId,
        container: container
      }
    }));

    // Fade in animation
    container.style.opacity = '0';
    container.style.transform = 'translateY(20px)';
    
    requestAnimationFrame(() => {
      container.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      container.style.opacity = '1';
      container.style.transform = 'translateY(0)';
    });
  },

  // ── Prefetch on Hover ──
  setupPrefetch() {
    // Find nav links that point to lazy sections
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('mouseenter', () => {
        const hash = link.getAttribute('href').slice(1);
        const section = document.getElementById(hash);
        
        if (section && section.dataset.lazySection) {
          const sectionId = section.dataset.lazySection;
          
          // Prefetch if not already cached or loading
          if (!this.cache.has(sectionId) && !this.loading.has(sectionId)) {
            this.prefetch(sectionId);
          }
        }
      });
    });
  },

  // ── Prefetch (Background Load) ──
  async prefetch(sectionId) {
    if (this.cache.has(sectionId) || this.loading.has(sectionId)) {
      return;
    }

    console.log(`[SectionLoader] Prefetching: ${sectionId}`);
    this.loading.add(sectionId);

    try {
      const url = this.sections[sectionId];
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const html = await res.text();
      this.cache.set(sectionId, html);
      
      console.log(`[SectionLoader] Prefetched: ${sectionId}`);
    } catch (err) {
      console.warn(`[SectionLoader] Prefetch failed: ${sectionId}`, err);
    } finally {
      this.loading.delete(sectionId);
    }
  },

  // ── Load All Sections (Fallback) ──
  loadAllSections() {
    document.querySelectorAll('[data-lazy-section]').forEach(section => {
      const sectionId = section.dataset.lazySection;
      this.load(sectionId, section);
    });
  },

  // ── Clear Cache (for dev/debug) ──
  clearCache() {
    this.cache.clear();
    console.log('[SectionLoader] Cache cleared');
  }
};

// ── Export to Window ──
window.SectionLoader = SectionLoader;

// ── Auto-init ──
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => SectionLoader.init());
} else {
  SectionLoader.init();
}

// ── Cleanup on page hide (for bfcache) ──
window.addEventListener('pagehide', () => {
  if (SectionLoader.observer) {
    SectionLoader.observer.disconnect();
  }
});
