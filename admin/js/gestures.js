/**
 * gestures.js — Mobile Gesture Engine
 * Laughtale SMP Admin Panel
 *
 * Implemented gestures:
 *  1. Swipe right from left edge (≤30px)  → open sidebar
 *  2. Swipe left  anywhere when open       → close sidebar
 *  3. Real-time drag feedback (sidebar follows finger)
 *  4. Velocity-based snap on release
 *
 * Design constraints:
 *  - Never blocks vertical scroll (angle check before preventDefault)
 *  - passive:true on initial touchstart for performance
 *  - will-change applied only during active drag, removed after
 *  - Zero external dependencies
 */

(function () {
  'use strict';

  /* ── Config ── */
  var EDGE_ZONE        = 32;   // px from left edge to start swipe-open
  var OPEN_THRESHOLD   = 72;   // px dragged before snap-open on release
  var CLOSE_THRESHOLD  = 60;   // px dragged left before snap-close on release
  var MIN_VELOCITY     = 0.35; // px/ms — fast flick always snaps
  var ANGLE_LOCK       = 30;   // degrees — lock to horizontal before preventing scroll
  var SIDEBAR_W        = 240;  // matches CSS width

  /* ── State ── */
  var _startX = 0, _startY = 0;
  var _lastX  = 0, _lastT  = 0;
  var _velX   = 0;
  var _dragging    = false;
  var _dirLocked   = false;  // true once we decided H vs V
  var _isHoriz     = false;  // locked to horizontal
  var _fromEdge    = false;  // gesture started from left edge
  var _sidebarWasOpen = false;

  /* ── DOM refs ── */
  var _sidebar  = null;
  var _backdrop = null;

  function _getSidebar()  { return _sidebar  || (_sidebar  = document.querySelector('.sidebar')); }
  function _getBackdrop() { return _backdrop || (_backdrop = document.getElementById('sidebar-backdrop')); }

  function _isOpen() {
    var s = _getSidebar();
    return s ? s.classList.contains('open') : false;
  }

  /* ── Sidebar position helpers (for drag feedback) ── */
  function _setPos(px) {
    var s = _getSidebar();
    if (!s) return;
    // Clamp to valid range: -SIDEBAR_W..0
    var clamped = Math.max(-SIDEBAR_W, Math.min(0, px));
    s.style.transform  = 'translateX(' + clamped + 'px)';
    s.style.transition = 'none';
    // Sync backdrop opacity
    var b = _getBackdrop();
    if (b) {
      var prog = (clamped + SIDEBAR_W) / SIDEBAR_W; // 0→1
      b.style.opacity         = prog * 0.55;
      b.style.pointerEvents   = prog > 0.05 ? 'auto' : 'none';
      b.style.transition      = 'none';
    }
  }

  function _snapOpen(animate) {
    var s = _getSidebar();
    var b = _getBackdrop();
    if (!s) return;
    s.style.transition = animate ? '' : 'none';
    s.style.transform  = 'translateX(0)';
    if (b) {
      b.style.transition    = animate ? '' : 'none';
      b.style.opacity       = '0.55';
      b.style.pointerEvents = 'auto';
    }
    // Let CSS class system own state for consistency
    requestAnimationFrame(function() {
      s.classList.add('open');
      if (b) b.classList.add('visible');
      // Clear inline overrides after transition
      var dur = animate ? 280 : 0;
      setTimeout(function() {
        s.style.transform  = '';
        s.style.transition = '';
        if (b) { b.style.opacity = ''; b.style.transition = ''; b.style.pointerEvents = ''; }
        s.style.willChange = 'auto';
      }, dur + 20);
    });
    // Sync hamburger icon
    _setHamburgerClose();
  }

  function _snapClose(animate) {
    var s = _getSidebar();
    var b = _getBackdrop();
    if (!s) return;
    s.style.transition = animate ? '' : 'none';
    s.style.transform  = 'translateX(-' + SIDEBAR_W + 'px)';
    if (b) {
      b.style.transition    = animate ? '' : 'none';
      b.style.opacity       = '0';
      b.style.pointerEvents = 'none';
    }
    requestAnimationFrame(function() {
      s.classList.remove('open');
      if (b) b.classList.remove('visible');
      var dur = animate ? 280 : 0;
      setTimeout(function() {
        s.style.transform  = '';
        s.style.transition = '';
        if (b) { b.style.opacity = ''; b.style.transition = ''; b.style.pointerEvents = ''; }
        s.style.willChange = 'auto';
      }, dur + 20);
    });
    _setHamburgerOpen();
  }

  function _setHamburgerClose() {
    var icon = document.getElementById('hamburger-icon');
    if (icon) icon.innerHTML = '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>';
  }
  function _setHamburgerOpen() {
    var icon = document.getElementById('hamburger-icon');
    if (icon) icon.innerHTML = '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>';
  }

  function _isInScrollableX(el) {
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.scrollWidth > el.clientWidth + 2) {
        var style = window.getComputedStyle(el);
        var overflowX = style.overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') {
          return true;
        }
      }
      el = el.parentElement;
    }
    return false;
  }

  /* ── Touch handlers ── */
  function _onTouchStart(e) {
    // Only single-finger gestures
    if (e.touches.length !== 1) { _dragging = false; return; }
    var t = e.touches[0];
    _startX = t.clientX;
    _startY = t.clientY;
    _lastX  = _startX;
    _lastT  = Date.now();
    _velX   = 0;
    _dragging    = true;
    _dirLocked   = false;
    _isHoriz     = false;
    _fromEdge    = _startX <= EDGE_ZONE;
    _sidebarWasOpen = _isOpen();

    // If sidebar is closed and touch didn't start at the edge, abort gesture tracking entirely
    if (!_sidebarWasOpen && !_fromEdge) {
      _dragging = false;
      return;
    }

    // Also abort if touch starts inside a horizontally scrollable element (like tables) when sidebar is closed
    var target = t.target || e.target;
    if (!_sidebarWasOpen && _isInScrollableX(target)) {
      _dragging = false;
      return;
    }

    // Prepare GPU layer for sidebar if we might drag it
    if (_fromEdge || _sidebarWasOpen) {
      var s = _getSidebar();
      if (s) s.style.willChange = 'transform';
      var b = _getBackdrop();
      if (b) b.style.willChange = 'opacity';
    }
  }

  function _onTouchMove(e) {
    if (!_dragging || e.touches.length !== 1) return;
    var t   = e.touches[0];
    var dx  = t.clientX - _startX;
    var dy  = t.clientY - _startY;
    var now = Date.now();

    // Calculate velocity (px/ms, smoothed)
    var dt = Math.max(1, now - _lastT);
    _velX  = 0.7 * _velX + 0.3 * ((t.clientX - _lastX) / dt);
    _lastX = t.clientX;
    _lastT = now;

    // Direction lock: decide H vs V once we have enough movement
    if (!_dirLocked && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      var angle = Math.atan2(Math.abs(dy), Math.abs(dx)) * 180 / Math.PI;
      _isHoriz  = angle < ANGLE_LOCK;
      _dirLocked = true;
    }

    if (!_dirLocked || !_isHoriz) return; // still vertical scroll — don't interfere

    // Horizontal gesture — prevent scroll
    e.preventDefault();

    // Case 1: Swipe right from edge → open sidebar
    if (!_sidebarWasOpen && _fromEdge && dx > 0) {
      // Sidebar starts at -SIDEBAR_W, drag adds dx
      _setPos(-SIDEBAR_W + dx);
      return;
    }

    // Case 2: Swipe left when sidebar is open → close
    if (_sidebarWasOpen && dx < 0) {
      // Sidebar starts at 0, drag subtracts
      _setPos(dx);
      return;
    }
  }

  function _onTouchEnd(e) {
    if (!_dragging) return;
    _dragging = false;

    var t  = e.changedTouches[0];
    var dx = t.clientX - _startX;

    if (!_dirLocked || !_isHoriz) {
      // Not a horizontal gesture — clean up will-change if we set it
      var s = _getSidebar();
      if (s) { s.style.willChange = 'auto'; s.style.transform = ''; s.style.transition = ''; }
      var b = _getBackdrop();
      if (b) { b.style.willChange = 'auto'; b.style.opacity = ''; b.style.transition = ''; b.style.pointerEvents = ''; }
      return;
    }

    // Velocity + distance decision
    var fastLeft  = _velX < -MIN_VELOCITY;
    var fastRight = _velX >  MIN_VELOCITY;

    if (!_sidebarWasOpen && _fromEdge) {
      // Opening gesture: snap open if dragged far enough OR flicked fast
      if (dx > OPEN_THRESHOLD || fastRight) {
        _snapOpen(true);
      } else {
        _snapClose(true);
      }
    } else if (_sidebarWasOpen) {
      // Closing gesture: snap close if dragged far enough OR flicked fast
      if (dx < -CLOSE_THRESHOLD || fastLeft) {
        _snapClose(true);
      } else {
        _snapOpen(true);
      }
    }
  }

  /* ── Init ── */
  function _init() {
    // Only activate on touch devices
    if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return;

    // Use passive:true on touchstart (no preventDefault needed there)
    document.addEventListener('touchstart', _onTouchStart, { passive: true });
    // touchmove needs passive:false so we can preventDefault for horizontal swipes
    document.addEventListener('touchmove',  _onTouchMove,  { passive: false });
    document.addEventListener('touchend',   _onTouchEnd,   { passive: true  });
    document.addEventListener('touchcancel',function() { _dragging = false; }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

})();

