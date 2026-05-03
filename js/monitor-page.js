/* monitor-page.js - Server Performance Monitor with BDS Metrics */
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
  radarPlayers=m.player_details||[];
  radarLands=m.land_claims||[];
  if(radarPlayers.length||radarLands.length){
    drawRadar();
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
  drawRadar();
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

var radarPlayers=[],radarLands=[],radarDim='overworld',radarZoom=500;
var radarPanX=0,radarPanZ=0,radarDrag=false,radarDragStart={x:0,z:0,px:0,pz:0};
var radarHistory=[],radarTimeIdx=-1,radarRaf=0,radarAnimId=0,rSel=null,rFollow=true;
var DIM_COLORS={overworld:'#34d399',nether:'#fb923c',the_end:'#a855f7'};
var DIM_SHORT={o:'overworld',n:'nether',t:'the_end'};
var LAND_COLORS=['#34d399','#60a5fa','#f472b6','#a78bfa','#fbbf24','#fb923c','#38bdf8','#4ade80'];
var TC=['#34d399','#60a5fa','#f472b6','#a78bfa','#fbbf24','#fb923c','#38bdf8','#4ade80','#f87171','#22d3ee'];

function nameHash(n){var h=0;for(var i=0;i<n.length;i++)h=((h<<5)-h)+n.charCodeAt(i)|0;return Math.abs(h);}
var SK=['#c68642','#8d5524','#e0ac69','#f1c27d','#ffdbac','#d2a679','#a0785a','#7b5b3a'];
var HK=['#3b2217','#1a1110','#4a2912','#6b3a24','#d4a76a','#c23616','#2d3436','#636e72'];
var HF=[[1,1,1,1,1,1,1,1],[1,1,2,2,2,2,1,1],[2,2,2,2,2,2,2,2],[2,3,0,2,2,0,3,2],[2,2,2,4,4,2,2,2],[2,2,2,2,2,2,2,2],[2,2,5,5,5,5,2,2],[2,2,2,2,2,2,2,2]];

function drawHead(ctx,x,y,name,pvp,dc,sz){
  sz=sz||18;var ps=sz/8,hx=Math.floor(x-sz/2),hy=Math.floor(y-sz/2);
  var h=nameHash(name||'?'),skin=SK[h%SK.length],hair=HK[(h>>4)%HK.length];
  var r=Math.max(0,parseInt(skin.slice(1,3),16)-20),g=Math.max(0,parseInt(skin.slice(3,5),16)-15),b=Math.max(0,parseInt(skin.slice(5,7),16)-10);
  var nose='#'+r.toString(16).padStart(2,'0')+g.toString(16).padStart(2,'0')+b.toString(16).padStart(2,'0');
  var cl=['#1a1a2e',hair,skin,'#fff',nose,'#2d1810'];
  ctx.save();
  if(pvp){ctx.shadowColor='#f87171';ctx.shadowBlur=8;}
  else if(name===rSel){ctx.shadowColor='#fbbf24';ctx.shadowBlur=10;}
  else{ctx.shadowColor=dc;ctx.shadowBlur=4;}
  ctx.fillStyle='#111';ctx.beginPath();ctx.roundRect(hx-1,hy-1,sz+2,sz+2,2);ctx.fill();ctx.shadowBlur=0;
  for(var rr=0;rr<8;rr++)for(var cc=0;cc<8;cc++){ctx.fillStyle=cl[HF[rr][cc]];ctx.fillRect(hx+cc*ps,hy+rr*ps,Math.ceil(ps),Math.ceil(ps));}
  if(name===rSel){ctx.strokeStyle='#fbbf24';ctx.lineWidth=2;ctx.strokeRect(hx-2,hy-2,sz+4,sz+4);}
  ctx.restore();
}

var _lastAP=[],_expSet=new Set(),_expLast=0,_EXP_CS=128;
function _computeExp(){
  _expSet.clear();
  for(var i=0;i<radarHistory.length;i++){var s=radarHistory[i];if(!s||!s._pos)continue;for(var j=0;j<s._pos.length;j++){var p=s._pos[j],dm=DIM_SHORT[p.d]||'overworld',cx=Math.floor(p.x/_EXP_CS),cz=Math.floor(p.z/_EXP_CS);for(var dx=-2;dx<=2;dx++)for(var dz=-2;dz<=2;dz++)_expSet.add(dm+':'+(cx+dx)+','+(cz+dz));}}
  for(var i=0;i<radarPlayers.length;i++){var p=radarPlayers[i];if(!p||p.x===undefined)continue;var cx=Math.floor(p.x/_EXP_CS),cz=Math.floor(p.z/_EXP_CS);for(var dx=-2;dx<=2;dx++)for(var dz=-2;dz<=2;dz++)_expSet.add((p.dim||'overworld')+':'+(cx+dx)+','+(cz+dz));}
  _expLast=Date.now();
}
function drawRadar(){
  try{
  var canvas=$('radar-canvas');if(!canvas)return;
  var par=canvas.parentElement;
  var dpr=window.devicePixelRatio||1;
  var isFS=!!(document.fullscreenElement||document.webkitFullscreenElement);
  var W=par?(par.clientWidth||600):600;if(W<100)W=600;
  var H=isFS?(par.clientHeight||window.innerHeight-130):400;
  canvas.width=W*dpr;canvas.height=H*dpr;
  canvas.style.width=W+'px';canvas.style.height=H+'px';
  var ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#0a0e14';ctx.fillRect(0,0,W,H);
  var cX=W/2,cY=H/2,sc=Math.min(W,H)/(radarZoom*2);
  if(Date.now()-_expLast>30000)_computeExp();
  var _cw=_EXP_CS*sc;
  if(_cw>=2&&_expSet.size>0){var _rng2=radarZoom*1.2;var _sx=Math.floor((radarPanX-_rng2)/_EXP_CS),_ex=Math.ceil((radarPanX+_rng2)/_EXP_CS),_sz=Math.floor((radarPanZ-_rng2)/_EXP_CS),_ez=Math.ceil((radarPanZ+_rng2)/_EXP_CS);for(var _cx=_sx;_cx<=_ex;_cx++){for(var _cz=_sz;_cz<=_ez;_cz++){var _fx=cX+(_cx*_EXP_CS-radarPanX)*sc,_fz=cY+(_cz*_EXP_CS-radarPanZ)*sc;if(_fx+_cw<0||_fx>W||_fz+_cw<0||_fz>H)continue;ctx.fillStyle=_expSet.has(radarDim+':'+_cx+','+_cz)?'rgba(52,211,153,0.018)':'rgba(0,0,0,0.18)';ctx.fillRect(_fx,_fz,_cw,_cw);}}}
  var isLive=radarTimeIdx<0||radarTimeIdx>=radarHistory.length;
  if(rSel&&rFollow){
    var _allP=isLive?radarPlayers:((radarHistory[radarTimeIdx]||{})._pos||[]);
    var _inCur=false,_oDim=null;
    for(var i=0;i<_allP.length;i++){var _pn=isLive?_allP[i].name:_allP[i].n;var _pd=isLive?_allP[i].dim:(DIM_SHORT[_allP[i].d]||'overworld');if(_pn===rSel){if(_pd===radarDim){_inCur=true;break;}else{_oDim=_pd;}}}
    if(!_inCur&&_oDim){radarDim=_oDim;var _dt=$('radar-dim-tabs');if(_dt)_dt.querySelectorAll('.tab').forEach(function(b){b.classList.remove('a');if(b.dataset.dim===_oDim)b.classList.add('a');});}
  }
  var ap;
  if(isLive){ap=radarPlayers.filter(function(p){return p.dim===radarDim&&p.x!==undefined;});}
  else{var sn=radarHistory[radarTimeIdx];var pd=sn?sn._pos:[];ap=pd.filter(function(p){return(DIM_SHORT[p.d]||'overworld')===radarDim;}).map(function(p){return{name:p.n,x:p.x,z:p.z,pvp:!!p.p};});}
  _lastAP=ap;
  if(rSel&&rFollow){for(var i=0;i<ap.length;i++){if(ap[i].name===rSel){radarPanX=ap[i].x;radarPanZ=ap[i].z;break;}}}
  var GS=[10,25,50,100,250,500,1000,2500,5000],gs=GS[GS.length-1];
  for(var i=0;i<GS.length;i++){if(GS[i]*sc>=55){gs=GS[i];break;}}
  var rng=radarZoom*1.2;
  ctx.setLineDash([2,4]);ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=1;
  var s1=Math.floor((radarPanX-rng)/gs)*gs,e1=Math.ceil((radarPanX+rng)/gs)*gs;
  for(var g=s1;g<=e1;g+=gs){var gx=cX+(g-radarPanX)*sc;if(gx>=0&&gx<=W){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke();if(g!==0){ctx.fillStyle='rgba(255,255,255,0.2)';ctx.font='7px JetBrains Mono,monospace';ctx.textAlign='center';ctx.fillText(g,gx,H-4);}}}
  s1=Math.floor((radarPanZ-rng)/gs)*gs;e1=Math.ceil((radarPanZ+rng)/gs)*gs;
  for(var g=s1;g<=e1;g+=gs){var gy=cY+(g-radarPanZ)*sc;if(gy>=0&&gy<=H){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();if(g!==0){ctx.fillStyle='rgba(255,255,255,0.2)';ctx.font='7px JetBrains Mono,monospace';ctx.textAlign='left';ctx.fillText(g,4,gy-2);}}}
  ctx.setLineDash([]);
  var ox=cX-radarPanX*sc,oz=cY-radarPanZ*sc;
  if(ox>=0&&ox<=W&&oz>=0&&oz<=H){ctx.strokeStyle='rgba(255,255,255,0.1)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(ox,0);ctx.lineTo(ox,H);ctx.stroke();ctx.beginPath();ctx.moveTo(0,oz);ctx.lineTo(W,oz);ctx.stroke();ctx.fillStyle='rgba(255,255,255,0.3)';ctx.font='600 7px JetBrains Mono,monospace';ctx.textAlign='left';ctx.fillText('0,0',ox+4,oz-4);}
  var _lVis=0,_lTot=0;
  if(radarLands&&radarLands.length){for(var li=0;li<radarLands.length;li++){var l=radarLands[li];if(!l||l.x1==null)continue;if((DIM_SHORT[l.d]||'overworld')!==radarDim)continue;_lTot++;var lx1=cX+(Math.min(l.x1,l.x2)-radarPanX)*sc,lz1=cY+(Math.min(l.z1,l.z2)-radarPanZ)*sc,lx2=cX+(Math.max(l.x1,l.x2)-radarPanX)*sc,lz2=cY+(Math.max(l.z1,l.z2)-radarPanZ)*sc,lw=lx2-lx1,lh=lz2-lz1;if(lx2<0||lx1>W||lz2<0||lz1>H)continue;_lVis++;var lc=LAND_COLORS[nameHash(l.o)%LAND_COLORS.length];ctx.globalAlpha=0.07;ctx.fillStyle=lc;ctx.fillRect(lx1,lz1,lw,lh);ctx.globalAlpha=0.3;ctx.strokeStyle=lc;ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.strokeRect(lx1,lz1,lw,lh);ctx.setLineDash([]);if(lw>30&&lh>14){ctx.globalAlpha=0.45;ctx.font='600 7px JetBrains Mono,monospace';ctx.textAlign='left';ctx.fillStyle=lc;ctx.fillText(l.n,Math.max(lx1+3,2),Math.max(lz1+9,10));}ctx.globalAlpha=1;}}
  if(!isLive&&radarTimeIdx>0){
    var tr={},st=Math.max(0,radarTimeIdx-24);
    for(var t=st;t<=radarTimeIdx;t++){var sn=radarHistory[t];if(!sn||!sn._pos)continue;for(var j=0;j<sn._pos.length;j++){var tp=sn._pos[j];if((DIM_SHORT[tp.d]||'overworld')!==radarDim)continue;if(!tr[tp.n])tr[tp.n]=[];tr[tp.n].push({x:tp.x,z:tp.z,t:t});}}
    var an=(Date.now()%1800)/1800,nk=Object.keys(tr);
    for(var ni=0;ni<nk.length;ni++){
      var tn=nk[ni],pts=tr[tn];if(pts.length<2)continue;
      if(rSel&&rSel!==tn)continue;
      var pc=TC[nameHash(tn)%TC.length];ctx.fillStyle=pc;
      for(var pi=1;pi<pts.length;pi++){
        var a=pts[pi-1],b=pts[pi];
        var ax=cX+(a.x-radarPanX)*sc,az=cY+(a.z-radarPanZ)*sc,bx=cX+(b.x-radarPanX)*sc,bz=cY+(b.z-radarPanZ)*sc;
        var dx=bx-ax,dz=bz-az,sl=Math.sqrt(dx*dx+dz*dz);if(sl<2)continue;
        var nd=Math.max(1,Math.floor(sl/12)),age=(b.t-st)/(radarTimeIdx-st+1);
        for(var di=0;di<nd;di++){var fr=((di+an*nd)%nd)/nd;var mx=ax+dx*fr,mz=az+dz*fr;if(mx<-4||mx>W+4||mz<-4||mz>H+4)continue;ctx.globalAlpha=(0.12+age*0.6)*(0.3+0.7*fr);ctx.beginPath();ctx.arc(mx,mz,1.8,0,6.28);ctx.fill();}
        if(sl>22){var hx=ax+dx*0.82,hz=az+dz*0.82,ag=Math.atan2(dz,dx);ctx.globalAlpha=0.25+age*0.45;ctx.beginPath();ctx.moveTo(hx+4*Math.cos(ag),hz+4*Math.sin(ag));ctx.lineTo(hx-4*Math.cos(ag-.5),hz-4*Math.sin(ag-.5));ctx.lineTo(hx-4*Math.cos(ag+.5),hz-4*Math.sin(ag+.5));ctx.closePath();ctx.fill();}
      }

    }
    ctx.globalAlpha=1;
  }
  var dc=DIM_COLORS[radarDim]||'#34d399';
  for(var i=0;i<ap.length;i++){
    var p=ap[i],px=cX+(p.x-radarPanX)*sc,pz=cY+(p.z-radarPanZ)*sc;
    if(px<-20||px>W+20||pz<-20||pz>H+20)continue;
    var dim=rSel&&rSel!==p.name;
    if(dim)ctx.globalAlpha=0.25;
    drawHead(ctx,px,pz,p.name,p.pvp,dc,18);
    ctx.save();if(!dim){ctx.shadowColor='rgba(0,0,0,0.7)';ctx.shadowBlur=2;ctx.shadowOffsetY=1;}
    ctx.fillStyle=dim?'rgba(255,255,255,0.25)':'#fff';ctx.font='600 10px Inter,sans-serif';ctx.textAlign='center';ctx.fillText(p.name,px,pz-14);ctx.restore();
    ctx.fillStyle=dim?'rgba(255,255,255,0.12)':'rgba(255,255,255,0.35)';ctx.font='500 7px JetBrains Mono,monospace';ctx.textAlign='center';ctx.fillText(p.x+', '+p.z,px,pz+18);
    if(p.pvp&&!dim){ctx.fillStyle='rgba(248,113,113,0.8)';ctx.font='700 6px JetBrains Mono,monospace';ctx.fillText('\u2694 PVP',px,pz+26);}
    if(dim)ctx.globalAlpha=1;
  }
  ctx.fillStyle='rgba(255,255,255,0.2)';ctx.font='600 10px Inter,sans-serif';ctx.textAlign='center';
  ctx.fillText('N',W/2,13);ctx.fillText('S',W/2,H-5);ctx.fillText('W',9,H/2+4);ctx.fillText('E',W-9,H/2+4);
  safeSet('radar-count',ap.length+' pemain'+(_lTot?' \u00b7 '+_lVis+'/'+_lTot+' land':''));safeSet('radar-zoom-label','Zoom: '+radarZoom+' blok');
  _rInfo(ap);
  }catch(e){console.warn('[R]',e);}
}

function _rInfo(ap){
  var pn=$('radar-info'),ct=$('radar-info-content');if(!pn||!ct)return;
  if(!rSel){pn.style.display='none';return;}
  pn.style.display='flex';
  var p=null;for(var i=0;i<ap.length;i++){if(ap[i].name===rSel){p=ap[i];break;}}
  if(!p){
    var _any=false;for(var i=0;i<radarPlayers.length;i++){if(radarPlayers[i].name===rSel){_any=true;break;}}
    ct.innerHTML='<b style="color:#fff;font-size:.7rem">'+esc(rSel)+'</b><br><span style="font-size:.52rem;color:'+(_any?'var(--dim)':'#f87171')+'">'+(_any?'Berpindah dimensi...':'Offline')+'</span>';return;
  }
  var h='<b style="color:#fff;font-size:.7rem">'+esc(p.name)+'</b>';
  h+='<div style="font-size:.55rem;color:var(--cyan);margin-top:2px">X: '+p.x+' &nbsp; Z: '+p.z+'</div>';
  h+='<div style="font-size:.48rem;color:var(--mute);margin-top:1px">'+radarDim.replace('_',' ')+'</div>';
  if(p.pvp)h+='<div style="font-size:.52rem;color:#f87171;font-weight:700;margin-top:1px">\u2694 PVP ON</div>';
  h+='<div style="font-size:.45rem;color:var(--mute);margin-top:3px">Klik map kosong untuk deselect</div>';
  ct.innerHTML=h;
}

function _rHit(canvas,e){
  var r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
  var W=parseInt(canvas.style.width)||600,H=parseInt(canvas.style.height)||400;
  var cX=W/2,cY=H/2,sc=Math.min(W,H)/(radarZoom*2),best=null,bd=625;
  for(var i=0;i<_lastAP.length;i++){var p=_lastAP[i];var px=cX+(p.x-radarPanX)*sc,pz=cY+(p.z-radarPanZ)*sc;var d=(mx-px)*(mx-px)+(my-pz)*(my-pz);if(d<bd){bd=d;best=p;}}
  return best;
}

function _startAnim(){if(radarAnimId)return;(function l(){radarAnimId=requestAnimationFrame(function(){drawRadar();if(radarTimeIdx>=0&&radarTimeIdx<radarHistory.length)l();else radarAnimId=0;});})();}
function _stopAnim(){if(radarAnimId){cancelAnimationFrame(radarAnimId);radarAnimId=0;}}

function _selectPlayer(name){
  rSel=name;rFollow=!!name;drawRadar();
  if(!name)_stopAnim();
  else if(radarTimeIdx>=0)_startAnim();
}

async function fetchRadarHistory(){
  try{
    var since=new Date(Date.now()-12*3600000).toISOString();
    var r=await fetch(SB_URL+'/rest/v1/metrics_history?ts=gte.'+since+'&order=ts.asc&limit=144&select=ts,pos',{headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}});
    var d=await r.json();
    if(Array.isArray(d)){radarHistory=d.slice(-144).map(function(row){var o={ts:row.ts,_pos:[]};try{o._pos=typeof row.pos==='string'?JSON.parse(row.pos):(Array.isArray(row.pos)?row.pos:[]);}catch(e){}return o;});var sl=$('radar-timeline');if(sl){sl.max=radarHistory.length;sl.value=radarHistory.length;}_computeExp();}
  }catch(e){}
}

(function(){
  var dt=$('radar-dim-tabs');
  if(dt)dt.addEventListener('click',function(e){var t=e.target.closest('.tab');if(!t)return;dt.querySelectorAll('.tab').forEach(function(b){b.classList.remove('a');});t.classList.add('a');radarDim=t.dataset.dim;drawRadar();});
  var fs=$('radar-fullscreen');
  if(fs)fs.addEventListener('click',function(){var c=$('player-details-card');if(!c)return;if(document.fullscreenElement||document.webkitFullscreenElement){(document.exitFullscreen||document.webkitExitFullscreen).call(document);}else{(c.requestFullscreen||c.webkitRequestFullscreen).call(c).then(function(){drawRadar();}).catch(function(){});}});
  document.addEventListener('fullscreenchange',function(){setTimeout(drawRadar,100);});
  document.addEventListener('webkitfullscreenchange',function(){setTimeout(drawRadar,100);});
  var ctr=$('radar-center');
  if(ctr)ctr.addEventListener('click',function(){radarPanX=0;radarPanZ=0;radarZoom=500;rSel=null;rFollow=false;drawRadar();});
  var ic=$('radar-info-close');
  if(ic)ic.addEventListener('click',function(){_selectPlayer(null);});
  var cv=$('radar-canvas');
  if(cv){
    var _clickStart={x:0,y:0,t:0};
    cv.addEventListener('mousedown',function(e){_clickStart={x:e.clientX,y:e.clientY,t:Date.now()};radarDrag=true;cv.style.cursor='grabbing';radarDragStart={x:e.clientX,z:e.clientY,px:radarPanX,pz:radarPanZ};});
    window.addEventListener('mousemove',function(e){if(!radarDrag)return;var sc=Math.min(parseInt(cv.style.width)||600,parseInt(cv.style.height)||400)/(radarZoom*2);radarPanX=radarDragStart.px-(e.clientX-radarDragStart.x)/sc;radarPanZ=radarDragStart.pz-(e.clientY-radarDragStart.z)/sc;rFollow=false;if(!radarRaf){radarRaf=requestAnimationFrame(function(){drawRadar();radarRaf=0;});}});
    window.addEventListener('mouseup',function(e){if(!radarDrag)return;radarDrag=false;cv.style.cursor='grab';var dx=e.clientX-_clickStart.x,dy=e.clientY-_clickStart.y;if(Math.abs(dx)<5&&Math.abs(dy)<5&&Date.now()-_clickStart.t<300){var hit=_rHit(cv,e);_selectPlayer(hit?hit.name:null);}});
    cv.addEventListener('wheel',function(e){e.preventDefault();radarZoom=e.deltaY>0?Math.min(10000,radarZoom*1.3):Math.max(50,radarZoom/1.3);radarZoom=Math.round(radarZoom);rFollow=false;if(!radarRaf){radarRaf=requestAnimationFrame(function(){drawRadar();radarRaf=0;});}},{passive:false});
    var rPinch={a:false,d0:0,z0:0};
    function _td(ts){var dx=ts[0].clientX-ts[1].clientX,dy=ts[0].clientY-ts[1].clientY;return Math.sqrt(dx*dx+dy*dy);}
    var _tStart={x:0,y:0,t:0};
    cv.addEventListener('touchstart',function(e){if(e.touches.length===2){e.preventDefault();radarDrag=false;rPinch.a=true;rPinch.d0=_td(e.touches);rPinch.z0=radarZoom;}else if(e.touches.length===1&&!rPinch.a){_tStart={x:e.touches[0].clientX,y:e.touches[0].clientY,t:Date.now()};radarDrag=true;radarDragStart={x:e.touches[0].clientX,z:e.touches[0].clientY,px:radarPanX,pz:radarPanZ};}},{passive:false});
    cv.addEventListener('touchmove',function(e){if(e.touches.length===2&&rPinch.a){e.preventDefault();radarZoom=Math.max(50,Math.min(10000,Math.round(rPinch.z0*(rPinch.d0/_td(e.touches)))));rFollow=false;if(!radarRaf){radarRaf=requestAnimationFrame(function(){drawRadar();radarRaf=0;});}}else if(e.touches.length===1&&radarDrag&&!rPinch.a){e.preventDefault();var t=e.touches[0],sc=Math.min(parseInt(cv.style.width)||600,parseInt(cv.style.height)||400)/(radarZoom*2);radarPanX=radarDragStart.px-(t.clientX-radarDragStart.x)/sc;radarPanZ=radarDragStart.pz-(t.clientY-radarDragStart.z)/sc;rFollow=false;if(!radarRaf){radarRaf=requestAnimationFrame(function(){drawRadar();radarRaf=0;});}}},{passive:false});
    cv.addEventListener('touchend',function(e){if(e.touches.length<2)rPinch.a=false;if(e.touches.length===0){radarDrag=false;if(e.changedTouches.length===1){var ct=e.changedTouches[0],dx=ct.clientX-_tStart.x,dy=ct.clientY-_tStart.y;if(Math.abs(dx)<8&&Math.abs(dy)<8&&Date.now()-_tStart.t<300){var hit=_rHit(cv,ct);_selectPlayer(hit?hit.name:null);}}}},{passive:true});
  }
  var tl=$('radar-timeline');
  if(tl)tl.addEventListener('input',function(){var v=parseInt(tl.value),lb=$('radar-time-label');if(v>=radarHistory.length){radarTimeIdx=-1;_stopAnim();if(lb)lb.textContent='Live';}else{radarTimeIdx=v;if(lb&&radarHistory[v]){var t=new Date(radarHistory[v].ts);lb.textContent=t.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})+' WIB';}_startAnim();}drawRadar();});
  var sb=$('radar-step-back'),sf=$('radar-step-fwd'),_hId=0,_hCnt=0;
  function _stepDir(dir){var s=$('radar-timeline');if(!s)return;s.value=dir<0?Math.max(0,parseInt(s.value)-1):Math.min(parseInt(s.max)||radarHistory.length,parseInt(s.value)+1);s.dispatchEvent(new Event('input'));}
  function _hStart(dir){_hCnt=0;_stepDir(dir);_hId=setInterval(function(){_hCnt++;_stepDir(dir);if(_hCnt===5){clearInterval(_hId);_hId=setInterval(function(){_stepDir(dir);},50);}},200);}
  function _hStop(){if(_hId){clearInterval(_hId);_hId=0;}}
  if(sb){sb.addEventListener('mousedown',function(e){e.preventDefault();_hStart(-1);});sb.addEventListener('touchstart',function(e){e.preventDefault();_hStart(-1);},{passive:false});}
  if(sf){sf.addEventListener('mousedown',function(e){e.preventDefault();_hStart(1);});sf.addEventListener('touchstart',function(e){e.preventDefault();_hStart(1);},{passive:false});}
  window.addEventListener('mouseup',_hStop);window.addEventListener('touchend',_hStop);
  fetchRadarHistory();
  setInterval(fetchRadarHistory,300000);
})();

