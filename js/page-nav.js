/* ══════════════════════════════════════════════════════════════
   page-nav.js — Floating bottom navigation bar
   
   Provides quick switching between dashboard pages.
   Auto-highlights current page. Mobile-friendly.
   
   USAGE: <script src="js/page-nav.js"></script>
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var pages = [
    { href: 'monitor.html',      label: 'Monitor',  icon: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>' },
    { href: 'economy.html',      label: 'Economy',  icon: '<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 100 4h4a2 2 0 110 4H8"/><path d="M12 18V6"/>' },
    { href: 'status.html',       label: 'Status',   icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>' },
    { href: 'dokumentasi.html',  label: 'Docs',     icon: '<path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>' }
  ];

  // Detect current page
  var loc = location.pathname.split('/').pop() || 'index.html';

  // Build nav — use <div> not <nav> to avoid CSS conflicts (dokumentasi.html styles bare `nav`)
  var bar = document.createElement('div');
  bar.id = 'page-nav';
  bar.setAttribute('role', 'navigation');

  var html = '';
  for (var i = 0; i < pages.length; i++) {
    var p = pages[i];
    var isActive = loc === p.href || (loc === '' && p.href === 'index.html');
    html += '<a href="' + p.href + '" class="pn-item' + (isActive ? ' pn-active' : '') + '">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p.icon + '</svg>'
      + '<span>' + p.label + '</span>'
      + '</a>';
  }
  bar.innerHTML = html;

  // Inject CSS — all rules use #page-nav to avoid any conflicts
  var style = document.createElement('style');
  style.textContent = [
    '#page-nav{',
    '  position:fixed!important;bottom:0!important;left:0!important;right:0!important;',
    '  top:auto!important;height:auto!important;',
    '  z-index:9999;',
    '  display:flex;justify-content:center;align-items:stretch;gap:0;',
    '  background:rgba(9,9,15,.92);',
    '  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);',
    '  border-top:1px solid rgba(255,255,255,.06);',
    '  border-bottom:none!important;',
    '  padding:0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);',
    '  box-shadow:0 -4px 24px rgba(0,0,0,.4);',
    '  transform:none!important;opacity:1!important;animation:none!important',
    '}',
    '#page-nav .pn-item{',
    '  flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;',
    '  padding:10px 4px 8px;text-decoration:none;color:#3e3e60;',
    '  transition:color .2s,background .2s;min-width:0;max-width:100px;',
    '  border-top:2px solid transparent;position:relative;',
    '  -webkit-tap-highlight-color:transparent;touch-action:manipulation',
    '}',
    '#page-nav .pn-item svg{width:20px;height:20px;flex-shrink:0;transition:transform .15s}',
    '#page-nav .pn-item span{font-family:"JetBrains Mono",monospace;font-size:.42rem;font-weight:600;',
    '  letter-spacing:.6px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#page-nav .pn-item:hover{color:#7777a0;background:rgba(255,255,255,.02)}',
    '#page-nav .pn-item:active{background:rgba(255,255,255,.05)}',
    '#page-nav .pn-active{color:#a855f7;border-top-color:#a855f7}',
    '#page-nav .pn-active::before{content:"";position:absolute;top:-1px;left:20%;right:20%;height:2px;',
    '  background:linear-gradient(90deg,transparent,#a855f7,transparent);filter:blur(3px)}',
    '#page-nav .pn-active:hover{color:#a855f7}',
    /* Light theme support */
    'body.light #page-nav{background:rgba(240,240,245,.95);border-top-color:rgba(0,0,0,.06);',
    '  box-shadow:0 -4px 24px rgba(0,0,0,.08)}',
    'body.light #page-nav .pn-item{color:#8888aa}',
    'body.light #page-nav .pn-item:hover{color:#555580;background:rgba(0,0,0,.02)}',
    'body.light #page-nav .pn-active{color:#7c3aed;border-top-color:#7c3aed}',
    /* Make room for nav in page content */
    'body{padding-bottom:64px!important}',
    '.w{padding-bottom:84px!important}',
    /* Mobile tweaks */
    '@media(max-width:400px){',
    '  #page-nav .pn-item span{font-size:.36rem;letter-spacing:.3px}',
    '  #page-nav .pn-item svg{width:18px;height:18px}',
    '  #page-nav .pn-item{padding:9px 2px 7px}',
    '}'
  ].join('\n');

  document.head.appendChild(style);
  document.body.appendChild(bar);
})();