/* ============================================================
   BOTTOM NAV CONTROLLER
   Syncs bottom nav active state with showSection()
   ============================================================ */
(function () {
  'use strict';

  var BNAV_MAP = {
    'dashboard': 'bnav-dashboard',
    'orders':    'bnav-orders',
    'all-orders':'bnav-orders',
    'recovery':  'bnav-recovery',
    'mimi-inka': 'bnav-mimi',
  };

  /* ── Set active tab ── */
  function _setActive(sectionName) {
    var bnavId = BNAV_MAP[sectionName];
    document.querySelectorAll('.bnav-item').forEach(function(btn) {
      btn.classList.remove('active');
    });
    if (bnavId) {
      var btn = document.getElementById(bnavId);
      if (btn) btn.classList.add('active');
    }
    // Close "More" icon always on section change
    _setMoreIcon(false);
  }

  function _setMoreIcon(open) {
    var icon = document.getElementById('bnav-more-icon');
    if (!icon) return;
    if (open) {
      icon.innerHTML = '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>';
      var btn = document.getElementById('bnav-more');
      if (btn) btn.classList.add('active');
    } else {
      icon.innerHTML = '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>';
      var btn2 = document.getElementById('bnav-more');
      if (btn2) btn2.classList.remove('active');
    }
  }

  /* ── Patch window.showSection to sync bottom nav ── */
  function _patchShowSection() {
    var _orig = window.showSection;
    if (!_orig) return;
    window.showSection = function(name, el) {
      _orig(name, el);
      _setActive(name);
    };
  }

  /* ── Sync order notification badge ── */
  function _syncBadge() {
    var topBadge  = document.getElementById('topbar-notif-badge');
    var bnavBadge = document.getElementById('bnav-orders-badge');
    if (!topBadge || !bnavBadge) return;
    var count = topBadge.textContent.trim();
    var visible = topBadge.style.display !== 'none' && count !== '0';
    bnavBadge.style.display = visible ? 'flex' : 'none';
    bnavBadge.textContent   = count;
  }

  /* ── Wire up bottom nav buttons ── */
  function _bindButtons() {
    document.querySelectorAll('.bnav-item[data-section]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var sec = this.getAttribute('data-section');
        if (!sec) return;
        var navEl = document.getElementById('nav-' + sec);
        if (typeof window.showSection === 'function') {
          window.showSection(sec, navEl);
        }
      });
    });
  }

  /* ── Watch sidebar state for "More" icon toggle ── */
  function _watchSidebar() {
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar || !window.MutationObserver) return;
    var obs = new MutationObserver(function() {
      _setMoreIcon(sidebar.classList.contains('open'));
    });
    obs.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
  }

  /* ── Watch topbar badge for order count sync ── */
  function _watchBadge() {
    var badge = document.getElementById('topbar-notif-badge');
    if (!badge || !window.MutationObserver) return;
    var obs = new MutationObserver(_syncBadge);
    obs.observe(badge, { childList: true, attributes: true });
  }

  function _init() {
    _bindButtons();
    _patchShowSection();
    _watchSidebar();
    _watchBadge();
    _syncBadge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    setTimeout(_init, 0); // allow admin-nav.js to define showSection first
  }

})();

