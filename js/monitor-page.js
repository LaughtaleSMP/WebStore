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
  radarPlayers=m.player_details||[];
  radarLands=m.land_claims||[];
  console.log('[Radar] players:',radarPlayers.length,'lands:',radarLands.length);
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
var radarHistory=[],radarTimeIdx=-1,radarRaf=0;
var DIM_COLORS={overworld:'#34d399',nether:'#fb923c',the_end:'#a855f7'};
var DIM_SHORT={o:'overworld',n:'nether',t:'the_end'};

function nameHash(n){var h=0;for(var i=0;i<n.length;i++)h=((h<<5)-h)+n.charCodeAt(i)|0;return Math.abs(h);}
var SKIN_COLORS=['#c68642','#8d5524','#e0ac69','#f1c27d','#ffdbac','#d2a679','#a0785a','#7b5b3a'];
var HAIR_COLORS=['#3b2217','#1a1110','#4a2912','#6b3a24','#d4a76a','#c23616','#2d3436','#636e72'];
var HEAD_FACE=[
  [1,1,1,1,1,1,1,1],
  [1,1,2,2,2,2,1,1],
  [2,2,2,2,2,2,2,2],
  [2,3,0,2,2,0,3,2],
  [2,2,2,4,4,2,2,2],
  [2,2,2,2,2,2,2,2],
  [2,2,5,5,5,5,2,2],
  [2,2,2,2,2,2,2,2],
];

function drawHead(ctx,x,y,name,pvp,dimColor,sz){
  sz=sz||18;var ps=sz/8;
  var hx=Math.floor(x-sz/2),hy=Math.floor(y-sz/2);
  var h=nameHash(name||'?');
  var skin=SKIN_COLORS[h%SKIN_COLORS.length];
  var hair=HAIR_COLORS[(h>>4)%HAIR_COLORS.length];
  var nose='#'+Math.min(255,parseInt(skin.slice(1,3),16)-20).toString(16).padStart(2,'0')
    +Math.min(255,parseInt(skin.slice(3,5),16)-15).toString(16).padStart(2,'0')
    +Math.min(255,parseInt(skin.slice(5,7),16)-10).toString(16).padStart(2,'0');
  var colors=['#1a1a2e',hair,skin,'#fff',nose,'#2d1810'];
  ctx.save();
  if(pvp){ctx.shadowColor='#f87171';ctx.shadowBlur=10;}
  else{ctx.shadowColor=dimColor;ctx.shadowBlur=6;}
  ctx.fillStyle='#111';
  ctx.beginPath();
  ctx.roundRect(hx-1,hy-1,sz+2,sz+2,2);
  ctx.fill();
  ctx.shadowBlur=0;
  for(var r=0;r<8;r++){
    for(var c=0;c<8;c++){
      ctx.fillStyle=colors[HEAD_FACE[r][c]];
      ctx.fillRect(hx+c*ps,hy+r*ps,Math.ceil(ps),Math.ceil(ps));
    }
  }
  ctx.strokeStyle='rgba(0,0,0,0.4)';ctx.lineWidth=1;
  ctx.strokeRect(hx-0.5,hy-0.5,sz+1,sz+1);
  ctx.restore();
}

