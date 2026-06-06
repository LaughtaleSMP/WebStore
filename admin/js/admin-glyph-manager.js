// admin-glyph-manager.js — Multi-Range Glyph Sheet Manager
// Storage: Supabase Storage bucket "glyph-sheets" (permanent, cross-device)
// Fallback: localStorage for offline / before Supabase auth ready
// Exposes window.glyphManager for use by Mimi Inka, Recovery Data, and the Glyph Sheets page.

(function () {
  'use strict';

  var LS_KEY     = 'glyph_sheets_v3';   // local cache key
  var SB_BUCKET  = 'glyph-sheets';       // Supabase Storage bucket name
  var SB_TABLE   = 'glyph_sheet_meta';   // optional metadata table
  var DEFAULTS   = { 'E7': 'assets/glyph_E7.png' };

  var DISPLAY    = 20, TILE = 144;
  var DEFAULT_BG_SIZE = Math.round(2304 * (DISPLAY / TILE));

  /* ══════════════════════════════════════════
     LOCAL CACHE  (localStorage, fallback layer)
     ══════════════════════════════════════════ */
  function _lcLoad() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function _lcSave(data) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (e) {}
  }

  /* ══════════════════════════════════════════
     SUPABASE STORAGE HELPERS
     ══════════════════════════════════════════ */
  function _getSb() {
    return window._adminSb || null;
  }

  /** Convert dataURL → Blob for upload */
  function _dataUrlToBlob(dataUrl) {
    var arr  = dataUrl.split(',');
    var mime = arr[0].match(/:(.*?);/)[1];
    var bstr = atob(arr[1]);
    var n    = bstr.length;
    var u8   = new Uint8Array(n);
    for (var i = 0; i < n; i++) u8[i] = bstr.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }

  /**
   * Upload a glyph sheet PNG to Supabase Storage.
   * Returns the public URL on success, null on failure.
   * Also saves to localStorage as fallback.
   */
  async function _uploadToStorage(rangeHex, dataUrl) {
    var sb = _getSb();
    if (!sb) return null;

    try {
      var blob = _dataUrlToBlob(dataUrl);
      var path = 'ranges/' + rangeHex + '.png';

      // Upsert = overwrite if exists
      var { error: upErr } = await sb.storage
        .from(SB_BUCKET)
        .upload(path, blob, {
          contentType: 'image/png',
          upsert: true,
          cacheControl: '86400',
        });

      if (upErr) {
        console.warn('[GlyphManager] Storage upload error:', upErr.message);
        return null;
      }

      // Get public URL
      var { data: urlData } = sb.storage
        .from(SB_BUCKET)
        .getPublicUrl(path);

      return urlData ? urlData.publicUrl : null;
    } catch (e) {
      console.warn('[GlyphManager] Upload exception:', e.message);
      return null;
    }
  }

  /**
   * Delete a glyph sheet from Supabase Storage.
   */
  async function _deleteFromStorage(rangeHex) {
    var sb = _getSb();
    if (!sb) return;
    try {
      var path = 'ranges/' + rangeHex + '.png';
      await sb.storage.from(SB_BUCKET).remove([path]);
    } catch (e) {
      console.warn('[GlyphManager] Delete exception:', e.message);
    }
  }

  /**
   * Fetch all uploaded sheets from Supabase Storage.
   * Returns { rangeHex: publicUrl } map.
   */
  async function _fetchStorageSheets() {
    var sb = _getSb();
    if (!sb) return {};

    try {
      var { data: files, error } = await sb.storage
        .from(SB_BUCKET)
        .list('ranges', { limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } });

      if (error || !files) return {};

      var result = {};
      files.forEach(function (file) {
        // file.name = "E8.png" → range = "E8"
        var name = file.name.replace(/\.png$/i, '').toUpperCase();
        if (!name) return;
        var { data: urlData } = sb.storage
          .from(SB_BUCKET)
          .getPublicUrl('ranges/' + file.name);
        if (urlData && urlData.publicUrl) {
          result[name] = urlData.publicUrl + '?t=' + (file.updated_at || Date.now());
        }
      });
      return result;
    } catch (e) {
      console.warn('[GlyphManager] fetchStorageSheets exception:', e.message);
      return {};
    }
  }

  /* ══════════════════════════════════════════
     PUBLIC: getSheets — merged: Supabase + local
     ══════════════════════════════════════════ */
  function getSheets() {
    var stored = _lcLoad();
    var result = {};
    // Defaults first
    Object.keys(DEFAULTS).forEach(function (r) {
      result[r] = stored[r] ? (stored[r].publicUrl || stored[r].dataUrl || DEFAULTS[r]) : DEFAULTS[r];
    });
    // Custom ranges from localStorage cache
    Object.keys(stored).forEach(function (r) {
      if (!result[r]) {
        result[r] = stored[r].publicUrl || stored[r].dataUrl;
      }
    });
    return result;
  }

  function getSheetSrc(cp) {
    var rangeHex = (cp >> 8).toString(16).toUpperCase();
    var sheets   = getSheets();
    return sheets[rangeHex] || null;
  }

  function getSheet(rangeHex) {
    var sheets = getSheets();
    var src    = sheets[rangeHex] || null;
    if (!src) return null;
    return { src: src, bgSize: DEFAULT_BG_SIZE };
  }

  function detectRanges(text) {
    if (!text) return [];
    var clean = text.replace(/\u00a7[0-9a-fk-or]/gi, '');
    var seen = {};
    for (var i = 0; i < clean.length; i++) {
      var cp = clean.codePointAt(i);
      if (cp >= 0xE000 && cp <= 0xEFFF) {
        var r = (cp >> 8).toString(16).toUpperCase();
        seen[r] = true;
      }
      if (cp > 0xFFFF) i++;
    }
    return Object.keys(seen);
  }

  /* ══════════════════════════════════════════
     PUBLIC CRUD — async: upload to Supabase, save metadata locally
     ══════════════════════════════════════════ */

  /**
   * setSheet — uploads PNG to Supabase Storage + saves to localStorage cache.
   * Calls onProgress(state) with: 'uploading' | 'done' | 'error'
   */
  window.glyphManager_setSheetAsync = async function (rangeHex, label, dataUrl, onProgress) {
    // 1. Save to localStorage immediately (instant local preview)
    var data = _lcLoad();
    data[rangeHex] = {
      label:     label,
      dataUrl:   dataUrl,    // local preview while uploading
      publicUrl: null,       // will be filled after upload
      addedAt:   Date.now(),
      synced:    false,
    };
    _lcSave(data);
    _notify();

    if (onProgress) onProgress('uploading');

    // 2. Upload to Supabase Storage
    var publicUrl = await _uploadToStorage(rangeHex, dataUrl);
    if (publicUrl) {
      data = _lcLoad();
      if (data[rangeHex]) {
        data[rangeHex].publicUrl = publicUrl;
        data[rangeHex].synced   = true;
        // Remove heavy dataUrl from localStorage now that Supabase has it
        delete data[rangeHex].dataUrl;
      }
      _lcSave(data);
      _notify();
      if (onProgress) onProgress('done', publicUrl);
    } else {
      if (onProgress) onProgress('error');
    }

    return publicUrl;
  };

  /** Sync local data from Supabase Storage (call on app init / refresh) */
  window.glyphManager_syncFromStorage = async function () {
    var remote = await _fetchStorageSheets();
    if (!Object.keys(remote).length) return;

    var local = _lcLoad();
    Object.keys(remote).forEach(function (r) {
      if (!local[r]) {
        local[r] = { label: r, publicUrl: remote[r], synced: true, addedAt: Date.now() };
      } else {
        local[r].publicUrl = remote[r];
        local[r].synced    = true;
        // Remove stale dataUrl if we have a public URL now
        if (local[r].publicUrl) delete local[r].dataUrl;
      }
    });
    _lcSave(local);
    _notify();
  };

  function setSheet(rangeHex, label, dataUrl) {
    // Sync shorthand — for backwards compat (stores locally only, no upload)
    var data = _lcLoad();
    data[rangeHex] = { label: label, dataUrl: dataUrl, addedAt: Date.now(), synced: false };
    _lcSave(data);
    _notify();
  }

  function removeSheet(rangeHex) {
    var data = _lcLoad();
    delete data[rangeHex];
    _lcSave(data);
    _notify();
    // Fire-and-forget delete from storage
    _deleteFromStorage(rangeHex);
  }

  function getSheetMeta(rangeHex) {
    var data = _lcLoad();
    return data[rangeHex] || null;
  }

  function listCustomRanges() {
    return Object.keys(_lcLoad()).sort();
  }

  /* ══════════════════════════════════════════
     SUBSCRIBERS
     ══════════════════════════════════════════ */
  var _subs = [];
  function subscribe(fn) { _subs.push(fn); }
  function _notify() { _subs.forEach(function (fn) { try { fn(); } catch (e) {} }); }

  /* ══════════════════════════════════════════
     PUBLIC API
     ══════════════════════════════════════════ */
  window.glyphManager = {
    getSheets:         getSheets,
    getSheet:          getSheet,
    getSheetSrc:       getSheetSrc,
    detectRanges:      detectRanges,
    setSheet:          setSheet,
    removeSheet:       removeSheet,
    getSheetMeta:      getSheetMeta,
    listCustomRanges:  listCustomRanges,
    subscribe:         subscribe,
    DISPLAY:           DISPLAY,
    TILE:              TILE,
    DEFAULT_BG_SIZE:   DEFAULT_BG_SIZE,
  };

  // Auto-sync from Supabase Storage when Supabase is ready
  var _syncAttempted = false;
  function _trySyncOnReady() {
    if (_syncAttempted) return;
    var sb = _getSb();
    if (!sb) return;
    _syncAttempted = true;
    window.glyphManager_syncFromStorage().catch(function (e) {
      console.warn('[GlyphManager] Auto-sync failed:', e.message);
    });
  }

  // Try immediately, then poll until Supabase is ready
  _trySyncOnReady();
  var _readyPoll = setInterval(function () {
    if (_getSb()) { _trySyncOnReady(); clearInterval(_readyPoll); }
  }, 500);

})();
