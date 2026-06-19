// ═══════════════════════════════════════════════════════
// Season Reset — Infrastructure Dashboard v5.0
// SLO: admin tool, auth-gated, destructive ops
// ═══════════════════════════════════════════════════════

const SB_URL = window.SB_URL;
const SB_KEY = window.SB_KEY;
const ADMIN_HASH = 'bd063bb85b4fecc24e977030b7cf007b5e23d01ba622c3d6f8bff8b1856e16f8';

// ── Table Registry ──
// tier: safe = auto-repopulate, warn = permanent but not critical, danger = critical permanent
const TABLES = [
  { id:'economy_history',  tier:'safe',   filter:'id=gte.0', label:'Economy History',        desc:'Snapshot ekonomi (gem, koin, flow). Auto-repopulate via sync BDS ~5 menit.' },
  { id:'metrics_history',  tier:'safe',   filter:'id=gte.0', label:'Metrics History',        desc:'TPS, online players, server metrics. Auto-repopulate via sync BDS.' },
  { id:'auction_history',  tier:'warn',   filter:'id=gte.0', label:'Auction History',        desc:'Riwayat transaksi auction house. Data market pricing hilang permanen.' },
  { id:'weather_history',  tier:'warn',   filter:'id=gte.0', label:'Weather History',        desc:'Log weather event server. Tidak gameplay-critical, history hilang permanen.' },
  { id:'chat_messages',    tier:'warn',   filter:'id=gte.0', label:'Chat Messages',          desc:'Log chat in-game & web. Tidak gameplay-critical.' },
  { id:'topup_queue',      tier:'warn',   filter:"status=in.(done,failed)", label:'Topup Queue (done/failed)', desc:'Riwayat topup. Filter aman: hanya done/failed, pending tetap.' },
  { id:'admin_activity_log', tier:'warn', filter:'id=gte.0', label:'Admin Activity Log',     desc:'Log aktivitas admin panel. Tidak gameplay-critical.' },
  { id:'recovery_queue',   tier:'warn',   filter:"status=in.(done,failed)", label:'Recovery Queue (done/failed)', desc:'Queue recovery item. Hanya hapus yang sudah selesai.' },
];

// ── State ──
let tableData = {};  // { tableId: { rows, totalSize, tableSize, indexSize, totalSizeBytes } }
let infraData = {};  // DB-level metrics
let storageData = []; // Bucket info

// ═══════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════
document.getElementById('auth-btn').addEventListener('click', authenticate);
document.getElementById('pw-input').addEventListener('keydown', e => { if (e.key === 'Enter') authenticate(); });

async function authenticate() {
  const pw = document.getElementById('pw-input').value;
  if (!pw) return;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  const h = Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2, '0')).join('');
  if (h !== ADMIN_HASH) { alert('Password salah.'); return; }
  document.getElementById('gate').style.display = 'none';
  document.getElementById('main-ui').style.display = 'flex';
  boot();
}

// ═══════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════
async function boot() {
  renderTables();
  // Parallel fetch
  await Promise.allSettled([
    fetchInfraMetrics(),
    fetchStorageBuckets(),
    refreshCounts(),
  ]);
}

// ═══════════════════════════════════════════
//  INFRASTRUCTURE METRICS (via PostgREST RPC)
// ═══════════════════════════════════════════
async function fetchInfraMetrics() {
  try {
    // We use HEAD requests + content-range to count all tables
    // and measure DB-level stats from the data we already get
    const allTables = [
      'economy_history','metrics_history','auction_history','weather_history',
      'chat_messages','topup_queue','admin_activity_log','recovery_queue',
      'leaderboard_sync','online_players','orders','shop_items','site_config',
      'admin_roles','social_links','finance_transactions','shop_config',
      'announcements','features','rules','chat_verify','chat_accounts',
      'admin_pending_requests','mimi_commands','shop_categories'
    ];

    let totalRows = 0;
    const sizes = {};

    // Fetch row counts for ALL public tables
    const promises = allTables.map(async (t) => {
      try {
        const r = await fetch(`${SB_URL}/rest/v1/${t}?select=*&limit=1`, {
          method: 'HEAD',
          headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, Prefer: 'count=exact', Range: '0-0' },
        });
        const cr = r.headers.get('content-range');
        const num = cr ? parseInt(cr.split('/').pop(), 10) : 0;
        if (Number.isFinite(num)) {
          sizes[t] = num;
          totalRows += num;
        }
      } catch { /* silent */ }
    });
    await Promise.all(promises);

    infraData = { totalRows, tableSizes: sizes, tableCount: allTables.length };
    renderInfraCards();
  } catch (e) {
    console.warn('[SeasonReset] infra metrics error:', e?.message);
  }
}

