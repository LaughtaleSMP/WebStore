// admin-mimi-inka.js — Dashboard Mimi Inka
// Menampilkan semua player & customisasi title/nametag mereka.
// Data source: leaderboard_sync.gacha_lb.player_backups[].mimi_data
// Glyph rendering: assets/glyph_E7.png (2304x2304, 16-col, 144px/tile)
// STATUS: READ-ONLY — tidak pernah menulis ke Supabase atau Dynamic Properties.

(function () {
  'use strict';

  /* ── Constants ── */
  var GLYPH_TILE    = 144;
  var GLYPH_COLS    = 16;
  var GLYPH_DISPLAY = 22;
  var GLYPH_BG_SIZE = Math.round(2304 * (GLYPH_DISPLAY / GLYPH_TILE));
  var GLYPH_LS_KEY  = 'mimi_glyph_src';
  var CACHE_TTL     = 120_000; // 2 menit

  /* ── State ── */
  var _cache      = null;
  var _cacheTs    = 0;
  var _lastSyncTs = 0;
  var _glyphSrc   = localStorage.getItem(GLYPH_LS_KEY) || 'assets/glyph_E7.png';
  var _searchQ    = '';
  var _sortBy     = 'name';
  var _filterType = 'all';
  var _timer      = null;
  var _secsLeft   = 60;

  /* ── Glyph Renderer ── */
  function renderGlyph(text) {
    if (!text || typeof text !== 'string') return '';
    // Strip Minecraft color codes (§x)
    var clean = text.replace(/\u00a7[0-9a-fk-or]/gi, '');
    var out = '';
    for (var i = 0; i < clean.length; i++) {
      var cp = clean.codePointAt(i);
      if (cp >= 0xE700 && cp <= 0xE7FF) {
        var idx = cp - 0xE700;
        var col = idx % GLYPH_COLS;
        var row = Math.floor(idx / GLYPH_COLS);
        var bx  = -(col * GLYPH_DISPLAY);
        var by  = -(row * GLYPH_DISPLAY);
        // Security: hanya gunakan data: URL jika benar-benar data URL, else fallback path
        var src = (_glyphSrc && _glyphSrc.indexOf('data:image/') === 0)
          ? _glyphSrc : 'assets/glyph_E7.png';
        out += '<span style="display:inline-block;width:' + GLYPH_DISPLAY + 'px;height:' + GLYPH_DISPLAY + 'px;' +
          'background:url(' + src + ') ' + bx + 'px ' + by + 'px;' +
          'background-size:' + GLYPH_BG_SIZE + 'px ' + GLYPH_BG_SIZE + 'px;' +
          'image-rendering:pixelated;vertical-align:middle" title="U+' + cp.toString(16).toUpperCase() + '"></span>';
        if (cp > 0xFFFF) i++; // surrogate pair
      } else {
        // escHtml tersedia global dari admin-init.js / supabase-config.js
        out += '<span style="font-size:12px;color:var(--text);vertical-align:middle">' +
          (typeof escHtml === 'function' ? escHtml(clean[i]) : clean[i]) + '</span>';
      }
    }
    return out;
  }

  /* ── Pill (label + glyph value) ── */
  function pillHtml(label, value, color) {
    return '<div style="display:inline-flex;flex-direction:column;gap:3px;padding:5px 8px;' +
      'border-radius:8px;background:' + color + '18;border:1px solid ' + color + '28;min-width:0">' +
      '<span style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:' + color + ';opacity:.7">' + label + '</span>' +
      '<span style="display:flex;align-items:center;gap:3px;flex-wrap:wrap">' + renderGlyph(value) + '</span>' +
      '</div>';
  }

  /* ── KPI card ── */
  function kpiCard(label, val, bg, color, iconPath) {
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;' +
      'padding:12px 14px;display:flex;align-items:center;gap:10px">' +
      '<div style="width:36px;height:36px;border-radius:9px;background:' + bg + ';display:flex;' +
      'align-items:center;justify-content:center;color:' + color + ';flex-shrink:0">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<path d="' + iconPath + '"/></svg></div>' +
      '<div><div style="font-size:9.5px;color:var(--text-faint);font-weight:700;text-transform:uppercase;letter-spacing:.5px">' + label + '</div>' +
      '<div style="font-size:17px;font-weight:800;color:var(--text);margin-top:1px">' + val + '</div></div>' +
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
    var avatarUrl   = 'https://crafthead.net/helm/' + encodeURIComponent(safeName) + '/36.png';
    var fallbackUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(pName) +
      '&background=1a1a2e&color=fff&size=36&bold=true';

    /* Status badges */
    var statusHtml = '';
    if (hasTitle)   statusHtml += '<span style="font-size:9px;padding:2px 7px;border-radius:99px;background:rgba(167,139,250,.12);color:#a78bfa;border:1px solid rgba(167,139,250,.25);font-weight:700">Title</span>';
    if (hasNametag) statusHtml += '<span style="font-size:9px;padding:2px 7px;border-radius:99px;background:rgba(52,211,153,.12);color:#34d399;border:1px solid rgba(52,211,153,.25);font-weight:700">Nametag</span>';
    if (!hasTitle && !hasNametag) statusHtml = '<span style="font-size:9px;padding:2px 7px;border-radius:99px;background:rgba(255,255,255,.06);color:var(--text-faint);font-weight:600">Tidak ada</span>';

    /* Customization pills */
    var pillsHtml = '';
    if (md.ct) pillsHtml += pillHtml('Chat Title',   md.ct, '#a78bfa');
    if (md.cn) pillsHtml += pillHtml('Chat Nametag', md.cn, '#34d399');
    if (md.it) pillsHtml += pillHtml('Title IG',     md.it, '#818cf8');
    if (md.in) pillsHtml += pillHtml('Nametag IG',   md.in, '#2dd4bf');
    if (!pillsHtml) {
      pillsHtml = '<span style="font-size:11px;color:var(--text-faint);font-style:italic">Belum ada kustomisasi Mimi Inka</span>';
    }

    var esc = typeof escHtml === 'function' ? escHtml : function(s){ return s; };
    return '<div class="mimi-card" style="background:var(--surface2);border:1px solid var(--border);' +
      'border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:10px;' +
      'transition:border-color .15s,box-shadow .15s"' +
      ' onmouseover="this.style.borderColor=\'rgba(74,143,255,.35)\';this.style.boxShadow=\'0 4px 20px rgba(0,0,0,.15)\'"' +
      ' onmouseout="this.style.borderColor=\'var(--border)\';this.style.boxShadow=\'none\'">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<div style="position:relative;flex-shrink:0">' +
          '<img src="' + avatarUrl + '" onerror="this.onerror=null;this.src=\'' + fallbackUrl + '\'"' +
          ' style="width:36px;height:36px;border-radius:8px;background:#1a1a2e;object-fit:cover;image-rendering:pixelated">' +
          '<div style="position:absolute;bottom:-2px;right:-2px;width:10px;height:10px;' +
          'border-radius:50%;border:2px solid var(--surface2);background:' + (p.online ? '#4ade80' : '#64748b') + '"></div>' +
        '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:700;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(pName) + '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">' + statusHtml + '</div>' +
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
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:18px">' +
      kpiCard('Total Player',  totalPlayers, 'rgba(56,189,248,.1)',  '#38bdf8', 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0') +
      kpiCard('Punya Title',   withTitle,    'rgba(167,139,250,.1)', '#a78bfa', 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3l-4 4z') +
      kpiCard('Punya Nametag', withNametag,  'rgba(52,211,153,.1)',  '#34d399', 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z') +
      kpiCard('Title+Nametag', withBoth,     'rgba(251,191,36,.1)',  '#fbbf24', 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z') +
      '</div>';

    /* Toolbar */
    var glyphClearBtn = (_glyphSrc !== 'assets/glyph_E7.png')
      ? '<button id="mimi-glyph-clear" title="Reset glyph" style="font-size:10px;padding:3px 8px;border-radius:6px;background:rgba(248,113,113,.1);color:#f87171;border:1px solid rgba(248,113,113,.25);cursor:pointer;font-weight:600">×</button>'
      : '';

    html += '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:16px;padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-radius:10px">' +
      '<span style="font-size:10.5px;color:var(--text-faint);font-weight:600">Sort:</span>' +
      '<select id="mimi-sort" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:4px 8px;font-size:11px;outline:none;font-family:inherit;cursor:pointer">' +
      '<option value="name"'       + (_sortBy==='name'?       ' selected':'') + '>A–Z Nama</option>' +
      '<option value="has_title"'  + (_sortBy==='has_title'?  ' selected':'') + '>Punya Title</option>' +
      '<option value="has_nametag"'+ (_sortBy==='has_nametag'?' selected':'') + '>Punya Nametag</option>' +
      '</select>' +
      '<span style="font-size:10.5px;color:var(--text-faint);font-weight:600;margin-left:4px">Filter:</span>' +
      '<select id="mimi-filter" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:4px 8px;font-size:11px;outline:none;font-family:inherit;cursor:pointer">' +
      '<option value="all"'     + (_filterType==='all'?     ' selected':'') + '>Semua</option>' +
      '<option value="title"'   + (_filterType==='title'?   ' selected':'') + '>Punya Title</option>' +
      '<option value="nametag"' + (_filterType==='nametag'? ' selected':'') + '>Punya Nametag</option>' +
      '<option value="both"'    + (_filterType==='both'?    ' selected':'') + '>Title & Nametag</option>' +
      '<option value="none"'    + (_filterType==='none'?    ' selected':'') + '>Tidak Ada Keduanya</option>' +
      '</select>' +
      '<div style="margin-left:auto;display:flex;align-items:center;gap:6px;font-size:10.5px;color:var(--text-faint)">' +
        '<div style="width:6px;height:6px;border-radius:50%;background:#34d399;box-shadow:0 0 6px #34d399;animation:pulse 2s infinite"></div>' +
        'Last sync: <strong style="color:var(--text)">' + lastSyncStr + '</strong>' +
      '</div>' +
      '<input type="file" id="mimi-glyph-input" accept=".png" style="display:none">' +
      '<button id="mimi-glyph-btn" style="font-size:10px;padding:4px 10px;border-radius:6px;display:inline-flex;align-items:center;gap:4px;background:rgba(74,143,255,.1);color:#60a5fa;border:1px solid rgba(74,143,255,.25);cursor:pointer;font-weight:600">' +
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
      'Glyph</button>' +
      glyphClearBtn +
      '</div>';

    /* Count info */
    html += '<div style="font-size:11.5px;color:var(--text-faint);margin-bottom:12px">' +
      'Menampilkan <strong style="color:var(--text)">' + list.length + '</strong> dari ' + totalPlayers + ' player</div>';

    /* Grid */
    if (!list.length) {
      html += '<div class="empty-state">Tidak ada player yang cocok dengan filter.</div>';
    } else {
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px">';
      for (var i = 0; i < list.length; i++) {
        html += playerCard(list[i]);
      }
      html += '</div>';
    }

    body.innerHTML = html;
    _bindToolbar();
  }

  /* ── Bind toolbar controls (dipanggil setiap render) ── */
  function _bindToolbar() {
    var sortSel = document.getElementById('mimi-sort');
    if (sortSel) sortSel.addEventListener('change', function () {
      _sortBy = this.value;
      if (_cache) render(_cache);
    });

    var filterSel = document.getElementById('mimi-filter');
    if (filterSel) filterSel.addEventListener('change', function () {
      _filterType = this.value;
      if (_cache) render(_cache);
    });

    var glyphBtn   = document.getElementById('mimi-glyph-btn');
    var glyphInput = document.getElementById('mimi-glyph-input');
    if (glyphBtn && glyphInput) {
      glyphBtn.addEventListener('click', function () { glyphInput.click(); });
      glyphInput.addEventListener('change', function () {
        var file = this.files && this.files[0];
        if (!file || !file.type.startsWith('image/')) return;
        var reader = new FileReader();
        reader.onload = function (e) {
          _glyphSrc = e.target.result;
          localStorage.setItem(GLYPH_LS_KEY, _glyphSrc);
          if (_cache) render(_cache);
        };
        reader.readAsDataURL(file);
        this.value = '';
      });
    }

    var glyphClear = document.getElementById('mimi-glyph-clear');
    if (glyphClear) {
      glyphClear.addEventListener('click', function () {
        _glyphSrc = 'assets/glyph_E7.png';
        localStorage.removeItem(GLYPH_LS_KEY);
        if (_cache) render(_cache);
      });
    }
  }

  /* ── Load data dari Supabase (READ-ONLY) ── */
  async function _load(silent) {
    var body = document.getElementById('mimi-body');
    if (!body) return;

    var btn = document.getElementById('mimi-refresh');
    if (btn) { btn.disabled = true; if (!silent) btn.textContent = 'Memuat...'; }

    /* Cache hit (manual refresh lewat Refresh button selalu bypass karena _cache di-null sebelumnya) */
    if (!silent && _cache && (Date.now() - _cacheTs) < CACHE_TTL) {
      render(_cache);
      if (btn) { btn.disabled = false; btn.textContent = 'Refresh'; }
      return;
    }

    if (!silent) {
      body.innerHTML = '<div class="empty-state" style="display:flex;flex-direction:column;align-items:center;gap:12px">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" style="animation:spin 1s linear infinite">' +
        '<circle cx="12" cy="12" r="10" stroke-dasharray="31.4 31.4"/></svg>' +
        '<span>Mengambil data dari Supabase...</span></div>';
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

      _cache   = backups;
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
