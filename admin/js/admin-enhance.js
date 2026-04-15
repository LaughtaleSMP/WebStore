/* ================================================================
   admin-enhance.js  —  Collapsible Cards + Sidebar Accordion
   Laughtale Admin Panel — Enhancement Module

   USAGE: Include after admin.css + admin-enhance.css.
   No changes to existing HTML required.
   Cards get collapse buttons automatically injected.
   ================================================================ */

(function () {
  'use strict';

  /* ── Config ── */
  var STORAGE_KEY = 'lta_collapse_state'; // sessionStorage key
  var state = {};

  /* ── Helpers ── */
  function loadState() {
    try { state = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (e) { state = {}; }
  }

  function saveState() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { /* noop */ }
  }

  function getCardId(card) {
    if (!card.dataset.collapseId) {
      card.dataset.collapseId = 'card-' + Math.random().toString(36).slice(2, 8);
    }
    return card.dataset.collapseId;
  }

  /* ── Chevron SVG ── */
  function chevronSvg(cls) {
    return '<svg class="' + (cls || '') + '" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' +
           '<polyline points="9 18 15 12 9 6"/></svg>';
  }

  /* ── Wrap existing card content inside .card-body + .card-body-inner ── */
  function wrapCardContent(card) {
    if (card.querySelector('.card-body')) return; // already wrapped

    var header = card.querySelector('.card-header');
    if (!header) return; // no header → skip

    /* Collect everything AFTER the first .card-header */
    var children = Array.prototype.slice.call(card.childNodes);
    var afterHeader = [];
    var found = false;
    children.forEach(function (child) {
      if (found) afterHeader.push(child);
      if (child === header) found = true;
    });

    if (!afterHeader.length) return; // nothing to collapse

    var inner = document.createElement('div');
    inner.className = 'card-body-inner';
    afterHeader.forEach(function (child) { inner.appendChild(child); });

    var body = document.createElement('div');
    body.className = 'card-body';
    body.appendChild(inner);
    card.appendChild(body);
  }

  /* ── Inject collapse button into card header ── */
  function injectCollapseBtn(card, id) {
    var header = card.querySelector('.card-header');
    if (!header || header.querySelector('.card-collapse-btn')) return;

    var btn = document.createElement('button');
    btn.className = 'card-collapse-btn';
    btn.setAttribute('aria-label', 'Toggle section');
    btn.setAttribute('type', 'button');
    btn.innerHTML = chevronSvg();

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleCard(card, id);
    });

    /* If header is clickable too */
    header.addEventListener('click', function () {
      if (!card.classList.contains('collapsible')) return;
      toggleCard(card, id);
    });

    header.appendChild(btn);
  }

  /* ── Toggle a single card ── */
  function toggleCard(card, id) {
    var willCollapse = !card.classList.contains('collapsed');
    card.classList.toggle('collapsed', willCollapse);
    state[id] = willCollapse ? '1' : '0';
    saveState();
  }

  /* ── Restore card state from storage ── */
  function restoreCard(card, id) {
    if (state[id] === '1') card.classList.add('collapsed');
  }

  /* ── Init all collapsible cards ── */
  function initCards() {
    document.querySelectorAll('.card').forEach(function (card) {
      var header = card.querySelector('.card-header');
      if (!header) return;

      /* Auto-enable collapsible if not explicitly disabled */
      if (!card.classList.contains('no-collapse') && !card.classList.contains('collapsible')) {
        card.classList.add('collapsible');
      }
      if (!card.classList.contains('collapsible')) return;

      var id = getCardId(card);
      wrapCardContent(card);
      injectCollapseBtn(card, id);
      restoreCard(card, id);
    });
  }

  /* ================================================================
     SIDEBAR ACCORDION — nav groups collapse
     ================================================================ */

  function initSidebarAccordion() {
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    /* Find all nav-group-label elements and build accordion */
    var labels = sidebar.querySelectorAll('.nav-group-label');
    labels.forEach(function (label) {
      if (label.dataset.accordionInit) return;
      label.dataset.accordionInit = '1';

      var groupId = 'navgroup-' + (label.textContent.trim().replace(/\s+/g, '-').toLowerCase() || Math.random().toString(36).slice(2));

      /* Inject chevron if not already there */
      if (!label.querySelector('.ngl-chevron')) {
        var chev = document.createElement('span');
        chev.className = 'ngl-chevron';
        chev.innerHTML = chevronSvg();
        label.appendChild(chev);
      }

      /* Collect all nav-item siblings until next nav-group-label or sidebar-back */
      var siblings = [];
      var el = label.nextElementSibling;
      while (el && !el.classList.contains('nav-group-label') && !el.classList.contains('sidebar-back')) {
        siblings.push(el);
        el = el.nextElementSibling;
      }

      if (!siblings.length) return;

      /* Wrap siblings in .nav-group > .nav-group-inner */
      var inner = document.createElement('div');
      inner.className = 'nav-group-inner';
      siblings.forEach(function (s) { inner.appendChild(s); });

      var group = document.createElement('div');
      group.className = 'nav-group';
      group.dataset.groupId = groupId;
      group.appendChild(inner);

      label.parentNode.insertBefore(group, label.nextElementSibling);

      /* Restore collapsed state */
      if (state[groupId] === '1') {
        group.classList.add('collapsed');
        label.classList.add('collapsed');
      }

      /* Toggle on click */
      label.addEventListener('click', function () {
        var isCollapsed = group.classList.contains('collapsed');
        group.classList.toggle('collapsed', !isCollapsed);
        label.classList.toggle('collapsed', !isCollapsed);
        state[groupId] = isCollapsed ? '0' : '1';
        saveState();
      });
    });
  }

  /* ================================================================
     SECTION BLOCKS — accordion for main content sections
     Wrap any group of cards in:
       <div class="section-block">
         <div class="section-block-header">
           <span class="section-block-title">Group title</span>
           <span class="section-block-meta">(count or hint)</span>
         </div>
         <div class="section-block-body">
           <div class="section-block-body-inner">
             ...content...
           </div>
         </div>
       </div>
     ================================================================ */

  function initSectionBlocks() {
    document.querySelectorAll('.section-block-header').forEach(function (header) {
      if (header.dataset.sbInit) return;
      header.dataset.sbInit = '1';

      var block = header.closest('.section-block');
      if (!block) return;

      /* Inject chevron */
      if (!header.querySelector('.section-block-chevron')) {
        var chev = document.createElement('span');
        chev.className = 'section-block-chevron';
        chev.innerHTML = chevronSvg();
        header.appendChild(chev);
      }

      var titleEl = header.querySelector('.section-block-title');
      var blockId = 'sb-' + ((titleEl && titleEl.textContent.trim().replace(/\s+/g, '-').toLowerCase()) || Math.random().toString(36).slice(2));

      /* Restore open state (default: open if not in state) */
      if (state[blockId] !== '0') block.classList.add('open');

      header.addEventListener('click', function () {
        var willClose = block.classList.contains('open');
        block.classList.toggle('open', !willClose);
        state[blockId] = willClose ? '0' : '1';
        saveState();
      });
    });
  }

  /* ================================================================
     KEYBOARD SUPPORT — Enter/Space on collapse btn
     ================================================================ */

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var btn = e.target;
    if (btn.classList.contains('card-collapse-btn')) {
      e.preventDefault();
      btn.click();
    }
  });

  /* ================================================================
     MUTATION OBSERVER — handle dynamically injected cards
     ================================================================ */

  var _initTimer = null;

  function debouncedInit() {
    clearTimeout(_initTimer);
    _initTimer = setTimeout(function () {
      initCards();
      initSectionBlocks();
    }, 120);
  }

  if (window.MutationObserver) {
    var observer = new MutationObserver(function (mutations) {
      var relevant = mutations.some(function (m) {
        return m.addedNodes.length > 0;
      });
      if (relevant) debouncedInit();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ================================================================
     SECTION SWITCH HOOK — re-init when section changes
     ================================================================ */

  function hookShowSection() {
    if (window.showSection && !window.showSection._collapseHooked) {
      var _orig = window.showSection;
      window.showSection = function (name, el) {
        _orig(name, el);
        setTimeout(function () { initCards(); initSectionBlocks(); }, 50);
      };
      window.showSection._collapseHooked = true;
    }
  }

  /* ================================================================
     MAIN INIT
     ================================================================ */

  function init() {
    loadState();
    initSidebarAccordion();
    initCards();
    initSectionBlocks();
    hookShowSection();
  }

  /* Run after DOM ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 80); });
  } else {
    setTimeout(init, 80);
  }

  /* Expose for manual re-init */
  window._collapseInit   = init;
  window._collapseReinit = function () { debouncedInit(); };

})();
