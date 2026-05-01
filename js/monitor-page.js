/* monitor-page.js — Server Performance Monitor with BDS Metrics */
var SB_URL='https://jlxtnbnrirxhwuyqjlzw.supabase.co';
var SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpseHRuYm5yaXJ4aHd1eXFqbHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NjYzOTAsImV4cCI6MjA5MTQ0MjM5MH0.MRhoVRDju41J8nWp4WTgiKOvxy7AgwGYH-el2zVsbWI';
var $=function(id){return document.getElementById(id);};
var latHistory=[],MAX_HIST=60,chartCanvas=null,chartCtx=null,refreshTimer=null;
var serverIP='laughtale.my.id:19214',lastMetrics=null;

async function loadConfig(){
  try{
    var r=await fetch(SB_URL+'/rest/v1/site_config?key=eq.server_ip&select=value',{headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}});
    var d=await r.json();
    if(d&&d[0]&&d[0].value)serverIP=d[0].value;
  }catch(e){}
}

async function fetchBDSData(){
  try{
    var r=await fetch(SB_URL+'/rest/v1/leaderboard_sync?id=eq.current&select=online_players,synced_at,server_metrics',{headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}});
    var d=await r.json();if(!d||!d[0])return;var row=d[0];
    var players=[];
    try{players=JSON.parse(row.online_players||'[]');}catch(e){players=[];}
    var syncEl=$('sync-time');if(syncEl)syncEl.textContent=row.synced_at?timeAgo(row.synced_at):'\u2014';
    var spEl=$('sync-players');if(spEl)spEl.textContent=players.length;
    var list=$('player-grid');
    if(list){
      list.innerHTML=players.length?players.map(function(n){return'<span class="ptg"><span class="pd"></span>'+esc(n)+'</span>';}).join(''):'<div class="emp" style="padding:.75rem;font-size:.7rem">Tidak ada pemain online</div>';
    }
    var pc=$('player-card');if(pc)pc.style.display='block';
    if(row.server_metrics){
      try{
        var m=typeof row.server_metrics==='string'?JSON.parse(row.server_metrics):row.server_metrics;
        if(m&&m.ts)applyBDSMetrics(m);
      }catch(e){console.warn('[BDS metrics parse]',e);}
    }
  }catch(e){console.warn('[fetchBDSData]',e);}
}

function safeSet(id,text){var el=$(id);if(el)el.textContent=text;}
function safeClass(id,cls){var el=$(id);if(el)el.className=cls;}

