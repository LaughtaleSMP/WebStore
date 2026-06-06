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
          '<div style="display:flex;gap:8px;align-items:center">' +
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

  // Render Minecraft PUA glyph characters as sprite tiles from glyph_E7.png
  // glyph_E7.png is 2304×2304, 16×16 grid → 144px per tile
  // U+E700–E7FF maps to row/col in the grid
  var GLYPH_TILE = 144, GLYPH_COLS = 16, GLYPH_DISPLAY = 20;
  var GLYPH_SCALE = GLYPH_DISPLAY / GLYPH_TILE;
  var GLYPH_BG_SIZE = Math.round(2304 * GLYPH_SCALE);
  var GLYPH_LS_KEY = 'rcv_glyph_src';
  var _glyphSrc = localStorage.getItem(GLYPH_LS_KEY) || 'assets/glyph_E7.png';

  function _setGlyphSrc(dataUrl) {
    _glyphSrc = dataUrl;
    localStorage.setItem(GLYPH_LS_KEY, dataUrl);
    if (_cache) _renderCards(_cache);
  }
  function _clearGlyphSrc() {
    _glyphSrc = 'assets/glyph_E7.png';
    localStorage.removeItem(GLYPH_LS_KEY);
    if (_cache) _renderCards(_cache);
  }

  function _renderGlyph(text) {
    if (!text) return '';
    // Strip Minecraft color codes (§x)
    var clean = text.replace(/\u00a7[0-9a-fk-or]/gi, '');
    var out = '';
    for (var i = 0; i < clean.length; i++) {
      var cp = clean.codePointAt(i);
      if (cp >= 0xE700 && cp <= 0xE7FF) {
        var idx = cp - 0xE700;
        var col = idx % GLYPH_COLS;
        var row = Math.floor(idx / GLYPH_COLS);
        var bx = -(col * GLYPH_DISPLAY);
        var by = -(row * GLYPH_DISPLAY);
        var src = _glyphSrc.indexOf('data:') === 0 ? _glyphSrc : 'assets/glyph_E7.png';
        out += '<span style="display:inline-block;width:' + GLYPH_DISPLAY + 'px;height:' + GLYPH_DISPLAY + 'px;' +
          'background:url(' + src + ') ' + bx + 'px ' + by + 'px;' +
          'background-size:' + GLYPH_BG_SIZE + 'px ' + GLYPH_BG_SIZE + 'px;image-rendering:pixelated;vertical-align:middle' +
          '" title="U+' + cp.toString(16).toUpperCase() + '"></span>';
        // Handle surrogate pairs
        if (cp > 0xFFFF) i++;
      } else if (clean[i] === '\\' && clean[i+1] === 'n') {
        out += '<br>';
        i++;
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

    var totalGems = 0, totalTrails = 0, totalFx = 0, totalMimi = 0;
    for (var i = 0; i < backups.length; i++) {
      totalGems += backups[i].gem || 0;
      totalTrails += (backups[i].trails || []).length;
      totalFx += (backups[i].killfx || []).length;
      if (backups[i].mimi_data) totalMimi++;
    }

    var html = '<style>' +
      '.rcv-kpi-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:12px; margin-bottom:20px; }' +
      '.rcv-table-header { display:grid; grid-template-columns:160px 80px 1fr 1fr 1fr 90px; gap:12px; padding:12px 16px; font-size:10.5px; font-weight:700; color:var(--text-faint); text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid var(--border); background:var(--surface2); border-radius:10px 10px 0 0; }' +
      '.rcv-row { display:grid; grid-template-columns:160px 80px 1fr 1fr 1fr 90px; gap:12px; align-items:center; padding:12px 16px; transition:all 0.2s; border-bottom:1px solid var(--border); background:transparent; }' +
      '.rcv-row:last-child { border-bottom:none; border-radius:0 0 10px 10px; }' +
      '.rcv-row:hover { background:rgba(255,255,255,0.02); }' +
      '.rcv-col-label { display:none; font-size:9.5px; color:var(--text-faint); font-weight:700; text-transform:uppercase; margin-bottom:6px; letter-spacing:0.5px; }' +
      '.rcv-list-container { border:1px solid var(--border); border-radius:10px; background:var(--surface); box-shadow:0 2px 12px rgba(0,0,0,0.05); }' +
      '@media (max-width: 768px) {' +
        '.rcv-table-header { display:none; }' +
        '.rcv-list-container { background:transparent; border:none; box-shadow:none; }' +
        '.rcv-row { display:flex; flex-direction:column; align-items:stretch; gap:12px; padding:16px; background:var(--surface2); border-radius:12px; margin-bottom:12px; border:1px solid var(--border); }' +
        '.rcv-row:hover { background:var(--surface2); }' +
        '.rcv-col-label { display:block; }' +
        '.rcv-player-col { display:flex; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:12px; margin-bottom:4px; }' +
        '.rcv-action-col { text-align:left !important; margin-top:6px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.05); }' +
        '.rcv-action-col button { width:100%; justify-content:center; padding:12px 0 !important; font-size:12px !important; }' +
        '.rcv-kpi-grid { grid-template-columns: 1fr 1fr; }' +
      '}' +
      '</style>';

    html += '<div class="rcv-kpi-grid">' +
      _kpiCard('Player Data', backups.length, 'rgba(56, 189, 248, 0.1)', '#38bdf8', 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z') +
      _kpiCard('Total Gem', totalGems.toLocaleString('id-ID'), 'rgba(167, 139, 250, 0.1)', '#a78bfa', 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4') +
      _kpiCard('Total Trails', totalTrails, 'rgba(52, 211, 153, 0.1)', '#34d399', 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z') +
      _kpiCard('Kill Effects', totalFx, 'rgba(248, 113, 113, 0.1)', '#f87171', 'M13 10V3L4 14h7v7l9-11h-7z') +
      _kpiCard('Mimi Inka', totalMimi, 'rgba(74, 143, 255, 0.1)', '#4a8fff', 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z') +
      '</div>';

    var lastSyncDate = _lastBackupTs ? new Date(_lastBackupTs).toLocaleString('id-ID', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', second:'2-digit'}) : 'Belum sync';
    
    html += '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:16px;padding:10px 14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.1)">' +
      '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px">' +
        '<button id="rcv-restore-all" class="btn-ghost" style="font-size:11.5px;padding:6px 14px;border-radius:6px;display:flex;align-items:center;gap:6px;background:rgba(52,211,153,.1);color:#10b981;border:1px solid rgba(52,211,153,.3);cursor:pointer;font-weight:700;transition:all 0.2s" onmouseover="this.style.background=\'rgba(52,211,153,.2)\'" onmouseout="this.style.background=\'rgba(52,211,153,.1)\'">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>' +
          'Restore All (' + filtered.length + ')' +
        '</button>' +
        '<span id="rcv-restore-status" style="font-size:11.5px;color:var(--text-faint);font-weight:500"></span>' +
      '</div>' +
      '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:11px;color:var(--text-faint)">' +
        '<div style="display:flex;align-items:center;gap:5px;background:rgba(52,211,153,.1);padding:4px 8px;border-radius:20px;border:1px solid rgba(52,211,153,.2)"><div style="width:6px;height:6px;border-radius:50%;background:#34d399;box-shadow:0 0 6px #34d399;animation:pulse 2s infinite"></div> <span style="color:#34d399;font-weight:600">Backup Safe</span></div>' +
        '<span>Last Sync: <strong style="color:var(--text);font-variant-numeric:tabular-nums">' + lastSyncDate + '</strong></span>' +
        '<input type="file" id="rcv-glyph-upload" accept=".png" style="display:none">' +
        '<button id="rcv-glyph-btn" style="font-size:10px;padding:4px 10px;border-radius:6px;display:flex;align-items:center;gap:4px;background:rgba(74,143,255,.1);color:#60a5fa;border:1px solid rgba(74,143,255,.25);cursor:pointer;font-weight:600;transition:all 0.2s" onmouseover="this.style.background=\'rgba(74,143,255,.2)\'" onmouseout="this.style.background=\'rgba(74,143,255,.1)\'">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
          'Glyph' +
        '</button>' +
        (_glyphSrc !== 'assets/glyph_E7.png' ? '<button id="rcv-glyph-clear" style="font-size:10px;padding:4px 8px;border-radius:6px;background:rgba(248,113,113,.1);color:#f87171;border:1px solid rgba(248,113,113,.25);cursor:pointer;font-weight:600;transition:all 0.2s" title="Hapus glyph custom">&times;</button>' : '') +
      '</div>' +
    '</div>';

    html += '<div class="rcv-list-container">';
    html += '<div class="rcv-table-header">' +
      '<div>Player</div>' +
      '<div>Gems</div>' +
      '<div>Particle Trails</div>' +
      '<div>Kill Effects</div>' +
      '<div>Mimi Inka</div>' +
      '<div style="text-align:right">Action</div>' +
    '</div>';

    html += '<div style="display:flex;flex-direction:column;">';
    for (var j = 0; j < filtered.length; j++) {
      html += _playerRow(filtered[j], j === filtered.length - 1);
    }
    html += '</div></div>';

    html += '<div style="font-size:11px;color:var(--text-faint);margin-top:16px;text-align:center">' +
      'Menampilkan ' + filtered.length + ' dari ' + backups.length + ' player</div>';

    body.innerHTML = html;
    _bindButtons(filtered);
  }

  function _kpiCard(label, value, bg, color, iconPath) {
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:12px;position:relative;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1)">' +
      '<div style="width:40px;height:40px;border-radius:10px;background:' + bg + ';display:flex;align-items:center;justify-content:center;color:' + color + '">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="' + iconPath + '"/></svg>' +
      '</div>' +
      '<div>' +
        '<div style="font-size:10px;color:var(--text-faint);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">' + label + '</div>' +
        '<div style="font-size:18px;font-weight:800;color:var(--text);margin-top:2px">' + value + '</div>' +
      '</div>' +
      '</div>';
  }

  function _playerRow(b, isLast) {
    var trails = b.trails || [];
    var killfx = b.killfx || [];
    var gemStyle = b.gem >= 1000 ? 'color:#a78bfa;font-weight:700' : 'color:var(--text);font-weight:600';
    
    var safeName = b.name.replace(/ /g, '_');
    var avatarUrl = 'https://crafthead.net/helm/' + encodeURIComponent(safeName) + '/28.png';
    var fallbackUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(b.name) + '&background=2a2a2a&color=fff&size=28&bold=true';

    var trailsHtml = '';
    if (trails.length) {
      trailsHtml += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
      for (var t = 0; t < trails.length; t++) {
        var tc = _trailColor(trails[t]);
        trailsHtml += '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:' + tc + '15;color:' + tc + ';border:1px solid ' + tc + '30;white-space:nowrap;font-weight:500">' + escHtml(_trailName(trails[t])) + '</span>';
      }
      trailsHtml += '</div>';
    } else {
      trailsHtml = '<span style="color:var(--text-faint);font-size:11px;font-style:italic">-</span>';
    }

    var fxHtml = '';
    var customFx = killfx.filter(function(id) { return id !== 'Games:coins' && id !== 'none'; });
    if (customFx.length) {
      fxHtml += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
      for (var f = 0; f < customFx.length; f++) {
        fxHtml += '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(248,113,113,.1);color:#fca5a5;border:1px solid rgba(248,113,113,.2);white-space:nowrap;font-weight:500">' + escHtml(_fxName(customFx[f])) + '</span>';
      }
      fxHtml += '</div>';
    } else {
      fxHtml = '<span style="color:var(--text-faint);font-size:11px;font-style:italic">-</span>';
    }

    var mimiHtml = '';
    var md = b.mimi_data;
    if (md && (md.ct || md.cn || md.it || md.in)) {
      mimiHtml += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
      var mimiEntries = [];
      if (md.ct) mimiEntries.push({label:'Title Chat', val:md.ct});
      if (md.cn) mimiEntries.push({label:'Nametag Chat', val:md.cn});
      if (md.it) mimiEntries.push({label:'Title IG', val:md.it});
      if (md.in) mimiEntries.push({label:'Nametag IG', val:md.in});
      for (var mi = 0; mi < mimiEntries.length; mi++) {
        var me = mimiEntries[mi];
        mimiHtml += '<div style="display:inline-flex;align-items:center;gap:4px;font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(74,143,255,.1);border:1px solid rgba(74,143,255,.2)">' +
          '<span style="color:rgba(96,165,250,.6);font-weight:600;font-size:8.5px;text-transform:uppercase;letter-spacing:.3px">' + escHtml(me.label) + '</span>' +
          _renderGlyph(me.val) +
        '</div>';
      }
      mimiHtml += '</div>';
    } else {
      mimiHtml = '<span style="color:var(--text-faint);font-size:11px;font-style:italic">-</span>';
    }

    var borderBottom = isLast ? '' : 'border-bottom:1px solid var(--border);';

    return '<div class="rcv-row">' +
      '<div class="rcv-player-col">' +
        '<div style="display:flex;align-items:center;gap:10px">' +
          '<div style="position:relative">' +
            '<img src="' + avatarUrl + '" onerror="this.onerror=null;this.src=\'' + fallbackUrl + '\'" style="width:28px;height:28px;border-radius:6px;background:#222;object-fit:cover;box-shadow:0 2px 4px rgba(0,0,0,0.3)">' +
            '<div style="position:absolute;bottom:-2px;right:-2px;width:10px;height:10px;border-radius:50%;border:2px solid var(--surface);background:' + (b.online ? '#4ade80' : '#64748b') + '"></div>' +
          '</div>' +
          '<div style="font-weight:600;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:0.3px" title="' + escHtml(b.name) + '">' + escHtml(b.name) + '</div>' +
        '</div>' +
      '</div>' +
      '<div>' +
        '<div class="rcv-col-label">Gems</div>' +
        '<div style="display:flex;align-items:center;gap:4px;font-size:12.5px;' + gemStyle + '">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M2 9h20"/></svg>' +
          (b.gem || 0).toLocaleString('id-ID') +
        '</div>' +
      '</div>' +
      '<div>' +
        '<div class="rcv-col-label">Particle Trails</div>' +
        '<div>' + trailsHtml + '</div>' +
      '</div>' +
      '<div>' +
        '<div class="rcv-col-label">Kill Effects</div>' +
        '<div>' + fxHtml + '</div>' +
      '</div>' +
      '<div>' +
        '<div class="rcv-col-label">Mimi Inka</div>' +
        '<div>' + mimiHtml + '</div>' +
      '</div>' +
      '<div class="rcv-action-col">' +
        '<button class="btn-ghost rcv-restore-btn" data-name="' + escHtml(b.name) + '" data-str="' + escHtml(b.data) + '" style="padding:5px 12px;font-size:11px;border-radius:4px;border:1px solid rgba(52,211,153,.3);color:#34d399;background:rgba(52,211,153,.05);cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:all 0.2s;font-weight:600" onmouseover="this.style.background=\'rgba(52,211,153,.15)\';this.style.borderColor=\'#34d399\'" onmouseout="this.style.background=\'rgba(52,211,153,.05)\';this.style.borderColor=\'rgba(52,211,153,.3)\'" title="Restore ' + escHtml(b.name) + '">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg> Restore' +
        '</button>' +
      '</div>' +
    '</div>';
  }

  function _bindButtons(filtered) {
    document.querySelectorAll('.rcv-restore-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = this.getAttribute('data-name');
        var str = this.getAttribute('data-str');
        if (!name || !str) return;
        _confirmRestore([{ name: name, data: str }], this);
      });
    });

    var allBtn = document.getElementById('rcv-restore-all');
    if (allBtn) {
      allBtn.addEventListener('click', function () {
        var entries = filtered.map(function (b) { return { name: b.name, data: b.data }; });
        _confirmRestore(entries, allBtn);
      });
    }

    // Glyph upload handler
    var glyphBtn = document.getElementById('rcv-glyph-btn');
    var glyphInput = document.getElementById('rcv-glyph-upload');
    if (glyphBtn && glyphInput) {
      glyphBtn.addEventListener('click', function () { glyphInput.click(); });
      glyphInput.addEventListener('change', function () {
        var file = this.files && this.files[0];
        if (!file || !file.type.startsWith('image/')) return;
        var reader = new FileReader();
        reader.onload = function (e) {
          var img = new Image();
          img.onload = function () {
            GLYPH_BG_SIZE = Math.round(img.width * (GLYPH_DISPLAY / (img.width / GLYPH_COLS)));
            _setGlyphSrc(e.target.result);
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        this.value = '';
      });
    }
    var glyphClear = document.getElementById('rcv-glyph-clear');
    if (glyphClear) {
      glyphClear.addEventListener('click', function () {
        GLYPH_BG_SIZE = Math.round(2304 * GLYPH_SCALE);
        _clearGlyphSrc();
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

    var origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Mengirim...';
    var statusEl = document.getElementById('rcv-restore-status');

    var success = 0, fail = 0;
    for (var i = 0; i < entries.length; i++) {
      try {
        var { error } = await sb.from('recovery_queue').insert({
          player_name: entries[i].name,
          import_string: entries[i].data,
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

    if (fail === 0) {
      showAdminToast('Restore ' + success + ' player berhasil dikirim! Server akan proses dalam ~30 detik.');
    } else {
      showAdminToast(success + ' berhasil, ' + fail + ' gagal', 'error');
    }

    if (statusEl) statusEl.textContent = success + ' dikirim' + (fail > 0 ? ', ' + fail + ' gagal' : '');
  }

  function _init() {
    _hookNav();

    document.addEventListener('input', function (e) {
      if (e.target.id !== 'rcv-search') return;
      _searchQuery = e.target.value.trim();
      if (_cache) _renderCards(_cache);
    });

    document.addEventListener('click', function (e) {
      if (e.target.id !== 'rcv-refresh') return;
      _cache = null;
      _cacheTs = 0;
      _secondsLeft = 60; // reset timer if manual click
      _updateCountdownUi();
      _loadData();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(_init, 100); });
  } else {
    setTimeout(_init, 100);
  }

  window.recoveryLoad = _loadData;
})();
