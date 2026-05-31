/* ══════════════════════════════════════════════════════════════
   livechat.js — Live Chat panel for Server Monitor page
   v2: Persistent accounts (gamertag + 4-digit PIN)
   Flow A — Login:    gamertag + PIN → verified
   Flow B — Register: gamertag → code → type in game → set PIN → account created
   Security: SHA-256 PIN hash, rate-limit, XSS escape, input validation
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Constants ──
  var SB_URL   = 'https://jlxtnbnrirxhwuyqjlzw.supabase.co';
  var SB_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpseHRuYm5yaXJ4aHd1eXFqbHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NjYzOTAsImV4cCI6MjA5MTQ0MjM5MH0.MRhoVRDju41J8nWp4WTgiKOvxy7AgwGYH-el2zVsbWI';
  var EP       = SB_URL + '/rest/v1/chat_messages';
  var VERIFY   = SB_URL + '/rest/v1/chat_verify';
  var ACCT     = SB_URL + '/rest/v1/chat_accounts';

  var MSG_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
  var POLL_MS      = 10000;
  var RATE_MS      = 3000;
  var VERIFY_POLL  = 5000;
  var SESSION_KEY  = 'lc_session';
  var PENDING_KEY  = 'lc_pending';
  var SALT         = '_laughtale_chat_v2';
  var MAX_LOGIN_ATTEMPTS = 5;
  var LOGIN_COOLDOWN_MS  = 60000;

  // ── Helpers ──
  var _hdr = { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY };
  function _jHdr() { return { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' }; }
  function _esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function _time(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      var hh = String(d.getHours()).padStart(2, '0');
      var mm = String(d.getMinutes()).padStart(2, '0');
      var ss = String(d.getSeconds()).padStart(2, '0');
      return hh + ':' + mm + ':' + ss;
    } catch(e) { return ''; }
  }
  function _sanitize(s, max) { return String(s || '').replace(/[\x00-\x1f]/g, '').trim().substring(0, max || 20); }

  // Generate random session token (64 hex chars)
  function _genToken() {
    var arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    var hex = '';
    for (var i = 0; i < arr.length; i++) hex += ('0' + arr[i].toString(16)).slice(-2);
    return hex;
  }

  // Save session to both localStorage and Supabase
  function _saveSession(gt, token) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ name: gt, token: token, ts: Date.now() }));
    // Also save gamertag for quick re-login
    try { localStorage.setItem('lc_gt', gt); } catch(e) {}
    fetch(ACCT + '?gamertag=eq.' + encodeURIComponent(gt), {
      method: 'PATCH', headers: _jHdr(),
      body: JSON.stringify({ session_token: token, last_login: new Date().toISOString() })
    }).catch(function () {});
  }

  // SHA-256 hash (Web Crypto API)
  function _hash(pin) {
    var data = new TextEncoder().encode(pin + SALT);
    return crypto.subtle.digest('SHA-256', data).then(function (buf) {
      var arr = new Uint8Array(buf); var hex = '';
      for (var i = 0; i < arr.length; i++) hex += ('0' + arr[i].toString(16)).slice(-2);
      return hex;
    });
  }

  // ── DOM refs ──
  var panel      = document.getElementById('lc-panel');
  var header     = document.getElementById('lc-header');
  var msgList    = document.getElementById('lc-messages');
  var countEl    = document.getElementById('lc-count');
  var statusDot  = document.getElementById('lc-status-dot');
  var statusTxt  = document.getElementById('lc-status-text');
  // Auth
  var authGate   = document.getElementById('lc-auth-gate');
  var loginForm  = document.getElementById('lc-login-form');
  var regForm    = document.getElementById('lc-reg-form');
  var codeWrap   = document.getElementById('lc-code-wrap');
  var pinWrap    = document.getElementById('lc-pin-wrap');
  var authedWrap = document.getElementById('lc-authed-wrap');
  // Login
  var loginGt    = document.getElementById('lc-login-gt');
  var loginPin   = document.getElementById('lc-login-pin');
  var loginBtn   = document.getElementById('lc-login-btn');
  var loginErr   = document.getElementById('lc-login-error');
  var toRegBtn   = document.getElementById('lc-to-reg');
  // Register
  var regGt      = document.getElementById('lc-reg-gt');
  var regBtn     = document.getElementById('lc-reg-btn');
  var regErr     = document.getElementById('lc-reg-error');
  var toLoginBtn = document.getElementById('lc-to-login');
  // Code display
  var codeEl     = document.getElementById('lc-code-display');
  // PIN setup
  var pinIn1     = document.getElementById('lc-pin1');
  var pinIn2     = document.getElementById('lc-pin2');
  var pinBtn     = document.getElementById('lc-pin-btn');
  var pinErr     = document.getElementById('lc-pin-error');
  // Authed
  var userNameEl = document.getElementById('lc-user-name');
  var msgIn      = document.getElementById('lc-input');
  var sendBtn    = document.getElementById('lc-send');
  var logoutBtn  = document.getElementById('lc-logout-btn');
  // Reset PIN
  var resetForm  = document.getElementById('lc-reset-form');
  var resetGt    = document.getElementById('lc-reset-gt');
  var resetBtn   = document.getElementById('lc-reset-btn');
  var resetErr   = document.getElementById('lc-reset-error');
  var toResetBtn = document.getElementById('lc-to-reset');
  var toLoginFromReset = document.getElementById('lc-to-login-from-reset');
  // Fullscreen
  var fsBtn      = document.getElementById('lc-fullscreen-btn');
  var fsExpand   = document.getElementById('lc-fs-expand');
  var fsCompress = document.getElementById('lc-fs-compress');
  // Loading & scroll
  var loadingEl  = document.getElementById('lc-loading');
  var scrollWrap = document.getElementById('lc-scroll-wrap');
  var scrollBtn  = document.getElementById('lc-scroll-btn');
  var scrollNew  = document.getElementById('lc-scroll-new');

  if (!panel || !msgList) return;

  // ── State ──
  var messages = [], lastId = 0, lastSendTs = 0, _isFirstPoll = true;
  var pollTimer = null, isOpen = false, isFullscreen = false;
  var verifiedName = null, verifyPollId = null, verifyRowId = null;
  var _pendingGt = null;
  var _isResetMode = false;
  var _loginAttempts = 0, _loginCooldownUntil = 0;
  var _unseenCount = 0, _atBottom = true;

  // ══════════════════════════════════════════
  //  SESSION RESTORE — verify token against Supabase
  // ══════════════════════════════════════════
  (function _restoreSession() {
    try {
      var sess = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (sess && sess.name && sess.token && sess.ts && Date.now() - sess.ts < 7 * 86400000) {
        // Verify token against server
        fetch(ACCT + '?gamertag=eq.' + encodeURIComponent(sess.name) + '&session_token=eq.' + sess.token + '&select=gamertag', { headers: _hdr })
          .then(function (r) { return r.ok ? r.json() : []; })
          .then(function (rows) {
            if (rows && rows.length) {
              verifiedName = sess.name;
              _showAuthed(sess.name);
            } else {
              // Token invalid — clear and show auth gate
              localStorage.removeItem(SESSION_KEY);
              _restorePending();
            }
          }).catch(function () {
            // Network error — trust local session temporarily
            verifiedName = sess.name;
            _showAuthed(sess.name);
          });
        return;
      }
    } catch (e) {}
    _restorePending();
  })();

  // Restore pending verification
  function _restorePending() {
    if (verifiedName) return;
    // Pre-fill gamertag from last login
    try {
      var savedGt = localStorage.getItem('lc_gt');
      if (savedGt && loginGt) loginGt.value = savedGt;
      if (savedGt && regGt) regGt.value = savedGt;
    } catch(e) {}
    try {
      var pend = JSON.parse(localStorage.getItem(PENDING_KEY));
      if (pend && pend.name && pend.code && pend.rowId && pend.ts && Date.now() - pend.ts < 86400000) {
        verifyRowId = pend.rowId;
        _pendingGt = pend.name;
        setTimeout(function () { _showCodeStep(pend.code, pend.name); }, 100);
      }
    } catch (e) {}
  }

  // ══════════════════════════════════════════
  //  FULLSCREEN
  // ══════════════════════════════════════════
  function _toggleFullscreen(e) {
    if (e) e.stopPropagation(); // don't trigger header collapse
    isFullscreen = !isFullscreen;
    panel.classList.toggle('lc-fullscreen', isFullscreen);
    document.body.classList.toggle('lc-fs-active', isFullscreen);
    if (fsExpand)   fsExpand.style.display   = isFullscreen ? 'none' : '';
    if (fsCompress) fsCompress.style.display = isFullscreen ? '' : 'none';
    // In fullscreen, auto-open if not already
    if (isFullscreen && !isOpen) {
      isOpen = true;
      panel.classList.add('open');
      _fetchAll(); _startPoll();
    }
    // Scroll to bottom after layout settles
    setTimeout(function () { msgList.scrollTop = msgList.scrollHeight; }, 80);
  }
  if (fsBtn) fsBtn.addEventListener('click', _toggleFullscreen);
  // ESC to exit fullscreen
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isFullscreen) _toggleFullscreen();
  });

  // ══════════════════════════════════════════
  //  SCROLL — unified handler (bottom check + load-older)
  // ══════════════════════════════════════════
  function _checkAtBottom() {
    var threshold = 80;
    _atBottom = msgList.scrollHeight - msgList.scrollTop - msgList.clientHeight < threshold;
    if (_atBottom) {
      _unseenCount = 0;
      if (scrollWrap) scrollWrap.style.display = 'none';
    } else {
      _showScrollBtn();
    }
  }
  function _showScrollBtn() {
    if (!scrollWrap) return;
    scrollWrap.style.display = '';
    // Badge: only show when there are unseen messages
    if (scrollNew) {
      if (_unseenCount > 0) {
        var num = _unseenCount > 99 ? '99+' : String(_unseenCount);
        scrollNew.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" style="display:block;"><circle cx="12" cy="12" r="11" fill="#a855f7" stroke="rgba(0,0,0,0.5)" stroke-width="2"/><text x="12" y="12" dy=".35em" text-anchor="middle" fill="#ffffff" font-family="system-ui, sans-serif" font-size="' + (num.length > 2 ? '9px' : '13px') + '" font-weight="800">' + num + '</text></svg>';
        scrollNew.style.display = '';
      } else {
        scrollNew.style.display = 'none';
      }
    }
  }
  function _onScroll() {
    _checkAtBottom();
    if (msgList.scrollTop < 40 && !_loadingOlder && !_noMoreOlder) {
      _loadOlder();
    }
  }
  msgList.addEventListener('scroll', _onScroll, { passive: true });
  if (scrollBtn) {
    scrollBtn.addEventListener('click', function () {
      _unseenCount = 0;
      if (scrollNew) scrollNew.style.display = 'none';
      msgList.scrollTo({ top: msgList.scrollHeight, behavior: 'smooth' });
      if (scrollWrap) scrollWrap.style.display = 'none';
    });
  }

  // ══════════════════════════════════════════
  //  PANEL TOGGLE
  // ══════════════════════════════════════════
  header.addEventListener('click', function () {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    if (isOpen) {
      _fetchAll();
    } else {
      // Exit fullscreen if closing panel
      if (isFullscreen) {
        isFullscreen = false;
        panel.classList.remove('lc-fullscreen');
        document.body.classList.remove('lc-fs-active');
        if (fsExpand)   fsExpand.style.display   = '';
        if (fsCompress) fsCompress.style.display = 'none';
      }
    }
  });

  // ══════════════════════════════════════════
  //  AUTH GATE → show login form
  // ══════════════════════════════════════════
  if (authGate) {
    authGate.style.cursor = 'pointer';
    authGate.addEventListener('click', function () {
      _hideAll();
      if (loginForm) loginForm.style.display = '';
    });
  }

  // Tab switch: Login ↔ Register
  if (toRegBtn) toRegBtn.addEventListener('click', function (e) {
    e.preventDefault(); _hideAll(); if (regForm) regForm.style.display = '';
  });
  if (toLoginBtn) toLoginBtn.addEventListener('click', function (e) {
    e.preventDefault(); _hideAll(); if (loginForm) loginForm.style.display = '';
  });
  if (toResetBtn) toResetBtn.addEventListener('click', function (e) {
    e.preventDefault(); _hideAll(); if (resetForm) resetForm.style.display = '';
  });
  if (toLoginFromReset) toLoginFromReset.addEventListener('click', function (e) {
    e.preventDefault(); _hideAll(); if (loginForm) loginForm.style.display = '';
  });

  // ── Close (X) buttons — dismiss form, show auth gate ──
  function _dismissForm() {
    _hideAll();
    if (authGate) authGate.style.display = '';
  }
  var loginCloseBtn = document.getElementById('lc-login-close');
  var resetCloseBtn = document.getElementById('lc-reset-close');
  var regCloseBtn   = document.getElementById('lc-reg-close');
  if (loginCloseBtn) loginCloseBtn.addEventListener('click', _dismissForm);
  if (resetCloseBtn) resetCloseBtn.addEventListener('click', _dismissForm);
  if (regCloseBtn)   regCloseBtn.addEventListener('click', _dismissForm);

  // ══════════════════════════════════════════
  //  LOGIN (gamertag + PIN)
  // ══════════════════════════════════════════
  if (loginBtn) loginBtn.addEventListener('click', _doLogin);
  if (loginPin) loginPin.addEventListener('keydown', function (e) { if (e.key === 'Enter') _doLogin(); });

  function _doLogin() {
    // Rate limit
    if (Date.now() < _loginCooldownUntil) {
      _showErr(loginErr, 'Terlalu banyak percobaan. Tunggu 1 menit.'); return;
    }
    var gt = _sanitize(loginGt?.value, 20);
    var pin = (loginPin?.value || '').trim();
    if (!gt) { loginGt?.focus(); return; }
    if (!/^\d{4}$/.test(pin)) { _showErr(loginErr, 'PIN harus 4 digit angka'); return; }

    _hideErr(loginErr);
    loginBtn.disabled = true;
    loginBtn.textContent = '...';

    var pinHash;
    _hash(pin).then(function (h) {
      pinHash = h;
      return fetch(ACCT + '?gamertag=eq.' + encodeURIComponent(gt) + '&select=pin_hash', { headers: _hdr });
    }).then(function (r) { return r.json(); })
      .then(function (rows) {
        if (!rows || !rows.length) { throw new Error('Akun tidak ditemukan. Daftar dulu.'); }
        if (rows[0].pin_hash !== pinHash) {
          _loginAttempts++;
          if (_loginAttempts >= MAX_LOGIN_ATTEMPTS) {
            _loginCooldownUntil = Date.now() + LOGIN_COOLDOWN_MS;
            _loginAttempts = 0;
          }
          throw new Error('PIN salah (' + (MAX_LOGIN_ATTEMPTS - _loginAttempts) + ' percobaan tersisa)');
        }
        // Success — generate session token and save to server + localStorage
        _loginAttempts = 0;
        verifiedName = gt;
        var token = _genToken();
        _saveSession(gt, token);
        _showAuthed(gt);
      }).catch(function (e) {
        _showErr(loginErr, e.message || 'Login gagal');
      }).finally(function () {
        loginBtn.disabled = false;
        loginBtn.textContent = 'MASUK';
      });
  }

  // ══════════════════════════════════════════
  //  REGISTER — Step 1: gamertag → code
  // ══════════════════════════════════════════
  if (regBtn) regBtn.addEventListener('click', _doRegister);
  if (regGt) regGt.addEventListener('keydown', function (e) { if (e.key === 'Enter') _doRegister(); });

  function _doRegister() {
    var gt = _sanitize(regGt?.value, 20);
    if (!gt) { regGt?.focus(); return; }

    _hideErr(regErr);
    regBtn.disabled = true;
    regBtn.textContent = '...';

    // Check if account already exists
    fetch(ACCT + '?gamertag=eq.' + encodeURIComponent(gt) + '&select=id', { headers: _hdr })
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        if (rows && rows.length) throw new Error('Gamertag "' + _esc(gt) + '" sudah terdaftar. Silakan login.');
        // Generate code
        var code = String(Math.floor(100000 + Math.random() * 900000));
        return fetch(VERIFY, {
          method: 'POST', headers: _jHdr(),
          body: JSON.stringify({ player_name: gt, code: code, verified: false })
        }).then(function (r) { return r.json(); }).then(function (vr) {
          if (!vr || !vr.length) throw new Error('Gagal buat kode. Coba lagi.');
          verifyRowId = vr[0].id;
          _pendingGt = gt;
          try { localStorage.setItem(PENDING_KEY, JSON.stringify({ name: gt, code: code, rowId: vr[0].id, ts: Date.now() })); } catch (e) {}
          _showCodeStep(code, gt);
        });
      }).catch(function (e) {
        _showErr(regErr, e.message || 'Error');
      }).finally(function () {
        regBtn.disabled = false;
        regBtn.textContent = 'VERIFIKASI';
      });
  }

  // ══════════════════════════════════════════
  //  REGISTER — Step 2: code shown, poll verify
  // ══════════════════════════════════════════
  function _showCodeStep(code, name) {
    _hideAll();
    if (codeWrap) codeWrap.style.display = '';
    if (codeEl) codeEl.textContent = code;
    var inlineEl = document.getElementById('lc-code-inline');
    if (inlineEl) inlineEl.textContent = code;
    _startVerifyPoll(name);
  }

  function _startVerifyPoll(name) {
    _stopVerifyPoll();
    verifyPollId = setInterval(function () {
      if (!verifyRowId) return;
      fetch(VERIFY + '?id=eq.' + verifyRowId + '&select=verified', { headers: _hdr })
        .then(function (r) { return r.json(); })
        .then(function (rows) {
          if (rows && rows.length && rows[0].verified === true) {
            _stopVerifyPoll();
            _pendingGt = name;
            // Show PIN setup
            _hideAll();
            if (pinWrap) pinWrap.style.display = '';
            if (pinBtn) pinBtn.textContent = _isResetMode ? 'SIMPAN PIN BARU' : 'BUAT AKUN';
            if (pinIn1) pinIn1.focus();
          }
        }).catch(function () {});
    }, VERIFY_POLL);
  }
  function _stopVerifyPoll() { if (verifyPollId) { clearInterval(verifyPollId); verifyPollId = null; } }

  // ══════════════════════════════════════════
  //  RESET PIN — re-verify gamertag → set new PIN
  // ══════════════════════════════════════════
  if (resetBtn) resetBtn.addEventListener('click', _doReset);
  if (resetGt) resetGt.addEventListener('keydown', function (e) { if (e.key === 'Enter') _doReset(); });

  function _doReset() {
    var gt = _sanitize(resetGt?.value, 20);
    if (!gt) { resetGt?.focus(); return; }

    _hideErr(resetErr);
    resetBtn.disabled = true;
    resetBtn.textContent = '...';

    // Check if account EXISTS (required for reset)
    fetch(ACCT + '?gamertag=eq.' + encodeURIComponent(gt) + '&select=id', { headers: _hdr })
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        if (!rows || !rows.length) throw new Error('Akun "' + _esc(gt) + '" tidak ditemukan.');
        // Generate verify code (same as register)
        var code = String(Math.floor(100000 + Math.random() * 900000));
        return fetch(VERIFY, {
          method: 'POST', headers: _jHdr(),
          body: JSON.stringify({ player_name: gt, code: code, verified: false })
        }).then(function (r) { return r.json(); }).then(function (vr) {
          if (!vr || !vr.length) throw new Error('Gagal buat kode. Coba lagi.');
          verifyRowId = vr[0].id;
          _pendingGt = gt;
          _isResetMode = true;
          try { localStorage.setItem(PENDING_KEY, JSON.stringify({ name: gt, code: code, rowId: vr[0].id, ts: Date.now() })); } catch (e) {}
          _showCodeStep(code, gt);
        });
      }).catch(function (e) {
        _showErr(resetErr, e.message || 'Error');
      }).finally(function () {
        resetBtn.disabled = false;
        resetBtn.textContent = 'RESET PIN';
      });
  }

  // ══════════════════════════════════════════
  //  REGISTER — Step 3: set PIN → create account
  // ══════════════════════════════════════════
  if (pinBtn) pinBtn.addEventListener('click', _doSetPin);
  if (pinIn2) pinIn2.addEventListener('keydown', function (e) { if (e.key === 'Enter') _doSetPin(); });

  function _doSetPin() {
    var p1 = (pinIn1?.value || '').trim();
    var p2 = (pinIn2?.value || '').trim();
    if (!/^\d{4}$/.test(p1)) { _showErr(pinErr, 'PIN harus 4 digit angka'); return; }
    if (p1 !== p2) { _showErr(pinErr, 'PIN tidak cocok'); return; }
    if (!_pendingGt) { _showErr(pinErr, 'Error: gamertag hilang. Ulangi.'); return; }

    _hideErr(pinErr);
    pinBtn.disabled = true;
    pinBtn.textContent = '...';

    var newToken = _genToken();
    _hash(p1).then(function (hash) {
      if (_isResetMode) {
        // PATCH existing account with new PIN
        return fetch(ACCT + '?gamertag=eq.' + encodeURIComponent(_pendingGt), {
          method: 'PATCH', headers: _jHdr(),
          body: JSON.stringify({ pin_hash: hash, session_token: newToken })
        });
      } else {
        // POST new account
        return fetch(ACCT, {
          method: 'POST', headers: _jHdr(),
          body: JSON.stringify({ gamertag: _pendingGt, pin_hash: hash, session_token: newToken })
        });
      }
    }).then(function (r) {
      if (!r.ok) throw new Error((_isResetMode ? 'Gagal reset PIN' : 'Gagal buat akun') + ' (HTTP ' + r.status + ')');
      return r.json();
    }).then(function () {
      verifiedName = _pendingGt;
      _saveSession(_pendingGt, newToken);
      try { localStorage.removeItem(PENDING_KEY); } catch (e) {}
      _isResetMode = false;
      _showAuthed(_pendingGt);
    }).catch(function (e) {
      _showErr(pinErr, e.message || 'Gagal');
    }).finally(function () {
      pinBtn.disabled = false;
      pinBtn.textContent = _isResetMode ? 'SIMPAN PIN BARU' : 'BUAT AKUN';
    });
  }

  // ══════════════════════════════════════════
  //  LOGOUT
  // ══════════════════════════════════════════
  if (logoutBtn) logoutBtn.addEventListener('click', function () {
    // Clear session token from Supabase
    if (verifiedName) {
      fetch(ACCT + '?gamertag=eq.' + encodeURIComponent(verifiedName), {
        method: 'PATCH', headers: _jHdr(),
        body: JSON.stringify({ session_token: null })
      }).catch(function () {});
    }
    verifiedName = null;
    _stopVerifyPoll();
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
    try { localStorage.removeItem(PENDING_KEY); } catch (e) {}
    _hideAll();
    if (authGate) authGate.style.display = '';
  });

  // ══════════════════════════════════════════
  //  UI HELPERS
  // ══════════════════════════════════════════
  function _hideAll() {
    [authGate, loginForm, regForm, codeWrap, pinWrap, authedWrap, resetForm].forEach(function (el) {
      if (el) el.style.display = 'none';
    });
  }
  function _showAuthed(name) {
    _hideAll();
    if (authedWrap) authedWrap.style.display = '';
    if (userNameEl) userNameEl.textContent = name;
  }
  function _showErr(el, msg) { if (el) { el.textContent = msg; el.style.display = ''; } }
  function _hideErr(el) { if (el) el.style.display = 'none'; }

  // ══════════════════════════════════════════
  //  SEND MESSAGE
  // ══════════════════════════════════════════
  function _sendMsg() {
    if (!verifiedName) return;
    var raw = (msgIn?.value || '').trim();
    if (!raw) { msgIn?.focus(); return; }
    var msg = _sanitize(raw, 200);
    if (!msg) return;
    if (Date.now() - lastSendTs < RATE_MS) return;

    sendBtn.disabled = true;
    lastSendTs = Date.now();

    fetch(EP, {
      method: 'POST', headers: _jHdr(),
      body: JSON.stringify({ source: 'web', player_name: verifiedName, message: msg })
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (rows) {
      if (rows && rows.length) { _addMsgs(rows); _scroll(); }
      msgIn.value = '';
    }).catch(function (e) {
      console.warn('[LiveChat] Send fail:', e);
    }).finally(function () {
      setTimeout(function () { sendBtn.disabled = false; }, RATE_MS);
    });
  }

  if (sendBtn) sendBtn.addEventListener('click', _sendMsg);
  if (msgIn) msgIn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _sendMsg(); }
  });

  // ══════════════════════════════════════════
  //  VERIFIED NAMES CACHE (for verified badge)
  // ══════════════════════════════════════════
  var _verifiedNames = {}; // gamertag → true
  var _supporterNames = {}; // gamertag → true

  function _refreshVerified() {
    fetch(ACCT + '?select=gamertag', { headers: _hdr })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        var fresh = {};
        for (var i = 0; i < rows.length; i++) {
          if (rows[i].gamertag) fresh[rows[i].gamertag.toLowerCase()] = true;
        }
        _verifiedNames = fresh;
        window._lcVerified = fresh;
      }).catch(function () {});

    // Fetch leaderboard_sync for topup_log and gacha_lb to grant Supporter Diamond badge
    fetch(SB_URL + '/rest/v1/leaderboard_sync?id=eq.current&select=topup_log,gacha_lb', { headers: _hdr })
      .then(function(r){ return r.ok ? r.json() : []; })
      .then(function(rows){
         if(!rows.length) return;
         var freshS = {};
         var row = rows[0];
         if (row.topup_log) {
             var logs = row.topup_log;
             if(typeof logs === 'string') { try { logs = JSON.parse(logs); } catch(e){ logs=[]; } }
             for(var i=0; i<logs.length; i++){ if(logs[i].t) freshS[logs[i].t.toLowerCase()] = true; }
         }
         if (row.gacha_lb) {
             var lb = row.gacha_lb;
             if(typeof lb === 'string') { try { lb = JSON.parse(lb); } catch(e){ lb={}; } }
             if(lb && lb.gem) {
                 for(var i=0; i<lb.gem.length; i++){
                     if(lb.gem[i].name && lb.gem[i].gem > 0) freshS[lb.gem[i].name.toLowerCase()] = true;
                 }
             }
         }
         _supporterNames = freshS;
         window._lcSupporters = freshS;
      }).catch(function(){});
  }
  _refreshVerified();
  setInterval(_refreshVerified, 60000); // refresh every 60s

  // ══════════════════════════════════════════
  //  FETCH / POLL MESSAGES  (reverse pagination)
  //  Open → load 50 newest → scroll to bottom (instant)
  //  Scroll up to top → lazy-load 50 older → keep position
  // ══════════════════════════════════════════
  var BATCH = 50;
  var _oldestId = 0;      // smallest loaded id (for older fetch)
  var _loadingOlder = false;
  var _noMoreOlder = false; // true when we hit 24h boundary

  function _fetchAll() {
    _setStatus('polling');
    if (loadingEl) loadingEl.style.display = 'flex';
    _noMoreOlder = false;
    _oldestId = 0;
    // Fetch latest BATCH messages (desc → reverse to asc for render)
    fetch(EP + '?order=id.desc&limit=' + BATCH, { headers: _hdr })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        if (loadingEl) loadingEl.style.display = 'none';
        if (!rows) rows = [];
        rows.reverse(); // oldest-first for rendering
        messages = rows;
        if (rows.length) {
          lastId = rows[rows.length - 1].id;
          _oldestId = rows[0].id;
        }
        if (rows.length < BATCH) _noMoreOlder = true;
        _renderAll();
        _scroll(); // jump to newest
        _setStatus('connected');
      }).catch(function () {
        if (loadingEl) loadingEl.style.display = 'none';
        _setStatus('offline');
      });
  }

  // ── Load older messages on scroll-to-top ──
  function _loadOlder() {
    if (_loadingOlder || _noMoreOlder || !_oldestId) return;
    _loadingOlder = true;
    _showTopLoader(true);
    var since = new Date(Date.now() - MSG_WINDOW_MS).toISOString();
    var url = EP + '?id=lt.' + _oldestId + '&created_at=gte.' + since +
              '&order=id.desc&limit=' + BATCH;
    fetch(url, { headers: _hdr })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        _loadingOlder = false;
        _showTopLoader(false);
        if (!rows || !rows.length) { _noMoreOlder = true; return; }
        rows.reverse(); // oldest-first
        if (rows.length < BATCH) _noMoreOlder = true;
        _oldestId = rows[0].id;
        // Prepend to messages array
        messages = rows.concat(messages);
        // Prepend to DOM (preserve scroll position)
        var prevHeight = msgList.scrollHeight;
        var frag = document.createDocumentFragment();
        for (var i = 0; i < rows.length; i++) frag.appendChild(_buildMsg(rows[i]));
        msgList.insertBefore(frag, msgList.firstChild);
        // Restore scroll so user stays in same position
        msgList.scrollTop = msgList.scrollHeight - prevHeight;
        _updateCount();
      }).catch(function () {
        _loadingOlder = false;
        _showTopLoader(false);
      });
  }


  // Inline top loader element
  var _topLoaderEl = null;
  function _showTopLoader(show) {
    if (show && !_topLoaderEl) {
      _topLoaderEl = document.createElement('div');
      _topLoaderEl.className = 'lc-top-loader';
      _topLoaderEl.innerHTML = '<div class="lc-skeleton lc-skeleton-med"></div><div class="lc-skeleton lc-skeleton-short"></div>';
      msgList.insertBefore(_topLoaderEl, msgList.firstChild);
    } else if (!show && _topLoaderEl) {
      _topLoaderEl.remove();
      _topLoaderEl = null;
    }
  }

  function _pollNew() {
    var url = EP + '?order=id.asc&limit=20';
    if (lastId > 0) url += '&id=gt.' + lastId;
    fetch(url, { headers: _hdr })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        if (!rows || !rows.length) {
          _isFirstPoll = false;
          return;
        }

        // Only show chat bubbles on the radar if it is NOT the first poll
        var gotNewMsg = false;
        if (!_isFirstPoll) {
          if (!window._lcRecentMessages) window._lcRecentMessages = {};
          for (var i = 0; i < rows.length; i++) {
            var rMsg = rows[i];
            var rNameKey = (rMsg.player_name || '').trim().toLowerCase();
            if (rMsg.source !== 'system' && rNameKey) {
              window._lcRecentMessages[rNameKey] = { msg: rMsg.message, time: Date.now() };
              gotNewMsg = true;
            }
          }
        }
        _isFirstPoll = false;

        if (isOpen) {
          _addMsgs(rows);
        } else {
          for (var i = 0; i < rows.length; i++) {
            if (rows[i].id > lastId) lastId = rows[i].id;
          }
        }
        _setStatus('connected');
        if (gotNewMsg && typeof drawRadar === 'function') {
          try { drawRadar(); } catch(e) {}
        }
      }).catch(function () { _setStatus('offline'); });
  }

  function _startPoll() { _stopPoll(); pollTimer = setInterval(_pollNew, POLL_MS); }
  function _stopPoll()  { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

  function _addMsgs(rows) {
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.id > lastId) lastId = r.id;
      var dup = false;
      for (var j = messages.length - 1; j >= Math.max(0, messages.length - 30); j--) {
        if (messages[j].id === r.id) { dup = true; break; }
      }
      if (!dup) messages.push(r);
    }
    _renderNew(rows); _updateCount();
  }

  // ══════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════
  var SVG_GAME = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4M8 10v4"/><circle cx="15" cy="11" r=".5" fill="currentColor"/><circle cx="17" cy="13" r=".5" fill="currentColor"/></svg>';
  var SVG_WEB  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z"/></svg>';
  var SVG_JOIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>';
  var SVG_LEAVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';
  var SVG_DEATH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="10" r="8"/><circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.5" fill="currentColor" stroke="none"/><path d="M8 14h8"/><path d="M10 14v3M14 14v3M12 14v3"/></svg>';

  function _getSysType(msg) {
    if (!msg) return 'death';
    if (msg.indexOf('bergabung') >= 0) return 'join';
    if (msg.indexOf('meninggalkan') >= 0) return 'leave';
    return 'death';
  }
  var _SYS_CFG = {
    join:  { svg: SVG_JOIN,  cls: 'lc-sys-join' },
    leave: { svg: SVG_LEAVE, cls: 'lc-sys-leave' },
    death: { svg: SVG_DEATH, cls: 'lc-sys-death' }
  };

  function _buildMsg(m) {
    var el = document.createElement('div');
    var isSupporter = _supporterNames[m.player_name] === true;
    var isVerified = _verifiedNames[m.player_name] === true;
    var verifyBadge = '';
    if (isSupporter) {
      verifyBadge = '<span class="lc-supporter" title="Supporter (Topup)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="10" height="10"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M6 3l6 6 6-6"/><path d="M2 9h20"/></svg></span>';
    } else if (isVerified) {
      verifyBadge = '<span class="lc-verified" title="Verified"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" width="9" height="9"><polyline points="20 6 9 17 4 12"/></svg></span>';
    }

    // System message (join/leave/death)
    if (m.source === 'system') {
      el.className = 'lc-msg lc-msg-sys';
      var t = _getSysType(m.message);
      var cfg = _SYS_CFG[t];
      el.innerHTML =
        '<span class="lc-sys-icon ' + cfg.cls + '">' + cfg.svg + '</span>' +
        '<span class="lc-sys-text"><b>' + _esc(m.player_name || '?') + '</b>' + verifyBadge + ' ' + _esc(m.message || '') + '</span>' +
        '<span class="lc-msg-time">' + _time(m.created_at) + '</span>';
      return el;
    }

    // Normal chat message
    el.className = 'lc-msg' + (isSupporter ? ' lc-bg-galaxy' : '');
    var g = m.source === 'game';
    el.innerHTML =
      '<span class="lc-src ' + (g ? 'lc-src-game' : 'lc-src-web') + '">' + (g ? SVG_GAME : SVG_WEB) + (g ? 'GAME' : 'WEB') + '</span>' +
      '<div class="lc-msg-body"><span class="lc-msg-name">' + _esc(m.player_name || '?') + verifyBadge + '</span><span class="lc-msg-text">' + _esc(m.message || '') + '</span></div>' +
      '<span class="lc-msg-time">' + _time(m.created_at) + '</span>';
    return el;
  }

  function _renderAll() {
    msgList.innerHTML = '';
    if (!messages.length) {
      msgList.innerHTML = '<div class="lc-empty"><svg class="lc-empty-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="4" y="4" width="40" height="30" rx="4"/><path d="M12 38l6-8h12l6 8"/><circle cx="16" cy="18" r="2" fill="currentColor" stroke="none" opacity=".3"/><circle cx="24" cy="18" r="2" fill="currentColor" stroke="none" opacity=".3"/><circle cx="32" cy="18" r="2" fill="currentColor" stroke="none" opacity=".3"/></svg><div class="lc-empty-text">Belum ada pesan</div><div class="lc-empty-sub">Pesan dari server game muncul di sini</div></div>';
      return;
    }
    var frag = document.createDocumentFragment();
    for (var i = 0; i < messages.length; i++) frag.appendChild(_buildMsg(messages[i]));
    msgList.appendChild(frag); _updateCount();
  }

  var DOM_CAP = 800; // cap DOM nodes for perf, data stays 24h

  function _renderNew(rows) {
    var empty = msgList.querySelector('.lc-empty'); if (empty) empty.remove();
    // Check scroll position BEFORE adding new content
    var wasAtBottom = msgList.scrollHeight - msgList.scrollTop - msgList.clientHeight < 80;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.source !== 'system' && r.player_name) {
        if (!window._lcRecentMessages) window._lcRecentMessages = {};
        var nameKey = (r.player_name || '').trim().toLowerCase();
        window._lcRecentMessages[nameKey] = { msg: r.message, time: Date.now() };
      }
      frag.appendChild(_buildMsg(r));
    }
    msgList.appendChild(frag);
    while (msgList.children.length > DOM_CAP) msgList.removeChild(msgList.firstChild);
    // Auto-scroll if was at bottom, else show 'new messages' button
    if (wasAtBottom) {
      msgList.scrollTo({ top: msgList.scrollHeight, behavior: 'smooth' });
    } else {
      _unseenCount += rows.length;
      _showScrollBtn();
    }
  }

  function _scroll() {
    setTimeout(function () {
      msgList.scrollTop = msgList.scrollHeight;
      _unseenCount = 0;
      if (scrollWrap) scrollWrap.style.display = 'none';
      if (scrollNew)  scrollNew.style.display  = 'none';
    }, 50);
  }
  function _updateCount() { if (countEl) countEl.textContent = messages.length; }
  function _setStatus(s) {
    if (!statusDot || !statusTxt) return;
    statusDot.className = 'lc-status-dot ' + s;
    statusTxt.textContent = ({ connected:'Terhubung', polling:'Polling...', offline:'Offline' })[s] || s;
  }

  // ── Pre-fetch count so badge shows before panel opens ──
  function _prefetchCount() {
    // Light query: get latest 50 (same as BATCH) to show realistic count
    fetch(EP + '?order=id.desc&limit=50&select=id', { headers: _hdr })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        if (rows && rows.length && countEl) {
          countEl.textContent = rows.length;
        }
      }).catch(function () {});
  }
  _prefetchCount();

  // Initialize lastId from Supabase latest message to avoid historical message flashes on load,
  // then start background polling.
  fetch(EP + '?order=id.desc&limit=1', { headers: _hdr })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (rows) {
      if (rows && rows.length) {
        lastId = rows[0].id;
      }
      _startPoll();
    }).catch(function () {
      _startPoll();
    });

  if (location.hash === '#chat') { isOpen = true; panel.classList.add('open'); _fetchAll(); }
  console.log('[LiveChat] v2 initialized (accounts, 10s background poll)');
})();