function applyBDSMetrics(m){
  lastMetrics=m;
  var tps=m.tps||0;
  safeSet('m-tps',tps.toFixed(1));
  safeClass('m-tps','m-val '+(tps>=18?'good':tps>=15?'warn':'bad'));
  safeSet('mob-overworld',fmtN(m.mobs?m.mobs.overworld:0));
  safeSet('mob-nether',fmtN(m.mobs?m.mobs.nether:0));
  safeSet('mob-end',fmtN(m.mobs?m.mobs.the_end:0));
  safeSet('mob-total',fmtN(m.mobs?m.mobs.total:0));
  var totalMob=m.mobs?m.mobs.total:0;
  var mobLevel=$('mob-level');
  if(mobLevel){
    if(totalMob<150){mobLevel.textContent='Normal';mobLevel.className='pill g';}
    else if(totalMob<300){mobLevel.textContent='Sedang';mobLevel.className='pill y';}
    else{mobLevel.textContent='Tinggi!';mobLevel.className='pill r';}
  }
  safeSet('sum-entities',fmtN(m.entities?m.entities.total:0));
  safeSet('sum-mobs',fmtN(m.mobs?m.mobs.total:0));
  safeSet('sum-items',fmtN(m.items?m.items.total:0));
  safeSet('sum-players',m.players_online||0);
  safeSet('dim-ow',m.players_per_dim?m.players_per_dim.overworld:0);
  safeSet('dim-nether',m.players_per_dim?m.players_per_dim.nether:0);
  safeSet('dim-end',m.players_per_dim?m.players_per_dim.the_end:0);
  var dpPct=m.dp_pct||0;
  var dpFill=$('dp-bar-fill');
  if(dpFill){dpFill.style.width=dpPct+'%';dpFill.className='bar-fill '+(dpPct<50?'g':dpPct<80?'y':'r');}
  safeSet('dp-pct',dpPct+'%');
  safeSet('dp-detail',fmtBytes(m.dp_bytes||0)+' / '+fmtBytes(m.dp_max||1048576));
  var wt=m.world_time||0,td=wt%24000,tod='';
  if(td<6000)tod='Pagi';else if(td<12000)tod='Siang';else if(td<18000)tod='Sore';else tod='Malam';
  safeSet('world-time',tod+' ('+wt+')');
  safeSet('world-day','Hari ke-'+(m.world_day||0));
  safeSet('world-tick',fmtN(m.tick||0));
  safeSet('world-tps',tps.toFixed(1)+' / 20');
  var details=m.player_details||[];
  var tbody=$('player-details-body');
  if(tbody&&details.length){
    tbody.innerHTML=details.map(function(p){
      var dl={'overworld':'Overworld','nether':'Nether','the_end':'The End'}[p.dim]||p.dim;
      var co=p.x!==undefined?p.x+', '+p.y+', '+p.z:'\u2014';
      var pvp=p.pvp?'<span style="color:var(--red);font-weight:600">ON</span>':'<span style="color:var(--green);font-weight:600">OFF</span>';
      return'<tr><td>'+esc(p.name)+'</td><td>'+dl+'</td><td class="mono">'+co+'</td><td>'+(p.gamemode||'\u2014')+'</td><td>'+pvp+'</td></tr>';
    }).join('');
    var pdc=$('player-details-card');if(pdc)pdc.style.display='block';
  }
  safeSet('metrics-time',m.ts?timeAgo(new Date(m.ts).toISOString()):'\u2014');
  var bds=$('bds-metrics');if(bds)bds.style.display='block';
  var bd=m.entity_breakdown||[];
  var ebCard=$('entity-breakdown-card');
  var ebBody=$('entity-breakdown-body');
  if(ebCard&&ebBody&&bd.length){
    var maxC=bd[0].count||1;
    ebBody.innerHTML=bd.map(function(e,i){
      var pct=Math.round(e.count/maxC*100);
      var color=e.id==='item'?'var(--gold)':pct>60?'var(--red)':pct>30?'var(--orange)':'var(--green)';
      return'<tr><td class="mono" style="text-align:center">'+(i+1)+'</td><td class="mono">'+esc(e.id)+'</td><td class="mono" style="text-align:right;color:'+color+'">'+e.count+'</td><td><div style="height:4px;background:var(--surface);border-radius:2px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:'+color+';border-radius:2px"></div></div></td></tr>';
    }).join('');
  }
  updateDiag(m);
}

