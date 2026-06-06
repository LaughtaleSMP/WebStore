// admin-glyph-manager.js — Multi-Range Glyph Sheet Manager
// Each Unicode range (E7, E8, E9...) maps to its own spritesheet PNG.
// Exposes window.glyphManager for use by Mimi Inka, Recovery Data, and the Glyph Sheets page.

(function () {
  'use strict';

  var LS_KEY = 'glyph_sheets_v2';
  // Default paths per range (served as static assets)
  var DEFAULTS = { 'E7': 'assets/glyph_E7.png' };

  var DISPLAY = 20, TILE = 144;
  var DEFAULT_BG_SIZE = Math.round(2304 * (DISPLAY / TILE));

  /* ── Storage ── */
  function _load() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function _save(data) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (e) {}
  }

  /* ── Public: get all sheets as { rangeHex: src } ── */
  function getSheets() {
    var stored = _load();
    var result = {};
    // Defaults first
    Object.keys(DEFAULTS).forEach(function (r) {
      result[r] = stored[r] ? stored[r].dataUrl : DEFAULTS[r];
    });
    // Custom ranges
    Object.keys(stored).forEach(function (r) {
      if (!result[r]) result[r] = stored[r].dataUrl;
    });
    return result;
  }

  /* ── Public: get one sheet for a codepoint ── */
  function getSheetSrc(cp) {
    var rangeHex = (cp >> 8).toString(16).toUpperCase(); // e.g. 0xE7AB >> 8 = 0xE7 → 'E7'
    var sheets = getSheets();
    return sheets[rangeHex] || null;
  }

  /* ── Public: get sheet info for rendering ── */
  function getSheet(rangeHex) {
    var sheets = getSheets();
    var src = sheets[rangeHex] || null;
    if (!src) return null;
    return { src: src, bgSize: DEFAULT_BG_SIZE };
  }

  /* ── Public: detect all ranges used in a string ── */
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

  /* ── CRUD ── */
  function setSheet(rangeHex, label, dataUrl) {
    var data = _load();
    data[rangeHex] = { label: label, dataUrl: dataUrl, addedAt: Date.now() };
    _save(data);
    _notify();
  }
  function removeSheet(rangeHex) {
    var data = _load();
    delete data[rangeHex];
    _save(data);
    _notify();
  }
  function getSheetMeta(rangeHex) {
    var data = _load();
    return data[rangeHex] || null;
  }
  function listCustomRanges() {
    return Object.keys(_load()).sort();
  }

  /* ── Notify subscribers ── */
  var _subs = [];
  function subscribe(fn) { _subs.push(fn); }
  function _notify() { _subs.forEach(function (fn) { try { fn(); } catch (e) {} }); }

  /* ── Public API ── */
  window.glyphManager = {
    getSheets: getSheets,
    getSheet: getSheet,
    getSheetSrc: getSheetSrc,
    detectRanges: detectRanges,
    setSheet: setSheet,
    removeSheet: removeSheet,
    getSheetMeta: getSheetMeta,
    listCustomRanges: listCustomRanges,
    subscribe: subscribe,
    DISPLAY: DISPLAY,
    TILE: TILE,
    DEFAULT_BG_SIZE: DEFAULT_BG_SIZE
  };

})();
