// ═══════════════════════════════════════════════════════
// Season Reset — Infrastructure Dashboard v5.1
// SLO: admin tool, Supabase Auth-gated, destructive ops
// Auth: uses Supabase signInWithPassword → authenticated role
//       RLS policies require superadmin in admin_roles
// ═══════════════════════════════════════════════════════

const SB_URL = window.SB_URL;
const SB_KEY = window.SB_KEY;

// Supabase client — persistent session so token auto-refreshes
const sb = supabase.createClient(SB_URL, SB_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// ── Table Registry ──
// tier: safe = auto-repopulate, warn = permanent but not critical, danger = critical permanent
const TABLES = [
  { id:'economy_history',     tier:'safe', filter:'id=gte.0',            label:'Economy History',            desc:'Snapshot ekonomi (gem, koin, flow). Auto-repopulate via sync BDS ~5 menit.' },
  { id:'metrics_history',     tier:'safe', filter:'id=gte.0',            label:'Metrics History',            desc:'TPS, online players, server metrics. Auto-repopulate via sync BDS.' },
  { id:'auction_history',     tier:'warn', filter:'id=gte.0',            label:'Auction History',            desc:'Riwayat transaksi auction house. Data market pricing hilang permanen.' },
  { id:'auction_price_index', tier:'warn', filter:'tx_count=gte.0',       label:'Auction Price Index',        desc:'Rangkuman harga pasar per item (min/max/avg). Direset agar bursa mulai dari 0.' },
  { id:'weather_history',     tier:'warn', filter:'id=gte.0',            label:'Weather History',            desc:'Log weather event server. Tidak gameplay-critical, history hilang permanen.' },
  { id:'chat_messages',       tier:'warn', filter:'id=gte.0',            label:'Chat Messages',              desc:'Log chat in-game & web. Tidak gameplay-critical.' },
  { id:'topup_queue',         tier:'warn', filter:"status=in.(done,failed)", label:'Topup Queue (done/failed)', desc:'Riwayat topup. Filter aman: hanya done/failed, pending tetap.' },
  { id:'admin_activity_log',  tier:'warn', filter:'id=gte.0',            label:'Admin Activity Log',         desc:'Log aktivitas admin panel. Tidak gameplay-critical.' },
  { id:'recovery_queue',      tier:'warn', filter:"status=in.(done,failed)", label:'Recovery Queue (done/failed)', desc:'Queue recovery item. Hanya hapus yang sudah selesai.' },
];

// ── State ──
let tableData = {};  // { tableId: { rows, totalSize, tableSize, indexSize, totalSizeBytes } }
let infraData = {};  // DB-level metrics
let storageData = []; // Bucket info
let accessToken = null; // JWT access token from Supabase Auth

// ═══════════════════════════════════════════
//  AUTH — Supabase signInWithPassword
// ═══════════════════════════════════════════
document.getElementById('auth-btn').addEventListener('click', authenticate);
document.getElementById('pw-input').addEventListener('keydown', e => { if (e.key === 'Enter') authenticate(); });
document.getElementById('email-input').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('pw-input').focus(); });

async function authenticate() {
  const email = document.getElementById('email-input').value.trim();
  const pw = document.getElementById('pw-input').value;
  const errEl = document.getElementById('auth-error');
  const btn = document.getElementById('auth-btn');

  if (!email || !pw) {
    errEl.textContent = 'Masukkan email dan password.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Authenticating...';
  errEl.style.display = 'none';

  try {
    // 1. Sign in with Supabase Auth
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
    if (error) throw error;

    // 2. Verify superadmin role
    const userId = data.user.id;
    const { data: roleData, error: roleErr } = await sb
      .from('admin_roles')
      .select('role, active')
      .eq('user_id', userId)
      .single();

    if (roleErr || !roleData || roleData.role !== 'superadmin' || !roleData.active) {
      await sb.auth.signOut();
      throw new Error('Akun tidak memiliki akses superadmin.');
    }

    // 3. Store access token for fetch calls
    accessToken = data.session.access_token;

    // 4. Show main UI
    document.getElementById('gate').style.display = 'none';
    document.getElementById('main-ui').style.display = 'flex';
    boot();
  } catch (e) {
    errEl.textContent = e.message || 'Login gagal.';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Authenticate';
  }
}

// Auto-login if session exists
(async function checkExistingSession() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;

    // Verify superadmin
    const { data: roleData } = await sb
      .from('admin_roles')
      .select('role, active')
      .eq('user_id', session.user.id)
      .single();

    if (!roleData || roleData.role !== 'superadmin' || !roleData.active) return;

    accessToken = session.access_token;
    document.getElementById('gate').style.display = 'none';
    document.getElementById('main-ui').style.display = 'flex';
    boot();
  } catch { /* no session, show login */ }
})();

