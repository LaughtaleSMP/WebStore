const HOST='laughtale.my.id',PORT=19214,
API=`https://api.mcsrvstat.us/bedrock/3/${HOST}:${PORT}`,
SB='https://jlxtnbnrirxhwuyqjlzw.supabase.co',
SK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpseHRuYm5yaXJ4aHd1eXFqbHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NjYzOTAsImV4cCI6MjA5MTQ0MjM5MH0.MRhoVRDju41J8nWp4WTgiKOvxy7AgwGYH-el2zVsbWI',
CD=10000,AI=60000;
let last=0,tmr=null,lbE=[],lbM={},gD={};
const $=id=>document.getElementById(id);
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function toast(m){const t=$('toast');t.textContent=m;t.classList.add('sh');setTimeout(()=>t.classList.remove('sh'),2200)}

const MK=[
'<svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M6 2h12v6a6 6 0 01-12 0V2z" fill="rgba(250,204,21,.15)" stroke="#facc15" stroke-width="1.5"/><path d="M6 4H3a1 1 0 00-1 1v1a4 4 0 004 4" stroke="#facc15" stroke-width="1.5"/><path d="M18 4h3a1 1 0 011 1v1a4 4 0 01-4 4" stroke="#facc15" stroke-width="1.5"/><path d="M9 14h6v2a3 3 0 01-6 0v-2z" fill="rgba(250,204,21,.15)" stroke="#facc15" stroke-width="1.5"/><rect x="7" y="19" width="10" height="3" rx="1" fill="rgba(250,204,21,.12)" stroke="#facc15" stroke-width="1.5"/></svg>',
'<svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M6 2h12v6a6 6 0 01-12 0V2z" fill="rgba(148,163,184,.1)" stroke="#94a3b8" stroke-width="1.5"/><path d="M6 4H3a1 1 0 00-1 1v1a4 4 0 004 4" stroke="#94a3b8" stroke-width="1.5"/><path d="M18 4h3a1 1 0 011 1v1a4 4 0 01-4 4" stroke="#94a3b8" stroke-width="1.5"/><path d="M9 14h6v2a3 3 0 01-6 0v-2z" fill="rgba(148,163,184,.1)" stroke="#94a3b8" stroke-width="1.5"/><rect x="7" y="19" width="10" height="3" rx="1" fill="rgba(148,163,184,.08)" stroke="#94a3b8" stroke-width="1.5"/></svg>',
'<svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M6 2h12v6a6 6 0 01-12 0V2z" fill="rgba(217,119,6,.1)" stroke="#d97706" stroke-width="1.5"/><path d="M6 4H3a1 1 0 00-1 1v1a4 4 0 004 4" stroke="#d97706" stroke-width="1.5"/><path d="M18 4h3a1 1 0 011 1v1a4 4 0 01-4 4" stroke="#d97706" stroke-width="1.5"/><path d="M9 14h6v2a3 3 0 01-6 0v-2z" fill="rgba(217,119,6,.1)" stroke="#d97706" stroke-width="1.5"/><rect x="7" y="19" width="10" height="3" rx="1" fill="rgba(217,119,6,.08)" stroke="#d97706" stroke-width="1.5"/></svg>'
];

function tags(names,card,list,cnt){
cnt.textContent=names.length;
list.innerHTML=names.map((n,i)=>`<span class="ptg" style="animation-delay:${i*35}ms"><span class="pd"></span>${esc(n)}</span>`).join('');
card.style.display='';
}

async function sbPlayers(card,list,cnt,ac){
try{
const r=await fetch(`${SB}/rest/v1/leaderboard_sync?id=eq.current&select=online_players`,{headers:{apikey:SK,Authorization:`Bearer ${SK}`}});
const d=await r.json();
if(d&&d[0]&&d[0].online_players){
const p=typeof d[0].online_players==='string'?JSON.parse(d[0].online_players):d[0].online_players;
if(p.length>0){tags(p,card,list,cnt);return}
}
}catch{}
cnt.textContent=ac;
list.innerHTML='<div class="np">Memuat nama pemain...</div>';
card.style.display='';
}

