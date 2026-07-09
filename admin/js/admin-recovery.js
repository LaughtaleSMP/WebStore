// admin-recovery.js — Player Asset Recovery Panel
// Displays gem, particle trails, kill effects per player.
// 1-click recovery via recovery_queue table (polled by behavior pack).

(function () {
  'use strict';

  var _cache = null, _cacheTs = 0, _lastBackupTs = 0;
  var _CACHE_TTL = 120_000;
  var _searchQuery = '';
  var _trailNames = {};
  var _fxNames = {};

  window.recoveryInjectNav = function () {
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar || document.getElementById('nav-recovery')) return;

    var items = sidebar.querySelectorAll('.nav-item');
    var lastItem = items[items.length - 1];
    if (!lastItem) return;

    var navItem = document.createElement('div');
    navItem.className = 'nav-item';
    navItem.id = 'nav-recovery';
    navItem.setAttribute('onclick', "showSection('recovery', this)");
    navItem.innerHTML =
      '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' +
      '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>' +
      '</svg><span>Recovery Data</span>';
    lastItem.parentNode.insertBefore(navItem, lastItem.nextSibling);

    var main = document.querySelector('.main-content');
    if (!main || document.getElementById('sec-recovery')) return;

    var section = document.createElement('div');
    section.className = 'section';
    section.id = 'sec-recovery';
    section.innerHTML =
      '<div class="card">' +
        '<div class="card-header">' +
          '<div class="card-title">Recovery Data Player</div>' +
          '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
            '<input type="text" id="rcv-search" placeholder="Cari player..." ' +
              'aria-label="Cari player" ' +
              'style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);' +
              'color:var(--text);padding:6px 12px;font-size:12px;outline:none;font-family:inherit;width:180px">' +
            '<button class="btn-ghost" id="rcv-refresh" style="font-size:11px;padding:5px 10px" ' +
              'aria-label="Refresh data backup">Refresh</button>' +
            '<div id="rcv-countdown" style="display:none;align-items:center;gap:6px;background:rgba(52,211,153,.08);padding:4px 10px;border-radius:20px;border:1px solid rgba(52,211,153,.2)" title="Auto-refresh dalam 60 detik">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" style="transform:rotate(-90deg)">' +
                '<circle cx="12" cy="12" r="10" stroke="var(--border)" stroke-width="3" fill="none" />' +
                '<circle id="rcv-progress-ring" cx="12" cy="12" r="10" stroke="#34d399" stroke-width="3" fill="none" stroke-dasharray="62.8" stroke-dashoffset="0" style="transition:stroke-dashoffset 1s linear" />' +
              '</svg>' +
              '<span id="rcv-countdown-txt" style="font-size:10px;color:#34d399;font-weight:700;font-variant-numeric:tabular-nums;width:20px;text-align:right">60s</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:11.5px;color:var(--text-faint);padding:0 16px 12px;line-height:1.6">' +
          'Hanya player dengan Gem, Particle Trail, atau Kill Effect yang ditampilkan. ' +
          'Klik <strong>Restore</strong> untuk mengirim data ke server (otomatis di-apply saat player login).' +
        '</div>' +
        '<div id="rcv-body" style="padding:0 16px 16px">' +
          '<div class="empty-state">Klik Refresh untuk memuat data.</div>' +
        '</div>' +
      '</div>';
    main.appendChild(section);
  };

  var _origShow = null;
  function _hookNav() {
    if (!window.showSection || window.showSection._recoveryHooked) return;
    _origShow = window.showSection;
    window.showSection = function (name, el) {
      _origShow(name, el);
      if (name === 'recovery') {
        _startAutoRefresh();
        _loadData();
      } else {
        _stopAutoRefresh();
      }
    };
    window.showSection._recoveryHooked = true;
  }

  var _countdownTimer = null;
  var _secondsLeft = 60;

  function _startAutoRefresh() {
    _stopAutoRefresh();
    _secondsLeft = 60;
    _updateCountdownUi();
    
    _countdownTimer = setInterval(function() {
      _secondsLeft--;
      if (_secondsLeft <= 0) {
         _secondsLeft = 60;
         _cacheTs = 0; // force bypass cache TTL
         _loadData(true); // silent refresh
      }
      _updateCountdownUi();
    }, 1000);
  }

  function _stopAutoRefresh() {
    if (_countdownTimer) clearInterval(_countdownTimer);
  }

  function _updateCountdownUi() {
    var container = document.getElementById('rcv-countdown');
    var ring = document.getElementById('rcv-progress-ring');
    var txt = document.getElementById('rcv-countdown-txt');
    
    if (container) container.style.display = 'flex';
    if (txt) txt.textContent = _secondsLeft + 's';
    if (ring) {
      // 62.8 is the circumference of circle (2 * PI * r) where r=10
      var offset = 62.8 - (62.8 * (_secondsLeft / 60));
      ring.style.strokeDashoffset = offset;
    }
  }

  async function _loadData(silent) {
    var body = document.getElementById('rcv-body');
    if (!body) return;

    var btn = document.getElementById('rcv-refresh');
    if (btn) {
      btn.disabled = true;
      if (!silent) {
        btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite;margin-right:4px;vertical-align:-2px"><circle cx="12" cy="12" r="10" stroke-dasharray="31.4 31.4"/></svg>Memuat...';
      }
    }

    if (!silent && _cache && (Date.now() - _cacheTs) < _CACHE_TTL) {
      _renderCards(_cache);
      if (btn) { btn.disabled = false; btn.innerHTML = 'Refresh'; }
      return;
    }

    if (!silent) {
      body.innerHTML = '<div class="empty-state" style="display:flex;flex-direction:column;align-items:center;gap:12px">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" style="animation:spin 1s linear infinite"><circle cx="12" cy="12" r="10" stroke-dasharray="31.4 31.4"/></svg>' +
        '<span>Sinkronisasi data backup...</span>' +
        '</div>';
    }

    try {
      var sb = window._adminSb;
      if (!sb) throw new Error('Supabase belum siap');

      var resp = await sb
        .from('leaderboard_sync')
        .select('gacha_lb')
        .eq('id', 'current')
        .single();

      if (resp.error) throw resp.error;
      if (!resp.data?.gacha_lb) {
        if (!silent) body.innerHTML = '<div class="empty-state">Belum ada data sync. Server belum pernah online.</div>';
        return;
      }

      var lb = typeof resp.data.gacha_lb === 'string'
        ? JSON.parse(resp.data.gacha_lb)
        : resp.data.gacha_lb;

      var newBackupTs = lb._backup_ts || 0;

      // Seamless Auto-Refresh: Skip re-render if data hasn't changed
      if (silent && _cache && newBackupTs > 0 && newBackupTs <= _lastBackupTs) {
        _cacheTs = Date.now();
        if (btn) { btn.disabled = false; btn.innerHTML = 'Refresh'; }
        return;
      }

      _lastBackupTs = newBackupTs;
      _trailNames = lb._trail_names || {};
      _fxNames = lb._fx_names || {};

      var backups = lb.player_backups || [];

      if (!backups.length) {
        var msg = '';
        if (lb._backup_err) {
          msg = '<div class="empty-state" style="color:#fbbf24">' +
            'Sync berhasil tapi backup gagal.<br>' +
            '<span style="font-size:10px;color:var(--text-faint)">Error: ' + escHtml(lb._backup_err) + '</span>' +
            '</div>';
        } else if (lb._backup_ts) {
          msg = '<div class="empty-state">' +
            'Tidak ada player yang memiliki Gem, Trail, atau KillFX.<br>' +
            '<span style="font-size:10px;color:var(--text-faint)">Last sync: ' +
            new Date(lb._backup_ts).toLocaleString('id-ID') + '</span>' +
            '</div>';
        } else {
          msg = '<div class="empty-state">' +
            'Belum ada backup. Server perlu sync minimal 1x setelah update behavior pack.' +
            '</div>';
        }
        if (!silent) body.innerHTML = msg;
        return;
      }

      _cache = backups;
      _cacheTs = Date.now();
      _renderCards(backups);
    } catch (e) {
      if (!silent) body.innerHTML = '<div class="empty-state" style="color:#f87171">Error: ' + escHtml(e.message) + '</div>';
    } finally {
      var rBtn = document.getElementById('rcv-refresh');
      if (rBtn) { rBtn.disabled = false; rBtn.innerHTML = 'Refresh'; }
    }
  }

  function _trailName(tag) { return _trailNames[tag] || tag; }

  function _fxName(id) {
    if (_fxNames[id]) return _fxNames[id];
    // Try JSON-encoded array key
    try { return _fxNames[JSON.stringify([id])] || id; } catch { return id; }
  }

  var _rarityColors = {
    'basic_': '#9ca3af', 'elite_': '#60a5fa', 'epic_': '#a78bfa', 'legendary_': '#fbbf24', 'adxP': '#fbbf24'
  };

  function _trailColor(tag) {
    for (var prefix in _rarityColors) {
      if (tag.startsWith(prefix) || tag === prefix) return _rarityColors[prefix];
    }
    return '#9ca3af';
  }

  // Recovery Data uses shared glyphManager for glyph spritesheets.
  // Subscribe so re-render triggers automatically when active glyph changes.
  if (window.glyphManager) {
    window.glyphManager.subscribe(function() {
      if (_cache) _renderCards(_cache);
    });
  }

  var GLYPH_TILE = 144, GLYPH_COLS = 16, GLYPH_DISPLAY = 20;
  var GLYPH_BG_SIZE = Math.round(2304 * (GLYPH_DISPLAY / GLYPH_TILE));

  function _renderGlyph(text) {
    if (!text) return '';
    var clean = text.replace(/\u00a7[0-9a-fk-or]/gi, '');
    var gm = window.glyphManager;
    var out = '';
    for (var i = 0; i < clean.length; i++) {
      var cp = clean.codePointAt(i);
      if (cp >= 0xE000 && cp <= 0xEFFF) {
        var rangeHex = (cp >> 8).toString(16).toUpperCase();
        var sheet = gm ? gm.getSheet(rangeHex) : null;
        var src = sheet ? sheet.src : 'assets/glyph_E7.png';
        var bgSize = sheet ? sheet.bgSize : GLYPH_BG_SIZE;
        var idx = cp & 0xFF;
        var col = idx % GLYPH_COLS;
        var row = Math.floor(idx / GLYPH_COLS);
        var bx = -(col * GLYPH_DISPLAY);
        var by = -(row * GLYPH_DISPLAY);
        out += '<span style="display:inline-block;width:' + GLYPH_DISPLAY + 'px;height:' + GLYPH_DISPLAY + 'px;' +
          'background:url(' + src + ') ' + bx + 'px ' + by + 'px;' +
          'background-size:' + bgSize + 'px ' + bgSize + 'px;image-rendering:pixelated;vertical-align:middle' +
          '" title="U+' + cp.toString(16).toUpperCase() + '"></span>';
        if (cp > 0xFFFF) i++;
      } else if (clean[i] === '\\' && clean[i+1] === 'n') {
        out += '<br>'; i++;
      } else {
        out += '<span style="color:#60a5fa;font-size:10px;vertical-align:middle">' + escHtml(clean[i]) + '</span>';
      }
    }
    return out;
  }

  function _renderCards(backups) {
    var body = document.getElementById('rcv-body');
    if (!body) return;

    var q = _searchQuery.toLowerCase();
    var filtered = q
      ? backups.filter(function (b) { return (b.name || '').toLowerCase().indexOf(q) !== -1; })
      : backups;

    if (!filtered.length) {
      body.innerHTML = '<div class="empty-state">Tidak ditemukan: "' + escHtml(_searchQuery) + '"</div>';
      return;
    }

    var totalGems = 0, totalTrails = 0, totalFx = 0;
    for (var i = 0; i < backups.length; i++) {
      totalGems += backups[i].gem || 0;
      totalTrails += (backups[i].trails || []).length;
      totalFx += (backups[i].killfx || []).length;
    }

    // KPI stat cards
    var html = '<div class="pnl-stat-grid">' +
      _kpiCard('Player Data', backups.length, 'rgba(56,189,248,.1)', '#38bdf8',
        'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z') +
      _kpiCard('Total Gem', totalGems.toLocaleString('id-ID'), 'rgba(251,191,36,.1)', '#fbbf24',
        'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z') +
      _kpiCard('Total Trails', totalTrails, 'rgba(52,211,153,.1)', '#34d399',
        'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z') +
      _kpiCard('Kill Effects', totalFx, 'rgba(248,113,113,.1)', '#f87171',
        'M13 10V3L4 14h7v7l9-11h-7z') +
    '</div>';

    // Action bar
    var lastSyncDate = _lastBackupTs
      ? new Date(_lastBackupTs).toLocaleString('id-ID', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})
      : 'Belum sync';

    html += '<div class="rcv-restore-all-wrap">' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
        '<button id="rcv-restore-all" class="rcv-restore-all-btn">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>' +
          'Restore All (' + filtered.length + ')' +
        '</button>' +
        '<span id="rcv-restore-status" class="rcv-restore-status"></span>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
        '<span class="pnl-pill pnl-pill-green">' +
          '<span style="width:5px;height:5px;border-radius:50%;background:currentColor;flex-shrink:0"></span>' +
          'Backup Safe' +
        '</span>' +
        '<span style="font-size:11px;color:var(--text-faint)">Last Sync: <strong style="color:var(--text)">' + lastSyncDate + '</strong></span>' +
        '<button id="rcv-glyph-btn" class="pnl-btn pnl-btn-accent" style="font-size:10.5px;padding:4px 10px">' +
          '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>' +
          'Glyph Library' +
        '</button>' +
      '</div>' +
    '</div>';

    // Table
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;margin-bottom:8px">' +
      '<span style="font-size:11px;color:var(--text-faint)">Player dengan asset tersimpan</span>' +
      '<button id="rcv-expand-all" class="pnl-btn" style="font-size:10px;padding:4px 10px">' +
        '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>' +
        '<span>Expand All</span>' +
      '</button>' +
    '</div>';
    
    html += '<div class="rcv-table-wrap">' +
    '<table class="rcv-tbl"><thead><tr>' +
      '<th class="rcv-tbl-hdr" style="width:160px">Player</th>' +
      '<th class="rcv-tbl-hdr" style="width:90px">Gems</th>' +
      '<th class="rcv-tbl-hdr" style="min-width:200px">Trails</th>' +
      '<th class="rcv-tbl-hdr" style="min-width:200px">Kill FX</th>' +
      '<th class="rcv-tbl-hdr" style="width:120px">Mimi</th>' +
      '<th class="rcv-tbl-hdr" style="text-align:right;width:100px">Action</th>' +
    '</tr></thead><tbody>';

    for (var j = 0; j < filtered.length; j++) {
      html += _playerRow(filtered[j]);
    }
    html += '</tbody></table></div>';

    html += '<div style="font-size:10.5px;color:var(--text-faint);margin-top:12px;text-align:center">' +
      filtered.length + ' / ' + backups.length + ' player</div>';

    body.innerHTML = html;
    _bindButtons(filtered);
  }

  function _kpiCard(label, value, bg, color, iconPath) {
    return '<div class="pnl-stat-card">' +
      '<div class="pnl-stat-icon" style="background:' + bg + ';color:' + color + '">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="' + iconPath + '"/></svg>' +
      '</div>' +
      '<div>' +
        '<div class="pnl-stat-val">' + value + '</div>' +
        '<div class="pnl-stat-lbl">' + label + '</div>' +
      '</div>' +
    '</div>';
  }

  function _playerRow(b) {
    var trails   = b.trails  || [];
    var killfx   = b.killfx || [];
    var safeName = (b.name || '').replace(/ /g, '_');
    var avatarUrl   = 'https://crafthead.net/helm/' + encodeURIComponent(safeName) + '/30.png';
    var fallbackUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(b.name || '?') + '&background=111820&color=fff&size=30&bold=true';

    // Trails (with collapse/expand only if > 4)
    var trailsHtml = '';
    if (trails.length) {
      if (trails.length <= 4) {
        // 4 or less: show all directly without collapse
        trailsHtml += '<div class="rcv-pills-wrap" style="margin:4px 0">';
        for (var t = 0; t < trails.length; t++) {
          trailsHtml += '<span class="pnl-pill pnl-pill-purple" title="' + escHtml(_trailName(trails[t])) + '">' + escHtml(_trailName(trails[t])) + '</span>';
        }
        trailsHtml += '</div>';
      } else {
        // More than 4: show summary + collapsible list
        var trailId = 'trails-' + (b.name || '').replace(/\s+/g, '-');
        trailsHtml += '<div class="rcv-summary">';
        trailsHtml += '<span class="pnl-pill pnl-pill-purple" style="font-size:10px;padding:3px 8px">' + trails.length + ' trails</span>';
        trailsHtml += '<button class="rcv-toggle-btn" data-target="' + trailId + '" title="Expand/Collapse">';
        trailsHtml += '<svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>';
        trailsHtml += '</button>';
        trailsHtml += '</div>';
        trailsHtml += '<div id="' + trailId + '" class="rcv-pills-wrap collapsed">';
        for (var t = 0; t < trails.length; t++) {
          trailsHtml += '<span class="pnl-pill pnl-pill-purple" title="' + escHtml(_trailName(trails[t])) + '">' + escHtml(_trailName(trails[t])) + '</span>';
        }
        trailsHtml += '</div>';
      }
    } else {
      trailsHtml = '<span class="mi-slot-empty">-</span>';
    }

    // Kill FX (with collapse/expand only if > 4)
    var customFx = killfx.filter(function(id) { return id !== 'Games:coins' && id !== 'none'; });
    var fxHtml = '';
    if (customFx.length) {
      if (customFx.length <= 4) {
        // 4 or less: show all directly without collapse
        fxHtml += '<div class="rcv-pills-wrap" style="margin:4px 0">';
        for (var f = 0; f < customFx.length; f++) {
          fxHtml += '<span class="pnl-pill pnl-pill-red" title="' + escHtml(_fxName(customFx[f])) + '">' + escHtml(_fxName(customFx[f])) + '</span>';
        }
        fxHtml += '</div>';
      } else {
        // More than 4: show summary + collapsible list
        var fxId = 'killfx-' + (b.name || '').replace(/\s+/g, '-');
        fxHtml += '<div class="rcv-summary">';
        fxHtml += '<span class="pnl-pill pnl-pill-red" style="font-size:10px;padding:3px 8px">' + customFx.length + ' effects</span>';
        fxHtml += '<button class="rcv-toggle-btn" data-target="' + fxId + '" title="Expand/Collapse">';
        fxHtml += '<svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>';
        fxHtml += '</button>';
        fxHtml += '</div>';
        fxHtml += '<div id="' + fxId + '" class="rcv-pills-wrap collapsed">';
        for (var f = 0; f < customFx.length; f++) {
          fxHtml += '<span class="pnl-pill pnl-pill-red" title="' + escHtml(_fxName(customFx[f])) + '">' + escHtml(_fxName(customFx[f])) + '</span>';
        }
        fxHtml += '</div>';
      }
    } else {
      fxHtml = '<span class="mi-slot-empty">-</span>';
    }

    // Mimi data
    var mimiHtml = '';
    var md = b.mimi_data;
    if (md && (md.ct || md.cn || md.it || md.in)) {
      var slotCount = [md.ct, md.cn, md.it, md.in].filter(Boolean).length;
      mimiHtml = '<div style="display:flex;align-items:center;gap:4px">' +
        '<span class="pnl-pill pnl-pill-purple">' + slotCount + ' slot</span>' +
        '<button class="rcv-restore-mimi-only-btn" data-name="' + escHtml(b.name) + '" style="font-size:9px;font-weight:700;padding:3px 6px;border-radius:var(--r-sm);background:rgba(167,139,250,0.1);color:#a78bfa;border:1px solid rgba(167,139,250,0.2);cursor:pointer;display:inline-flex;align-items:center;gap:2px" title="Restore Mimi Instan via Queue">' +
          '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>' +
          'Restore' +
        '</button>' +
        '<button class="rcv-goto-mimi" data-name="' + escHtml(b.name) + '" style="font-size:9px;font-weight:700;padding:3px 6px;border-radius:var(--r-sm);background:transparent;color:var(--text-faint);border:1px solid var(--border);cursor:pointer;display:inline-flex;align-items:center" title="Buka Detail Mimi Inka">' +
          '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>' +
        '</button>' +
      '</div>';
    } else {
      mimiHtml = '<span class="mi-slot-empty">-</span>';
    }

    // Gem
    var gemCls = b.gem >= 1000 ? 'pnl-pill-purple' : '';
    var gemHtml = '<span class="rcv-gem-val">' +
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M2 9h20"/></svg>' +
      (b.gem || 0).toLocaleString('id-ID') + '</span>';

    return '<tr class="rcv-row">' +
      '<td><div class="rcv-player-cell">' +
        '<img class="rcv-avatar" src="' + avatarUrl + '" onerror="this.onerror=null;this.src=\'' + fallbackUrl + '\'">' +
        '<div><div class="rcv-player-name" title="' + escHtml(b.name || '') + '">' + escHtml(b.name || '?') + '</div>' +
          '<div class="rcv-player-status">' +
            '<span class="rcv-status-dot' + (b.online ? ' online' : '') + '"></span>' +
            (b.online ? 'Online' : 'Offline') +
          '</div>' +
        '</div>' +
      '</div></td>' +
      '<td>' + gemHtml + '</td>' +
      '<td>' + trailsHtml + '</td>' +
      '<td>' + fxHtml + '</td>' +
      '<td>' + mimiHtml + '</td>' +
      '<td style="text-align:right">' +
        '<button class="rcv-restore-btn" data-name="' + escHtml(b.name) + '" data-str="' + escHtml(b.data) + '">' +
          '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>' +
          'Restore' +
        '</button>' +
      '</td>' +
    '</tr>';
  }

  function _bindButtons(filtered) {
    // Expand/Collapse All button with debouncing
    var expandAllBtn = document.getElementById('rcv-expand-all');
    var allExpanded = false;
    var isAnimating = false;
    
    if (expandAllBtn) {
      expandAllBtn.addEventListener('click', function() {
        if (isAnimating) return; // Prevent multiple rapid clicks
        isAnimating = true;
        
        var allWraps = document.querySelectorAll('.rcv-pills-wrap');
        var allToggles = document.querySelectorAll('.rcv-toggle-btn');
        
        if (!allExpanded) {
          // Expand all - use requestAnimationFrame for smooth rendering
          requestAnimationFrame(function() {
            allWraps.forEach(function(wrap) {
              wrap.classList.remove('collapsed');
            });
            allToggles.forEach(function(toggle) {
              toggle.classList.add('expanded');
            });
          });
          this.querySelector('span').textContent = 'Collapse All';
          allExpanded = true;
        } else {
          // Collapse all
          requestAnimationFrame(function() {
            allWraps.forEach(function(wrap) {
              wrap.classList.add('collapsed');
            });
            allToggles.forEach(function(toggle) {
              toggle.classList.remove('expanded');
            });
          });
          this.querySelector('span').textContent = 'Expand All';
          allExpanded = false;
        }
        
        // Reset animation lock after transition
        setTimeout(function() {
          isAnimating = false;
        }, 350); // Slightly longer than CSS transition
      });
    }

    // Toggle buttons - optimized with passive event listeners and debouncing
    var toggleTimeout = null;
    document.querySelectorAll('.rcv-toggle-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        
        // Debounce rapid clicks
        if (toggleTimeout) return;
        toggleTimeout = setTimeout(function() {
          toggleTimeout = null;
        }, 300);
        
        var targetId = this.getAttribute('data-target');
        var target = document.getElementById(targetId);
        if (target) {
          // Use requestAnimationFrame for smooth animation
          var btnElement = this;
          requestAnimationFrame(function() {
            if (target.classList.contains('collapsed')) {
              target.classList.remove('collapsed');
              btnElement.classList.add('expanded');
            } else {
              target.classList.add('collapsed');
              btnElement.classList.remove('expanded');
            }
          });
        }
      });
    });

    document.querySelectorAll('.rcv-restore-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = this.getAttribute('data-name');
        var str = this.getAttribute('data-str');
        if (!name || !str) return;
        _confirmRestore([{ name: name, data: str }], this);
      });
    });

    document.querySelectorAll('.rcv-restore-mimi-only-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = this.getAttribute('data-name');
        if (!name) return;
        var backupItem = filtered.find(function(b) { return b.name === name; });
        if (!backupItem || !backupItem.mimi_data) return;
        _confirmRestoreMimiOnly(name, backupItem.mimi_data, this);
      });
    });

    /* Cross-link → Mimi Inka */
    document.querySelectorAll('.rcv-goto-mimi').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var targetPlayer = this.getAttribute('data-name');
        var mimiNav = document.getElementById('nav-mimi-inka');
        if (mimiNav && typeof window.showSection === 'function') {
          window.showSection('mimi-inka', mimiNav);
          setTimeout(function() {
            var mimiSearch = document.getElementById('mimi-search');
            if (mimiSearch && targetPlayer) {
              mimiSearch.value = targetPlayer;
              mimiSearch.dispatchEvent(new Event('input'));
            }
          }, 400);
        } else {
          showAdminToast('Panel Mimi Inka belum dimuat', 'warn');
        }
      });
    });

    var allBtn = document.getElementById('rcv-restore-all');
    if (allBtn) {
      allBtn.addEventListener('click', function () {
        var entries = filtered.map(function (b) { return { name: b.name, data: b.data }; });
        _confirmRestore(entries, allBtn);
      });
    }

    // Glyph Library button → Glyph Sheets page
    var glyphBtn = document.getElementById('rcv-glyph-btn');
    if (glyphBtn) {
      glyphBtn.addEventListener('click', function () {
        var gsNav = document.getElementById('nav-glyph-sheets');
        if (gsNav && typeof window.showSection === 'function') {
          window.showSection('glyph-sheets', gsNav);
        }
      });
    }
  }

  function _confirmRestore(entries, btn) {
    var count = entries.length;
    var names = entries.slice(0, 3).map(function(e) { return e.name; }).join(', ');
    if (count > 3) names += ' +' + (count - 3) + ' lainnya';

    var msg = 'Restore data ' + count + ' player?\n\n' + names +
      '\n\nData akan dikirim ke server dan di-apply otomatis.';

    if (typeof window.showMgrConfirm === 'function') {
      window.showMgrConfirm({
        title: 'Restore Player Data',
        message: msg,
        confirmText: 'Restore',
        danger: false,
        onConfirm: function () { _doRestore(entries, btn); },
      });
    } else {
      if (!confirm(msg)) return;
      _doRestore(entries, btn);
    }
  }

  async function _doRestore(entries, btn) {
    var sb = window._adminSb;
    if (!sb) { showAdminToast('Supabase belum siap', 'error'); return; }

    function serializeMimiData(mimiData) {
      if (!mimiData || typeof mimiData !== 'object') return '';
      var parts = [];
      if (mimiData.ct) parts.push('ct=' + encodeURIComponent(mimiData.ct));
      if (mimiData.cn) parts.push('cn=' + encodeURIComponent(mimiData.cn));
      if (mimiData.it) parts.push('it=' + encodeURIComponent(mimiData.it));
      if (mimiData.in) parts.push('in=' + encodeURIComponent(mimiData.in));
      return parts.length > 0 ? 'mimi:' + parts.join('&') : '';
    }

    var origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Mengirim...';
    var statusEl = document.getElementById('rcv-restore-status');

    var success = 0, fail = 0;
    for (var i = 0; i < entries.length; i++) {
      try {
        var entry = entries[i];
        var backupItem = _cache ? _cache.find(function(b) { return b.name === entry.name; }) : null;
        var importStr = entry.data || 'GS5|gem:0';
        if (backupItem && backupItem.mimi_data) {
          var mimiPart = serializeMimiData(backupItem.mimi_data);
          if (mimiPart) {
            importStr += '|' + mimiPart;
          }
        }

        var { error } = await sb.from('recovery_queue').insert({
          player_name: entry.name,
          import_string: importStr,
          status: 'pending',
        });
        if (error) throw error;
        success++;
      } catch (e) {
        fail++;
        console.warn('[Recovery] Insert failed:', entries[i].name, e);
      }
      if (statusEl) statusEl.textContent = 'Mengirim ' + (i + 1) + '/' + entries.length + '...';
    }

    btn.disabled = false;
    btn.textContent = origText;

    // Setelah restore Gem/Trail/KillFX selesai, langsung restore Mimi juga
    await _restoreAllMimi(true);

    if (fail === 0) {
      showAdminToast('Restore ' + success + ' player berhasil dikirim! Server akan proses dalam ~30 detik.');
    } else {
      showAdminToast(success + ' berhasil, ' + fail + ' gagal', 'error');
    }

    if (statusEl) statusEl.textContent = success + ' dikirim' + (fail > 0 ? ', ' + fail + ' gagal' : '');
  }

  function _confirmRestoreMimiOnly(name, mimiData, btn) {
    var msg = 'Restore Kustomisasi Mimi untuk player ' + name + '?\n\n' +
      'Tindakan ini aman dan HANYA memulihkan title/nametag Mimi tanpa mengubah Gem atau Koin player.';

    if (typeof window.showMgrConfirm === 'function') {
      window.showMgrConfirm({
        title: 'Restore Mimi Only',
        message: msg,
        confirmText: 'Restore Mimi',
        danger: false,
        onConfirm: function () { _doRestoreMimiOnly(name, mimiData, btn); },
      });
    } else {
      if (!confirm(msg)) return;
      _doRestoreMimiOnly(name, mimiData, btn);
    }
  }

  async function _doRestoreMimiOnly(name, mimiData, btn) {
    var sb = window._adminSb;
    if (!sb) { showAdminToast('Supabase belum siap', 'error'); return; }

    var origText = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Kirim...';

    try {
      var parts = [];
      if (mimiData.ct) parts.push('ct=' + encodeURIComponent(mimiData.ct));
      if (mimiData.cn) parts.push('cn=' + encodeURIComponent(mimiData.cn));
      if (mimiData.it) parts.push('it=' + encodeURIComponent(mimiData.it));
      if (mimiData.in) parts.push('in=' + encodeURIComponent(mimiData.in));
      
      if (parts.length === 0) {
        throw new Error('Data Mimi kosong');
      }
      
      var importStr = 'MIMI_ONLY|mimi:' + parts.join('&');

      var { error } = await sb.from('recovery_queue').insert({
        player_name: name,
        import_string: importStr,
        status: 'pending',
      });
      if (error) throw error;
      
      showAdminToast('Antrean restore Mimi untuk ' + name + ' berhasil dikirim!', 'success');
    } catch (e) {
      console.warn('[Recovery] Mimi restore failed:', name, e);
      showAdminToast('Gagal mengirim restore Mimi: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  }

  /* ── Restore All Mimi: bulk push kustomisasi ke recovery_queue dengan format MIMI_ONLY ──
     silent=true: dipanggil internal dari _doRestore (tanpa toast ganda)  */
  async function _restoreAllMimi(silent) {
    var sb = window._adminSb;
    if (!sb) { showAdminToast('Supabase belum siap', 'error'); return; }
    if (!_cache || !_cache.length) { showAdminToast('Muat data dulu (klik Refresh)', 'warn'); return; }

    // Kumpulkan semua player yang punya mimi_data
    var rows = [];
    _cache.forEach(function(p) {
      var md = p.mimi_data;
      if (!md) return;
      
      var parts = [];
      if (md.ct) parts.push('ct=' + encodeURIComponent(md.ct));
      if (md.cn) parts.push('cn=' + encodeURIComponent(md.cn));
      if (md.it) parts.push('it=' + encodeURIComponent(md.it));
      if (md.in) parts.push('in=' + encodeURIComponent(md.in));
      
      if (parts.length > 0) {
        rows.push({
          player_name: p.name,
          import_string: 'MIMI_ONLY|mimi:' + parts.join('&'),
          status: 'pending',
        });
      }
    });

    if (!rows.length) { 
      if (!silent) showAdminToast('Tidak ada data Mimi Inka untuk di-restore', 'warn'); 
      return; 
    }

    var btn = document.getElementById('rcv-restore-mimi');
    if (btn) { btn.disabled = true; btn.textContent = 'Mengirim...'; }

    var ok = 0, fail = 0;
    // Batch 10 rows sekaligus ke recovery_queue
    for (var i = 0; i < rows.length; i += 10) {
      var batch = rows.slice(i, i + 10);
      try {
        var res = await sb.from('recovery_queue').insert(batch);
        if (res.error) throw res.error;
        ok += batch.length;
      } catch(e) {
        fail += batch.length;
        console.warn('[Recovery] Mimi batch insert failed:', e);
      }
    }

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Restore All Mimi';
    }

    if (!silent) {
      if (fail === 0) {
        showAdminToast('Restore Mimi Massal: ' + ok + ' player berhasil dikirim ke antrean!', 'success');
      } else {
        showAdminToast('Mimi Massal: ' + ok + ' berhasil, ' + fail + ' gagal', 'error');
      }
    } else {
      // Dipanggil dari _doRestore — tambahkan info ke toast yang sudah ada
      if (ok > 0) showAdminToast('+ ' + ok + ' data Mimi dikirim ke antrean.', 'success');
    }
  }

  // Pull to refresh logic
  var _ptrStartY = 0;
  var _isPulling = false;
  var _ptrIndicator = null;

  function _init() {
    _hookNav();

    var mainEl = document.querySelector('.main-content');
    if (mainEl) {
      _ptrIndicator = document.createElement('div');
      _ptrIndicator.style.cssText = 'position:fixed;top:-50px;left:50%;transform:translateX(-50%);z-index:9999;background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:8px 16px;font-size:11.5px;font-weight:700;color:var(--text);box-shadow:0 4px 12px rgba(0,0,0,0.4);transition:top 0.2s, opacity 0.2s;opacity:0;display:flex;align-items:center;gap:8px;pointer-events:none;';
      _ptrIndicator.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 4v12M8 12l4 4 4-4"/></svg><span>Tarik untuk refresh...</span>';
      document.body.appendChild(_ptrIndicator);

      mainEl.addEventListener('touchstart', function(e) {
        if (mainEl.scrollTop <= 0) {
          _ptrStartY = e.touches[0].clientY;
          _isPulling = true;
        }
      }, {passive: true});

      mainEl.addEventListener('touchmove', function(e) {
        if (!_isPulling) return;
        var y = e.touches[0].clientY;
        var diff = y - _ptrStartY;
        // Hanya jalan jika section recovery aktif
        if (diff > 0 && mainEl.scrollTop <= 0 && document.getElementById('sec-recovery')) {
           _ptrIndicator.style.opacity = '1';
           if (diff > 80) {
             _ptrIndicator.style.top = '70px';
             _ptrIndicator.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.92-10.26l3.08 3.69"/></svg><span style="color:var(--accent)">Lepas untuk refresh</span>';
           } else {
             _ptrIndicator.style.top = (diff - 50) + 'px';
             _ptrIndicator.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 4v12M8 12l4 4 4-4"/></svg><span>Tarik untuk refresh...</span>';
           }
        }
      }, {passive: true});

      mainEl.addEventListener('touchend', function(e) {
        if (!_isPulling) return;
        _isPulling = false;
        var diff = e.changedTouches[0].clientY - _ptrStartY;
        if (diff > 80 && document.getElementById('sec-recovery')) {
          _ptrIndicator.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" style="animation:spin 1s linear infinite"><circle cx="12" cy="12" r="10" stroke-dasharray="31.4 31.4"/></svg><span style="color:var(--accent)">Memuat data...</span>';
          _cache = null; _cacheTs = 0;
          _secondsLeft = 60; _updateCountdownUi();
          
          _loadData().then(function() {
             setTimeout(function() {
               _ptrIndicator.style.top = '-50px';
               _ptrIndicator.style.opacity = '0';
             }, 400);
          }).catch(function() {
             setTimeout(function() {
               _ptrIndicator.style.top = '-50px';
               _ptrIndicator.style.opacity = '0';
             }, 400);
          });
        } else {
          _ptrIndicator.style.top = '-50px';
          _ptrIndicator.style.opacity = '0';
        }
      }, {passive: true});
    }

    document.addEventListener('input', function (e) {
      if (e.target.id !== 'rcv-search') return;
      _searchQuery = e.target.value.trim();
      if (_cache) _renderCards(_cache);
    });

    document.addEventListener('click', function (e) {
      if (e.target.id === 'rcv-refresh' || e.target.closest('#rcv-refresh')) {
        _cache = null; _cacheTs = 0;
        _secondsLeft = 60; _updateCountdownUi();
        _loadData();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(_init, 100); });
  } else {
    setTimeout(_init, 100);
  }

  window.recoveryLoad = _loadData;
  
  // Expose refresh for pull-to-refresh (with delay to ensure PTR loaded)
  function registerRefresh() {
    if (typeof window.registerPanelRefresh === 'function') {
      window.registerPanelRefresh('recovery', function() {
        _cacheTs = 0; // Force bypass cache
        _loadData(true); // Silent refresh
      });
    } else {
      // Retry after PTR loads
      setTimeout(registerRefresh, 100);
    }
  }
  registerRefresh();
})();
