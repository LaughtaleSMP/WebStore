// pull-to-refresh.js — Mobile Pull-to-Refresh for Admin Panel
// Native-like pull-to-refresh experience untuk update data

(function() {
  'use strict';

  var pullThreshold = 80; // Distance to trigger refresh
  var maxPull = 120; // Maximum pull distance
  var startY = 0;
  var currentY = 0;
  var isPulling = false;
  var isRefreshing = false;
  var scrollTop = 0;

  var indicator = null;
  var spinner = null;
  var pullText = null;

  // Create pull indicator
  function createIndicator() {
    if (indicator) return;

    indicator = document.createElement('div');
    indicator.id = 'pull-refresh-indicator';
    indicator.style.cssText = 
      'position:fixed;top:0;left:0;right:0;height:60px;' +
      'display:flex;align-items:center;justify-content:center;gap:10px;' +
      'background:linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 100%);' +
      'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);' +
      'z-index:9999;transform:translateY(-60px);' +
      'transition:transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s;' +
      'box-shadow:0 2px 8px rgba(0,0,0,0.3);' +
      'border-bottom:1px solid rgba(255,255,255,0.1);' +
      'will-change:transform,opacity;';

    // Spinner
    spinner = document.createElement('div');
    spinner.style.cssText =
      'width:20px;height:20px;border:2px solid rgba(255,255,255,0.2);' +
      'border-top-color:#60a5fa;border-radius:50%;' +
      'animation:spin 0.6s linear infinite;opacity:0;transition:opacity 0.2s;' +
      'will-change:transform;';

    // Text
    pullText = document.createElement('span');
    pullText.textContent = 'Pull to refresh';
    pullText.style.cssText =
      'font-size:13px;font-weight:600;color:#fff;letter-spacing:0.3px;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      'user-select:none;-webkit-user-select:none;';

    indicator.appendChild(spinner);
    indicator.appendChild(pullText);
    document.body.appendChild(indicator);

    // Add keyframe animation
    if (!document.getElementById('ptr-spin-keyframes')) {
      var style = document.createElement('style');
      style.id = 'ptr-spin-keyframes';
      style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }' +
        '@media (prefers-reduced-motion: reduce) { #pull-refresh-indicator * { animation: none !important; transition: none !important; } }';
      document.head.appendChild(style);
    }
  }

  // Update indicator based on pull distance
  function updateIndicator(distance) {
    if (!indicator) return;

    var percent = Math.min(distance / pullThreshold, 1);
    var translateY = Math.min(distance - 60, 0);

    indicator.style.transform = 'translateY(' + translateY + 'px)';
    indicator.style.opacity = percent;

    if (distance >= pullThreshold) {
      pullText.textContent = 'Release to refresh';
      pullText.style.color = '#34d399';
    } else {
      pullText.textContent = 'Pull to refresh';
      pullText.style.color = '#fff';
    }

    // Rotate spinner based on pull
    if (!isRefreshing) {
      spinner.style.transform = 'rotate(' + (percent * 360) + 'deg)';
    }
  }

  // Show refreshing state
  function showRefreshing() {
    if (!indicator) return;
    isRefreshing = true;

    indicator.style.transform = 'translateY(0)';
    indicator.style.opacity = '1';
    pullText.textContent = 'Refreshing...';
    pullText.style.color = '#60a5fa';
    spinner.style.opacity = '1';
    spinner.style.animation = 'spin 0.6s linear infinite';
  }

  // Hide indicator
  function hideIndicator() {
    if (!indicator) return;
    isRefreshing = false;

    indicator.style.transform = 'translateY(-60px)';
    indicator.style.opacity = '0';
    spinner.style.opacity = '0';
    spinner.style.animation = 'none';

    setTimeout(function() {
      pullText.textContent = 'Pull to refresh';
      pullText.style.color = '#fff';
    }, 200);
  }

  // Perform refresh action
  function doRefresh() {
    showRefreshing();

    // Trigger refresh for current section
    var activeSection = document.querySelector('.section.active');
    if (!activeSection) {
      // If no active section, just hide after delay
      setTimeout(hideIndicator, 800);
      return;
    }

    var sectionId = activeSection.id;
    var refreshed = false;

    // Section-specific refresh logic
    switch(sectionId) {
      case 'sec-recovery':
        // Recovery panel
        if (window._recoveryRefresh && typeof window._recoveryRefresh === 'function') {
          window._recoveryRefresh();
          refreshed = true;
        }
        break;
      case 'sec-mimi-inka':
        // Mimi Inka panel
        var mimiRefreshBtn = document.getElementById('mimi-refresh');
        if (mimiRefreshBtn) {
          mimiRefreshBtn.click();
          refreshed = true;
        }
        break;
      case 'sec-orders':
      case 'sec-all-orders':
        // Orders panel
        if (window._ordersRefresh && typeof window._ordersRefresh === 'function') {
          window._ordersRefresh();
          refreshed = true;
        }
        break;
      case 'sec-gem-topup':
        // Topup panel
        if (window._topupRefresh && typeof window._topupRefresh === 'function') {
          window._topupRefresh();
          refreshed = true;
        }
        break;
      case 'sec-finance-v2':
        // Finance panel
        if (window._financeRefresh && typeof window._financeRefresh === 'function') {
          window._financeRefresh();
          refreshed = true;
        }
        break;
      case 'sec-dashboard':
        // Dashboard - refresh everything
        if (window._dashboardRefresh && typeof window._dashboardRefresh === 'function') {
          window._dashboardRefresh();
          refreshed = true;
        }
        break;
      default:
        // Generic refresh - just reload page data
        console.log('[PTR] Generic refresh for:', sectionId);
    }

    // Hide indicator after refresh
    setTimeout(function() {
      hideIndicator();
      if (refreshed && typeof window.showAdminToast === 'function') {
        window.showAdminToast('Data refreshed', 'success');
      }
    }, refreshed ? 1000 : 500);
  }

  // Touch event handlers
  function handleTouchStart(e) {
    if (isRefreshing) return;

    scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Only allow pull at top of page
    if (scrollTop > 0) return;

    startY = e.touches[0].clientY;
    isPulling = false;
  }

  function handleTouchMove(e) {
    if (isRefreshing || scrollTop > 0) return;

    currentY = e.touches[0].clientY;
    var deltaY = currentY - startY;

    // Only pull down
    if (deltaY <= 0) {
      if (isPulling) {
        hideIndicator();
        isPulling = false;
      }
      return;
    }

    // Check if we should prevent scroll
    var currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
    if (currentScrollTop > 0) return;

    // Start pulling
    isPulling = true;

    // Apply resistance curve
    var resistance = 0.5;
    var pullDistance = Math.min(deltaY * resistance, maxPull);

    // Prevent default scroll when pulling (fix iOS bounce conflict)
    if (pullDistance > 10) {
      e.preventDefault();
      // Also prevent body scroll
      document.body.style.overflow = 'hidden';
    }

    updateIndicator(pullDistance);
  }

  function handleTouchEnd(e) {
    if (!isPulling || isRefreshing) return;

    // Restore body scroll
    document.body.style.overflow = '';

    var deltaY = currentY - startY;
    var resistance = 0.5;
    var pullDistance = Math.min(deltaY * resistance, maxPull);

    if (pullDistance >= pullThreshold) {
      // Haptic feedback on trigger
      if (window.navigator && navigator.vibrate) {
        navigator.vibrate(50); // 50ms vibration
      }
      // Trigger refresh
      doRefresh();
    } else {
      // Hide indicator
      hideIndicator();
    }

    isPulling = false;
  }

  // Initialize
  function init() {
    createIndicator();

    // Bind touch events to main content
    var mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.addEventListener('touchstart', handleTouchStart, { passive: true });
      mainContent.addEventListener('touchmove', handleTouchMove, { passive: false });
      mainContent.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    // Also bind to app container as fallback
    var app = document.getElementById('app');
    if (app) {
      app.addEventListener('touchstart', handleTouchStart, { passive: true });
      app.addEventListener('touchmove', handleTouchMove, { passive: false });
      app.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    console.log('[PTR] Pull-to-Refresh initialized');
  }

  // Expose refresh function globally
  window.triggerPullRefresh = doRefresh;

  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export expose function for panels to register refresh handlers
  window.registerPanelRefresh = function(panelId, refreshFn) {
    if (typeof refreshFn !== 'function') {
      console.warn('[PTR] registerPanelRefresh: refreshFn must be a function');
      return;
    }
    window['_' + panelId + 'Refresh'] = refreshFn;
    console.log('[PTR] Registered refresh handler for:', panelId);
  };

})();
