/* monitor-page.js - Server Performance Monitor with BDS Metrics */
var SB_URL='https://jlxtnbnrirxhwuyqjlzw.supabase.co';
var SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpseHRuYm5yaXJ4aHd1eXFqbHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NjYzOTAsImV4cCI6MjA5MTQ0MjM5MH0.MRhoVRDju41J8nWp4WTgiKOvxy7AgwGYH-el2zVsbWI';
var $=function(id){return document.getElementById(id);};
var latHistory=[],MAX_HIST=60,chartCanvas=null,chartCtx=null,refreshTimer=null;
var _radarInteracting=false,_interactEnd=0;
var serverIP='laughtale.my.id:19214',lastMetrics=null;
var _tpsBuf=[],_hmOn=false,_hmGrid=null,_hmDirty=true,_hmMax=1;
var _notifOn=false,_notifCD={},_notifHist=[],_NOTIF_CD=300000;
var _uptimeLog=null,_prevOnline=null;
var _fetchLock=false,_lastBDSHash='',_srvStatCache=null,_srvStatCacheTs=0;
var _fetchFails=0,_maxRetries=3,_retryDelay=2000;

/* ═══ Feature 18: Multi-Server Support ═══ */
var _servers=[{name:'Laughtale SMP',ip:'laughtale.my.id:19214',sync_id:'current'}];
var _currentIdx=0;

async function loadConfig(){
  // Try loading multi-server config first
  try{
    var r=await fetch(SB_URL+'/rest/v1/site_config?key=eq.servers&select=value',{headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}});
    var d=await r.json();
    if(d&&d[0]&&d[0].value){
      var parsed=typeof d[0].value==='string'?JSON.parse(d[0].value):d[0].value;
      if(Array.isArray(parsed)&&parsed.length>0){
        _servers=parsed;
        // Restore last selected server
        var saved=localStorage.getItem('lt_srv_idx');
        if(saved!==null){var si=parseInt(saved);if(si>=0&&si<_servers.length)_currentIdx=si;}
        serverIP=_servers[_currentIdx].ip||serverIP;
        _buildServerDropdown();
        return;
      }
    }
  }catch(e){}
  // Fallback: single server config
  try{
    var r2=await fetch(SB_URL+'/rest/v1/site_config?key=eq.server_ip&select=value',{headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}});
    var d2=await r2.json();
    if(d2&&d2[0]&&d2[0].value)serverIP=d2[0].value;
  }catch(e){}
  _servers=[{name:'Laughtale SMP',ip:serverIP,sync_id:'current'}];
  _buildServerDropdown();
}

function _buildServerDropdown(){
  var sel=$('srv-select'),nameEl=$('srv-name');
  if(!sel)return;
  if(_servers.length<=1){
    // Single server — show static name, hide dropdown
    sel.style.display='none';
    if(nameEl){nameEl.style.display='';nameEl.textContent=_servers[0].name||'Laughtale SMP';}
    return;
  }
  // Multiple servers — show dropdown, hide static name
  if(nameEl)nameEl.style.display='none';
  sel.style.display='';
  sel.innerHTML=_servers.map(function(s,i){
    return'<option value="'+i+'"'+(i===_currentIdx?' selected':'')+'>'+esc(s.name||'Server '+(i+1))+'</option>';
  }).join('');
}

function _switchServer(idx){
  if(idx===_currentIdx||idx<0||idx>=_servers.length)return;
  _currentIdx=idx;
  var srv=_servers[idx];
  serverIP=srv.ip||serverIP;
  localStorage.setItem('lt_srv_idx',String(idx));
  // Reset all state for clean switch
  latHistory=[];mhData=[];radarPlayers=[];radarLands=[];radarHistory=[];
  _tpsBuf=[];_hmGrid=null;_hmDirty=true;_hmMax=1;
  _uptimeLog=null;lastMetrics=null;
  _msBuf={tps:[],lat:[],players:[]};_animVals={};
  _srvStatCache=null;_srvStatCacheTs=0;_lastBDSHash='';_fetchFails=0;_headCache={};
  _hideErrBanner();
  // Reset UI to loading state
  _origSafeSet('s-label','MEMUAT...');safeClass('s-label','sl ld');
  safeClass('s-orb','orb ld');
  _origSafeSet('m-tps','—');_origSafeSet('m-latency','—');_origSafeSet('m-players','—');
  _origSafeSet('m-version','—');_origSafeSet('m-status','—');_origSafeSet('s-addr','—');
  var bds=$('bds-metrics');if(bds)bds.style.display='none';
  var pdc=$('player-details-card');if(pdc)pdc.style.display='none';
  // Re-fetch everything
  fetchStatus();fetchMH();fetchRadarHistory();
}