async function fetchStatus(){
const now=Date.now(),btn=$('rbtn');
if(now-last<CD&&last!==0){toast(`Tunggu ${Math.ceil((CD-(now-last))/1000)}s...`);return}
last=now;btn.disabled=true;btn.classList.add('sp');
$('s-label').textContent='MEMUAT...';$('s-label').className='sl ld';$('s-orb').className='orb ld';
const t0=Date.now(),ctrl=new AbortController(),to=setTimeout(()=>ctrl.abort(),8000);
try{
const res=await fetch(API,{signal:ctrl.signal});clearTimeout(to);
const lat=Date.now()-t0,data=await res.json();
$('s-lat').textContent=lat;
document.querySelectorAll('.sk').forEach(e=>e.classList.remove('sk'));
if(data.online){
$('s-orb').className='orb on';$('s-label').textContent='ONLINE';$('s-label').className='sl on';
$('s-addr').textContent=`${HOST}:${PORT}`;
const on=data.players?.online??0,mx=data.players?.max??'?',ver=data.version??'Bedrock';
$('s-on').textContent=on;$('s-max').textContent=mx;$('s-ver').textContent=ver;
const pc=$('p-card'),pl=$('p-list'),pn=$('p-cnt');
if(data.players?.list&&data.players.list.length>0)tags(data.players.list,pc,pl,pn);
else if(on>0)sbPlayers(pc,pl,pn,on);
else pc.style.display='none';
}else{
$('s-orb').className='orb off';$('s-label').textContent='OFFLINE';$('s-label').className='sl off';
$('s-addr').textContent=`${HOST} — Server sedang mati`;
$('s-on').textContent='0';$('s-max').textContent='—';$('s-ver').textContent='—';
$('p-card').style.display='none';
}
$('s-upd').textContent=`Diperbarui ${new Date().toLocaleTimeString('id-ID')} WIB · Auto 60s`;
}catch{
clearTimeout(to);$('s-orb').className='orb off';$('s-label').textContent='ERROR';
$('s-label').className='sl off';$('s-upd').textContent='Gagal — coba refresh';
$('s-addr').textContent='Tidak dapat terhubung';
}finally{btn.disabled=false;btn.classList.remove('sp')}
}

function fmtT(ms){
if(ms<=0)return'Reset segera';
const d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4);
return d>0?`${d}h ${h}j lagi`:h>0?`${h}j ${m}m lagi`:`${m}m lagi`;
}

function renderLB(cat){
const tbl=$('lb-tbl'),me=$('lb-meta');
if(!lbE.length){tbl.innerHTML='<div class="emp">Belum ada data leaderboard</div>';if(me)me.textContent='';return}
let s;
if(cat==='score')s=[...lbE].sort((a,b)=>(b.score||0)-(a.score||0));
else s=[...lbE].sort((a,b)=>(b[cat]||0)-(a[cat]||0));
const u={score:'pts',kills:'kills',mined:'blok',placed:'blok',pvp:'kills'}[cat]||'pts';
tbl.innerHTML=s.slice(0,10).map((p,i)=>{
const rc=i<3?['r1','r2','r3'][i]:'rn';
const mk=i<3?MK[i]:`${i+1}`;
const v=cat==='score'?(p.score||0):(p[cat]||0);
const dt=cat==='score'?`K:${p.kills||0} · M:${(p.mined||0).toLocaleString('id-ID')} · B:${(p.placed||0).toLocaleString('id-ID')} · P:${p.pvp||0}`:'';
return`<div class="row" style="animation:fs .3s ${i*35}ms ease both"><div class="rk ${rc}">${mk}</div><div><div class="nm">${esc(p.name)}</div>${dt?`<div class="dt">${dt}</div>`:''}</div><div class="scr"><span class="v">${v.toLocaleString('id-ID')}</span><span class="u">${u}</span></div></div>`;
}).join('');
if(me&&lbM.synced_at){
const el=Date.now()-new Date(lbM.synced_at).getTime(),tl=Math.max(0,(lbM.time_left_ms||0)-el),sa=Math.round(el/6e4);
me.textContent=`Reset: ${fmtT(tl)} · Sync: ${sa<1?'baru saja':sa+'m lalu'}`;
}
}

