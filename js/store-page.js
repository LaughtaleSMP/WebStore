/* ══════════════════════════════════════════════════════════════
   store-page.js — Daftar Harga Store (ringan & efficient)

   FITUR:
   - Fetch basis (`eco:pricing.iph`) dari Supabase 1x per load
   - Render 256 item dari js/store-catalog.json
   - Collapsible per kategori (hemat DOM saat tertutup)
   - Search real-time (debounced, zero realloc per key press)
   - Compute harga client-side dari basis × baseW × qty

   PERFORMANCE:
   - Render hanya saat kategori dibuka (lazy)
   - DocumentFragment batched append
   - Search filter pakai dataset attr (no re-render)
   - Total bundle: <6KB minified
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ═══ Config ═══
  var SB_URL = 'https://jlxtnbnrirxhwuyqjlzw.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpseHRuYm5yaXJ4aHd1eXFqbHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NjYzOTAsImV4cCI6MjA5MTQ0MjM5MH0.MRhoVRDju41J8nWp4WTgiKOvxy7AgwGYH-el2zVsbWI';
  var CACHE_KEY = 'st_basis';
  var CACHE_TTL = 5 * 60 * 1000; // 5 menit
  var DEFAULT_BASIS = 57;

  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return Math.round(n).toLocaleString('id-ID'); };

  var _catalog = null;
  var _basis = DEFAULT_BASIS;
  var _searchTimer = null;

  // ═══ Load catalog + basis ═══
  document.addEventListener('DOMContentLoaded', function () {
    // Lazy init — jalankan hanya saat tab TAX & STORE dibuka pertama kali.
    // Kalau halaman tidak punya #st-catalog (bukan economy.html), skip total.
    var root = $('st-catalog');
    if (!root) return;

    var inited = false;
    function tryInit() {
      if (inited) return;
      inited = true;
      init();
    }

    // Kalau tab sudah aktif saat load (mis. #tax-store URL hash), init langsung.
    var activeMod = document.querySelector('.mod.active');
    if (activeMod && activeMod.id === 'mod-tax-store') { tryInit(); return; }

    // Otherwise, attach listener pada tab button
    var tabBtn = document.querySelector('[data-mod="tax-store"]');
    if (tabBtn) {
      tabBtn.addEventListener('click', tryInit, { once: true });
    } else {
      // Fallback: no tab button found → init anyway
      tryInit();
    }
  });

  async function init() {
    try {
      // Parallel load — catalog & basis
      var results = await Promise.all([loadCatalog(), loadBasis()]);
      _catalog = results[0];
      _basis = results[1];
      render();
      bindEvents();
    } catch (e) {
      console.error('[Store]', e);
      var el = $('st-catalog');
      if (el) el.innerHTML = '<div class="st-empty">Gagal memuat daftar harga. Refresh halaman.</div>';
    }
  }

  async function loadCatalog() {
    if (window.__STORE_CATALOG__) return window.__STORE_CATALOG__;
    try {
      var res = await fetch('js/store-catalog.json', { cache: 'force-cache' });
      if (res.ok) {
        var data = await res.json();
        window.__STORE_CATALOG__ = data;
        return data;
      }
    } catch (_) {}
    return loadCatalogViaScript();
  }

  function loadCatalogViaScript() {
    return new Promise(function (resolve, reject) {
      if (window.__STORE_CATALOG__) return resolve(window.__STORE_CATALOG__);
      var s = document.createElement('script');
      s.src = 'js/store-catalog.js';
      s.onload = function () {
        if (window.__STORE_CATALOG__) resolve(window.__STORE_CATALOG__);
        else reject(new Error('catalog script loaded but global missing'));
      };
      s.onerror = function () { reject(new Error('catalog script load error')); };
      document.head.appendChild(s);
    });
  }

  async function loadBasis() {
    // Try cache first
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (c && c.t && Date.now() - c.t < CACHE_TTL && Number.isFinite(c.v)) {
        setSync('cache • ' + timeAgo(c.t));
        return c.v;
      }
    } catch (e) {}

    // Fetch gacha_lb.guide.basis (source of truth untuk basis pricing)
    // gacha_lb field di Supabase bisa string JSON atau object
    try {
      var r = await fetch(
        SB_URL + '/rest/v1/leaderboard_sync?id=eq.current&select=gacha_lb,synced_at',
        { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
      );
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var arr = await r.json();
      var row = arr && arr[0];
      var gl = row && row.gacha_lb;
      if (typeof gl === 'string') { try { gl = JSON.parse(gl); } catch (e) { gl = null; } }
      var basis = gl && gl.guide && Number.isFinite(gl.guide.basis) && gl.guide.basis > 0
        ? gl.guide.basis
        : DEFAULT_BASIS;
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), v: basis }));
      } catch (e) {}
      setSync(row && row.synced_at ? 'server • ' + timeAgo(new Date(row.synced_at).getTime()) : 'live');
      return basis;
    } catch (e) {
      setSync('default (offline)');
      return DEFAULT_BASIS;
    }
  }

  function setSync(txt) { var el = $('st-sync'); if (el) el.textContent = txt; }

  function timeAgo(ts) {
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return s + 's lalu';
    if (s < 3600) return Math.floor(s / 60) + 'm lalu';
    if (s < 86400) return Math.floor(s / 3600) + 'j lalu';
    return Math.floor(s / 86400) + 'h lalu';
  }

  // ═══ Render top stats + catalog ═══
  function render() {
    // Stats
    $('st-basis').textContent = fmt(_basis);
    var total = 0;
    var catKeys = Object.keys(_catalog.items);
    for (var i = 0; i < catKeys.length; i++) total += _catalog.items[catKeys[i]].length;
    $('st-total').textContent = fmt(total);
    $('st-quota').textContent = _catalog.maxDaily;
    var resetEl = $('st-reset');
    if (resetEl) resetEl.textContent = (_catalog.resetHourWIB || 20) + ':00';

    // Basis pill di header (kalau ada)
    var basisPill = $('st-basis-pill');
    if (basisPill) basisPill.textContent = fmt(_basis) + '/JAM';

    // Render catalog — collapsed by default
    var frag = document.createDocumentFragment();
    for (var j = 0; j < catKeys.length; j++) {
      var catId = catKeys[j];
      var catMeta = _catalog.categories[catId] || { label: catId, color: '#fff' };
      var items = _catalog.items[catId];
      frag.appendChild(buildCatBlock(catId, catMeta, items));
    }
    var root = $('st-catalog');
    root.innerHTML = '';
    root.appendChild(frag);
  }

  function buildCatBlock(catId, meta, items) {
    var wrap = document.createElement('div');
    wrap.className = 'st-cat';
    wrap.dataset.cat = catId;

    // Header
    var hd = document.createElement('div');
    hd.className = 'st-cat-hd';
    hd.style.borderLeftColor = meta.color;
    hd.innerHTML = ''
      + '<span class="arr">▶</span>'
      + '<span class="st-cat-name" style="color:' + meta.color + '">' + escHtml(meta.label) + '</span>'
      + '<span class="st-cat-count">' + items.length + '</span>'
      + '<span class="st-cat-tag">' + escHtml(meta.tagline || '') + '</span>'
      + '<span class="st-cat-sub">' + priceRangeStr(items) + '</span>';
    hd.addEventListener('click', function () { toggleCat(wrap); });
    wrap.appendChild(hd);

    // Tier grid (build with array join — avoid innerHTML += realloc)
    var tg = document.createElement('div');
    tg.className = 'st-tier-grid';
    var tgParts = [];
    for (var t = 0; t < _catalog.tiers.length; t++) {
      var tr = _catalog.tiers[t];
      var prev = t > 0 ? _catalog.tiers[t - 1].cap : 0;
      var range = tr.cap >= 999 ? (prev + 1) + '+' : (prev + 1) + '-' + tr.cap + 'u';
      tgParts.push(
        '<div class="st-tier">'
        + '<div class="st-tier-mult" style="color:' + tr.color + '">×' + tr.mult.toFixed(1) + '</div>'
        + '<div class="st-tier-cap">' + range + '</div>'
        + '<div class="st-tier-lbl">' + escHtml(tr.label) + '</div>'
        + '</div>'
      );
    }
    tg.innerHTML = tgParts.join('');
    wrap.appendChild(tg);

    // Body (table) — render saat buka pertama kali (lazy)
    var body = document.createElement('div');
    body.className = 'st-body';
    wrap.appendChild(body);

    return wrap;
  }

  function priceRangeStr(items) {
    var min = Infinity, max = 0;
    for (var i = 0; i < items.length; i++) {
      // item = [label, qty, baseW]
      var price1x = Math.max(1, Math.round(items[i][2] * _basis));
      if (price1x < min) min = price1x;
      if (price1x > max) max = price1x;
    }
    if (!isFinite(min)) min = 0;
    return fmt(min) + ' — ' + fmt(max);
  }

  function toggleCat(el) {
    var isOpen = el.classList.contains('open');
    if (isOpen) {
      el.classList.remove('open');
    } else {
      // Lazy render body jika belum
      var body = el.querySelector('.st-body');
      if (!body.dataset.rendered) {
        renderCatBody(body, el.dataset.cat);
        body.dataset.rendered = '1';
      }
      el.classList.add('open');
    }
  }

  function renderCatBody(body, catId) {
    var items = _catalog.items[catId];
    var tiers = _catalog.tiers;
    var parts = [];

    parts.push('<table class="st-tbl"><thead><tr>'
      + '<th>Item</th>'
      + '<th class="num">Isi</th>'
      + '<th class="num per-unit-col">Harga /unit</th>'
      + '<th class="num">Normal</th>');
    for (var t = 1; t < tiers.length; t++) {
      // Tier 1 (×1.6) dan terakhir (×7) tetap tampil; tengah (×2.8, ×4.5) dikasih class tier-mid (hide di narrow col)
      var midCls = (t !== 1 && t !== tiers.length - 1) ? ' tier-mid' : '';
      parts.push('<th class="num' + midCls + '" style="color:' + tiers[t].color + '">×' + tiers[t].mult.toFixed(1) + '</th>');
    }
    parts.push('</tr></thead><tbody>');

    for (var i = 0; i < items.length; i++) {
      var it = items[i]; // [label, qty, baseW]
      var label = it[0], qty = it[1], baseW = it[2];
      var perUnit = Math.max(1, Math.round(baseW * _basis));
      var price1x = perUnit; // 1 unit in store already means `qty` blocks

      parts.push('<tr data-label="' + escAttr(label.toLowerCase()) + '">'
        + '<td class="name">' + escHtml(label) + ' <span class="qty">×' + qty + '</span></td>'
        + '<td class="num qty">' + qty + '</td>'
        + '<td class="num per-unit per-unit-col">' + fmt(perUnit) + '</td>'
        + '<td class="num price-1x">' + fmt(price1x) + '</td>');
      for (var j = 1; j < tiers.length; j++) {
        var tp = Math.ceil(price1x * tiers[j].mult);
        var midCls2 = (j !== 1 && j !== tiers.length - 1) ? ' tier-mid' : '';
        parts.push('<td class="num price-tier' + midCls2 + '" style="color:' + tiers[j].color + '88">' + fmt(tp) + '</td>');
      }
      parts.push('</tr>');
    }
    parts.push('</tbody></table>');
    body.innerHTML = parts.join('');
  }

  // ═══ Search + expand/collapse ═══
  function bindEvents() {
    $('st-search').addEventListener('input', onSearch);
    $('st-expand').addEventListener('click', expandAll);
    $('st-collapse').addEventListener('click', collapseAll);
  }

  function onSearch(e) {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(function () { doSearch(e.target.value.trim().toLowerCase()); }, 150);
  }

  function doSearch(q) {
    var cats = document.querySelectorAll('.st-cat');
    if (!q || q.length < 2) {
      // Clear search — tutup semua & un-hide
      for (var i = 0; i < cats.length; i++) {
        cats[i].style.display = '';
        var rows = cats[i].querySelectorAll('tbody tr');
        for (var r = 0; r < rows.length; r++) rows[r].classList.remove('hidden');
      }
      return;
    }
    // Force-render & filter
    for (var c = 0; c < cats.length; c++) {
      var cat = cats[c];
      var body = cat.querySelector('.st-body');
      if (!body.dataset.rendered) {
        renderCatBody(body, cat.dataset.cat);
        body.dataset.rendered = '1';
      }
      var matchedRows = 0;
      var trs = cat.querySelectorAll('tbody tr');
      for (var t = 0; t < trs.length; t++) {
        var lbl = trs[t].dataset.label || '';
        var hit = lbl.indexOf(q) !== -1;
        trs[t].classList.toggle('hidden', !hit);
        if (hit) matchedRows++;
      }
      if (matchedRows > 0) {
        cat.style.display = '';
        cat.classList.add('open');
      } else {
        cat.style.display = 'none';
      }
    }
  }

  function expandAll() {
    var cats = document.querySelectorAll('.st-cat');
    for (var i = 0; i < cats.length; i++) {
      var body = cats[i].querySelector('.st-body');
      if (!body.dataset.rendered) {
        renderCatBody(body, cats[i].dataset.cat);
        body.dataset.rendered = '1';
      }
      cats[i].classList.add('open');
    }
  }

  function collapseAll() {
    var cats = document.querySelectorAll('.st-cat');
    for (var i = 0; i < cats.length; i++) cats[i].classList.remove('open');
  }

  // ═══ Helpers ═══
  function escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"]/g, function (c) {
      return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;';
    });
  }
  function escAttr(s) { return escHtml(s).replace(/'/g, '&#39;'); }
})();
