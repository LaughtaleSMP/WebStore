const SB='https://jlxtnbnrirxhwuyqjlzw.supabase.co',
SK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpseHRuYm5yaXJ4aHd1eXFqbHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NjYzOTAsImV4cCI6MjA5MTQ0MjM5MH0.MRhoVRDju41J8nWp4WTgiKOvxy7AgwGYH-el2zVsbWI';
const $=id=>document.getElementById(id);
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}

function timeAgo(ts){
  if(!ts)return'?';
  const s=Math.floor((Date.now()-ts)/1000);
  if(s<60)return`${s}s lalu`;
  if(s<3600)return`${Math.floor(s/60)}m lalu`;
  if(s<86400)return`${Math.floor(s/3600)}j lalu`;
  return`${Math.floor(s/86400)}h lalu`;
}
function fmtDate(ts){
  if(!ts)return'—';
  const d=new Date(ts);
  return d.toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
}
const fmt=n=>(n||0).toLocaleString('id-ID');

let allData={bank:[],auction:[],gacha:[],topup:[],land:[],discCodes:{}};
let activeTab='bank';

const ICONS={
  bank:`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7h20L12 2z"/><rect x="3" y="10" width="18" height="10" rx="1"/><path d="M7 14v3m5-3v3m5-3v3"/></svg>`,
  auction:`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 7.5l3-3 4 4-3 3"/></svg>`,
  gacha:`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M6 3l6 6 6-6"/><path d="M2 9h20"/></svg>`,
  topup:`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  land:`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`
};

const RARITY_COLORS={
  COMMON:'var(--dim)',UNCOMMON:'var(--green)',RARE:'#3b82f6',EPIC:'var(--ac)',LEGENDARY:'var(--gold)'
};

function copyCode(code){
  if(!code)return;
  const showToast=()=>{
    const t=$('dc-toast');
    if(!t)return;
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'),2000);
  };
  // Modern clipboard API (HTTPS / localhost only)
  if(navigator.clipboard&&window.isSecureContext){
    navigator.clipboard.writeText(String(code)).then(showToast).catch(()=>{
      _fallbackCopy(String(code))&&showToast();
    });
  }else{
    _fallbackCopy(String(code))&&showToast();
  }
}

function _fallbackCopy(text){
  try{
    const ta=document.createElement('textarea');
    ta.value=text;
    ta.style.position='fixed';
    ta.style.left='-9999px';
    ta.setAttribute('readonly','');
    document.body.appendChild(ta);
    ta.select();
    const ok=document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }catch{return false;}
}

// Validasi field kode diskon — defensive untuk data corrupt
function _sanitizeDiscCode(code,info){
  const codeStr=String(code||'').trim();
  if(!codeStr||codeStr.length>32)return null; // skip invalid
  const pct=Math.max(0,Math.min(100,Math.floor(Number(info?.pct))||0));
  const uses=Math.max(0,Math.floor(Number(info?.uses))||0);
  const rawType=String(info?.type||'ALL').toUpperCase();
  const type=rawType==='ALL'||rawType==='PT'||rawType==='EQ'?rawType:'ALL';
  return {code:codeStr,pct,uses,type};
}

function renderDiscCodes(codes){
  const el=$('disc-content');
  if(!el)return;
  const entries=Object.entries(codes||{});
  if(!entries.length){
    el.innerHTML='<div class="dc-empty">Tidak ada kode diskon aktif saat ini</div>';
    return;
  }
  // Sanitize + filter invalid entries
  const valid=[];
  for(let i=0;i<entries.length;i++){
    const s=_sanitizeDiscCode(entries[i][0],entries[i][1]);
    if(s)valid.push(s);
  }
  if(!valid.length){
    el.innerHTML='<div class="dc-empty">Tidak ada kode diskon aktif saat ini</div>';
    return;
  }
  // Build DOM aman tanpa innerHTML untuk onclick — pakai data attribute + delegated event
  // Prevents XSS via code names dengan karakter spesial (', \, <, dll)
  const out=['<div class="dc-grid">'];
  for(let i=0;i<valid.length;i++){
    const v=valid[i];
    const typeLabel=v.type==='ALL'?'SEMUA':v.type==='PT'?'PARTIKEL':'EQUIPMENT';
    const typeCls=v.type.toLowerCase();
    const barW=Math.min(100,Math.max(5,(v.uses/50)*100));
    const ec=esc(v.code); // double-escape via HTML entities
    out.push(
      '<div class="dc-card" style="animation:fs .3s '+(i*60)+'ms ease both">',
      '<div class="dc-top">',
      '<span class="dc-code" data-code="'+ec+'" role="button" tabindex="0">',
      '<span>'+ec+'</span>',
      '<span class="copy-hint">KLIK SALIN</span>',
      '</span>',
      '<span class="dc-pct">-'+v.pct+'%</span>',
      '</div>',
      '<div class="dc-bottom">',
      '<span class="dc-type '+typeCls+'">'+typeLabel+'</span>',
      '<span class="dc-uses">'+v.uses+' penggunaan tersisa</span>',
      '</div>',
      '<div class="dc-bar"><div class="dc-bar-fill" style="width:'+barW.toFixed(1)+'%"></div></div>',
      '</div>'
    );
  }
  out.push('</div>');
  el.innerHTML=out.join('');
}

// Delegated click handler untuk kode diskon — bind sekali, bukan inline onclick
// Mencegah XSS via inline JS string injection.
document.addEventListener('click',function(ev){
  const code=ev.target.closest?.('.dc-code')?.dataset?.code;
  if(code)copyCode(code);
});
document.addEventListener('keydown',function(ev){
  if(ev.key!=='Enter'&&ev.key!==' ')return;
  const code=ev.target.closest?.('.dc-code')?.dataset?.code;
  if(code){ev.preventDefault();copyCode(code);}
});

function renderBank(logs){
  const el=$('log-content');
  if(!logs.length){el.innerHTML='<div class="emp">Belum ada log transfer</div>';return}
  el.innerHTML=logs.map((h,i)=>{
    const tax=(h.tax||0)>0?` <span class="tx">pajak ${fmt(h.tax)}</span>`:'';
    return`<div class="log-row" style="animation:fs .3s ${i*30}ms ease both">
      <div class="log-icon sent">${ICONS.bank}</div>
      <div class="log-body">
        <div class="log-main"><span class="pn">${esc(h.from||'?')}</span> <span class="arrow">→</span> <span class="pn">${esc(h.to||'?')}</span></div>
        <div class="log-detail">${h.note?`"${esc(h.note)}" · `:''}<span class="log-time">${timeAgo(h.ts)}</span></div>
      </div>
      <div class="log-amount coin">+${fmt(h.amount)} ⛃${tax}</div>
    </div>`;
  }).join('');
}

function renderAuction(logs){
  const el=$('log-content');
  if(!logs.length){el.innerHTML='<div class="emp">Belum ada log auction</div>';return}
  el.innerHTML=logs.map((h,i)=>{
    let icon='',cls='',detail='',amountHtml='';
    if(h.type==='sold'||h.type==='offer_accepted'){
      cls='sold';
      detail=`<span class="pn">${esc(h.seller||'?')}</span> <span class="arrow">→</span> <span class="pn">${esc(h.buyer||'?')}</span>`;
      amountHtml=`<div class="log-amount coin">${fmt(h.price)} ⛃</div>`;
    }else if(h.type==='auction_won'){
      cls='auction';
      detail=`<span class="pn">${esc(h.seller||'?')}</span> <span class="arrow">→</span> <span class="pn">${esc(h.buyer||'?')}</span> <span class="badge bid">Lelang</span>`;
      amountHtml=`<div class="log-amount coin">${fmt(h.price)} ⛃</div>`;
    }else if(h.type==='expired'){
      cls='expired';
      detail=`<span class="pn">${esc(h.seller||'?')}</span>`;
      amountHtml=`<div class="log-amount expired">Expired</div>`;
    }
    return`<div class="log-row" style="animation:fs .3s ${i*30}ms ease both">
      <div class="log-icon ${cls}">${ICONS.auction}</div>
      <div class="log-body">
        <div class="log-main">${esc(h.item||'Unknown Item')}</div>
        <div class="log-detail">${detail} · <span class="log-time">${timeAgo(h.ts)}</span></div>
      </div>
      ${amountHtml}
    </div>`;
  }).join('');
}

function renderGacha(logs){
  const el=$('log-content');
  if(!logs.length){el.innerHTML='<div class="emp">Belum ada log gacha</div>';return}
  el.innerHTML=logs.map((h,i)=>{
    const pName=h.player||h.p||'?';
    const type=(h.type||h.t||'EQ')==='PT'?'Partikel':'Peralatan';
    const typeCls=(h.type||h.t||'EQ')==='PT'?'pt':'eq';
    const items=h.items||[];
    const rarity=h.r||'COMMON';
    const iName=h.name||h.n||'?';
    const rarColor=RARITY_COLORS[rarity]||'var(--dim)';
    if(items.length>0){
      const best=items.reduce((a,b)=>{
        const rk=['COMMON','UNCOMMON','RARE','EPIC','LEGENDARY'];
        return rk.indexOf(b.rarity||b.r||'COMMON')>rk.indexOf(a.rarity||a.r||'COMMON')?b:a;
      },items[0]||{});
      const bestColor=RARITY_COLORS[best.rarity||best.r]||'var(--dim)';
      const itemList=items.map(it=>{
        const c=RARITY_COLORS[it.rarity||it.r]||'var(--dim)';
        return`<span class="pull-item" style="color:${c}">${esc(it.name||it.n||'?')}${it.isDup||it.d?' <span class="dup">[D]</span>':''}</span>`;
      }).join('');
      return`<div class="log-row gacha-row" style="animation:fs .3s ${i*30}ms ease both">
        <div class="log-icon ${typeCls}">${ICONS.gacha}</div>
        <div class="log-body">
          <div class="log-main"><span class="pn">${esc(pName)}</span> <span class="badge ${typeCls}">${type}</span> <span class="badge pull">${items.length}x</span></div>
          <div class="log-detail"><span class="log-time">${timeAgo(h.ts)}</span></div>
          <div class="pull-items">${itemList}</div>
        </div>
        <div class="log-amount" style="color:${bestColor}">${esc(best.name||best.n||'?')}</div>
      </div>`;
    }
    return`<div class="log-row gacha-row" style="animation:fs .3s ${i*30}ms ease both">
      <div class="log-icon ${typeCls}">${ICONS.gacha}</div>
      <div class="log-body">
        <div class="log-main"><span class="pn">${esc(pName)}</span> <span class="badge ${typeCls}">${type}</span></div>
        <div class="log-detail"><span class="log-time">${timeAgo(h.ts)}</span></div>
      </div>
      <div class="log-amount" style="color:${rarColor}">${esc(iName)}</div>
    </div>`;
  }).join('');
}

function renderTopup(logs){
  const el=$('log-content');
  if(!logs.length){el.innerHTML='<div class="emp">Belum ada log topup admin</div>';return}
  const sorted=[...logs].sort((a,b)=>(b.ts||0)-(a.ts||0));
  el.innerHTML=sorted.map((h,i)=>{
    const cur=h.c==='gem'?'Gem':'Koin';
    const curCls=h.c==='gem'?'gem':'coin';
    const act=h.x==='add'?'+':'-';
    const actCls=h.x==='add'?'add':'deduct';
    return`<div class="log-row" style="animation:fs .3s ${i*30}ms ease both">
      <div class="log-icon ${actCls}">${ICONS.topup}</div>
      <div class="log-body">
        <div class="log-main"><span class="pn admin">${esc(h.a||'Admin')}</span> <span class="arrow">→</span> <span class="pn">${esc(h.t||'?')}</span>${h.o?` <span class="badge offline">Offline</span>`:''}</div>
        <div class="log-detail">${fmt(h.b)} → ${fmt(h.f)} ${cur} · <span class="log-time">${timeAgo(h.ts)}</span></div>
      </div>
      <div class="log-amount ${actCls}">${act}${fmt(h.n)} <span class="cur ${curCls}">${cur}</span></div>
    </div>`;
  }).join('');
}

function renderLand(logs){
  const el=$('log-content');
  if(!logs.length){el.innerHTML='<div class="emp">Belum ada log transaksi land</div>';return}
  const sorted=[...logs].sort((a,b)=>new Date(b.ts||0).getTime()-new Date(a.ts||0).getTime());
  el.innerHTML=sorted.map((h,i)=>{
    const action=h.action||'?';
    let actLabel='',iconCls='land',amtHtml='';
    if(action==='buy'){actLabel='Beli Land';amtHtml=`<div class="log-amount coin">-${fmt(Math.abs(h.coin))} ⛃${h.gem?`<br>-${fmt(Math.abs(h.gem))} ✦`:''}</div>`;}
    else if(action==='sell'){actLabel='Hapus Land';amtHtml=`<div class="log-amount coin" style="color:var(--green)">+${fmt(h.coin)} ⛃</div>`;}
    else if(action==='expand'){actLabel='Expand Land';amtHtml=`<div class="log-amount coin">-${fmt(Math.abs(h.coin))} ⛃${h.gem?`<br>-${fmt(Math.abs(h.gem))} ✦`:''}</div>`;}
    else if(action==='transfer'){actLabel='Transfer Land';amtHtml=`<div class="log-amount">Gratis</div>`;}
    return`<div class="log-row" style="animation:fs .3s ${i*30}ms ease both">
      <div class="log-icon ${iconCls}">${ICONS.land}</div>
      <div class="log-body">
        <div class="log-main"><span class="pn">${esc(h.player||'?')}</span> <span class="badge land">${actLabel}</span></div>
        <div class="log-detail">${esc(h.detail||'')} · <span class="log-time">${timeAgo(new Date(h.ts).getTime())}</span></div>
      </div>
      ${amtHtml}
    </div>`;
  }).join('');
}

function renderActive(){
  const renderers={bank:renderBank,auction:renderAuction,gacha:renderGacha,topup:renderTopup,land:renderLand};
  (renderers[activeTab]||renderBank)(allData[activeTab]||[]);
  const meta=$('log-meta');
  const counts={bank:allData.bank.length,auction:allData.auction.length,gacha:allData.gacha.length,topup:allData.topup.length,land:allData.land.length};
  meta.textContent=`${counts[activeTab]} log · Sync: ${allData.syncAge||'—'}`;
}

function bindTabs(){
  $('log-tabs').addEventListener('click',e=>{
    const t=e.target.closest('.tab');if(!t)return;
    document.querySelectorAll('#log-tabs .tab').forEach(b=>b.classList.remove('a'));
    t.classList.add('a');
    activeTab=t.dataset.cat;
    renderActive();
  });
}

// ═══════════════════════════════════════════════════════════
// FETCH HELPERS — race-safe, abort-able, throttled
// ═══════════════════════════════════════════════════════════
let _fetchInflight=false;
let _currentAbort=null;
let _lastFetchOk=0;
let _hasLoadedOnce=false;
const MIN_FETCH_INTERVAL_MS=30000; // min 30 detik antar fetch (cegah spam)
const FETCH_INTERVAL_MS=120000;     // base interval 2 menit

function _safeParse(v,def){
  if(v==null)return def;
  if(typeof v!=='string')return v;
  try{return JSON.parse(v)??def;}catch{return def;}
}

async function fetchLogs(){
  // ── Race-condition guard: skip kalau sudah ada fetch in-flight ──
  if(_fetchInflight)return;
  // ── Min interval throttle: cegah fetch terlalu sering (visibility+interval bisa overlap) ──
  const now=Date.now();
  if(now-_lastFetchOk<MIN_FETCH_INTERVAL_MS)return;
  // ── Pause kalau tab hidden ──
  if(document.hidden)return;

  _fetchInflight=true;
  // Hanya tampilkan loading state kalau memang belum pernah load (hindari flicker pada refresh otomatis)
  if(!_hasLoadedOnce)$('log-content').innerHTML='<div class="emp loading">Memuat data...</div>';
  // AbortController untuk cancel kalau user navigate atau call concurrent
  if(_currentAbort)_currentAbort.abort();
  _currentAbort=new AbortController();
  // Timeout 12 detik agar tidak hang di koneksi mobile lambat
  const timeoutId=setTimeout(()=>_currentAbort?.abort(),12000);

  try{
    const r=await fetch(`${SB}/rest/v1/leaderboard_sync?id=eq.current&select=synced_at,bank_log,auction_log,gacha_log,topup_log,disc_codes,gacha_lb`,
      {headers:{apikey:SK,Authorization:`Bearer ${SK}`},signal:_currentAbort.signal});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const d=await r.json();
    if(d&&d[0]){
      const row=d[0];
      // safeParse helper — silent fallback ke array kosong kalau JSON invalid
      allData.bank=_safeParse(row.bank_log,[]);
      allData.auction=_safeParse(row.auction_log,[]);
      allData.gacha=_safeParse(row.gacha_log,[]);
      allData.topup=_safeParse(row.topup_log,[]);
      const lbParsed=_safeParse(row.gacha_lb,{});
      allData.land=_safeParse(lbParsed?.land_log,[]);
      allData.discCodes=_safeParse(row.disc_codes,{});
      if(row.synced_at){
        const el=Math.round((Date.now()-new Date(row.synced_at).getTime())/60000);
        allData.syncAge=el<1?'baru saja':el+'m lalu';
      }
      _lastFetchOk=Date.now();
      _hasLoadedOnce=true;
      _topItemsCache=null; // invalidate cache karena data baru
    }
  }catch(e){
    if(e.name!=='AbortError')console.warn('[Logs]',e);
    // Tidak update _lastFetchOk → next call akan retry sesuai interval normal
  }finally{
    clearTimeout(timeoutId);
    _fetchInflight=false;
    _currentAbort=null;
  }
  // Render hanya kalau ada data
  if(_hasLoadedOnce){
    renderDiscCodes(allData.discCodes);
    renderActive();
    updateStats();
    renderTopItems();
  }
}

function updateStats(){
  var ids=['st-bank','st-auction','st-gacha','st-topup'];
  var vals=[allData.bank.length,allData.auction.length,allData.gacha.length,allData.topup.length];
  for(var i=0;i<ids.length;i++){var el=$(ids[i]);if(el){el.textContent=vals[i];el.classList.remove('sk');}}
}

// ═══════════════════════════════════════════════════════════
// TOP ITEM AUCTION — agregasi item dari log auction
// ═══════════════════════════════════════════════════════════
let _topItemsCache=null;
let _topItemsCacheTs=0;
const _TOP_CACHE_TTL_MS=60000; // cache 1 menit (data sync max tiap 2 menit)
const _SOLD_TYPES=new Set(['sold','offer_accepted','auction_won']);
const _TOP_LIMIT=10;
const _WEEK_MS=7*24*3600*1000;
const _HALF_MS=3.5*24*3600*1000;

function renderTopItems(){
  const tbody=document.querySelector('#tbl-top-items tbody');
  if(!tbody)return;

  const logs=allData.auction;
  // Empty/null guard
  if(!Array.isArray(logs)||logs.length===0){
    tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:1rem;color:var(--mute)">Belum ada transaksi auction</td></tr>';
    return;
  }

  // Cache hit: skip re-aggregation kalau data sama & belum expired
  const now=Date.now();
  if(_topItemsCache&&(now-_topItemsCacheTs)<_TOP_CACHE_TTL_MS){
    _renderTopItemsHtml(tbody,_topItemsCache.arr,_topItemsCache.totalTx);
    return;
  }

  // Single-pass aggregation — O(N), zero filter() intermediate array
  const agg=Object.create(null); // null-proto: lebih cepat dari Map untuk string key biasa
  const cutoffWeek=now-_WEEK_MS;
  const cutoffHalf=now-_HALF_MS;
  let totalTx=0;

  for(let i=0;i<logs.length;i++){
    const h=logs[i];
    if(!h||!_SOLD_TYPES.has(h.type))continue;
    const ts=h.ts||0;
    if(ts<cutoffWeek)continue;
    const rawName=h.item;
    if(!rawName)continue;
    const name=String(rawName).trim();
    if(!name||name==='?')continue;
    const key=name.toLowerCase();
    const price=Number(h.price)||0;
    if(price<=0)continue; // skip price invalid

    let s=agg[key];
    if(!s){
      s=agg[key]={name,count:0,total:0,min:price,max:price,recent:0,old:0,recentSum:0,oldSum:0};
    }
    s.count++;
    s.total+=price;
    if(price<s.min)s.min=price;
    if(price>s.max)s.max=price;
    if(ts>=cutoffHalf){s.recent++;s.recentSum+=price;}
    else{s.old++;s.oldSum+=price;}
    totalTx++;
  }

  // Bounded heap-like extraction: ambil top-K tanpa sort full array
  // Kalau item < 50, langsung sort. Kalau lebih banyak, partial sort dengan slice.
  const arr=[];
  for(const k in agg)arr.push(agg[k]);
  if(arr.length>_TOP_LIMIT){
    // Quick partition — sort hanya N item, hemat CPU di mobile
    arr.sort((a,b)=>b.count-a.count);
    arr.length=_TOP_LIMIT;
  }else{
    arr.sort((a,b)=>b.count-a.count);
  }

  // Cache hasil agregasi
  _topItemsCache={arr,totalTx};
  _topItemsCacheTs=now;

  _renderTopItemsHtml(tbody,arr,totalTx);
}

function _renderTopItemsHtml(tbody,arr,totalTx){
  if(arr.length===0){
    tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:1rem;color:var(--mute)">Tidak ada data 7 hari terakhir</td></tr>';
    const pill=$('top-items-pill');
    if(pill)pill.textContent='0 TX · 7 HARI';
    return;
  }
  // Build HTML via array push lalu join sekali — lebih cepat dari template literal di loop
  const out=[];
  for(let i=0;i<arr.length;i++){
    const it=arr[i];
    const avg=Math.round(it.total/it.count);
    let trendHtml='<span style="color:var(--mute)">—</span>';
    if(it.recent>0&&it.old>0){
      const recentAvg=it.recentSum/it.recent;
      const oldAvg=it.oldSum/it.old;
      const pct=((recentAvg-oldAvg)/oldAvg)*100;
      if(pct>5)trendHtml='<span style="color:var(--green)">▲ '+pct.toFixed(0)+'%</span>';
      else if(pct<-5)trendHtml='<span style="color:var(--red)">▼ '+Math.abs(pct).toFixed(0)+'%</span>';
      else trendHtml='<span style="color:var(--mute)">≈ stabil</span>';
    }else if(it.recent>0&&it.old===0){
      trendHtml='<span style="color:var(--cyan)">★ baru</span>';
    }
    const rankColor=i===0?'var(--gold)':i===1?'#cbd5e1':i===2?'#cd7f32':'var(--mute)';
    out.push('<tr><td style="color:'+rankColor+';font-weight:700">'+(i+1)+'</td><td style="font-weight:600">'+esc(it.name)+'</td><td style="text-align:right;color:var(--cyan)">'+it.count+'x</td><td style="text-align:right;color:var(--gold)">'+fmt(avg)+'</td><td style="text-align:right;color:var(--mute)">'+fmt(it.min)+'</td><td style="text-align:right;color:var(--text)">'+fmt(it.max)+'</td><td>'+trendHtml+'</td></tr>');
  }
  tbody.innerHTML=out.join('');
  const pill=$('top-items-pill');
  if(pill)pill.textContent=totalTx+' TX · 7 HARI';
}

bindTabs();
fetchLogs();

// ── Auto-refresh interval — pakai variable supaya bisa di-clear/restart ──
let _refreshTimer=setInterval(fetchLogs,FETCH_INTERVAL_MS);

// ── Visibility-aware refresh: pause saat hidden, resume + fetch saat visible ──
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    if(_refreshTimer){clearInterval(_refreshTimer);_refreshTimer=null;}
    // Abort fetch yang sedang jalan agar tidak buang bandwidth mobile
    if(_currentAbort)_currentAbort.abort();
  }else{
    if(!_refreshTimer)_refreshTimer=setInterval(fetchLogs,FETCH_INTERVAL_MS);
    fetchLogs(); // refresh segera saat tab visible lagi
  }
});

// ── Cleanup saat page unload (cegah leak di SPA-like navigation) ──
window.addEventListener('pagehide',()=>{
  if(_refreshTimer){clearInterval(_refreshTimer);_refreshTimer=null;}
  if(_currentAbort)_currentAbort.abort();
},{once:true});
