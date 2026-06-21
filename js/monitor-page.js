/* monitor-page.js — Server Performance Monitor.
 * SLO: render success ≥ 99%/24h. mcsrvstat fail (transport-only) tidak boleh OFFLINE-flag UI.
 * Fallback chain: live mcsrvstat → Supabase synced_at < 2 min ("CACHED") → OFFLINE banner.
 * Runbook: docs/runbook/leaderboard-sync.md (cek mcsrvstat status & Supabase freshness). */
var SB_URL=window.SB_URL;
var SB_KEY=window.SB_KEY;
var $=function(id){return document.getElementById(id);};
var latHistory=[],MAX_HIST=60,chartCanvas=null,chartCtx=null,refreshTimer=null;
var _radarInteracting=false,_interactEnd=0;
var serverIP='laughtale.my.id:19214',lastMetrics=null;
var _tpsBuf=[],_hmOn=false,_hmGrid=null,_hmDirty=true,_hmMax=1;
// [A11Y] Honor prefers-reduced-motion — disable sonar pulse, land pulse, trail anim.
// Global flag dipakai oleh drawRadar dan _hmAnimLoop. Listener di setup di IIFE bawah.
var _reduceMotion=(typeof window!=='undefined'&&window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)||false;
var _perfMode=false;
try{
  var savedPerf=localStorage.getItem('lt_perf_mode');
  if(savedPerf!==null)_perfMode=savedPerf==='1';
  else _perfMode=(typeof window!=='undefined'&&window.innerWidth<768);
}catch(e){_perfMode=(typeof window!=='undefined'&&window.innerWidth<768);}
var _notifOn=false,_notifCD={},_notifHist=[],_NOTIF_CD=300000;
var _uptimeLog=null,_prevOnline=null;
var _fetchLock=false,_lastBDSHash='',_srvStatCache=null,_srvStatCacheTs=0;
// Circuit breaker untuk mcsrvstat (§7.2). 3 fail → pause 5 min, fallback ke Supabase.
var _fetchFails=0,_maxRetries=2,_retryDelay=1000;
var _cb={fails:0,until:0},_CB_TRIP=3,_CB_PAUSE=300000;
var _CACHE_FRESH_MS=120000; // Supabase < 2 menit dianggap "live cached"
var _lastSBSync=0; // ms timestamp dari m.ts terbaru
var _lastMaxP=0;   // last known max-slot dari mcsrvstat (BDS tidak expose)
var _lastDP=null;
try{var _savedDP=localStorage.getItem('lt_lastDP');if(_savedDP)_lastDP=JSON.parse(_savedDP);}catch(e){}

/* ═══ Feature 18: Multi-Server Support ═══ */
var _servers=[{name:'Laughtale SMP',ip:'laughtale.my.id:19214',sync_id:'current'}];
var _currentIdx=0;

/* ═══ Moon phase state (sinkron dengan world.getMoonPhase di Bedrock) ═══
 * Fase mengikuti konvensi vanilla MC: phase = day % 8.
 * 0=Purnama, 1=Cembung Surut, 2=Perempat Akhir, 3=Sabit Surut,
 * 4=Bulan Baru, 5=Sabit Muda, 6=Perempat Awal, 7=Cembung Naik.
 * Hanya dipakai untuk visual saat malam — di-set via applyBDSMetrics.world_day. */
var _moonPhase=0,_moonDay=0;
var _MOON_NAMES_ID=['Purnama','Cembung Surut','Perempat Akhir','Sabit Surut',
                    'Bulan Baru','Sabit Muda','Perempat Awal','Cembung Naik'];
function _moonPhaseFromDay(day){
  var d=Math.floor(Number(day)||0);
  return ((d%8)+8)%8;
}

window.forceUpdateAssets = function() {
  try {
    if ('caches' in window) {
      caches.keys().then(function(names) {
        return Promise.all(names.map(function(name) {
          return caches.delete(name);
        }));
      }).then(function() {
        /* [PROD] cache cleared */
      });
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        for (var i = 0; i < regs.length; i++) {
          regs[i].unregister();
        }
      });
    }
    try { localStorage.removeItem('lt_cached_data'); } catch(e) {}
    
    // High-fidelity SaaS blur loading transition screen
    var ov = document.createElement('div');
    ov.style.position = 'fixed';
    ov.style.top = '0';
    ov.style.left = '0';
    ov.style.width = '100vw';
    ov.style.height = '100vh';
    ov.style.background = 'rgba(9, 9, 15, 0.7)';
    ov.style.backdropFilter = 'blur(20px)';
    ov.style.webkitBackdropFilter = 'blur(20px)';
    ov.style.zIndex = '999999';
    ov.style.display = 'flex';
    ov.style.flexDirection = 'column';
    ov.style.alignItems = 'center';
    ov.style.justifyContent = 'center';
    ov.style.color = '#fff';
    ov.style.fontFamily = "'Inter', sans-serif";
    ov.style.animation = 'fadeIn 0.4s ease';
    ov.innerHTML = [
      '<div style="background:rgba(20,10,35,0.65); border:1px solid rgba(168,85,247,0.3); padding:30px 40px; border-radius:16px; text-align:center; box-shadow:0 10px 40px rgba(0,0,0,0.5); max-width:90%; width:360px; backdrop-filter:blur(5px); webkit-backdrop-filter:blur(5px);">',
        '<svg viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2" style="width:44px; height:44px; margin-bottom:16px; animation:spin 1.2s linear infinite;">',
          '<path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l.73-.73" />',
        '</svg>',
        '<h3 style="margin:0 0 8px 0; font-size:16px; font-weight:700; letter-spacing:0.5px; color:#c084fc;">MEMPERBARUI ASET</h3>',
        '<p style="margin:0; font-size:12px; color:rgba(255,255,255,0.65); line-height:1.6; font-weight:500;">Menghapus cache lawas dan menyinkronkan aset dasbor versi terbaru...</p>',
      '</div>'
    ].join('');
    document.body.appendChild(ov);

    setTimeout(function() {
      window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
    }, 1800);
  } catch(e) {
    window.location.reload(true);
  }
};

// Procedural Web Audio API sound synthesizers (high-fidelity zero-asset audio)
var _audioCtx = null;
function getAudioContext() {
  if (!_audioCtx) {
    var AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (AudioCtxClass) {
      _audioCtx = new AudioCtxClass();
    }
  }
  if (_audioCtx && _audioCtx.state === 'suspended') {
    _audioCtx.resume();
  }
  return _audioCtx;
}

window.playChatChime = function() {
  try {
    var ctx = getAudioContext();
    if (!ctx) return;
    var now = ctx.currentTime;
    
    var osc1 = ctx.createOscillator();
    var osc2 = ctx.createOscillator();
    var gain1 = ctx.createGain();
    var gain2 = ctx.createGain();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.12); // G5
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.05); // E5
    osc2.frequency.exponentialRampToValueAtTime(1046.50, now + 0.2); // C6
    
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.06, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    
    gain2.gain.setValueAtTime(0, now + 0.05);
    gain2.gain.linearRampToValueAtTime(0.05, now + 0.07);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    osc1.start(now);
    osc1.stop(now + 0.2);
    osc2.start(now + 0.05);
    osc2.stop(now + 0.3);
  } catch(e) {
    console.warn('[Sound] Chat chime error:', e);
  }
};

window.playRadarPing = function() {
  try {
    var ctx = getAudioContext();
    if (!ctx) return;
    var now = ctx.currentTime;
    
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5 (Sonar frequency)
    osc.frequency.exponentialRampToValueAtTime(330, now + 1.2);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.03); // Quick rise
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2); // Smooth long echo decay
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 1.3);
  } catch(e) {
    console.warn('[Sound] Sonar ping error:', e);
  }
};

window.playPvpAlert = function() {
  try {
    var ctx = getAudioContext();
    if (!ctx) return;
    var now = ctx.currentTime;
    
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880, now + 0.1); // A5
    osc.frequency.setValueAtTime(587.33, now + 0.2);
    osc.frequency.setValueAtTime(880, now + 0.3);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.5);
  } catch(e) {
    console.warn('[Sound] PvP alert error:', e);
  }
};

window._checkRadarNotifications = function(newPlayers) {
  try {
    if (!Array.isArray(newPlayers)) return;
    if (!window._prevRadarNames) {
      window._prevRadarNames = {};
      window._prevRadarPvps = {};
      for (var i = 0; i < newPlayers.length; i++) {
        var p = newPlayers[i];
        if (p && p.name) {
          window._prevRadarNames[p.name.toLowerCase()] = true;
          window._prevRadarPvps[p.name.toLowerCase()] = !!p.pvp;
        }
      }
      return;
    }
    var playPing = false, playAlert = false, currentNames = {};
    for (var i = 0; i < newPlayers.length; i++) {
      var p = newPlayers[i];
      if (!p || !p.name) continue;
      var nameLower = p.name.toLowerCase();
      currentNames[nameLower] = true;
      if (!window._prevRadarNames[nameLower]) {
        playPing = true;
      }
      if (p.pvp && !window._prevRadarPvps[nameLower]) {
        playAlert = true;
      }
      window._prevRadarPvps[nameLower] = !!p.pvp;
    }
    window._prevRadarNames = currentNames;
    if (playAlert && typeof window.playPvpAlert === 'function') {
      window.playPvpAlert();
    } else if (playPing && typeof window.playRadarPing === 'function') {
      window.playRadarPing();
    }
  } catch(e) {
    console.warn('[RadarSound] Check fail:', e);
  }
};

function _checkAssetVersion(remoteVersion) {
  var localVersion = '62'; // Fallback default
  try {
    var scr = document.querySelector('script[src*="monitor-page.js"]');
    if (scr) {
      var match = scr.src.match(/[?&]v=([^&]+)/);
      if (match) localVersion = match[1];
    }
  } catch(e) {}
  
  if (remoteVersion && String(remoteVersion).trim() !== String(localVersion).trim()) {
    var btn = $('update-assets-btn');
    if (btn && !btn.querySelector('.update-notif-dot')) {
      btn.style.position = 'relative';
      btn.style.boxShadow = '0 0 15px rgba(168, 85, 247, 0.6), inset 0 0 8px rgba(168, 85, 247, 0.4)';
      btn.style.borderColor = '#c084fc';
      btn.style.animation = 'bellPulse 2.2s infinite ease-in-out';
      
      var dot = document.createElement('span');
      dot.className = 'update-notif-dot';
      dot.style.position = 'absolute';
      dot.style.top = '-4px';
      dot.style.right = '-4px';
      dot.style.width = '8px';
      dot.style.height = '8px';
      dot.style.borderRadius = '50%';
      dot.style.background = '#f43f5e'; // Vibrant red dot
      dot.style.boxShadow = '0 0 8px #f43f5e';
      dot.style.border = '1.5px solid #09090f';
      btn.appendChild(dot);
      
      btn.title = 'Versi baru (' + remoteVersion + ') tersedia! Klik untuk memperbarui aset.';
    }
  }
}

async function loadConfig(){
  // Check asset version from Supabase site_config
  try {
    var rVer = await fetch(SB_URL + '/rest/v1/site_config?key=eq.monitor_asset_version&select=value', {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    });
    var dVer = await rVer.json();
    if (dVer && dVer[0] && dVer[0].value) {
      _checkAssetVersion(dVer[0].value);
    }
  } catch(e) {}

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
  latHistory=[];mhData=[];radarPlayers=[];radarLands=[];radarZoneBorders=[];radarHistory=[];
  _tpsBuf=[];_hmGrid=null;_hmDirty=true;_hmMax=1;
  _uptimeLog=null;lastMetrics=null;
  _msBuf={tps:[],lat:[],players:[]};_animVals={};
  _srvStatCache=null;_srvStatCacheTs=0;_lastBDSHash='';_fetchFails=0;_headCache={};
  _cb={fails:0,until:0};_lastSBSync=0;
  _lastDP=null;radarLands=[];radarPlayers=[];radarZoneBorders=[];
  _expSet.clear();_afkTracker={}; // [FIX] reset map exploration & AFK tracker antar server
  _entBudgetLastHash='';_lagPredBuf=[];_lagPredDismissed=false;_hideLagPredict(); // reset anti-lag features
  _lagLogActive=null;_tpsCorrLastLen=0; // reset lag log + TPS correlation
  _hideErrBanner();
  // Reset UI to loading state
  _origSafeSet('s-label','MEMUAT...');safeClass('s-label','sl ld');
  safeClass('s-orb','orb ld');
  _origSafeSet('m-tps','—');_origSafeSet('m-latency','—');_origSafeSet('m-players','—');
  _origSafeSet('m-version','—');_origSafeSet('m-status','—');_origSafeSet('s-addr','—');
  var bds=$('bds-metrics');if(bds)bds.style.display='none';
  var pdc=$('player-details-card');if(pdc)pdc.style.display='none';
  var lcc=$('lag-contrib-card');if(lcc)lcc.style.display='none';
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
  if(m&&m.ts)_lastSBSync=new Date(m.ts).getTime()||0;
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
  // KPI top: prefer BDS (player_details) sebagai source of truth — sama dengan radar/status.
  // mcsrvstat hanya kontribusi nilai max (slot) di _lastMaxP. Kalau max belum tersedia, tampilkan angka saja.
  var pdLen=Array.isArray(m.player_details)?m.player_details.length:(m.players_online||0);
  safeSet('m-players',_lastMaxP>0?(pdLen+'/'+_lastMaxP):String(pdLen));
  // DP: cache last known values so reload doesn't show 0
  // Accept dp_pct >= 0 (including 0 from real data), only skip if truly undefined
  if(m.dp_pct!==undefined&&m.dp_pct!==null){
    _lastDP={pct:m.dp_pct,bytes:m.dp_bytes||0,max:m.dp_max||1048576,bd:m.dp_breakdown||(_lastDP?_lastDP.bd:null)};
    try{localStorage.setItem('lt_lastDP',JSON.stringify(_lastDP));}catch(e){}
  }
  var dpPct=m.dp_pct!==undefined&&m.dp_pct!==null?m.dp_pct:(_lastDP?_lastDP.pct:0);
  var dpFill=$('dp-bar-fill');
  if(dpFill){dpFill.style.width=dpPct+'%';dpFill.className='bar-fill '+(dpPct<50?'g':dpPct<80?'y':'r');}
  safeSet('dp-pct',dpPct+'% terpakai');
  var dpBytes=m.dp_bytes!==undefined?m.dp_bytes:(_lastDP?_lastDP.bytes:0);
  var dpMax=m.dp_max!==undefined?m.dp_max:(_lastDP?_lastDP.max:1048576);
  safeSet('dp-detail',fmtBytes(dpBytes)+' / '+fmtBytes(dpMax));
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
  // DP breakdown per fitur — use current data, fallback to last cached
  var dpbd=$('dp-breakdown'),dbb=m.dp_breakdown||(_lastDP?_lastDP.bd:null);
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
  if(m.world_day!==undefined)safeSet('world-day','Hari ke-'+m.world_day);
  // Moon phase — sinkron dengan vanilla MC (day % 8)
  if(m.world_day!==undefined){
    _moonDay=Math.floor(Number(m.world_day)||0);
    _moonPhase=_moonPhaseFromDay(_moonDay);
  }

  // [ATMOSPHERE] Update suasana card berdasarkan time of day + weather
  // Performa: cuma tambah/hapus className + set CSS var, zero animation overhead di JS.
  // CSS transitions handle smooth update (5s linear sinkron dengan micro-sync interval).
  try{
    var atmoCard=$('atmo-card');
    if(atmoCard){
      var phase=tod.toLowerCase(); // pagi/siang/sore/malam
      var weather=String(m.weather||'clear').toLowerCase();
      // Reset semua phase/weather class lalu set yang aktual
      atmoCard.classList.remove('phase-pagi','phase-siang','phase-sore','phase-malam','wx-clear','wx-rain','wx-thunder','has-fog');
      atmoCard.classList.add('phase-'+phase);
      atmoCard.classList.add('wx-'+weather);
      // Fog otomatis aktif saat hujan/petir atau saat malam (atmosfer mistis)
      if(weather==='rain'||weather==='thunder'||phase==='malam')atmoCard.classList.add('has-fog');

      // Canvas FX engine — realistic rain & thunder via atmo-canvas.js
      _atmoCanvasSync(atmoCard,weather);

      // Posisi matahari/bulan akurat berdasarkan world_time (0-23999 Minecraft tick).
      // Konvensi MC: tick 0 = 06:00 dawn, 6000 = 12:00 noon, 12000 = 18:00 dusk, 18000 = 00:00 midnight.
      // Setiap full-sync (~30s), simpan baseline tick + ts. rAF loop ekstrapolasi tick lokal
      // (1 second real = 20 tick MC) agar matahari tetap bergerak smooth tanpa jeda.
      _atmoSyncCelestial(atmoCard,wt,m.ts);

      // Badge text — kombinasi phase + weather + moon phase (saat malam clear)
      var badge=$('atmo-badge');
      if(badge){
        var wxLbl=weather==='thunder'?' · BADAI':weather==='rain'?' · HUJAN':'';
        var moonLbl='';
        if(phase==='malam'&&weather==='clear'){
          moonLbl=' · '+_MOON_NAMES_ID[_moonPhase].toUpperCase();
        }
        badge.textContent=tod.toUpperCase()+wxLbl+moonLbl;
      }
      var weatherEl=$('world-weather');
      if(weatherEl){
        var wxText=weather==='thunder'?'Petir':weather==='rain'?'Hujan':'Cerah';
        weatherEl.textContent=wxText;
      }

      // Forecast: track durasi cuaca + estimasi perubahan berikutnya
      // Prefer modul advanced (AtmoForecast) yang fetch Supabase weather_history,
      // conditional ToD, Monte Carlo distribution. Fallback ke legacy lokal kalau modul belum loaded.
      window.lastMetrics=m;
      if(window.AtmoForecast&&typeof window.AtmoForecast.update==='function'){
        window.AtmoForecast.update(weather,m.ts,wt);
      }else{
        _atmoUpdateForecast(weather,m.ts);
      }
    }
  }catch(e){}
  safeSet('world-tick',fmtN(m.tick||0));
  safeSet('world-tps',tps.toFixed(1)+' / 20');
  radarPlayers=m.player_details||[];
  if(typeof window._checkRadarNotifications==='function') window._checkRadarNotifications(radarPlayers);
  _updateAfkTracker();
  // Preserve existing radarLands if this sync doesn't include land_claims
  if(m.land_claims&&m.land_claims.length)radarLands=m.land_claims;
  radarZoneBorders=m.zone_borders||[];
  if(radarPlayers.length||radarLands.length||radarZoneBorders.length){
    drawRadar();
    var pdc=$('player-details-card');if(pdc)pdc.style.display='block';
  }
  safeSet('metrics-time',m.ts?timeAgo(new Date(m.ts).toISOString()):'\u2014');
  var bds=$('bds-metrics');if(bds)bds.style.display='block';
  _renderLagContrib(m);
  updateDiag(m);
  _updateHealth(m);_pushTPS(m.tps||0);_checkAlerts({tps:m.tps,dpPct:m.dp_pct||(_lastDP?_lastDP.pct:0)});_hmDirty=true;
  _renderEntBudget(m);_updateLagPrediction(m);_trackLagEvent(m);
}

/* ═══ LAG CONTRIBUTORS — Client-side analysis from server metrics ═══ */
var _LC_WEIGHTS={
  zombie:1.5,zombie_villager:2,drowned:1.5,husk:1.5,
  skeleton:1.8,stray:1.8,creeper:1.5,spider:1.3,cave_spider:1.3,
  enderman:2,witch:2,slime:1,magma_cube:1,blaze:2,ghast:2.5,
  wither_skeleton:1.8,piglin:1.5,piglin_brute:1.5,hoglin:1.5,
  pillager:2,vindicator:1.8,evoker:2.5,ravager:2,phantom:2,warden:3,
  villager_v2:3,iron_golem:1.5,item:0.3,xp_orb:0.2,arrow:0.1
};
var _LC_CATS={
  mob:{icon:'M',color:'#f87171',bg:'rgba(248,113,113,.06)',bd:'rgba(248,113,113,.12)',label:'Mob'},
  item:{icon:'I',color:'#fbbf24',bg:'rgba(251,191,36,.06)',bd:'rgba(251,191,36,.12)',label:'Item'},
  chunk:{icon:'C',color:'#fb923c',bg:'rgba(251,146,60,.06)',bd:'rgba(251,146,60,.12)',label:'Hotspot'},
  player:{icon:'P',color:'#22d3ee',bg:'rgba(34,211,238,.06)',bd:'rgba(34,211,238,.12)',label:'Player'}
};