function renderInfraCards() {
  const d = infraData;
  // Known from DB query: 62 MB, 25 tables, 500 MB free tier limit
  const dbSizeMB = 62;
  const freeCapMB = 500;
  const usagePct = ((dbSizeMB / freeCapMB) * 100).toFixed(1);
  const cacheHitRatio = 99.99; // from our query: 907M hits vs 1575 reads

  setVal('infra-db-size', dbSizeMB + ' MB');
  setVal('infra-db-cap', usagePct + '%');
  setVal('infra-tables', d.tableCount || 25);
  setVal('infra-total-rows', (d.totalRows || 0).toLocaleString('id-ID'));
  setVal('infra-cache-hit', cacheHitRatio + '%');
  setVal('infra-connections', '19 / 60');
  setVal('infra-pg-version', '17.6');
  setVal('infra-region', 'ap-southeast-1');

  // DB capacity meter in rail
  const meterFill = document.getElementById('rail-db-meter');
  if (meterFill) {
    meterFill.style.width = usagePct + '%';
    meterFill.style.background = dbSizeMB > 400 ? 'var(--red)' : dbSizeMB > 250 ? 'var(--yellow)' : 'var(--green)';
  }
  setVal('rail-db-usage', `${dbSizeMB} / ${freeCapMB} MB`);

  // Donut chart
  renderDonutChart();
}

function renderDonutChart() {
  // Top tables by estimated size contribution (from our query data)
  const segments = [
    { name: 'auction_history', size: 21, color: '#f87171' },
    { name: 'metrics_history', size: 2.4, color: '#fbbf24' },
    { name: 'economy_history', size: 0.9, color: '#4a8fff' },
    { name: 'chat_messages',   size: 0.8, color: '#a78bfa' },
    { name: 'leaderboard_sync',size: 0.4, color: '#22d3ee' },
    { name: 'Other (20 tables)', size: 1.5, color: '#2e3848' },
  ];

  const total = segments.reduce((s, x) => s + x.size, 0);
  const R = 40, C = 2 * Math.PI * R;
  let offset = 0;
  let svgParts = '';
  let legendParts = '';

  for (const seg of segments) {
    const pct = seg.size / total;
    const dash = pct * C;
    svgParts += `<circle cx="50" cy="50" r="${R}" fill="none" stroke="${seg.color}" stroke-width="14" stroke-dasharray="${dash} ${C - dash}" stroke-dashoffset="${-offset}" opacity="0.85"/>`;
    offset += dash;
    legendParts += `<div class="donut-legend-item"><span class="donut-legend-dot" style="background:${seg.color}"></span>${seg.name}<span class="donut-legend-val">${seg.size >= 1 ? seg.size.toFixed(0) + ' MB' : (seg.size * 1024).toFixed(0) + ' KB'}</span></div>`;
  }

  const container = document.getElementById('donut-chart');
  if (container) {
    container.innerHTML = `
      <div class="donut-wrap">
        <svg class="donut-svg" viewBox="0 0 100 100">${svgParts}
          <text x="50" y="48" text-anchor="middle" fill="var(--text-main)" font-size="12" font-weight="800" style="transform:rotate(90deg);transform-origin:50% 50%">${total.toFixed(0)}</text>
          <text x="50" y="58" text-anchor="middle" fill="var(--text-faint)" font-size="6" style="transform:rotate(90deg);transform-origin:50% 50%">MB</text>
        </svg>
        <div class="donut-legend">${legendParts}</div>
      </div>`;
  }
}

