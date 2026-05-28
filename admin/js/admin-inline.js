/* ================================================================
   admin-inline.js — Extracted from index.html inline <script>
   Cacheable, maintainable, cleaner HTML
================================================================ */

/* ── Password toggle ── */
function togglePw(inputId, btn) {
  var inp = document.getElementById(inputId);
  if (!inp) return;
  var isText = inp.type === 'text';
  inp.type = isText ? 'password' : 'text';
  btn.innerHTML = isText
    ? '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
    : '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
}

/* ── Auth tab switcher ── */
function switchAuthTab(tab) {
  var track    = document.getElementById('auth-slide-track');
  var pillLogin = document.getElementById('tab-pill-login');
  var pillReg   = document.getElementById('tab-pill-register');
  if (!track) return;
  if (tab === 'register') {
    track.classList.add('show-register');
    if (pillLogin) pillLogin.classList.remove('active');
    if (pillReg)   pillReg.classList.add('active');
  } else {
    track.classList.remove('show-register');
    if (pillLogin) pillLogin.classList.add('active');
    if (pillReg)   pillReg.classList.remove('active');
  }
  ['req-error','req-success','auth-error'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

/* ── Touch swipe untuk auth tabs ── */
(function() {
  var track = document.getElementById('auth-slide-track');
  if (!track) return;
  var sx = 0, sy = 0;
  track.addEventListener('touchstart', function(e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  track.addEventListener('touchend', function(e) {
    var dx = e.changedTouches[0].clientX - sx;
    var dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx) * 0.85) return;
    var isReg = track.classList.contains('show-register');
    if (dx < 0 && !isReg) switchAuthTab('register');
    if (dx > 0 &&  isReg) switchAuthTab('login');
  }, { passive: true });
})();

/* ── Finance V2 period helper ── */
window.fv2SetPeriod = function(p, btn) {
  var inp = document.getElementById('fv2-period');
  if (inp) inp.value = p;
  document.querySelectorAll('.fv2-period-btn').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  if (typeof window.financeV2Init === 'function') window.financeV2Init();
};

/* ── Finance V2 tab helper ── */
window.fv2SwitchTab = function(tab, btn) {
  document.querySelectorAll('.fv2-tab').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.fv2-tab-panel').forEach(function(p) { p.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  var panel = document.getElementById('fv2-panel-' + tab);
  if (panel) panel.classList.add('active');
  if (tab === 'cashflow' && typeof window.financeV2LoadCashflow === 'function') {
    window.financeV2LoadCashflow();
  }
};

/* ── ordersRefresh ── */
window.ordersRefresh = function() {
  if (typeof window.ordersLoad === 'function') window.ordersLoad();
};

/* ── Set default bulan finance ── */
document.addEventListener('DOMContentLoaded', function() {
  var monthEl = document.getElementById('finance-month');
  if (monthEl) {
    var now = new Date();
    monthEl.value = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  }
});
