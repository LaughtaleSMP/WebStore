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

  if (!panel || !msgList) return;

  // ── State ──
  var messages = [], lastId = 0, lastSendTs = 0;
  var pollTimer = null, isOpen = false;
  var verifiedName = null, verifyPollId = null, verifyRowId = null;
  var _pendingGt = null;
  var _isResetMode = false;
  var _loginAttempts = 0, _loginCooldownUntil = 0;

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
  //  PANEL TOGGLE
  // ══════════════════════════════════════════
  header.addEventListener('click', function () {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    if (isOpen) { _fetchAll(); _startPoll(); _scroll(); }
    else _stopPoll();
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

  function _refreshVerified() {
    fetch(ACCT + '?select=gamertag', { headers: _hdr })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        var fresh = {};
        for (var i = 0; i < rows.length; i++) {
          if (rows[i].gamertag) fresh[rows[i].gamertag] = true;
        }
        _verifiedNames = fresh;
      }).catch(function () {});
  }
  _refreshVerified();
  setInterval(_refreshVerified, 60000); // refresh every 60s

  // ══════════════════════════════════════════
  //  FETCH / POLL MESSAGES
  // ══════════════════════════════════════════
  function _fetchAll() {
    _setStatus('polling');
    var since = new Date(Date.now() - MSG_WINDOW_MS).toISOString();
    fetch(EP + '?created_at=gte.' + since + '&order=id.asc', { headers: _hdr })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        if (!rows) return;
        messages = rows;
        lastId = rows.length ? rows[rows.length - 1].id : 0;
        _renderAll(); _scroll(); _setStatus('connected');
      }).catch(function () { _setStatus('offline'); });
  }

  function _pollNew() {
    if (!isOpen) return;
    var url = EP + '?order=id.asc&limit=20';
    if (lastId > 0) url += '&id=gt.' + lastId;
    fetch(url, { headers: _hdr })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        if (!rows || !rows.length) return;
        _addMsgs(rows);
        if (msgList.scrollHeight - msgList.scrollTop - msgList.clientHeight < 60) _scroll();
        _setStatus('connected');
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
    var isVerified = _verifiedNames[m.player_name] === true;
    var verifyBadge = isVerified ? '<span class="lc-verified" title="Verified"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" width="9" height="9"><polyline points="20 6 9 17 4 12"/></svg></span>' : '';

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
    el.className = 'lc-msg';
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
    var frag = document.createDocumentFragment();
    for (var i = 0; i < rows.length; i++) frag.appendChild(_buildMsg(rows[i]));
    msgList.appendChild(frag);
    while (msgList.children.length > DOM_CAP) msgList.removeChild(msgList.firstChild);
  }

  function _scroll() { setTimeout(function () { msgList.scrollTop = msgList.scrollHeight; }, 50); }
  function _updateCount() { if (countEl) countEl.textContent = messages.length; }
  function _setStatus(s) {
    if (!statusDot || !statusTxt) return;
    statusDot.className = 'lc-status-dot ' + s;
    statusTxt.textContent = ({ connected:'Terhubung', polling:'Polling...', offline:'Offline' })[s] || s;
  }

  if (location.hash === '#chat') { isOpen = true; panel.classList.add('open'); _fetchAll(); _startPoll(); }
  console.log('[LiveChat] v2 initialized (accounts, 10s poll)');
})();