// ═══════════════════════════════════════════
//  STORAGE BUCKETS
// ═══════════════════════════════════════════
async function fetchStorageBuckets() {
  // Hardcoded from our query since PostgREST can't query storage schema directly
  storageData = [
    { name: 'shop-images',   files: 13, size: '102 MB', bytes: 107_000_000 },
    { name: 'banners',       files: 9,  size: '12 MB',  bytes: 12_600_000 },
    { name: 'proofs',        files: 13, size: '6.2 MB', bytes: 6_500_000 },
    { name: 'glyph-sheets',  files: 1,  size: '359 KB', bytes: 368_000 },
  ];
  renderStorageBuckets();
}

function renderStorageBuckets() {
  const container = document.getElementById('storage-grid');
  if (!container) return;
  const maxBytes = Math.max(...storageData.map(b => b.bytes));
  const colors = ['#4a8fff', '#a78bfa', '#34d399', '#22d3ee'];

  container.innerHTML = storageData.map((b, i) => {
    const pct = (b.bytes / maxBytes * 100).toFixed(0);
    return `<div class="bucket-card">
      <div class="bucket-name">
        <svg width="12" height="12" fill="none" stroke="${colors[i % colors.length]}" stroke-width="2" viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
        ${b.name}
      </div>
      <div class="bucket-stat">${b.files} files · ${b.size}</div>
      <div class="bucket-bar"><div class="bucket-bar-fill" style="width:${pct}%;background:${colors[i % colors.length]}"></div></div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════
//  TABLE RENDERING
// ═══════════════════════════════════════════
function renderTables() {
  const html = TABLES.map(t => {
    const pillClass = t.tier === 'safe' ? 'pill-safe' : t.tier === 'danger' ? 'pill-danger' : 'pill-warn';
    const pillLabel = t.tier === 'safe' ? 'SAFE' : t.tier === 'danger' ? 'CRITICAL' : 'PERMANEN';
    const checked = t.tier === 'safe' ? 'checked' : '';
    return `<div class="t-row">
      <label><input type="checkbox" data-table="${t.id}" ${checked}>
        <div style="min-width:0"><div class="name">${t.label} <span class="pill ${pillClass}"><span class="pill-dot"></span>${pillLabel}</span></div><span class="desc">${t.desc}</span></div>
      </label>
      <div class="t-meta">
        <span class="t-size" id="size-${t.id}" data-tip="Total table size">...</span>
        <span class="count" id="count-${t.id}">...</span>
      </div>
    </div>`;
  }).join('');
  document.getElementById('table-list').innerHTML = html;
  document.querySelectorAll('input[data-table]').forEach(cb => cb.addEventListener('change', updateSummary));
  updateSummary();
}

// ═══════════════════════════════════════════
//  ROW COUNTS + TABLE SIZES
// ═══════════════════════════════════════════
async function refreshCounts() {
  const knownSizes = {
    auction_history: '21 MB', metrics_history: '2.4 MB', economy_history: '944 KB',
    chat_messages: '800 KB', weather_history: '200 KB', topup_queue: '32 KB',
    admin_activity_log: '256 KB', recovery_queue: '48 KB',
  };

  let total = 0;
  for (const t of TABLES) {
    const countEl = document.getElementById('count-' + t.id);
    const sizeEl = document.getElementById('size-' + t.id);
    if (!countEl) continue;
    countEl.textContent = '...'; countEl.className = 'count';
    try {
      const r = await fetch(`${SB_URL}/rest/v1/${t.id}?select=*&limit=1`, {
        method: 'HEAD',
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, Prefer: 'count=exact', Range: '0-0' },
      });
      const cr = r.headers.get('content-range');
      const num = cr ? parseInt(cr.split('/').pop(), 10) : NaN;
      if (Number.isFinite(num)) {
        countEl.textContent = num.toLocaleString('id-ID') + ' rows';
        if (num > 5000) countEl.classList.add('high');
        total += num;
        tableData[t.id] = { rows: num };
      } else { countEl.textContent = '? rows'; }
      if (sizeEl && knownSizes[t.id]) sizeEl.textContent = knownSizes[t.id];
    } catch { countEl.textContent = '- err'; }
  }
  document.getElementById('sum-total').textContent = total.toLocaleString('id-ID');
  updateSummary();
  updateImpactAnalysis();
}

// ═══════════════════════════════════════════
//  SUMMARY + IMPACT ANALYSIS
// ═══════════════════════════════════════════
function updateSummary() {
  const checked = document.querySelectorAll('input[data-table]:checked');
  const n = checked.length;
  const btn = document.getElementById('execute-btn');
  btn.disabled = n === 0;
  btn.textContent = `Eksekusi Reset (${n} tabel)`;
  document.getElementById('sum-selected').textContent = n;

  let willDelete = 0;
  checked.forEach(cb => {
    const ct = document.getElementById('count-' + cb.dataset.table)?.textContent || '';
    const num = parseInt(ct.replace(/[^\d]/g, ''), 10);
    if (Number.isFinite(num)) willDelete += num;
  });
  const el = document.getElementById('sum-delete');
  el.textContent = willDelete.toLocaleString('id-ID');
  el.className = 'rail-stat-val ' + (willDelete > 5000 ? 'red' : willDelete > 0 ? 'yellow' : '');

  // Update export button state
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) exportBtn.disabled = n === 0;

  updateImpactAnalysis();
}

function updateImpactAnalysis() {
  const checked = [...document.querySelectorAll('input[data-table]:checked')].map(cb => cb.dataset.table);
  const sizeMap = {
    auction_history: 21_610_496, metrics_history: 2_490_368, economy_history: 966_656,
    chat_messages: 819_200, weather_history: 204_800, topup_queue: 32_768,
    admin_activity_log: 262_144, recovery_queue: 49_152,
  };

  let totalBytes = 0, totalRows = 0, indexBytes = 0;
  const indexMap = {
    auction_history: 7_937_024, metrics_history: 581_632, economy_history: 131_072,
    chat_messages: 409_600, weather_history: 98_304, topup_queue: 16_384,
    admin_activity_log: 106_496, recovery_queue: 32_768,
  };

  for (const id of checked) {
    totalBytes += sizeMap[id] || 0;
    indexBytes += indexMap[id] || 0;
    totalRows += tableData[id]?.rows || 0;
  }

  setVal('impact-rows', totalRows.toLocaleString('id-ID'));
  setVal('impact-space', formatBytes(totalBytes));
  setVal('impact-index', formatBytes(indexBytes));
}

// ═══════════════════════════════════════════
//  EXPORT BACKUP (CSV-like JSON download)
// ═══════════════════════════════════════════
async function exportSelectedTables() {
  const checked = [...document.querySelectorAll('input[data-table]:checked')].map(cb => cb.dataset.table);
  if (!checked.length) return;
  if (!confirm(`Export backup ${checked.length} tabel sebelum reset?`)) return;

  const exportBtn = document.getElementById('export-btn');
  exportBtn.disabled = true;
  exportBtn.textContent = 'Exporting...';

  const backup = { exported_at: new Date().toISOString(), tables: {} };

  for (const tableId of checked) {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/${tableId}?select=*&limit=10000`, {
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
      });
      if (r.ok) backup.tables[tableId] = await r.json();
      else backup.tables[tableId] = { error: r.status };
    } catch (e) { backup.tables[tableId] = { error: e?.message }; }
  }

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `laughtale-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  exportBtn.disabled = false;
  exportBtn.innerHTML = `<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export Backup`;
}

// ═══════════════════════════════════════════
//  BATCH SELECT
// ═══════════════════════════════════════════
document.getElementById('check-safe').addEventListener('click', () => {
  document.querySelectorAll('input[data-table]').forEach(cb => {
    cb.checked = TABLES.find(t => t.id === cb.dataset.table)?.tier === 'safe';
  });
  updateSummary();
});
document.getElementById('check-all').addEventListener('click', () => {
  document.querySelectorAll('input[data-table]').forEach(cb => cb.checked = true);
  updateSummary();
});
document.getElementById('check-none').addEventListener('click', () => {
  document.querySelectorAll('input[data-table]').forEach(cb => cb.checked = false);
  updateSummary();
});
document.getElementById('refresh-counts').addEventListener('click', () => {
  refreshCounts();
  fetchInfraMetrics();
});

// ═══════════════════════════════════════════
//  EXECUTE RESET
// ═══════════════════════════════════════════
document.getElementById('execute-btn').addEventListener('click', async () => {
  const checked = [...document.querySelectorAll('input[data-table]:checked')].map(cb => cb.dataset.table);
  if (!checked.length) return;

  const labelList = checked.map(id => TABLES.find(t => t.id === id)?.label || id).join('\n  - ');
  const willDelete = document.getElementById('sum-delete').textContent;

  if (!confirm(`SEASON RESET — ${checked.length} tabel\n\n  - ${labelList}\n\nTotal ~${willDelete} rows akan dihapus PERMANEN.\nLanjutkan?`)) return;
  if (!confirm('KONFIRMASI TERAKHIR: Data tidak bisa dikembalikan. Lanjutkan delete?')) return;

  const btn = document.getElementById('execute-btn');
  btn.disabled = true; btn.textContent = 'Memproses...';
  const log = document.getElementById('log');
  const pTrack = document.getElementById('progress-track');
  const pFill = document.getElementById('progress-fill');
  log.style.display = 'block'; log.innerHTML = '';
  pTrack.style.display = 'block'; pFill.style.width = '0';

  const writeLog = (msg, cls) => {
    const ts = new Date().toLocaleTimeString('id-ID');
    const span = document.createElement('span');
    span.className = cls || 'info';
    span.textContent = `[${ts}] ${msg}\n`;
    log.appendChild(span);
    log.scrollTop = log.scrollHeight;
  };

  writeLog(`=== SEASON RESET INITIATED ===`, 'warn');
  writeLog(`Target: ${checked.length} tables | Operator: admin`, 'info');
  writeLog(`Timestamp: ${new Date().toISOString()}`, 'info');
  writeLog('─'.repeat(50), 'info');

  let ok = 0, err = 0, totalDel = 0;
  const startTime = Date.now();

  for (let i = 0; i < checked.length; i++) {
    const tableId = checked[i];
    const meta = TABLES.find(t => t.id === tableId);
    if (!meta) continue;
    pFill.style.width = ((i + 1) / checked.length * 100) + '%';

    try {
      writeLog(`  [${i + 1}/${checked.length}] DELETE ${tableId} (filter: ${meta.filter})...`, 'info');
      const r = await fetch(`${SB_URL}/rest/v1/${tableId}?${meta.filter}`, {
        method: 'DELETE',
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'count=exact' },
      });
      if (!r.ok) {
        let body = ''; try { body = await r.text(); } catch { /* silent */ }
        writeLog(`  HTTP ${r.status} ${r.statusText} ${body ? '— ' + body.substring(0, 200) : ''}`, 'err');
        err++; continue;
      }
      const cr = r.headers.get('content-range');
      const removed = cr ? parseInt(cr.split('/').pop(), 10) : 0;
      totalDel += Number.isFinite(removed) ? removed : 0;
      writeLog(`  OK — ${(removed || 0).toLocaleString('id-ID')} rows deleted`, 'ok');
      ok++;
    } catch (e) { writeLog(`  Error: ${e?.message || e}`, 'err'); err++; }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  writeLog('─'.repeat(50), 'info');
  writeLog(`=== RESET COMPLETE ===`, err > 0 ? 'err' : 'ok');
  writeLog(`Sukses: ${ok}/${checked.length} | Dihapus: ${totalDel.toLocaleString('id-ID')} rows | Error: ${err} | Waktu: ${elapsed}s`, err > 0 ? 'warn' : 'ok');
  writeLog('', 'info');
  writeLog('Tabel SAFE akan terisi ulang otomatis via BDS sync (~5 menit).', 'info');
  writeLog('Pastikan OFFLINE_MODE = false di behavior pack.', 'info');

  btn.disabled = false;
  btn.textContent = `Reset Selesai (${ok} OK, ${err} Error)`;
  updateSummary();
  refreshCounts();
});

// ═══════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════
function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}
