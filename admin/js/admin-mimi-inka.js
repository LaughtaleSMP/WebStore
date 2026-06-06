// admin-mimi-inka.js — Dashboard Mimi Inka
// Menampilkan semua player & customisasi title/nametag mereka.
// Data source: leaderboard_sync.gacha_lb.player_backups[].mimi_data
// Glyph rendering: assets/glyph_E7.png (2304x2304, 16-col, 144px/tile)
// STATUS: Command Queue aktif — revoke/assign title/nametag INSERT ke mimi_commands (Supabase).

(function () {
  'use strict';

  /* ── Constants ── */
  var GLYPH_TILE = 144, GLYPH_COLS = 16, CROP_SCALE = 8;
  var CACHE_TTL = 120_000;

  /* ── State ── */
  var _cache = null, _cacheTs = 0, _lastSyncTs = 0;
  var _searchQ = '', _sortBy = 'name', _filterType = 'all', _activeTab = 'players';
  var _selected = new Set();
  var _bulkMode = false;
  var _timer = null, _secsLeft = 60;

  /* ── Canvas Auto-Crop Engine (Multi-Sheet) ── */
  var _spriteImages = {};
  var _cropCache    = {}; // cacheKey -> {url,w,h}
  var _cropOrder    = []; // LRU order for cache eviction
  var _CACHE_MAX    = 400;

  function _loadAllSheets(cb) {
    _spriteImages = {}; _cropCache = {}; _cropOrder = [];
    var gm = window.glyphManager;
    if (!gm) { if (cb) cb(); return; }
    var sheets = gm.getSheets();
    var ranges = Object.keys(sheets);
    if (!ranges.length) { if (cb) cb(); return; }
    var pending = ranges.length;
    ranges.forEach(function(r) {
      var img = new Image();
      // CRITICAL: Set crossOrigin BEFORE setting src
      img.crossOrigin = 'anonymous';
      img.onload  = function() { _spriteImages[r] = img; if (--pending===0 && cb) cb(); };
      img.onerror = function() { 
        console.warn('[Mimi] Failed to load glyph sheet:', sheets[r]);
        if (--pending===0 && cb) cb(); 
      };
      // Add cache-busting query param to force fresh load with CORS
      var url = sheets[r];
      img.src = url + (url.indexOf('?') > -1 ? '&' : '?') + '_cors=' + Date.now();
    });
  }

  // Load all sheets on init & subscribe to changes
  _loadAllSheets();
  if (window.glyphManager) {
    window.glyphManager.subscribe(function() {
      _loadAllSheets(function() { if (_cache) render(_cache); });
    });
  }

  /* ── Crop one glyph tile (LRU cache, max 400 entries) ── */
  function _cropGlyph(cp) {
    var rangeHex = (cp >> 8).toString(16).toUpperCase();
    var cacheKey = rangeHex + '_' + cp;
    if (_cropCache[cacheKey]) return _cropCache[cacheKey];
    var img = _spriteImages[rangeHex];
    if (!img) return null;
    var idx = cp & 0xFF;
    var col = idx % GLYPH_COLS, row = Math.floor(idx / GLYPH_COLS);
    var T = GLYPH_TILE, tile = document.createElement('canvas');
    tile.width = T; tile.height = T;
    var tc = tile.getContext('2d');
    tc.drawImage(img, col * T, row * T, T, T, 0, 0, T, T);
    
    // Try getImageData - if tainted, fallback to no-crop version
    var d;
    try {
      d = tc.getImageData(0, 0, T, T).data;
    } catch (e) {
      // Canvas tainted - return full tile without auto-crop
      console.warn('[Mimi] Canvas CORS issue, using full tile for U+' + cp.toString(16).toUpperCase());
      var S = CROP_SCALE;
      var fallback = document.createElement('canvas');
      fallback.width = T * S; fallback.height = T * S;
      var fc = fallback.getContext('2d');
      fc.imageSmoothingEnabled = false;
      fc.drawImage(tile, 0, 0, T, T, 0, 0, T * S, T * S);
      var r2 = { url: fallback.toDataURL(), w: T * S, h: T * S };
      _cropCache[cacheKey] = r2;
      _cropOrder.push(cacheKey);
      return r2;
    }
    var x0 = T, y0 = T, x1 = -1, y1 = -1;
    for (var y = 0; y < T; y++) for (var x = 0; x < T; x++) {
      if (d[(y * T + x) * 4 + 3] > 0) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) return null;
    var cw = x1-x0+1, ch = y1-y0+1, S = CROP_SCALE;
    var o = document.createElement('canvas');
    o.width = cw*S; o.height = ch*S;
    var oc = o.getContext('2d');
    oc.imageSmoothingEnabled = false;
    oc.drawImage(tile, x0, y0, cw, ch, 0, 0, cw*S, ch*S);
    // LRU eviction
    if (_cropOrder.length >= _CACHE_MAX) {
      var oldest = _cropOrder.shift();
      delete _cropCache[oldest];
    }
    var r2 = { url: o.toDataURL(), w: cw*S, h: ch*S };
    _cropCache[cacheKey] = r2;
    _cropOrder.push(cacheKey);
    return r2;
  }

  /* ── Glyph Renderer (Canvas Auto-Crop) ── */
  function renderGlyph(text, displayH) {
    if (!text || typeof text !== 'string') return '';
    var h = displayH || 48;
    var clean = text.replace(/\u00a7[0-9a-fk-or]/gi, '');
    var esc = typeof escHtml === 'function' ? escHtml : function (s) { return s; };
    var out = '';
    for (var i = 0; i < clean.length; i++) {
      var cp = clean.codePointAt(i);
      if (cp >= 0xE700 && cp <= 0xE7FF) {
        var g = _cropGlyph(cp);
        if (g) {
          out += '<img src="' + g.url + '" style="height:' + h + 'px;max-width:100%;object-fit:contain;image-rendering:pixelated;vertical-align:middle" title="U+' + cp.toString(16).toUpperCase() + '">';
        } else {
          out += '<span style="display:inline-block;width:' + h + 'px;height:' + h + 'px;background:rgba(255,255,255,.05);border-radius:6px;vertical-align:middle" title="Loading…"></span>';
        }
        if (cp > 0xFFFF) i++;
      } else {
        var fs = Math.max(14, Math.round(h * 0.65));
        out += '<span style="font-size:' + fs + 'px;font-weight:800;line-height:1;color:var(--text);vertical-align:middle">' + esc(clean[i]) + '</span>';
      }
    }
    return out;
  }

  /* ── Pill (label + glyph value) ── */
  function pillHtml(label, value, color, glyphH) {
    var rendered = renderGlyph(value, 18); // shrink glyph slightly for elegance
    return '<div style="display:flex;flex-direction:column;gap:4px;padding:8px 10px;' +
      'border-radius:8px;background:linear-gradient(180deg, ' + color + '08, ' + color + '02);' +
      'border:1px solid ' + color + '15;box-shadow:inset 0 1px 0 rgba(255,255,255,0.02);' +
      'box-sizing:border-box;min-width:120px;flex:1">' +
      '<span style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:' + color + ';opacity:.9">' + label + '</span>' +
      '<div style="display:flex;align-items:center;gap:2px;flex-wrap:wrap;min-height:20px">' + rendered + '</div>' +
      '</div>';
  }

  /* ── KPI card ── */
  function kpiCard(label, val, bg, color, iconPath) {
    return '<div class="mi-kpi">' +
      '<div class="mi-kpi-icon" style="background:' + bg + ';color:' + color + '">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="' + iconPath + '"/></svg>' +
      '</div>' +
      '<div>' +
        '<div class="mi-kpi-val">' + val + '</div>' +
        '<div class="mi-kpi-lbl">' + label + '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── Player card ── */
  function playerCard(p) {
    var md = (p && p.mimi_data) ? p.mimi_data : {};
    var hasTitle   = !!(md.ct || md.it);
    var hasNametag = !!(md.cn || md.in);

    var pName = (p && p.name) ? p.name : '?';
    // Escape untuk URL (Minecraft nama bisa ada spasi)
    var safeName    = pName.replace(/ /g, '_');
    var avatarUrl   = 'https://crafthead.net/helm/' + encodeURIComponent(safeName) + '/32.png';
    var fallbackUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(pName) +
      '&background=1a1a2e&color=fff&size=32&bold=true';

    /* Status badges */
    var statusHtml = '';
    if (hasTitle)   statusHtml += '<span style="font-size:8.5px;padding:2px 6px;border-radius:99px;background:rgba(167,139,250,.1);color:#a78bfa;border:1px solid rgba(167,139,250,.2);font-weight:700">Title</span>';
    if (hasNametag) statusHtml += '<span style="font-size:8.5px;padding:2px 6px;border-radius:99px;background:rgba(52,211,153,.1);color:#34d399;border:1px solid rgba(52,211,153,.2);font-weight:700">Nametag</span>';
    if (!hasTitle && !hasNametag) statusHtml = '<span style="font-size:8.5px;padding:2px 6px;border-radius:99px;background:rgba(255,255,255,.05);color:var(--text-faint);font-weight:600">Tidak ada</span>';

    /* Customization pills */
    var pillsHtml = '';
    
    // Combine Title if identical
    if (md.ct && md.it && md.ct === md.it) {
      pillsHtml += pillHtml('Title (Chat/IG)', md.ct, '#a78bfa');
    } else {
      if (md.ct) pillsHtml += pillHtml('Chat Title', md.ct, '#a78bfa');
      if (md.it) pillsHtml += pillHtml('Title IG', md.it, '#818cf8');
    }

    // Combine Nametag if identical
    if (md.cn && md.in && md.cn === md.in) {
      pillsHtml += pillHtml('Nametag (Chat/IG)', md.cn, '#34d399');
    } else {
      if (md.cn) pillsHtml += pillHtml('Chat Nametag', md.cn, '#34d399');
      if (md.in) pillsHtml += pillHtml('Nametag IG', md.in, '#2dd4bf');
    }

    if (!pillsHtml) {
      pillsHtml = '<div style="font-size:10.5px;color:var(--text-faint);font-style:italic;padding:4px 0">Belum ada kustomisasi</div>';
    }

    var esc = typeof escHtml === 'function' ? escHtml : function(s){ return s; };
    var isSelected = _selected.has(pName);
    var chkStyle = 'position:absolute;top:8px;right:8px;width:16px;height:16px;border-radius:4px;border:1.5px solid ' +
      (isSelected ? '#60a5fa' : 'rgba(255,255,255,.15)') +
      ';background:' + (isSelected ? '#60a5fa' : 'rgba(0,0,0,.2)') +
      ';display:' + (_bulkMode ? 'flex' : 'none') + ';align-items:center;justify-content:center;cursor:pointer;z-index:2;flex-shrink:0;transition:all 0.2s';
    var chkInner = isSelected
      ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
      : '';

    return '<div class="mimi-card" data-player="' + esc(pName) + '" style="background:var(--surface2);border:1px solid ' +
      (isSelected ? 'rgba(96,165,250,.4)' : 'rgba(255,255,255,0.05)') + ';' +
      'border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px;cursor:pointer;position:relative;' +
      'transition:all 0.2s cubic-bezier(0.4, 0, 0.2, 1);box-shadow:0 2px 8px rgba(0,0,0,0.2)"' +
      ' onmouseover="this.style.borderColor=\'' + (isSelected?'rgba(96,165,250,.6)':'rgba(255,255,255,0.15)') + '\';this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 6px 16px rgba(0,0,0,0.3)\'"' +
      ' onmouseout="this.style.borderColor=\'' + (isSelected?'rgba(96,165,250,.4)':'rgba(255,255,255,0.05)') + '\';this.style.transform=\'translateY(0)\';this.style.boxShadow=\'0 2px 8px rgba(0,0,0,0.2)\'">' +
      '<div class="mimi-chk" data-chkplayer="' + esc(pName) + '" style="' + chkStyle + '">' + chkInner + '</div>' +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<div style="position:relative;flex-shrink:0">' +
          '<img src="' + avatarUrl + '" onerror="this.onerror=null;this.src=\'' + fallbackUrl + '\'"' +
          ' style="width:28px;height:28px;border-radius:6px;background:#1a1a2e;object-fit:cover;image-rendering:pixelated;box-shadow:0 2px 6px rgba(0,0,0,0.3)">' +
          '<div style="position:absolute;bottom:-2px;right:-2px;width:8px;height:8px;' +
          'border-radius:50%;border:2px solid var(--surface2);background:' + (p.online ? '#34d399' : '#64748b') + ';box-shadow:0 0 0 1px rgba(0,0,0,0.2)"></div>' +
        '</div>' +
        '<div style="flex:1;min-width:0;padding-right:20px">' +
          '<div style="font-weight:700;font-size:13px;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:0.2px">' + esc(pName) + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px">' + pillsHtml + '</div>' +
      '</div>';
  }

  /* ── Main render ── */
  function render(data) {
    var body = document.getElementById('mimi-body');
    if (!body) return;

    /* Filter + search */
    var list = data.filter(function (p) {
      var md = (p && p.mimi_data) ? p.mimi_data : {};
      var nm = ((p && p.name) ? p.name : '').toLowerCase();
      if (_searchQ && nm.indexOf(_searchQ) === -1) return false;
      var hasT = !!(md.ct || md.it);
      var hasN = !!(md.cn || md.in);
      if (_filterType === 'title')   return hasT;
      if (_filterType === 'nametag') return hasN;
      if (_filterType === 'both')    return hasT && hasN;
      if (_filterType === 'none')    return !hasT && !hasN;
      return true;
    });

    /* Sort */
    list.sort(function (a, b) {
      if (_sortBy === 'name') return ((a.name || '').localeCompare(b.name || ''));
      var aM = (a.mimi_data || {}), bM = (b.mimi_data || {});
      if (_sortBy === 'has_title') return (!!(bM.ct || bM.it) ? 1 : 0) - (!!(aM.ct || aM.it) ? 1 : 0);
      return (!!(bM.cn || bM.in) ? 1 : 0) - (!!(aM.cn || aM.in) ? 1 : 0);
    });

    /* KPI totals dari seluruh data (bukan filtered) */
    var totalPlayers = data.length;
    var withTitle    = data.filter(function (p) { var m = p.mimi_data || {}; return !!(m.ct || m.it); }).length;
    var withNametag  = data.filter(function (p) { var m = p.mimi_data || {}; return !!(m.cn || m.in); }).length;
    var withBoth     = data.filter(function (p) { var m = p.mimi_data || {}; return !!(m.ct || m.it) && !!(m.cn || m.in); }).length;

    var lastSyncStr = _lastSyncTs
      ? new Date(_lastSyncTs).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      : 'Belum sync';

    var html = '';

    /* KPI strip */
    html += '<div class="mi-kpi-grid">' +
      kpiCard('Total Player',  totalPlayers, 'rgba(56,189,248,.1)',  '#38bdf8', 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0') +
      kpiCard('Punya Title',   withTitle,    'rgba(167,139,250,.1)', '#a78bfa', 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3l-4 4z') +
      kpiCard('Punya Nametag', withNametag,  'rgba(52,211,153,.1)',  '#34d399', 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z') +
      kpiCard('Title+Nametag', withBoth,     'rgba(251,191,36,.1)',  '#fbbf24', 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z') +
    '</div>';

    /* Unified Toolbar */
    var tabBtnStyle = 'font-size:11px;font-weight:700;padding:6px 14px;border-radius:8px;cursor:pointer;border:none;transition:all .2s;outline:none;display:inline-flex;align-items:center;gap:6px';
    var tabActive   = 'background:var(--surface2);color:var(--text-main);box-shadow:0 2px 6px rgba(0,0,0,.2)';
    var tabInactive = 'background:transparent;color:var(--text-faint)';


    html += '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;padding:6px;background:var(--surface);border:1px solid rgba(255,255,255,0.04);border-radius:10px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.02)">' +
      /* Left: Tabs */
      '<div style="display:flex;align-items:center;gap:4px">' +
        '<button id="mimi-tab-players" style="' + tabBtnStyle + ';' + (_activeTab==='players'?tabActive:tabInactive) + '">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' +
        'Players</button>' +
        '<button id="mimi-tab-catalog" style="' + tabBtnStyle + ';' + (_activeTab==='catalog'?tabActive:tabInactive) + '">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>' +
        'Catalog</button>' +
      '</div>' +
      /* Right: Tools (only if activeTab == players) */
      (_activeTab === 'players' ? 
      '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px">' +
        '<select id="mimi-sort" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:6px;color:var(--text-main);padding:5px 10px;font-size:10.5px;font-weight:600;outline:none;cursor:pointer;transition:all 0.15s">' +
        '<option value="name"'       + (_sortBy==='name'?       ' selected':'') + '>A–Z Nama</option>' +
        '<option value="has_title"'  + (_sortBy==='has_title'?  ' selected':'') + '>Punya Title</option>' +
        '<option value="has_nametag"'+ (_sortBy==='has_nametag'?' selected':'') + '>Punya Nametag</option>' +
        '</select>' +
        '<select id="mimi-filter" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:6px;color:var(--text-main);padding:5px 10px;font-size:10.5px;font-weight:600;outline:none;cursor:pointer;transition:all 0.15s">' +
        '<option value="all"'     + (_filterType==='all'?     ' selected':'') + '>Semua</option>' +
        '<option value="title"'   + (_filterType==='title'?   ' selected':'') + '>Title Saja</option>' +
        '<option value="nametag"' + (_filterType==='nametag'? ' selected':'') + '>Nametag Saja</option>' +
        '<option value="both"'    + (_filterType==='both'?    ' selected':'') + '>Title & Nametag</option>' +
        '<option value="none"'    + (_filterType==='none'?    ' selected':'') + '>Tanpa Kustomisasi</option>' +
        '</select>' +
        '<div style="width:1px;height:16px;background:rgba(255,255,255,0.1);margin:0 2px"></div>' +
        '<button id="mimi-bulk-toggle" style="background:' + (_bulkMode?'rgba(96,165,250,.15)':'transparent') + ';color:' + (_bulkMode?'#60a5fa':'var(--text-faint)') + ';border:1px solid ' + (_bulkMode?'rgba(96,165,250,.3)':'transparent') + ';border-radius:6px;padding:5px 10px;font-size:10.5px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px;transition:all 0.2s" onmouseover="this.style.background=\'' + (_bulkMode?'rgba(96,165,250,.2)':'rgba(255,255,255,0.05)') + '\'" onmouseout="this.style.background=\'' + (_bulkMode?'rgba(96,165,250,.15)':'transparent') + '\'">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="5" width="4" height="4" rx="1"/><rect x="3" y="11" width="4" height="4" rx="1"/><rect x="3" y="17" width="4" height="4" rx="1"/><line x1="11" y1="7" x2="21" y2="7"/><line x1="11" y1="13" x2="21" y2="13"/><line x1="11" y1="19" x2="21" y2="19"/></svg>Bulk Action</button>' +
        '<input type="file" id="mimi-glyph-input" accept=".png" style="display:none">' +
        '<button id="mimi-glyph-btn" style="font-size:10.5px;padding:5px 12px;border-radius:6px;display:inline-flex;align-items:center;gap:5px;background:rgba(74,143,255,.1);color:#60a5fa;border:1px solid rgba(74,143,255,.25);cursor:pointer;font-weight:700">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>Glyph Library</button>' +

      '</div>' : '') +
      '</div>';

    if (_activeTab === 'catalog') {
      html += _buildCatalogHtml(data);
    } else {
      /* Bulk action bar (Contextual) */
      if (_bulkMode) {
        var bulkBtnStyle = 'font-size:10px;font-weight:800;padding:6px 12px;border-radius:6px;cursor:pointer;border:none;display:inline-flex;align-items:center;gap:5px;transition:all .15s;text-transform:uppercase;letter-spacing:0.5px';
        html += '<div id="mimi-bulk-bar" style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:14px;padding:8px 14px;background:rgba(96,165,250,0.05);border:1px dashed rgba(96,165,250,0.3);border-radius:10px">' +
          '<span style="font-size:11.5px;color:var(--text-main);font-weight:700"><span style="color:#60a5fa;font-size:14px;margin-right:2px">' + _selected.size + '</span> player terpilih</span>';
        if (_selected.size > 0) {
           html += '<div style="margin-left:auto;display:flex;flex-wrap:wrap;gap:8px">' + 
             '<button id="mimi-bulk-export-json" style="' + bulkBtnStyle + ';background:rgba(52,211,153,.1);color:#34d399;border:1px solid rgba(52,211,153,.25)">JSON</button>' +
             '<button id="mimi-bulk-export-csv" style="' + bulkBtnStyle + ';background:rgba(251,191,36,.1);color:#fbbf24;border:1px solid rgba(251,191,36,.25)">CSV</button>' +
             '<button id="mimi-bulk-select-all" style="' + bulkBtnStyle + ';background:rgba(96,165,250,.1);color:#60a5fa;border:1px solid rgba(96,165,250,.25)">Pilih Semua</button>' +
             '<button id="mimi-bulk-deselect" style="' + bulkBtnStyle + ';background:rgba(248,113,113,.1);color:#f87171;border:1px solid rgba(248,113,113,.25)">Batal</button>' +
             '</div>';
        } else {
           html += '<span style="font-size:10.5px;color:var(--text-faint);font-style:italic;margin-left:auto">Klik kartu player untuk memilih.</span>';
        }
        html += '</div>';
      }

      /* List Status & Sync Info */
      html += '<div style="display:flex;align-items:center;justify-content:space-between;font-size:10.5px;color:var(--text-faint);margin-bottom:10px;padding:0 4px">' +
        '<span>Menampilkan <strong style="color:var(--text-main)">' + list.length + '</strong> dari ' + totalPlayers + ' player</span>' +
        '<span style="display:flex;align-items:center;gap:6px"><div style="width:6px;height:6px;border-radius:50%;background:#34d399;box-shadow:0 0 6px rgba(52,211,153,0.6);animation:playerDotPulse 2s infinite"></div> Sinkronisasi terakhir: <strong style="color:var(--text-main)">' + lastSyncStr + '</strong></span>' +
        '</div>';

      if (!list.length) {
        html += '<div class="empty-state">Tidak ada player yang cocok dengan filter.</div>';
      } else {
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr));gap:8px">';
        for (var i = 0; i < list.length; i++) html += playerCard(list[i]);
        html += '</div>';
      }
    }

    body.innerHTML = html;
    _bindToolbar();
  }

  /* ── Bulk Helpers ── */
  function _bulkExportJson(names) {
    if (!_cache || !names.length) return;
    var rows = _cache.filter(function(p){ return names.indexOf(p.name) > -1; });
    var out = rows.map(function(p){
      var md = p.mimi_data || {};
      return { name: p.name, online: p.online, gem: p.gem||0,
        chat_title: md.ct||'', chat_nametag: md.cn||'',
        title_ig: md.it||'', nametag_ig: md.in||'',
        trails: (p.trails||[]).length, killfx: (p.killfx||[]).filter(function(x){return x!=='Games:coins'&&x!=='none';}).length };
    });
    var blob = new Blob([JSON.stringify(out, null, 2)], {type:'application/json'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mimi_export_' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function _bulkExportCsv(names) {
    if (!_cache || !names.length) return;
    var rows = _cache.filter(function(p){ return names.indexOf(p.name) > -1; });
    var hdr = 'Name,Online,Gem,Chat Title,Chat Nametag,Title IG,Nametag IG,Trails,Kill FX';
    var lines = rows.map(function(p){
      var md = p.mimi_data || {};
      var q = function(s){ return '"' + String(s).replace(/"/g,'""') + '"'; };
      var killfx = (p.killfx||[]).filter(function(x){return x!=='Games:coins'&&x!=='none';}).length;
      return [q(p.name), p.online?1:0, p.gem||0, q(md.ct||''), q(md.cn||''), q(md.it||''), q(md.in||''), (p.trails||[]).length, killfx].join(',');
    });
    var blob = new Blob([[hdr].concat(lines).join('\n')], {type:'text/csv'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mimi_export_' + new Date().toISOString().slice(0,10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ── Catalog aggregation ── */
  function _buildCatalogHtml(data) {
    // Map: key = val_string, value = { users: Map<playerName, playerObj>, slotsUsed: Set<slotKey> }
    var globalStyles = {}; 
    var slots = ['ct', 'cn', 'it', 'in'];
    
    for (var pi = 0; pi < data.length; pi++) {
      var p = data[pi], md = p.mimi_data || {};
      for (var si = 0; si < slots.length; si++) {
        var sk = slots[si];
        var val = md[sk];
        if (!val) continue;
        
        if (!globalStyles[val]) {
          globalStyles[val] = { users: {}, slotsUsed: {} };
        }
        globalStyles[val].users[p.name] = p; // deduplicate player per style
        globalStyles[val].slotsUsed[sk] = true;
      }
    }

    var vals = Object.keys(globalStyles).sort(function(a,b) {
      return Object.keys(globalStyles[b].users).length - Object.keys(globalStyles[a].users).length; // sort by popularity
    });

    if (!vals.length) return '<div class="empty-state">Belum ada data kustomisasi.</div>';

    var html = '<div style="font-size:11px;color:var(--text-faint);margin-bottom:14px">' +
      '<strong style="color:var(--text)">' + vals.length + '</strong> style unik ditemukan di seluruh slot kustomisasi</div>';

    html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">';

    for (var vi = 0; vi < vals.length; vi++) {
      var val2 = vals[vi];
      var styleData = globalStyles[val2];
      var userList = Object.values(styleData.users);
      var previewHtml = renderGlyph(val2, 28); // Shrink from 40 to 28 so it fits half-width cleanly
      
      // avatar stack (max 3 to fit tighter mobile width)
      var avatarStack = '';
      var maxA = Math.min(3, userList.length);
      for (var ai = 0; ai < maxA; ai++) {
        var pn = userList[ai].name || '?';
        var psafe = pn.replace(/ /g,'_');
        var avU = 'https://crafthead.net/helm/' + encodeURIComponent(psafe) + '/16.png';
        var fbU = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(pn) + '&background=1a1a2e&color=fff&size=16&bold=true';
        avatarStack += '<img src="' + avU + '" onerror="this.onerror=null;this.src=\'' + fbU + '\'" ' +
          'title="' + pn + '" ' +
          'style="width:14px;height:14px;border-radius:4px;border:1px solid var(--surface);margin-left:' + (ai===0?0:-6) + 'px;image-rendering:pixelated;background:#1a1a2e">';
      }
      var moreLabel = userList.length > 3 ? '<span style="font-size:8px;color:var(--text-faint);margin-left:4px">+' + (userList.length-3) + '</span>' : '';
      
      // Determine dominant slot color for card accent
      var borderAccent = '#6366f1'; // default indigo
      if (styleData.slotsUsed['ct']) borderAccent = '#a78bfa';
      else if (styleData.slotsUsed['cn']) borderAccent = '#34d399';
      else if (styleData.slotsUsed['it']) borderAccent = '#818cf8';
      else if (styleData.slotsUsed['in']) borderAccent = '#2dd4bf';

      var encodedVal = encodeURIComponent(val2);
      html += '<div class="mimi-cat-card" data-catval="' + encodedVal + '" ' +
        'style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:8px;cursor:pointer;transition:border-color .15s,box-shadow .15s;overflow:hidden"' +
        ' onmouseover="this.style.borderColor=\'' + borderAccent + '40\';this.style.boxShadow=\'0 4px 14px rgba(0,0,0,.15)\'"' +
        ' onmouseout="this.style.borderColor=\'var(--border)\';this.style.boxShadow=\'none\'">' +
        '<div style="min-height:30px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-wrap:wrap;gap:2px;margin-bottom:8px;background:rgba(0,0,0,.15);border-radius:6px;padding:4px;border:1px solid rgba(255,255,255,.04)">' + previewHtml + '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px">' +
          '<div style="display:flex;align-items:center">' + avatarStack + moreLabel + '</div>' +
          '<span style="font-size:8.5px;font-weight:800;padding:2px 5px;border-radius:99px;background:' + borderAccent + '15;color:' + borderAccent + ';border:1px solid ' + borderAccent + '30;white-space:nowrap">' +
          userList.length + ' p</span>' +
        '</div>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  /* ── Toolbar: event delegation (wired ONCE on init, not per-render) ── */
  var _toolbarBound = false;
  function _bindToolbar() {
    if (_toolbarBound) return;
    _toolbarBound = true;
    var sec = document.getElementById('sec-mimi-inka');
    if (!sec) return;

    sec.addEventListener('click', function(e) {
      // Tab switcher
      if (e.target.id === 'mimi-tab-players') {
        if (_activeTab !== 'players') { _activeTab = 'players'; if (_cache) render(_cache); } return;
      }
      if (e.target.id === 'mimi-tab-catalog') {
        if (_activeTab !== 'catalog') { _activeTab = 'catalog'; if (_cache) render(_cache); } return;
      }
      // Bulk mode toggle
      if (e.target.id === 'mimi-bulk-toggle' || e.target.closest('#mimi-bulk-toggle')) {
        _bulkMode = !_bulkMode; if (!_bulkMode) _selected.clear(); if (_cache) render(_cache); return;
      }
      if (e.target.id === 'mimi-bulk-select-all') {
        if (_cache) _cache.forEach(function(p){ if(p.name) _selected.add(p.name); }); if (_cache) render(_cache); return;
      }
      if (e.target.id === 'mimi-bulk-deselect') {
        _selected.clear(); if (_cache) render(_cache); return;
      }
      if (e.target.id === 'mimi-bulk-export-json') {
        _bulkExportJson(Array.from(_selected)); return;
      }
      if (e.target.id === 'mimi-bulk-export-csv') {
        _bulkExportCsv(Array.from(_selected)); return;
      }
      // Glyph Library
      if (e.target.id === 'mimi-glyph-btn' || e.target.closest('#mimi-glyph-btn')) {
        var gsNav = document.getElementById('nav-glyph-sheets');
        if (gsNav && typeof window.showSection === 'function') window.showSection('glyph-sheets', gsNav);
        return;
      }
      // Refresh button
      if (e.target.id === 'mimi-refresh' || e.target.closest('#mimi-refresh')) {
        _cache = null; _load(false); return;
      }
      // Checkbox (bulk select)
      var chk = e.target.closest('.mimi-chk');
      if (chk) {
        e.stopPropagation();
        var n = chk.getAttribute('data-chkplayer');
        if (n) { if (_selected.has(n)) _selected.delete(n); else _selected.add(n); if (_cache) render(_cache); }
        return;
      }
      // Catalog card
      var catCard = e.target.closest('.mimi-cat-card');
      if (catCard) {
        _showCatalogDetail(decodeURIComponent(catCard.getAttribute('data-catval'))); return;
      }
      // Player card
      var card = e.target.closest('.mimi-card');
      if (card) {
        var nm = card.getAttribute('data-player');
        if (_cache) { var pl = _cache.find(function(x){return x.name===nm;}); if (pl) _showModal(pl); }
        return;
      }
    });

    sec.addEventListener('change', function(e) {
      if (e.target.id === 'mimi-sort')   { _sortBy = e.target.value; if (_cache) render(_cache); }
      if (e.target.id === 'mimi-filter') { _filterType = e.target.value; if (_cache) render(_cache); }
      if (e.target.id === 'mimi-search') { _searchQ = e.target.value; if (_cache) render(_cache); }
    });
    sec.addEventListener('input', function(e) {
      if (e.target.id === 'mimi-search') { _searchQ = e.target.value; if (_cache) render(_cache); }
    });
  }

  /* ── Asset chip helper ── */
  function _assetChip(iconPath, color, label, val) {
    return '<div style="display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:7px;background:' + color + '10;border:1px solid ' + color + '20">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2">' + iconPath + '</svg>' +
      '<span style="font-size:10px;color:var(--text-faint);font-weight:600">' + label + '</span>' +
      '<strong style="font-size:11px;color:var(--text);font-weight:700">' + val + '</strong>' +
      '</div>';
  }

  /* ── Player Detail Modal (blueprint layout) ── */
  function _showModal(p) {
    _closeModal();
    var md = p.mimi_data || {};
    var esc = typeof escHtml === 'function' ? escHtml : function(s){return s;};
    var pName = p.name || '?';
    var safeName = pName.replace(/ /g, '_');
    var avUrl = 'https://crafthead.net/helm/' + encodeURIComponent(safeName) + '/48.png';
    var fbUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(pName) + '&background=1a1a2e&color=fff&size=48&bold=true';



    /* ─── Previews ─── */
    var anyVal = md.ct || md.cn || md.it || md.in;
    var previewHtml = '<div style="margin-top:16px;background:rgba(0,0,0,.25);border-radius:12px;border:1px solid rgba(255,255,255,.04);overflow:hidden">' +
      '<div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:var(--text-muted);padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.03);background:rgba(0,0,0,.15)">Pratinjau Kustomisasi</div>' +
      '<div style="padding:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px">';
    var previewSlots = [{k:'ct',label:'Chat Title',color:'#a78bfa'},{k:'cn',label:'Chat Nametag',color:'#34d399'},{k:'it',label:'Title IG',color:'#818cf8'},{k:'in',label:'Nametag IG',color:'#2dd4bf'}];
    var hasAny = false;
    for (var pi = 0; pi < previewSlots.length; pi++) {
      var ps = previewSlots[pi];
      if (!md[ps.k]) continue;
      hasAny = true;
      previewHtml += '<div style="min-width:0">' +
        '<div style="font-size:8.5px;font-weight:800;color:' + ps.color + ';text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;opacity:0.9">' + ps.label + '</div>' +
        '<div style="background:linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.2));border-radius:8px;padding:10px 12px;min-height:42px;display:flex;align-items:center;flex-wrap:wrap;gap:3px;border:1px solid rgba(255,255,255,.05);box-shadow:inset 0 2px 4px rgba(0,0,0,0.2)">' + renderGlyph(md[ps.k], 36) + '</div>' +
        '</div>';
    }
    if (!hasAny) previewHtml += '<div style="grid-column:span 2"><span style="font-size:11.5px;color:var(--text-faint);font-style:italic">Tidak ada kustomisasi terpasang.</span></div>';
    previewHtml += '</div></div>';

    /* ─── Cross-link to Recovery Data ─── */
    var assetsHtml = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;padding:10px 14px;background:rgba(56,189,248,.04);border:1px solid rgba(56,189,248,.12);border-radius:10px">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<div style="width:32px;height:32px;border-radius:8px;background:rgba(56,189,248,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>' +
        '</div>' +
        '<div>' +
          '<div style="font-size:10.5px;font-weight:800;color:var(--text-main)">Gem, Trail & Kill Effect</div>' +
          '<div style="font-size:9.5px;color:var(--text-faint);margin-top:1px">Aset ekonomi tersedia di panel Recovery Data</div>' +
        '</div>' +
      '</div>' +
      '<button id="mimi-goto-recovery" data-player="' + esc(pName) + '" style="font-size:10px;font-weight:800;padding:6px 12px;border-radius:7px;background:rgba(56,189,248,.1);color:#38bdf8;border:1px solid rgba(56,189,248,.25);cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:5px;transition:all 0.15s">' +
        '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>' +
        'Recovery Data' +
      '</button>' +
    '</div>';

    /* ─── Export row ─── */
    var exportStr = JSON.stringify({ name: p.name, mimi_data: md });
    var exportHtml = '<div style="display:flex;align-items:center;gap:12px;margin-top:12px;padding:10px 14px;background:rgba(96,165,250,.04);border:1px dashed rgba(96,165,250,.2);border-radius:10px">' +
      '<div style="flex:1">' +
        '<div style="font-size:10px;font-weight:800;color:var(--text-main);text-transform:uppercase;letter-spacing:0.5px">Ekspor Backup Kustomisasi</div>' +
        '<div style="font-size:9.5px;color:var(--text-faint);margin-top:2px">JSON berisi data Title & Nametag player ini</div>' +
      '</div>' +
      '<button id="mimi-modal-copy" style="background:var(--surface);color:var(--text-main);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:6px 14px;font-size:10.5px;font-weight:700;cursor:pointer;flex-shrink:0;transition:all 0.15s" onmouseover="this.style.background=\'rgba(255,255,255,0.05)\'" onmouseout="this.style.background=\'var(--surface)\'">Salin JSON</button>' +
      '</div>';

    /* ─── Action buttons ─── */
    var btnBase = 'font-size:11px;font-weight:700;padding:8px 14px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .2s cubic-bezier(0.4, 0, 0.2, 1);border:1px solid transparent;background:var(--surface)';
    var revokeIco = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
    var assignIco = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    
    var hasTitle = !!(md.ct || md.it), hasNametag = !!(md.cn || md.in);
    var actionsHtml = '<div style="margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.05)">' +
      '<div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--text-faint);margin-bottom:10px">Manajemen Kustomisasi</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
      (hasTitle
        ? '<button class="mimi-revoke-btn" data-revoke-player="' + esc(pName) + '" data-revoke-slot="ct" style="' + btnBase + ';background:rgba(248,113,113,.1);color:#f87171;border:1px solid rgba(248,113,113,.2)">' + revokeIco + 'Revoke Chat Title</button>' +
          '<button class="mimi-revoke-btn" data-revoke-player="' + esc(pName) + '" data-revoke-slot="it" style="' + btnBase + ';background:rgba(248,113,113,.1);color:#f87171;border:1px solid rgba(248,113,113,.2)">' + revokeIco + 'Revoke Title IG</button>'
        : '') +
      (hasNametag
        ? '<button class="mimi-revoke-btn" data-revoke-player="' + esc(pName) + '" data-revoke-slot="cn" style="' + btnBase + ';background:rgba(248,113,113,.1);color:#f87171;border:1px solid rgba(248,113,113,.2)">' + revokeIco + 'Revoke Chat Nametag</button>' +
          '<button class="mimi-revoke-btn" data-revoke-player="' + esc(pName) + '" data-revoke-slot="in" style="' + btnBase + ';background:rgba(248,113,113,.1);color:#f87171;border:1px solid rgba(248,113,113,.2)">' + revokeIco + 'Revoke Nametag IG</button>'
        : '') +
      (!hasTitle && !hasNametag ? '<span style="font-size:11.5px;color:var(--text-faint);font-style:italic">Tidak ada kustomisasi aktif untuk di-revoke.</span>' : '') +
      '</div></div>';

    /* ─── Assemble modal ─── */
    var ov = document.createElement('div');
    ov.id = 'mimi-modal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(10px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;animation:oeditIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    ov.innerHTML =
      '<div id="mimi-modal-panel" style="background:var(--surface);border:1px solid rgba(255,255,255,0.08);border-radius:20px;max-width:640px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 32px 80px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,0.05);overflow:hidden">' +
        /* Header */
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:18px 20px;border-bottom:1px solid rgba(255,255,255,0.05);flex-shrink:0;background:rgba(255,255,255,0.01)">' +
          '<div style="display:flex;align-items:center;gap:14px">' +
            '<div style="position:relative">' +
              '<img src="' + avUrl + '" onerror="this.onerror=null;this.src=\'' + fbUrl + '\'" style="width:46px;height:46px;border-radius:12px;background:#1a1a2e;image-rendering:pixelated;box-shadow:0 2px 8px rgba(0,0,0,0.3)">' +
              '<div style="position:absolute;bottom:-2px;right:-2px;width:12px;height:12px;border-radius:50%;border:2px solid var(--surface);background:' + (p.online?'#34d399':'#64748b') + ';box-shadow:0 0 0 1px rgba(0,0,0,0.2)"></div>' +
            '</div>' +
            '<div>' +
              '<div style="font-size:18px;font-weight:800;color:var(--text-main);letter-spacing:0.2px">' + esc(pName) + '</div>' +
              '<div style="font-size:10px;font-weight:800;color:' + (p.online?'#34d399':'#64748b') + ';margin-top:2px;text-transform:uppercase;letter-spacing:1px">' + (p.online?'Sedang Online':'Offline') + '</div>' +
            '</div>' +
          '</div>' +
          '<button id="mimi-modal-x" style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;color:var(--text-faint);width:34px;height:34px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s" onmouseover="this.style.background=\'rgba(255,255,255,0.1)\';this.style.color=\'var(--text-main)\'" onmouseout="this.style.background=\'rgba(255,255,255,.04)\';this.style.color=\'var(--text-faint)\'">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>' +
        '</div>' +
        /* Body (scrollable) */
        '<div style="padding:14px 16px 16px;overflow-y:auto;flex:1">' +
          /* Preview */
          /* Preview */
          previewHtml +
          /* Assets */
          assetsHtml +
          /* Export */
          exportHtml +
          /* Actions */
          actionsHtml +
        '</div>' +
      '</div>';

    document.body.appendChild(ov);
    document.getElementById('mimi-modal-x').addEventListener('click', _closeModal);
    ov.addEventListener('click', function(e){ if(e.target===ov) _closeModal(); });

    var copyBtn = document.getElementById('mimi-modal-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', function() {
        navigator.clipboard.writeText(exportStr).then(function() {
          copyBtn.textContent = 'Tersalin!'; copyBtn.style.background = '#4ade80';
          setTimeout(function(){ copyBtn.textContent = 'Salin'; copyBtn.style.background = '#60a5fa'; }, 2000);
        }).catch(function(err){ showAdminToast('Gagal: ' + err, 'error'); });
      });
    }

    /* Bind cross-link → Recovery Data */
    var gotoRecovery = document.getElementById('mimi-goto-recovery');
    if (gotoRecovery) {
      gotoRecovery.addEventListener('click', function() {
        var targetPlayer = this.getAttribute('data-player');
        _closeModal();
        /* Navigate to Recovery Data section */
        var recoveryNav = document.getElementById('nav-recovery');
        if (recoveryNav && typeof window.showSection === 'function') {
          window.showSection('recovery', recoveryNav);
          /* Pre-fill the search box after a short delay so Recovery renders first */
          setTimeout(function() {
            var rcvSearch = document.getElementById('rcv-search');
            if (rcvSearch && targetPlayer) {
              rcvSearch.value = targetPlayer;
              rcvSearch.dispatchEvent(new Event('input'));
            }
          }, 400);
        } else {
          showAdminToast('Panel Recovery Data belum dimuat', 'warn');
        }
      });
    }

    /* Bind revoke buttons */
    ov.querySelectorAll('.mimi-revoke-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var pn2 = this.getAttribute('data-revoke-player');
        var sk2 = this.getAttribute('data-revoke-slot');
        var action2 = (sk2 === 'ct' || sk2 === 'it') ? 'revoke_title' : 'revoke_nametag';
        _pushCommand(pn2, action2, sk2, null, this);
      });
    });
  }
  function _closeModal() { var m = document.getElementById('mimi-modal'); if (m) m.remove(); }


  /* ── Command Queue: push admin command to Supabase mimi_commands ── */
  async function _pushCommand(playerName, action, slot, value, btnEl) {
    var sb = window._adminSb;
    if (!sb) { showAdminToast('Supabase belum siap', 'error'); return; }
    /* Disable button to prevent double-click */
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = '...'; }
    try {
      var res = await sb.from('mimi_commands').insert({
        player_name: playerName,
        action: action,
        slot: slot,
        value: value || null,
        status: 'pending'
      });
      if (res.error) throw res.error;
      showAdminToast('Perintah dikirim ke server (maks 30 detik)', 'success');
      _closeModal();
    } catch (err) {
      showAdminToast('Gagal: ' + (err.message || JSON.stringify(err)), 'error');
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Revoke'; }
    }
  }

  /* ── Catalog Detail Modal ── */
  function _showCatalogDetail(val) {
    _closeModal();
    if (!_cache) return;
    
    var users = _cache.filter(function(p) { 
      var md = p.mimi_data || {};
      return md.ct === val || md.cn === val || md.it === val || md.in === val;
    });
    
    // Determine which slots use this style across all users to pick a dominant color and label
    var slotsUsed = { ct: false, cn: false, it: false, in: false };
    for (var i = 0; i < users.length; i++) {
      var md = users[i].mimi_data || {};
      if (md.ct === val) slotsUsed.ct = true;
      if (md.cn === val) slotsUsed.cn = true;
      if (md.it === val) slotsUsed.it = true;
      if (md.in === val) slotsUsed.in = true;
    }
    
    var color = '#6366f1';
    var labelParts = [];
    if (slotsUsed.ct) { color = '#a78bfa'; labelParts.push('Chat Title'); }
    if (slotsUsed.cn) { color = '#34d399'; labelParts.push('Chat Nametag'); }
    if (slotsUsed.it) { color = '#818cf8'; labelParts.push('Title IG'); }
    if (slotsUsed.in) { color = '#2dd4bf'; labelParts.push('Nametag IG'); }
    var label = labelParts.join(' / ');

    var esc = typeof escHtml === 'function' ? escHtml : function(s){return s;};

    /* Build user rows HTML */
    var usersHtml = '';
    for (var i = 0; i < users.length; i++) {
      var p = users[i];
      var pn = p.name || '?';
      var psafe = pn.replace(/ /g,'_');
      var avU = 'https://crafthead.net/helm/' + encodeURIComponent(psafe) + '/24.png';
      var fbU = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(pn) + '&background=1a1a2e&color=fff&size=24&bold=true';
      var dotColor = p.online ? '#4ade80' : '#64748b';
      
      // Determine what slots THIS specific user uses the style in
      var userSlots = [];
      var umd = p.mimi_data || {};
      if (umd.ct === val) userSlots.push('<span style="font-size:8.5px;padding:2px 5px;border-radius:4px;background:rgba(167,139,250,0.15);color:#a78bfa;font-weight:700">Chat Title</span>');
      if (umd.cn === val) userSlots.push('<span style="font-size:8.5px;padding:2px 5px;border-radius:4px;background:rgba(52,211,153,0.15);color:#34d399;font-weight:700">Chat Nametag</span>');
      if (umd.it === val) userSlots.push('<span style="font-size:8.5px;padding:2px 5px;border-radius:4px;background:rgba(129,140,248,0.15);color:#818cf8;font-weight:700">Title IG</span>');
      if (umd.in === val) userSlots.push('<span style="font-size:8.5px;padding:2px 5px;border-radius:4px;background:rgba(45,212,191,0.15);color:#2dd4bf;font-weight:700">Nametag IG</span>');
      
      usersHtml +=
        '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">' +
          '<div style="position:relative;flex-shrink:0">' +
            '<img src="' + avU + '" onerror="this.onerror=null;this.src=\'' + fbU + '\'" style="width:24px;height:24px;border-radius:5px;background:#1a1a2e;image-rendering:pixelated">' +
            '<div style="position:absolute;bottom:-1px;right:-1px;width:7px;height:7px;border-radius:50%;border:1.5px solid var(--surface);background:' + dotColor + '"></div>' +
          '</div>' +
          '<span style="font-size:12px;font-weight:600;color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(pn) + '</span>' +
          '<div style="display:flex;gap:4px">' + userSlots.join('') + '</div>' +
          '<span style="font-size:9px;color:' + dotColor + ';font-weight:700">' + (p.online?'Online':'Offline') + '</span>' +
        '</div>';
    }

    /* Build modal */
    var ov = document.createElement('div');
    ov.id = 'mimi-modal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center';

    var panel = document.createElement('div');
    panel.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:420px;width:94%;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,.5)';

    /* Header */
    var hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--border)';
    hdr.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px">' +
        '<span style="width:3px;height:16px;border-radius:2px;background:' + color + ';display:inline-block"></span>' +
        '<div>' +
          '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:var(--text-faint);font-weight:700">' + label + '</div>' +
          '<div style="font-size:12px;font-weight:700;color:var(--text)">' + users.length + ' player menggunakan style ini</div>' +
        '</div>' +
      '</div>' +
      '<button id="mimi-modal-x" style="background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:6px;color:var(--text-faint);width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>' +
      '</button>';

    /* Preview */
    var prev = document.createElement('div');
    prev.style.cssText = 'padding:14px 16px;border-bottom:1px solid var(--border);background:rgba(0,0,0,.12)';
    prev.innerHTML =
      '<div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.6px;color:var(--text-faint);font-weight:700;margin-bottom:8px">Preview</div>' +
      '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:2px;min-height:52px;background:rgba(0,0,0,.2);border-radius:8px;padding:8px 12px;border:1px solid rgba(255,255,255,.04)">' +
      renderGlyph(val, 48) + '</div>';

    /* User list */
    var lst = document.createElement('div');
    lst.style.cssText = 'padding:4px 16px 12px;overflow-y:auto;flex:1';
    lst.innerHTML =
      '<div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.6px;color:var(--text-faint);font-weight:700;padding:10px 0 4px">Digunakan oleh</div>' +
      usersHtml;

    panel.appendChild(hdr);
    panel.appendChild(prev);
    panel.appendChild(lst);
    ov.appendChild(panel);
    document.body.appendChild(ov);

    document.getElementById('mimi-modal-x').addEventListener('click', _closeModal);
    ov.addEventListener('click', function(e){ if(e.target===ov) _closeModal(); });
  }

  function _onCardClick(e) {
    var card = e.target.closest('.mimi-card');
    if (!card || !_cache) return;
    var name = card.getAttribute('data-player');
    if (!name) return;
    var p = _cache.find(function(x){ return x.name === name; });
    if (p) _showModal(p);
  }

  /* ── Skeleton Loader ── */
  function _getSkeletonHtml() {
    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr));gap:8px">';
    for (var i = 0; i < 8; i++) {
      html += '<div style="background:var(--surface2);border:1px solid rgba(255,255,255,0.03);border-radius:12px;padding:12px;height:100px;position:relative;overflow:hidden">' +
        '<div style="position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.03),transparent);animation:mimiShimmer 1.5s infinite"></div>' +
        '<div style="display:flex;gap:10px;align-items:center"><div style="width:28px;height:28px;border-radius:6px;background:rgba(255,255,255,0.05)"></div>' +
        '<div style="flex:1"><div style="height:12px;width:60%;background:rgba(255,255,255,0.05);border-radius:4px;margin-bottom:4px"></div></div></div>' +
        '<div style="margin-top:12px;display:flex;gap:6px">' +
        '<div style="height:40px;width:100%;background:rgba(255,255,255,0.03);border-radius:8px"></div>' +
        '<div style="height:40px;width:100%;background:rgba(255,255,255,0.03);border-radius:8px"></div>' +
        '</div></div>';
    }
    return html + '</div><style>@keyframes mimiShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}</style>';
  }

  /* ── Load data dari Supabase (READ-ONLY) ── */
  async function _load(silent) {
    var body = document.getElementById('mimi-body');
    if (!body) return;

    var btn = document.getElementById('mimi-refresh');
    if (btn) { btn.disabled = true; if (!silent) btn.textContent = 'Syncing...'; }

    /* Cache hit (manual refresh lewat Refresh button selalu bypass karena _cache di-null sebelumnya) */
    if (!silent && _cache && (Date.now() - _cacheTs) < CACHE_TTL) {
      render(_cache);
      if (btn) { btn.disabled = false; btn.textContent = 'Refresh'; }
      return;
    }

    if (!silent) {
      body.innerHTML = _getSkeletonHtml();
    }

    try {
      var sb = window._adminSb;
      if (!sb) throw new Error('Supabase belum siap — coba refresh halaman');

      // SELECT ONLY — tidak ada INSERT/UPDATE/DELETE
      var resp = await sb
        .from('leaderboard_sync')
        .select('gacha_lb')
        .eq('id', 'current')
        .single();

      if (resp.error) throw resp.error;

      var lb = resp.data && resp.data.gacha_lb;
      if (!lb) {
        if (!silent) body.innerHTML = '<div class="empty-state">Belum ada data sync. Server perlu online minimal 1x setelah update behavior pack.</div>';
        if (btn) { btn.disabled = false; btn.textContent = 'Refresh'; }
        return;
      }

      lb = (typeof lb === 'string') ? JSON.parse(lb) : lb;

      /* Seamless auto-refresh: skip re-render jika data tidak berubah */
      var newTs = lb._backup_ts || 0;
      if (silent && _cache && newTs > 0 && newTs <= _lastSyncTs) {
        _cacheTs = Date.now();
        if (btn) { btn.disabled = false; btn.textContent = 'Refresh'; }
        return;
      }

      _lastSyncTs = newTs;

      var backups = lb.player_backups || [];
      if (!backups.length) {
        if (!silent) body.innerHTML = '<div class="empty-state">Belum ada backup player di server.</div>';
        if (btn) { btn.disabled = false; btn.textContent = 'Refresh'; }
        return;
      }

      /* Fix duplicates: Ensure each player only appears once (keep latest object) */
      var dedupMap = {};
      for (var i = 0; i < backups.length; i++) {
        var p = backups[i];
        if (p && p.name) dedupMap[p.name] = p;
      }
      var dedupedBackups = [];
      for (var k in dedupMap) {
        dedupedBackups.push(dedupMap[k]);
      }

      _cache   = dedupedBackups;
      _cacheTs = Date.now();
      render(_cache);

    } catch (e) {
      console.warn('[Mimi Dashboard] load error:', e);
      if (!silent) {
        var esc = typeof escHtml === 'function' ? escHtml : function(s){ return s; };
        body.innerHTML = '<div class="empty-state" style="color:#f87171">Gagal memuat data: ' + esc(e.message || String(e)) + '</div>';
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Refresh'; }
    }
  }

  /* ── Auto-refresh countdown ── */
  function _startAutoRefresh() {
    _stopAutoRefresh();
    _secsLeft = 60;
    _updateTimerUI();
    _timer = setInterval(function () {
      _secsLeft--;
      if (_secsLeft <= 0) {
        _secsLeft = 60;
        _cacheTs  = 0; // force fetch tapi tetap silent (tidak flicker)
        _load(true);
      }
      _updateTimerUI();
    }, 1000);
  }

  function _stopAutoRefresh() {
    if (_timer) { clearInterval(_timer); _timer = null; }
  }

  function _updateTimerUI() {
    var el   = document.getElementById('mimi-timer-txt');
    var ring = document.getElementById('mimi-timer-ring');
    if (el)   el.textContent = _secsLeft + 's';
    if (ring) ring.style.strokeDashoffset = String(62.8 - (62.8 * (_secsLeft / 60)));
  }

  /* ── Hook showSection (chain-safe) ── */
  function _hookNav() {
    if (!window.showSection || window.showSection._mimiHooked) return;
    var orig = window.showSection;
    var hooked = function (name, el) {
      orig(name, el); // chain ke versi sebelumnya (recovery, nav, dll)
      if (name === 'mimi-inka') {
        _startAutoRefresh();
        _load(false);
      } else {
        _stopAutoRefresh();
      }
    };
    // Salin semua flag hook yang mungkin sudah ada agar tidak break modul lain
    hooked._mimiHooked    = true;
    hooked._recoveryHooked = orig._recoveryHooked || false;
    window.showSection = hooked;
  }

  /* ── Init ── */
  function _init() {
    _hookNav();

    /* Card click → modal */
    document.addEventListener('click', _onCardClick);

    /* Search — delegasi ke document agar tetap bekerja setelah re-render */
    document.addEventListener('input', function (e) {
      if (e.target.id !== 'mimi-search') return;
      _searchQ = e.target.value.trim().toLowerCase();
      if (_cache) render(_cache);
    });

    /* Refresh button */
    document.addEventListener('click', function (e) {
      if (e.target.id !== 'mimi-refresh') return;
      _cache    = null;
      _cacheTs  = 0;
      _secsLeft = 60;
      _updateTimerUI();
      _load(false);
    });
  }

  /* Jalankan setelah semua defer scripts selesai */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(_init, 150); });
  } else {
    setTimeout(_init, 150);
  }

  /* Expose untuk debugging & external calls */
  window.mimiInkaLoad = _load;

})();
