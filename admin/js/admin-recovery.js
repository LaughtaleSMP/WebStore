// admin-recovery.js — Player Asset Recovery Panel
// Displays gem, particle trails, kill effects per player.
// 1-click recovery via recovery_queue table (polled by behavior pack).

(function () {
  'use strict';

  var _cache = null, _cacheTs = 0;
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
      if (name === 'recovery') _loadData();
    };
    window.showSection._recoveryHooked = true;
  }

  async function _loadData() {
    var body = document.getElementById('rcv-body');
    if (!body) return;

    if (_cache && (Date.now() - _cacheTs) < _CACHE_TTL) {
      _renderCards(_cache);
      return;
    }

    body.innerHTML = '<div class="empty-state">Memuat data backup...</div>';

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
        body.innerHTML = '<div class="empty-state">Belum ada data sync. Server belum pernah online.</div>';
        return;
      }

      var lb = typeof resp.data.gacha_lb === 'string'
        ? JSON.parse(resp.data.gacha_lb)
        : resp.data.gacha_lb;

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
        body.innerHTML = msg;
        return;
      }

      _cache = backups;
      _cacheTs = Date.now();
      _renderCards(backups);
    } catch (e) {
      body.innerHTML = '<div class="empty-state" style="color:#f87171">Error: ' + escHtml(e.message) + '</div>';
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

    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:10px;margin-bottom:16px">' +
      _kpiCard('Player', backups.length, 'rgba(74,143,255,0.15)', '#4a8fff') +
      _kpiCard('Total Gem', totalGems.toLocaleString('id-ID'), 'rgba(167,139,250,0.15)', '#a78bfa') +
      _kpiCard('Trails', totalTrails, 'rgba(52,211,153,0.15)', '#34d399') +
      _kpiCard('Kill FX', totalFx, 'rgba(248,113,113,0.15)', '#f87171') +
      '</div>';


    html += '<div style="margin-bottom:16px;display:flex;gap:8px;align-items:center">' +
      '<button id="rcv-restore-all" class="btn-ghost" ' +
      'style="font-size:11px;padding:6px 14px;border:1px solid rgba(52,211,153,.3);color:#34d399" ' +
      'aria-label="Restore all players">Restore All (' + filtered.length + ' player)</button>' +
      '<span id="rcv-restore-status" style="font-size:11px;color:var(--text-faint)"></span>' +
      '</div>';


    for (var j = 0; j < filtered.length; j++) {
      html += _playerCard(filtered[j]);
    }

    html += '<div style="font-size:10.5px;color:var(--text-faint);margin-top:12px;text-align:right">' +
      'Menampilkan ' + filtered.length + ' dari ' + backups.length + ' player</div>';

    body.innerHTML = html;
    _bindButtons(filtered);
  }

  function _kpiCard(label, value, bg, color) {
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 14px">' +
      '<div style="font-size:10px;color:var(--text-faint);font-weight:600;text-transform:uppercase;letter-spacing:.5px">' + label + '</div>' +
      '<div style="font-size:18px;font-weight:700;color:' + color + ';margin-top:2px">' + value + '</div>' +
      '</div>';
  }

  function _playerCard(b) {
    var trails = b.trails || [];
    var killfx = b.killfx || [];
    var gemStyle = b.gem >= 1000 ? 'color:#a78bfa;font-weight:700' : 'color:var(--text)';
    var avatarUrl = 'https://api.mineatar.io/face/' + encodeURIComponent(b.name) + '?scale=4';
    var statusDot = b.online
      ? '<span style="width:6px;height:6px;border-radius:50%;background:#4ade80;display:inline-block"></span>'
      : '<span style="width:6px;height:6px;border-radius:50%;background:#5a6478;display:inline-block"></span>';

    var html = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px;transition:border-color .2s" ' +
      'onmouseover="this.style.borderColor=\'rgba(167,139,250,.4)\'" onmouseout="this.style.borderColor=\'var(--border)\'">';


    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">' +
      '<img src="' + avatarUrl + '" alt="" style="width:28px;height:28px;border-radius:6px;background:#2a2a2a;border:1px solid rgba(255,255,255,.1)">' +
      '<div style="flex:1">' +
        '<div style="display:flex;align-items:center;gap:6px">' +
          statusDot +
          '<span style="font-weight:600;font-size:13px;color:var(--text)">' + escHtml(b.name) + '</span>' +
        '</div>' +
        '<div style="font-size:11px;' + gemStyle + '">Gem: ' + (b.gem || 0).toLocaleString('id-ID') + '</div>' +
      '</div>' +
      '<button class="btn-ghost rcv-restore-btn" data-name="' + escHtml(b.name) + '" data-str="' + escHtml(b.data) + '" ' +
        'style="font-size:11px;padding:5px 12px;border:1px solid rgba(52,211,153,.3);color:#34d399;border-radius:8px;font-weight:600" ' +
        'aria-label="Restore ' + escHtml(b.name) + '">Restore</button>' +
      '</div>';


    if (trails.length > 0) {
      html += '<div style="margin-bottom:8px">' +
        '<div style="font-size:10px;color:var(--text-faint);font-weight:600;text-transform:uppercase;margin-bottom:4px">Particle Trails (' + trails.length + ')</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:4px">';
      for (var t = 0; t < trails.length; t++) {
        var tc = _trailColor(trails[t]);
        html += '<span style="font-size:10.5px;padding:2px 8px;border-radius:6px;background:' + tc + '20;color:' + tc + ';border:1px solid ' + tc + '30;font-weight:500">' +
          escHtml(_trailName(trails[t])) + '</span>';
      }
      html += '</div></div>';
    }


    if (killfx.length > 0) {
      var customFx = killfx.filter(function(id) { return id !== 'Games:coins' && id !== 'none'; });
      if (customFx.length > 0) {
        html += '<div>' +
          '<div style="font-size:10px;color:var(--text-faint);font-weight:600;text-transform:uppercase;margin-bottom:4px">Kill Effects (' + customFx.length + ')</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:4px">';
        for (var f = 0; f < customFx.length; f++) {
          html += '<span style="font-size:10.5px;padding:2px 8px;border-radius:6px;background:rgba(248,113,113,.12);color:#fca5a5;border:1px solid rgba(248,113,113,.2);font-weight:500">' +
            escHtml(_fxName(customFx[f])) + '</span>';
        }
        html += '</div></div>';
      }
    }

    html += '</div>';
    return html;
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
