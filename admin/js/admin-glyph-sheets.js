// admin-glyph-sheets.js — Glyph Sheets Manager Page
// Groups players by which Unicode glyph range they use (E7, E8, E9...)
// Allows uploading a separate PNG spritesheet per range.

(function () {
  'use strict';

  var _cache = null, _cacheTs = 0, _CACHE_TTL = 120000;

  /* ── Inject section into main-content ── */
  window.glyphSheetsInjectNav = function () {
    var main = document.querySelector('.main-content');
    if (!main || document.getElementById('sec-glyph-sheets')) return;

    var sec = document.createElement('div');
    sec.className = 'section';
    sec.id = 'sec-glyph-sheets';
    sec.innerHTML =
      '<div class="card">' +
        '<div class="card-header">' +
          '<div class="card-title">Glyph Sheets</div>' +
          '<button class="btn-ghost" id="gs-refresh" style="font-size:11px;padding:5px 10px">Refresh</button>' +
        '</div>' +
        '<div id="gs-body" class="gs-body-wrap">' +
          '<div class="empty-state">Klik Refresh untuk memuat data.</div>' +
        '</div>' +
      '</div>';
    main.appendChild(sec);
  };


  /* ── Hook nav click to trigger load ── */
  function _hookNav() {
    var navEl = document.getElementById('nav-glyph-sheets');
    if (!navEl || navEl._gsHooked) return;
    navEl._gsHooked = true;
    navEl.addEventListener('click', function() {
      // Small delay to let showSection finish rendering
      setTimeout(function() { _load(false); }, 50);
    });
  }

  /* ── Load player data from Supabase ── */
  async function _load(silent) {
    var body = document.getElementById('gs-body');
    var btn  = document.getElementById('gs-refresh');
    if (!body) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Memuat...'; }

    if (!silent && _cache && (Date.now() - _cacheTs) < _CACHE_TTL) {
      _render(_cache); if (btn) { btn.disabled=false; btn.textContent='Refresh'; } return;
    }
    if (!silent) body.innerHTML = '<div class="empty-state">Mengambil data...</div>';

    try {
      var sb = window._adminSb;
      if (!sb) throw new Error('Supabase belum siap');
      var resp = await sb.from('leaderboard_sync').select('gacha_lb').eq('id','current').single();
      if (resp.error) throw resp.error;
      var lb = resp.data && resp.data.gacha_lb;
      if (!lb) { body.innerHTML='<div class="empty-state">Belum ada data sync.</div>'; return; }
      lb = typeof lb==='string' ? JSON.parse(lb) : lb;
      var backups = lb.player_backups || [];

      // Dedup
      var dm = {};
      backups.forEach(function(p){ if (p && p.name) dm[p.name]=p; });
      _cache = Object.values(dm);
      _cacheTs = Date.now();
      _render(_cache);
    } catch(e) {
      body.innerHTML = '<div class="empty-state" style="color:#f87171">Error: '+escHtml(e.message)+'</div>';
    } finally {
      if (btn) { btn.disabled=false; btn.textContent='Refresh'; }
    }
  }

  /* ── Analyse which ranges each player uses ── */
  function _analyseRanges(players) {
    // returns { 'E7': [playerObj,...], 'E8': [playerObj,...], ... }
    var rangeMap = {};
    var gm = window.glyphManager;
    players.forEach(function(p) {
      var md = p.mimi_data || {};
      var allText = [md.ct, md.cn, md.it, md.in].filter(Boolean).join('');
      if (!allText) return;
      var ranges = gm ? gm.detectRanges(allText) : [];
      ranges.forEach(function(r) {
        if (!rangeMap[r]) rangeMap[r] = [];
        // avoid dup
        if (!rangeMap[r].find(function(x){ return x.name===p.name; }))
          rangeMap[r].push(p);
      });
    });
    return rangeMap;
  }

  /* ── Render ── */
  function _render(players) {
    var body = document.getElementById('gs-body');
    if (!body) return;
    var gm = window.glyphManager;
    var rangeMap  = _analyseRanges(players);
    var allRanges = Object.keys(rangeMap).sort();
    var sheets    = gm ? gm.getSheets() : {};
    var stored    = gm ? gm.listCustomRanges() : [];
    stored.forEach(function(r){ if (!rangeMap[r]) allRanges.push(r); });
    allRanges = [...new Set(allRanges)].sort();

    // ── "Tambah Range" bar ALWAYS at top ──────────────────────────
    var html = '<div class="gs-add-bar">' +
      '<div class="gs-add-bar-left">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
        '<span class="gs-add-bar-title">Tambah Range</span>' +
      '</div>' +
      '<div class="gs-add-bar-right">' +
        '<input id="gs-new-range" type="text" maxlength="4" placeholder="E8" class="gs-input-range">' +
        '<input id="gs-new-label" type="text" maxlength="30" placeholder="Nama label (opsional)" class="gs-input-label">' +
        '<input type="file" id="gs-new-file" accept=".png" style="display:none">' +
        '<button id="gs-new-upload" class="gs-add-btn">' +
          '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
          'Upload &amp; Tambah' +
        '</button>' +
      '</div>' +
    '</div>';

    if (!allRanges.length) {
      html += '<div class="empty-state" style="margin-top:12px">Belum ada glyph. Tambah range di atas.</div>';
      body.innerHTML = html;
      _bindEvents(players);
      return;
    }

    // ── Range cards: 2-col grid on desktop, 1-col on mobile ───────
    html += '<div class="gs-range-grid">';

    allRanges.forEach(function(r) {
      var rangePlayers = rangeMap[r] || [];
      var hasSrc    = !!sheets[r];
      var isDefault = r === 'E7' && sheets[r] === 'assets/glyph_E7.png';
      var meta      = gm ? gm.getSheetMeta(r) : null;
      var label     = meta ? meta.label : (isDefault ? 'Default' : 'Belum diunggah');
      var statusCls = hasSrc ? 'pnl-pill-green' : 'pnl-pill-red';
      var statusLabel = hasSrc ? (isDefault ? 'Default' : 'Custom PNG') : 'Belum Ada';

      html += '<div class="gs-card">';

      // Card header — compact horizontal strip
      html +=
        '<div class="gs-card-head">' +
          '<div class="gs-head-left">' +
            '<div class="gs-range-badge">' + r + '</div>' +
            '<div>' +
              '<div class="gs-range-title">U+' + r + '00\u2013' + r + 'FF</div>' +
              '<div class="gs-range-sub">' + label + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="gs-head-right">' +
            '<span class="pnl-pill ' + statusCls + '">' + statusLabel + '</span>' +
            '<input type="file" id="gs-file-' + r + '" accept=".png" style="display:none">' +
            (!isDefault
              ? '<button class="gs-upload-btn" data-range="' + r + '" title="' + (hasSrc ? 'Ganti' : 'Upload') + ' sheet">' +
                  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
                  (hasSrc ? 'Ganti' : 'Upload') +
                '</button>'
              : '') +
            (hasSrc && !isDefault
              ? '<button class="gs-del-btn gs-remove-btn" data-range="' + r + '" title="Hapus">\u00d7</button>'
              : '') +
          '</div>' +
        '</div>';

      // Card body — compact player chip list
      html += '<div class="gs-card-body">';
      if (!rangePlayers.length) {
        html += '<div class="gs-empty-range">Belum ada player.</div>';
      } else {
        html += '<div class="gs-count-label">' + rangePlayers.length + ' Player</div>';
        html += '<div class="gs-player-grid">';
        rangePlayers.forEach(function(p) {
          var md   = p.mimi_data || {};
          var safe = (p.name || '?').replace(/ /g, '_');
          var avUrl = 'https://crafthead.net/helm/' + encodeURIComponent(safe) + '/22.png';
          var fbUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(p.name || '?') + '&background=111820&color=fff&size=22&bold=true';
          var allText = [md.ct, md.cn, md.it, md.in].filter(Boolean).join('');
          var cnt = _extractGlyphsInRange(allText, r);

          html += '<div class="gs-player-chip gs-player-card" data-player="' + escHtml(p.name || '') + '">' +
            '<img src="' + avUrl + '" onerror="this.onerror=null;this.src=\'' + fbUrl + '\'">' +
            '<div>' +
              '<div class="gs-chip-name">' + escHtml(p.name || '?') + '</div>' +
              '<div class="gs-chip-sub">' + cnt + ' char</div>' +
            '</div>' +
          '</div>';
        });
        html += '</div>';
      }
      html += '</div></div>'; // gs-card-body, gs-card
    });

    html += '</div>'; // gs-range-grid
    body.innerHTML = html;
    _bindEvents(players);
  }

  function _extractGlyphsInRange(text, rangeHex) {
    if (!text) return 0;
    var clean = text.replace(/\u00a7[0-9a-fk-or]/gi, '');
    var target = parseInt(rangeHex, 16);
    var count = 0;
    for (var i = 0; i < clean.length; i++) {
      var cp = clean.codePointAt(i);
      if ((cp >> 8) === target) count++;
      if (cp > 0xFFFF) i++;
    }
    return count;
  }

  function _bindEvents(players) {
    var gm = window.glyphManager;

    // Per-range upload buttons
    document.querySelectorAll('.gs-upload-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var r = this.getAttribute('data-range');
        var inp = document.getElementById('gs-file-'+r);
        if (inp) inp.click();
      });
    });
    document.querySelectorAll('[id^="gs-file-"]').forEach(function(inp) {
      inp.addEventListener('change', function() {
        var r = this.id.replace('gs-file-','');
        var file = this.files && this.files[0];
        if (!file) return;
        var reader = new FileReader();
        var self = this;
        reader.onload = function(e) {
          if (gm) gm.setSheet(r, 'glyph_'+r+'.png', e.target.result);
          self.value = '';
          showAdminToast('Sheet '+r+' diperbarui', 'success');
          _render(players);
        };
        reader.readAsDataURL(file);
      });
    });

    // Remove buttons
    document.querySelectorAll('.gs-remove-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var r = this.getAttribute('data-range');
        if (!confirm('Hapus sheet untuk range '+r+'?')) return;
        if (gm) gm.removeSheet(r);
        showAdminToast('Sheet '+r+' dihapus', 'success');
        _render(players);
      });
    });

    // Add new range
    var newUploadBtn = document.getElementById('gs-new-upload');
    var newFileInp   = document.getElementById('gs-new-file');
    if (newUploadBtn && newFileInp) {
      newUploadBtn.addEventListener('click', function() { newFileInp.click(); });
      newFileInp.addEventListener('change', function() {
        var rangeInput = document.getElementById('gs-new-range');
        var labelInput = document.getElementById('gs-new-label');
        var r = (rangeInput ? rangeInput.value.trim().toUpperCase() : '');
        if (!r || r.length < 2) { showAdminToast('Masukkan range (contoh: E8)', 'warn'); return; }
        var lbl = (labelInput ? labelInput.value.trim() : '') || ('glyph_'+r+'.png');
        var file = this.files && this.files[0];
        if (!file) return;
        var reader = new FileReader();
        var self = this;
        reader.onload = function(e) {
          if (gm) gm.setSheet(r, lbl, e.target.result);
          self.value = '';
          if (rangeInput) rangeInput.value = '';
          if (labelInput) labelInput.value = '';
          showAdminToast('Sheet '+r+' ('+lbl+') ditambahkan', 'success');
          _render(players);
        };
        reader.readAsDataURL(file);
      });
    }

    // Player card click → jump to Mimi Inka
    document.querySelectorAll('.gs-player-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var name = this.getAttribute('data-player');
        var mimiNav = document.getElementById('nav-mimi-inka');
        if (mimiNav && typeof window.showSection === 'function') {
          window.showSection('mimi-inka', mimiNav);
          setTimeout(function() {
            var s = document.getElementById('mimi-search');
            if (s) { s.value = name; s.dispatchEvent(new Event('input')); }
          }, 400);
        }
      });
    });

    // Refresh button
    var refreshBtn = document.getElementById('gs-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function() { _cache=null; _load(false); });
    }
  }

  /* ── Init ── */
  function _init() {
    _hookNav();
    glyphSheetsInjectNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(_init, 200); });
  } else {
    setTimeout(_init, 200);
  }

})();