// Keep accessToken fresh on refresh
sb.auth.onAuthStateChange((event, session) => {
  if (session) accessToken = session.access_token;
});

/**
 * Build auth headers for PostgREST fetch calls.
 * Uses the authenticated session token, not the anon key.
 */
function authHeaders(extra) {
  const h = {
    apikey: SB_KEY,
    Authorization: 'Bearer ' + (accessToken || SB_KEY),
  };
  if (extra) Object.assign(h, extra);
  return h;
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
//  INFRASTRUCTURE METRICS (via PostgREST + live SQL)
// ═══════════════════════════════════════════

// Live metrics state populated by live queries
let liveTableSizes = {};  // { table_name: { total_bytes, index_bytes } }
let liveDbSizeMB = 0;
let liveCacheHit = '—';
let liveConnections = '—';
let livePgVersion = '17.6';
let livePublicTables = [];

/**
 * Execute a read-only SQL query via exec_sql RPC
 */
async function runSql(query) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!r.ok) {
      console.warn('[SeasonReset] exec_sql status:', r.status);
      return null;
    }
    const data = await r.json();
    return Array.isArray(data) ? data : null;
  } catch (e) {
    console.warn('[SeasonReset] SQL error:', e?.message);
    return null;
  }
}

/**
 * Fetch real table sizes, cache hit, connections, and DB size from PostgreSQL catalog.
 */
async function fetchLiveTableSizes() {
  try {
    // 1. Table sizes & index sizes
    const tableQuery = "SELECT c.relname as name, pg_total_relation_size(c.oid) as total_bytes, pg_indexes_size(c.oid) as index_bytes FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY pg_total_relation_size(c.oid) DESC";
    const tableRows = await runSql(tableQuery);
    if (tableRows) {
      liveTableSizes = {};
      for (const row of tableRows) {
        liveTableSizes[row.name] = {
          total_bytes: Number(row.total_bytes) || 0,
          index_bytes: Number(row.index_bytes) || 0,
        };
      }
    }

    // 2. Total DB size
    const dbRows = await runSql("SELECT pg_database_size(current_database()) as bytes");
    if (dbRows && dbRows[0]) {
      liveDbSizeMB = Math.round(Number(dbRows[0].bytes) / 1048576);
    }

    // 3. Cache hit ratio (buffer cache)
    const cacheRows = await runSql("SELECT coalesce(round(sum(heap_blks_hit) * 100.0 / nullif(sum(heap_blks_hit + heap_blks_read), 0), 1), 100.0) as ratio FROM pg_statio_user_tables");
    if (cacheRows && cacheRows[0] && cacheRows[0].ratio !== null && cacheRows[0].ratio !== undefined) {
      liveCacheHit = cacheRows[0].ratio + '%';
    }

    // 4. Active & Max connections
    const connRows = await runSql("SELECT count(*)::int as active, current_setting('max_connections')::int as max_conn FROM pg_stat_activity");
    if (connRows && connRows[0]) {
      liveConnections = `${connRows[0].active} / ${connRows[0].max_conn}`;
    }

    // 5. PostgreSQL Version
    const verRows = await runSql("SELECT current_setting('server_version') as ver");
    if (verRows && verRows[0] && verRows[0].ver) {
      livePgVersion = verRows[0].ver;
    }

    // 6. Dynamic Public Tables list
    const ptRows = await runSql("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    if (ptRows && ptRows.length > 0) {
      livePublicTables = ptRows.map(r => r.tablename);
    }

    return true;
  } catch (e) {
    console.warn('[SeasonReset] live table sizes error:', e?.message);
    return false;
  }
}