function drawRadar(){
  try{
  var canvas=$('radar-canvas');if(!canvas)return;
  var parent=canvas.parentElement;
  var dpr=window.devicePixelRatio||1;
  var W=parent?(parent.clientWidth||600):600;if(W<100)W=600;
  var H=400;
  canvas.width=W*dpr;canvas.height=H*dpr;
  canvas.style.width=W+'px';canvas.style.height=H+'px';
  var ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);
  var bg=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,W*0.7);
  bg.addColorStop(0,'#0d1117');bg.addColorStop(1,'#060a0e');
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  var cx=W/2,cy=H/2;
  var scale=Math.min(W,H)/(radarZoom*2);
  var isLive=radarTimeIdx<0||radarTimeIdx>=radarHistory.length;
  var activePlayers;
  if(isLive){
    activePlayers=radarPlayers.filter(function(p){return p.dim===radarDim&&p.x!==undefined;});
  }else{
    var snap=radarHistory[radarTimeIdx];
    var posData=snap?snap._pos:[];
    activePlayers=posData.filter(function(p){return(DIM_SHORT[p.d]||'overworld')===radarDim;})
      .map(function(p){return{name:p.n,x:p.x,z:p.z,pvp:!!p.p};});
  }
  var gridStep=radarZoom<=250?50:radarZoom<=1000?100:500;
  var rangeX=radarZoom*1.2;
  ctx.setLineDash([2,4]);ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=1;
  var sg=Math.floor((radarPanX-rangeX)/gridStep)*gridStep;
  var eg=Math.ceil((radarPanX+rangeX)/gridStep)*gridStep;
  for(var g=sg;g<=eg;g+=gridStep){
    var gx=cx+(g-radarPanX)*scale;
    if(gx>=0&&gx<=W){
      ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke();
      if(g!==0){ctx.fillStyle='rgba(255,255,255,0.25)';ctx.font='7px JetBrains Mono,monospace';ctx.textAlign='center';ctx.fillText(g,gx,H-4);}
    }
  }
  sg=Math.floor((radarPanZ-rangeX)/gridStep)*gridStep;
  eg=Math.ceil((radarPanZ+rangeX)/gridStep)*gridStep;
  for(var g=sg;g<=eg;g+=gridStep){
    var gy=cy+(g-radarPanZ)*scale;
    if(gy>=0&&gy<=H){
      ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();
      if(g!==0){ctx.fillStyle='rgba(255,255,255,0.25)';ctx.font='7px JetBrains Mono,monospace';ctx.textAlign='left';ctx.fillText(g,4,gy-2);}
    }
  }
  ctx.setLineDash([]);
  var ox=cx+(0-radarPanX)*scale,oz=cy+(0-radarPanZ)*scale;
  if(ox>=0&&ox<=W&&oz>=0&&oz<=H){
    ctx.strokeStyle='rgba(255,255,255,0.12)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(ox,0);ctx.lineTo(ox,H);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,oz);ctx.lineTo(W,oz);ctx.stroke();
    ctx.save();ctx.shadowColor='rgba(255,255,255,0.3)';ctx.shadowBlur=4;
    ctx.beginPath();ctx.arc(ox,oz,3,0,Math.PI*2);ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.stroke();
    ctx.restore();
    ctx.fillStyle='rgba(255,255,255,0.4)';ctx.font='600 8px JetBrains Mono,monospace';ctx.textAlign='left';
    ctx.fillText('0, 0',ox+6,oz-5);
  }
  var LAND_COLORS=['#34d399','#60a5fa','#f472b6','#a78bfa','#fbbf24','#fb923c','#38bdf8','#4ade80'];
  if(radarLands&&radarLands.length){
    for(var li=0;li<radarLands.length;li++){
      var l=radarLands[li];
      var ldim=DIM_SHORT[l.d]||'overworld';
      if(ldim!==radarDim)continue;
      var lx1=cx+(Math.min(l.x1,l.x2)-radarPanX)*scale;
      var lz1=cy+(Math.min(l.z1,l.z2)-radarPanZ)*scale;
      var lx2=cx+(Math.max(l.x1,l.x2)-radarPanX)*scale;
      var lz2=cy+(Math.max(l.z1,l.z2)-radarPanZ)*scale;
      var lw=lx2-lx1,lh=lz2-lz1;
      if(lx2<0||lx1>W||lz2<0||lz1>H)continue;
      var lc=LAND_COLORS[nameHash(l.o)%LAND_COLORS.length];
      ctx.save();
      ctx.globalAlpha=0.08;
      ctx.fillStyle=lc;
      ctx.fillRect(lx1,lz1,lw,lh);
      ctx.globalAlpha=0.35;
      ctx.strokeStyle=lc;ctx.lineWidth=1.5;
      ctx.setLineDash([3,3]);
      ctx.strokeRect(lx1,lz1,lw,lh);
      ctx.setLineDash([]);
      ctx.globalAlpha=0.5;
      ctx.font='600 7px JetBrains Mono,monospace';ctx.textAlign='left';
      ctx.fillStyle=lc;
      var labelX=Math.max(lx1+3,2),labelZ=Math.max(lz1+9,10);
      if(lw>30&&lh>14)ctx.fillText(l.n,labelX,labelZ);
      ctx.globalAlpha=0.3;ctx.font='500 6px JetBrains Mono,monospace';
      if(lw>40&&lh>22)ctx.fillText(l.o,labelX,labelZ+8);
      ctx.restore();
    }
  }
  if(!isLive&&radarTimeIdx>0){
    var trails={};
    var start=Math.max(0,radarTimeIdx-24);
    for(var t=start;t<=radarTimeIdx;t++){
      var snap=radarHistory[t];if(!snap||!snap._pos)continue;
      for(var j=0;j<snap._pos.length;j++){
        var tp=snap._pos[j];
        if((DIM_SHORT[tp.d]||'overworld')!==radarDim)continue;
        if(!trails[tp.n])trails[tp.n]=[];
        trails[tp.n].push({x:tp.x,z:tp.z,t:t});
      }
    }
    var trailColor=DIM_COLORS[radarDim]||'#34d399';
    var names=Object.keys(trails);
    for(var ni=0;ni<names.length;ni++){
      var pts=trails[names[ni]];
      if(pts.length<2)continue;
      ctx.save();ctx.shadowColor=trailColor;ctx.shadowBlur=3;
      for(var pi=1;pi<pts.length;pi++){
        var a=pts[pi-1],b=pts[pi];
        var ax=cx+(a.x-radarPanX)*scale,az=cy+(a.z-radarPanZ)*scale;
        var bx=cx+(b.x-radarPanX)*scale,bz=cy+(b.z-radarPanZ)*scale;
        var age=(b.t-start)/(radarTimeIdx-start+1);
        ctx.globalAlpha=0.1+age*0.4;
        ctx.strokeStyle=trailColor;ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(ax,az);ctx.lineTo(bx,bz);ctx.stroke();
      }
      ctx.restore();
      for(var pi=0;pi<pts.length-1;pi++){
        var p=pts[pi];
        var wx=cx+(p.x-radarPanX)*scale,wz=cy+(p.z-radarPanZ)*scale;
        if(wx<0||wx>W||wz<0||wz>H)continue;
        var age=(p.t-start)/(radarTimeIdx-start+1);
        ctx.globalAlpha=0.15+age*0.35;
        ctx.beginPath();ctx.arc(wx,wz,2.5,0,Math.PI*2);
        ctx.fillStyle=trailColor;ctx.fill();
      }
    }
    ctx.globalAlpha=1;
  }
  var dotColor=DIM_COLORS[radarDim]||'#34d399';
  for(var i=0;i<activePlayers.length;i++){
    var p=activePlayers[i];
    var px=cx+(p.x-radarPanX)*scale;
    var pz=cy+(p.z-radarPanZ)*scale;
    if(px<-20||px>W+20||pz<-20||pz>H+20)continue;
    drawHead(ctx,px,pz,p.name,p.pvp,dotColor,18);
    ctx.save();ctx.shadowColor='rgba(0,0,0,0.8)';ctx.shadowBlur=3;ctx.shadowOffsetY=1;
    ctx.fillStyle='#fff';ctx.font='600 10px Inter,sans-serif';ctx.textAlign='center';
    ctx.fillText(p.name,px,pz-14);
    ctx.restore();
    ctx.fillStyle='rgba(255,255,255,0.35)';ctx.font='500 7px JetBrains Mono,monospace';ctx.textAlign='center';
    ctx.fillText(p.x+', '+p.z,px,pz+18);
    if(p.pvp){ctx.fillStyle='rgba(248,113,113,0.8)';ctx.font='700 6px JetBrains Mono,monospace';ctx.fillText('⚔ PVP',px,pz+26);}
  }
  ctx.fillStyle='rgba(255,255,255,0.25)';ctx.font='600 11px Inter,sans-serif';ctx.textAlign='center';
  ctx.fillText('N',W/2,14);ctx.fillText('S',W/2,H-6);
  ctx.fillText('W',10,H/2+4);ctx.fillText('E',W-10,H/2+4);
  var vig=ctx.createRadialGradient(W/2,H/2,H*0.3,W/2,H/2,W*0.7);
  vig.addColorStop(0,'rgba(0,0,0,0)');vig.addColorStop(1,'rgba(0,0,0,0.3)');
  ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);
  safeSet('radar-count',activePlayers.length+' pemain');
  safeSet('radar-zoom-label','Zoom: '+radarZoom+' blok');
  }catch(e){console.warn('[Radar]',e);}
}

