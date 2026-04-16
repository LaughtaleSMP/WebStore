// admin-finance.js — Modul Keuangan Admin
// Digunakan oleh admin panel untuk manajemen keuangan

  /* ── Private Helpers ── */
  function _fmt(n) {
    return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');
  }
  function _fmtShort(n) {
    return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');
  }