async function fetchInfraMetrics() {
  try {
    const defaultTables = [
      'economy_history','metrics_history','auction_history','weather_history',
      'chat_messages','topup_queue','admin_activity_log','recovery_queue',
      'leaderboard_sync','online_players','orders','shop_items','site_config',
      'admin_roles','social_links','finance_transactions','shop_config',
      'announcements','features','rules','chat_verify','chat_accounts',
      'admin_pending_requests','mimi_commands','shop_categories'
    ];

    // Try fetching live sizes and PG metrics first
    await fetchLiveTableSizes();

    // Use dynamic tables list from Postgres if available, else fallback
    const targetTables = livePublicTables.length > 0 ? livePublicTables : defaultTables;

    let totalRows = 0;
    const sizes = {};

    // Fetch row counts for ALL public tables
    const promises = targetTables.map(async (t) => {
      try {
        const r = await fetch(`${SB_URL}/rest/v1/${t}?select=*&limit=1`, {
          method: 'HEAD',
          headers: { ...authHeaders(), Prefer: 'count=exact', Range: '0-0' },
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

    infraData = { totalRows, tableSizes: sizes, tableCount: targetTables.length };
    renderInfraCards();
  } catch (e) {
    console.warn('[SeasonReset] infra metrics error:', e?.message);
  }
}

function renderInfraCards() {
  const d = infraData;
  const freeCapMB = 500;
  // Use live DB size if available, else rough estimate from table sizes
  const dbSizeMB = liveDbSizeMB || _estimateDbSizeMB();
  const usagePct = ((dbSizeMB / freeCapMB) * 100).toFixed(1);

  setVal('infra-db-size', dbSizeMB + ' MB');
  setVal('infra-db-cap', usagePct + '%');
  setVal('infra-tables', d.tableCount || 25);
  setVal('infra-total-rows', (d.totalRows || 0).toLocaleString('id-ID'));
  setVal('infra-cache-hit', liveCacheHit);
  setVal('infra-connections', liveConnections);
  setVal('infra-pg-version', livePgVersion);
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

/** Fallback estimate when live query is unavailable */
function _estimateDbSizeMB() {
  let total = 0;
  for (const v of Object.values(liveTableSizes)) total += v.total_bytes;
  // Public tables are ~60-70% of total DB (rest is system catalogs, WAL, etc.)
  return total > 0 ? Math.round(total / 1048576 / 0.65) : 40;
}

function renderDonutChart() {
  // Build segments from live data if available, else use rough estimates
  const targetTables = [
    { name: 'metrics_history',  color: '#fbbf24' },
    { name: 'economy_history',  color: '#4a8fff' },
    { name: 'chat_messages',    color: '#a78bfa' },
    { name: 'auction_history',  color: '#f87171' },
    { name: 'weather_history',  color: '#34d399' },
    { name: 'admin_activity_log', color: '#22d3ee' },
  ];

  const segments = [];
  let otherBytes = 0;
  const hasLiveData = Object.keys(liveTableSizes).length > 0;

  if (hasLiveData) {
    const targetNames = new Set(targetTables.map(t => t.name));
    for (const t of targetTables) {
      const bytes = liveTableSizes[t.name]?.total_bytes || 0;
      if (bytes > 0) {
        segments.push({ name: t.name, size: bytes / 1048576, color: t.color });
      }
    }
    // Sum all other public tables
    for (const [name, data] of Object.entries(liveTableSizes)) {
      if (!targetNames.has(name)) otherBytes += data.total_bytes;
    }
    if (otherBytes > 0) {
      segments.push({ name: 'Other tables', size: otherBytes / 1048576, color: '#2e3848' });
    }
  } else {
    // Minimal fallback — will be replaced on next refresh
    segments.push({ name: 'Loading...', size: 1, color: '#2e3848' });
  }

  // Sort by size descending
  segments.sort((a, b) => b.size - a.size);

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
    legendParts += `<div class="donut-legend-item"><span class="donut-legend-dot" style="background:${seg.color}"></span>${seg.name}<span class="donut-legend-val">${seg.size >= 1 ? seg.size.toFixed(1) + ' MB' : (seg.size * 1024).toFixed(0) + ' KB'}</span></div>`;
  }

  const container = document.getElementById('donut-chart');
  if (container) {
    container.innerHTML = `
      <div class="donut-wrap">
        <svg class="donut-svg" viewBox="0 0 100 100">${svgParts}
          <text x="50" y="48" text-anchor="middle" fill="var(--text-main)" font-size="12" font-weight="800" style="transform:rotate(90deg);transform-origin:50% 50%">${total.toFixed(1)}</text>
          <text x="50" y="58" text-anchor="middle" fill="var(--text-faint)" font-size="6" style="transform:rotate(90deg);transform-origin:50% 50%">MB</text>
        </svg>
        <div class="donut-legend">${legendParts}</div>
      </div>`;
  }
}

// ═══════════════════════════════════════════
//  STORAGE BUCKETS (Live via SQL + JS Fallback)
// ═══════════════════════════════════════════
async function fetchStorageBuckets() {
  try {
    // 1. Try querying storage schema directly via exec_sql
    const rows = await runSql("SELECT b.name, count(o.id)::int as files, coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint as bytes FROM storage.buckets b LEFT JOIN storage.objects o ON b.id = o.bucket_id GROUP BY b.name ORDER BY bytes DESC");

    if (rows && rows.length > 0) {
      storageData = rows.map(r => ({
        name: r.name,
        files: Number(r.files) || 0,
        bytes: Number(r.bytes) || 0,
        size: formatBytes(Number(r.bytes) || 0),
      }));
    } else {
      // 2. Fallback to Supabase JS Client
      const { data: buckets, error } = await sb.storage.listBuckets();
      if (!error && buckets && buckets.length > 0) {
        storageData = [];
        for (const b of buckets) {
          const { data: files } = await sb.storage.from(b.name).list('', { limit: 1000 });
          const fileCount = files ? files.length : 0;
          let bytes = 0;
          if (files) {
            for (const f of files) {
              bytes += f.metadata?.size || 0;
            }
          }
          storageData.push({
            name: b.name,
            files: fileCount,
            bytes: bytes,
            size: formatBytes(bytes),
          });
        }
      }
    }
  } catch (e) {
    console.warn('[SeasonReset] storage bucket fetch error:', e?.message);
  }

  renderStorageBuckets();
}

function renderStorageBuckets() {
  const container = document.getElementById('storage-grid');
  if (!container) return;

  if (!storageData || storageData.length === 0) {
    container.innerHTML = '<div style="color:var(--text-faint);font-size:12px;padding:10px">Tidak ada storage bucket ditemukan.</div>';
    setVal('rail-storage-val', '0 B');
    setVal('rail-storage-sub', '0 buckets · 0 files');
    return;
  }

  const totalBytes = storageData.reduce((s, b) => s + (b.bytes || 0), 0);
  const totalFiles = storageData.reduce((s, b) => s + (b.files || 0), 0);
  setVal('rail-storage-val', formatBytes(totalBytes));
  setVal('rail-storage-sub', `${storageData.length} buckets · ${totalFiles.toLocaleString('id-ID')} files`);

  const maxBytes = Math.max(...storageData.map(b => b.bytes), 1);
  const colors = ['#4a8fff', '#a78bfa', '#34d399', '#22d3ee', '#fbbf24', '#f87171'];

  container.innerHTML = storageData.map((b, i) => {
    const pct = Math.max(Math.round((b.bytes / maxBytes) * 100), 2);
    const color = colors[i % colors.length];
    return `<div class="bucket-card">
      <div class="bucket-name">
        <svg width="12" height="12" fill="none" stroke="${color}" stroke-width="2" viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
        ${b.name}
      </div>
      <div class="bucket-stat">${(b.files || 0).toLocaleString('id-ID')} files · ${b.size}</div>
      <div class="bucket-bar"><div class="bucket-bar-fill" style="width:${pct}%;background:${color}"></div></div>
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
  let total = 0;
  for (const t of TABLES) {
    const countEl = document.getElementById('count-' + t.id);
    const sizeEl = document.getElementById('size-' + t.id);
    if (!countEl) continue;
    countEl.textContent = '...'; countEl.className = 'count';
    try {
      const r = await fetch(`${SB_URL}/rest/v1/${t.id}?select=*&limit=1`, {
        method: 'HEAD',
        headers: { ...authHeaders(), Prefer: 'count=exact', Range: '0-0' },
      });
      const cr = r.headers.get('content-range');
      const num = cr ? parseInt(cr.split('/').pop(), 10) : NaN;
      if (Number.isFinite(num)) {
        countEl.textContent = num.toLocaleString('id-ID') + ' rows';
        if (num > 5000) countEl.classList.add('high');
        total += num;
        tableData[t.id] = { rows: num };
      } else { countEl.textContent = '? rows'; }
      // Use live size data if available
      if (sizeEl) {
        const live = liveTableSizes[t.id];
        if (live && live.total_bytes > 0) {
          sizeEl.textContent = formatBytes(live.total_bytes);
        } else {
          sizeEl.textContent = '—';
        }
      }
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

  let totalBytes = 0, totalRows = 0, indexBytes = 0;

  for (const id of checked) {
    // Use live data if available, else zero
    const live = liveTableSizes[id];
    totalBytes += live?.total_bytes || 0;
    indexBytes += live?.index_bytes || 0;
    totalRows += tableData[id]?.rows || 0;
  }

  setVal('impact-rows', totalRows.toLocaleString('id-ID'));
  setVal('impact-space', formatBytes(totalBytes));
  setVal('impact-index', formatBytes(indexBytes));
}

// ═══════════════════════════════════════════
//  EXPORT BACKUP (Paginated Full JSON download)
// ═══════════════════════════════════════════
async function exportSelectedTables() {
  const checked = [...document.querySelectorAll('input[data-table]:checked')].map(cb => cb.dataset.table);
  if (!checked.length) return;
  if (!confirm(`Export backup ${checked.length} tabel sebelum reset?`)) return;

  const exportBtn = document.getElementById('export-btn');
  exportBtn.disabled = true;
  exportBtn.textContent = 'Memulai Export...';

  const backup = { exported_at: new Date().toISOString(), tables: {} };
  const pageSize = 1000;

  try {
    for (let tIdx = 0; tIdx < checked.length; tIdx++) {
      const tableId = checked[tIdx];
      const allRows = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        exportBtn.textContent = `Exporting ${tableId} (${allRows.length.toLocaleString('id-ID')} rows)...`;
        const r = await fetch(`${SB_URL}/rest/v1/${tableId}?select=*&limit=${pageSize}&offset=${offset}`, {
          headers: authHeaders(),
        });
        if (!r.ok) {
          backup.tables[tableId] = { error: r.status, partial: allRows };
          break;
        }
        const data = await r.json();
        if (Array.isArray(data) && data.length > 0) {
          allRows.push(...data);
          offset += data.length;
          if (data.length < pageSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      backup.tables[tableId] = allRows;
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laughtale-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('Terjadi kesalahan saat export: ' + (err?.message || err));
  } finally {
    exportBtn.disabled = false;
    exportBtn.innerHTML = `<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export Backup`;
  }
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
  fetchStorageBuckets();
});

// ═══════════════════════════════════════════
//  EXECUTE RESET
// ═══════════════════════════════════════════
document.getElementById('execute-btn').addEventListener('click', async () => {
  const checked = [...document.querySelectorAll('input[data-table]:checked')].map(cb => cb.dataset.table);
  if (!checked.length) return;

  // Verify we still have a valid token
  if (!accessToken) {
    alert('Sesi expired. Silakan refresh halaman dan login ulang.');
    return;
  }

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
  writeLog(`Target: ${checked.length} tables | Auth: Supabase (superadmin)`, 'info');
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

      // Refresh token if needed before destructive op
      const { data: { session } } = await sb.auth.getSession();
      if (session) accessToken = session.access_token;

      const r = await fetch(`${SB_URL}/rest/v1/${tableId}?${meta.filter}`, {
        method: 'DELETE',
        headers: authHeaders({ 'Content-Type': 'application/json', Prefer: 'count=exact' }),
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