async function fetchRadarHistory(){
  try{
    var since=new Date(Date.now()-12*3600000).toISOString();
    var r=await fetch(SB_URL+'/rest/v1/metrics_history?ts=gte.'+since+'&order=ts.asc&limit=144&select=ts,pos',
      {headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}});
    var d=await r.json();
    if(Array.isArray(d)){
      radarHistory=d.slice(-144).map(function(row){
        var o={ts:row.ts,_pos:[]};
        try{o._pos=typeof row.pos==='string'?JSON.parse(row.pos):(Array.isArray(row.pos)?row.pos:[]);}catch(e){}
        return o;
      });
      var sl=$('radar-timeline');if(sl){sl.max=radarHistory.length;sl.value=radarHistory.length;}
    }
  }catch(e){}
}

(function(){
  var dtabs=$('radar-dim-tabs');
  if(dtabs)dtabs.addEventListener('click',function(e){
    var t=e.target.closest('.tab');if(!t)return;
    dtabs.querySelectorAll('.tab').forEach(function(b){b.classList.remove('a');});
    t.classList.add('a');radarDim=t.dataset.dim;drawRadar();
  });
  var zin=$('radar-zin'),zout=$('radar-zout');
  if(zin)zin.addEventListener('click',function(){radarZoom=Math.max(50,radarZoom/2);drawRadar();});
  if(zout)zout.addEventListener('click',function(){radarZoom=Math.min(10000,radarZoom*2);drawRadar();});
  var ctr=$('radar-center');
  if(ctr)ctr.addEventListener('click',function(){radarPanX=0;radarPanZ=0;radarZoom=500;drawRadar();});
  var canvas=$('radar-canvas');
  if(canvas){
    canvas.addEventListener('mousedown',function(e){
      radarDrag=true;canvas.style.cursor='grabbing';
      radarDragStart={x:e.clientX,z:e.clientY,px:radarPanX,pz:radarPanZ};
    });
    window.addEventListener('mousemove',function(e){
      if(!radarDrag)return;
      var sc=Math.min(canvas.width,360)/(radarZoom*2);
      radarPanX=radarDragStart.px-(e.clientX-radarDragStart.x)/sc;
      radarPanZ=radarDragStart.pz-(e.clientY-radarDragStart.z)/sc;
      if(!radarRaf){radarRaf=requestAnimationFrame(function(){drawRadar();radarRaf=0;});}
    });
    window.addEventListener('mouseup',function(){
      radarDrag=false;if(canvas)canvas.style.cursor='grab';
    });
    canvas.addEventListener('wheel',function(e){
      e.preventDefault();
      if(e.deltaY>0)radarZoom=Math.min(10000,radarZoom*1.3);
      else radarZoom=Math.max(50,radarZoom/1.3);
      radarZoom=Math.round(radarZoom);
      if(!radarRaf){radarRaf=requestAnimationFrame(function(){drawRadar();radarRaf=0;});}
    },{passive:false});
    canvas.addEventListener('touchstart',function(e){
      if(e.touches.length!==1)return;
      radarDrag=true;var t=e.touches[0];
      radarDragStart={x:t.clientX,z:t.clientY,px:radarPanX,pz:radarPanZ};
    },{passive:true});
    canvas.addEventListener('touchmove',function(e){
      if(!radarDrag||e.touches.length!==1)return;
      e.preventDefault();var t=e.touches[0];
      var sc=Math.min(canvas.width,360)/(radarZoom*2);
      radarPanX=radarDragStart.px-(t.clientX-radarDragStart.x)/sc;
      radarPanZ=radarDragStart.pz-(t.clientY-radarDragStart.z)/sc;
      if(!radarRaf){radarRaf=requestAnimationFrame(function(){drawRadar();radarRaf=0;});}
    },{passive:false});
    canvas.addEventListener('touchend',function(){radarDrag=false;},{passive:true});
  }
  var timeline=$('radar-timeline');
  if(timeline)timeline.addEventListener('input',function(){
    var v=parseInt(timeline.value);
    var label=$('radar-time-label');
    if(v>=radarHistory.length){
      radarTimeIdx=-1;
      if(label)label.textContent='Live';
    }else{
      radarTimeIdx=v;
      if(label&&radarHistory[v]){
        var t=new Date(radarHistory[v].ts);
        label.textContent=t.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})+' WIB';
      }
    }
    drawRadar();
  });
  fetchRadarHistory();
  setInterval(fetchRadarHistory,300000);
})();
