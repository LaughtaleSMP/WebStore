/* ══════════════════════════════════════════════════════════════
   page-nav.js — Floating dock navigation
   
   Premium floating dock with glassmorphism, pill-style active
   indicator, and smooth micro-animations.
   
   USAGE: <script src="js/page-nav.js"></script>
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var pages = [
    { href: 'monitor.html',     label: 'Monitor',  icon: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>' },
    { href: 'economy.html',     label: 'Economy',  icon: '<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 100 4h4a2 2 0 110 4H8"/><path d="M12 18V6"/>' },
    { href: 'status.html',      label: 'Status',   icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>' },
    { href: 'dokumentasi.html', label: 'Docs',     icon: '<path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>' }
  ];

  var loc = location.pathname.split('/').pop() || 'index.html';

  // Use <div> to avoid CSS conflicts with dokumentasi.html's bare `nav` selector
  var bar = document.createElement('div');
  bar.id = 'pn';
  bar.setAttribute('role', 'navigation');

  var html = '<div class="pn-dock">';
  for (var i = 0; i < pages.length; i++) {
    var p = pages[i];
    var isActive = loc === p.href;
    html += '<a href="' + p.href + '" class="pn-a' + (isActive ? ' pn-on' : '') + '">'
      + '<div class="pn-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + p.icon + '</svg></div>'
      + '<span class="pn-lbl">' + p.label + '</span>'
      + '</a>';
  }
  html += '</div>';
  bar.innerHTML = html;

  var css = document.createElement('style');
  css.textContent = '' +
    /* ── Wrapper — full-width fixed bottom, safe-area aware ── */
    '#pn{' +
    '  position:fixed!important;bottom:0!important;left:0!important;right:0!important;' +
    '  top:auto!important;height:auto!important;' +
    '  z-index:9999;display:flex;justify-content:center;' +
    '  padding:0 12px calc(8px + env(safe-area-inset-bottom)) 12px;' +
    '  pointer-events:none;' +
    '  transform:none!important;opacity:1!important;animation:none!important;' +
    '  border:none!important;border-bottom:none!important;background:none!important' +
    '}' +

    /* ── Dock — frosted pill bar ── */
    '.pn-dock{' +
    '  pointer-events:auto;' +
    '  display:flex;align-items:stretch;gap:2px;' +
    '  background:rgba(10,10,18,.72);' +
    '  backdrop-filter:blur(20px) saturate(1.4);-webkit-backdrop-filter:blur(20px) saturate(1.4);' +
    '  border:1px solid rgba(255,255,255,.06);' +
    '  border-radius:14px;' +
    '  padding:4px 6px;' +
    '  box-shadow:0 4px 20px rgba(0,0,0,.35),0 0 0 1px rgba(0,0,0,.2);' +
    '  animation:pnUp .35s cubic-bezier(.16,1,.3,1) both' +
    '}' +
    '@keyframes pnUp{from{opacity:0;transform:translateY(16px)}}' +

    /* ── Each nav item ── */
    '.pn-a{' +
    '  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;' +
    '  padding:8px 14px 6px;' +
    '  text-decoration:none;color:rgba(255,255,255,.28);' +
    '  border-radius:10px;' +
    '  transition:color .2s,background .2s;' +
    '  position:relative;' +
    '  -webkit-tap-highlight-color:transparent;touch-action:manipulation' +
    '}' +

    /* ── Icon circle ── */
    '.pn-ico{' +
    '  width:28px;height:28px;display:flex;align-items:center;justify-content:center;' +
    '  border-radius:8px;' +
    '  transition:background .25s,transform .2s cubic-bezier(.34,1.56,.64,1)' +
    '}' +
    '.pn-ico svg{width:16px;height:16px;flex-shrink:0}' +

    /* ── Label ── */
    '.pn-lbl{' +
    '  font-family:"Inter","JetBrains Mono",system-ui,sans-serif;' +
    '  font-size:.5rem;font-weight:500;letter-spacing:.3px;' +
    '  opacity:.7;transition:opacity .2s' +
    '}' +

    /* ── Hover ── */
    '.pn-a:hover{color:rgba(255,255,255,.55)}' +
    '.pn-a:hover .pn-ico{transform:translateY(-1px)}' +
    '.pn-a:active .pn-ico{transform:scale(.92)}' +

    /* ── Active state — soft pill glow ── */
    '.pn-on{color:rgba(168,85,247,.95)}' +
    '.pn-on .pn-ico{background:rgba(168,85,247,.12)}' +
    '.pn-on .pn-lbl{opacity:1;font-weight:600}' +
    '.pn-on::after{' +
    '  content:"";position:absolute;bottom:2px;left:50%;width:16px;height:2px;' +
    '  margin-left:-8px;border-radius:1px;' +
    '  background:#a855f7;' +
    '  box-shadow:0 0 6px rgba(168,85,247,.5)' +
    '}' +
    '.pn-on:hover{color:rgba(168,85,247,1)}' +

    /* ── Light theme ── */
    'body.light .pn-dock{background:rgba(245,245,250,.82);border-color:rgba(0,0,0,.06);' +
    '  box-shadow:0 4px 20px rgba(0,0,0,.08)}' +
    'body.light .pn-a{color:rgba(0,0,0,.3)}' +
    'body.light .pn-a:hover{color:rgba(0,0,0,.55)}' +
    'body.light .pn-on{color:#7c3aed}' +
    'body.light .pn-on .pn-ico{background:rgba(124,58,237,.08)}' +
    'body.light .pn-on::after{background:#7c3aed;box-shadow:0 0 6px rgba(124,58,237,.4)}' +

    /* ── Page body padding to avoid dock overlap ── */
    'body{padding-bottom:72px!important}' +
    '.w{padding-bottom:88px!important}' +

    /* ── Small screens ── */
    '@media(max-width:400px){' +
    '  .pn-dock{padding:3px 4px;border-radius:12px;gap:0}' +
    '  .pn-a{padding:7px 10px 5px}' +
    '  .pn-ico{width:24px;height:24px;border-radius:6px}' +
    '  .pn-ico svg{width:14px;height:14px}' +
    '  .pn-lbl{font-size:.44rem}' +
    '}' +

    '@media(max-width:340px){' +
    '  .pn-lbl{display:none}' +
    '  .pn-a{padding:8px 12px}' +
    '}';

  document.head.appendChild(css);
  document.body.appendChild(bar);
})();