const GC={gem:'var(--cyan)',coin:'var(--gold)',totalPulls:'var(--ac)',ptPulls:'#c084fc',eqPulls:'var(--orange)'};
const GU={gem:'Gem',coin:'Koin',totalPulls:'pull',ptPulls:'pull',eqPulls:'pull'};

function renderG(cat){
const tbl=$('g-tbl'),me=$('g-meta'),en=gD[cat]||[];
if(!en.length){tbl.innerHTML='<div class="emp">Belum ada data gacha</div>';if(me)me.textContent='';return}
const u=GU[cat]||'',c=GC[cat]||'var(--gold)';
tbl.innerHTML=en.slice(0,10).map((p,i)=>{
const rc=i<3?['r1','r2','r3'][i]:'rn',mk=i<3?MK[i]:`${i+1}`,v=p[cat]||0;
const dt=cat==='gem'?`Pull: ${p.totalPulls||0}x`:cat==='coin'?`Gem: ${(p.gem||0).toLocaleString('id-ID')}`:cat==='totalPulls'?`PT:${p.ptPulls||0} · EQ:${p.eqPulls||0}`:'';
return`<div class="row" style="animation:fs .3s ${i*35}ms ease both"><div class="rk ${rc}">${mk}</div><div><div class="nm">${esc(p.name)}</div>${dt?`<div class="dt">${dt}</div>`:''}</div><div class="scr"><span class="v" style="color:${c}">${v.toLocaleString('id-ID')}</span><span class="u">${u}</span></div></div>`;
}).join('');
if(me&&lbM.synced_at){const el=Date.now()-new Date(lbM.synced_at).getTime(),sa=Math.round(el/6e4);me.textContent=`Sync: ${sa<1?'baru saja':sa+'m lalu'}`}
}

async function fetchLB(){
try{
const r=await fetch(`${SB}/rest/v1/leaderboard_sync?id=eq.current&select=*`,{headers:{apikey:SK,Authorization:`Bearer ${SK}`}});
const d=await r.json();
if(d&&d[0]){
const row=d[0];
lbM={synced_at:row.synced_at,time_left_ms:row.time_left_ms,week_start:row.week_start};
lbE=typeof row.entries==='string'?JSON.parse(row.entries):(row.entries||[]);
if(row.gacha_lb)gD=typeof row.gacha_lb==='string'?JSON.parse(row.gacha_lb):row.gacha_lb;
}
}catch(e){console.warn('[LB]',e)}
renderLB(document.querySelector('#lb-tabs .tab.a')?.dataset.cat||'score');
renderG(document.querySelector('#g-tabs .tab.a')?.dataset.cat||'gem');
}

function bindTabs(id,fn){
$(id).addEventListener('click',e=>{
const t=e.target.closest('.tab');if(!t)return;
$(id).querySelectorAll('.tab').forEach(b=>b.classList.remove('a'));
t.classList.add('a');fn(t.dataset.cat);
});
}
bindTabs('lb-tabs',renderLB);
bindTabs('g-tabs',renderG);

fetchStatus();fetchLB();
tmr=setInterval(fetchStatus,AI);
document.addEventListener('visibilitychange',()=>{
if(document.hidden)clearInterval(tmr);
else{fetchStatus();tmr=setInterval(fetchStatus,AI)}
});
