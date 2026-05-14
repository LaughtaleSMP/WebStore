/* ══════════════════════════════════════════════════
   hero-utils.js — Hero section utilities
   Tanggal/waktu, direct connect, keyboard handlers
══════════════════════════════════════════════════ */

/* ── Hero Date/Time ── */
(function updateHeroDate() {
  var hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  var bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  function pad(n) { return n < 10 ? '0' + n : n; }
  function render() {
    var d = new Date();
    var dateEl = document.getElementById('hero-date-text');
    var timeEl = document.getElementById('hero-time-text');
    if (dateEl) dateEl.textContent = hari[d.getDay()] + ', ' + pad(d.getDate()) + ' ' + bulan[d.getMonth()] + ' ' + d.getFullYear();
    if (timeEl) timeEl.textContent = pad(d.getHours()) + '.' + pad(d.getMinutes()) + ' WIB';
  }
  render();
  setInterval(render, 30000);
})();

/* ── Direct Connect to Minecraft Server ── */
function heroDirectConnect() {
  var _ip   = (window._serverIP || 'laughtale.my.id:19214').split(':');
  var HOST  = _ip[0] || 'laughtale.my.id';
  var PORT  = _ip[1] || '19214';
  var btn  = document.getElementById('hero-connect-btn');

  var deepLink = 'minecraft://connect?serverUrl=' + HOST + '&serverPort=' + PORT;

  var t = Date.now();
  window.location.href = deepLink;

  setTimeout(function() {
    if (Date.now() - t < 2000) {
      var ip = HOST + ':' + PORT;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(ip).then(function() {
          showConnectHint('IP disalin! Buka Minecraft > Bermain > Server > Tambah Server', 'success');
        });
      } else {
        showConnectHint('Buka Minecraft > Bermain > Server > Tambah Server > masukkan ' + ip, 'info');
      }
    }
  }, 1500);

  if (btn) {
    btn.classList.add('connecting');
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> CONNECTING...';
    setTimeout(function() {
      btn.classList.remove('connecting');
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg> CONNECT KE SERVER';
    }, 2500);
  }
}

function showConnectHint(msg, type) {
  var hint = document.getElementById('hero-connect-hint');
  if (!hint) return;
  hint.textContent = msg;
  hint.className = 'hero-connect-hint show ' + (type || '');
  setTimeout(function() { hint.className = 'hero-connect-hint'; }, 4000);
}

/* ── Event Listeners (replaces inline onclick) ── */
document.addEventListener('DOMContentLoaded', function() {
  // Direct connect button
  var connectBtn = document.getElementById('hero-connect-btn');
  if (connectBtn) {
    connectBtn.addEventListener('click', heroDirectConnect);
  }

  // Refresh status button
  var refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function() {
      if (typeof fetchServerStatus === 'function') fetchServerStatus();
    });
  }

  // Keyboard handler for IP copy box (accessibility)
  var ipBox = document.getElementById('hero-ip-box');
  if (ipBox) {
    ipBox.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        ipBox.click();
      }
    });
  }

  // Hide scroll hint on scroll
  var scrollHint = document.querySelector('.scroll-hint');
  if (scrollHint) {
    var scrollHintHidden = false;
    window.addEventListener('scroll', function() {
      if (!scrollHintHidden && window.scrollY > 100) {
        scrollHint.style.opacity = '0';
        scrollHint.style.pointerEvents = 'none';
        scrollHintHidden = true;
      }
    }, { passive: true });
  }

  // Nav dropdown toggle
  var dropdownToggle = document.querySelector('.nav-dropdown-toggle');
  if (dropdownToggle) {
    dropdownToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      var expanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', !expanded);
      this.closest('.nav-dropdown-wrap').classList.toggle('open');
    });
    // Close dropdown when clicking outside
    document.addEventListener('click', function() {
      var wrap = document.querySelector('.nav-dropdown-wrap.open');
      if (wrap) {
        wrap.classList.remove('open');
        wrap.querySelector('.nav-dropdown-toggle').setAttribute('aria-expanded', 'false');
      }
    });
  }
});
