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

let allData={bank:[],auction:[],gacha:[],topup:[],discCodes:{}};
let activeTab='bank';

const ICONS={
  bank:`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7h20L12 2z"/><rect x="3" y="10" width="18" height="10" rx="1"/><path d="M7 14v3m5-3v3m5-3v3"/></svg>`,
  auction:`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 7.5l3-3 4 4-3 3"/></svg>`,
  gacha:`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M6 3l6 6 6-6"/><path d="M2 9h20"/></svg>`,
  topup:`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
};

const RARITY_COLORS={
  COMMON:'var(--dim)',UNCOMMON:'var(--green)',RARE:'#3b82f6',EPIC:'var(--ac)',LEGENDARY:'var(--gold)'
};

function copyCode(code){
  navigator.clipboard.writeText(code).then(()=>{
    const t=$('dc-toast');
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'),2000);
  }).catch(()=>{});
}

function renderDiscCodes(codes){
  const el=$('disc-content');
  const entries=Object.entries(codes||{});
  if(!entries.length){
    el.innerHTML='<div class="dc-empty">Tidak ada kode diskon aktif saat ini</div>';
    return;
  }
  // Estimate max uses for bar (use 50 as baseline)
  el.innerHTML='<div class="dc-grid">'+entries.map(([code,info],i)=>{
    const pct=info.pct||0;
    const uses=info.uses||0;
    const type=info.type||'ALL';
    const typeLabel=type==='ALL'?'SEMUA':type==='PT'?'PARTIKEL':'EQUIPMENT';
    const typeCls=type.toLowerCase();
    const barW=Math.min(100,Math.max(5,(uses/50)*100));
    return`<div class="dc-card" style="animation:fs .3s ${i*60}ms ease both">
      <div class="dc-top">
        <span class="dc-code" onclick="copyCode('${esc(code).replace(/'/g,"\\'")}')"><span>${esc(code)}</span><span class="copy-hint">KLIK SALIN</span></span>
        <span class="dc-pct">-${pct}%</span>
      </div>
      <div class="dc-bottom">
        <span class="dc-type ${typeCls}">${typeLabel}</span>
        <span class="dc-uses">${uses} penggunaan tersisa</span>
      </div>
      <div class="dc-bar"><div class="dc-bar-fill" style="width:${barW}%"></div></div>
    </div>`;
  }).join('')+'</div>';
}

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
    const items=h.items||[];
    const type=h.type==='PT'?'Partikel':'Peralatan';
    const typeCls=h.type==='PT'?'pt':'eq';
    const best=items.reduce((a,b)=>{
      const rk=['COMMON','UNCOMMON','RARE','EPIC','LEGENDARY'];
      return rk.indexOf(b.rarity)>rk.indexOf(a.rarity)?b:a;
    },items[0]||{rarity:'COMMON',name:'?'});
    const bestColor=RARITY_COLORS[best.rarity]||'var(--dim)';
    const itemList=items.map(it=>{
      const c=RARITY_COLORS[it.rarity]||'var(--dim)';
      return`<span class="pull-item" style="color:${c}">${esc(it.name||'?')}${it.isDup?' <span class="dup">[D]</span>':''}</span>`;
    }).join('');
    return`<div class="log-row gacha-row" style="animation:fs .3s ${i*30}ms ease both">
      <div class="log-icon ${typeCls}">${ICONS.gacha}</div>
      <div class="log-body">
        <div class="log-main"><span class="pn">${esc(h.player||'?')}</span> <span class="badge ${typeCls}">${type}</span> <span class="badge pull">${items.length}x</span></div>
        <div class="log-detail"><span class="log-time">${timeAgo(h.ts)}</span></div>
        <div class="pull-items">${itemList}</div>
      </div>
      <div class="log-amount" style="color:${bestColor}">${esc(best.name||'?')}</div>
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

function renderActive(){
  const renderers={bank:renderBank,auction:renderAuction,gacha:renderGacha,topup:renderTopup};
  (renderers[activeTab]||renderBank)(allData[activeTab]||[]);
  const meta=$('log-meta');
  const counts={bank:allData.bank.length,auction:allData.auction.length,gacha:allData.gacha.length,topup:allData.topup.length};
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

async function fetchLogs(){
  $('log-content').innerHTML='<div class="emp loading">Memuat data...</div>';
  try{
    const r=await fetch(`${SB}/rest/v1/leaderboard_sync?id=eq.current&select=synced_at,bank_log,auction_log,gacha_log,topup_log,disc_codes`,
      {headers:{apikey:SK,Authorization:`Bearer ${SK}`}});
    const d=await r.json();
    if(d&&d[0]){
      const row=d[0];
      allData.bank=typeof row.bank_log==='string'?JSON.parse(row.bank_log||'[]'):(row.bank_log||[]);
      allData.auction=typeof row.auction_log==='string'?JSON.parse(row.auction_log||'[]'):(row.auction_log||[]);
      allData.gacha=typeof row.gacha_log==='string'?JSON.parse(row.gacha_log||'[]'):(row.gacha_log||[]);
      allData.topup=typeof row.topup_log==='string'?JSON.parse(row.topup_log||'[]'):(row.topup_log||[]);
      allData.discCodes=typeof row.disc_codes==='string'?JSON.parse(row.disc_codes||'{}'):(row.disc_codes||{});
      if(row.synced_at){
        const el=Math.round((Date.now()-new Date(row.synced_at).getTime())/60000);
        allData.syncAge=el<1?'baru saja':el+'m lalu';
      }
    }
  }catch(e){console.warn('[Logs]',e)}
  renderDiscCodes(allData.discCodes);
  renderActive();
  updateStats();
}

function updateStats(){
  $('st-bank').textContent=allData.bank.length;
  $('st-auction').textContent=allData.auction.length;
  $('st-gacha').textContent=allData.gacha.length;
  $('st-topup').textContent=allData.topup.length;
}

bindTabs();
fetchLogs();
setInterval(fetchLogs,120000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)fetchLogs()});
