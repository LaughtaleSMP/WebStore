// admin-recovery.js — Player Data Recovery Panel
// Reads gacha_lb.player_backups from Supabase, displays in searchable table with copy-to-clipboard.

(function () {
  'use strict';

  var _cache = null, _cacheTs = 0;
  var _CACHE_TTL = 120_000;
  var _searchQuery = '';

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
          'Backup otomatis dari Minecraft sync (tiap 5 menit). ' +
          'Copy string lalu import di game: <code>/gacha import &lt;string&gt;</code>' +
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
      _renderTable(_cache);
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
        body.innerHTML = '<div class="empty-state">Belum ada data sync.</div>';
        return;
      }

      var lb = typeof resp.data.gacha_lb === 'string'
        ? JSON.parse(resp.data.gacha_lb)
        : resp.data.gacha_lb;
      var backups = lb.player_backups || [];

      if (!backups.length) {
        body.innerHTML = '<div class="empty-state">Belum ada backup. Server perlu sync minimal 1x setelah update behavior pack.</div>';
        return;
      }

      _cache = backups;
      _cacheTs = Date.now();
      _renderTable(backups);
    } catch (e) {
      body.innerHTML = '<div class="empty-state" style="color:#f87171">Error: ' + escHtml(e.message) + '</div>';
    }
  }

  function _parseExport(str) {
    if (!str) return { gem: 0, particles: [], killfx: [] };
    var result = { gem: 0, particles: [], killfx: [] };
    var parts = str.split('|');
    for (var i = 1; i < parts.length; i++) {
      var ci = parts[i].indexOf(':');
      if (ci < 0) continue;
      var key = parts[i].slice(0, ci), val = parts[i].slice(ci + 1);
      if (key === 'gem')               result.gem = parseInt(val) || 0;
      else if (key === 'pt' && val)     result.particles = val.split(',').filter(Boolean);
      else if (key === 'kfx' && val)    result.killfx = val.split(',').filter(Boolean);
    }
    return result;
  }

  function _badge(count, bgColor, fgColor) {
    if (count <= 0) return '<span style="color:var(--text-faint)">0</span>';
    return '<span style="background:' + bgColor + ';color:' + fgColor +
      ';padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600">' + count + '</span>';
  }

  function _statusDot(online) {
    var c = online ? '#4ade80' : '#5a6478';
    var t = online ? 'Online' : 'Offline';
    return '<span style="display:inline-flex;align-items:center;gap:4px">' +
      '<span style="width:7px;height:7px;border-radius:50%;background:' + c + ';display:inline-block"></span>' +
      '<span style="color:' + c + ';font-size:11px">' + t + '</span></span>';
  }

  var _TH = 'padding:8px 6px;color:var(--text-faint);font-weight:600;font-size:10px;text-transform:uppercase';

  function _renderTable(backups) {
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

    var html = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px" role="table">' +
      '<thead><tr style="border-bottom:1px solid var(--border);text-align:left">' +
      '<th style="' + _TH + '">Player</th>' +
      '<th style="' + _TH + ';text-align:right">Gem</th>' +
      '<th style="' + _TH + ';text-align:center">Trails</th>' +
      '<th style="' + _TH + ';text-align:center">KillFX</th>' +
      '<th style="' + _TH + ';text-align:center">Status</th>' +
      '<th style="' + _TH + ';width:80px"></th>' +
      '</tr></thead><tbody>';

    for (var i = 0; i < filtered.length; i++) {
      var b = filtered[i];
      var p = _parseExport(b.data);
      var gemStyle = p.gem > 0 ? 'color:#a78bfa;font-weight:700' : 'color:var(--text-faint)';

      html += '<tr style="border-bottom:1px solid rgba(255,255,255,.04)">' +
        '<td style="padding:10px 6px;font-weight:600;color:var(--text)">' + escHtml(b.name) + '</td>' +
        '<td style="padding:10px 6px;text-align:right;' + gemStyle + '">' + p.gem.toLocaleString('id-ID') + '</td>' +
        '<td style="padding:10px 6px;text-align:center">' + _badge(p.particles.length, 'rgba(52,211,153,.15)', '#6ee7b7') + '</td>' +
        '<td style="padding:10px 6px;text-align:center">' + _badge(p.killfx.length, 'rgba(248,113,113,.12)', '#fca5a5') + '</td>' +
        '<td style="padding:10px 6px;text-align:center">' + _statusDot(b.online) + '</td>' +
        '<td style="padding:10px 6px;text-align:right">' +
          '<button class="btn-ghost rcv-copy-btn" data-str="' + escHtml(b.data) + '" ' +
          'style="font-size:10.5px;padding:4px 10px;white-space:nowrap" aria-label="Copy import string ' + escHtml(b.name) + '">Copy</button>' +
        '</td></tr>';
    }

    html += '</tbody></table></div>' +
      '<div style="font-size:10.5px;color:var(--text-faint);margin-top:10px;text-align:right">' +
      filtered.length + ' / ' + backups.length + ' player</div>';
    body.innerHTML = html;

    body.querySelectorAll('.rcv-copy-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var str = this.getAttribute('data-str');
        if (!str) return;
        navigator.clipboard.writeText(str).then(function () {
          showAdminToast('Import string disalin ke clipboard!');
        }).catch(function () {
          prompt('Copy string ini:', str);
        });
      });
    });
  }

  function _init() {
    _hookNav();

    document.addEventListener('input', function (e) {
      if (e.target.id !== 'rcv-search') return;
      _searchQuery = e.target.value.trim();
      if (_cache) _renderTable(_cache);
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