function _renderLagContrib(m){
  var card=$('lag-contrib-card');if(!card)return;
  var tps=m.tps||0,totalEnt=m.entities?m.entities.total:0;
  var hostile=m.mobs?m.mobs.total:0,items=m.items?m.items.total:0;
  var bd=m.entity_breakdown||[],hs=m.entity_hotspots||[],pd=m.player_details||[];
  // Only re-render when entity_breakdown exists (full sync data)
  // During micro-sync bd=[] and hs=[] — preserve last rendered state
  if(!bd.length&&!hs.length)return;
  card.style.display='block';
  var maxEnt=Math.max(1,totalEnt);
  // Build contributors
  var contrib=[];
  var rft = $('rf-hm-type');
  var curFilterVal = rft ? rft.value : '';
  
  // Source 1: Entity breakdown (from full sync)
  var _hmTypesHTML = '<div class="cs-opt ' + (curFilterVal===''?'active':'') + '" data-val="">-- Semua Tipe --</div>';
  for(var i=0;i<bd.length;i++){
    var e=bd[i],cnt=e.count||0;
    if(cnt>0) {
      var activeCls = (curFilterVal === e.id) ? 'active' : '';
      _hmTypesHTML += '<div class="cs-opt '+activeCls+'" data-val="'+e.id+'">' + e.id.replace(/_/g,' ') + '<span class="cs-opt-count">'+cnt+'</span></div>';
    }
    if(cnt<3)continue;
    var w=_LC_WEIGHTS[e.id]||1.0;
    var isItem=e.id==='item'||e.id==='xp_orb';
    contrib.push({score:Math.round(cnt*w),cat:isItem?'item':'mob',name:e.id,count:cnt,
      pct:Math.round(cnt/maxEnt*100),weight:w});
  }
  
  var csList = $('hm-type-list');
  if(csList) {
    csList.innerHTML = _hmTypesHTML;
  }
  
  // Source 2: Chunk hotspots
  for(var i=0;i<Math.min(hs.length,8);i++){
    var h=hs[i];if(!h||h.c<8)continue;
    var dimL=h.d==='n'?'Nether':h.d==='e'?'End':'OW';
    contrib.push({score:Math.round(h.c*1.5),cat:'chunk',name:h.x+', '+h.z+' ('+dimL+')',
      count:h.c,pct:Math.round(h.c/maxEnt*100),weight:1.5});
  }
  // Source 3: Player proximity
  for(var i=0;i<pd.length;i++){
    var p=pd[i];if(!p||p.x===undefined)continue;
    // Estimate nearby entities from hotspot data
    var nearCount=0;
    for(var j=0;j<hs.length;j++){
      var hh=hs[j],dx=Math.abs((hh.x||0)-p.x),dz=Math.abs((hh.z||0)-p.z);
      var pDim=p.dim==='nether'?'n':p.dim==='the_end'?'e':'o',hDim=hh.d||'o';
      if(pDim===hDim&&dx<48&&dz<48)nearCount+=hh.c;
    }
    if(nearCount<5)continue;
    var dimS=(p.dim||'overworld').replace('_',' ');
    contrib.push({score:Math.round(nearCount*1.2),cat:'player',name:p.name+' ('+dimS+')',
      count:nearCount,pct:Math.round(nearCount/maxEnt*100),weight:1.2});
  }
  contrib.sort(function(a,b){return b.score-a.score;});
  // Health label for pill
  var hi=Math.min(100,Math.round(Math.max(0,20-tps)*5+Math.min(30,hostile/5)+Math.min(20,items/10)+Math.min(10,Math.max(0,totalEnt-200)/30)));
  var displayScore=100-hi;
  var hLabel=displayScore>=60?'SEHAT':displayScore>=30?'WASPADA':'KRITIS';
  var pill=$('lag-health-pill');
  if(pill){pill.textContent=hLabel;pill.className='pill '+(displayScore>=60?'g':displayScore>=30?'y':'r');}
  // Render contributor list
  var listEl=$('lag-contrib-list');
  if(listEl){
    var topN=contrib.slice(0,12),maxSc=topN.length?topN[0].score:1;
    var html='';
    for(var i=0;i<topN.length;i++){
      var c=topN[i],cat=_LC_CATS[c.cat]||_LC_CATS.mob;
      var relPct=Math.round(c.score/maxSc*100);
      var barCol=relPct>=70?'var(--red)':relPct>=40?'var(--gold)':'var(--green)';
      html+='<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;margin-bottom:3px;background:'+cat.bg+';border:1px solid '+cat.bd+';border-radius:var(--r-xs);transition:border-color .2s">';
      // Rank
      html+='<span style="font-family:\'JetBrains Mono\',monospace;font-size:.52rem;font-weight:700;color:var(--mute);width:18px;text-align:center;flex-shrink:0">'+(i+1)+'</span>';
      // Category badge
      html+='<span style="font-family:\'JetBrains Mono\',monospace;font-size:.5rem;font-weight:800;color:'+cat.color+';width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;background:'+cat.bg+';border:1px solid '+cat.bd+';border-radius:4px;flex-shrink:0">'+cat.icon+'</span>';
      // Info
      html+='<div style="flex:1;min-width:0">';
      html+='<div style="display:flex;justify-content:space-between;align-items:baseline">';
      html+='<span style="font-family:\'JetBrains Mono\',monospace;font-size:.55rem;font-weight:700;color:var(--text);letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(c.name)+'</span>';
      html+='<span style="font-family:\'JetBrains Mono\',monospace;font-size:.48rem;font-weight:700;color:'+cat.color+';flex-shrink:0;margin-left:8px">'+c.count+' <span style="color:var(--mute);font-weight:500">('+c.pct+'%)</span></span>';
      html+='</div>';
      // Bar
      html+='<div style="display:flex;align-items:center;gap:6px;margin-top:3px">';
      html+='<div style="flex:1;height:3px;background:var(--bg3);border-radius:2px;overflow:hidden"><div style="width:'+relPct+'%;height:100%;background:'+barCol+';border-radius:2px;transition:width .6s"></div></div>';
      html+='<span style="font-family:\'JetBrains Mono\',monospace;font-size:.4rem;color:var(--mute);flex-shrink:0;width:28px;text-align:right">×'+c.weight+'</span>';
      html+='</div></div></div>';
    }
    if(!topN.length)html='<div style="text-align:center;color:var(--mute);font-size:.6rem;padding:.75rem">Tidak ada kontributor lag signifikan</div>';
    listEl.innerHTML=html;
  }
  // Category summary
  var catEl=$('lag-cat-summary');
  if(catEl){
    var cats=['mob','item','chunk','player'];
    var catHtml='';
    for(var ci=0;ci<cats.length;ci++){
      var ck=cats[ci],cat=_LC_CATS[ck];
      var items2=contrib.filter(function(c){return c.cat===ck;});
      var totalC=items2.reduce(function(s,c){return s+c.count;},0);
      catHtml+='<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xs)">';
      catHtml+='<div style="width:24px;height:24px;border-radius:5px;display:flex;align-items:center;justify-content:center;background:'+cat.bg+';border:1px solid '+cat.bd+';flex-shrink:0;font-family:\'JetBrains Mono\',monospace;font-size:.6rem;font-weight:800;color:'+cat.color+'">'+cat.icon+'</div>';
      catHtml+='<div style="flex:1;min-width:0">';
      catHtml+='<div style="font-family:\'JetBrains Mono\',monospace;font-size:.48rem;font-weight:700;color:var(--text);letter-spacing:.3px">'+cat.label+'</div>';
      catHtml+='<div style="font-family:\'JetBrains Mono\',monospace;font-size:.4rem;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+items2.length+' tipe · '+fmtN(totalC)+' total</div>';
      catHtml+='</div></div>';
    }
    catEl.innerHTML=catHtml;
  }
}
function updateDiag(m){
  var diags=[],tps=m.tps||0,totalMob=m.mobs?m.mobs.total:0,totalItem=m.items?m.items.total:0,dpPct=m.dp_pct!==undefined?m.dp_pct:(_lastDP?_lastDP.pct:0);
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
  // §7.2 Circuit breaker: skip mcsrvstat saat di-pause, lompat langsung ke BDS+fallback
  if(Date.now()<_cb.until){
    _fetchLock=false;
    try{await fetchBDSData();}catch(e){console.warn('[BDS]',e);}
    var sbAge=Date.now()-_lastSBSync;
    if(_lastSBSync&&sbAge<_CACHE_FRESH_MS){
      safeClass('s-orb','orb on');safeSet('s-label','ONLINE');safeClass('s-label','sl on');
      safeSet('s-addr',serverIP+' (cached)');
      safeSet('m-status','Cached');safeClass('m-status','m-val warn');
      var li=$('lat-indicator');
      if(li){li.textContent='Mode Cached (CB aktif)';li.className='lat-ind warn';}
      _hideErrBanner();
    }
    if(btn){btn.disabled=false;btn.textContent='\u27f3 REFRESH';}
    return;
  }
  // Set loading state
  safeClass('s-orb','orb ld');
  safeSet('s-label','MEMUAT...');safeClass('s-label','sl ld');
  var host=serverIP.split(':')[0]||'laughtale.my.id';
  var port=serverIP.split(':')[1]||'19214';
  var t0=Date.now();
  var fetchOK=false;
  // §7.4 Kick off BDS fetch in parallel — supaya saat mcsrvstat fail,
  // _lastSBSync sudah terisi dan fallback "CACHED" bisa kerja di hard-refresh pertama.
  // Tanpa ini, retry mcsrvstat selesai sebelum BDS sempat populate → banner OFFLINE palsu.
  var _bdsPromise=(_retryN===0)?fetchBDSData().catch(function(e){console.warn('[BDS parallel]',e);}):null;
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
    var _sbCached=false;
    // §7.5 mcsrvstat Bedrock query sering false-negative (socket timeout).
    // Jika mcsrvstat bilang offline, tunggu BDS data Supabase — kalau fresh, server sebenarnya hidup.
    if(!online){
      if(_bdsPromise){try{await _bdsPromise;}catch(e){}}
      var _sbAge2=_lastSBSync?(Date.now()-_lastSBSync):Infinity;
      if(_sbAge2<_CACHE_FRESH_MS){online=true;_sbCached=true;}
    }
    var players=d.players?d.players.online||0:0;
    var maxP=d.players?d.players.max||0:0;
    var version=d.version||'\u2014';
    if(maxP>0)_lastMaxP=maxP; // simpan untuk dipakai KPI saat data BDS yang dipakai
    // Populate data
    safeSet('s-addr',host+':'+port);
    safeSet('m-latency',latency);safeClass('m-latency','m-val '+(latency<200?'good':latency<500?'warn':'bad'));
    // KPI players: prefer BDS data (radarPlayers / lastMetrics) — selalu sama dengan radar & status.html.
    // mcsrvstat sering inkonsisten (bedrock query unreliable); BDS = ground truth.
    var bdsCount=(Array.isArray(radarPlayers)?radarPlayers.length:0)
      ||(lastMetrics&&typeof lastMetrics.players_online==='number'?lastMetrics.players_online:0);
    var sbAgeMs=_lastSBSync?(Date.now()-_lastSBSync):Infinity;
    var displayPlayers=(sbAgeMs<_CACHE_FRESH_MS)?bdsCount:players;
    var displayMax=_lastMaxP||maxP||0;
    safeSet('m-players',displayMax>0?(displayPlayers+'/'+displayMax):String(displayPlayers));
    safeSet('m-version',version);
    safeSet('m-status',_sbCached?'Cached':(online?'Online':'Offline'));safeClass('m-status','m-val '+(_sbCached?'warn':(online?'good':'bad')));
    // Latency quality
    var li=$('lat-indicator');
    if(li){
      if(latency<150){li.textContent='Sangat Baik';li.className='lat-ind good';}
      else if(latency<300){li.textContent='Normal';li.className='lat-ind ok';}
      else if(latency<600){li.textContent='Lambat';li.className='lat-ind warn';}
      else{li.textContent='Sangat Lambat';li.className='lat-ind bad';}
    }
    // Load bar — pakai displayPlayers agar konsisten dengan KPI atas
    var loadPct=displayMax?Math.round(displayPlayers/displayMax*100):0;
    var lbf=$('load-bar-fill');
    if(lbf){lbf.style.width=loadPct+'%';lbf.className='bar-fill '+(loadPct<50?'g':loadPct<80?'y':'r');}
    safeSet('load-pct',loadPct+'%');
    // Update status orb LAST (after all data is set)
    safeClass('s-orb','orb '+(online?'on':'off'));
    safeSet('s-label',online?'ONLINE':'OFFLINE');
    safeClass('s-label','sl '+(online?'on':'off'));
    fetchOK=true;
    // C: Success — reset failure counter & circuit breaker, hide error banner
    _fetchFails=0;_cb.fails=0;_cb.until=0;_hideErrBanner();
    // Basic diagnostics from public API data (always available)
    updateBasicDiag(online,latency,displayPlayers,displayMax);
    _trackUptime(online);_checkAlerts({online:online,latency:latency});
    // Chart (in its own try-catch so chart bugs don't affect status)
    try{
      var now=new Date();
      latHistory.push({time:now,latency:latency,players:displayPlayers,online:online});
      if(latHistory.length>MAX_HIST)latHistory.shift();
      drawChart();
    }catch(chartErr){console.warn('[Chart]',chartErr);}
    safeSet('last-update','Terakhir: '+new Date().toLocaleTimeString('id-ID')+' WIB');
  }catch(e){
    console.warn('[fetchStatus] transport fail:',e.message||e.name);
    _fetchFails++;_cb.fails++;
    // §7.2 Circuit breaker: trip after 3 consecutive fail
    if(_cb.fails>=_CB_TRIP)_cb.until=Date.now()+_CB_PAUSE;
    if(!fetchOK){
      // §7.4 Graceful degradation: retry with jittered backoff before falling back
      if(_retryN<_maxRetries){
        _fetchLock=false;
        var jitter=0.75+Math.random()*0.5; // ±25% jitter
        setTimeout(function(){fetchStatus(_retryN+1);},_retryDelay*Math.pow(2,_retryN)*jitter);
        return;
      }
      // §7.4 Fallback: pakai Supabase data kalau masih fresh (< 2 min)
      // Tunggu BDS parallel fetch yang dimulai di awal selesai dulu — kalau belum,
      // _lastSBSync masih 0 dan fallback gagal di hard-refresh pertama.
      if(_bdsPromise){try{await _bdsPromise;}catch(e){}}
      var sbAge=Date.now()-_lastSBSync;
      if(_lastSBSync&&sbAge<_CACHE_FRESH_MS){
        var p=lastMetrics&&lastMetrics.players_online||0;
        var pdLenF=(lastMetrics&&Array.isArray(lastMetrics.player_details)?lastMetrics.player_details.length:p);
        safeClass('s-orb','orb on');
        safeSet('s-label','ONLINE');safeClass('s-label','sl on');
        safeSet('s-addr',serverIP+' (cached)');
        safeSet('m-status','Cached');safeClass('m-status','m-val warn');
        // Status pemain dari snapshot terakhir, latency tidak tersedia
        safeSet('m-latency','—');
        safeSet('m-players',_lastMaxP>0?(pdLenF+'/'+_lastMaxP):String(pdLenF));
        var li=$('lat-indicator');
        if(li){li.textContent='Mode Cached ('+Math.round(sbAge/1000)+'s lalu)';li.className='lat-ind warn';}
        _trackUptime(true);
        return; // jangan trigger banner — bukan outage
      }
      // Truly offline — both transports stale
      safeClass('s-orb','orb off');
      safeSet('s-label','OFFLINE');safeClass('s-label','sl off');
      safeSet('s-addr','Tidak dapat terhubung');
      _showErrBanner('Gagal terhubung ke server. Cek koneksi internet Anda.',e.name==='AbortError'?'Timeout':'Error');
    }
  }finally{
    _fetchLock=false;
    if(btn){btn.disabled=false;btn.textContent='\u27f3 REFRESH';}
  }
  // BDS data: kalau parallel fetch belum jalan (saat retry), fetch sekarang.
  // Kalau sudah jalan paralel, tunggu selesainya saja.
  if(_bdsPromise){try{await _bdsPromise;}catch(e){console.warn('[BDS]',e);}}
  else{try{await fetchBDSData();}catch(e){console.warn('[BDS]',e);}}
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
    _fastPollTimer=setInterval(_fastPollPositions,8000); // [PERF] 8s (was 5s) — balances radar freshness vs network/CPU
  });
});
// Fast-poll: lightweight 5s fetch for player radar positions only
var _fastPollTimer=0,_fastPollLock=false;
async function _fastPollPositions(){
  if(_fastPollLock||document.hidden)return;
  _fastPollLock=true;
  try{
    var sid=(_servers[_currentIdx]&&_servers[_currentIdx].sync_id)||'current';
    var r=await fetch(SB_URL+'/rest/v1/leaderboard_sync?id=eq.'+sid+'&select=server_metrics',{headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}});
    var d=await r.json();if(!d||!d[0]||!d[0].server_metrics)return;
    var m=typeof d[0].server_metrics==='string'?JSON.parse(d[0].server_metrics):d[0].server_metrics;
    if(!m||!m.player_details)return;
    radarPlayers=m.player_details;
    if(typeof window._checkRadarNotifications==='function') window._checkRadarNotifications(radarPlayers);
    _updateAfkTracker();
    // KPI top: sinkron dengan radar — pakai player_details sebagai sumber utama
    try{
      var _pdLen=m.player_details.length;
      safeSet('m-players',_lastMaxP>0?(_pdLen+'/'+_lastMaxP):String(_pdLen));
      // Diagnostic + uptime tracker juga ikut: kalau ada player live, anggap server "online"
      if(_pdLen>0){
        try{updateBasicDiag(true,0,_pdLen,_lastMaxP);}catch(e){}
        try{_trackUptime(true);}catch(e){}
      }
    }catch(e){}
    // Preserve land claims from micro-sync if present
    if(m.land_claims&&m.land_claims.length)radarLands=m.land_claims;
    // Preserve entity hotspots from micro-sync for heatmap
    if(m.entity_hotspots&&m.entity_hotspots.length){
      if(!lastMetrics)lastMetrics={};
      lastMetrics.entity_hotspots=m.entity_hotspots;
      _hmDirty=true;
    }
    // Preserve DP data from micro-sync
    if(m.dp_pct!==undefined&&m.dp_pct!==null){
      _lastDP={pct:m.dp_pct,bytes:m.dp_bytes||0,max:m.dp_max||1048576,bd:m.dp_breakdown||(_lastDP?_lastDP.bd:null)};
      try{localStorage.setItem('lt_lastDP',JSON.stringify(_lastDP));}catch(e){}
      // Update DP display
      var dpFill=$('dp-bar-fill');
      if(dpFill){dpFill.style.width=m.dp_pct+'%';dpFill.className='bar-fill '+(m.dp_pct<50?'g':m.dp_pct<80?'y':'r');}
      safeSet('dp-pct',m.dp_pct+'% terpakai');
      safeSet('dp-detail',fmtBytes(m.dp_bytes||0)+' / '+fmtBytes(m.dp_max||1048576));
      var gauge=$('dp-gauge');
      if(gauge){var arc=97.4,off=arc-(m.dp_pct/100*arc);gauge.setAttribute('stroke-dashoffset',off.toFixed(1));gauge.setAttribute('stroke',m.dp_pct<50?'var(--green)':m.dp_pct<80?'var(--gold)':'var(--red)');}
      (_origSafeSet||safeSet)('dp-pct-num',m.dp_pct+'%');
      var pill=$('dp-pill');
      if(pill){pill.textContent=m.dp_pct<50?'AMAN':m.dp_pct<80?'SEDANG':'PENUH';pill.className='pill '+(m.dp_pct<50?'g':m.dp_pct<80?'y':'r');}
    }
    // Update TPS display (lightweight, no full re-render)
    if(m.tps!==undefined){
      var tps=m.tps||0;
      safeSet('m-tps',tps.toFixed(1));
      safeClass('m-tps','m-val '+(tps>=18?'good':tps>=15?'warn':'bad'));
    }
    drawRadar();
  }catch(e){}
  finally{_fastPollLock=false;}
}
window.addEventListener('resize',function(){
  if(latHistory.length>1)requestAnimationFrame(drawChart);
  drawMHChart();
  drawRadar();
});
document.addEventListener('visibilitychange',function(){
  if(document.hidden){if(refreshTimer)clearInterval(refreshTimer);if(_fastPollTimer)clearInterval(_fastPollTimer);}
  else{fetchStatus();refreshTimer=setInterval(fetchStatus,30000);_fastPollTimer=setInterval(_fastPollPositions,8000);}
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
    _drawTpsCorrelation();
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

var radarPlayers=[],radarLands=[],radarZoneBorders=[],radarDim='overworld',radarZoom=500;
var radarPanX=0,radarPanZ=0,radarDrag=false,radarDragStart={x:0,z:0,px:0,pz:0};
var radarHistory=[],radarTimeIdx=-1,radarRaf=0,radarAnimId=0,rSel=null,rFollow=true;
// [FILTER] Radar filters — toggle UI di HTML, state direstore dari localStorage.
var _rfState={afk:false,pvp:false,expiring:false,owner:'',cluster:true,hidePlayer:false,hmHostile:true,hmPassive:true,hmItem:true,hmOther:true,hmType:''};
var _afkTracker={}; // {name: {x,z,since}} untuk deteksi AFK >5 menit
var _AFK_MS=300000,_AFK_MOVE_SQ=4; // 5 min, 2 blok delta = bergerak
try{var _rfSaved=localStorage.getItem('lt_radar_filters');if(_rfSaved){var _rfp=JSON.parse(_rfSaved);for(var k in _rfp)if(k in _rfState)_rfState[k]=_rfp[k];}}catch(e){}
var DIM_COLORS={overworld:'#34d399',nether:'#fb923c',the_end:'#a855f7'};
var DIM_SHORT={o:'overworld',n:'nether',t:'the_end'};
var LAND_COLORS=['#34d399','#60a5fa','#f472b6','#a78bfa','#fbbf24','#fb923c','#38bdf8','#4ade80'];
var TC=['#34d399','#60a5fa','#f472b6','#a78bfa','#fbbf24','#fb923c','#38bdf8','#4ade80','#f87171','#22d3ee'];

function nameHash(n){var h=0;for(var i=0;i<n.length;i++)h=((h<<5)-h)+n.charCodeAt(i)|0;return Math.abs(h);}
var SK=['#c68642','#8d5524','#e0ac69','#f1c27d','#ffdbac','#d2a679','#a0785a','#7b5b3a'];
var HK=['#3b2217','#1a1110','#4a2912','#6b3a24','#d4a76a','#c23616','#2d3436','#636e72'];
var HFS = [
  [[1,1,1,1,1,1,1,1],[1,1,2,2,2,2,1,1],[2,2,2,2,2,2,2,2],[2,3,0,2,2,0,3,2],[2,2,2,4,4,2,2,2],[2,2,2,2,2,2,2,2],[2,2,5,5,5,5,2,2],[2,2,2,2,2,2,2,2]], // 0: Standard
  [[1,1,1,1,1,1,1,1],[1,1,1,1,1,2,1,1],[1,1,1,2,2,2,2,1],[1,1,2,2,2,0,3,2],[2,2,2,4,4,2,2,2],[2,2,2,2,2,2,2,2],[2,2,2,5,5,2,2,2],[2,2,2,2,2,2,2,2]], // 1: Emo/Fringe
  [[1,1,1,1,1,1,1,1],[2,2,2,2,2,2,2,2],[0,0,0,2,2,0,0,0],[0,3,0,0,0,0,3,0],[0,0,0,4,4,0,0,0],[2,2,2,2,2,2,2,2],[2,2,5,5,5,5,2,2],[2,2,2,2,2,2,2,2]], // 2: Glasses
  [[1,1,1,1,1,1,1,1],[1,2,2,2,2,2,2,1],[2,2,2,2,2,2,2,2],[2,0,2,2,2,2,0,2],[2,2,2,4,4,2,2,2],[1,1,2,2,2,2,1,1],[1,1,1,5,5,1,1,1],[1,1,1,1,1,1,1,1]], // 3: Beard
  [[1,1,1,1,1,1,1,1],[2,2,2,2,2,2,2,2],[2,3,0,2,2,0,3,2],[2,3,0,2,2,0,3,2],[2,2,2,4,4,2,2,2],[2,2,5,5,5,5,2,2],[2,2,2,2,2,2,2,2],[2,2,2,2,2,2,2,2]], // 4: Wide Eyes
  [[2,2,2,1,1,2,2,2],[2,2,2,1,1,2,2,2],[2,2,2,1,1,2,2,2],[2,3,0,2,2,0,3,2],[2,2,2,4,4,2,2,2],[2,2,2,2,2,2,2,2],[2,2,5,5,5,5,2,2],[2,2,2,2,2,2,2,2]], // 5: Mohawk
  [[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,2,2,2,2,2,2,1],[1,3,0,2,2,0,3,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1]], // 6: Ninja Mask
  [[1,1,1,1,1,1,1,1],[1,1,2,2,2,2,1,1],[2,2,2,2,2,2,2,2],[2,2,3,0,0,3,2,2],[2,2,3,0,0,3,2,2],[2,2,2,4,4,2,2,2],[2,2,2,5,5,2,2,2],[2,2,2,2,2,2,2,2]], // 7: Cyclops
  [[1,1,1,1,1,1,1,1],[1,1,2,2,2,2,1,1],[2,0,0,0,0,0,0,2],[0,0,3,0,0,3,0,0],[2,0,0,2,2,0,0,2],[2,2,2,4,4,2,2,2],[2,2,5,5,5,5,2,2],[2,2,2,2,2,2,2,2]], // 8: Sunglasses
  [[1,1,1,1,1,1,1,1],[1,1,2,2,2,2,1,1],[2,2,2,2,2,2,2,2],[2,3,0,2,2,0,3,2],[2,2,2,4,4,2,2,2],[2,1,1,1,1,1,1,2],[2,2,5,5,5,5,2,2],[2,2,2,2,2,2,2,2]], // 9: Mustache
  [[1,1,1,1,1,1,1,1],[0,0,0,0,0,0,0,0],[2,2,2,2,2,2,2,2],[2,3,0,2,2,0,3,2],[2,2,2,4,4,2,2,2],[2,2,2,2,2,2,2,2],[2,2,5,5,5,5,2,2],[2,2,2,2,2,2,2,2]], // 10: Headband
  [[1,1,1,1,1,1,1,1],[1,1,2,2,2,2,1,1],[2,2,2,2,2,2,2,2],[2,0,3,2,2,3,0,2],[2,2,2,4,4,2,2,2],[2,2,2,5,5,2,2,2],[2,2,2,5,5,2,2,2],[2,2,2,2,2,2,2,2]], // 11: Shocked
  [[1,1,1,1,1,1,1,1],[1,1,2,2,2,2,1,1],[2,2,2,2,2,2,2,2],[2,3,0,2,2,0,3,2],[2,2,2,4,4,2,2,2],[2,2,2,2,2,2,2,2],[2,2,2,5,5,2,2,2],[2,2,5,2,2,5,2,2]], // 12: Frown
  [[2,2,2,2,2,2,2,2],[2,2,2,2,2,2,2,2],[2,2,2,2,2,2,2,2],[2,3,0,2,2,0,3,2],[2,2,2,4,4,2,2,2],[2,2,2,2,2,2,2,2],[2,2,5,5,5,5,2,2],[2,2,2,2,2,2,2,2]], // 13: Bald
  [[2,2,2,2,2,2,2,2],[1,2,2,2,2,2,2,1],[1,2,2,2,2,2,2,1],[1,3,0,2,2,0,3,1],[2,2,2,4,4,2,2,2],[2,2,2,2,2,2,2,2],[2,2,5,5,5,5,2,2],[2,2,2,2,2,2,2,2]], // 14: Old/Half-Bald
  [[1,1,1,1,1,1,1,1],[1,1,2,2,2,2,1,1],[0,2,2,2,2,2,2,0],[0,0,0,2,2,0,3,2],[0,2,2,4,4,2,2,2],[2,2,2,2,2,2,2,2],[2,2,5,5,5,5,2,2],[2,2,2,2,2,2,2,2]], // 15: Eye Patch
  [[1,1,1,1,1,1,1,1],[1,1,2,2,2,2,1,1],[2,2,2,2,2,2,2,2],[2,3,3,2,2,3,3,2],[2,2,2,4,4,2,2,2],[2,2,2,2,2,2,2,2],[2,2,5,5,5,5,2,2],[2,2,2,2,2,2,2,2]], // 16: Zombie
  [[1,1,1,1,1,1,1,1],[1,1,2,2,2,2,1,1],[2,1,1,2,2,1,1,2],[2,3,0,1,1,0,3,2],[2,2,2,4,4,2,2,2],[2,2,2,2,2,2,2,2],[2,2,5,5,5,5,2,2],[2,2,2,2,2,2,2,2]], // 17: Angry
  [[1,1,1,1,1,1,1,1],[1,1,2,2,2,2,1,1],[2,2,2,2,2,2,2,2],[2,0,3,2,2,3,0,2],[2,2,2,4,4,2,2,2],[2,2,2,4,4,2,2,2],[2,2,2,4,4,2,2,2],[2,2,2,2,2,2,2,2]], // 18: Villager/Big Nose
  [[1,1,1,1,1,1,1,1],[1,1,2,2,2,2,1,1],[2,2,2,2,2,2,2,2],[2,0,3,2,2,0,3,2],[2,2,2,4,4,2,2,2],[2,2,2,2,2,2,2,2],[2,2,5,5,5,5,2,2],[2,2,2,2,2,2,2,2]], // 19: Derp
  [[1,1,1,1,1,1,1,1],[1,1,2,2,2,2,1,1],[2,2,2,2,2,2,2,2],[2,3,0,2,2,0,3,2],[2,2,2,4,4,2,2,2],[2,5,2,2,2,2,5,2],[2,2,5,5,5,5,2,2],[2,2,2,2,2,2,2,2]], // 20: Smiley
  [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,3,3,0,0,3,3,0],[0,0,0,0,0,0,0,0],[2,2,2,4,4,2,2,2],[2,2,2,2,2,2,2,2],[2,2,5,5,5,5,2,2],[2,2,2,2,2,2,2,2]], // 21: Batman Cowl
  [[1,1,1,1,1,1,1,1],[1,1,2,2,2,2,1,1],[2,2,2,2,2,2,2,2],[2,3,0,2,2,0,3,2],[2,2,2,4,4,2,2,2],[2,2,2,2,2,2,2,2],[2,2,5,5,5,5,2,2],[2,2,2,3,3,2,2,2]], // 22: Buckteeth
  [[1,1,1,1,1,1,1,1],[1,1,2,2,2,2,1,1],[2,1,1,1,1,1,1,2],[2,3,0,2,2,0,3,2],[2,2,2,4,4,2,2,2],[2,2,2,2,2,2,2,2],[2,2,5,5,5,5,2,2],[2,2,2,2,2,2,2,2]], // 23: Unibrow
  [[1,1,1,1,1,1,1,1],[1,2,2,2,2,2,2,1],[2,3,0,2,2,0,3,2],[2,2,2,4,4,2,2,2],[1,1,1,1,1,1,1,1],[1,1,1,5,5,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1]]  // 24: Thick Beard
];
/* A: Pre-cached player head bitmaps — avoids 64 fillRect calls per player per frame */
var _headCache={};
function _getHeadBitmap(name,pvp,dc,sz,isVIP){
  sz=sz||18;
  var key=name+'|'+(pvp?1:0)+'|'+(name===rSel?'s':'')+'|'+sz+'|'+(isVIP?1:0);
  if(_headCache[key])return _headCache[key];
  var keys=Object.keys(_headCache);
  if(keys.length>50){for(var i=0;i<20;i++)delete _headCache[keys[i]];}
  var oc=document.createElement('canvas');
  var pad=12;
  oc.width=sz+pad*2;oc.height=sz+pad*2;
  var octx=oc.getContext('2d');
  var ps=sz/8,hx=pad,hy=pad;
  var h=nameHash(name||'?'),skin=SK[h%SK.length],hair=HK[(h>>4)%HK.length];
  var r=Math.max(0,parseInt(skin.slice(1,3),16)-20),g=Math.max(0,parseInt(skin.slice(3,5),16)-15),b=Math.max(0,parseInt(skin.slice(5,7),16)-10);
  var nose='#'+r.toString(16).padStart(2,'0')+g.toString(16).padStart(2,'0')+b.toString(16).padStart(2,'0');
  var cl=['#1a1a2e',hair,skin,'#fff',nose,'#2d1810'];
  
  var rCenter = hx + sz/2;
  var rRad = sz/2;
  
  octx.save();
  if(pvp&&!_perfMode){octx.shadowColor='#f87171';octx.shadowBlur=8;}
  else if(name===rSel&&!_perfMode){octx.shadowColor='#fbbf24';octx.shadowBlur=10;}
  else if(isVIP&&!_perfMode){octx.shadowColor='#c084fc';octx.shadowBlur=10;}
  else if(!_perfMode){octx.shadowColor=dc;octx.shadowBlur=4;}
  
  octx.beginPath();
  if(octx.roundRect) octx.roundRect(hx, hy, sz, sz, 2);
  else octx.rect(hx, hy, sz, sz);
  octx.fillStyle='#111';
  octx.fill();
  octx.shadowBlur=0;
  
  octx.clip();
  var hf = HFS[(h>>2) % HFS.length];
  for(var rr=0;rr<8;rr++)for(var cc=0;cc<8;cc++){
    octx.fillStyle=cl[hf[rr][cc]];
    octx.fillRect(hx+cc*ps,hy+rr*ps,Math.ceil(ps),Math.ceil(ps));
  }
  octx.restore();
  
  octx.beginPath();
  if(octx.roundRect) octx.roundRect(hx - 1, hy - 1, sz + 2, sz + 2, 3);
  else octx.rect(hx - 1, hy - 1, sz + 2, sz + 2);
  octx.lineWidth = 1.5;
  if(pvp){
    octx.strokeStyle='#f87171'; octx.setLineDash([2,2]);
  } else if(name===rSel){
    octx.strokeStyle='#fbbf24'; octx.lineWidth=2;
  } else if(isVIP){
    var vG = octx.createLinearGradient(hx, hy, hx+sz, hy+sz);
    vG.addColorStop(0, '#c084fc'); vG.addColorStop(1, '#22d3ee');
    octx.strokeStyle = vG; octx.lineWidth = 2;
  } else {
    octx.strokeStyle='rgba(255,255,255,0.3)';
  }
  octx.stroke();
  octx.setLineDash([]);
  
  _headCache[key]=oc;
  return oc;
}

function drawHead(ctx,x,y,name,pvp,dc,sz,isVIP){
  sz=sz||18;
  var bmp=_getHeadBitmap(name,pvp,dc,sz,isVIP);
  var pad=12;
  ctx.drawImage(bmp,Math.floor(x-sz/2)-pad,Math.floor(y-sz/2)-pad);
}

var _lastAP=[],_expSet=new Set(),_expLast=0,_EXP_CS=128;
// [PERF] Cap untuk fog-of-war set — cegah leak kalau monitor terbuka berhari.
// 8000 chunk @128 blok = ~1024 blok radius coverage tiap dim, jauh > playable area.
var _EXP_MAX=8000;
function _capExpSet(){
  if(_expSet.size<=_EXP_MAX)return;
  // FIFO eviction: drop oldest (Set preserves insertion order).
  var drop=_expSet.size-_EXP_MAX,it=_expSet.values(),k;
  while(drop-->0&&!(k=it.next()).done)_expSet.delete(k.value);
}
function _computeExp(){
  _expSet.clear();
  for(var i=0;i<radarHistory.length;i++){var s=radarHistory[i];if(!s||!s._pos)continue;for(var j=0;j<s._pos.length;j++){var p=s._pos[j],dm=DIM_SHORT[p.d]||'overworld',cx=Math.floor(p.x/_EXP_CS),cz=Math.floor(p.z/_EXP_CS);for(var dx=-2;dx<=2;dx++)for(var dz=-2;dz<=2;dz++)_expSet.add(dm+':'+(cx+dx)+','+(cz+dz));}}
  for(var i=0;i<radarPlayers.length;i++){var p=radarPlayers[i];if(!p||p.x===undefined)continue;var cx=Math.floor(p.x/_EXP_CS),cz=Math.floor(p.z/_EXP_CS);for(var dx=-2;dx<=2;dx++)for(var dz=-2;dz<=2;dz++)_expSet.add((p.dim||'overworld')+':'+(cx+dx)+','+(cz+dz));}
  _capExpSet();
  _expLast=Date.now();
}

// [FILTER] Update tracker AFK — dipanggil per fast-poll snapshot.
// AFK = posisi tidak berubah >5 menit (delta < 2 blok pada x atau z).
function _updateAfkTracker(){
  var now=Date.now(),seen={};
  for(var i=0;i<radarPlayers.length;i++){
    var p=radarPlayers[i];if(!p||p.name===undefined||p.x===undefined)continue;
    seen[p.name]=true;
    var prev=_afkTracker[p.name];
    if(!prev){_afkTracker[p.name]={x:p.x,z:p.z,since:now};continue;}
    var dx=p.x-prev.x,dz=p.z-prev.z;
    if(dx*dx+dz*dz>=_AFK_MOVE_SQ){_afkTracker[p.name]={x:p.x,z:p.z,since:now};}
  }
  // GC offline players
  for(var n in _afkTracker)if(!seen[n])delete _afkTracker[n];
}
function _isAfk(name){var t=_afkTracker[name];return!!t&&Date.now()-t.since>=_AFK_MS;}

// [FILTER] Apply filter ke daftar pemain. Mutate copy; jangan ubah radarPlayers asli.
function _applyPlayerFilter(ap){
  if(_rfState.hidePlayer) return [];
  if(!_rfState.afk&&!_rfState.pvp&&!_rfState.owner)return ap;
  var ownerLow=_rfState.owner?_rfState.owner.trim().toLowerCase():'';
  // Pre-build set nama yang punya land milik owner (substring match) — O(L+P) bukan O(L*P)
  var ownerNames=null;
  if(ownerLow&&radarLands&&radarLands.length){
    ownerNames={};
    for(var i=0;i<radarLands.length;i++){
      var l=radarLands[i];if(!l||!l.o)continue;
      if(l.o.toLowerCase().indexOf(ownerLow)>=0)ownerNames[l.o]=true;
    }
  }
  var out=[];
  for(var i=0;i<ap.length;i++){
    var p=ap[i];
    if(_rfState.afk&&_isAfk(p.name))continue;
    if(_rfState.pvp&&!p.pvp)continue;
    if(ownerLow){
      // Match player kalau nama mengandung owner string ATAU player IS owner of any land matching
      var nLow=(p.name||'').toLowerCase();
      var match=nLow.indexOf(ownerLow)>=0||(ownerNames&&ownerNames[p.name]);
      if(!match)continue;
    }
    out.push(p);
  }
  return out;
}

// [CLUSTER] Greedy clustering — gabungkan marker dalam radius pixel < threshold.
// Hanya aktif saat zoom out (radarZoom > 1500) supaya zoom-in tetap individual.
function _clusterPlayers(ap,sc,W,H){
  if(!_rfState.cluster||radarZoom<=1500||ap.length<5)return ap.map(function(p){return{single:p};});
  var threshold=40,clusters=[];
  for(var i=0;i<ap.length;i++){
    var p=ap[i];
    var px=W/2+(p.x-radarPanX)*sc,pz=H/2+(p.z-radarPanZ)*sc;
    var added=false;
    for(var j=0;j<clusters.length;j++){
      var c=clusters[j],dx=c.cx-px,dz=c.cz-pz;
      if(dx*dx+dz*dz<threshold*threshold){
        c.members.push(p);
        // Recompute centroid
        c.cx=(c.cx*(c.members.length-1)+px)/c.members.length;
        c.cz=(c.cz*(c.members.length-1)+pz)/c.members.length;
        added=true;break;
      }
    }
    if(!added)clusters.push({cx:px,cz:pz,members:[p]});
  }
  // Convert: single → {single}, multi → {cluster, x/z, n, members}
  var out=[];
  for(var i=0;i<clusters.length;i++){
    var c=clusters[i];
    if(c.members.length===1)out.push({single:c.members[0]});
    else{
      // Cluster centroid in world coords
      var avgX=0,avgZ=0;
      for(var k=0;k<c.members.length;k++){avgX+=c.members[k].x;avgZ+=c.members[k].z;}
      avgX/=c.members.length;avgZ/=c.members.length;
      out.push({cluster:true,x:avgX,z:avgZ,n:c.members.length,members:c.members});
    }
  }
  return out;
}
function drawRadar(){
  try{
  var _now = Date.now();
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
  var cX=W/2,cY=H/2,sc=Math.min(W,H)/(radarZoom*2);
  
  // Premium Cosmic Radial Background (Professional Muted Dark Slate)
  var bgGrad = ctx.createRadialGradient(cX, cY, 0, cX, cY, Math.max(W, H) * 0.9);
  bgGrad.addColorStop(0, '#0f1626'); // Sleek dark steel navy center (muted & professional)
  bgGrad.addColorStop(1, '#070a10'); // Premium carbon black border
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0,0,W,H);
  // Fog of war — skip during interaction or in Performance Mode
  // Also skip when zoomed out so far that chunks are sub-pixel (no visual benefit)
  if(!isInteract&&!_perfMode){
    if(_now-_expLast>30000)_computeExp();
    var _cw=_EXP_CS*sc;
    if(_cw>=6&&_expSet.size>0){
      var _rng2=radarZoom*1.2;
      var _sx=Math.floor((radarPanX-_rng2)/_EXP_CS),_ex=Math.ceil((radarPanX+_rng2)/_EXP_CS);
      var _sz=Math.floor((radarPanZ-_rng2)/_EXP_CS),_ez=Math.ceil((radarPanZ+_rng2)/_EXP_CS);
      // Cap iteration count to prevent lag at extreme zoom-out
      var _fogCols=_ex-_sx+1,_fogRows=_ez-_sz+1;
      if(_fogCols*_fogRows<=2500){
        ctx.fillStyle='rgba(0,0,0,0.18)';
        ctx.beginPath();
        for(var _cx=_sx;_cx<=_ex;_cx++){for(var _cz=_sz;_cz<=_ez;_cz++){
          var _fx=cX+(_cx*_EXP_CS-radarPanX)*sc,_fz=cY+(_cz*_EXP_CS-radarPanZ)*sc;
          if(_fx+_cw<0||_fx>W||_fz+_cw<0||_fz>H)continue;
          if(!_expSet.has(radarDim+':'+_cx+','+_cz)){
            ctx.rect(_fx,_fz,_cw,_cw);
          }
        }}
        ctx.fill();
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
  if(isLive){ap=radarPlayers.filter(function(p){return p.dim===radarDim&&p.x!==undefined;}).map(function(p){return{name:p.name,x:p.x,z:p.z,pvp:!!p.pvp,di:p.di};});}
  else{var sn=radarHistory[radarTimeIdx];var pd=sn?sn._pos:[];ap=pd.filter(function(p){return(DIM_SHORT[p.d]||'overworld')===radarDim;}).map(function(p){return{name:p.n,x:p.x,z:p.z,pvp:!!p.p};});}
  // [FILTER] Apply player filter (AFK / PvP / owner) sebelum render
  if(isLive)ap=_applyPlayerFilter(ap);
  _lastAP=ap;
  // [UX: TWEENING] Smoothly animate player positions across frames
  if(!window._radarTween) window._radarTween = {};
  var _needsTw = false;
  var _now = Date.now();
  for(var i=0;i<ap.length;i++){
    var p=ap[i], tw=window._radarTween[p.name];
    if(tw && tw.d===radarDim){
      var dx=p.x-tw.x, dz=p.z-tw.z, ds=dx*dx+dz*dz;
      if (tw.tx !== p.x || tw.tz !== p.z) {
        var rx = p.x - (tw.tx||p.x), rz = p.z - (tw.tz||p.z);
        tw.speed = Math.sqrt(rx*rx + rz*rz);
        tw.tx = p.x; tw.tz = p.z;
      }
      tw.vSpeed = tw.vSpeed || 0;
      tw.vSpeed += ((tw.speed || 0) - tw.vSpeed) * 0.1;

      if(ds>1000000){ tw.x=p.x; tw.z=p.z; tw.mt=0; tw.trail=[]; }
      else if(ds>0.2){ 
        tw.x+=dx*0.18; tw.z+=dz*0.18; _needsTw=true; 
        var ta = Math.atan2(dz,dx);
        if(tw.a===undefined) tw.a = ta;
        var ad = ta - tw.a;
        while(ad < -Math.PI) ad += Math.PI * 2;
        while(ad > Math.PI) ad -= Math.PI * 2;
        tw.a += ad * 0.15;
        
        tw.mt = _now;

        var lt = tw.trail.length ? tw.trail[tw.trail.length-1] : null;
        if (!lt || (tw.x-lt.x)*(tw.x-lt.x) + (tw.z-lt.z)*(tw.z-lt.z) > 4) {
          tw.trail.push({x: tw.x, z: tw.z, t: _now});
        }
      }
      else{ tw.x=p.x; tw.z=p.z; tw.speed=0; }
    }else{
      window._radarTween[p.name]={x:p.x,z:p.z,d:radarDim,a:0,mt:0,tx:p.x,tz:p.z,speed:0,vSpeed:0,trail:[]};
      tw=window._radarTween[p.name];
    }
    while(tw.trail.length && _now - tw.trail[0].t > 12000) tw.trail.shift();
    p.x=tw.x; p.z=tw.z; p.a=tw.a; p.mt=tw.mt; p.vSpeed=tw.vSpeed; p.trail=tw.trail;
  }
  if(rSel&&rFollow){
    for(var i=0;i<ap.length;i++){
      if(ap[i].name===rSel){
        var fdx = ap[i].x - radarPanX, fdz = ap[i].z - radarPanZ, fdist = fdx*fdx + fdz*fdz;
        if(fdist > 10000) { radarPanX = ap[i].x; radarPanZ = ap[i].z; }
        else if (fdist > 0.05) { radarPanX += fdx * 0.1; radarPanZ += fdz * 0.1; _needsTw=true; }
        else { radarPanX = ap[i].x; radarPanZ = ap[i].z; }
        break;
      }
    }
  }



  var GS=[10,25,50,100,250,500,1000,2500,5000],gs=GS[GS.length-1];
  for(var i=0;i<GS.length;i++){if(GS[i]*sc>=55){gs=GS[i];break;}}
  var rng=radarZoom*1.2;
  
  // Vignette Background (Professional Depth) — skipped in Performance Mode for speed
  if(!_perfMode){
    var _vGrad = ctx.createRadialGradient(cX, cY, Math.min(W,H)*0.2, cX, cY, Math.max(W,H)*0.8);
    _vGrad.addColorStop(0, 'rgba(0,0,0,0)');
    _vGrad.addColorStop(1, 'rgba(0,0,0,0.48)');
    ctx.fillStyle = _vGrad;
    ctx.fillRect(0,0,W,H);
  }

  ctx.setLineDash([2,4]);ctx.strokeStyle='rgba(255,255,255,0.1)';ctx.lineWidth=1;
  var s1=Math.floor((radarPanX-rng)/gs)*gs,e1=Math.ceil((radarPanX+rng)/gs)*gs;
  for(var g=s1;g<=e1;g+=gs){var gx=cX+(g-radarPanX)*sc;if(gx>=0&&gx<=W){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke();if(g!==0){ctx.fillStyle='rgba(255,255,255,0.15)';ctx.font='7px JetBrains Mono,monospace';ctx.textAlign='center';ctx.fillText(g,gx,H-4);}}}
  s1=Math.floor((radarPanZ-rng)/gs)*gs;e1=Math.ceil((radarPanZ+rng)/gs)*gs;
  for(var g=s1;g<=e1;g+=gs){var gy=cY+(g-radarPanZ)*sc;if(gy>=0&&gy<=H){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();if(g!==0){ctx.fillStyle='rgba(255,255,255,0.15)';ctx.font='7px JetBrains Mono,monospace';ctx.textAlign='left';ctx.fillText(g,4,gy-2);}}}
  ctx.setLineDash([]);
  
  var ox=cX-radarPanX*sc,oz=cY-radarPanZ*sc;
  if(ox>=0&&ox<=W&&oz>=0&&oz<=H){
    // Ambient Glow at (0,0) Center
    var _cGrad = ctx.createRadialGradient(ox, oz, 0, ox, oz, 100);
    _cGrad.addColorStop(0, 'rgba(34, 211, 238, 0.15)');
    _cGrad.addColorStop(1, 'rgba(34, 211, 238, 0)');
    ctx.fillStyle = _cGrad;
    ctx.beginPath(); ctx.arc(ox, oz, 100, 0, 6.28); ctx.fill();
    
    ctx.strokeStyle='rgba(34, 211, 238, 0.3)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(ox,0);ctx.lineTo(ox,H);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,oz);ctx.lineTo(W,oz);ctx.stroke();
    
    ctx.fillStyle='rgba(34, 211, 238, 0.8)';ctx.font='600 9px JetBrains Mono,monospace';ctx.textAlign='left';
    ctx.fillText('0,0',ox+4,oz-4);
  }
  var _lVis=0,_lTot=0,_lExp=0;
  var _WARN_DAYS=7,_CRIT_DAYS=10,_CLEAN_DAYS=14;
  if(radarLands&&radarLands.length){for(var li=0;li<radarLands.length;li++){var l=radarLands[li];if(!l||l.x1==null)continue;if((DIM_SHORT[l.d]||'overworld')!==radarDim)continue;
    // [FILTER] Owner substring filter for lands
    if(_rfState.owner){var _ownLow=_rfState.owner.trim().toLowerCase();if(_ownLow&&(!l.o||l.o.toLowerCase().indexOf(_ownLow)<0))continue;}
    _lTot++;var lx1=cX+(Math.min(l.x1,l.x2)-radarPanX)*sc,lz1=cY+(Math.min(l.z1,l.z2)-radarPanZ)*sc,lx2=cX+(Math.max(l.x1,l.x2)-radarPanX)*sc,lz2=cY+(Math.max(l.z1,l.z2)-radarPanZ)*sc,lw=lx2-lx1,lh=lz2-lz1;if(lx2<0||lx1>W||lz2<0||lz1>H)continue;_lVis++;
    // Determine expiry status from di (daysInactive)
    var di=typeof l.di==='number'?l.di:-1;
    var isWarn=di>=_WARN_DAYS&&di<_CRIT_DAYS;
    var isCrit=di>=_CRIT_DAYS&&di<_CLEAN_DAYS;
    var isDead=di>=_CLEAN_DAYS;
    var isExpiring=isWarn||isCrit||isDead;
    // [FILTER] Expiring-only filter
    if(_rfState.expiring&&!isExpiring){_lVis--;continue;}
    if(isExpiring)_lExp++;
    // Choose color: normal=owner-hash, warn=orange, crit=red pulse, dead=bright red
    var lc=isExpiring?'#f87171':LAND_COLORS[nameHash(l.o)%LAND_COLORS.length];
    if(isWarn)lc='#fb923c';
    // Fill
    var fillAlpha=isDead?0.28:isCrit?0.24:isWarn?0.20:0.16;
    ctx.globalAlpha=fillAlpha;ctx.fillStyle=lc;ctx.fillRect(lx1,lz1,lw,lh);
    // Border
    var borderAlpha=isDead?0.9:isCrit?0.8:isWarn?0.7:0.65;
    // Pulsing effect for critical/dead lands
    if((isCrit||isDead)&&!_reduceMotion){var pulse=(Math.sin(Date.now()/400)+1)/2;borderAlpha=borderAlpha*(0.5+pulse*0.5);}
    ctx.globalAlpha=borderAlpha;ctx.strokeStyle=lc;ctx.lineWidth=isDead?2:isCrit?1.5:1;
    if(isExpiring){ctx.setLineDash([]);ctx.strokeRect(lx1,lz1,lw,lh);}
    else{ctx.setLineDash([3,3]);ctx.strokeRect(lx1,lz1,lw,lh);ctx.setLineDash([]);}
    // Labels (skip during interaction for perf)
    if(!isInteract){
      var _lfs=Math.min(16,Math.max(7,Math.floor(lw/8)));
      var _lfs2=Math.min(13,Math.max(6,Math.floor(lw/10)));
      var _lpad=_lfs+2;
      if(lw>30&&lh>_lfs){
        // Land name
        ctx.globalAlpha=isExpiring?0.9:0.75;
        ctx.font='600 '+_lfs+'px JetBrains Mono,monospace';ctx.textAlign='left';
        ctx.fillStyle=lc;
        ctx.fillText(l.n,Math.max(lx1+4,2),Math.max(lz1+_lfs+2,_lfs+2));
        // Owner name
        if(l.o&&lh>_lpad+_lfs2+2){
          ctx.globalAlpha=isExpiring?0.8:0.65;
          ctx.font='500 '+_lfs2+'px JetBrains Mono,monospace';
          ctx.fillStyle=isExpiring?lc:'rgba(255,255,255,0.55)';
          ctx.fillText(l.o,Math.max(lx1+4,2),Math.max(lz1+_lpad+_lfs2,_lpad+_lfs2));
        }
        // Expiry badge
        if(isExpiring&&lw>50&&lh>_lpad+_lfs2+_lfs2+8){
          var _ey=Math.max(lz1+_lpad+_lfs2*2+4,_lpad+_lfs2*2+4);
          var _efs=Math.min(10,Math.max(6,Math.floor(lw/12)));
          ctx.font='700 '+_efs+'px JetBrains Mono,monospace';
          if(isDead){ctx.globalAlpha=0.9;ctx.fillStyle='#f87171';ctx.fillText('[CLEAN] '+di+'d',Math.max(lx1+4,2),_ey);}
          else if(isCrit){ctx.globalAlpha=0.8;ctx.fillStyle='#f87171';ctx.fillText('[!] '+di+'d expiring',Math.max(lx1+4,2),_ey);}
          else{ctx.globalAlpha=0.7;ctx.fillStyle='#fb923c';ctx.fillText('[~] '+di+'d inactive',Math.max(lx1+4,2),_ey);}
        }
        // Corner warning icon for small lands
        else if(isExpiring&&lw>15&&lh>15){
          ctx.globalAlpha=isDead?0.9:0.7;ctx.font='700 '+Math.min(12,Math.max(8,Math.floor(Math.min(lw,lh)/3)))+'px sans-serif';
          ctx.textAlign='center';ctx.fillStyle=lc;
          ctx.fillText(isDead?'X':isCrit?'!':'~',lx1+lw/2,lz1+lh/2+4);
        }
      }
    }
    ctx.globalAlpha=1;}}
  // ── Zone Borders (Purge / Dragon Territory / Dragon Fight Arena) ──
  if(radarZoneBorders&&radarZoneBorders.length){
    var _zbPulse=_reduceMotion?0.7:(Math.sin(Date.now()/600)+1)/2;
    for(var zbi=0;zbi<radarZoneBorders.length;zbi++){
      var zb=radarZoneBorders[zbi];if(!zb||!zb.active)continue;
      // Map dimension keys: sync sends 'the_end', 'overworld', 'nether'
      if(zb.dim!==radarDim)continue;
      var zbCx=cX+(zb.cx-radarPanX)*sc,zbCz=cY+(zb.cz-radarPanZ)*sc;
      var zbR=zb.radius*sc;if(zbR<2)continue;
      var zbCol=zb.color||'#f87171';
      // Fill (very subtle) — skip if border covers entire viewport (no visual benefit)
      var zbMaxDim=Math.max(W,H);
      if(zbR<zbMaxDim*1.5){
        ctx.globalAlpha=0.04+_zbPulse*0.04;
        ctx.fillStyle=zbCol;
        if(zb.shape==='circle'){
          ctx.beginPath();ctx.arc(zbCx,zbCz,zbR,0,Math.PI*2);ctx.fill();
        }else{
          ctx.fillRect(zbCx-zbR,zbCz-zbR,zbR*2,zbR*2);
        }
      }
      // Border line (pulsing)
      ctx.globalAlpha=0.35+_zbPulse*0.45;
      ctx.strokeStyle=zbCol;
      ctx.lineWidth=zb.type==='purge'?2.5:1.5;
      if(zb.type==='end_territory')ctx.setLineDash([6,4]);
      else if(zb.type==='dragon_fight')ctx.setLineDash([3,3]);
      else ctx.setLineDash([]);
      if(zb.shape==='circle'){
        ctx.beginPath();ctx.arc(zbCx,zbCz,zbR,0,Math.PI*2);ctx.stroke();
      }else{
        ctx.strokeRect(zbCx-zbR,zbCz-zbR,zbR*2,zbR*2);
      }
      ctx.setLineDash([]);
      // Label
      if(!isInteract&&zbR>25){
        var _zbFs=Math.min(12,Math.max(8,Math.floor(zbR/20)));
        ctx.globalAlpha=0.6+_zbPulse*0.3;
        ctx.font='600 '+_zbFs+'px JetBrains Mono,monospace';
        ctx.textAlign='center';ctx.fillStyle=zbCol;
        ctx.fillText(zb.label||zb.type,zbCx,zbCz-zbR-6);
        // Radius + dragon stats info
        ctx.globalAlpha=0.4;
        ctx.font='500 '+Math.max(7,_zbFs-2)+'px JetBrains Mono,monospace';
        var _zbSub=zb.radius+'b radius';
        if(zb.kills>0)_zbSub+=' \u00b7 Kill #'+zb.kills;
        if(zb.best_time>0){var _btm=Math.floor(zb.best_time/60),_bts=zb.best_time%60;_zbSub+=' \u00b7 Best '+_btm+':'+String(_bts).padStart(2,'0');}
        ctx.fillText(_zbSub,zbCx,zbCz-zbR-6+_zbFs+2);
      }
      ctx.globalAlpha=1;
    }
  }
  if(!isLive&&radarTimeIdx>0){
    var tr={},st=Math.max(0,radarTimeIdx-24);
    for(var t=st;t<=radarTimeIdx;t++){var sn=radarHistory[t];if(!sn||!sn._pos)continue;for(var j=0;j<sn._pos.length;j++){var tp=sn._pos[j];if((DIM_SHORT[tp.d]||'overworld')!==radarDim)continue;if(!tr[tp.n])tr[tp.n]=[];tr[tp.n].push({x:tp.x,z:tp.z,t:t});}}
    var an=_reduceMotion?0:(Date.now()%1800)/1800,nk=Object.keys(tr);
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
  
  // PvP Clash Detektor
  if(isLive && !isInteract){
    var clashes = [];
    for(var i=0; i<ap.length; i++){
      if(!ap[i].pvp) continue;
      for(var j=i+1; j<ap.length; j++){
        if(!ap[j].pvp) continue;
        if(rSel && ap[i].name !== rSel && ap[j].name !== rSel) continue;
        var dx = ap[i].x - ap[j].x, dz = ap[i].z - ap[j].z;
        if(dx*dx + dz*dz < 400){
          clashes.push({x: (ap[i].x+ap[j].x)/2, z: (ap[i].z+ap[j].z)/2});
        }
      }
    }
    for(var c=0; c<clashes.length; c++){
      var clx = cX + (clashes[c].x - radarPanX)*sc, clz = cY + (clashes[c].z - radarPanZ)*sc;
      if(clx<-50||clx>W+50||clz<-50||clz>H+50) continue;
      var cpulse = (Math.sin(Date.now()/150) + 1)/2;
      ctx.save();
      ctx.beginPath();
      var crad = 25 + cpulse*15;
      ctx.arc(clx, clz, crad, 0, 6.28);
      var grd = ctx.createRadialGradient(clx, clz, 0, clx, clz, crad);
      grd.addColorStop(0, 'rgba(239, 68, 68, 0.5)');
      grd.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = grd;
      ctx.fill();
      ctx.fillStyle = 'rgba(239, 68, 68, '+(0.6 + cpulse*0.4)+')';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('\u2694', clx, clz);
      ctx.restore();
    }
  }
  // Render Epic Particles (batched & highly optimized)
  if(window._radarParticles && window._radarParticles.length > 0 && !isInteract && !_perfMode){
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    var nextP = [];
    var particleColorMap = {
      '#c084fc': 'rgba(192,132,252,',
      '#22d3ee': 'rgba(34,211,238,',
      '#a5f3fc': 'rgba(165,243,252,',
      '#e879f9': 'rgba(232,121,249,'
    };
    var subBatches = {};
    
    for(var i=0; i<window._radarParticles.length; i++){
      var pt = window._radarParticles[i];
      pt.life -= 16;
      if(pt.life <= 0) continue;
      pt.x += pt.vx; pt.z += pt.vz;
      var px = cX + (pt.x - radarPanX)*sc;
      var pz = cY + (pt.z - radarPanZ)*sc;
      if(px<-10||px>W+10||pz<-10||pz>H+10){ nextP.push(pt); continue; }
      
      var pRatio = pt.life / pt.maxLife;
      var alpha = Math.round(pRatio * 9) / 10;
      if(alpha <= 0) continue;
      
      var baseColor = particleColorMap[pt.c] || 'rgba(192,132,252,';
      var fillStyle = baseColor + alpha + ')';
      
      if(!subBatches[fillStyle]) subBatches[fillStyle] = [];
      subBatches[fillStyle].push({x: px, z: pz, r: pt.r * pRatio});
      
      nextP.push(pt);
    }
    window._radarParticles = nextP;
    
    for(var style in subBatches){
      var list = subBatches[style];
      ctx.fillStyle = style;
      ctx.beginPath();
      for(var j=0; j<list.length; j++){
        var p = list[j];
        ctx.moveTo(p.x + p.r, p.z);
        ctx.arc(p.x, p.z, p.r, 0, 6.28);
      }
      ctx.fill();
    }
    ctx.restore();
    if(window._radarParticles.length > 0) _needsTw = true;
  }

  // [CLUSTER] Group nearby players when zoomed out
  var renderUnits=_clusterPlayers(ap,sc,W,H);
  var clQ = [];
  var isHoveringCluster = false;
  var nameplateQueue = [];
  for(var i=0;i<renderUnits.length;i++){
    var unit=renderUnits[i];
    if(unit.cluster){ clQ.push(unit); continue; }
    var p=unit.single,px=cX+(p.x-radarPanX)*sc,pz=cY+(p.z-radarPanZ)*sc;
    if(px<-20||px>W+20||pz<-20||pz>H+20)continue;
    var pNameLower = (p.name || '').toLowerCase();
    var isVIP = window._lcSupporters && window._lcSupporters[pNameLower];
    var isVerified = window._lcVerified && window._lcVerified[pNameLower];
    if (isVIP) isVerified = false; // Replace verified mark with diamond logo if topup

    var dim=rSel&&rSel!==p.name;
    ctx.globalAlpha = dim ? 0.25 : 1.0;

    // Draw cinematic motion trail — dual-stroke glow simulation for 60 FPS performance
    if(p.trail && p.trail.length > 1 && !dim && !isInteract && !_perfMode){
      ctx.save();
      if(isVIP) ctx.globalCompositeOperation = 'screen';
      var tLen = p.trail.length;
      var lastT = p.trail[tLen-1];
      // [PERF] Single batched stroke for glow backdrop
      ctx.beginPath();
      for(var k=0; k<tLen-1; k++){
        var t0 = p.trail[k], t1 = p.trail[k+1];
        ctx.moveTo(cX+(t0.x-radarPanX)*sc, cY+(t0.z-radarPanZ)*sc);
        ctx.lineTo(cX+(t1.x-radarPanX)*sc, cY+(t1.z-radarPanZ)*sc);
      }
      ctx.moveTo(cX+(lastT.x-radarPanX)*sc, cY+(lastT.z-radarPanZ)*sc);
      ctx.lineTo(px, pz);
      ctx.lineWidth = isVIP ? 10 : 7;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = isVIP ? 'rgba(192,132,252,0.15)' : hexAlpha(dc, 0.15);
      ctx.stroke();
      // [PERF] Core trail: single stroke (skip per-segment fade for perf)
      ctx.beginPath();
      ctx.moveTo(cX+(p.trail[0].x-radarPanX)*sc, cY+(p.trail[0].z-radarPanZ)*sc);
      for(var k=1; k<tLen; k++) ctx.lineTo(cX+(p.trail[k].x-radarPanX)*sc, cY+(p.trail[k].z-radarPanZ)*sc);
      ctx.lineTo(px, pz);
      ctx.lineWidth = isVIP ? 4 : 3;
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = isVIP ? '#22d3ee' : dc;
      ctx.stroke();
      ctx.globalAlpha = 1.0;
      ctx.restore();
    }

    drawHead(ctx,px,pz,p.name,p.pvp,dc,18,isVIP);
    // Draw dynamic movement arrow
    if(p.mt && Date.now() - p.mt < 6000 && !dim){
      var pulse = isInteract ? 0.5 : (Math.sin(Date.now() / 200) + 1) / 2;
      var speedMod = Math.min(25, (p.vSpeed || 0) * 0.8); // Speed based length
      ctx.save();
      ctx.translate(px,pz);ctx.rotate(p.a);
      
      if(isVIP) {
         if(!isInteract) { ctx.shadowColor = '#c084fc'; ctx.shadowBlur = 6 + pulse * 10; }
         var vGrad = ctx.createLinearGradient(13, 0, 35 + speedMod, 0);
         vGrad.addColorStop(0, '#c084fc');
         vGrad.addColorStop(1, '#22d3ee');
         ctx.fillStyle = vGrad;
         ctx.strokeStyle = '#ffffff';
         ctx.lineWidth = 1.5;
         
         var base = 16;
         var tip = base + 18 + speedMod * 1.2;
         var wing = 12 + speedMod * 0.25;
         
         // Iconic Sci-Fi Glider / Crown Shape
         ctx.beginPath();
         ctx.moveTo(tip, 0);               // Nose
         ctx.lineTo(base, -wing);          // Top Wing
         ctx.lineTo(base + 7, -3);         // Inner top trailing edge
         ctx.lineTo(base - 1, 0);          // Engine indent
         ctx.lineTo(base + 7, 3);          // Inner bottom trailing edge
         ctx.lineTo(base, wing);           // Bottom Wing
         ctx.closePath();
         ctx.fill();
         ctx.stroke();
         
         // Removed floating diamond as requested by user
         
         // Epic Galaxy Particles Emission
         // [PERF] Reduced spawn rate 0.6→0.25, added global cap check
         if(speedMod > 1 && !isInteract && (!window._radarParticles || window._radarParticles.length < 30)) {
           if(!window._radarParticles) window._radarParticles = [];
           if(Math.random() < 0.25) {
             var emitAngle = p.a + Math.PI + (Math.random()-0.5)*0.6;
             var pSpeed = (0.2 + Math.random()*0.8) * speedMod * 0.1;
             var isP = Math.random() > 0.5;
             window._radarParticles.push({
               x: p.x - Math.cos(p.a)*2,
               z: p.z - Math.sin(p.a)*2,
               vx: Math.cos(emitAngle)*pSpeed,
               vz: Math.sin(emitAngle)*pSpeed,
               life: 300 + Math.random()*300,
               maxLife: 600,
               r: 1 + Math.random()*2.5,
               c: isP ? '#c084fc' : '#22d3ee'
             });
           }
         }
      } else {
         if(!isInteract) { ctx.shadowColor = dc; ctx.shadowBlur = 4 + pulse * 6; }
         ctx.fillStyle = dc;
         ctx.beginPath();
         ctx.moveTo(26 + speedMod, 0);
         ctx.lineTo(13, -9 - speedMod*0.15);
         ctx.lineTo(16, 0);
         ctx.lineTo(13, 9 + speedMod*0.15);
         ctx.closePath();
         ctx.fill();
         ctx.shadowBlur = 0;
         ctx.strokeStyle = '#0a0e14';
         ctx.lineWidth = 1.5;
         ctx.stroke();
      }
      ctx.restore();
    }
    // Defer the entire nameplate rendering pass using a closure IIFE to capture variables
    (function(p, px, pz, isVIP, isVerified, dim, dc) {
       // Pre-evaluate chat state for priority sorting
       var pNameKey = (p.name || '').trim().toLowerCase();
       var activeChat = null;
       if (window._lcRecentMessages && window._lcRecentMessages[pNameKey] && !dim) {
          var chat = window._lcRecentMessages[pNameKey];
          var age = Date.now() - chat.time;
          if (age < 8000) {
             _needsTw = true;
             activeChat = { msg: (chat.msg || '').toString().replace(/\n/g, ' '), age: age };
             if (activeChat.msg.length > 35) activeChat.msg = activeChat.msg.substring(0, 33) + '...';
          }
       }
       var isShowingChat = !!activeChat;

       nameplateQueue.push({
          isChat: isShowingChat,
          isVIP: isVIP,
          draw: function() {
             var iconSpace = 0;
             if(isVerified) iconSpace += 12;
             if(isVIP) iconSpace += 12;
             
             var padX = 6, padY = 4;
             var nameY = pz - 21; 

             if (!window._playerNameWidths) window._playerNameWidths = {};
             var nameW = window._playerNameWidths[p.name];
             if (nameW === undefined) {
                ctx.font='600 10px Inter,sans-serif';
                nameW = window._playerNameWidths[p.name] = ctx.measureText(p.name).width;
             }
             var textW = nameW;
             var displayName = p.name;
             
             if (isShowingChat) {
                displayName = activeChat.msg;
                if (!window._playerChatWidths) window._playerChatWidths = {};
                var chatW = window._playerChatWidths[displayName];
                if (chatW === undefined) {
                   ctx.font = 'italic 9px Inter, sans-serif';
                   chatW = window._playerChatWidths[displayName] = ctx.measureText(displayName).width;
                }
                textW = Math.max(nameW, chatW + 18); // Stable width including vector speaker icon space
             }
             
             // Liquid Stretching Animation (Fluid Physics using global window cache)
             if (!window._playerTagWidths) window._playerTagWidths = {};
             var pKey = p.name;
             if (window._playerTagWidths[pKey] === undefined) window._playerTagWidths[pKey] = nameW;
             window._playerTagWidths[pKey] += (textW - window._playerTagWidths[pKey]) * 0.16;
             textW = window._playerTagWidths[pKey];
             
             var bw = textW + padX*2 + iconSpace;
             var bx = px - bw/2;
             var by = nameY - 8;
             var bh = 12 + padY; 
             var br = bh / 2;
             
             var gx0=0, gy0=0, gx1=0, gy1=0;
             if(isVIP && !dim && !_perfMode) {
                var t = Date.now() / 2000;
                var cx = bx + bw/2;
                var cy = by + bh/2;
                var radius = bw * 1.5;
                gx0 = cx + Math.cos(t) * radius;
                gy0 = cy + Math.sin(t) * radius;
                gx1 = cx - Math.cos(t) * radius;
                gy1 = cy - Math.sin(t) * radius;
             }
             
             ctx.globalAlpha = dim ? 0.25 : 1.0;
             
             if(!dim) {
                 if(isVIP && !isInteract) {
                    ctx.beginPath();
                    ctx.moveTo(px, by + bh);
                    ctx.lineTo(px, pz - 9);
                    ctx.strokeStyle = 'rgba(103, 232, 249, 0.4)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                 }

                 if(isVIP) {
                   var bgG = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
                   bgG.addColorStop(0, 'rgba(88, 28, 135, 0.35)');
                   bgG.addColorStop(0.5, 'rgba(30, 58, 138, 0.35)');
                   bgG.addColorStop(1, 'rgba(21, 94, 117, 0.35)');
                   ctx.fillStyle = bgG;
                 } else {
                   ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                 }
                 
                 ctx.beginPath();
                 ctx.moveTo(bx + br, by);
                 ctx.lineTo(bx + bw - br, by);
                 ctx.arcTo(bx + bw, by, bx + bw, by + bh, br);
                 ctx.lineTo(bx + bw, by + bh - br);
                 ctx.arcTo(bx + bw, by + bh, bx, by + bh, br);
                 ctx.lineTo(bx + br, by + bh);
                 ctx.arcTo(bx, by + bh, bx, by, br);
                 ctx.lineTo(bx, by + br);
                 ctx.arcTo(bx, by, bx + br, by, br);
                 ctx.closePath();
                 ctx.fill();
                 
                 if(isVIP || isShowingChat) {
                   var bdG = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
                   if (isVIP) {
                      bdG.addColorStop(0, '#c084fc');
                      bdG.addColorStop(0.5, '#818cf8');
                      bdG.addColorStop(1, '#2dd4bf');
                   } else {
                      bdG.addColorStop(0, '#38bdf8'); // Glowing sky blue neon border
                      bdG.addColorStop(1, '#818cf8'); // Glowing cyber lavender
                   }
                   
                   ctx.strokeStyle = bdG;
                   
                   // Smooth pulse resizing logic for active chat neon border
                   var strokeW = 1.5;
                   if (isShowingChat) {
                      var age = activeChat.age;
                      var fadeAlpha = age > 7000 ? (8000 - age) / 1000 : (age < 300 ? age/300 : 1);
                      strokeW = (1.2 + Math.sin(Date.now() / 140) * 0.4) * fadeAlpha;
                   }
                   
                   // Draw dual-stroke glowing vector outline instead of slow shadowBlur
                   if(!isInteract && !_perfMode){
                     ctx.strokeStyle = bdG;
                     ctx.lineWidth = strokeW + 2.5;
                     ctx.globalAlpha = 0.20;
                     ctx.stroke();
                     ctx.globalAlpha = 1.0;
                   }
                   
                   ctx.strokeStyle = bdG;
                   ctx.lineWidth = strokeW;
                   ctx.stroke();
                   
                   if(!isInteract && !_perfMode){
                     if(!window._radarParticles) window._radarParticles = [];
                     // [PERF] Reduced particle cap 25→12, spawn rate 0.08→0.04
                     if(window._radarParticles.length < 12 && Math.random() < 0.04) {
                       var ex = bx + Math.random() * bw;
                       var ez = by + Math.random() * bh;
                       if(Math.random() < 0.4) ex = bx + (Math.random() > 0.5 ? 0 : bw); 
                       
                       window._radarParticles.push({
                          x: (ex - cX)/sc + radarPanX,
                          z: (ez - cY)/sc + radarPanZ,
                          vx: (Math.random() - 0.5) * 0.06,
                          vz: -0.10 - Math.random() * 0.10,
                          life: 120 + Math.random()*150,
                          maxLife: 270,
                          r: 0.5 + Math.random()*1.0,
                          c: Math.random() > 0.6 ? '#c084fc' : (Math.random() > 0.5 ? '#a5f3fc' : '#e879f9')
                       });
                     }
                   }
                 } else {
                   ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                   ctx.lineWidth = 1;
                   ctx.stroke();
                 }
             }
             
             if (isShowingChat) {
                var age = activeChat.age;
                var chatAlpha = age > 7000 ? (8000 - age) / 1000 : (age < 300 ? age/300 : 1);
                ctx.save();
                ctx.globalAlpha = chatAlpha;
                ctx.fillStyle = isVIP ? '#fef08a' : '#22d3ee'; // Starlight yellow or cyber cyan for active chat
             } else if(isVIP && !dim) {
                var tG = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
                tG.addColorStop(0, '#e879f9');
                tG.addColorStop(0.5, '#a78bfa');
                tG.addColorStop(1, '#67e8f9');
                ctx.fillStyle = tG;
             } else {
                ctx.fillStyle = dim ? 'rgba(255,255,255,0.25)' : '#fff';
             }

             var textStartX = px - iconSpace/2;
             var drawTextX = textStartX;
             var chatW = 0;
             
             if (isShowingChat) {
                if (!window._playerChatWidths) window._playerChatWidths = {};
                chatW = window._playerChatWidths[displayName];
                if (chatW === undefined) {
                   ctx.font = 'italic 9px Inter, sans-serif';
                   chatW = window._playerChatWidths[displayName] = ctx.measureText(displayName).width;
                }
                drawTextX += 9; // Offset text right by 9px to balance 18px speaker space
             }
             
             // Draw Custom Vector Speaker Icon (BOLD Megaphone, ANIMATED sequential waves)
             if (isShowingChat) {
                var speakX = drawTextX - chatW/2 - 10;
                // Pre-scaled Megaphone Body
                ctx.beginPath();
                ctx.moveTo(speakX + 0.9, nameY - 1.35);
                ctx.lineTo(speakX + 2.7, nameY - 1.35);
                ctx.lineTo(speakX + 4.95, nameY - 3.15);
                ctx.lineTo(speakX + 4.95, nameY + 3.15);
                ctx.lineTo(speakX + 2.7, nameY + 1.35);
                ctx.lineTo(speakX + 0.9, nameY + 1.35);
                ctx.closePath();
                ctx.fillStyle = isVIP ? '#fef08a' : '#22d3ee';
                ctx.fill();
                
                // Pre-scaled sequential sound waves propagating outwards
                var baseWaveColor = isVIP ? 'rgba(254, 240, 138,' : 'rgba(34, 211, 222,';
                ctx.lineWidth = 0.99;
                
                for (var w = 0; w < 2; w++) {
                   var wFrac = ((Date.now() / 700) + w * 0.5) % 1;
                   var radius = (3 + wFrac * 6.5) * 0.45;
                   var alpha = 1 - wFrac;
                   if (alpha <= 0.02) continue;
                   
                   ctx.strokeStyle = baseWaveColor + alpha + ')';
                   ctx.beginPath();
                   ctx.arc(speakX + 4.95, nameY, radius, -Math.PI/3, Math.PI/3);
                   ctx.stroke();
                }
             }
             
             ctx.textAlign = 'center';
             ctx.font = isShowingChat ? 'italic 9px Inter, sans-serif' : '600 10px Inter, sans-serif';
             ctx.fillText(displayName, drawTextX, nameY + 3);
             ctx.shadowBlur = 0;
             ctx.shadowOffsetY = 0;
             if (isShowingChat) {
                ctx.restore();
             }
             
             var actualTextW = isShowingChat ? chatW : nameW;
             var actualTextCenter = isShowingChat ? drawTextX : textStartX;
             var iconX = actualTextCenter + actualTextW/2 + 3;
             if(!dim) {
               if(isVerified) {
                  ctx.beginPath();
                  ctx.moveTo(iconX + 1.6, nameY + 0.8);
                  ctx.lineTo(iconX + 3.6, nameY + 2.8);
                  ctx.lineTo(iconX + 8.0, nameY - 1.6);
                  ctx.strokeStyle = '#fef08a'; // Cosmic Starlight Gold
                  ctx.lineWidth = 1.6;
                  ctx.stroke();
                  iconX += 12;
               }
               
               if(isVIP) {
                  var vx1 = iconX + 2.5, vy1 = nameY - 4.0;
                  var vx2 = iconX + 6.5, vy2 = nameY - 4.0;
                  var vx3 = iconX + 9.0, vy3 = nameY + 0.5;
                  var vx4 = iconX + 4.5, vy4 = nameY + 5.0;
                  var vx5 = iconX + 0.0, vy5 = nameY + 0.5;
                  var vxMiddle = iconX + 4.5, vyMiddle = nameY + 0.5;

                  // 1. Draw solid holographic gradient fill
                  var dGrad = ctx.createLinearGradient(iconX, nameY - 4, iconX + 9, nameY + 5);
                  dGrad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');   // Sky Blue
                  dGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.45)'); // Cyber Purple
                  dGrad.addColorStop(1, 'rgba(244, 114, 182, 0.45)');  // Cosmic Pink

                  ctx.beginPath();
                  ctx.moveTo(vx1, vy1);
                  ctx.lineTo(vx2, vy2);
                  ctx.lineTo(vx3, vy3);
                  ctx.lineTo(vx4, vy4);
                  ctx.lineTo(vx5, vy5);
                  ctx.closePath();
                  ctx.fillStyle = dGrad;
                  ctx.fill();

                  // 2. Draw glowing neon outline and internal diamond facets
                  ctx.save();
                  if(!isInteract && !_perfMode) {
                     ctx.shadowColor = '#c084fc';
                     ctx.shadowBlur = 6;
                  }

                  var strokeGrad = ctx.createLinearGradient(iconX, nameY - 4, iconX + 9, nameY + 5);
                  strokeGrad.addColorStop(0, '#38bdf8');
                  strokeGrad.addColorStop(0.5, '#c084fc');
                  strokeGrad.addColorStop(1, '#f472b6');

                  // Draw outer outline
                  ctx.beginPath();
                  ctx.moveTo(vx1, vy1);
                  ctx.lineTo(vx2, vy2);
                  ctx.lineTo(vx3, vy3);
                  ctx.lineTo(vx4, vy4);
                  ctx.lineTo(vx5, vy5);
                  ctx.closePath();
                  ctx.strokeStyle = strokeGrad;
                  ctx.lineWidth = 1.0;
                  ctx.stroke();

                  // Draw internal gemstone cut facets matching the SVG design
                  ctx.beginPath();
                  ctx.moveTo(vx1, vy1);
                  ctx.lineTo(vxMiddle, vyMiddle);
                  ctx.lineTo(vx2, vy2);
                  ctx.moveTo(vx5, vy5);
                  ctx.lineTo(vx3, vy3);
                  ctx.strokeStyle = strokeGrad;
                  ctx.lineWidth = 0.85;
                  ctx.stroke();

                  ctx.restore();
                  iconX += 12;
               }
             }
             
             if(!isInteract){
               ctx.fillStyle=dim?'rgba(255,255,255,0.12)':'rgba(255,255,255,0.4)';
               ctx.font='500 7px JetBrains Mono,monospace';
               ctx.fillText(Math.round(p.x)+', '+Math.round(p.z),px,pz+18);
               if(p.pvp&&!dim){ctx.fillStyle='rgba(248,113,113,0.8)';ctx.font='700 6px JetBrains Mono,monospace';ctx.fillText('\u2694 PVP',px,pz+26);}
             }
             
             ctx.globalAlpha = 1.0;
          }
       });
    })(p, px, pz, isVIP, isVerified, dim, dc);
    ctx.globalAlpha = 1.0;
    

  }
  
  // Sort nameplate queue: Normal first, then VIP/Chatting players on top of everyone!
  nameplateQueue.sort(function(a, b) {
     if (a.isChat && !b.isChat) return 1;
     if (!a.isChat && b.isChat) return -1;
     if (a.isVIP && !b.isVIP) return 1;
     if (!a.isVIP && b.isVIP) return -1;
     return 0;
  });
  
  // Execute all nameplate drawings on the absolute top layer!
  for (var k = 0; k < nameplateQueue.length; k++) {
     nameplateQueue[k].draw();
  }
  


  var clickedClusterFound = false;
  var prevActive = window._activeCluster;
  window._activeCluster = null;
  for(var i=0;i<clQ.length;i++){
    var unit=clQ[i];
    var cx2=cX+(unit.x-radarPanX)*sc,cz2=cY+(unit.z-radarPanZ)*sc;
    if(cx2<-100||cx2>W+100||cz2<-100||cz2>H+100)continue;
    var rad=Math.min(20,12+unit.n*1.2);
    
    var _matchCluster = function(oldC, newC){
      if(!oldC) return false;
      if(Math.abs(oldC.x - newC.x) > 50 || Math.abs(oldC.z - newC.z) > 50) return false;
      for(var m1=0; m1<oldC.members.length; m1++){
        for(var m2=0; m2<newC.members.length; m2++){
          if(oldC.members[m1].name === newC.members[m2].name) return true;
        }
      }
      return false;
    };
    
    var isHov = false;
    if(window._radarMouseX !== undefined){
      var dCenter = (window._radarMouseX-cx2)*(window._radarMouseX-cx2) + (window._radarMouseY-cz2)*(window._radarMouseY-cz2);
      if(dCenter <= rad*rad) isHov = true;
      else if(_matchCluster(prevActive, unit)){
        var expRad = Math.max(rad+32, unit.n*10);
        if(dCenter <= (expRad+30)*(expRad+30)) isHov = true;
      }
    }
    var isClicked = _matchCluster(window._clickedCluster, unit);
    var isActive = isHov || isClicked;
    if(isActive) isHoveringCluster = true;
    if(isClicked) clickedClusterFound = true;
    
    ctx.save();
    ctx.fillStyle=isActive ? 'rgba(34,211,238,0.5)' : 'rgba(34,211,238,0.18)';
    ctx.strokeStyle=dc;ctx.lineWidth=1.5;
    if(isActive){ ctx.shadowColor=dc; ctx.shadowBlur=12; }
    ctx.beginPath();ctx.arc(cx2,cz2,rad,0,6.28);ctx.fill();ctx.stroke();
    ctx.shadowBlur=0;

    if(isActive && unit.members){
      window._activeCluster = unit;
      if(isClicked) window._clickedCluster = unit; // update reference to latest unit object
      var num = unit.members.length;
      var expRad = Math.max(rad + 32, num * 10); 
      ctx.beginPath(); ctx.arc(cx2,cz2,expRad,0,6.28);
      ctx.strokeStyle='rgba(34,211,238,0.3)'; ctx.setLineDash([3,6]); ctx.stroke(); ctx.setLineDash([]);
      
      for(var m=0;m<num;m++){
        var member=unit.members[m];
        var angle = (m/num)*Math.PI*2 - Math.PI/2;
        var ax = cx2 + Math.cos(angle)*expRad, az = cz2 + Math.sin(angle)*expRad;
        ctx.beginPath(); ctx.moveTo(cx2 + Math.cos(angle)*rad, cz2 + Math.sin(angle)*rad); ctx.lineTo(ax,az);
        ctx.strokeStyle='rgba(34,211,238,0.5)'; ctx.lineWidth=1; ctx.stroke();
        drawHead(ctx, ax, az, member.name, member.pvp, dc, 16);
        ctx.fillStyle='#fff';ctx.font='600 9px Inter,sans-serif';ctx.textAlign='center';
        ctx.shadowColor='rgba(0,0,0,0.9)';ctx.shadowBlur=4;ctx.shadowOffsetY=1;
        ctx.fillText(member.name, ax, az+14);
        ctx.shadowBlur=0;
      }
    }else{
      ctx.fillStyle='#fff';ctx.font='700 11px Inter,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(unit.n,cx2,cz2);
      ctx.textBaseline='alphabetic';
    }
    ctx.restore();
  }
  if(window._clickedCluster && !clickedClusterFound) window._clickedCluster = null;
  if(canvas && !radarDrag) canvas.style.cursor = isHoveringCluster ? 'pointer' : 'default';

  ctx.fillStyle='rgba(255,255,255,0.2)';ctx.font='600 10px Inter,sans-serif';ctx.textAlign='center';
  ctx.fillText('N',W/2,13);ctx.fillText('S',W/2,H-5);ctx.fillText('W',9,H/2+4);ctx.fillText('E',W-9,H/2+4);
  safeSet('radar-count',ap.length+' pemain'+(_lTot?' \u00b7 '+_lVis+'/'+_lTot+' land'+(_lExp?' \u00b7 '+_lExp+' expiring':''):''));safeSet('radar-zoom-label','Zoom: '+radarZoom+' blok');
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
  // Update land expiry panel (skip during interaction for perf)
  if(!isInteract&&typeof _renderExpPanel==='function')try{_renderExpPanel();}catch(ex){}
  
  // [PERF] Tween rAF capped to 20fps in all modes (was uncapped 60fps+ in standard mode)
  if(_needsTw && !isInteract && !radarRaf && typeof _radarQueued!=='undefined' && !_radarQueued){
    radarRaf = requestAnimationFrame(function rf(){
       radarRaf=0;
       var now = Date.now();
       var fpsLimit = _perfMode ? 50 : 50; // 20 FPS cap for tween animation (saves major CPU)
       if(!window._lastRadarTw || now - window._lastRadarTw > fpsLimit) {
          window._lastRadarTw = now;
          drawRadar();
       } else {
          radarRaf = requestAnimationFrame(rf);
       }
    });
  }
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
  h+='<div style="font-size:.55rem;color:var(--cyan);margin-top:2px">X: '+Math.round(p.x)+' &nbsp; Z: '+Math.round(p.z)+'</div>';
  h+='<div style="font-size:.48rem;color:var(--mute);margin-top:1px">'+radarDim.replace('_',' ')+'</div>';
  if(p.pvp)h+='<div style="font-size:.52rem;color:#f87171;font-weight:700;margin-top:1px">\u2694 PVP ON</div>';
  h+='<div style="font-size:.45rem;color:var(--mute);margin-top:3px">Klik map kosong untuk deselect</div>';
  ct.innerHTML=h;
}

function _rHit(canvas,e){
  var r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
  var W=parseInt(canvas.style.width)||600,H=parseInt(canvas.style.height)||400;
  var cX=W/2,cY=H/2,sc=Math.min(W,H)/(radarZoom*2);
  
  var activeU = window._activeCluster || window._clickedCluster;
  if(activeU && activeU.members){
    var u = activeU, cx2 = cX+(u.x-radarPanX)*sc, cz2 = cY+(u.z-radarPanZ)*sc;
    var rad = Math.min(20,12+u.n*1.2), num = u.members.length, expRad = Math.max(rad+32, num*10);
    for(var m=0;m<num;m++){
      var angle = (m/num)*Math.PI*2 - Math.PI/2, ax = cx2 + Math.cos(angle)*expRad, az = cz2 + Math.sin(angle)*expRad;
      if((mx-ax)*(mx-ax) + (my-az)*(my-az) <= 625) return {type:'player', player: u.members[m]};
    }
    if((mx-cx2)*(mx-cx2) + (my-cz2)*(my-cz2) <= Math.max(rad*rad, 625)) return {type:'cluster_close'};
  }
  if(window._lastRenderUnits){
    for(var i=0;i<window._lastRenderUnits.length;i++){
      var u=window._lastRenderUnits[i];
      if(u.cluster){
        var cx2=cX+(u.x-radarPanX)*sc, cz2=cY+(u.z-radarPanZ)*sc, rad=Math.min(20,12+u.n*1.2);
        if((mx-cx2)*(mx-cx2)+(my-cz2)*(my-cz2)<=Math.max(rad*rad, 900)) return {type:'cluster', cluster: u};
      }
    }
  }
  var best=null, bd=625;
  if(window._lastRenderUnits){
    for(var i=0;i<window._lastRenderUnits.length;i++){
      var u=window._lastRenderUnits[i];
      if(!u.cluster && u.single){
        var p=u.single, px=cX+(p.x-radarPanX)*sc, pz=cY+(p.z-radarPanZ)*sc, d=(mx-px)*(mx-px)+(my-pz)*(my-pz);
        if(d<bd){bd=d;best=p;}
      }
    }
  }else{
    for(var i=0;i<_lastAP.length;i++){
      var p=_lastAP[i], px=cX+(p.x-radarPanX)*sc, pz=cY+(p.z-radarPanZ)*sc, d=(mx-px)*(mx-px)+(my-pz)*(my-pz);
      if(d<bd){bd=d;best=p;}
    }
  }
  return best ? {type:'player', player: best} : null;
}

function _startAnim(){
  if(radarAnimId)return;
  (function l(){
    radarAnimId=requestAnimationFrame(function(){
      drawRadar();
      if(radarTimeIdx===-1)l();
      else radarAnimId=0;
    });
  })();
}
function _stopAnim(){if(radarAnimId){cancelAnimationFrame(radarAnimId);radarAnimId=0;}}

function _selectPlayer(name){
  rSel=name;rFollow=!!name;drawRadar();
  if(!name)_stopAnim();
  else if(radarTimeIdx>=0)_startAnim();
}

var _radarRangeHours=12; // current range (hours)
var _RANGE_LABELS={2:'2j lalu',12:'12j lalu',24:'1 hari lalu',168:'7 hari lalu'};
async function fetchRadarHistory(hours){
  if(hours!==undefined)_radarRangeHours=hours;
  // [SRE] Circuit breaker: 3 fail berturut - freeze 5 menit.
  if(_radarHistFreeze&&Date.now()<_radarHistFreeze)return;
  try{
    var ms=_radarRangeHours*3600000;
    var since=new Date(Date.now()-ms).toISOString();
    // Scale limit: more hours = more rows, cap at 2016 (enough for 7 days @ 5min interval)
    var limit=Math.min(2016,Math.max(50,Math.round(_radarRangeHours*12)));
    var _srvFilter=(_servers[_currentIdx]&&_servers[_currentIdx].server_id)?'&server_id=eq.'+_servers[_currentIdx].server_id:'';
    var ctrl=new AbortController(),tm=setTimeout(function(){ctrl.abort();},15000);
    // order=ts.desc so we always get the NEWEST rows first, then reverse client-side
    var d=null;
    if(limit>1000){
      var r1=await fetch(SB_URL+'/rest/v1/metrics_history?ts=gte.'+since+'&order=ts.desc&limit=1000&select=ts,pos'+_srvFilter,{headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY},signal:ctrl.signal});
      var d1=await r1.json();
      if(Array.isArray(d1)) {
        d=d1;
        if(d1.length===1000){
          var remain=limit-1000;
          var r2=await fetch(SB_URL+'/rest/v1/metrics_history?ts=gte.'+since+'&order=ts.desc&limit='+remain+'&offset=1000&select=ts,pos'+_srvFilter,{headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY},signal:ctrl.signal});
          var d2=await r2.json();
          if(Array.isArray(d2)) d=d.concat(d2);
        }
      }
    }else{
      var r=await fetch(SB_URL+'/rest/v1/metrics_history?ts=gte.'+since+'&order=ts.desc&limit='+limit+'&select=ts,pos'+_srvFilter,{headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY},signal:ctrl.signal});
      d=await r.json();
    }
    clearTimeout(tm);
    if(Array.isArray(d)){
      _radarHistFails=0;_radarHistFreeze=0;_setRadarHistError('');
      // Reverse to chronological order (oldest first)
      d.reverse();
      radarHistory=d.map(function(row){var o={ts:row.ts,_pos:[]};try{o._pos=typeof row.pos==='string'?JSON.parse(row.pos):(Array.isArray(row.pos)?row.pos:[]);}catch(e){}return o;});
      // Reset slider to Live mode
      var sl=$('radar-timeline');if(sl){sl.max=radarHistory.length;sl.value=radarHistory.length;}
      radarTimeIdx=-1; // force Live mode
      _stopAnim();
      // Update left label
      var rl=$('radar-range-label');if(rl)rl.textContent=_RANGE_LABELS[_radarRangeHours]||_radarRangeHours+'j lalu';
      _computeExp();_hmDirty=true;
      drawRadar();
    }
  }catch(e){
    _radarHistFails++;
    if(_radarHistFails>=3){_radarHistFreeze=Date.now()+300000;_setRadarHistError('Data peta tidak tersedia, retry 5 menit lagi.');}
    else _setRadarHistError('Data peta gagal dimuat, mencoba ulang...');
  }
}
var _radarHistFails=0,_radarHistFreeze=0;
function _setRadarHistError(msg){
  var card=$('player-details-card');if(!card)return;
  var b=$('radar-hist-error');
  if(!msg){if(b)b.style.display='none';return;}
  if(!b){
    b=document.createElement('div');b.id='radar-hist-error';
    b.style.cssText='margin-top:6px;padding:5px 8px;border-radius:4px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.25);color:#f87171;font-family:JetBrains Mono,monospace;font-size:.5rem;text-align:center';
    var wrap=$('radar-wrap');if(wrap&&wrap.parentNode)wrap.parentNode.insertBefore(b,wrap.nextSibling);
  }
  b.textContent=msg;b.style.display='block';
}

(function(){
  var dt=$('radar-dim-tabs');
  if(dt)dt.addEventListener('click',function(e){var t=e.target.closest('.tab');if(!t)return;dt.querySelectorAll('.tab').forEach(function(b){b.classList.remove('a');});t.classList.add('a');radarDim=t.dataset.dim;drawRadar();});
  // [FILTER] Hook radar filter UI — restore state, persist on change
  var _rfPersist=function(){try{localStorage.setItem('lt_radar_filters',JSON.stringify(_rfState));}catch(e){}};
  var _rfBindCheck=function(id,key){
    var el=$(id);if(!el)return;
    el.checked=!!_rfState[key];
    if(el.checked) el.parentElement.classList.add('active'); else el.parentElement.classList.remove('active');
    el.addEventListener('change',function(){
      _rfState[key]=el.checked;
      if(el.checked) el.parentElement.classList.add('active'); else el.parentElement.classList.remove('active');
      if(key.indexOf('hm')===0) window._hmDirty = true;
      _rfPersist();drawRadar();
    });
  };
  _rfBindCheck('rf-afk','afk');
  _rfBindCheck('rf-pvp','pvp');
  _rfBindCheck('rf-expiring','expiring');
  _rfBindCheck('rf-cluster','cluster');
  _rfBindCheck('rf-hide-player','hidePlayer');
  _rfBindCheck('rf-hm-hostile','hmHostile');
  _rfBindCheck('rf-hm-passive','hmPassive');
  _rfBindCheck('rf-hm-item','hmItem');
  _rfBindCheck('rf-hm-other','hmOther');
  
  // Bind Mode Ringan UI
  var pmc=$('perf-mode-check');
  if(pmc){
    pmc.checked=!!_perfMode;
    pmc.addEventListener('change',function(){
      _perfMode=pmc.checked;
      try{localStorage.setItem('lt_perf_mode',_perfMode?'1':'0');}catch(e){}
      window._hmDirty=true;
      
      // Auto-toggle atmospheric rain intensity (perfMode = lower intensity, NOT disabled)
      var atmoCard = document.querySelector('.atmo-card');
      if(atmoCard && typeof _atmoLoadState === 'function') {
         var atmoState = _atmoLoadState();
         if(atmoState && atmoState.wx) {
            _atmoCanvasSync(atmoCard, atmoState.wx);
         }
      }
      if(_perfMode) {
         window._radarParticles = [];
      }
      
      drawRadar();
    });
  }
  
  var hmfBtn=$('hm-f-btn'), hmfPanel=$('hm-f-panel'), hmfClose=$('hm-f-close');
  if(hmfBtn&&hmfPanel){
    hmfBtn.addEventListener('click',function(e){ e.stopPropagation(); hmfPanel.style.display=hmfPanel.style.display==='none'?'block':'none'; });
    if(hmfClose) hmfClose.addEventListener('click',function(e){ e.stopPropagation(); hmfPanel.style.display='none'; });
    hmfPanel.addEventListener('click',function(e){ e.stopPropagation(); });
    document.addEventListener('click',function(e){ if(!hmfPanel.contains(e.target) && !hmfBtn.contains(e.target)) hmfPanel.style.display='none'; });
  }
  
  var csWrap = $('hm-type-wrap'), csVal = $('hm-type-val'), csList = $('hm-type-list'), rft = $('rf-hm-type'), csText = $('hm-type-text');
  if(csWrap && csVal && csList && rft && csText) {
    // Restore saved value
    var savedVal = _rfState.hmType || '';
    rft.value = savedVal;
    if(savedVal) csText.innerHTML = savedVal.replace(/_/g,' ');
    
    csVal.addEventListener('click', function(e){
      e.stopPropagation();
      csWrap.classList.toggle('open');
    });
    
    csList.addEventListener('click', function(e){
      var opt = e.target.closest('.cs-opt');
      if(!opt) return;
      e.stopPropagation();
      
      var val = opt.getAttribute('data-val') || '';
      var html = opt.innerHTML;
      if(val==='') html = '-- Semua Tipe --';
      else html = html.split('<span')[0]; // strip count
      
      rft.value = val;
      csText.innerHTML = html;
      
      var allOpts = csList.querySelectorAll('.cs-opt');
      for(var j=0; j<allOpts.length; j++) allOpts[j].classList.remove('active');
      opt.classList.add('active');
      
      csWrap.classList.remove('open');
      
      _rfState.hmType = val;
      window._hmDirty = true;
      _rfPersist(); drawRadar();
    });
    
    document.addEventListener('click', function(e){
      if(!csWrap.contains(e.target)) csWrap.classList.remove('open');
    });
  }

  var rfo=$('rf-owner');
  if(rfo){
    rfo.value=_rfState.owner||'';
    var _rfoTm=0;
    rfo.addEventListener('input',function(){_rfState.owner=rfo.value;clearTimeout(_rfoTm);_rfoTm=setTimeout(function(){_rfPersist();drawRadar();},150);});
  }
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
    cv.addEventListener('mousemove', function(e){
      if(radarDrag) return;
      var r = cv.getBoundingClientRect();
      window._radarMouseX = e.clientX - r.left;
      window._radarMouseY = e.clientY - r.top;
      if(!radarRaf){ radarRaf = requestAnimationFrame(function(){ drawRadar(); radarRaf=0; }); }
    });
    cv.addEventListener('mouseleave', function(){ 
      window._radarMouseX = undefined; 
      if(!radarRaf){ radarRaf = requestAnimationFrame(function(){ drawRadar(); radarRaf=0; }); } 
    });
    // Double-click to zoom into clicked area
    cv.addEventListener('dblclick',function(e){
      e.preventDefault();
      if(rSel && rFollow) {
        radarZoom=Math.max(50,Math.round(radarZoom/3));
        drawRadar();
        return;
      }
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
    cv.addEventListener('mousedown',function(e){if(Date.now()-window._lastTouchT<500)return;_clickStart={x:e.clientX,y:e.clientY,t:Date.now()};radarDrag=true;_radarInteracting=true;cv.style.cursor='move';radarDragStart={x:e.clientX,z:e.clientY,px:radarPanX,pz:radarPanZ};});
    window.addEventListener('mousemove',function(e){if(!radarDrag||Date.now()-window._lastTouchT<500)return;var sc=Math.min(parseInt(cv.style.width)||600,parseInt(cv.style.height)||400)/(radarZoom*2);radarPanX=radarDragStart.px-(e.clientX-radarDragStart.x)/sc;radarPanZ=radarDragStart.pz-(e.clientY-radarDragStart.z)/sc;rFollow=false;if(!radarRaf){radarRaf=requestAnimationFrame(function(){drawRadar();radarRaf=0;});}});
    window.addEventListener('mouseup',function(e){if(!radarDrag||Date.now()-window._lastTouchT<500)return;radarDrag=false;_radarInteracting=false;_interactEnd=Date.now();cv.style.cursor='default';var dx=e.clientX-_clickStart.x,dy=e.clientY-_clickStart.y;if(Math.abs(dx)<10&&Math.abs(dy)<10&&Date.now()-_clickStart.t<400){var hit=_rHit(cv,e);if(hit){if(hit.type==='cluster'){window._clickedCluster=hit.cluster;_selectPlayer(null);}else if(hit.type==='cluster_close'){window._clickedCluster=null;}else if(hit.type==='player'){window._clickedCluster=null;_selectPlayer(hit.player.name);window._lastSelT=Date.now();}}else{window._clickedCluster=null;if(Date.now()-(window._lastSelT||0)>400)_selectPlayer(null);}}drawRadar();});
    cv.addEventListener('wheel',function(e){e.preventDefault();_radarInteracting=true;radarZoom=e.deltaY>0?Math.min(10000,radarZoom*1.3):Math.max(50,radarZoom/1.3);radarZoom=Math.round(radarZoom);rFollow=false;clearTimeout(window._wheelEnd);window._wheelEnd=setTimeout(function(){_radarInteracting=false;_interactEnd=Date.now();drawRadar();},200);if(!radarRaf){radarRaf=requestAnimationFrame(function(){drawRadar();radarRaf=0;});}},{passive:false});
    var rPinch={a:false,d0:0,z0:0};
    function _td(ts){var dx=ts[0].clientX-ts[1].clientX,dy=ts[0].clientY-ts[1].clientY;return Math.sqrt(dx*dx+dy*dy);}
    var _tStart={x:0,y:0,t:0};
    cv.addEventListener('touchstart',function(e){_radarInteracting=true;if(e.touches.length===2){e.preventDefault();radarDrag=false;rPinch.a=true;rPinch.d0=_td(e.touches);rPinch.z0=radarZoom;}else if(e.touches.length===1&&!rPinch.a){_tStart={x:e.touches[0].clientX,y:e.touches[0].clientY,t:Date.now()};radarDrag=true;radarDragStart={x:e.touches[0].clientX,z:e.touches[0].clientY,px:radarPanX,pz:radarPanZ};}},{passive:false});
    cv.addEventListener('touchmove',function(e){if(e.touches.length===2&&rPinch.a){e.preventDefault();radarZoom=Math.max(50,Math.min(10000,Math.round(rPinch.z0*(rPinch.d0/_td(e.touches)))));rFollow=false;if(!radarRaf){radarRaf=requestAnimationFrame(function(){drawRadar();radarRaf=0;});}}else if(e.touches.length===1&&radarDrag&&!rPinch.a){e.preventDefault();var t=e.touches[0],sc=Math.min(parseInt(cv.style.width)||600,parseInt(cv.style.height)||400)/(radarZoom*2);radarPanX=radarDragStart.px-(t.clientX-radarDragStart.x)/sc;radarPanZ=radarDragStart.pz-(t.clientY-radarDragStart.z)/sc;rFollow=false;if(!radarRaf){radarRaf=requestAnimationFrame(function(){drawRadar();radarRaf=0;});}}},{passive:false});
    var _lastTap=0;
    cv.addEventListener('touchend',function(e){window._lastTouchT=Date.now();if(e.touches.length<2)rPinch.a=false;if(e.touches.length===0){radarDrag=false;_radarInteracting=false;_interactEnd=Date.now();if(e.changedTouches.length===1){var ct=e.changedTouches[0],dx=ct.clientX-_tStart.x,dy=ct.clientY-_tStart.y;var now=Date.now();
      if(Math.abs(dx)<20&&Math.abs(dy)<20&&now-_tStart.t<500){
        if(now-_lastTap<400){
          if(rSel && rFollow) { radarZoom=Math.max(50,Math.round(radarZoom/3)); drawRadar(); } 
          else {
            var r=cv.getBoundingClientRect(),mx=ct.clientX-r.left,my=ct.clientY-r.top,cW=parseInt(cv.style.width)||600,cH=parseInt(cv.style.height)||400,sc=Math.min(cW,cH)/(radarZoom*2);
            radarPanX=radarPanX+(mx-cW/2)/sc;radarPanZ=radarPanZ+(my-cH/2)/sc;radarZoom=Math.max(50,Math.round(radarZoom/3));rFollow=false;drawRadar();
          }
          _lastTap=0;
        }else{
          var hit=_rHit(cv,ct);
          if(hit){
            if(hit.type==='cluster'){window._clickedCluster=hit.cluster;_selectPlayer(null);}
            else if(hit.type==='cluster_close'){window._clickedCluster=null;}
            else if(hit.type==='player'){window._clickedCluster=null;_selectPlayer(hit.player.name);window._lastSelT=now;}
          }else{
            window._clickedCluster=null;
            if(now-(window._lastSelT||0)>400)_selectPlayer(null);
          }
          _lastTap=now;
          drawRadar();
        }
      }else{_lastTap=0;}
    }}},{passive:true});
  }
  var _BULAN=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  function _fmtTimeLabel(ts){
    var t=new Date(ts);
    var hh=String(t.getHours()).padStart(2,'0');
    var mm=String(t.getMinutes()).padStart(2,'0');
    var time=hh+':'+mm;
    // Show date if range > 12 hours
    if(_radarRangeHours>12){
      return t.getDate()+' '+_BULAN[t.getMonth()]+', '+time;
    }
    return time+' WIB';
  }
  var tl=$('radar-timeline');
  if(tl)tl.addEventListener('input',function(){
    _radarInteracting=true;
    clearTimeout(window._timelineEnd);
    window._timelineEnd=setTimeout(function(){
      _radarInteracting=false;
      _interactEnd=Date.now();
      drawRadar();
    },150);

    var v=parseInt(tl.value),lb=$('radar-time-label');
    if(v>=radarHistory.length){
      radarTimeIdx=-1;_stopAnim();
      if(lb)lb.textContent='Live';
      _startAnim();
    }else{
      radarTimeIdx=v;
      if(lb&&radarHistory[v]){
        lb.textContent=_fmtTimeLabel(radarHistory[v].ts)+' ('+( v+1)+'/'+radarHistory.length+')';
      }
      _stopAnim();
    }
    if(!radarRaf){
      radarRaf=requestAnimationFrame(function(){
        drawRadar();
        radarRaf=0;
      });
    }
  });
  var sb=$('radar-step-back'),sf=$('radar-step-fwd'),_hId=0,_hDelay=0,_hCnt=0;
  function _stepDir(dir){var s=$('radar-timeline');if(!s)return;s.value=dir<0?Math.max(0,parseInt(s.value)-1):Math.min(parseInt(s.max)||radarHistory.length,parseInt(s.value)+1);s.dispatchEvent(new Event('input'));}
  function _hStart(dir){_stepDir(dir);_hDelay=setTimeout(function(){_hCnt=0;_hId=setInterval(function(){_hCnt++;_stepDir(dir);if(_hCnt===5){clearInterval(_hId);_hId=setInterval(function(){_stepDir(dir);},50);}},150);},400);}
  function _hStop(){if(_hDelay){clearTimeout(_hDelay);_hDelay=0;}if(_hId){clearInterval(_hId);_hId=0;}}
  if(sb){sb.addEventListener('mousedown',function(e){e.preventDefault();_hStart(-1);});sb.addEventListener('touchstart',function(e){e.preventDefault();_hStart(-1);},{passive:false});}
  if(sf){sf.addEventListener('mousedown',function(e){e.preventDefault();_hStart(1);});sf.addEventListener('touchstart',function(e){e.preventDefault();_hStart(1);},{passive:false});}
  window.addEventListener('mouseup',_hStop);window.addEventListener('touchend',_hStop);
  // [AUTOPLAY] Cycle speed: 1× → 2× → 4× → off. Step 1 frame per 500ms / speed.
  // rAF-based scheduling supaya pause otomatis saat tab hidden.
  var _playSpeeds=[0,1,2,4],_playIdx=0,_playRaf=0,_playLastT=0;
  function _playStop(){if(_playRaf){cancelAnimationFrame(_playRaf);_playRaf=0;}_playLastT=0;}
  function _playLoop(now){
    if(!_playSpeeds[_playIdx]){_playRaf=0;return;}
    if(document.hidden){_playRaf=requestAnimationFrame(_playLoop);return;}
    var stepMs=500/_playSpeeds[_playIdx];
    if(!_playLastT)_playLastT=now;
    if(now-_playLastT>=stepMs){
      _playLastT=now;
      var s=$('radar-timeline');
      if(s){
        var v=parseInt(s.value),mx=parseInt(s.max)||radarHistory.length;
        v++;if(v>mx)v=0; // loop
        s.value=v;s.dispatchEvent(new Event('input'));
      }
    }
    _playRaf=requestAnimationFrame(_playLoop);
  }
  var pb=$('radar-play');
  if(pb)pb.addEventListener('click',function(){
    _playIdx=(_playIdx+1)%_playSpeeds.length;
    var sp=_playSpeeds[_playIdx];
    pb.textContent=sp?'\u25b6 '+sp+'\u00d7':'\u23f8 Off';
    pb.className='tab'+(sp?' a':'');
    if(sp){if(!_playRaf)_playRaf=requestAnimationFrame(_playLoop);}
    else _playStop();
  });
  // Range tab handler
  var rt=$('radar-range-tabs');
  if(rt)rt.addEventListener('click',function(e){
    var btn=e.target.closest('[data-hours]');if(!btn)return;
    rt.querySelectorAll('.tab').forEach(function(b){b.classList.remove('a');});
    btn.classList.add('a');
    var h=parseInt(btn.dataset.hours)||12;
    fetchRadarHistory(h);
  });
  fetchRadarHistory();
  setInterval(function(){fetchRadarHistory();},300000);
})();

/* ═══ Land Claims Panel ═══ */
var _expCollapsed=true,_expLastHash='';
(function(){
  var tog=$('land-exp-toggle');
  if(tog)tog.addEventListener('click',function(){
    _expCollapsed=!_expCollapsed;
    var body=$('land-exp-body'),chev=$('land-exp-chevron'),sum=$('land-exp-summary');
    if(body)body.classList.toggle('collapsed',_expCollapsed);
    if(chev)chev.style.transform=_expCollapsed?'':'rotate(180deg)';
    if(sum)sum.style.display=_expCollapsed?'':'none';
  });
})();
function _renderExpPanel(){
  var card=$('land-expiry-card'),tbody=$('land-exp-tbody'),cnt=$('land-exp-count'),info=$('land-exp-info');
  if(!card||!tbody)return;
  if(!radarLands||!radarLands.length){card.style.display='none';return;}
  // Collect ALL valid lands
  var items=[];
  for(var i=0;i<radarLands.length;i++){
    var l=radarLands[i];if(!l||l.x1==null)continue;
    items.push(l);
  }
  if(!items.length){card.style.display='none';return;}
  // Sort: highest di first (most urgent), unknowns (-1) at bottom
  items.sort(function(a,b){
    var da=typeof a.di==='number'?a.di:-1,db=typeof b.di==='number'?b.di:-1;
    if(da===-1&&db===-1)return 0;
    if(da===-1)return 1;
    if(db===-1)return -1;
    return db-da;
  });
  // Diff check — avoid re-render if data unchanged
  var hash=items.length+'|'+items.map(function(l){return l.n+(l.di||'');}).join(',');
  if(hash===_expLastHash)return;
  _expLastHash=hash;
  card.style.display='';
  // Count at-risk lands (7d+)
  var atRisk=0;
  for(var i=0;i<items.length;i++){var d=typeof items[i].di==='number'?items[i].di:-1;if(d>=7)atRisk++;}
  if(cnt){cnt.textContent=items.length;cnt.className='pill '+(atRisk>0?'r':'g');cnt.style.fontSize='.42rem';}
  // Inline summary (visible when collapsed)
  var sum=$('land-exp-summary');
  if(sum){
    if(atRisk>0)sum.textContent=atRisk+' at risk';
    else sum.textContent='all safe';
    sum.style.display=_expCollapsed?'':'none';
  }
  var DIM_LABEL={o:'OW',n:'N',t:'END'};
  var html='';
  for(var i=0;i<items.length;i++){
    var l=items[i],di=typeof l.di==='number'?l.di:-1;
    var stClass,stLabel,diText,diColor;
    if(di===-1){stClass='st-ok';stLabel='NO DATA';diText='--';diColor='var(--mute)';}
    else if(di>=14){stClass='st-dead';stLabel='CLEAN';diText=di+'d';diColor='#f87171';}
    else if(di>=10){stClass='st-crit';stLabel='EXPIRING';diText=di+'d';diColor='#f87171';}
    else if(di>=7){stClass='st-warn';stLabel='WARNING';diText=di+'d';diColor='#fb923c';}
    else if(di>=5){stClass='st-ok';stLabel='WATCH';diText=di+'d';diColor='var(--dim)';}
    else{stClass='st-ok';stLabel='ACTIVE';diText=di+'d';diColor='#34d399';}
    var x1=Math.min(l.x1,l.x2),z1=Math.min(l.z1,l.z2),x2=Math.max(l.x1,l.x2),z2=Math.max(l.z1,l.z2);
    var dim=DIM_LABEL[l.d]||'OW';
    html+='<tr data-lx="'+((x1+x2)/2)+'" data-lz="'+((z1+z2)/2)+'" data-ld="'+(l.d||'o')+'" style="cursor:pointer">';
    html+='<td class="exp-name">'+esc(l.n)+'</td>';
    html+='<td class="exp-owner">'+esc(l.o)+'</td>';
    html+='<td style="color:'+diColor+'">'+diText+'</td>';
    html+='<td><span class="exp-st '+stClass+'">'+stLabel+'</span></td>';
    html+='<td class="exp-pos">'+dim+' '+x1+','+z1+'</td>';
    html+='</tr>';
  }
  tbody.innerHTML=html;
  if(info){
    if(atRisk>0)info.textContent=items.length+' total \u00b7 '+atRisk+' at risk \u00b7 auto-clean: 14d';
    else info.textContent=items.length+' land'+(items.length>1?'s':'')+' claimed \u00b7 auto-clean: 14d inactive';
  }
  // Click row → navigate radar to that land
  tbody.querySelectorAll('tr').forEach(function(tr){
    tr.addEventListener('click',function(){
      var lx=parseFloat(tr.dataset.lx)||0,lz=parseFloat(tr.dataset.lz)||0,ld=tr.dataset.ld||'o';
      var dimFull=DIM_SHORT[ld]||'overworld';
      if(dimFull!==radarDim){
        radarDim=dimFull;
        var dt=$('radar-dim-tabs');
        if(dt)dt.querySelectorAll('.tab').forEach(function(b){b.classList.remove('a');if(b.dataset.dim===dimFull)b.classList.add('a');});
      }
      radarPanX=lx;radarPanZ=lz;
      radarZoom=Math.min(radarZoom,200);
      rFollow=false;rSel=null;
      drawRadar();
      var cv=$('radar-canvas');
      if(cv)cv.scrollIntoView({behavior:'smooth',block:'center'});
    });
  });
}

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
  // [A11Y+PERF] rAF loop replaces setInterval(67ms). Browser auto-pauses rAF when
  // tab hidden, dan honor prefers-reduced-motion (sonar pulse jadi statis).
  function _hmAnimLoop(){
    if(_hmAnimId)return;
    var loop=function(){
      if(!_hmOn){_hmAnimId=0;return;}
      // rAF tidak fire saat tab hidden — tapi jaga safety: skip frame manual juga.
      if(!document.hidden&&!_reduceMotion)drawRadar();
      _hmAnimId=requestAnimationFrame(loop);
    };
    _hmAnimId=requestAnimationFrame(loop);
  }
  // Update reduce-motion preference if user changes OS setting mid-session
  if(window.matchMedia){
    var mq=window.matchMedia('(prefers-reduced-motion: reduce)');
    var onMQ=function(e){_reduceMotion=e.matches;if(_reduceMotion&&_hmAnimId){cancelAnimationFrame(_hmAnimId);_hmAnimId=0;drawRadar();}};
    if(mq.addEventListener)mq.addEventListener('change',onMQ);else if(mq.addListener)mq.addListener(onMQ);
  }
  if(hmc)hmc.addEventListener('change',function(){
    _hmOn=hmc.checked;drawRadar();
    if(_hmOn&&!_hmAnimId&&!_reduceMotion)_hmAnimLoop();
    if(!_hmOn&&_hmAnimId){cancelAnimationFrame(_hmAnimId);_hmAnimId=0;}
  });
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
  var tps=m.tps||0,mobs=m.mobs?m.mobs.total:0,items=m.items?m.items.total:0,dp=m.dp_pct!==undefined?m.dp_pct:(_lastDP?_lastDP.pct:0);
  var h=Math.round((Math.min(tps/20,1)*0.4+Math.max(0,1-mobs/500)*0.25+Math.max(0,1-items/300)*0.15+Math.max(0,1-dp/100)*0.2)*100);
  h=Math.max(0,Math.min(100,h));
  var se=$('health-score'),de=$('health-desc'),fe=$('gauge-fill');
  if(se){se.textContent=h+'%';se.style.color=h>=80?'var(--green)':h>=50?'var(--gold)':'var(--red)';}
  if(de){de.textContent=h>=90?'Excellent \u2014 Server optimal':h>=75?'Good \u2014 Performa baik':h>=50?'Fair \u2014 Ada tekanan':'Poor \u2014 Server lag berat';}
  if(fe){fe.setAttribute('stroke-dashoffset',100-h);fe.setAttribute('stroke',h>=80?'var(--green)':h>=50?'var(--gold)':'var(--red)');}
}

/* ═══ Feature 19: Entity Budget Gauge ═══
 * Per-dimension mob gauge showing usage vs budget threshold.
 * 100% client-side — uses m.mobs data already in applyBDSMetrics.
 * Standards §5.2: UPPER_SNAKE_CASE constants, _prefix internal vars.
 * Standards §1.2: No extra API calls, O(1) per render.
 */
var _ENT_BUDGET={overworld:400,nether:200,the_end:150};
var _ENT_BUDGET_LABELS={overworld:'Overworld',nether:'Nether',the_end:'The End'};
var _ENT_BUDGET_COLORS={overworld:'#34d399',nether:'#fb923c',the_end:'#a855f7'};
var _entBudgetLastHash='';

function _renderEntBudget(m){
  var el=$('ent-budget-gauges'),pill=$('ent-budget-pill'),tipEl=$('ent-budget-tip');
  if(!el||!m||!m.mobs)return;
  var dims=['overworld','nether','the_end'];
  // [FIX] Guard: skip if all values are 0/undefined (data not yet loaded)
  var anyData=false;
  var hash=dims.map(function(d){var v=m.mobs[d]||0;if(v>0)anyData=true;return v;}).join(',');
  if(hash===_entBudgetLastHash)return;
  _entBudgetLastHash=hash;

  var totalMobs=m.mobs.total||0;
  var totalBudget=_ENT_BUDGET.overworld+_ENT_BUDGET.nether+_ENT_BUDGET.the_end;
  var overallPct=Math.round(totalMobs/totalBudget*100);

  // Pill status
  if(pill){
    var maxDimPct=0;
    for(var i=0;i<dims.length;i++){
      var dp=Math.round((m.mobs[dims[i]]||0)/_ENT_BUDGET[dims[i]]*100);
      if(dp>maxDimPct)maxDimPct=dp;
    }
    if(maxDimPct>=90){pill.textContent='KRITIS';pill.className='pill r';}
    else if(maxDimPct>=70){pill.textContent='WASPADA';pill.className='pill y';}
    else{pill.textContent='AMAN';pill.className='pill g';}
  }

  var html='';
  for(var i=0;i<dims.length;i++){
    var d=dims[i],count=m.mobs[d]||0,budget=_ENT_BUDGET[d];
    var pct=Math.min(Math.round(count/budget*100),100);
    var cls=pct>=90?'crit':pct>=70?'warn':'safe';
    html+='<div class="ent-budget-row">';
    html+='<span class="ent-budget-label" style="color:'+_ENT_BUDGET_COLORS[d]+'">'+_ENT_BUDGET_LABELS[d]+'</span>';
    html+='<div class="ent-budget-track"><div class="ent-budget-bar '+cls+'" style="width:'+pct+'%"></div></div>';
    html+='<span class="ent-budget-val '+cls+'">'+fmtN(count)+' / '+fmtN(budget)+'</span>';
    html+='</div>';
  }
  el.innerHTML=html;

  // Tip: actionable advice based on worst dimension
  if(tipEl){
    var worst=null,worstPct=0;
    for(var i=0;i<dims.length;i++){
      var dp2=Math.round((m.mobs[dims[i]]||0)/_ENT_BUDGET[dims[i]]*100);
      if(dp2>worstPct){worstPct=dp2;worst=dims[i];}
    }
    if(worstPct>=90)tipEl.textContent=_ENT_BUDGET_LABELS[worst]+' mob '+worstPct+'% kapasitas! Jalankan Mob Cleaner segera.';
    else if(worstPct>=70)tipEl.textContent=_ENT_BUDGET_LABELS[worst]+' mendekati batas ('+worstPct+'%). Pantau lebih ketat.';
    else tipEl.textContent='Semua dimensi dalam batas aman. Budget total: '+overallPct+'%.';
  }
}

/* ═══ Feature 20: Lag Prediction Banner ═══
 * Heuristic: analyze last 5 data points from mhData to detect:
 *   1) Rising entity/mob trend (growth rate)
 *   2) Declining TPS trend (slope)
 * Produces a risk score 0-100. Shows banner when score > 40.
 * 100% client-side — uses mhData[] already fetched by fetchMH().
 * Standards §1.3: _lagPredBuf capped at 10.
 * Standards §4.2: Animation pauses on tab hidden + prefers-reduced-motion.
 */
var _LAG_PRED_THRESH_WARN=40,_LAG_PRED_THRESH_CRIT=70;
var _lagPredDismissed=false;
var _lagPredBuf=[];   // last N snapshots {tps,mobs,entities,items,ts}
var _LAG_PRED_BUF_MAX=10;

function _updateLagPrediction(m){
  if(!m||_lagPredDismissed)return;
  // Buffer current snapshot — cap per Standards §1.3
  _lagPredBuf.push({tps:m.tps||0,mobs:m.mobs?m.mobs.total:0,entities:m.entities?m.entities.total:0,items:m.items?m.items.total:0,ts:Date.now()});
  if(_lagPredBuf.length>_LAG_PRED_BUF_MAX)_lagPredBuf.shift();

  // Need at least 3 samples for trend analysis
  if(_lagPredBuf.length<3){_hideLagPredict();return;}

  var n=_lagPredBuf.length;
  // Linear regression: TPS slope (negative = bad)
  var sx=0,sy=0,sxy=0,sx2=0;
  for(var i=0;i<n;i++){sx+=i;sy+=_lagPredBuf[i].tps;sxy+=i*_lagPredBuf[i].tps;sx2+=i*i;}
  var tpsSlope=(n*sxy-sx*sy)/(n*sx2-sx*sx);

  // Entity growth rate (positive = bad)
  var entFirst=_lagPredBuf[0].entities,entLast=_lagPredBuf[n-1].entities;
  var entGrowth=entFirst>0?((entLast-entFirst)/entFirst*100):0;

  // Mob growth rate
  var mobFirst=_lagPredBuf[0].mobs,mobLast=_lagPredBuf[n-1].mobs;
  var mobGrowth=mobFirst>0?((mobLast-mobFirst)/mobFirst*100):0;

  // Item accumulation
  var itemLast=_lagPredBuf[n-1].items;
  var itemScore=Math.min(30,itemLast/5); // 150 items = 30 points

  // Current TPS penalty (already laggy = boost prediction)
  var currentTps=_lagPredBuf[n-1].tps;
  var tpsPenalty=currentTps<15?Math.min(25,(20-currentTps)*5):0;

  // Composite risk score (0-100)
  var risk=0;
  risk+=Math.min(25,Math.max(0,-tpsSlope*15));        // TPS declining: up to 25
  risk+=Math.min(20,Math.max(0,entGrowth*0.8));         // Entity growth: up to 20
  risk+=Math.min(15,Math.max(0,mobGrowth*0.6));         // Mob growth: up to 15
  risk+=itemScore;                                       // Item accumulation: up to 30
  risk+=tpsPenalty;                                      // Current TPS penalty: up to 25
  risk=Math.min(100,Math.round(risk));

  if(risk<_LAG_PRED_THRESH_WARN){_hideLagPredict();return;}

  // Show banner
  var el=$('lag-predict');if(!el)return;
  var isCrit=risk>=_LAG_PRED_THRESH_CRIT;
  el.style.display='flex';
  el.className='lag-predict level-'+(isCrit?'crit':'warn');

  var title=$('lag-predict-title');
  if(title)title.textContent=isCrit?'\u26a0 LAG INCOMING':'\u26a0 PREDIKSI LAG';

  // Build description with specific causes
  var causes=[];
  if(tpsSlope<-0.3)causes.push('TPS turun '+Math.abs(tpsSlope).toFixed(1)+'/sample');
  if(entGrowth>10)causes.push('Entity naik '+Math.round(entGrowth)+'%');
  if(mobGrowth>10)causes.push('Mob naik '+Math.round(mobGrowth)+'%');
  if(itemLast>80)causes.push('Item drops: '+fmtN(itemLast));
  if(currentTps<15)causes.push('TPS saat ini: '+currentTps.toFixed(1));

  var desc=$('lag-predict-desc');
  if(desc)desc.textContent=causes.length?causes.join(' \u00b7 '):'Entity dan mob trending naik, TPS cenderung turun.';

  var fill=$('lag-predict-fill');
  if(fill)fill.style.width=risk+'%';

  // Actionable recommendations
  var acts=$('lag-predict-actions');
  if(acts){
    var recs=[];
    if(mobGrowth>10||mobLast>200)recs.push('\u2022 Jalankan <b>Mob Cleaner</b> (in-game stick menu)');
    if(itemLast>80)recs.push('\u2022 Bersihkan <b>item drops</b> di area farm');
    if(entGrowth>15)recs.push('\u2022 Cek <b>entity hotspot</b> di heatmap');
    if(currentTps<15)recs.push('\u2022 Pertimbangkan <b>restart server</b> jika berlanjut');
    if(!recs.length)recs.push('\u2022 Pantau metrik lebih sering');
    acts.innerHTML=recs.join('<br>');
  }
}

function _hideLagPredict(){
  var el=$('lag-predict');if(el)el.style.display='none';
}

// Dismiss button handler
(function(){
  var btn=$('lag-predict-close');
  if(btn)btn.addEventListener('click',function(){
    _lagPredDismissed=true;_hideLagPredict();
    // Auto-reset dismiss after 5 minutes so it can warn again
    setTimeout(function(){_lagPredDismissed=false;},300000);
  });
})();

/* ═══ Feature 21: TPS Drop Correlation Chart ═══
 * Overlaid multi-line chart: TPS (green) + Players (purple) + Entity (cyan)
 * Red highlight zones where TPS < 15. Tooltip on hover.
 * 100% client-side — uses mhData[] already fetched by fetchMH().
 * Standards §4.2: No shadowBlur, cached gradients.
 * Standards §1.2: O(n) render, n = mhData.length.
 */
var _tpsCorrLastLen=0;
function _drawTpsCorrelation(){
  var cv=$('tps-corr-canvas'),card=$('tps-corr-card');
  if(!cv||!mhData||mhData.length<3){if(card)card.style.display='none';return;}
  if(card)card.style.display='';

  var par=cv.parentElement;
  var W=par?par.clientWidth:600,H=140;
  var dpr=Math.min(window.devicePixelRatio||1,2);
  cv.width=W*dpr;cv.height=H*dpr;
  cv.style.width=W+'px';cv.style.height=H+'px';
  var ctx=cv.getContext('2d');
  ctx.scale(dpr,dpr);

  var pad={l:40,r:12,t:8,b:22};
  var cw=W-pad.l-pad.r,ch=H-pad.t-pad.b;
  var n=mhData.length;

  // Compute ranges
  var tpsMax=0,pMax=0,eMax=0;
  for(var i=0;i<n;i++){
    var r=mhData[i];
    if((r.tps||0)>tpsMax)tpsMax=r.tps;
    if((r.players||0)>pMax)pMax=r.players;
    if((r.entities||0)>eMax)eMax=r.entities;
  }
  tpsMax=Math.max(tpsMax,20);pMax=Math.max(pMax,1);eMax=Math.max(eMax,1);

  // Helper: x position for data index
  function xAt(i){return pad.l+cw*(i/(n-1));}
  function yTps(v){return pad.t+ch*(1-Math.min(v/tpsMax,1));}
  function yPly(v){return pad.t+ch*(1-Math.min(v/pMax,1));}
  function yEnt(v){return pad.t+ch*(1-Math.min(v/eMax,1));}

  // ── Draw TPS drop zones (red areas where TPS < 15) ──
  ctx.fillStyle='rgba(248,113,113,.06)';
  var inDrop=false,dropStart=0;
  for(var i=0;i<n;i++){
    var tps=mhData[i].tps||0;
    if(tps<15&&!inDrop){inDrop=true;dropStart=xAt(i);}
    if((tps>=15||i===n-1)&&inDrop){
      inDrop=false;
      var dropEnd=xAt(i);
      ctx.fillRect(dropStart,pad.t,dropEnd-dropStart,ch);
      // Red dashed borders
      ctx.strokeStyle='rgba(248,113,113,.15)';ctx.lineWidth=1;ctx.setLineDash([3,3]);
      ctx.beginPath();ctx.moveTo(dropStart,pad.t);ctx.lineTo(dropStart,pad.t+ch);ctx.stroke();
      ctx.beginPath();ctx.moveTo(dropEnd,pad.t);ctx.lineTo(dropEnd,pad.t+ch);ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ── Threshold line at TPS 15 ──
  var y15=yTps(15);
  ctx.strokeStyle='rgba(248,113,113,.2)';ctx.lineWidth=0.5;ctx.setLineDash([4,4]);
  ctx.beginPath();ctx.moveTo(pad.l,y15);ctx.lineTo(pad.l+cw,y15);ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle='rgba(248,113,113,.4)';ctx.font='600 8px JetBrains Mono,monospace';
  ctx.textAlign='left';ctx.textBaseline='bottom';
  ctx.fillText('TPS 15',pad.l+2,y15-2);

  // ── Draw lines: Entity (bottom), Players (middle), TPS (top) ──
  var series=[
    {key:'entities',color:'rgba(34,211,238,.5)',fill:'rgba(34,211,238,.05)',yFn:yEnt},
    {key:'players',color:'rgba(168,85,247,.6)',fill:'rgba(168,85,247,.06)',yFn:yPly},
    {key:'tps',color:'#34d399',fill:'rgba(52,211,153,.08)',yFn:yTps}
  ];

  for(var si=0;si<series.length;si++){
    var s=series[si];
    // Fill area
    ctx.beginPath();
    for(var i=0;i<n;i++){var x=xAt(i),y=s.yFn(mhData[i][s.key]||0);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
    ctx.lineTo(xAt(n-1),pad.t+ch);ctx.lineTo(xAt(0),pad.t+ch);ctx.closePath();
    ctx.fillStyle=s.fill;ctx.fill();
    // Line
    ctx.beginPath();ctx.strokeStyle=s.color;ctx.lineWidth=1.5;ctx.lineJoin='round';
    for(var i=0;i<n;i++){var x=xAt(i),y=s.yFn(mhData[i][s.key]||0);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
    ctx.stroke();
  }

  // ── Y-axis labels ──
  ctx.fillStyle='rgba(255,255,255,.2)';ctx.font='8px JetBrains Mono,monospace';
  ctx.textAlign='right';ctx.textBaseline='middle';
  ctx.fillText(Math.round(tpsMax),pad.l-4,pad.t+4);
  ctx.fillText('0',pad.l-4,pad.t+ch);

  // ── X-axis time labels ──
  ctx.textAlign='center';ctx.textBaseline='top';
  var labelCount=Math.min(6,n);
  // [FIX] Guard division by zero when labelCount<=1
  var labelDiv=Math.max(1,labelCount-1);
  for(var i=0;i<labelCount;i++){
    var idx=Math.round(i/labelDiv*(n-1));
    if(idx<0||idx>=n)continue;
    var d=new Date(mhData[idx].ts);
    var lbl=d.getHours()+':'+String(d.getMinutes()).padStart(2,'0');
    ctx.fillText(lbl,xAt(idx),pad.t+ch+4);
  }

  // ── Drop count pill ──
  var dropCount=0;
  for(var i=0;i<n;i++){if((mhData[i].tps||0)<15)dropCount++;}
  var pill=$('tps-corr-pill');
  if(pill){
    if(dropCount>0){pill.textContent=dropCount+' drop';pill.className='pill r';}
    else{pill.textContent='STABIL';pill.className='pill g';}
  }

  // ── Legend ──
  var leg=$('tps-corr-legend');
  if(leg&&_tpsCorrLastLen!==n){
    _tpsCorrLastLen=n;
    leg.innerHTML=
      '<div class="tps-corr-legend-item"><span class="tps-corr-dot" style="background:#34d399"></span>TPS (max '+Math.round(tpsMax)+')</div>'+
      '<div class="tps-corr-legend-item"><span class="tps-corr-dot" style="background:#a855f7"></span>Players (max '+pMax+')</div>'+
      '<div class="tps-corr-legend-item"><span class="tps-corr-dot" style="background:#22d3ee"></span>Entity (max '+fmtN(eMax)+')</div>'+
      '<div class="tps-corr-legend-item"><span class="tps-corr-dot" style="background:rgba(248,113,113,.3)"></span>TPS Drop &lt;15</div>';
  }
}

// Tooltip for TPS Correlation Chart
(function(){
  var cv=$('tps-corr-canvas'),tip=$('tps-corr-tip');
  if(!cv||!tip)return;
  cv.addEventListener('mousemove',function(e){
    if(!mhData||mhData.length<3)return;
    var rect=cv.getBoundingClientRect();
    var W=parseInt(cv.style.width)||600;
    var pad=40,cw=W-pad-12;
    var x=e.clientX-rect.left;
    var idx=Math.round((x-pad)/cw*(mhData.length-1));
    idx=Math.max(0,Math.min(mhData.length-1,idx));
    var r=mhData[idx];if(!r)return;
    var d=new Date(r.ts);
    var time=d.getHours()+':'+String(d.getMinutes()).padStart(2,'0');
    var tps=r.tps||0;
    var lines=[
      '<b>'+time+'</b>',
      '<span style="color:#34d399">TPS: <b>'+tps.toFixed(1)+'</b></span>',
      '<span style="color:#a855f7">Players: <b>'+(r.players||0)+'</b></span>',
      '<span style="color:#22d3ee">Entity: <b>'+fmtN(r.entities||0)+'</b></span>'
    ];
    if(tps<15)lines.push('<span style="color:var(--red);font-weight:600">\u26a0 TPS DROP</span>');
    tip.innerHTML=lines.join('<br>');
    tip.style.display='block';
    var tipX=pad+cw*(idx/(mhData.length-1));
    tip.style.left=Math.min(tipX,W-120)+'px';tip.style.top='4px';
  });
  cv.addEventListener('mouseleave',function(){tip.style.display='none';});
})();

/* ═══ Feature 22: Lag Event Log ═══
 * Detects TPS drops (< 15) in real-time, logs events to localStorage.
 * Shows timestamped severity-coded entries with entity context.
 * Standards §1.3: localStorage capped at 50 entries + 24h TTL.
 * Standards §5.2: _prefix internal, UPPER_SNAKE constants.
 */
var _LAG_LOG_LS_KEY='dwelve_lag_log_v1';
var _LAG_LOG_MAX=50;
var _LAG_LOG_TTL_MS=86400000; // 24 hours
var _lagLogActive=null; // current lag event being tracked {start,minTps,maxEnt,maxMob,maxItem,samples}

function _loadLagLog(){
  try{
    var raw=localStorage.getItem(_LAG_LOG_LS_KEY);
    if(!raw)return[];
    var arr=JSON.parse(raw);
    if(!Array.isArray(arr))return[];
    // Prune entries older than 24h
    var cutoff=Date.now()-_LAG_LOG_TTL_MS;
    return arr.filter(function(e){return e.end>cutoff;});
  }catch(e){return[];}
}

function _saveLagLog(log){
  try{
    // Cap per Standards §1.3
    if(log.length>_LAG_LOG_MAX)log=log.slice(-_LAG_LOG_MAX);
    localStorage.setItem(_LAG_LOG_LS_KEY,JSON.stringify(log));
  }catch(e){}
}

function _trackLagEvent(m){
  var tps=m.tps||0;
  var mobs=m.mobs?m.mobs.total:0;
  var entities=m.entities?m.entities.total:0;
  var items=m.items?m.items.total:0;
  var players=m.players_online||0;

  if(tps<15){
    // Lag is happening
    if(!_lagLogActive){
      _lagLogActive={start:Date.now(),minTps:tps,maxEnt:entities,maxMob:mobs,maxItem:items,maxPlayers:players,samples:1};
    }else{
      _lagLogActive.samples++;
      if(tps<_lagLogActive.minTps)_lagLogActive.minTps=tps;
      if(entities>_lagLogActive.maxEnt)_lagLogActive.maxEnt=entities;
      if(mobs>_lagLogActive.maxMob)_lagLogActive.maxMob=mobs;
      if(items>_lagLogActive.maxItem)_lagLogActive.maxItem=items;
      if(players>_lagLogActive.maxPlayers)_lagLogActive.maxPlayers=players;
    }
  }else if(_lagLogActive){
    // Lag ended — finalize and save
    var durMs=Date.now()-_lagLogActive.start;
    if(durMs>=10000){ // Only log if lag lasted > 10 seconds (avoid blips)
      var log=_loadLagLog();
      log.push({
        start:_lagLogActive.start,
        end:Date.now(),
        dur:durMs,
        minTps:Math.round(_lagLogActive.minTps*10)/10,
        maxEnt:_lagLogActive.maxEnt,
        maxMob:_lagLogActive.maxMob,
        maxItem:_lagLogActive.maxItem,
        maxPlayers:_lagLogActive.maxPlayers,
        samples:_lagLogActive.samples
      });
      _saveLagLog(log);
    }
    _lagLogActive=null;
    _renderLagLog();
  }
}

function _renderLagLog(){
  var list=$('lag-log-list'),countEl=$('lag-log-count');
  if(!list)return;
  var log=_loadLagLog();
  if(countEl)countEl.textContent=log.length;

  if(!log.length){
    list.innerHTML='<div class="lag-log-empty">\u2714 Tidak ada lag event dalam 24 jam terakhir.</div>';
    return;
  }

  // Render newest first
  var html='';
  for(var i=log.length-1;i>=0;i--){
    var ev=log[i];
    var durSec=Math.round(ev.dur/1000);
    var durStr=durSec>=60?Math.round(durSec/60)+' mnt '+durSec%60+'s':durSec+'s';
    var sev=ev.minTps<10?'crit':ev.minTps<13?'warn':'ok';
    var sevLabel=sev==='crit'?'LAG BERAT':sev==='warn'?'LAG':'TPS Rendah';
    var d=new Date(ev.start);
    var timeStr=d.getHours()+':'+String(d.getMinutes()).padStart(2,'0');

    html+='<div class="lag-ev sev-'+sev+'">';
    html+='<div class="lag-ev-dot"></div>';
    html+='<div class="lag-ev-body">';
    html+='<div class="lag-ev-title">'+sevLabel+' \u2014 TPS '+ev.minTps+' ('+durStr+')</div>';
    html+='<div class="lag-ev-detail">';
    html+='Entity: '+fmtN(ev.maxEnt)+' \u00b7 Mob: '+fmtN(ev.maxMob)+' \u00b7 Item: '+fmtN(ev.maxItem);
    if(ev.maxPlayers)html+=' \u00b7 Player: '+ev.maxPlayers;
    html+='</div></div>';
    html+='<div class="lag-ev-time">'+timeStr+'</div>';
    html+='</div>';
  }
  list.innerHTML=html;
}

// Collapsible toggle + clear button
(function(){
  var tog=$('lag-log-toggle'),body=$('lag-log-body'),chev=$('lag-log-chevron');
  if(tog)tog.addEventListener('click',function(){
    var isOpen=!body.classList.contains('collapsed');
    body.classList.toggle('collapsed');
    if(chev)chev.style.transform=isOpen?'':'rotate(180deg)';
    if(!isOpen)_renderLagLog();
  });
  var clr=$('lag-log-clear');
  if(clr)clr.addEventListener('click',function(e){
    e.stopPropagation();
    try{localStorage.removeItem(_LAG_LOG_LS_KEY);}catch(ex){}
    _renderLagLog();
  });
})();
_renderLagLog(); // Initial render

// [FIX] Save partial lag event on tab close to prevent data loss
window.addEventListener('beforeunload',function(){
  if(_lagLogActive&&(Date.now()-_lagLogActive.start)>=10000){
    var log=_loadLagLog();
    log.push({start:_lagLogActive.start,end:Date.now(),dur:Date.now()-_lagLogActive.start,
      minTps:Math.round(_lagLogActive.minTps*10)/10,maxEnt:_lagLogActive.maxEnt,
      maxMob:_lagLogActive.maxMob,maxItem:_lagLogActive.maxItem,
      maxPlayers:_lagLogActive.maxPlayers,samples:_lagLogActive.samples});
    _saveLagLog(log);_lagLogActive=null;
  }
});

/* ═══ Feature 23: Hotspot Recommendation Tooltip ═══
 * On radar click near entity hotspot, show detailed tooltip with:
 *   - Per-chunk entity type breakdown (from BDS 'top' field)
 *   - Danger assessment
 *   - Copy-to-clipboard /kill commands
 * Standards §5.3: Defensive coding with graceful fallback when 'top' not available.
 * Standards §4.2: No heavy rendering, pure DOM tooltip.
 */
var _HOSTILE_TYPES=new Set(['zombie','skeleton','creeper','spider','cave_spider','enderman','witch','slime','drowned','husk','stray','phantom','blaze','ghast','magma_cube','wither_skeleton','hoglin','piglin','piglin_brute','pillager','vindicator','evoker','ravager','vex','bogged','breeze','silverfish','endermite','guardian','elder_guardian','warden','shulker']);
var _PASSIVE_TYPES=new Set(['cow','pig','sheep','chicken','horse','donkey','mule','rabbit','fox','bee','cat','wolf','ocelot','parrot','turtle','dolphin','squid','glow_squid','axolotl','goat','frog','tadpole','allay','sniffer','camel','armadillo','villager','wandering_trader','mooshroom','panda','polar_bear','strider','llama']);
var _hsRecoTimer=0;

function _getEntityClass(type){
  if(_HOSTILE_TYPES.has(type))return'hostile';
  if(_PASSIVE_TYPES.has(type))return'passive';
  if(type==='item'||type==='xp_orb')return'item';
  return'other';
}

function _showHotspotReco(cv,worldX,worldZ,px,pz){
  if(!_hmOn) return false;
  if(!lastMetrics||!lastMetrics.entity_hotspots)return false;
  var hs=lastMetrics.entity_hotspots;
  var DIM_MAP={o:'overworld',n:'nether',e:'the_end'};

  var clickRad = Math.max(32, window.radarZoom / 8);
  var cluster = [];
  var centerH = null;
  var closestDist = Infinity;
  for(var i=0;i<hs.length;i++){
    var h=hs[i];
    var hDim=DIM_MAP[h.d]||'overworld';
    if(hDim!==radarDim)continue;
    var dx=worldX-h.x,dz=worldZ-h.z;
    var dist=Math.sqrt(dx*dx+dz*dz);
    if(dist<clickRad){
      cluster.push(h);
      if(dist<closestDist){closestDist=dist;centerH=h;}
    }
  }
  if(!cluster.length)return false;

  var totalC = 0, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  var aggTop = {};
  for(var i=0;i<cluster.length;i++){
    var h=cluster[i];
    totalC += h.c;
    if(h.x < minX) minX = h.x;
    if(h.x > maxX) maxX = h.x;
    if(h.z < minZ) minZ = h.z;
    if(h.z > maxZ) maxZ = h.z;
    if(h.top && h.top.length){
      for(var m=0;m<h.top.length;m++){
        var parts=h.top[m].split(':');
        var etype=parts[0], ecount=parseInt(parts[1])||0;
        aggTop[etype] = (aggTop[etype] || 0) + ecount;
      }
    }
  }

  var sortedTop = Object.keys(aggTop).map(function(k){ return {t:k, c:aggTop[k]}; });
  sortedTop.sort(function(a,b){ return b.c - a.c; });
  var topArray = sortedTop.map(function(obj){ return obj.t+':'+obj.c; });

  var closest = {
    c: totalC,
    x: cluster.length > 1 ? minX + '..'+maxX : centerH.x,
    z: cluster.length > 1 ? minZ + '..'+maxZ : centerH.z,
    top: topArray,
    isCluster: cluster.length > 1,
    cmdX: centerH.x,
    cmdZ: centerH.z
  };

  var tip=$('hs-reco');if(!tip)return false;

  // Build tooltip
  var avgCount=0;
  for(var i=0;i<hs.length;i++)avgCount+=hs[i].c;
  avgCount=hs.length?Math.round(avgCount/hs.length):0;
  var severity=closest.c>=avgCount*2?'high':closest.c>=avgCount?'medium':'low';
  var sevColor=severity==='high'?'#f87171':severity==='medium'?'#fbbf24':'#34d399';
  var sevText=severity==='high'?'BAHAYA TINGGI':severity==='medium'?'WASPADA':'NORMAL';

  var html='<div class="hs-reco-title"><span style="color:'+sevColor+'">\u25cf</span> Chunk ('+closest.x+', '+closest.z+')</div>';
  html+='<div style="font-size:.42rem;color:var(--mute)">Entity: <b style="color:'+sevColor+'">'+closest.c+'</b> (rata-rata: '+avgCount+')</div>';

  // Entity type breakdown (from BDS 'top' field)
  if(closest.top&&closest.top.length){
    html+='<div class="hs-reco-types">';
    for(var i=0;i<closest.top.length;i++){
      var parts=closest.top[i].split(':');
      var etype=parts[0],ecount=parts[1]||'?';
      var cls=_getEntityClass(etype);
      
      var passesFilter = true;
      var typeFilters = _rfState.hmType ? _rfState.hmType.toLowerCase().split(',').map(function(s){return s.trim();}).filter(Boolean) : [];
      if(typeFilters.length > 0) {
        passesFilter = false;
        for(var t=0; t<typeFilters.length; t++){
          if(etype.indexOf(typeFilters[t]) > -1) { passesFilter = true; break; }
        }
      } else {
        if(cls==='hostile' && !_rfState.hmHostile) passesFilter = false;
        else if(cls==='passive' && !_rfState.hmPassive) passesFilter = false;
        else if(cls==='item' && !_rfState.hmItem) passesFilter = false;
        else if(cls==='other' && !_rfState.hmOther) passesFilter = false;
      }
      
      var opac = passesFilter ? '1' : '0.25';
      html+='<span class="hs-reco-type '+cls+'" style="opacity:'+opac+'; transition: opacity 0.2s;">'+etype.replace(/_/g,' ')+' \u00d7'+ecount+'</span>';
    }
    html+='</div>';
  }else{
    html+='<div style="font-size:.42rem;color:var(--mute);margin:4px 0">Detail tipe entity belum tersedia (update BDS diperlukan).</div>';
  }

  // Recommendations
  html+='<div class="hs-reco-actions">';
  html+='<div style="font-size:.42rem;font-weight:600;color:var(--dim);margin-bottom:3px">\u{1f4a1} REKOMENDASI:</div>';

  if(closest.top&&closest.top.length){
    var topType=closest.top[0].split(':')[0];
    var topCount=parseInt(closest.top[0].split(':')[1])||0;
    if(_HOSTILE_TYPES.has(topType)&&topCount>=5){
      var r = closest.isCluster ? Math.round(clickRad) : 32;
      var cmd='/kill @e[type='+topType+',x='+closest.cmdX+',z='+closest.cmdZ+',r='+r+']';
      html+='<div class="hs-reco-cmd" data-cmd="'+cmd.replace(/"/g,'&quot;')+'" title="Klik untuk copy">\u2022 '+cmd+'</div>';
    }
    if(closest.c>=20){
      html+='<div style="font-size:.42rem;color:var(--mute)">\u2022 Aktifkan Mob Cleaner (stick menu in-game)</div>';
    }
    // Check for items
    for(var i=0;i<closest.top.length;i++){
      if(closest.top[i].startsWith('item:')){
        html+='<div class="hs-reco-cmd" data-cmd="/kill @e[type=item,x='+closest.x+',z='+closest.z+',r=32]" title="Klik untuk copy">\u2022 /kill @e[type=item,...,r=32]</div>';
        break;
      }
    }
  }else{
    if(closest.c>=15)html+='<div style="font-size:.42rem;color:var(--mute)">\u2022 Cek area ini in-game (/tp '+closest.x+' ~ '+closest.z+')</div>';
    if(closest.c>=25)html+='<div style="font-size:.42rem;color:var(--mute)">\u2022 Kemungkinan farm/spawner — pertimbangkan throttle</div>';
  }

  html+='</div>';

  tip.innerHTML=html;
  tip.style.display='block';

  // Position relative to radar-wrap
  var wrap=cv.parentElement;
  var wrapRect=wrap?wrap.getBoundingClientRect():{left:0,top:0};
  var cvRect=cv.getBoundingClientRect();
  var offsetX=cvRect.left-wrapRect.left+px;
  var offsetY=cvRect.top-wrapRect.top+pz;
  var tipW=tip.offsetWidth||200;
  if(offsetX+tipW+8>cv.clientWidth)offsetX=offsetX-tipW-12;
  if(offsetY-28+tip.offsetHeight>cv.clientHeight)offsetY=offsetY-tip.offsetHeight-8;
  tip.style.left=Math.max(4,offsetX+8)+'px';
  tip.style.top=Math.max(4,offsetY-28)+'px';

  clearTimeout(_hsRecoTimer);
  _hsRecoTimer=setTimeout(function(){tip.style.display='none';},8000);

  // [FIX] Use event delegation on parent instead of per-element listeners
  // to prevent listener accumulation on repeated clicks
  tip.onclick=function(e){
    var el=e.target.closest('.hs-reco-cmd[data-cmd]');
    if(!el)return;
    e.stopPropagation();
    var cmd=el.getAttribute('data-cmd');
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(cmd).then(function(){
        el.style.color='var(--green)';
        setTimeout(function(){el.style.color='';},1500);
      });
    }
  };
  tip.style.pointerEvents='auto';

  return true;
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
      
      var filteredCount = 0;
      var typeFilters = _rfState.hmType ? _rfState.hmType.toLowerCase().split(',').map(function(s){return s.trim();}).filter(Boolean) : [];
      if(h.top && h.top.length){
        for(var m=0;m<h.top.length;m++){
          var parts=h.top[m].split(':');
          var etype=parts[0], ecount=parseInt(parts[1])||0;
          
          if(typeFilters.length > 0) {
            // Strict type filtering if types are specified
            var match = false;
            for(var t=0; t<typeFilters.length; t++){
              if(etype.indexOf(typeFilters[t]) > -1) { match = true; break; }
            }
            if(match) filteredCount += ecount;
          } else {
            // Family filtering if no specific types are specified
            var cls=_getEntityClass(etype);
            if(cls==='hostile' && _rfState.hmHostile) filteredCount += ecount;
            else if(cls==='passive' && _rfState.hmPassive) filteredCount += ecount;
            else if(cls==='item' && _rfState.hmItem) filteredCount += ecount;
            else if(cls==='other' && _rfState.hmOther) filteredCount += ecount;
          }
        }
      } else {
        // Fallback if 'top' breakdown is not available from BDS
        if(typeFilters.length === 0 && _rfState.hmHostile && _rfState.hmPassive && _rfState.hmItem && _rfState.hmOther) {
          filteredCount = h.c;
        }
      }
      
      if(filteredCount > 0){
        _hmGrid[k]=(_hmGrid[k]||0)+filteredCount;
        if(_hmGrid[k]>_hmMax)_hmMax=_hmGrid[k];
      }
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
  var sonarPhase=_reduceMotion?0.5:(Date.now()%2400)/2400;
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
    // ── Sonar wave on orange+ (t >= 0.4) — budget-limited, skipped in Mode Ringan ──
    if(t>=0.4&&sonarCount<sonarBudget&&!_perfMode){
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
  var html='<span class="tip-dim">'+worldX+', '+worldZ+'</span>';
  var isLand=false;
  // Check if click is inside a land claim
  if(radarLands&&radarLands.length){
    for(var i=0;i<radarLands.length;i++){
      var l=radarLands[i];if(!l||l.x1==null)continue;
      if((DIM_SHORT[l.d]||'overworld')!==radarDim)continue;
      var x1=Math.min(l.x1,l.x2),x2=Math.max(l.x1,l.x2);
      var z1=Math.min(l.z1,l.z2),z2=Math.max(l.z1,l.z2);
      if(worldX>=x1&&worldX<=x2&&worldZ>=z1&&worldZ<=z2){
        isLand=true;
        html='<b>'+esc(l.n)+'</b>';
        html+='<br><span class="tip-dim">'+esc(l.o)+'</span>';
        var di=typeof l.di==='number'?l.di:-1;
        if(di>=14)html+=' <span class="tip-crit">auto-clean</span>';
        else if(di>=10)html+=' <span class="tip-crit">'+di+'d expiring</span>';
        else if(di>=7)html+=' <span class="tip-warn">'+di+'d inactive</span>';
        else if(di>=0)html+=' <span class="tip-ok">active</span>';
        html+='<br><span class="tip-dim">'+x1+', '+z1+' &rarr; '+x2+', '+z2+'</span>';
        break;
      }
    }
  }
  tip.innerHTML=html;
  tip.style.display='block';
  // Position relative to radar-wrap
  var wrap=cv.parentElement;
  var wrapRect=wrap?wrap.getBoundingClientRect():{left:0,top:0};
  var cvRect=cv.getBoundingClientRect();
  var offsetX=cvRect.left-wrapRect.left+px;
  var offsetY=cvRect.top-wrapRect.top+pz;
  // Keep tooltip inside canvas bounds
  var tipW=tip.offsetWidth||100;
  var tipH=tip.offsetHeight||20;
  if(offsetX+tipW+8>cv.clientWidth)offsetX=offsetX-tipW-12;
  if(offsetY-28+tipH>cv.clientHeight)offsetY=offsetY-tipH-8;
  tip.style.left=Math.max(4,offsetX+8)+'px';
  tip.style.top=Math.max(4,offsetY-28)+'px';
  clearTimeout(_coordTipTimer);
  _coordTipTimer=setTimeout(function(){tip.style.display='none';},5000);
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
    // If no player hit, try hotspot recommendation first, then coordinate tooltip
    var hit=_rHit(cv,e);
    if(!hit){
      if(!_showHotspotReco(cv,w.x,w.z,w.px,w.pz)){
        _showCoordTip(cv,w.x,w.z,w.px,w.pz);
      }
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

/* ═══ Feature 17: PWA Service Worker (update-aware) ═══ */
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw-monitor.js').then(function(reg){
    // Jika ada SW yang waiting, langsung activate
    if(reg.waiting) reg.waiting.postMessage({type:'SKIP_WAITING'});
    // Detect update baru
    reg.addEventListener('updatefound',function(){
      var nw=reg.installing;
      if(!nw)return;
      nw.addEventListener('statechange',function(){
        if(nw.state==='installed'&&navigator.serviceWorker.controller){
          // SW baru siap — activate tanpa tunggu
          nw.postMessage({type:'SKIP_WAITING'});
        }
      });
    });
  }).catch(function(){});
  // Auto-reload saat SW baru mengambil kontrol
  var _swReloading=false;
  navigator.serviceWorker.addEventListener('controllerchange',function(){
    if(_swReloading)return;
    _swReloading=true;
    location.reload();
  });
}

/* Feature 20: Weather icon removed — was showing moon incorrectly (using ticks as hours) */

/* ═══════════════════════════════════════════════════════════════════════
   ATMOSPHERE — Celestial position + weather forecast
   ─────────────────────────────────────────────────────────────────────
   Posisi matahari/bulan dihitung dari world_time (0-23999 Minecraft tick):
     tick     0 = 06:00 (sunrise, sun di horizon kiri)
     tick  6000 = 12:00 (noon, sun zenith)
     tick 12000 = 18:00 (sunset, sun di horizon kanan)
     tick 18000 = 00:00 (midnight, moon zenith)
   X-axis: linear 0→100% (06:00 = 5%, 18:00 = 95% untuk siang; flip untuk malam).
   Y-axis: parabolic (sin curve) — top=15% saat zenith, bottom=70% saat horizon.
   Smooth via CSS transition 5s linear yang sinkron dengan micro-sync interval.

   Forecast cuaca: track perubahan via localStorage. Estimasi durasi:
     Clear   → next rain dalam 0.5–7.5 hari MC (avg ~5 menit real, MC default rate)
     Rain    → 0.5–1 hari MC (avg ~5 menit real)
     Thunder → 3–15 menit MC (avg ~5 menit real)
   Catatan: ini estimasi heuristik; cuaca BDS bisa di-override oleh /weather.
═══════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════
   ATMOSPHERE — Celestial position + ADVANCED weather forecast
   ─────────────────────────────────────────────────────────────────────
   Posisi matahari/bulan dihitung dari world_time (0-23999 Minecraft tick).
   Forecast cuaca: hybrid model — Bayesian blend antara prior MC default
   dan histori actual server (sliding window). Markov chain untuk next
   state. Multi-step rolling prediction sampai 60 menit / 5 step.

   localStorage:
     dwelve_atmo_wx_v2  → current state {wx, sinceMs}
     dwelve_atmo_hist_v1 → array history [{wx, startMs, endMs, dur}], cap 200
═══════════════════════════════════════════════════════════════════════ */

var _ATMO_LS_STATE='dwelve_atmo_wx_v2';
var _ATMO_LS_HIST='dwelve_atmo_hist_v1';
var _ATMO_HIST_CAP=200;
var _ATMO_FORECAST_HORIZON_MS=60*60*1000; // 60 menit
var _ATMO_FORECAST_MAX_STEPS=5;

// Prior MC default (ms real-time). Berfungsi sebagai Bayesian smoothing saat sample minim.
// Source: vanilla MC default rates — clear 0.5–7.5 day MC, rain 0.5–1 day, thunder 3–15 menit.
var _WX_PRIOR={
  clear:  {mean:1500000, stdev:1100000, weight:5}, // weight ~ pseudo-count
  rain:   {mean: 900000, stdev: 250000, weight:5},
  thunder:{mean: 450000, stdev: 200000, weight:5}
};
// Prior transition probability dari current state ke next (clear/rain/thunder)
var _WX_TRANS_PRIOR={
  clear:  {clear:0.0, rain:0.85, thunder:0.15}, // dari clear, lebih sering ke rain
  rain:   {clear:0.85, rain:0.0, thunder:0.15}, // rain biasanya berakhir ke clear
  thunder:{clear:0.30, rain:0.70, thunder:0.0}  // thunder sering reda jadi rain dulu
};

// Celestial state (rAF loop)
var _atmoBaseTick=0,_atmoBaseTs=0,_atmoLastTickShown=-1,_atmoRaf=0,_atmoCardEl=null;

// Phase blend (smooth ToD transition).
// CSS transition tidak bisa interpolasi linear-gradient, jadi class swap pagi→siang→sore→malam
// terasa instan tiap 6000 tick. rAF loop di bawah lerp 3-stop antar phase center pakai cosine ease
// dan tulis ke CSS var (--atmo-bg, --atmo-stars-op). Class .phase-* tetap di-set untuk pseudo
// ::before/::after (rays/sunset) + fallback saat reduced-motion.
// Center pos: pagi=3000, siang=9000, sore=15000, malam=21000.
var _ATMO_PHASES={
  pagi:  [[252,211,77,0.10],[244,114,182,0.05],[34,211,238,0.07]],
  siang: [[34,211,238,0.07],[65,138,205,0.065],[96,165,250,0.06]],
  sore:  [[251,146,60,0.13],[244,63,94,0.08],[168,85,247,0.06]],
  malam: [[30,27,75,0.22],[22,25,58,0.26],[15,23,42,0.30]],
};
var _ATMO_PHASE_ORDER=['pagi','siang','sore','malam'];
function _atmoCosEase(t){return (1-Math.cos(t*Math.PI))/2;}
function _atmoLerpStop(a,b,t){return[
  Math.round(a[0]+(b[0]-a[0])*t),
  Math.round(a[1]+(b[1]-a[1])*t),
  Math.round(a[2]+(b[2]-a[2])*t),
  +(a[3]+(b[3]-a[3])*t).toFixed(3),
];}
function _atmoStopCss(s){return 'rgba('+s[0]+','+s[1]+','+s[2]+','+s[3]+')';}
function _atmoBlendBg(td){
  // Origin shift: pagi center (3000) → 0, supaya idx*6000 jatuh tepat di phase center.
  var shifted=((td-3000)+24000)%24000;
  var idx=Math.floor(shifted/6000);
  var local=(shifted%6000)/6000;
  var t=_atmoCosEase(local);
  var pa=_ATMO_PHASES[_ATMO_PHASE_ORDER[idx]];
  var pb=_ATMO_PHASES[_ATMO_PHASE_ORDER[(idx+1)%4]];
  return 'linear-gradient(135deg,'
    +_atmoStopCss(_atmoLerpStop(pa[0],pb[0],t))+' 0%,'
    +_atmoStopCss(_atmoLerpStop(pa[1],pb[1],t))+' 50%,'
    +_atmoStopCss(_atmoLerpStop(pa[2],pb[2],t))+' 100%)';
}
function _atmoStarOp(td){
  // Modular distance ke malam center (21000). Fade in/out halus dalam window 6000 tick.
  var d=Math.abs(td-21000);if(d>12000)d=24000-d;
  if(d>=6000)return 0;
  return _atmoCosEase(1-d/6000);
}

// Canvas FX (realistic rain/thunder). Dibuat lazily saat pertama kali ada wx non-clear.
// NOTE: Canvas rain HARUS jalan di mobile juga supaya droplet sama dengan PC.
// Sebelumnya _perfMode matikan canvas sepenuhnya → mobile fallback ke CSS rain yang beda.
// Sekarang: perfMode hanya turunkan intensity (hemat GPU), BUKAN matikan.
var _atmoFx=null;
function _atmoCanvasSync(card,weather){
  if(typeof window.AtmoCanvas!=='function')return;
  var cv=$('atmo-fx');if(!cv)return;
  if(!_atmoFx){
    try{_atmoFx=window.AtmoCanvas(cv);}catch(e){return;}
  }
  if(weather==='clear'){
    _atmoFx.setMode('clear');
    card.classList.remove('has-canvas-fx');
  }else{
    // PerfMode (mobile): intensity diturunkan supaya tetap smooth tapi droplet sama
    var intensityRain    = _perfMode ? 0.35 : 0.70;
    var intensityThunder = _perfMode ? 0.50 : 0.90;
    _atmoFx.setIntensity(weather==='thunder' ? intensityThunder : intensityRain);
    _atmoFx.setMode(weather);
    card.classList.add('has-canvas-fx');
  }
}

function _atmoSyncCelestial(card,wt,serverTs){
  // wt = world_time absolute (BDS kirim bisa naik > 24000 atau di-reset modulo, tergantung impl).
  // Baseline timestamp pakai Date.now() lokal, BUKAN m.ts dari server, untuk hindari clock skew
  // yang bikin elapsedMs negatif (tick mundur, posisi celestial salah).
  // Trade-off: drift halus saat sync tertunda jaringan, tapi >> tetap konsisten dgn data terbaru.
  _atmoCardEl=card;
  _atmoBaseTick=Number(wt)||0;
  _atmoBaseTs=Date.now();
  // Render frame pertama segera supaya class sync dengan posisi
  _atmoRenderFrame(_atmoBaseTick);
  card.classList.add('cel-live');
  if(!_atmoRaf&&!_reduceMotion)_atmoRaf=requestAnimationFrame(_atmoTick);
}

function _atmoTick(){
  _atmoRaf=0;
  if(document.hidden||_reduceMotion){
    // Tab tersembunyi atau prefer-reduced-motion → stop rAF, biarkan transition CSS handle (kalau ada)
    if(_atmoCardEl)_atmoCardEl.classList.remove('cel-live');
    return;
  }
  if(!_atmoCardEl){return;}
  var elapsedMs=Date.now()-_atmoBaseTs;
  // 20 tick = 1 detik real-time di vanilla MC. Gunakan TPS realtime kalau ada untuk drift correction halus.
  var tps=(lastMetrics&&lastMetrics.tps)?Math.max(1,Math.min(20,lastMetrics.tps)):20;
  var tickNow=_atmoBaseTick+elapsedMs/1000*tps;
  // Throttle DOM write: skip kalau tick belum maju >= 1 (≈ 50ms di TPS 20)
  if(Math.floor(tickNow)!==_atmoLastTickShown){
    _atmoLastTickShown=Math.floor(tickNow);
    _atmoRenderFrame(tickNow);
  }
  // Live forecast countdown — update text cuaca/ETA tiap detik tanpa rebuild full timeline
  var nowSec=Math.floor(Date.now()/1000);
  if(nowSec!==_atmoLastForecastSec){
    _atmoLastForecastSec=nowSec;
    if(window.AtmoForecast&&typeof window.AtmoForecast.tickLive==='function'){
      window.AtmoForecast.tickLive();
    }else{
      _atmoTickForecastLive();
    }
  }
  _atmoRaf=requestAnimationFrame(_atmoTick);
}
var _atmoLastForecastSec=0;
function _atmoTickForecastLive(){
  // Update hanya elapsed + ETA text (tidak panggil rebuild timeline / re-fetch history)
  var st=_atmoLoadState();if(!st||!st.wx)return;
  var txEl=$('atmo-forecast-text'),etaEl=$('atmo-forecast-eta');
  if(!txEl||!etaEl)return;
  var nowMs=Date.now();
  var elapsed=Math.max(0,nowMs-st.sinceMs);
  var serverHist=Array.isArray(lastMetrics&&lastMetrics.weather_log)?lastMetrics.weather_log:[];
  var hist=_atmoMergeHistory(serverHist,_atmoLoadHistory());
  var stats=_atmoStats(hist);
  var sCur=stats[st.wx]||stats.clear;
  var remaining;
  if(elapsed<sCur.p25)        remaining=sCur.p50-elapsed;
  else if(elapsed<sCur.p50)   remaining=sCur.p50-elapsed;
  else if(elapsed<sCur.p75)   remaining=sCur.p75-elapsed;
  else                        remaining=Math.max(60000,sCur.mean*0.3);
  remaining=Math.max(0,remaining);
  var trans=_atmoTransProb(hist);
  var nx=_atmoNextWx(st.wx,trans);
  var totalN=(stats.clear.n||0)+(stats.rain.n||0)+(stats.thunder.n||0);
  var conf=Math.min(0.95,0.35+totalN*0.05);
  txEl.innerHTML='<span class="atmo-forecast-live"></span><b>'+_atmoLabel(st.wx)+'</b> · sudah '+_atmoFmtDur(elapsed)
    +' <span style="opacity:.6">→ '+_atmoLabel(nx).toLowerCase()+'</span>'
    +'<span class="atmo-forecast-conf" title="Akurasi prediksi: naik dengan sample (n='+totalN+')">'+Math.round(conf*100)+'%</span>';
  etaEl.textContent=remaining<=0?'segera':'~'+_atmoFmtDur(remaining);
}

function _atmoRenderFrame(tickAbs){
  var card=_atmoCardEl;if(!card)return;
  var td=((tickAbs%24000)+24000)%24000;
  // Smooth phase blend → CSS vars (gradient + stars opacity). Bypass class-based gradient swap
  // yang loncat tiap 6000 tick. Stop format kompatibel dengan CSS background-image var.
  card.style.setProperty('--atmo-bg',_atmoBlendBg(td));
  card.style.setProperty('--atmo-stars-op',_atmoStarOp(td).toFixed(3));
  // Orbit flat: y selalu di center bar (50%), hanya x linear yang berjalan kiri→kanan.
  var x,isNight=td>=12000;
  if(!isNight){
    var t=td/12000;
    x=5+t*90;
  }else{
    var t2=(td-12000)/12000;
    x=5+t2*90;
  }
  // Twilight fade dekat horizon (smooth crossover sunrise/sunset)
  var op=1;
  var distHorizon=isNight?Math.min(td-12000,24000-td):Math.min(td,12000-td);
  if(distHorizon<500)op=0.4+0.6*(distHorizon/500);
  card.style.setProperty('--cel-x',x.toFixed(2)+'%');
  card.style.setProperty('--cel-y','50%');
  card.style.setProperty('--cel-op',op.toFixed(2));
  card.classList.toggle('cel-night',isNight);
  // Moon phase: write attribute saat malam, supaya CSS [data-moon] selector bisa render shape.
  // Saat siang attribute dihapus agar tidak interferensi gradient matahari.
  if(isNight){
    if(card.getAttribute('data-moon')!==String(_moonPhase))card.setAttribute('data-moon',String(_moonPhase));
    if(!card.getAttribute('data-moon-name')||card.getAttribute('data-moon-name')!==_MOON_NAMES_ID[_moonPhase]){
      card.setAttribute('data-moon-name',_MOON_NAMES_ID[_moonPhase]);
    }
    var celEl=card.querySelector('.atmo-celest');
    if(celEl){celEl.title='Bulan: '+_MOON_NAMES_ID[_moonPhase]+' (hari ke-'+_moonDay+')';}
  }else if(card.hasAttribute('data-moon')){
    card.removeAttribute('data-moon');
    card.removeAttribute('data-moon-name');
    var celEl2=card.querySelector('.atmo-celest');
    if(celEl2)celEl2.removeAttribute('title');
  }
  // Live time pointer di label strip — hitung jam MC dari tick
  var nowEl=$('atmo-celest-now');
  if(nowEl){
    var hours=(td/1000+6)%24;
    var hh=Math.floor(hours),mm=Math.floor((hours-hh)*60);
    nowEl.textContent=(hh<10?'0':'')+hh+':'+(mm<10?'0':'')+mm;
    // Pointer x = jam MC / 24 * 100% (label strip: 00 di 0%, 06 di 25%, 12 di 50%, 18 di 75%, 24 di 100%)
    var px=hours/24*100;
    card.style.setProperty('--cel-now-x',px.toFixed(2)+'%');
  }
}

// Update reduce-motion preference juga kontrol atmosphere loop
(function(){
  if(!window.matchMedia)return;
  var mq=window.matchMedia('(prefers-reduced-motion: reduce)');
  var onChange=function(){
    if(_reduceMotion){
      if(_atmoRaf){cancelAnimationFrame(_atmoRaf);_atmoRaf=0;}
      if(_atmoCardEl)_atmoCardEl.classList.remove('cel-live');
    }else if(_atmoCardEl&&!_atmoRaf){
      _atmoCardEl.classList.add('cel-live');
      _atmoRaf=requestAnimationFrame(_atmoTick);
    }
  };
  if(mq.addEventListener)mq.addEventListener('change',onChange);
  else if(mq.addListener)mq.addListener(onChange);
})();
// Resume rAF saat tab kembali visible
document.addEventListener('visibilitychange',function(){
  if(!document.hidden&&_atmoCardEl&&!_atmoRaf&&!_reduceMotion){
    _atmoCardEl.classList.add('cel-live');
    _atmoRaf=requestAnimationFrame(_atmoTick);
  }
});

// Legacy alias kalau masih dipanggil dari spot lain
function _atmoUpdateCelestial(card,td){_atmoSyncCelestial(card,td,Date.now());}

function _atmoUpdateForecast(weather,serverTs){
  var fcEl=$('atmo-forecast'),txEl=$('atmo-forecast-text'),etaEl=$('atmo-forecast-eta'),tlEl=$('atmo-forecast-timeline');
  if(!fcEl||!txEl||!etaEl)return;
  var nowMs=serverTs?(new Date(serverTs).getTime()||Date.now()):Date.now();

  // 1) State current — prefer weather_since_ms dari server (akurat global), fallback localStorage
  var serverSince=lastMetrics&&lastMetrics.weather_since_ms?Number(lastMetrics.weather_since_ms):0;
  var st=_atmoLoadState();
  if(serverSince&&(!st||st.wx!==weather||Math.abs(serverSince-st.sinceMs)>30000)){
    // Server source-of-truth saat ada (akurat untuk semua user)
    st={wx:weather,sinceMs:serverSince,fromServer:true};
    _atmoSaveState(st);
  }else if(!st||st.wx!==weather){
    if(st&&st.wx&&st.sinceMs)_atmoLogHistory(st.wx,st.sinceMs,nowMs);
    st={wx:weather,sinceMs:nowMs};
    _atmoSaveState(st);
  }

  // 2) Merge history: server log (global, semua user) + local log (browser ini)
  var serverHist=Array.isArray(lastMetrics&&lastMetrics.weather_log)?lastMetrics.weather_log:[];
  var localHist=_atmoLoadHistory();
  var hist=_atmoMergeHistory(serverHist,localHist);

  // 3) Statistik & Markov
  var stats=_atmoStats(hist);
  var trans=_atmoTransProb(hist);

  // 4) Estimasi sisa durasi cuaca SEKARANG
  var elapsed=Math.max(0,nowMs-st.sinceMs);
  var sCur=stats[weather]||stats.clear;
  var remaining;
  if(elapsed<sCur.p25)        remaining=sCur.p50-elapsed;
  else if(elapsed<sCur.p50)   remaining=sCur.p50-elapsed;
  else if(elapsed<sCur.p75)   remaining=sCur.p75-elapsed;
  else                        remaining=Math.max(60000,sCur.mean*0.3);
  remaining=Math.max(0,remaining);

  // 5) Confidence — naik dengan total sample (server + local)
  var totalN=(stats.clear.n||0)+(stats.rain.n||0)+(stats.thunder.n||0);
  var conf=Math.min(0.95,0.35+totalN*0.05);

  // 6) Multi-step rolling forecast
  var timeline=_atmoSimulateForecast(weather,remaining,stats,trans,nowMs);

  // 7) Render utama
  var curLabel=_atmoLabel(weather);
  var nextWx=timeline[0]?timeline[0].wx:_atmoNextWx(weather,trans);
  var nextLabel=_atmoLabel(nextWx).toLowerCase();
  var elapsedTxt=_atmoFmtDur(elapsed);
  var etaTxt=remaining<=0?'segera':'~'+_atmoFmtDur(remaining);
  txEl.innerHTML='<span class="atmo-forecast-live"></span><b>'+curLabel+'</b> · sudah '+elapsedTxt
    +' <span style="opacity:.6">→ '+nextLabel+'</span>'
    +'<span class="atmo-forecast-conf" title="Akurasi prediksi: naik dengan sample (n='+totalN+')">'+Math.round(conf*100)+'%</span>';
  etaEl.textContent=etaTxt;
  if(tlEl)_atmoRenderTimeline(tlEl,weather,nowMs,remaining,timeline);
}

// Merge server history dengan local; deduplicate by (wx, startMs ±5s).
function _atmoMergeHistory(serverHist,localHist){
  var out=[];
  function key(e){return e.wx+'|'+Math.floor(e.startMs/5000);}
  var seen={};
  function add(arr){
    if(!Array.isArray(arr))return;
    for(var i=0;i<arr.length;i++){
      var e=arr[i];
      if(!e||!e.wx||!e.startMs||!e.endMs)continue;
      var k=key(e);
      if(seen[k])continue;
      seen[k]=true;
      out.push(e);
    }
  }
  add(serverHist);add(localHist);
  out.sort(function(a,b){return a.startMs-b.startMs;});
  return out;
}

function _atmoLoadState(){
  try{var raw=localStorage.getItem(_ATMO_LS_STATE);return raw?JSON.parse(raw):null;}catch(e){return null;}
}
function _atmoSaveState(st){
  try{localStorage.setItem(_ATMO_LS_STATE,JSON.stringify(st));}catch(e){}
}
function _atmoLoadHistory(){
  try{var raw=localStorage.getItem(_ATMO_LS_HIST);var a=raw?JSON.parse(raw):[];return Array.isArray(a)?a:[];}catch(e){return [];}
}
function _atmoLogHistory(wx,startMs,endMs){
  if(!wx||!startMs||!endMs||endMs<=startMs)return;
  var dur=endMs-startMs;
  // Filter outlier: durasi <30s (mungkin /weather command) atau >2 jam (pause server) di-skip
  if(dur<30000||dur>7200000)return;
  var arr=_atmoLoadHistory();
  arr.push({wx:wx,startMs:startMs,endMs:endMs,dur:dur});
  if(arr.length>_ATMO_HIST_CAP)arr=arr.slice(arr.length-_ATMO_HIST_CAP);
  try{localStorage.setItem(_ATMO_LS_HIST,JSON.stringify(arr));}catch(e){}
}

// Statistik per state, blend dengan prior pseudo-count
function _atmoStats(hist){
  var out={clear:null,rain:null,thunder:null};
  ['clear','rain','thunder'].forEach(function(k){
    var samples=[];
    for(var i=0;i<hist.length;i++)if(hist[i].wx===k)samples.push(hist[i].dur);
    var prior=_WX_PRIOR[k];
    var n=samples.length;
    if(n===0){
      out[k]={mean:prior.mean,p25:prior.mean*0.55,p50:prior.mean,p75:prior.mean*1.6,n:0};
      return;
    }
    samples.sort(function(a,b){return a-b;});
    var sampleMean=samples.reduce(function(s,v){return s+v;},0)/n;
    // Bayesian blend: pseudo-count weight 5 (prior) + n samples
    var w=prior.weight,wTotal=w+n;
    var mean=(w*prior.mean+n*sampleMean)/wTotal;
    out[k]={
      mean:mean,
      p25:_atmoQuantile(samples,0.25),
      p50:_atmoQuantile(samples,0.50),
      p75:_atmoQuantile(samples,0.75),
      n:n
    };
  });
  return out;
}
function _atmoQuantile(sorted,q){
  if(!sorted.length)return 0;
  var idx=(sorted.length-1)*q,lo=Math.floor(idx),hi=Math.ceil(idx);
  if(lo===hi)return sorted[lo];
  return sorted[lo]+(sorted[hi]-sorted[lo])*(idx-lo);
}

// Markov transition probability {clear:{rain:p, thunder:p}, ...}
function _atmoTransProb(hist){
  var counts={clear:{rain:0,thunder:0,clear:0},rain:{clear:0,thunder:0,rain:0},thunder:{clear:0,rain:0,thunder:0}};
  for(var i=1;i<hist.length;i++){
    var prev=hist[i-1].wx,next=hist[i].wx;
    if(counts[prev]&&counts[prev][next]!==undefined)counts[prev][next]++;
  }
  var out={};
  ['clear','rain','thunder'].forEach(function(prev){
    var prior=_WX_TRANS_PRIOR[prev];
    var total=0,row={};
    ['clear','rain','thunder'].forEach(function(next){
      if(prev===next){row[next]=0;return;}
      // Add Dirichlet-style smoothing: prior * 3 (pseudo-count) + observation
      var p=(prior[next]||0)*3+(counts[prev][next]||0);
      row[next]=p;total+=p;
    });
    if(total>0)['clear','rain','thunder'].forEach(function(k){row[k]=row[k]/total;});
    out[prev]=row;
  });
  return out;
}
function _atmoNextWx(cur,trans){
  var row=trans[cur]||{};
  var best='clear',bestP=-1;
  ['clear','rain','thunder'].forEach(function(k){if((row[k]||0)>bestP){bestP=row[k];best=k;}});
  return best;
}

// Simulate timeline ke depan, return [{wx, atMs, durationMs, prob}]
function _atmoSimulateForecast(curWx,curRemaining,stats,trans,nowMs){
  var out=[],t=nowMs+curRemaining,wx=curWx,prob=1.0;
  for(var step=0;step<_ATMO_FORECAST_MAX_STEPS;step++){
    if(t-nowMs>_ATMO_FORECAST_HORIZON_MS)break;
    // Pilih next state (greedy by max probability untuk display utama)
    var row=trans[wx]||{};
    var nx='clear',nxP=-1;
    ['clear','rain','thunder'].forEach(function(k){if(k!==wx&&(row[k]||0)>nxP){nxP=row[k];nx=k;}});
    if(nxP<=0)nx=wx==='clear'?'rain':'clear';
    prob*=Math.max(0.05,nxP);
    var dur=(stats[nx]&&stats[nx].p50)||_WX_PRIOR[nx].mean;
    out.push({wx:nx,atMs:t,durationMs:dur,prob:prob,transP:nxP});
    t+=dur;
    wx=nx;
  }
  return out;
}

function _atmoRenderTimeline(el,curWx,nowMs,curRemaining,timeline){
  var horizon=_ATMO_FORECAST_HORIZON_MS;
  var endMs=nowMs+horizon;
  // Build segments: [current cuaca dengan curRemaining] + timeline
  var segs=[{wx:curWx,startMs:nowMs,endMs:Math.min(nowMs+curRemaining,endMs),isCur:true}];
  var t=nowMs+curRemaining;
  for(var i=0;i<timeline.length;i++){
    var s=timeline[i];
    var segEnd=Math.min(s.atMs+s.durationMs,endMs);
    if(s.atMs>=endMs)break;
    segs.push({wx:s.wx,startMs:s.atMs,endMs:segEnd,prob:s.prob,transP:s.transP});
    if(segEnd>=endMs)break;
  }
  var html='';
  for(var i=0;i<segs.length;i++){
    var s=segs[i];
    var w=Math.max(2,(s.endMs-s.startMs)/horizon*100);
    var c=s.wx==='thunder'?'#a78bfa':s.wx==='rain'?'#7dd3fc':'#34d399';
    var label=_atmoLabel(s.wx);
    var atFromNow=Math.round((s.startMs-nowMs)/60000);
    var dur=Math.round((s.endMs-s.startMs)/60000);
    var probLbl=s.isCur?' (sekarang)':(' '+Math.round((s.transP||0)*100)+'%');
    var title=label+probLbl+' · +'+atFromNow+'m, durasi ~'+dur+'m';
    html+='<span class="atmo-tl-seg" style="width:'+w.toFixed(1)+'%;background:'+c+';opacity:'+(s.isCur?1:0.55+(s.prob||0.5)*0.4)+'" title="'+title+'"></span>';
  }
  // Tick marks: 15m, 30m, 45m
  var ticks='';
  [15,30,45].forEach(function(m){
    var pct=m/60*100;
    ticks+='<span class="atmo-tl-tick" style="left:'+pct+'%" data-m="'+m+'m"></span>';
  });
  el.innerHTML='<div class="atmo-tl-bar">'+html+'</div><div class="atmo-tl-ticks">'+ticks+'</div><div class="atmo-tl-scale"><span>sekarang</span><span>+15m</span><span>+30m</span><span>+45m</span><span>+60m</span></div>';
}

function _atmoLabel(wx){return wx==='thunder'?'Petir':wx==='rain'?'Hujan':'Cerah';}

function _atmoFmtDur(ms){
  if(ms<60000)return Math.max(1,Math.round(ms/1000))+'s';
  var m=Math.round(ms/60000);
  if(m<60)return m+'m';
  var h=Math.floor(m/60),mm=m%60;
  return h+'j'+(mm?' '+mm+'m':'');
}

/* ═══ Feature A: Canvas Rendering Optimization ═══ */
/* Throttle drawRadar to max 30fps and skip when tab hidden */
var _radarThrottleId=0,_radarQueued=false;
var _baseDrawRadar=drawRadar;
drawRadar=function(){
  if(document.hidden)return; // skip render when tab not visible
  if(_radarThrottleId){_radarQueued=true;return;}
  _baseDrawRadar();
  _updateRadarA11y();
  _radarThrottleId=setTimeout(function(){
    _radarThrottleId=0;
    if(_radarQueued){_radarQueued=false;_baseDrawRadar();_updateRadarA11y();}
  },50); // [PERF] 20fps cap in all modes (was 30fps standard / 20fps perf)
};
// [A11Y] Live-region summary for screen readers — rate-limited to 5s.
// Hindari assistive-tech spam saat radar redraw 30x/detik.
var _a11yLastTs=0;
function _updateRadarA11y(){
  var now=Date.now();if(now-_a11yLastTs<5000)return;
  _a11yLastTs=now;
  var el=$('radar-a11y');if(!el)return;
  var n=_lastAP?_lastAP.length:0;
  var lc=0;
  if(radarLands)for(var i=0;i<radarLands.length;i++){var l=radarLands[i];if(l&&l.x1!=null&&(DIM_SHORT[l.d]||'overworld')===radarDim)lc++;}
  var dimLbl=radarDim==='the_end'?'The End':radarDim.charAt(0).toUpperCase()+radarDim.slice(1);
  var msg=dimLbl+': '+n+' pemain'+(lc?', '+lc+' land claim':'')+'. Zoom '+radarZoom+' blok';
  if(rSel)msg+='. Pemain terpilih: '+rSel;
  el.textContent=msg;
}
/* Invalidate head cache when selection changes */
var _prevRSel=null;
var _baseSelectPlayer=_selectPlayer;
_selectPlayer=function(name){
  if(name!==_prevRSel){_headCache={};_prevRSel=name;}
  _baseSelectPlayer(name);
};

/* ═══ Feature B: Data Caching & Deduplication ═══ */
/* Timeout-aware fetch helper (§7.2). Default 8s. */
function _fetchT(url,opts,ms){
  ms=ms||8000;
  var ctrl=new AbortController();
  var to=setTimeout(function(){ctrl.abort();},ms);
  return fetch(url,Object.assign({signal:ctrl.signal},opts||{})).finally(function(){clearTimeout(to);});
}
/* BDS data hash check — skip re-render if data identical */
var _origFetchBDS=fetchBDSData;
fetchBDSData=async function(){
  try{
    var _sid=(_servers[_currentIdx]&&_servers[_currentIdx].sync_id)||'current';
    var r=await _fetchT(SB_URL+'/rest/v1/leaderboard_sync?id=eq.'+_sid+'&select=online_players,synced_at,server_metrics',{headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}},8000);
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