function updateDiag(m){
  var diags=[],tps=m.tps||0,totalMob=m.mobs?m.mobs.total:0,totalItem=m.items?m.items.total:0,dpPct=m.dp_pct||0;
  if(tps<10)diags.push({t:'TPS sangat rendah ('+tps.toFixed(1)+'/20). Server sangat lag.',l:'bad'});
  else if(tps<15)diags.push({t:'TPS di bawah normal ('+tps.toFixed(1)+'/20). Ada tekanan pada server.',l:'warn'});
  else if(tps<18)diags.push({t:'TPS sedikit turun ('+tps.toFixed(1)+'/20). Masih playable.',l:'warn'});
  else diags.push({t:'TPS normal ('+tps.toFixed(1)+'/20). Server berjalan lancar.',l:'good'});
  if(totalMob>300)diags.push({t:'Total mob sangat tinggi ('+fmtN(totalMob)+').',l:'bad'});
  else if(totalMob>150)diags.push({t:'Total mob cukup tinggi ('+fmtN(totalMob)+').',l:'warn'});
  if(totalItem>100)diags.push({t:'Item drops: '+fmtN(totalItem)+'. Bersihkan area farm.',l:'warn'});
  if(dpPct>80)diags.push({t:'DP usage tinggi ('+dpPct+'%).',l:'bad'});
  else if(dpPct>50)diags.push({t:'DP usage sedang ('+dpPct+'%).',l:'warn'});
  var ow=m.mobs?m.mobs.overworld:0,ne=m.mobs?m.mobs.nether:0;
  if(ow>200)diags.push({t:'Overworld: '+fmtN(ow)+' mob aktif.',l:'warn'});
  if(ne>100)diags.push({t:'Nether: '+fmtN(ne)+' mob aktif.',l:'warn'});
  if(diags.every(function(d){return d.l==='good';}))diags.push({t:'Semua metrik normal. Server dalam kondisi optimal.',l:'good'});
  var ic={good:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',warn:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',bad:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'};
  var diagEl=$('diagnostics');
  if(diagEl)diagEl.innerHTML=diags.map(function(d){return'<div class="diag-item '+d.l+'"><span class="diag-icon">'+(ic[d.l]||ic.good)+'</span><span>'+d.t+'</span></div>';}).join('');
}

function updateBasicDiag(online,latency,players,maxP){
  var diags=[];
  var ic={good:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',warn:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',bad:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'};
  if(!online){
    diags.push({t:'Server sedang offline atau tidak dapat dijangkau.',l:'bad'});
  }else{
    if(latency<100)diags.push({t:'Latency sangat rendah ('+latency+'ms). Koneksi ideal.',l:'good'});
    else if(latency<200)diags.push({t:'Latency baik ('+latency+'ms). Koneksi stabil.',l:'good'});
    else if(latency<400)diags.push({t:'Latency sedang ('+latency+'ms). Mungkin ada sedikit delay.',l:'warn'});
    else diags.push({t:'Latency tinggi ('+latency+'ms). Koneksi lambat, cek internet.',l:'bad'});
    var pct=maxP>0?Math.round(players/maxP*100):0;
    if(pct>=90)diags.push({t:'Server hampir penuh ('+players+'/'+maxP+'). Performa bisa turun.',l:'warn'});
    else if(pct>=70)diags.push({t:'Beban pemain cukup tinggi ('+players+'/'+maxP+').',l:'warn'});
    else if(players>0)diags.push({t:players+' pemain online. Beban server normal.',l:'good'});
    else diags.push({t:'Tidak ada pemain online saat ini.',l:'good'});
    if(diags.every(function(d){return d.l==='good';}))diags.push({t:'Semua indikator normal. Server berjalan optimal.',l:'good'});
  }
  var diagEl=$('diagnostics');
  if(diagEl)diagEl.innerHTML=diags.map(function(d){return'<div class="diag-item '+d.l+'"><span class="diag-icon">'+(ic[d.l]||ic.good)+'</span><span>'+d.t+'</span></div>';}).join('');
}

async function fetchStatus(){
  var btn=$('refresh-btn');
  if(btn){btn.disabled=true;btn.textContent='\u27f3 MEMUAT...';}
  // Set loading state
  safeClass('s-orb','orb ld');
  safeSet('s-label','MEMUAT...');safeClass('s-label','sl ld');
  var host=serverIP.split(':')[0]||'laughtale.my.id';
  var port=serverIP.split(':')[1]||'19214';
  var t0=Date.now();
  var fetchOK=false;
  try{
    var ctrl=new AbortController();
    var tm=setTimeout(function(){ctrl.abort();},10000);
    var r=await fetch('https://api.mcsrvstat.us/bedrock/3/'+host+':'+port,{signal:ctrl.signal});
    clearTimeout(tm);
    var latency=Date.now()-t0;
    var d=await r.json();
    var online=!!d.online;
    var players=d.players?d.players.online||0:0;
    var maxP=d.players?d.players.max||0:0;
    var version=d.version||'\u2014';
    // Populate data
    safeSet('s-addr',host+':'+port);
    safeSet('m-latency',latency);safeClass('m-latency','m-val '+(latency<200?'good':latency<500?'warn':'bad'));
    safeSet('m-players',players+'/'+maxP);
    safeSet('m-version',version);
    safeSet('m-status',online?'Online':'Offline');safeClass('m-status','m-val '+(online?'good':'bad'));
    // Latency quality
    var li=$('lat-indicator');
    if(li){
      if(latency<150){li.textContent='Sangat Baik';li.className='lat-ind good';}
      else if(latency<300){li.textContent='Normal';li.className='lat-ind ok';}
      else if(latency<600){li.textContent='Lambat';li.className='lat-ind warn';}
      else{li.textContent='Sangat Lambat';li.className='lat-ind bad';}
    }
    // Load bar
    var loadPct=maxP?Math.round(players/maxP*100):0;
    var lbf=$('load-bar-fill');
    if(lbf){lbf.style.width=loadPct+'%';lbf.className='bar-fill '+(loadPct<50?'g':loadPct<80?'y':'r');}
    safeSet('load-pct',loadPct+'%');
    // Update status orb LAST (after all data is set)
    safeClass('s-orb','orb '+(online?'on':'off'));
    safeSet('s-label',online?'ONLINE':'OFFLINE');
    safeClass('s-label','sl '+(online?'on':'off'));
    fetchOK=true;
    // Basic diagnostics from public API data (always available)
    updateBasicDiag(online,latency,players,maxP);
    // Chart (in its own try-catch so chart bugs don't affect status)
    try{
      var now=new Date();
      latHistory.push({time:now,latency:latency,players:players,online:online});
      if(latHistory.length>MAX_HIST)latHistory.shift();
      drawChart();
    }catch(chartErr){console.warn('[Chart]',chartErr);}
    safeSet('last-update','Terakhir: '+new Date().toLocaleTimeString('id-ID')+' WIB');
  }catch(e){
    console.error('[fetchStatus]',e);
    if(!fetchOK){
      safeClass('s-orb','orb off');
      safeSet('s-label','OFFLINE');safeClass('s-label','sl off');
      safeSet('s-addr','Tidak dapat terhubung');
    }
  }finally{
    if(btn){btn.disabled=false;btn.textContent='\u27f3 REFRESH';}
  }
  // BDS data in separate try-catch
  try{await fetchBDSData();}catch(e){console.warn('[BDS]',e);}
}

function updateOrb(on){var el=$('s-orb');if(el)el.className='orb '+(on?'on':'off');}

function drawChart(){
  if(!chartCanvas||!chartCtx||latHistory.length<2)return;
  var parent=chartCanvas.parentElement;
  var W=680;
  if(parent){W=parent.clientWidth||parent.offsetWidth||680;}
  if(W<100)W=680;
  var H=180;
  chartCanvas.width=W;chartCanvas.height=H;
  var ctx=chartCtx;ctx.clearRect(0,0,W,H);
  var pad={t:20,r:15,b:30,l:45},cw=W-pad.l-pad.r,ch=H-pad.t-pad.b;
  if(cw<=0||ch<=0)return;
  var maxLat=100;
  for(var i=0;i<latHistory.length;i++){if(latHistory[i].latency>maxLat)maxLat=latHistory[i].latency;}
  maxLat=Math.ceil(maxLat*1.2);
  // Grid lines
  ctx.strokeStyle='rgba(255,255,255,0.06)';ctx.lineWidth=1;
  for(var i=0;i<=4;i++){var y=pad.t+ch*(i/4);ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();ctx.fillStyle='rgba(255,255,255,0.25)';ctx.font='10px JetBrains Mono,monospace';ctx.textAlign='right';ctx.fillText(Math.round(maxLat*(1-i/4))+'ms',pad.l-6,y+4);}
  // Line
  ctx.beginPath();ctx.strokeStyle='#a855f7';ctx.lineWidth=2;ctx.lineJoin='round';
  var pts=latHistory.length;
  for(var i=0;i<pts;i++){var x=pad.l+(pts>1?cw*(i/(pts-1)):0),y=pad.t+ch*(1-latHistory[i].latency/maxLat);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
  ctx.stroke();
  // Fill
  var grad=ctx.createLinearGradient(0,pad.t,0,H-pad.b);grad.addColorStop(0,'rgba(168,85,247,0.12)');grad.addColorStop(1,'rgba(168,85,247,0)');
  ctx.lineTo(pad.l+(pts>1?cw:0),H-pad.b);ctx.lineTo(pad.l,H-pad.b);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
  // Dots
  for(var i=0;i<pts;i++){var x=pad.l+(pts>1?cw*(i/(pts-1)):0),y=pad.t+ch*(1-latHistory[i].latency/maxLat);ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fillStyle=latHistory[i].latency<200?'#34d399':latHistory[i].latency<500?'#f5c842':'#f87171';ctx.fill();}
  // Time labels
  ctx.fillStyle='rgba(255,255,255,0.25)';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='center';
  var step=Math.max(1,Math.floor(pts/6));
  for(var i=0;i<pts;i+=step){var x=pad.l+(pts>1?cw*(i/(pts-1)):0),t=latHistory[i].time;ctx.fillText(t.getHours()+':'+String(t.getMinutes()).padStart(2,'0'),x,H-pad.b+14);}
}

function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
function fmtN(n){return(n||0).toLocaleString('id-ID');}
function fmtBytes(b){if(b<1024)return b+'B';if(b<1048576)return(b/1024).toFixed(1)+'KB';return(b/1048576).toFixed(2)+'MB';}
function timeAgo(ts){var s=Math.floor((Date.now()-new Date(ts).getTime())/1000);if(s<60)return s+'s lalu';if(s<3600)return Math.floor(s/60)+'m lalu';if(s<86400)return Math.floor(s/3600)+'j lalu';return Math.floor(s/86400)+'h lalu';}

window.addEventListener('DOMContentLoaded',function(){
  chartCanvas=$('latency-chart');
  if(chartCanvas)chartCtx=chartCanvas.getContext('2d');
  loadConfig().then(function(){
    fetchStatus();
    refreshTimer=setInterval(fetchStatus,30000);
  });
});
window.addEventListener('resize',function(){
  if(latHistory.length>1)requestAnimationFrame(drawChart);
  drawMHChart();
});
document.addEventListener('visibilitychange',function(){
  if(document.hidden){if(refreshTimer)clearInterval(refreshTimer);}
  else{fetchStatus();refreshTimer=setInterval(fetchStatus,30000);}
});
window.doRefresh=function(){fetchStatus();};

var mhData=[],mhRange='day';
var MH_COLORS={tps:'#34d399',players:'#a855f7',mobs:'#fb923c',entities:'#22d3ee',items:'#f87171'};
var MH_SCALES={tps:20,players:100,mobs:500,entities:1000,items:200};
var mhActive={tps:true,players:true,mobs:true,entities:true,items:true};

function getMHCanvas(){return $('mh-chart');}

async function fetchMH(){
  var ranges={day:'24',week:'168',month:'720'};
  var hours=ranges[mhRange]||'24';
  var since=new Date(Date.now()-hours*3600000).toISOString();
  try{
    var r=await fetch(SB_URL+'/rest/v1/metrics_history?ts=gte.'+since+'&order=ts.asc&limit=2000',
      {headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}});
    var d=await r.json();
    if(Array.isArray(d)){
      mhData=d;
      drawMHChart();
      var info=$('mh-info');
      if(info)info.textContent=d.length>0?d.length+' data points':'Belum ada data histori. Data akan muncul setelah BDS sync berjalan.';
    }
  }catch(e){
    var info=$('mh-info');
    if(info)info.textContent='Gagal memuat data histori.';
  }
}

function hexAlpha(hex,a){
  var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return'rgba('+r+','+g+','+b+','+a+')';
}

function drawMHChart(){
  try{
  var canvas=getMHCanvas();
  if(!canvas||!mhData.length)return;
  var parent=canvas.parentElement;
  var W=parent?(parent.clientWidth||680):680;
  if(W<100)W=680;
  var H=220;
  canvas.width=W;canvas.height=H;
  var ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);
  var pad={t:20,r:15,b:30,l:45},cw=W-pad.l-pad.r,ch=H-pad.t-pad.b;
  if(cw<=0||ch<=0)return;
  var keys=Object.keys(MH_COLORS).filter(function(k){return mhActive[k];});
  if(!keys.length)return;
  var maxVals={};
  keys.forEach(function(k){
    var mx=0;
    for(var i=0;i<mhData.length;i++){var v=mhData[i][k]||0;if(v>mx)mx=v;}
    maxVals[k]=Math.max(mx*1.2,MH_SCALES[k]||10);
  });
  var globalMax=0;
  keys.forEach(function(k){if(maxVals[k]>globalMax)globalMax=maxVals[k];});
  if(globalMax<=0)globalMax=1;
  ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=1;
  for(var i=0;i<=4;i++){
    var y=pad.t+ch*(i/4);
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.2)';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='right';
    ctx.fillText(Math.round(globalMax*(1-i/4)),pad.l-6,y+3);
  }
  var pts=mhData.length;
  keys.forEach(function(k){
    var color=MH_COLORS[k];
    ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.lineJoin='round';
    for(var i=0;i<pts;i++){
      var x=pad.l+(pts>1?cw*(i/(pts-1)):0);
      var v=mhData[i][k]||0;
      var y=pad.t+ch*(1-v/globalMax);
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.stroke();
    var grad=ctx.createLinearGradient(0,pad.t,0,H-pad.b);
    grad.addColorStop(0,hexAlpha(color,0.06));
    grad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.lineTo(pad.l+(pts>1?cw:0),H-pad.b);ctx.lineTo(pad.l,H-pad.b);ctx.closePath();
    ctx.fillStyle=grad;ctx.fill();
  });
  ctx.fillStyle='rgba(255,255,255,0.2)';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='center';
  var step=Math.max(1,Math.floor(pts/6));
  var fmtLabel=mhRange==='day'?function(d){return d.getHours()+':'+String(d.getMinutes()).padStart(2,'0');}:
    function(d){return d.getDate()+'/'+(d.getMonth()+1);};
  for(var i=0;i<pts;i+=step){
    var x=pad.l+(pts>1?cw*(i/(pts-1)):0);
    var t=new Date(mhData[i].ts);
    ctx.fillText(fmtLabel(t),x,H-pad.b+14);
  }
  }catch(e){console.warn('[MHChart]',e);}
}

(function(){
  var tabs=$('mh-tabs');
  if(tabs)tabs.addEventListener('click',function(e){
    var t=e.target.closest('.tab');if(!t)return;
    tabs.querySelectorAll('.tab').forEach(function(b){b.classList.remove('a');});
    t.classList.add('a');
    mhRange=t.dataset.range;
    fetchMH();
  });
  var legend=$('mh-legend');
  if(legend)legend.addEventListener('click',function(e){
    var leg=e.target.closest('.mh-leg');if(!leg)return;
    var k=leg.dataset.key;
    mhActive[k]=!mhActive[k];
    leg.classList.toggle('active');
    drawMHChart();
  });
  fetchMH();
})();