async function fetchBDSData(){
  try{
    var _sid=(_servers[_currentIdx]&&_servers[_currentIdx].sync_id)||'current';
    var r=await fetch(SB_URL+'/rest/v1/leaderboard_sync?id=eq.'+_sid+'&select=online_players,synced_at,server_metrics',{headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}});
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
  _hmDirty=true; // refresh entity density heatmap with new data
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
  safeSet('dp-pct',dpPct+'% terpakai');
  safeSet('dp-detail',fmtBytes(m.dp_bytes||0)+' / '+fmtBytes(m.dp_max||1048576));
  // Gauge ring
  var gauge=$('dp-gauge');
  if(gauge){
    var arc=97.4,off=arc-(dpPct/100*arc);
    gauge.setAttribute('stroke-dashoffset',off.toFixed(1));
    gauge.setAttribute('stroke',dpPct<50?'var(--green)':dpPct<80?'var(--gold)':'var(--red)');
  }
  safeSet('dp-pct-num',dpPct+'%');
  // Status pill
  var pill=$('dp-pill');
  if(pill){
    pill.textContent=dpPct<50?'AMAN':dpPct<80?'SEDANG':'PENUH';
    pill.className='pill '+(dpPct<50?'g':dpPct<80?'y':'r');
  }
  // DP breakdown per fitur
  var dpbd=$('dp-breakdown'),dbb=m.dp_breakdown;
  if(dpbd&&dbb&&Object.keys(dbb).length){
    var totalEst=Object.values(dbb).reduce(function(s,v){return s+v.b;},0)||1;
    var colors={Gacha:'#c084fc',Daily:'#60a5fa',Bank:'#fbbf24',Auction:'#34d399',Combat:'#f87171',Land:'#2dd4bf',System:'#64748b'};
    var icons={
      Gacha:'<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
      Daily:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      Bank:'<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 00-8 0v2"/>',
      Auction:'<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
      Combat:'<path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/>',
      Land:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 3v18"/>',
      System:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06"/>'
    };
    var colorsBg={Gacha:'rgba(192,132,252,.07)',Daily:'rgba(96,165,250,.07)',Bank:'rgba(251,191,36,.07)',Auction:'rgba(52,211,153,.07)',Combat:'rgba(248,113,113,.07)',Land:'rgba(45,212,191,.07)',System:'rgba(100,116,139,.07)'};
    var colorsBd={Gacha:'rgba(192,132,252,.15)',Daily:'rgba(96,165,250,.15)',Bank:'rgba(251,191,36,.15)',Auction:'rgba(52,211,153,.15)',Combat:'rgba(248,113,113,.15)',Land:'rgba(45,212,191,.15)',System:'rgba(100,116,139,.15)'};
    var entries=Object.entries(dbb).sort(function(a,b){return b[1].b-a[1].b;});
    // Stacked bar
    var stackHtml='<div style="display:flex;height:6px;border-radius:3px;overflow:hidden;margin-bottom:10px;border:1px solid var(--border)">';
    for(var i=0;i<entries.length;i++){
      var cat=entries[i][0],info=entries[i][1];
      var w=Math.max(1,(info.b/totalEst*100)).toFixed(1);
      stackHtml+='<div style="width:'+w+'%;height:100%;background:'+colors[cat]+';transition:width .6s" title="'+cat+': '+info.k+' keys"></div>';
    }
    stackHtml+='</div>';
    // Grid items
    var gridHtml='<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px">';
    for(var i=0;i<entries.length;i++){
      var cat=entries[i][0],info=entries[i][1];
      var pct=Math.round(info.b/totalEst*100);
      var c=colors[cat]||'var(--mute)';
      var ic=icons[cat]||'';
      gridHtml+='<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xs);transition:border-color .2s">'
        +'<div style="width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;background:'+(colorsBg[cat]||'var(--surface)')+';border:1px solid '+(colorsBd[cat]||'var(--border)')+';flex-shrink:0">'
        +'<svg viewBox="0 0 24 24" fill="none" stroke="'+c+'" stroke-width="2" style="width:13px;height:13px">'+ic+'</svg></div>'
        +'<div style="flex:1;min-width:0">'
        +'<div style="display:flex;justify-content:space-between;align-items:baseline">'
        +'<span style="font-family:\'JetBrains Mono\',monospace;font-size:.52rem;font-weight:700;color:var(--text);letter-spacing:.3px">'+cat+'</span>'
        +'<span style="font-family:\'JetBrains Mono\',monospace;font-size:.48rem;font-weight:700;color:'+c+'">'+pct+'%</span>'
        +'</div>'
        +'<div style="height:3px;background:var(--bg3);border-radius:2px;overflow:hidden;margin-top:3px"><div style="width:'+pct+'%;height:100%;background:'+c+';border-radius:2px;transition:width .6s"></div></div>'
        +'<span style="font-family:\'JetBrains Mono\',monospace;font-size:.38rem;color:var(--mute);margin-top:2px;display:block">'+info.k+' keys</span>'
        +'</div></div>';
    }
    gridHtml+='</div>';
    dpbd.innerHTML=stackHtml+gridHtml;
  }
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
  _updateHealth(m);_pushTPS(m.tps||0);_checkAlerts({tps:m.tps,dpPct:m.dp_pct});_hmDirty=true;
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

async function fetchStatus(_retryN){
  // B: Deduplication lock — prevent concurrent fetches
  if(_fetchLock)return;
  _fetchLock=true;
  _retryN=_retryN||0;
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
    var d,latency;
    // B: Cache mcsrvstat response for 10s to avoid duplicate API hits
    if(_srvStatCache&&Date.now()-_srvStatCacheTs<10000){
      d=_srvStatCache;latency=Date.now()-_srvStatCacheTs;
    }else{
      var ctrl=new AbortController();
      var tm=setTimeout(function(){ctrl.abort();},10000);
      var r=await fetch('https://api.mcsrvstat.us/bedrock/3/'+host+':'+port,{signal:ctrl.signal});
      clearTimeout(tm);
      latency=Date.now()-t0;
      d=await r.json();
      _srvStatCache=d;_srvStatCacheTs=Date.now();
    }
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
    // C: Success — reset failure counter, hide error banner
    _fetchFails=0;_hideErrBanner();
    // Basic diagnostics from public API data (always available)
    updateBasicDiag(online,latency,players,maxP);
    _trackUptime(online);_checkAlerts({online:online,latency:latency});
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
    _fetchFails++;
    if(!fetchOK){
      // C: Auto-retry with exponential backoff
      if(_retryN<_maxRetries){
        _fetchLock=false;
        setTimeout(function(){fetchStatus(_retryN+1);},_retryDelay*Math.pow(2,_retryN));
        return;
      }
      safeClass('s-orb','orb off');
      safeSet('s-label','OFFLINE');safeClass('s-label','sl off');
      safeSet('s-addr','Tidak dapat terhubung');
      _showErrBanner('Gagal terhubung ke server. Cek koneksi internet Anda.',e.name==='AbortError'?'Timeout':'Error');
    }
  }finally{
    _fetchLock=false;
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
  // Multi-server dropdown listener
  var srvSel=$('srv-select');
  if(srvSel)srvSel.addEventListener('change',function(){_switchServer(parseInt(srvSel.value));});
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
var MH_KEYS=['tps','players','mobs','entities','items'];

async function fetchMH(){
  var ranges={day:'24',week:'168',month:'720'};
  var hours=ranges[mhRange]||'24';
  var since=new Date(Date.now()-hours*3600000).toISOString();
  try{
    var _srvFilter=(_servers[_currentIdx]&&_servers[_currentIdx].server_id)?'&server_id=eq.'+_servers[_currentIdx].server_id:'';
    var r=await fetch(SB_URL+'/rest/v1/metrics_history?ts=gte.'+since+'&order=ts.asc&limit=2000'+_srvFilter,
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

function _drawSparkline(canvasId,key,color){
  var canvas=$(canvasId);if(!canvas||!mhData.length)return;
  var par=canvas.parentElement;
  var W=par?(par.clientWidth||400):400;if(W<50)W=400;
  var H=32;
  canvas.width=W;canvas.height=H;
  var ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);
  var pts=mhData.length,mn=Infinity,mx=-Infinity,last=0;
  for(var i=0;i<pts;i++){var v=mhData[i][key]||0;if(v<mn)mn=v;if(v>mx)mx=v;last=v;}
  if(mn===Infinity)mn=0;if(mx<=mn)mx=mn+1;
  var range=mx-mn,pad=range*0.1;
  mn=Math.max(0,mn-pad);mx=mx+pad;
  // Update value + range labels
  safeSet('mhr-'+key+'-v',key==='tps'?last.toFixed(1):fmtN(Math.round(last)));
  safeSet('mhr-'+key+'-min','min: '+(key==='tps'?mn.toFixed(1):fmtN(Math.round(mn))));
  safeSet('mhr-'+key+'-max','max: '+(key==='tps'?mx.toFixed(1):fmtN(Math.round(mx))));
  // Fill gradient
  var grad=ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,hexAlpha(color,0.12));grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.beginPath();
  for(var i=0;i<pts;i++){
    var x=pts>1?W*(i/(pts-1)):0,v=mhData[i][key]||0;
    var y=H-(v-mn)/(mx-mn)*H;
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();
  ctx.fillStyle=grad;ctx.fill();
  // Line
  ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.lineJoin='round';
  for(var i=0;i<pts;i++){
    var x=pts>1?W*(i/(pts-1)):0,v=mhData[i][key]||0;
    var y=H-(v-mn)/(mx-mn)*H;
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.stroke();
  // Last value dot
  if(pts>0){
    var lx=W,ly=H-(last-mn)/(mx-mn)*H;
    ctx.beginPath();ctx.arc(lx,ly,3,0,6.28);ctx.fillStyle=color;ctx.fill();
    ctx.beginPath();ctx.arc(lx,ly,5,0,6.28);ctx.fillStyle=hexAlpha(color,0.2);ctx.fill();
  }
}

function drawMHChart(){
  try{
    if(!mhData.length)return;
    for(var i=0;i<MH_KEYS.length;i++){
      _drawSparkline('mhc-'+MH_KEYS[i],MH_KEYS[i],MH_COLORS[MH_KEYS[i]]);
    }
    // Peak hours + deltas — called here so they run on initial load too
    _drawPeakHours();
    _calcDeltas();
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

/* A: Pre-cached player head bitmaps — avoids 64 fillRect calls per player per frame */
var _headCache={};
function _getHeadBitmap(name,pvp,dc,sz){
  sz=sz||18;
  var key=name+'|'+(pvp?1:0)+'|'+(name===rSel?'s':'')+'|'+sz;
  if(_headCache[key])return _headCache[key];
  // Limit cache size
  var keys=Object.keys(_headCache);
  if(keys.length>50){for(var i=0;i<20;i++)delete _headCache[keys[i]];}
  var oc=document.createElement('canvas');
  var pad=12; // space for glow
  oc.width=sz+pad*2;oc.height=sz+pad*2;
  var octx=oc.getContext('2d');
  var ps=sz/8,hx=pad,hy=pad;
  var h=nameHash(name||'?'),skin=SK[h%SK.length],hair=HK[(h>>4)%HK.length];
  var r=Math.max(0,parseInt(skin.slice(1,3),16)-20),g=Math.max(0,parseInt(skin.slice(3,5),16)-15),b=Math.max(0,parseInt(skin.slice(5,7),16)-10);
  var nose='#'+r.toString(16).padStart(2,'0')+g.toString(16).padStart(2,'0')+b.toString(16).padStart(2,'0');
  var cl=['#1a1a2e',hair,skin,'#fff',nose,'#2d1810'];
  if(pvp){octx.shadowColor='#f87171';octx.shadowBlur=8;}
  else if(name===rSel){octx.shadowColor='#fbbf24';octx.shadowBlur=10;}
  else{octx.shadowColor=dc;octx.shadowBlur=4;}
  octx.fillStyle='#111';octx.beginPath();octx.roundRect(hx-1,hy-1,sz+2,sz+2,2);octx.fill();octx.shadowBlur=0;
  for(var rr=0;rr<8;rr++)for(var cc=0;cc<8;cc++){octx.fillStyle=cl[HF[rr][cc]];octx.fillRect(hx+cc*ps,hy+rr*ps,Math.ceil(ps),Math.ceil(ps));}
  if(name===rSel){octx.strokeStyle='#fbbf24';octx.lineWidth=2;octx.strokeRect(hx-2,hy-2,sz+4,sz+4);}
  _headCache[key]=oc;
  return oc;
}

function drawHead(ctx,x,y,name,pvp,dc,sz){
  sz=sz||18;
  var bmp=_getHeadBitmap(name,pvp,dc,sz);
  var pad=12;
  ctx.drawImage(bmp,Math.floor(x-sz/2)-pad,Math.floor(y-sz/2)-pad);
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
  var isInteract=_radarInteracting||Date.now()-_interactEnd<150;
  var dpr=window.devicePixelRatio||1;
  if(isInteract)dpr=Math.max(1,Math.floor(dpr)); // lower res during interaction
  var isFS=!!(document.fullscreenElement||document.webkitFullscreenElement);
  var W=par?(par.clientWidth||600):600;if(W<100)W=600;
  var H=isFS?(window.innerHeight-180):400;
  if(isFS){var card=$('player-details-card');if(card){var sibH=0;for(var ci=0;ci<card.children.length;ci++){var ch=card.children[ci];if(ch===par)continue;sibH+=ch.offsetHeight+4;}H=window.innerHeight-sibH-20;if(H<100)H=window.innerHeight-180;}}
  canvas.width=W*dpr;canvas.height=H*dpr;
  canvas.style.width=W+'px';canvas.style.height=H+'px';
  var ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#0a0e14';ctx.fillRect(0,0,W,H);
  var cX=W/2,cY=H/2,sc=Math.min(W,H)/(radarZoom*2);
  // Fog of war — skip during interaction (expensive chunk iteration)
  // Also skip when zoomed out so far that chunks are sub-pixel (no visual benefit)
  if(!isInteract){
    if(Date.now()-_expLast>30000)_computeExp();
    var _cw=_EXP_CS*sc;
    if(_cw>=2&&_expSet.size>0){
      var _rng2=radarZoom*1.2;
      var _sx=Math.floor((radarPanX-_rng2)/_EXP_CS),_ex=Math.ceil((radarPanX+_rng2)/_EXP_CS);
      var _sz=Math.floor((radarPanZ-_rng2)/_EXP_CS),_ez=Math.ceil((radarPanZ+_rng2)/_EXP_CS);
      // Cap iteration count to prevent lag at extreme zoom-out
      var _fogCols=_ex-_sx+1,_fogRows=_ez-_sz+1;
      if(_fogCols*_fogRows<=40000){
        for(var _cx=_sx;_cx<=_ex;_cx++){for(var _cz=_sz;_cz<=_ez;_cz++){
          var _fx=cX+(_cx*_EXP_CS-radarPanX)*sc,_fz=cY+(_cz*_EXP_CS-radarPanZ)*sc;
          if(_fx+_cw<0||_fx>W||_fz+_cw<0||_fz>H)continue;
          ctx.fillStyle=_expSet.has(radarDim+':'+_cx+','+_cz)?'rgba(52,211,153,0.018)':'rgba(0,0,0,0.18)';
          ctx.fillRect(_fx,_fz,_cw,_cw);
        }}
      }
    }
  }
  // Heatmap — skip during interaction (expensive gradients + sonar)
  if(_hmOn&&!isInteract)_renderHeatmap(ctx,cX,cY,sc,W,H);
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
  if(radarLands&&radarLands.length){for(var li=0;li<radarLands.length;li++){var l=radarLands[li];if(!l||l.x1==null)continue;if((DIM_SHORT[l.d]||'overworld')!==radarDim)continue;_lTot++;var lx1=cX+(Math.min(l.x1,l.x2)-radarPanX)*sc,lz1=cY+(Math.min(l.z1,l.z2)-radarPanZ)*sc,lx2=cX+(Math.max(l.x1,l.x2)-radarPanX)*sc,lz2=cY+(Math.max(l.z1,l.z2)-radarPanZ)*sc,lw=lx2-lx1,lh=lz2-lz1;if(lx2<0||lx1>W||lz2<0||lz1>H)continue;_lVis++;var lc=LAND_COLORS[nameHash(l.o)%LAND_COLORS.length];ctx.globalAlpha=0.07;ctx.fillStyle=lc;ctx.fillRect(lx1,lz1,lw,lh);ctx.globalAlpha=0.3;ctx.strokeStyle=lc;ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.strokeRect(lx1,lz1,lw,lh);ctx.setLineDash([]);if(!isInteract){var _lfs=Math.min(16,Math.max(7,Math.floor(lw/8)));var _lfs2=Math.min(13,Math.max(6,Math.floor(lw/10)));var _lpad=_lfs+2;if(lw>30&&lh>_lfs){ctx.globalAlpha=0.55;ctx.font='600 '+_lfs+'px JetBrains Mono,monospace';ctx.textAlign='left';ctx.fillStyle=lc;ctx.fillText(l.n,Math.max(lx1+4,2),Math.max(lz1+_lfs+2,_lfs+2));if(l.o&&lh>_lpad+_lfs2+2){ctx.globalAlpha=0.4;ctx.font='500 '+_lfs2+'px JetBrains Mono,monospace';ctx.fillStyle='rgba(255,255,255,0.55)';ctx.fillText(l.o,Math.max(lx1+4,2),Math.max(lz1+_lpad+_lfs2,_lpad+_lfs2));}}}ctx.globalAlpha=1;}}
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
    if(isInteract){
      // Lightweight: head + name only, skip shadow + coord text
      drawHead(ctx,px,pz,p.name,p.pvp,dc,18);
      ctx.fillStyle=dim?'rgba(255,255,255,0.2)':'#fff';ctx.font='600 9px Inter,sans-serif';ctx.textAlign='center';ctx.fillText(p.name,px,pz-14);
    }else{
      drawHead(ctx,px,pz,p.name,p.pvp,dc,18);
      ctx.save();if(!dim){ctx.shadowColor='rgba(0,0,0,0.7)';ctx.shadowBlur=2;ctx.shadowOffsetY=1;}
      ctx.fillStyle=dim?'rgba(255,255,255,0.25)':'#fff';ctx.font='600 10px Inter,sans-serif';ctx.textAlign='center';ctx.fillText(p.name,px,pz-14);ctx.restore();
      ctx.fillStyle=dim?'rgba(255,255,255,0.12)':'rgba(255,255,255,0.35)';ctx.font='500 7px JetBrains Mono,monospace';ctx.textAlign='center';ctx.fillText(p.x+', '+p.z,px,pz+18);
      if(p.pvp&&!dim){ctx.fillStyle='rgba(248,113,113,0.8)';ctx.font='700 6px JetBrains Mono,monospace';ctx.fillText('\u2694 PVP',px,pz+26);}
    }
    if(dim)ctx.globalAlpha=1;
  }
  ctx.fillStyle='rgba(255,255,255,0.2)';ctx.font='600 10px Inter,sans-serif';ctx.textAlign='center';
  ctx.fillText('N',W/2,13);ctx.fillText('S',W/2,H-5);ctx.fillText('W',9,H/2+4);ctx.fillText('E',W-9,H/2+4);
  safeSet('radar-count',ap.length+' pemain'+(_lTot?' \u00b7 '+_lVis+'/'+_lTot+' land':''));safeSet('radar-zoom-label','Zoom: '+radarZoom+' blok');
  // Update dimension badges based on current time point
  var _dcOw=0,_dcNe=0,_dcEn=0;
  if(isLive){
    for(var i=0;i<radarPlayers.length;i++){var _dp=radarPlayers[i];if(!_dp||_dp.x===undefined)continue;if(_dp.dim==='overworld')_dcOw++;else if(_dp.dim==='nether')_dcNe++;else if(_dp.dim==='the_end')_dcEn++;}
  }else{
    var _snap=radarHistory[radarTimeIdx];var _spos=_snap?_snap._pos:[];
    for(var i=0;i<_spos.length;i++){var _dd=DIM_SHORT[_spos[i].d]||'overworld';if(_dd==='overworld')_dcOw++;else if(_dd==='nether')_dcNe++;else if(_dd==='the_end')_dcEn++;}
  }
  safeSet('dim-ow',_dcOw);safeSet('dim-nether',_dcNe);safeSet('dim-end',_dcEn);
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
    var _srvFilter=(_servers[_currentIdx]&&_servers[_currentIdx].server_id)?'&server_id=eq.'+_servers[_currentIdx].server_id:'';
    var r=await fetch(SB_URL+'/rest/v1/metrics_history?ts=gte.'+since+'&order=ts.asc&limit=144&select=ts,pos'+_srvFilter,{headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}});
    var d=await r.json();
    if(Array.isArray(d)){radarHistory=d.slice(-144).map(function(row){var o={ts:row.ts,_pos:[]};try{o._pos=typeof row.pos==='string'?JSON.parse(row.pos):(Array.isArray(row.pos)?row.pos:[]);}catch(e){}return o;});var sl=$('radar-timeline');if(sl){sl.max=radarHistory.length;sl.value=radarHistory.length;}_computeExp();_hmDirty=true;}
  }catch(e){}
}

(function(){
  var dt=$('radar-dim-tabs');
  if(dt)dt.addEventListener('click',function(e){var t=e.target.closest('.tab');if(!t)return;dt.querySelectorAll('.tab').forEach(function(b){b.classList.remove('a');});t.classList.add('a');radarDim=t.dataset.dim;drawRadar();});
  var fs=$('radar-fullscreen');
  if(fs)fs.addEventListener('click',function(){var c=$('player-details-card');if(!c)return;if(document.fullscreenElement||document.webkitFullscreenElement){(document.exitFullscreen||document.webkitExitFullscreen).call(document);}else{(c.requestFullscreen||c.webkitRequestFullscreen).call(c).then(function(){drawRadar();}).catch(function(){});}});
  document.addEventListener('fullscreenchange',function(){setTimeout(drawRadar,100);setTimeout(drawRadar,300);});
  document.addEventListener('webkitfullscreenchange',function(){setTimeout(drawRadar,100);setTimeout(drawRadar,300);});
  var ctr=$('radar-center');
  if(ctr)ctr.addEventListener('click',function(){radarPanX=0;radarPanZ=0;radarZoom=500;rSel=null;rFollow=false;drawRadar();});
  var ic=$('radar-info-close');
  if(ic)ic.addEventListener('click',function(){_selectPlayer(null);});
  var cv=$('radar-canvas');
  if(cv){
    var _clickStart={x:0,y:0,t:0};
    // Double-click to zoom into clicked area
    cv.addEventListener('dblclick',function(e){
      e.preventDefault();
      var r=cv.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
      var cW=parseInt(cv.style.width)||600,cH=parseInt(cv.style.height)||400;
      var sc=Math.min(cW,cH)/(radarZoom*2);
      // Convert click pixel to world coordinate
      radarPanX=radarPanX+(mx-cW/2)/sc;
      radarPanZ=radarPanZ+(my-cH/2)/sc;
      // Zoom in 3x
      radarZoom=Math.max(50,Math.round(radarZoom/3));
      rFollow=false;
      drawRadar();
    });
    cv.addEventListener('mousedown',function(e){_clickStart={x:e.clientX,y:e.clientY,t:Date.now()};radarDrag=true;_radarInteracting=true;cv.style.cursor='move';radarDragStart={x:e.clientX,z:e.clientY,px:radarPanX,pz:radarPanZ};});
    window.addEventListener('mousemove',function(e){if(!radarDrag)return;var sc=Math.min(parseInt(cv.style.width)||600,parseInt(cv.style.height)||400)/(radarZoom*2);radarPanX=radarDragStart.px-(e.clientX-radarDragStart.x)/sc;radarPanZ=radarDragStart.pz-(e.clientY-radarDragStart.z)/sc;rFollow=false;if(!radarRaf){radarRaf=requestAnimationFrame(function(){drawRadar();radarRaf=0;});}});
    window.addEventListener('mouseup',function(e){if(!radarDrag)return;radarDrag=false;_radarInteracting=false;_interactEnd=Date.now();cv.style.cursor='crosshair';var dx=e.clientX-_clickStart.x,dy=e.clientY-_clickStart.y;if(Math.abs(dx)<5&&Math.abs(dy)<5&&Date.now()-_clickStart.t<300){var hit=_rHit(cv,e);_selectPlayer(hit?hit.name:null);}drawRadar();});
    cv.addEventListener('wheel',function(e){e.preventDefault();_radarInteracting=true;radarZoom=e.deltaY>0?Math.min(10000,radarZoom*1.3):Math.max(50,radarZoom/1.3);radarZoom=Math.round(radarZoom);rFollow=false;clearTimeout(window._wheelEnd);window._wheelEnd=setTimeout(function(){_radarInteracting=false;_interactEnd=Date.now();drawRadar();},200);if(!radarRaf){radarRaf=requestAnimationFrame(function(){drawRadar();radarRaf=0;});}},{passive:false});
    var rPinch={a:false,d0:0,z0:0};
    function _td(ts){var dx=ts[0].clientX-ts[1].clientX,dy=ts[0].clientY-ts[1].clientY;return Math.sqrt(dx*dx+dy*dy);}
    var _tStart={x:0,y:0,t:0};
    cv.addEventListener('touchstart',function(e){_radarInteracting=true;if(e.touches.length===2){e.preventDefault();radarDrag=false;rPinch.a=true;rPinch.d0=_td(e.touches);rPinch.z0=radarZoom;}else if(e.touches.length===1&&!rPinch.a){_tStart={x:e.touches[0].clientX,y:e.touches[0].clientY,t:Date.now()};radarDrag=true;radarDragStart={x:e.touches[0].clientX,z:e.touches[0].clientY,px:radarPanX,pz:radarPanZ};}},{passive:false});
    cv.addEventListener('touchmove',function(e){if(e.touches.length===2&&rPinch.a){e.preventDefault();radarZoom=Math.max(50,Math.min(10000,Math.round(rPinch.z0*(rPinch.d0/_td(e.touches)))));rFollow=false;if(!radarRaf){radarRaf=requestAnimationFrame(function(){drawRadar();radarRaf=0;});}}else if(e.touches.length===1&&radarDrag&&!rPinch.a){e.preventDefault();var t=e.touches[0],sc=Math.min(parseInt(cv.style.width)||600,parseInt(cv.style.height)||400)/(radarZoom*2);radarPanX=radarDragStart.px-(t.clientX-radarDragStart.x)/sc;radarPanZ=radarDragStart.pz-(t.clientY-radarDragStart.z)/sc;rFollow=false;if(!radarRaf){radarRaf=requestAnimationFrame(function(){drawRadar();radarRaf=0;});}}},{passive:false});
    var _lastTap=0;
    cv.addEventListener('touchend',function(e){if(e.touches.length<2)rPinch.a=false;if(e.touches.length===0){radarDrag=false;_radarInteracting=false;_interactEnd=Date.now();if(e.changedTouches.length===1){var ct=e.changedTouches[0],dx=ct.clientX-_tStart.x,dy=ct.clientY-_tStart.y;var now=Date.now();
      // Double-tap detection
      if(Math.abs(dx)<8&&Math.abs(dy)<8&&now-_tStart.t<300){
        if(now-_lastTap<400){
          // Double tap — zoom in
          var r=cv.getBoundingClientRect(),mx=ct.clientX-r.left,my=ct.clientY-r.top;
          var cW=parseInt(cv.style.width)||600,cH=parseInt(cv.style.height)||400;
          var sc=Math.min(cW,cH)/(radarZoom*2);
          radarPanX=radarPanX+(mx-cW/2)/sc;radarPanZ=radarPanZ+(my-cH/2)/sc;
          radarZoom=Math.max(50,Math.round(radarZoom/3));rFollow=false;drawRadar();
          _lastTap=0;
        }else{
          var hit=_rHit(cv,ct);_selectPlayer(hit?hit.name:null);
          _lastTap=now;
        }
      }else{_lastTap=0;}
    }}},{passive:true});
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

/* ═══ Feature 1: Notification & Alert System ═══ */
(function(){
  _notifOn=localStorage.getItem('lt_notif')==='1';
  _updateNotifUI();
  var bell=$('notif-bell');
  if(bell)bell.addEventListener('click',function(e){
    e.stopPropagation();
    if(!_notifOn&&typeof Notification!=='undefined'&&Notification.permission==='default'){
      Notification.requestPermission().then(function(p){
        if(p==='granted'){_notifOn=true;localStorage.setItem('lt_notif','1');}
        _updateNotifUI();
      });
    }else{
      _notifOn=!_notifOn;
      localStorage.setItem('lt_notif',_notifOn?'1':'0');
      _updateNotifUI();
    }
    var panel=$('notif-panel');
    if(panel)panel.classList.toggle('open');
  });
  var clr=$('notif-clear');
  if(clr)clr.addEventListener('click',function(e){
    e.stopPropagation();_notifHist=[];_updateNotifUI();_renderNotifList();
  });
  document.addEventListener('click',function(e){
    var p=$('notif-panel');
    if(p&&p.classList.contains('open')&&!e.target.closest('.notif-wrap'))p.classList.remove('open');
  });
  var hmc=$('hm-check'),_hmAnimId=0;
  // Throttled sonar animation — 15fps is plenty for the 2.4s sonar cycle
  function _hmAnimLoop(){if(_hmAnimId)return;_hmAnimId=setInterval(function(){if(!_hmOn){clearInterval(_hmAnimId);_hmAnimId=0;return;}drawRadar();},67);}
  if(hmc)hmc.addEventListener('change',function(){_hmOn=hmc.checked;drawRadar();if(_hmOn&&!_hmAnimId)_hmAnimLoop();});
})();

function _updateNotifUI(){
  var bell=$('notif-bell');
  if(bell)bell.classList.toggle('active',_notifOn);
  var badge=$('notif-badge');
  if(badge){badge.style.display=_notifHist.length>0?'block':'none';badge.textContent=_notifHist.length;}
}
function _renderNotifList(){
  var list=$('notif-list');if(!list)return;
  if(!_notifHist.length){list.innerHTML='<div style="padding:12px;text-align:center;color:var(--mute);font-size:.55rem">Belum ada notifikasi</div>';return;}
  list.innerHTML=_notifHist.map(function(n){
    return'<div class="notif-item"><span class="notif-ico">'+n.ico+'</span><div><div class="notif-msg">'+esc(n.msg)+'</div><div class="notif-ts">'+timeAgo(new Date(n.ts).toISOString())+'</div></div></div>';
  }).join('');
}
function _sendNotif(cat,ico,msg){
  if(!_notifOn)return;var now=Date.now();
  if(_notifCD[cat]&&now-_notifCD[cat]<_NOTIF_CD)return;
  _notifCD[cat]=now;
  _notifHist.unshift({cat:cat,ico:ico,msg:msg,ts:now});
  if(_notifHist.length>20)_notifHist.length=20;
  _updateNotifUI();_renderNotifList();
  if(typeof Notification!=='undefined'&&Notification.permission==='granted'){
    try{new Notification('Laughtale SMP',{body:msg,icon:'assets/favicon.svg',tag:cat});}catch(e){}
  }
}
function _checkAlerts(d){
  if(d.online===false)_sendNotif('offline','\u25cf','Server sedang offline!');
  if(d.tps!==undefined&&d.tps<15)_sendNotif('tps','\u25b2','TPS rendah: '+d.tps.toFixed(1)+'/20');
  if(d.latency!==undefined&&d.latency>500)_sendNotif('latency','\u25c8','Latency tinggi: '+d.latency+'ms');
  if(d.dpPct!==undefined&&d.dpPct>80)_sendNotif('dp','\u25a0','DP usage tinggi: '+d.dpPct+'%');
}

/* ═══ Feature 2: Uptime Tracker ═══ */
function _loadUptime(){
  if(_uptimeLog)return;
  try{_uptimeLog=JSON.parse(localStorage.getItem('lt_uptime')||'[]');}catch(e){_uptimeLog=[];}
  var cut=Date.now()-25*3600000;
  _uptimeLog=_uptimeLog.filter(function(e){return e.ts>cut;});
}
function _saveUptime(){
  try{localStorage.setItem('lt_uptime',JSON.stringify(_uptimeLog));}catch(e){}
}
function _trackUptime(online){
  _loadUptime();var now=Date.now();
  // Always record a data point on every fetch (every 30s).
  // This ensures we have real samples instead of only logging status changes,
  // which caused uptime to show 100% when the server was always online during monitoring.
  _uptimeLog.push({ts:now,on:online});
  if(_uptimeLog.length>500)_uptimeLog=_uptimeLog.slice(-400);
  _saveUptime();
  _renderUptime();
}
function _renderUptime(){
  _loadUptime();
  var track=$('uptime-track'),pctEl=$('uptime-pct');
  if(!track)return;
  var now=Date.now(),start=now-24*3600000,log=_uptimeLog;
  // Determine initial state: assume unknown (offline) if no data before the 24h window
  var initOn=false;
  for(var i=0;i<log.length;i++){if(log[i].ts<=start)initOn=log[i].on;else break;}
  var segs=[],totalOn=0,totalKnown=0,prev={ts:start,on:initOn};
  for(var i=0;i<log.length;i++){
    if(log[i].ts<=start)continue;
    var se=Math.min(log[i].ts,now),ss=Math.max(prev.ts,start);
    if(se>ss){segs.push({on:prev.on,pct:(se-ss)/(now-start)*100});totalKnown+=se-ss;if(prev.on)totalOn+=se-ss;}
    prev=log[i];
  }
  var ss=Math.max(prev.ts,start);
  if(now>ss){segs.push({on:prev.on,pct:(now-ss)/(now-start)*100});totalKnown+=now-ss;if(prev.on)totalOn+=now-ss;}
  // Calculate uptime based on known observation window only
  var up=totalKnown>0?Math.round(totalOn/totalKnown*100):0;
  if(pctEl){pctEl.textContent=up+'%';pctEl.style.color=up>=95?'var(--green)':up>=80?'var(--gold)':'var(--red)';}
  track.innerHTML=segs.map(function(s){return'<div class="uptime-seg '+(s.on?'on':'off')+'" style="width:'+s.pct+'%"></div>';}).join('');
}
_loadUptime();_renderUptime();

/* ═══ Feature 4: TPS Trend Arrow ═══ */
function _pushTPS(tps){
  _tpsBuf.push(tps);if(_tpsBuf.length>10)_tpsBuf.shift();
  var el=$('tps-trend');
  if(!el||_tpsBuf.length<3){if(el)el.textContent='';return;}
  var n=_tpsBuf.length,sx=0,sy=0,sxy=0,sx2=0;
  for(var i=0;i<n;i++){sx+=i;sy+=_tpsBuf[i];sxy+=i*_tpsBuf[i];sx2+=i*i;}
  var slope=(n*sxy-sx*sy)/(n*sx2-sx*sx);
  if(slope>0.3){el.textContent='\u25b2 Naik';el.className='trend up';}
  else if(slope<-0.3){el.textContent='\u25bc Turun';el.className='trend down';}
  else{el.textContent='\u2014 Stabil';el.className='trend flat';}
}

/* ═══ Feature 5: Server Health Index ═══ */
function _updateHealth(m){
  var hw=$('health-wrap');if(hw)hw.style.display='flex';
  var tps=m.tps||0,mobs=m.mobs?m.mobs.total:0,items=m.items?m.items.total:0,dp=m.dp_pct||0;
  var h=Math.round((Math.min(tps/20,1)*0.4+Math.max(0,1-mobs/500)*0.25+Math.max(0,1-items/300)*0.15+Math.max(0,1-dp/100)*0.2)*100);
  h=Math.max(0,Math.min(100,h));
  var se=$('health-score'),de=$('health-desc'),fe=$('gauge-fill');
  if(se){se.textContent=h+'%';se.style.color=h>=80?'var(--green)':h>=50?'var(--gold)':'var(--red)';}
  if(de){de.textContent=h>=90?'Excellent \u2014 Server optimal':h>=75?'Good \u2014 Performa baik':h>=50?'Fair \u2014 Ada tekanan':'Poor \u2014 Server lag berat';}
  if(fe){fe.setAttribute('stroke-dashoffset',100-h);fe.setAttribute('stroke',h>=80?'var(--green)':h>=50?'var(--gold)':'var(--red)');}
}

/* ═══ Feature 3: Entity Density Heatmap (Lag Detector) ═══ */
var _HM_CS=16; // 1 Minecraft chunk = 16 blocks
var _hmKeys=[];     // cached array of keys for current dimension
var _hmKeysDim='';  // dimension the key cache was built for
var _hmBeaconCache={};  // offscreen bitmap cache for beacon glows
var _hmBeaconCacheTTL=0;
function _buildHeatmap(){
  if(!_hmDirty&&_hmGrid)return;
  _hmGrid={};_hmMax=1;_hmKeys=[];_hmKeysDim='';
  _hmBeaconCache={};_hmBeaconCacheTTL=0;
  // Use live entity_hotspots data from server metrics
  if(lastMetrics&&lastMetrics.entity_hotspots&&lastMetrics.entity_hotspots.length){
    var hs=lastMetrics.entity_hotspots;
    var DIM_MAP={o:'overworld',n:'nether',t:'the_end'};
    for(var i=0;i<hs.length;i++){
      var h=hs[i],dm=DIM_MAP[h.d]||'overworld';
      var cx=Math.floor(h.x/_HM_CS),cz=Math.floor(h.z/_HM_CS);
      var k=dm+':'+cx+','+cz;
      _hmGrid[k]=h.c;
      if(h.c>_hmMax)_hmMax=h.c;
    }
  }
  _hmDirty=false;
}
/* Extract keys for current dimension (cached until data or dim changes) */
function _hmGetKeys(dim){
  if(_hmKeysDim===dim&&_hmKeys.length)return _hmKeys;
  _hmKeys=[];
  var pfx=dim+':';
  var allKeys=Object.keys(_hmGrid);
  for(var i=0;i<allKeys.length;i++){
    if(allKeys[i].indexOf(pfx)===0){
      var rest=allKeys[i].slice(pfx.length);
      var sep=rest.indexOf(',');
      _hmKeys.push({
        cx:parseInt(rest.slice(0,sep)),
        cz:parseInt(rest.slice(sep+1)),
        c:_hmGrid[allKeys[i]]
      });
    }
  }
  // Sort descending by count so top hotspots render last (on top) & get sonar priority
  _hmKeys.sort(function(a,b){return a.c-b.c;});
  _hmKeysDim=dim;
  return _hmKeys;
}
/* Get a cached offscreen beacon glow bitmap */
function _getBeaconBitmap(r,g,b,t,beaconR){
  var key=r+'|'+g+'|'+b+'|'+Math.round(t*10)+'|'+Math.round(beaconR);
  if(_hmBeaconCache[key])return _hmBeaconCache[key];
  // Limit cache size
  if(Object.keys(_hmBeaconCache).length>80){_hmBeaconCache={};_hmBeaconCacheTTL=0;}
  var sz=Math.ceil(beaconR*2)+2;
  var oc=document.createElement('canvas');
  oc.width=sz;oc.height=sz;
  var octx=oc.getContext('2d');
  var cx=sz/2,cy=sz/2;
  var grad=octx.createRadialGradient(cx,cy,0,cx,cy,beaconR);
  grad.addColorStop(0,'rgba('+r+','+g+','+b+','+(0.7+t*0.3)+')');
  grad.addColorStop(0.5,'rgba('+r+','+g+','+b+','+(0.3+t*0.2)+')');
  grad.addColorStop(1,'rgba('+r+','+g+','+b+',0)');
  octx.fillStyle=grad;
  octx.fillRect(0,0,sz,sz);
  // Inner bright core
  octx.beginPath();octx.arc(cx,cy,Math.max(2,1+t*3),0,6.2832);
  octx.fillStyle='rgba('+r+','+g+','+b+','+(0.8+t*0.2)+')';octx.fill();
  _hmBeaconCache[key]=oc;
  return oc;
}
/* Compute heatmap color for a normalized intensity t in [0,1] */
function _hmColor(t){
  var r,g,b;
  if(t<0.25){var u=t*4;r=52+u*148|0;g=211-u*11|0;b=153-u*103|0;}
  else if(t<0.5){var u=(t-0.25)*4;r=200+u*48|0;g=200-u*70|0;b=50-u*30|0;}
  else if(t<0.75){var u=(t-0.5)*4;r=248;g=130-u*50|0;b=20-u*20|0;}
  else{var u=(t-0.75)*4;r=248-u*28|0;g=80-u*50|0;b=0;}
  return{r:r,g:g,b:b};
}
function _renderHeatmap(ctx,cX,cY,sc,W,H){
  _buildHeatmap();if(!_hmGrid||_hmMax<1)return;
  var cp=_HM_CS*sc; // chunk size in pixels
  var zoomedOut=cp<10; // switch to beacon mode when chunks are small

  // ── LOD: cluster chunks when extremely zoomed out (cp < 3px) ──
  var LOD=1;
  if(cp<1.5)LOD=8;
  else if(cp<3)LOD=4;
  else if(cp<5)LOD=2;

  var keys=_hmGetKeys(radarDim);
  if(!keys.length)return;

  // For LOD > 1, aggregate nearby chunks into larger cells
  var renderData;
  if(LOD>1){
    var agg={};
    for(var i=0;i<keys.length;i++){
      var k=keys[i];
      var lcx=Math.floor(k.cx/LOD),lcz=Math.floor(k.cz/LOD);
      var ak=lcx+','+lcz;
      if(agg[ak]){agg[ak].c+=k.c;if(k.c>agg[ak].mc)agg[ak].mc=k.c;}
      else agg[ak]={cx:lcx*LOD,cz:lcz*LOD,c:k.c,mc:k.c};
    }
    renderData=[];
    var aggKeys=Object.keys(agg);
    for(var i=0;i<aggKeys.length;i++)renderData.push(agg[aggKeys[i]]);
    renderData.sort(function(a,b){return a.c-b.c;});
  }else{
    renderData=keys;
  }

  var cellSz=_HM_CS*LOD;
  var cellPx=cellSz*sc;
  var sonarPhase=(Date.now()%2400)/2400;
  // Budget: max 12 sonar waves to prevent GPU thrashing at far zoom
  var sonarBudget=12,sonarCount=0;

  for(var i=0;i<renderData.length;i++){
    var d=renderData[i];
    var fx=cX+(d.cx*_HM_CS-radarPanX)*sc,fz=cY+(d.cz*_HM_CS-radarPanZ)*sc;
    var centerX=fx+cellPx/2,centerZ=fz+cellPx/2;
    // Frustum cull
    if(centerX<-40||centerX>W+40||centerZ<-40||centerZ>H+40)continue;
    var t=Math.min(d.c/_hmMax,1);
    var col=_hmColor(t);
    var r=col.r,g=col.g,b=col.b;

    if(zoomedOut){
      // ── Beacon mode: use cached bitmap for glow ──
      var beaconR=Math.max(6,4+t*10);
      var bmp=_getBeaconBitmap(r,g,b,t,beaconR);
      ctx.drawImage(bmp,Math.floor(centerX-bmp.width/2),Math.floor(centerZ-bmp.height/2));
      // Entity count label on high-danger beacons
      if(t>=0.3){
        ctx.fillStyle='rgba(255,255,255,'+(0.5+t*0.5)+')';
        ctx.font='600 8px JetBrains Mono,monospace';
        ctx.textAlign='center';ctx.textBaseline='bottom';
        ctx.fillText(d.c,centerX,centerZ-beaconR-2);
      }
    }else{
      // ── Normal chunk-fill mode ──
      var alpha=0.2+t*0.5;
      ctx.fillStyle='rgba('+r+','+g+','+b+','+alpha+')';
      ctx.fillRect(fx,fz,cellPx,cellPx);
      if(cellPx>=6){ctx.strokeStyle='rgba('+r+','+g+','+b+','+(0.15+t*0.3)+')';ctx.lineWidth=0.5;ctx.strokeRect(fx,fz,cellPx,cellPx);}
      if(cellPx>=20){
        ctx.fillStyle='rgba(255,255,255,'+(0.4+t*0.5)+')';
        ctx.font='600 '+Math.min(11,Math.floor(cellPx/2.5))+'px JetBrains Mono,monospace';
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(d.c,centerX,centerZ);
      }
    }
    // ── Sonar wave on orange+ (t >= 0.4) — budget-limited ──
    if(t>=0.4&&sonarCount<sonarBudget){
      sonarCount++;
      var maxR=zoomedOut?Math.max(18,8+t*16):cellPx*1.8;
      for(var wi=0;wi<2;wi++){
        var phase=(sonarPhase+wi*0.5)%1;
        var ringR=phase*maxR;
        var ringAlpha=(1-phase)*0.35*t;
        if(ringAlpha<0.02)continue;
        ctx.beginPath();ctx.arc(centerX,centerZ,ringR,0,6.2832);
        ctx.strokeStyle='rgba('+r+','+g+','+b+','+ringAlpha.toFixed(3)+')';
        ctx.lineWidth=Math.max(1,2*(1-phase));
        ctx.stroke();
      }
    }
  }
  ctx.textBaseline='alphabetic';
}

/* ═══ Feature 6: Peak Hours Bar Chart ═══ */
function _drawPeakHours(){
  var grid=$('peak-grid'),labels=$('peak-labels'),statsEl=$('peak-stats'),legendEl=$('peak-legend'),descEl=$('peak-desc'),tipEl=$('peak-tip');
  if(!grid||!labels)return;
  // Empty data state
  if(!mhData||!mhData.length){
    grid.innerHTML='<div style="text-align:center;padding:16px 8px;font-size:.55rem;color:var(--mute);width:100%">Belum ada data histori. Peak hours akan muncul setelah BDS sync berjalan.</div>';
    labels.innerHTML='';if(statsEl)statsEl.innerHTML='';if(legendEl)legendEl.innerHTML='';
    if(descEl)descEl.textContent='Menunggu data dari server...';
    return;
  }
  var hours=new Array(24),counts=new Array(24);
  for(var i=0;i<24;i++){hours[i]=0;counts[i]=0;}
  // Aggregate player counts per hour with validation
  var totalSamples=0;
  for(var i=0;i<mhData.length;i++){
    var row=mhData[i];
    if(!row||!row.ts)continue;
    var d=new Date(row.ts);
    if(isNaN(d.getTime()))continue;
    var h=d.getHours();
    var p=typeof row.players==='number'?row.players:(parseInt(row.players)||0);
    if(p>=0){hours[h]+=p;counts[h]++;totalSamples++;}
  }
  // Compute averages, find peak and low
  var avgs=new Array(24),mx=0,peakH=-1,lowH=-1,lowV=Infinity,hasData=false,totalAvg=0,dataHours=0;
  for(var i=0;i<24;i++){
    avgs[i]=counts[i]>0?hours[i]/counts[i]:0;
    if(counts[i]>0){hasData=true;totalAvg+=avgs[i];dataHours++;}
    if(avgs[i]>mx){mx=avgs[i];peakH=i;}
    if(counts[i]>0&&avgs[i]<lowV){lowV=avgs[i];lowH=i;}
  }
  if(!hasData){
    grid.innerHTML='<div style="text-align:center;padding:16px 8px;font-size:.55rem;color:var(--mute);width:100%">Data pemain belum cukup untuk menampilkan peak hours.</div>';
    labels.innerHTML='';if(statsEl)statsEl.innerHTML='';if(legendEl)legendEl.innerHTML='';
    if(descEl)descEl.textContent='Data belum tersedia.';
    return;
  }
  if(mx<1)mx=1;
  var overallAvg=dataHours>0?totalAvg/dataHours:0;
  var now=new Date().getHours();

  // Description
  if(descEl){
    var rangeLabel=mhRange==='week'?'7 hari':mhRange==='month'?'30 hari':'24 jam';
    descEl.textContent='Rata-rata jumlah pemain online per jam dalam '+rangeLabel+' terakhir ('+totalSamples+' sampel data). Hover bar untuk detail.';
  }

  // Store bar data for tooltip
  var _peakBarData=[];

  // Build bars — no data-tip, use mouse events for tooltip
  grid.innerHTML=avgs.map(function(v,i){
    var pct=counts[i]>0?Math.max(6,v/mx*100):4;
    var isPeak=i===peakH&&mx>0;
    var isNow=i===now;
    var c;
    if(isPeak)c='var(--gold)';
    else if(isNow)c='var(--ac)';
    else if(counts[i]===0)c='rgba(255,255,255,0.06)';
    else if(v>=mx*0.7)c='var(--green)';
    else if(v>=mx*0.3)c='var(--cyan)';
    else c='var(--mute)';
    var extra='';
    if(isPeak)extra+='border:1px solid var(--gold);box-shadow:0 0 6px rgba(251,191,36,.2);';
    if(isNow&&!isPeak)extra+='border-bottom:2px solid var(--ac);';
    if(counts[i]===0)extra+='opacity:.3;';
    _peakBarData.push({h:i,avg:v,cnt:counts[i],isPeak:isPeak,isNow:isNow});
    return'<div class="peak-bar" data-idx="'+i+'" style="height:'+pct+'%;background:'+c+';'+extra+'"></div>';
  }).join('');

  // Tooltip via mouseover on bars (positioned element, no clipping)
  if(tipEl){
    var bars=grid.querySelectorAll('.peak-bar');
    bars.forEach(function(bar){
      bar.addEventListener('mouseenter',function(){
        var idx=parseInt(bar.dataset.idx);
        var bd=_peakBarData[idx];if(!bd)return;
        var endH=idx<23?idx+1:0;
        var lines=[];
        lines.push('<b style="color:var(--text)">'+idx+':00 — '+endH+':00</b>');
        if(bd.cnt>0){
          lines.push('<span style="color:var(--dim)">Avg pemain: <b style="color:var(--text)">'+bd.avg.toFixed(1)+'</b></span>');
          lines.push('<span style="color:var(--mute)">'+bd.cnt+' sampel data</span>');
        }else{
          lines.push('<span style="color:var(--mute)">Tidak ada data</span>');
        }
        if(bd.isPeak)lines.push('<span style="color:var(--gold);font-weight:600">Jam tersibuk</span>');
        if(bd.isNow)lines.push('<span style="color:var(--ac);font-weight:600">Jam sekarang</span>');
        tipEl.innerHTML=lines.join('<br>');
        tipEl.style.display='block';
        // Position above the bar
        var barRect=bar.getBoundingClientRect();
        var wrapRect=grid.parentElement.getBoundingClientRect();
        var tipX=barRect.left-wrapRect.left+barRect.width/2;
        tipEl.style.left=Math.max(10,Math.min(tipX,wrapRect.width-tipEl.offsetWidth-10))+'px';
      });
      bar.addEventListener('mouseleave',function(){
        tipEl.style.display='none';
      });
    });
  }

  // Labels — show every 3 hours, highlight current and peak
  labels.innerHTML='';
  for(var i=0;i<24;i++){
    var s='<span';
    if(i===now)s+=' style="color:var(--ac);font-weight:700"';
    else if(i===peakH)s+=' style="color:var(--gold);font-weight:700"';
    s+='>'+(i%3===0?i:'')+'</span>';
    labels.innerHTML+=s;
  }

  // Legend — clean dot+text, no emojis
  if(legendEl){
    legendEl.innerHTML=
      '<div class="peak-legend-item"><span class="peak-legend-dot" style="background:var(--gold)"></span>Tersibuk</div>'
      +'<div class="peak-legend-item"><span class="peak-legend-dot" style="background:var(--ac)"></span>Jam ini</div>'
      +'<div class="peak-legend-item"><span class="peak-legend-dot" style="background:var(--green)"></span>Ramai</div>'
      +'<div class="peak-legend-item"><span class="peak-legend-dot" style="background:var(--cyan)"></span>Normal</div>'
      +'<div class="peak-legend-item"><span class="peak-legend-dot" style="background:var(--mute)"></span>Sepi</div>';
  }

  // Stat cards — structured, no emojis
  if(statsEl){
    var peakTime=peakH>=0?peakH+':00'+(peakH<23?' \u2014 '+(peakH+1)+':00':' \u2014 0:00'):'\u2014';
    var peakVal=peakH>=0?avgs[peakH].toFixed(1)+' avg':'\u2014';
    var nowVal=counts[now]>0?avgs[now].toFixed(1)+' avg':'belum ada data';
    var quietTime=lowH>=0?lowH+':00'+(lowH<23?' \u2014 '+(lowH+1)+':00':' \u2014 0:00'):'\u2014';
    var quietVal=lowH>=0?avgs[lowH].toFixed(1)+' avg':'\u2014';
    statsEl.innerHTML=
      '<div class="peak-stat"><div class="peak-stat-label">Jam Tersibuk</div><div class="peak-stat-val" style="color:var(--gold)">'+peakTime+'</div><div style="font-size:.4rem;color:var(--mute);margin-top:2px">'+peakVal+'</div></div>'
      +'<div class="peak-stat"><div class="peak-stat-label">Sekarang ('+now+':00)</div><div class="peak-stat-val" style="color:var(--ac)">'+nowVal+'</div><div style="font-size:.4rem;color:var(--mute);margin-top:2px">'+(counts[now]>0?counts[now]+' sampel':'')+'</div></div>'
      +'<div class="peak-stat"><div class="peak-stat-label">Jam Tersepi</div><div class="peak-stat-val" style="color:var(--green)">'+quietTime+'</div><div style="font-size:.4rem;color:var(--mute);margin-top:2px">'+quietVal+'</div></div>';
  }
}

/* ═══ Feature 7: Export CSV & PNG ═══ */
(function(){
  var csv=$('exp-csv');
  if(csv)csv.addEventListener('click',function(){
    if(!mhData.length)return;
    var header='timestamp,tps,players,mobs,entities,items\n';
    var rows=mhData.map(function(r){return[r.ts,r.tps||0,r.players||0,r.mobs||0,r.entities||0,r.items||0].join(',');}).join('\n');
    var blob=new Blob([header+rows],{type:'text/csv'});
    var a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download='laughtale_metrics_'+new Date().toISOString().slice(0,10)+'.csv';
    a.click();URL.revokeObjectURL(a.href);
  });
  var png=$('exp-png');
  if(png)png.addEventListener('click',function(){
    var canvases=document.querySelectorAll('.mh-row-cv');
    if(!canvases.length)return;
    var totalH=0,maxW=0;
    canvases.forEach(function(c){totalH+=c.height+20;if(c.width>maxW)maxW=c.width;});
    var out=document.createElement('canvas');out.width=maxW;out.height=totalH+40;
    var ctx=out.getContext('2d');ctx.fillStyle='#09090f';ctx.fillRect(0,0,out.width,out.height);
    ctx.fillStyle='#fff';ctx.font='bold 12px JetBrains Mono,monospace';
    ctx.fillText('Laughtale SMP — Performance '+new Date().toLocaleString('id-ID'),10,18);
    var y=35;
    var names=['TPS','Players','Mobs','Entity','Items'];
    canvases.forEach(function(c,i){
      ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font='9px JetBrains Mono,monospace';
      ctx.fillText(names[i]||'',4,y+10);
      ctx.drawImage(c,0,y);y+=c.height+20;
    });
    var a=document.createElement('a');a.href=out.toDataURL('image/png');
    a.download='laughtale_metrics_'+new Date().toISOString().slice(0,10)+'.png';
    a.click();
  });
})();

/* ═══ Feature 8: Dark/Light Theme Toggle ═══ */
(function(){
  var saved=localStorage.getItem('lt_theme');
  if(saved==='light')document.body.classList.add('light');
  _updateThemeLabel();
  var btn=$('theme-toggle');
  if(btn)btn.addEventListener('click',function(){
    document.body.classList.toggle('light');
    var isLight=document.body.classList.contains('light');
    localStorage.setItem('lt_theme',isLight?'light':'dark');
    _updateThemeLabel();
    // Redraw canvases
    if(latHistory.length>1)drawChart();
    drawMHChart();drawRadar();
  });
})();
function _updateThemeLabel(){
  var el=$('theme-label');
  if(el)el.textContent=document.body.classList.contains('light')?'DARK':'LIGHT';
}

/* ═══ Feature 9: Metric Comparison (vs previous period) ═══ */
function _calcDeltas(){
  if(!mhData.length||mhData.length<4)return;
  var mid=Math.floor(mhData.length/2);
  var keys=['tps','players','mobs','entities','items'];
  for(var ki=0;ki<keys.length;ki++){
    var k=keys[ki],sumA=0,cntA=0,sumB=0,cntB=0;
    for(var i=0;i<mid;i++){sumA+=(mhData[i][k]||0);cntA++;}
    for(var i=mid;i<mhData.length;i++){sumB+=(mhData[i][k]||0);cntB++;}
    var avgA=cntA?sumA/cntA:0,avgB=cntB?sumB/cntB:0;
    var delta=avgB-avgA;
    var el=$('mhr-'+k+'-v');
    if(!el)continue;
    var existing=el.parentElement.querySelector('.mh-delta');
    if(existing)existing.remove();
    var span=document.createElement('span');
    span.className='mh-delta '+(Math.abs(delta)<0.5?'flat':delta>0?'up':'down');
    var sign=delta>0?'+':'';
    span.textContent=sign+(k==='tps'?delta.toFixed(1):Math.round(delta));
    el.parentElement.appendChild(span);
  }
}

/* ═══ Feature 10: Radar Search & Quick Jump ═══ */
(function(){
  var nameIn=$('rs-name'),xIn=$('rs-x'),zIn=$('rs-z'),goBtn=$('rs-go');
  if(nameIn)nameIn.addEventListener('input',function(){
    var q=nameIn.value.trim().toLowerCase();
    if(!q)return;
    for(var i=0;i<radarPlayers.length;i++){
      var p=radarPlayers[i];
      if(p.name&&p.name.toLowerCase().indexOf(q)!==-1){
        _selectPlayer(p.name);
        radarPanX=p.x;radarPanZ=p.z;
        radarDim=p.dim||'overworld';
        var dt=$('radar-dim-tabs');
        if(dt)dt.querySelectorAll('.tab').forEach(function(b){b.classList.remove('a');if(b.dataset.dim===radarDim)b.classList.add('a');});
        radarZoom=300;rFollow=true;
        drawRadar();break;
      }
    }
  });
  if(nameIn)nameIn.addEventListener('keydown',function(e){if(e.key==='Enter')nameIn.dispatchEvent(new Event('input'));});
  if(goBtn)goBtn.addEventListener('click',function(){
    var x=parseFloat(xIn?xIn.value:'');
    var z=parseFloat(zIn?zIn.value:'');
    if(isNaN(x)&&nameIn&&nameIn.value.trim()){nameIn.dispatchEvent(new Event('input'));return;}
    if(!isNaN(x)&&!isNaN(z)){
      radarPanX=x;radarPanZ=z;radarZoom=200;rFollow=false;rSel=null;drawRadar();
    }
  });
})();

/* Peak hours + deltas are now called directly from drawMHChart() — no hook needed */

/* ═══ Feature 11: Radar Measurement Tool ═══ */
var _measureOn=false,_measurePts=[];
(function(){
  var btn=$('measure-toggle');
  if(btn)btn.addEventListener('click',function(){
    _measureOn=!_measureOn;
    btn.classList.toggle('active',_measureOn);
    _measurePts=[];
    safeSet('measure-info','');
    drawRadar();
  });
})();
function _measureClick(worldX,worldZ){
  if(!_measureOn)return false;
  _measurePts.push({x:worldX,z:worldZ});
  if(_measurePts.length>2)_measurePts=[_measurePts[_measurePts.length-1]];
  if(_measurePts.length===2){
    var dx=_measurePts[1].x-_measurePts[0].x,dz=_measurePts[1].z-_measurePts[0].z;
    var dist=Math.sqrt(dx*dx+dz*dz);
    safeSet('measure-info',Math.round(dist)+' blok ('+Math.round(dx)+', '+Math.round(dz)+')');
  }else{
    safeSet('measure-info','Klik titik kedua...');
  }
  drawRadar();
  return true;
}
function _drawMeasure(ctx,cX,cY,sc){
  if(!_measureOn||!_measurePts.length)return;
  for(var i=0;i<_measurePts.length;i++){
    var px=cX+(_measurePts[i].x-radarPanX)*sc,pz=cY+(_measurePts[i].z-radarPanZ)*sc;
    ctx.beginPath();ctx.arc(px,pz,5,0,6.28);ctx.fillStyle='rgba(245,200,66,.4)';ctx.fill();
    ctx.beginPath();ctx.arc(px,pz,3,0,6.28);ctx.fillStyle='#f5c842';ctx.fill();
  }
  if(_measurePts.length===2){
    var x1=cX+(_measurePts[0].x-radarPanX)*sc,z1=cY+(_measurePts[0].z-radarPanZ)*sc;
    var x2=cX+(_measurePts[1].x-radarPanX)*sc,z2=cY+(_measurePts[1].z-radarPanZ)*sc;
    ctx.beginPath();ctx.moveTo(x1,z1);ctx.lineTo(x2,z2);
    ctx.strokeStyle='rgba(245,200,66,.6)';ctx.lineWidth=1.5;ctx.setLineDash([4,4]);ctx.stroke();ctx.setLineDash([]);
    var dx=_measurePts[1].x-_measurePts[0].x,dz=_measurePts[1].z-_measurePts[0].z;
    var dist=Math.round(Math.sqrt(dx*dx+dz*dz));
    var mx=(x1+x2)/2,mz=(z1+z2)/2;
    ctx.font='bold 10px JetBrains Mono,monospace';ctx.fillStyle='#f5c842';ctx.textAlign='center';
    ctx.fillText(dist+' blok',mx,mz-6);
  }
}

/* ═══ Feature 12: Latency Chart Tooltip ═══ */
(function(){
  var cv=$('latency-chart'),tip=$('lat-tip'),line=$('lat-tip-line');
  if(!cv||!tip)return;
  var wrap=cv.parentElement;
  cv.addEventListener('mousemove',function(e){
    if(latHistory.length<2)return;
    var rect=cv.getBoundingClientRect();
    var x=e.clientX-rect.left,W=cv.clientWidth;
    var pad=45,cw=W-pad-15;
    var idx=Math.round((x-pad)/cw*(latHistory.length-1));
    idx=Math.max(0,Math.min(latHistory.length-1,idx));
    var pt=latHistory[idx];
    if(!pt)return;
    tip.textContent=pt.val+'ms — '+pt.time;
    tip.style.display='block';
    var tipX=pad+cw*(idx/(latHistory.length-1));
    tip.style.left=Math.min(tipX,W-100)+'px';tip.style.top='4px';
    if(line){line.style.display='block';line.style.left=tipX+'px';}
  });
  cv.addEventListener('mouseleave',function(){
    tip.style.display='none';if(line)line.style.display='none';
  });
})();

/* ═══ Feature 13: Animated Number Counter ═══ */
var _animVals={};
function _animateVal(id,newVal,decimals,suffix){
  var el=$(id);if(!el)return;
  var key=id;
  var from=_animVals[key]||0;
  if(from===newVal){el.textContent=(decimals?newVal.toFixed(decimals):newVal)+(suffix||'');return;}
  _animVals[key]=newVal;
  var dur=300,start=Date.now();
  function step(){
    var t=Math.min((Date.now()-start)/dur,1);
    t=t*t*(3-2*t); // smoothstep
    var v=from+(newVal-from)*t;
    el.textContent=(decimals?v.toFixed(decimals):Math.round(v))+(suffix||'');
    if(t<1)requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ═══ Feature 14: Metric Card Sparklines ═══ */
var _msBuf={tps:[],lat:[],players:[]};
function _pushMSpark(key,val){
  _msBuf[key].push(val);if(_msBuf[key].length>30)_msBuf[key].shift();
}
function _drawMSparks(){
  var map={tps:'ms-tps',lat:'ms-lat',players:'ms-players'};
  var colors={tps:'#34d399',lat:'#a855f7',players:'#22d3ee'};
  for(var k in map){
    var cv=$(map[k]),buf=_msBuf[k];
    if(!cv||buf.length<2)continue;
    var par=cv.parentElement;
    var W=par?par.clientWidth:100,H=20;
    cv.width=W;cv.height=H;
    var ctx=cv.getContext('2d');ctx.clearRect(0,0,W,H);
    var mn=Infinity,mx=-Infinity;
    for(var i=0;i<buf.length;i++){if(buf[i]<mn)mn=buf[i];if(buf[i]>mx)mx=buf[i];}
    if(mx<=mn)mx=mn+1;
    var grad=ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,hexAlpha(colors[k],0.3));grad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath();
    for(var i=0;i<buf.length;i++){
      var x=W*(i/(buf.length-1)),y=H-(buf[i]-mn)/(mx-mn)*H;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
    ctx.beginPath();ctx.strokeStyle=colors[k];ctx.lineWidth=1;ctx.lineJoin='round';
    for(var i=0;i<buf.length;i++){
      var x=W*(i/(buf.length-1)),y=H-(buf[i]-mn)/(mx-mn)*H;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
}

/* ═══ Feature 15: Radar Mini-Map ═══ */
function _drawMiniMap(){
  var mm=$('radar-minimap'),cv=$('radar-mm-cv');
  if(!mm||!cv)return;
  var allP=radarPlayers;
  if(!allP||!allP.length){mm.style.display='none';return;}
  if(radarZoom<600){mm.style.display='none';return;}
  mm.style.display='block';
  var S=80;cv.width=S;cv.height=S;
  var ctx=cv.getContext('2d');ctx.clearRect(0,0,S,S);
  // Determine bounds from all players
  var mnX=Infinity,mxX=-Infinity,mnZ=Infinity,mxZ=-Infinity;
  for(var i=0;i<allP.length;i++){
    var p=allP[i];if(!p||p.x===undefined||(p.dim||'overworld')!==radarDim)continue;
    if(p.x<mnX)mnX=p.x;if(p.x>mxX)mxX=p.x;if(p.z<mnZ)mnZ=p.z;if(p.z>mxZ)mxZ=p.z;
  }
  if(mnX===Infinity)return;
  var pad=200;mnX-=pad;mxX+=pad;mnZ-=pad;mxZ+=pad;
  var rng=Math.max(mxX-mnX,mxZ-mnZ,500);
  var cxW=(mnX+mxX)/2,czW=(mnZ+mxZ)/2;
  var sc=S/rng;
  // Draw player dots
  for(var i=0;i<allP.length;i++){
    var p=allP[i];if(!p||p.x===undefined||(p.dim||'overworld')!==radarDim)continue;
    var px=S/2+(p.x-cxW)*sc,pz=S/2+(p.z-czW)*sc;
    ctx.beginPath();ctx.arc(px,pz,2,0,6.28);ctx.fillStyle='#34d399';ctx.fill();
  }
  // Draw viewport rectangle
  var vx=S/2+(radarPanX-radarZoom-cxW)*sc,vz=S/2+(radarPanZ-radarZoom-czW)*sc;
  var vw=radarZoom*2*sc,vh=radarZoom*2*sc;
  ctx.strokeStyle='rgba(168,85,247,.5)';ctx.lineWidth=1;ctx.strokeRect(vx,vz,vw,vh);
}

/* Hook animated vals + sparklines into fetch cycle */
var _origSafeSet=safeSet;
safeSet=function(id,val){
  // Intercept metric card updates for animation
  if(id==='m-tps'&&val!=='—'){var n=parseFloat(val);if(!isNaN(n)){_animateVal(id,n,1);_pushMSpark('tps',n);return;}}
  if(id==='m-latency'&&val!=='—'){var n=parseInt(val);if(!isNaN(n)){_animateVal(id,n,0,'ms');_pushMSpark('lat',n);return;}}
  if(id==='m-players'&&val!=='—'){var m=val.match(/(\d+)/);if(m){_animateVal(id,parseInt(m[1]),0);_pushMSpark('players',parseInt(m[1]));return;}}
  _origSafeSet(id,val);
};

/* Hook measure tool into radar click — FIXED coordinate calculation */
var _origRadarClick=null;
var _coordTipTimer=0;
function _pixelToWorld(cv,clientX,clientY){
  var rect=cv.getBoundingClientRect();
  var W=parseInt(cv.style.width)||600,H=parseInt(cv.style.height)||400;
  var cX=W/2,cY=H/2,sc=Math.min(W,H)/(radarZoom*2);
  var mx=clientX-rect.left,mz=clientY-rect.top;
  return{x:Math.round(radarPanX+(mx-cX)/sc),z:Math.round(radarPanZ+(mz-cY)/sc),px:mx,pz:mz};
}
function _showCoordTip(cv,worldX,worldZ,px,pz){
  var tip=$('radar-coord-tip');if(!tip)return;
  tip.textContent='X: '+worldX+' \u00b7 Z: '+worldZ;
  tip.style.display='block';
  // Position relative to radar-wrap
  var wrap=cv.parentElement;
  var wrapRect=wrap?wrap.getBoundingClientRect():{left:0,top:0};
  var cvRect=cv.getBoundingClientRect();
  var offsetX=cvRect.left-wrapRect.left+px;
  var offsetY=cvRect.top-wrapRect.top+pz;
  // Keep tooltip inside canvas bounds
  var tipW=tip.offsetWidth||100;
  if(offsetX+tipW+8>cv.clientWidth)offsetX=offsetX-tipW-12;
  tip.style.left=Math.max(4,offsetX+8)+'px';
  tip.style.top=Math.max(4,offsetY-28)+'px';
  clearTimeout(_coordTipTimer);
  _coordTipTimer=setTimeout(function(){tip.style.display='none';},3000);
}
(function(){
  var cv=$('radar-canvas');
  if(!cv)return;
  cv.addEventListener('click',function(e){
    var w=_pixelToWorld(cv,e.clientX,e.clientY);
    // Measurement tool takes priority
    if(_measureOn){
      _measureClick(w.x,w.z);
      return;
    }
    // If no player hit, show coordinate tooltip
    var hit=_rHit(cv,e);
    if(!hit){
      _showCoordTip(cv,w.x,w.z,w.px,w.pz);
    }
  });
})();

/* Hook drawMeasure + minimap into drawRadar */
var _origDrawRadar=drawRadar;
drawRadar=function(){
  _origDrawRadar();
  try{
    var cv=$('radar-canvas');if(!cv)return;
    var ctx=cv.getContext('2d');
    var dpr=window.devicePixelRatio||1;
    var W=parseInt(cv.style.width)||600,H=parseInt(cv.style.height)||400;
    var cX=W/2,cY=H/2,sc=Math.min(W,H)/(radarZoom*2);
    _drawMeasure(ctx,cX,cY,sc);
    _drawMiniMap();
  }catch(e){}
};

/* Draw sparklines after each fetch cycle */
var _origFetchStatus2=window.doRefresh;
window.doRefresh=function(){if(_origFetchStatus2)_origFetchStatus2();setTimeout(_drawMSparks,500);};
setTimeout(_drawMSparks,3000);

/* ═══ Feature 16: Keyboard Shortcuts ═══ */
document.addEventListener('keydown',function(e){
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;
  var k=e.key.toLowerCase();
  if(k==='r'){e.preventDefault();doRefresh();}
  else if(k==='f'){e.preventDefault();var fb=$('radar-fullscreen');if(fb)fb.click();}
  else if(k==='1'){e.preventDefault();_switchDim('overworld');}
  else if(k==='2'){e.preventDefault();_switchDim('nether');}
  else if(k==='3'){e.preventDefault();_switchDim('the_end');}
  else if(k==='escape'){
    if(document.fullscreenElement){document.exitFullscreen();return;}
    rSel=null;rFollow=false;var ri=$('radar-info');if(ri)ri.style.display='none';
    _measureOn=false;_measurePts=[];var mb=$('measure-toggle');if(mb)mb.classList.remove('active');
    safeSet('measure-info','');drawRadar();
  }
  else if(k==='='||k==='+'){e.preventDefault();radarZoom=Math.max(50,radarZoom-100);drawRadar();var zl=$('radar-zoom-label');if(zl)zl.textContent='Zoom: '+radarZoom+' blok';}
  else if(k==='-'){e.preventDefault();radarZoom=Math.min(10000,radarZoom+100);drawRadar();var zl=$('radar-zoom-label');if(zl)zl.textContent='Zoom: '+radarZoom+' blok';}
});
function _switchDim(dim){
  radarDim=dim;
  var dt=$('radar-dim-tabs');
  if(dt)dt.querySelectorAll('.tab').forEach(function(b){b.classList.remove('a');if(b.dataset.dim===dim)b.classList.add('a');});
  drawRadar();
}

/* ═══ Feature 17: PWA Service Worker ═══ */
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw-monitor.js').catch(function(){});
}

/* Feature 20: Weather icon removed — was showing moon incorrectly (using ticks as hours) */

/* ═══ Feature A: Canvas Rendering Optimization ═══ */
/* Throttle drawRadar to max 30fps and skip when tab hidden */
var _radarThrottleId=0,_radarQueued=false;
var _baseDrawRadar=drawRadar;
drawRadar=function(){
  if(document.hidden)return; // skip render when tab not visible
  if(_radarThrottleId){_radarQueued=true;return;}
  _baseDrawRadar();
  _radarThrottleId=setTimeout(function(){
    _radarThrottleId=0;
    if(_radarQueued){_radarQueued=false;_baseDrawRadar();}
  },33); // ~30fps cap
};
/* Invalidate head cache when selection changes */
var _prevRSel=null;
var _baseSelectPlayer=_selectPlayer;
_selectPlayer=function(name){
  if(name!==_prevRSel){_headCache={};_prevRSel=name;}
  _baseSelectPlayer(name);
};

/* ═══ Feature B: Data Caching & Deduplication ═══ */
/* BDS data hash check — skip re-render if data identical */
var _origFetchBDS=fetchBDSData;
fetchBDSData=async function(){
  try{
    var _sid=(_servers[_currentIdx]&&_servers[_currentIdx].sync_id)||'current';
    var r=await fetch(SB_URL+'/rest/v1/leaderboard_sync?id=eq.'+_sid+'&select=online_players,synced_at,server_metrics',{headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}});
    var d=await r.json();if(!d||!d[0])return;
    // Hash check: skip full re-render if data unchanged
    var hash=d[0].synced_at+'|'+(d[0].server_metrics?JSON.stringify(d[0].server_metrics).length:'0');
    if(hash===_lastBDSHash)return; // identical data, skip
    _lastBDSHash=hash;
    // Proceed with original processing (inline to avoid double-fetch)
    var row=d[0];
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
};

/* ═══ Feature C: Error Recovery UI ═══ */
function _showErrBanner(msg,type){
  var existing=$('err-banner');
  if(existing)existing.remove();
  var banner=document.createElement('div');
  banner.id='err-banner';
  banner.style.cssText='position:fixed;top:0;left:0;right:0;z-index:999;display:flex;align-items:center;gap:8px;padding:8px 16px;font-family:"JetBrains Mono",monospace;font-size:.6rem;color:#fff;background:linear-gradient(90deg,rgba(248,113,113,.95),rgba(220,38,38,.95));backdrop-filter:blur(8px);animation:errSlide .3s ease';
  banner.innerHTML='<span style="font-size:.7rem;flex-shrink:0"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>'
    +'<span style="flex:1"><b>'+(type||'Error')+'</b> \u2014 '+esc(msg)+(_fetchFails>1?' <span style="opacity:.7">('+_fetchFails+'x gagal)</span>':'')+'</span>'
    +'<button id="err-retry" style="font-family:inherit;font-size:.5rem;font-weight:700;padding:4px 12px;border-radius:4px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.15);color:#fff;cursor:pointer;transition:background .2s">\u27f3 RETRY</button>'
    +'<button id="err-dismiss" style="font-family:inherit;font-size:.7rem;background:none;border:none;color:rgba(255,255,255,.6);cursor:pointer;padding:4px 8px">\u2715</button>';
  document.body.prepend(banner);
  var retryBtn=$('err-retry');
  if(retryBtn)retryBtn.addEventListener('click',function(){_hideErrBanner();_srvStatCache=null;fetchStatus();});
  var dismissBtn=$('err-dismiss');
  if(dismissBtn)dismissBtn.addEventListener('click',_hideErrBanner);
}
function _hideErrBanner(){
  var b=$('err-banner');if(b)b.remove();
}
/* CSS animation for error banner */
(function(){
  var st=document.createElement('style');
  st.textContent='@keyframes errSlide{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}';
  document.head.appendChild(st);
})();
