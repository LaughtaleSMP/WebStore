(function(){
'use strict';
var $=function(id){return document.getElementById(id)};
function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
function fmtN(n){if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'K';return String(n)}
function fmt(n){return(n||0).toLocaleString('id-ID')}
function timeAgo(ts){if(!ts)return'?';var s=Math.floor((Date.now()-ts)/1000);if(s<60)return s+'s lalu';if(s<3600)return Math.floor(s/60)+'m lalu';if(s<86400)return Math.floor(s/3600)+'j lalu';return Math.floor(s/86400)+'h lalu'}
function setText(id,t){var el=$(id);if(el)el.textContent=t}

var _data=null,_activeTab='bank',_activeMod='analytics';
var RARITY_COLORS={COMMON:'var(--dim)',UNCOMMON:'var(--green)',RARE:'#3b82f6',EPIC:'var(--ac)',LEGENDARY:'var(--gold)'};

window.addEventListener('DOMContentLoaded',function(){
  bindModTabs();bindLogTabs();fetchAll();
});

function bindModTabs(){
  var tabs=document.querySelectorAll('.mod-tab');
  for(var i=0;i<tabs.length;i++){
    tabs[i].addEventListener('click',function(){
      document.querySelectorAll('.mod-tab').forEach(function(t){t.classList.remove('active')});
      document.querySelectorAll('.mod').forEach(function(m){m.classList.remove('active')});
      this.classList.add('active');
      _activeMod=this.dataset.mod;
      var mod=$('mod-'+_activeMod);if(mod)mod.classList.add('active');
    });
  }
}

function bindLogTabs(){
  var el=$('log-tabs');if(!el)return;
  el.addEventListener('click',function(e){
    var t=e.target.closest('.tab');if(!t)return;
    document.querySelectorAll('#log-tabs .tab').forEach(function(b){b.classList.remove('a')});
    t.classList.add('a');_activeTab=t.dataset.cat;renderLogs();
  });
}

async function fetchAll(){
  try{
    var r=await fetch(SB_URL+'/rest/v1/leaderboard_sync?id=eq.current&select=gacha_lb,bank_log,auction_log,gacha_log,topup_log,disc_codes,synced_at',{headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}});
    var d=await r.json();if(!d||!d[0])return;
    var row=d[0];
    _data={
      lb:safeParse(row.gacha_lb,{}),
      bank:safeParse(row.bank_log,[]),auction:safeParse(row.auction_log,[]),
      gacha:safeParse(row.gacha_log,[]),topup:safeParse(row.topup_log,[]),
      disc:safeParse(row.disc_codes,{}),synced:row.synced_at
    };
    var el=$('eco-sync');
    if(el)el.textContent='Sync: '+(row.synced_at?new Date(row.synced_at).toLocaleString('id-ID'):'—');
    renderAnalytics();renderLogStats();renderLogs();renderDiscCodes();
    // Fetch trend AFTER _data is ready so fallback can use analytics
    fetchTrend();
  }catch(e){console.warn('[Eco]',e)}
}

function safeParse(v,d){if(!v)return d;if(typeof v==='string')try{return JSON.parse(v)}catch(e){return d}return v}

function renderAnalytics(){
  if(!_data)return;
  var s=_data.lb.summary;
  if(!s||!s.coin)return;
  var c=s.coin,g=s.gem;

  setText('kpi-n',s.n);setText('kpi-n-sub','dari p_reg');
  setText('kpi-coin',fmtN(c.total));setText('kpi-coin-sub','avg: '+fmtN(c.avg)+' / player');
  setText('kpi-gem',fmtN(g.total));setText('kpi-gem-sub','avg: '+fmtN(g.avg)+' / player');
  setText('kpi-median',fmtN(c.median));setText('kpi-median-sub','P25: '+fmtN(c.p25)+' | P75: '+fmtN(c.p75));

  renderWealth(s);renderInflation(s);renderTxVolume();renderTopHolders();renderPricing(s);renderGacha(s);
}

function renderWealth(s){
  var gini=s.gini,c=s.coin;
  var pill=$('gini-pill');
  if(pill){pill.textContent='Gini: '+gini.toFixed(3);pill.className='pill '+(gini<.3?'g':gini<.5?'y':'r')}

  var ranges=[
    {pct:c.p25>0?Math.round(c.p25/c.total*100*s.n*.25):5,color:'#64748b',label:'Bottom 25%'},
    {pct:c.median>0?Math.round((c.median-c.p25)/c.total*100*s.n*.25):10,color:'#60a5fa',label:'Lower Mid'},
    {pct:20,color:'#34d399',label:'Middle'},
    {pct:c.p75>0?Math.round((c.p75-c.median)/c.total*100*s.n*.25):25,color:'#fbbf24',label:'Upper Mid'},
    {pct:40,color:'#f87171',label:'Top 25%'}
  ];
  var total=ranges.reduce(function(a,b){return a+b.pct},0)||1;

  var bar=$('wealth-bar');
  if(bar){var h='';for(var i=0;i<ranges.length;i++){h+='<div style="width:'+Math.max(2,Math.round(ranges[i].pct/total*100))+'%;background:'+ranges[i].color+'"></div>'}bar.innerHTML=h}

  var leg=$('wealth-legend');
  if(leg){var lh='';for(var i=ranges.length-1;i>=0;i--){lh+='<span style="font-family:\'JetBrains Mono\',monospace;font-size:.38rem;color:var(--text);display:flex;align-items:center;gap:3px"><span style="width:7px;height:7px;border-radius:2px;background:'+ranges[i].color+';flex-shrink:0"></span>'+ranges[i].label+'</span>'}leg.innerHTML=lh}

  var det=$('wealth-detail');
  if(det){
    var top1Pct=c.max>0&&c.total>0?Math.round(c.max/c.total*100):0;
    det.innerHTML='Coin terbanyak: '+fmtN(c.max)+' ('+top1Pct+'% supply). Terendah: '+fmtN(c.min)+'. '+(gini>=.5?'<span style="color:var(--red)">Ketimpangan tinggi.</span>':gini>=.3?'<span style="color:var(--gold)">Ketimpangan sedang.</span>':'<span style="color:var(--green)">Distribusi merata.</span>');
  }
}

function renderInflation(s){
  var bank=_data.bank,topup=_data.topup,gacha=_data.gacha;

  // Try to get flow data from latest economy_history entry
  var flow=null;
  if(_trendData.length>0){
    var latest=_trendData[_trendData.length-1];
    if(latest.coin_flow){
      flow=typeof latest.coin_flow==='string'?safeParse(latest.coin_flow,null):latest.coin_flow;
    }
  }

  var injected=0,sunk=0,flowCards='';
  if(flow&&Object.keys(flow).length>0){
    // Use accurate flow data from server
    var sources=[
      {k:'mob_kill',label:'Mob Kill',color:'var(--green)',icon:'\u2694'},
      {k:'topup',label:'Admin Topup',color:'var(--cyan)',icon:'\u2b06'},
      {k:'gacha_refund',label:'Gacha Refund',color:'#c084fc',icon:'\u21bb'},
      {k:'pvp_refund',label:'PvP Refund',color:'var(--gold)',icon:'\u2726'},
      {k:'weekly_reward',label:'Weekly LB',color:'#facc15',icon:'\u2605'},
      {k:'first_sale',label:'1st Sale',color:'#a3e635',icon:'\u2726'},
    ];
    var sinks=[
      {k:'gacha_cost',label:'Gacha Cost',color:'var(--red)',icon:'\u2b07'},
      {k:'bank_tax',label:'Bank Tax',color:'var(--orange)',icon:'\u00a7'},
      {k:'mob_penalty',label:'Anti-Stack',color:'#f87171',icon:'\u26a0'},
      {k:'pvp_penalty',label:'PvP Penalty',color:'#ef4444',icon:'\u2620'},
      {k:'auction_fee',label:'Auction Fee',color:'#fb923c',icon:'\u2696'},
    ];
    for(var i=0;i<sources.length;i++){var v=flow[sources[i].k]||0;if(v>0)injected+=v;}
    for(var i=0;i<sinks.length;i++){var v=Math.abs(flow[sinks[i].k]||0);if(v>0)sunk+=v;}
    // Build source breakdown cards
    var allFlow=sources.concat(sinks);
    flowCards='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:4px;margin-top:8px">';
    for(var i=0;i<allFlow.length;i++){
      var f=allFlow[i],v=flow[f.k]||0;
      if(v===0)continue;
      var sign=v>0?'+':'';var cls=v>0?'var(--green)':'var(--red)';
      flowCards+=mkStatCard(f.icon+' '+f.label,f.color,sign+fmtN(v),'last sync');
    }
    flowCards+='</div>';
  }else{
    // Fallback to log-based analysis
    for(var i=0;i<topup.length;i++)if((topup[i].x||topup[i].action)==='add')injected+=Math.abs(topup[i].n||topup[i].amount||0);
    for(var i=0;i<gacha.length;i++)sunk+=Math.abs(gacha[i].cost||gacha[i].c||0);
  }
  var net=injected-sunk;
  var rate=s.coin.total>0?Math.round(net/s.coin.total*100):0;

  var pill=$('inf-pill');
  if(pill){
    var lbl=rate>5?'INFLASI':rate<-5?'DEFLASI':'STABIL';
    pill.textContent=lbl+' ('+rate+'%)';
    pill.className='pill '+(Math.abs(rate)<=5?'g':Math.abs(rate)<=15?'y':'r');
  }

  var grid=$('inf-grid');
  if(grid){
    var html=mkStatCard('Coin Masuk','var(--green)',fmtN(injected),(flow?'dari flow tracker':'dari log'))+mkStatCard('Coin Keluar','var(--red)',fmtN(sunk),(flow?'dari flow tracker':'dari log'))+mkStatCard('Net Flow',net>=0?'var(--gold)':'var(--cyan)',(net>=0?'+':'')+fmtN(net),flow?'akurat':'estimasi');
    grid.innerHTML=html;
  }
  // Append source breakdown below inflation grid
  if(flowCards){var fc=document.createElement('div');fc.innerHTML=flowCards;var card=$('inflation-card');if(card)card.appendChild(fc);}
}

function renderTxVolume(){
  var bank=_data.bank,auc=_data.auction,gacha=_data.gacha,topup=_data.topup;
  var bV=0,aV=0;
  for(var i=0;i<bank.length;i++)bV+=Math.abs(bank[i].amount||0);
  for(var i=0;i<auc.length;i++)aV+=Math.abs(auc[i].price||0);
  var traders={};
  for(var i=0;i<bank.length;i++){if(bank[i].from)traders[bank[i].from]=1;if(bank[i].to)traders[bank[i].to]=1}
  for(var i=0;i<auc.length;i++){if(auc[i].seller)traders[auc[i].seller]=1;if(auc[i].buyer)traders[auc[i].buyer]=1}

  var grid=$('tx-grid');
  if(grid)grid.innerHTML=mkStatCard('Bank Volume','var(--cyan)',fmtN(bV),bank.length+' tx')+mkStatCard('Auction Volume','var(--green)',fmtN(aV),auc.length+' tx')+mkStatCard('Gacha Pulls','#c084fc',gacha.length+'x','total pulls')+mkStatCard('Trader Aktif','var(--gold)',Object.keys(traders).length,'unique');
}

function renderTopHolders(){
  var lb=_data.lb;if(!lb)return;
  fillTbl('tbl-coin',lb.coin||[],function(p,i){return'<tr><td style="color:var(--mute)">'+(i+1)+'</td><td>'+esc(p.name)+'</td><td style="text-align:right;color:var(--gold);font-weight:700">'+fmtN(p.coin)+'</td></tr>'});
  fillTbl('tbl-gem',lb.gem||[],function(p,i){return'<tr><td style="color:var(--mute)">'+(i+1)+'</td><td>'+esc(p.name)+'</td><td style="text-align:right;color:#a855f7;font-weight:700">'+fmtN(p.gem)+'</td></tr>'});
}

function renderPricing(s){
  var c=s.coin,med=c.median,avg=c.avg,p25=c.p25;
  var items=[
    ['Land Claim (kecil)','Land',Math.round(med*.3),Math.round(med*.5),Math.round(med*.8),'50% median'],
    ['Land Claim (besar)','Land',Math.round(med*.8),Math.round(med*1.5),Math.round(med*2.5),'mid-end player'],
    ['Land Extend +1','Land',Math.round(med*.15),Math.round(med*.25),Math.round(med*.4),'incremental'],
    ['Basic Tool','Shop',Math.round(p25*.1),Math.round(p25*.2),Math.round(p25*.35),'player baru'],
    ['Advanced Tool','Shop',Math.round(med*.15),Math.round(med*.25),Math.round(med*.4),'mid-tier'],
    ['Rare / Spawner','Shop',Math.round(avg*.5),Math.round(avg*1),Math.round(avg*2),'end-game'],
    ['Cosmetic','Premium',Math.round(med*.1),Math.round(med*.2),Math.round(med*.5),'non-essential'],
    ['VIP 30 hari','Premium',Math.round(avg*.3),Math.round(avg*.5),Math.round(avg*1),'recurring']
  ];
  var colors={Land:'var(--green)',Shop:'var(--cyan)',Premium:'#c084fc'};
  var body=document.querySelector('#tbl-price tbody');if(!body)return;
  var h='';
  for(var i=0;i<items.length;i++){
    var it=items[i],cc=colors[it[1]]||'var(--mute)';
    h+='<tr><td style="font-weight:600">'+it[0]+'</td><td style="color:'+cc+'">'+it[1]+'</td><td style="text-align:right;color:var(--dim)">'+fmtN(it[2])+'</td><td style="text-align:right;color:var(--green);font-weight:700">'+fmtN(it[3])+'</td><td style="text-align:right;color:var(--dim)">'+fmtN(it[4])+'</td><td style="color:var(--mute);font-size:.36rem">'+it[5]+'</td></tr>';
  }
  body.innerHTML=h;
}

function renderGacha(s){
  var g=s.gacha;if(!g)return;
  var grid=$('gacha-grid');
  if(grid)grid.innerHTML=mkStatCard('Total Pulls','#c084fc',fmtN(g.pulls),'semua pemain')+mkStatCard('Pemain Gacha','var(--cyan)',g.active,'dari '+s.n)+mkStatCard('Participation','var(--green)',g.rate+'%','aktif gacha')+mkStatCard('Avg Pulls','var(--gold)',s.n>0?Math.round(g.pulls/s.n):0,'per pemain');
}

function mkStatCard(label,color,val,sub){
  return'<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xs);padding:7px 9px;text-align:center"><div style="font-family:\'JetBrains Mono\',monospace;font-size:.38rem;color:var(--mute);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">'+label+'</div><div style="font-family:\'JetBrains Mono\',monospace;font-size:.8rem;font-weight:700;color:'+color+'">'+val+'</div><div style="font-size:.35rem;color:var(--dim);margin-top:2px">'+sub+'</div></div>';
}

function fillTbl(id,arr,fn){
  var el=$(id);if(!el)return;var tb=el.querySelector('tbody');if(!tb)return;
  if(!arr.length){tb.innerHTML='<tr><td colspan="3" style="text-align:center;color:var(--mute);padding:10px">—</td></tr>';return}
  var h='';for(var i=0;i<Math.min(arr.length,10);i++)h+=fn(arr[i],i);tb.innerHTML=h;
}

function renderLogStats(){
  var ids=['st-bank','st-auction','st-gacha','st-topup'];
  var vals=[_data.bank.length,_data.auction.length,_data.gacha.length,_data.topup.length];
  for(var i=0;i<ids.length;i++){var el=$(ids[i]);if(el){el.textContent=vals[i];el.classList.remove('sk')}}
}

function renderLogs(){
  var renderers={bank:renderBank,auction:renderAuction,gacha:renderGachaLog,topup:renderTopup};
  (renderers[_activeTab]||renderBank)(_data[_activeTab]||[]);
  var meta=$('log-meta');if(meta)meta.textContent=(_data[_activeTab]||[]).length+' log';
}

function renderBank(logs){
  var el=$('log-content');if(!logs.length){el.innerHTML='<div class="emp">Belum ada log transfer</div>';return}
  el.innerHTML=logs.map(function(h,i){
    var tax=(h.tax||0)>0?' <span class="tx">pajak '+fmt(h.tax)+'</span>':'';
    return'<div class="log-row" style="animation:fs .3s '+i*30+'ms ease both"><div class="log-icon sent"></div><div class="log-body"><div class="log-main"><span class="pn">'+esc(h.from||'?')+'</span> <span class="arrow">→</span> <span class="pn">'+esc(h.to||'?')+'</span></div><div class="log-detail">'+(h.note?'"'+esc(h.note)+'" · ':'')+'<span class="log-time">'+timeAgo(h.ts)+'</span></div></div><div class="log-amount coin">+'+fmt(h.amount)+' ⛃'+tax+'</div></div>';
  }).join('');
}

function renderAuction(logs){
  var el=$('log-content');if(!logs.length){el.innerHTML='<div class="emp">Belum ada log auction</div>';return}
  el.innerHTML=logs.map(function(h,i){
    var cls=h.type==='expired'?'expired':'sold';
    var detail=h.type==='expired'?'<span class="pn">'+esc(h.seller||'?')+'</span>':'<span class="pn">'+esc(h.seller||'?')+'</span> <span class="arrow">→</span> <span class="pn">'+esc(h.buyer||'?')+'</span>'+(h.type==='auction_won'?' <span class="badge bid">Lelang</span>':'');
    var amt=h.type==='expired'?'<div class="log-amount expired">Expired</div>':'<div class="log-amount coin">'+fmt(h.price)+' ⛃</div>';
    return'<div class="log-row" style="animation:fs .3s '+i*30+'ms ease both"><div class="log-icon '+cls+'"></div><div class="log-body"><div class="log-main">'+esc(h.item||'?')+'</div><div class="log-detail">'+detail+' · <span class="log-time">'+timeAgo(h.ts)+'</span></div></div>'+amt+'</div>';
  }).join('');
}

function renderGachaLog(logs){
  var el=$('log-content');if(!logs.length){el.innerHTML='<div class="emp">Belum ada log gacha</div>';return}
  el.innerHTML=logs.map(function(h,i){
    var pName=h.player||h.p||'?',type=(h.type||h.t||'EQ')==='PT'?'Partikel':'Peralatan',typeCls=(h.type||h.t||'EQ')==='PT'?'pt':'eq';
    var items=h.items||[],rarity=h.r||'COMMON',iName=h.name||h.n||'?',rarColor=RARITY_COLORS[rarity]||'var(--dim)';
    if(items.length>0){
      var best=items.reduce(function(a,b){var rk=['COMMON','UNCOMMON','RARE','EPIC','LEGENDARY'];return rk.indexOf(b.rarity||b.r||'COMMON')>rk.indexOf(a.rarity||a.r||'COMMON')?b:a},items[0]);
      var bestColor=RARITY_COLORS[best.rarity||best.r]||'var(--dim)';
      var itemList=items.map(function(it){var c=RARITY_COLORS[it.rarity||it.r]||'var(--dim)';return'<span class="pull-item" style="color:'+c+'">'+esc(it.name||it.n||'?')+(it.isDup||it.d?' <span class="dup">[D]</span>':'')+'</span>'}).join('');
      return'<div class="log-row gacha-row" style="animation:fs .3s '+i*30+'ms ease both"><div class="log-icon '+typeCls+'"></div><div class="log-body"><div class="log-main"><span class="pn">'+esc(pName)+'</span> <span class="badge '+typeCls+'">'+type+'</span> <span class="badge pull">'+items.length+'x</span></div><div class="log-detail"><span class="log-time">'+timeAgo(h.ts)+'</span></div><div class="pull-items">'+itemList+'</div></div><div class="log-amount" style="color:'+bestColor+'">'+esc(best.name||best.n||'?')+'</div></div>';
    }
    return'<div class="log-row gacha-row" style="animation:fs .3s '+i*30+'ms ease both"><div class="log-icon '+typeCls+'"></div><div class="log-body"><div class="log-main"><span class="pn">'+esc(pName)+'</span> <span class="badge '+typeCls+'">'+type+'</span></div><div class="log-detail"><span class="log-time">'+timeAgo(h.ts)+'</span></div></div><div class="log-amount" style="color:'+rarColor+'">'+esc(iName)+'</div></div>';
  }).join('');
}

function renderTopup(logs){
  var el=$('log-content');if(!logs.length){el.innerHTML='<div class="emp">Belum ada log topup</div>';return}
  var sorted=logs.slice().sort(function(a,b){return(b.ts||0)-(a.ts||0)});
  el.innerHTML=sorted.map(function(h,i){
    var cur=h.c==='gem'?'Gem':'Koin',curCls=h.c==='gem'?'gem':'coin',act=h.x==='add'?'+':'-',actCls=h.x==='add'?'add':'deduct';
    return'<div class="log-row" style="animation:fs .3s '+i*30+'ms ease both"><div class="log-icon '+actCls+'"></div><div class="log-body"><div class="log-main"><span class="pn admin">'+esc(h.a||'Admin')+'</span> <span class="arrow">→</span> <span class="pn">'+esc(h.t||'?')+'</span>'+(h.o?' <span class="badge offline">Offline</span>':'')+'</div><div class="log-detail">'+fmt(h.b)+' → '+fmt(h.f)+' '+cur+' · <span class="log-time">'+timeAgo(h.ts)+'</span></div></div><div class="log-amount '+actCls+'">'+act+fmt(h.n)+' <span class="cur '+curCls+'">'+cur+'</span></div></div>';
  }).join('');
}

function renderDiscCodes(){
  var el=$('disc-content'),codes=_data.disc;
  var entries=Object.entries(codes||{});
  if(!entries.length){el.innerHTML='<div class="dc-empty">Tidak ada kode diskon aktif</div>';return}
  el.innerHTML='<div class="dc-grid">'+entries.map(function(e,i){
    var code=e[0],info=e[1],pct=info.pct||0,uses=info.uses||0,type=info.type||'ALL';
    var typeLabel=type==='ALL'?'SEMUA':type==='PT'?'PARTIKEL':'EQUIPMENT';
    return'<div class="dc-card" style="animation:fs .3s '+i*60+'ms ease both"><div class="dc-top"><span class="dc-code" onclick="copyCode(\''+esc(code).replace(/'/g,"\\'")+'\')" ><span>'+esc(code)+'</span><span class="copy-hint">KLIK SALIN</span></span><span class="dc-pct">-'+pct+'%</span></div><div class="dc-bottom"><span class="dc-type '+type.toLowerCase()+'">'+typeLabel+'</span><span class="dc-uses">'+uses+' sisa</span></div><div class="dc-bar"><div class="dc-bar-fill" style="width:'+Math.min(100,Math.max(5,uses/50*100))+'%"></div></div></div>';
  }).join('')+'</div>';
}

window.copyCode=function(code){navigator.clipboard.writeText(code).then(function(){var t=$('dc-toast');t.classList.add('show');setTimeout(function(){t.classList.remove('show')},2000)}).catch(function(){})};

/* ═══ Economy Trend Chart ═══ */
var _trendData=[],_trendRange='day',_trendMetric='coin_total';
var _candles=[],_hoverIdx=-1;
var CU='#26a69a',CD='#ef5350';

function bindTrendTabs(){
  var el=$('trend-tabs');if(!el)return;
  el.addEventListener('click',function(e){
    var t=e.target.closest('.tab');if(!t)return;
    el.querySelectorAll('.tab').forEach(function(b){b.classList.remove('a')});
    t.classList.add('a');_trendRange=t.dataset.range;fetchTrend();
  });
  var mel=$('trend-metric-tabs');
  if(mel)mel.addEventListener('click',function(e){
    var t=e.target.closest('.tab');if(!t)return;
    mel.querySelectorAll('.tab').forEach(function(b){b.classList.remove('a')});
    t.classList.add('a');_trendMetric=t.dataset.metric;
    _candles=_agg(_trendData,_trendMetric);_hoverIdx=-1;drawTrendChart();
  });
}

function _bucketMs(){return{day:3600000,week:21600000,month:86400000}[_trendRange]||3600000}

function _agg(data,metric){
  if(!data.length)return[];
  var bms=_bucketMs(),bk={};
  for(var i=0;i<data.length;i++){
    var t=new Date(data[i].ts).getTime(),k=Math.floor(t/bms)*bms;
    if(!bk[k])bk[k]={t:k,v:[]};bk[k].v.push(data[i][metric]||0);
  }
  var ks=Object.keys(bk).sort(function(a,b){return a-b}),r=[];
  for(var i=0;i<ks.length;i++){
    var b=bk[ks[i]],v=b.v,hi=v[0],lo=v[0];
    for(var j=1;j<v.length;j++){if(v[j]>hi)hi=v[j];if(v[j]<lo)lo=v[j]}
    r.push({t:b.t,o:v[0],c:v[v.length-1],h:hi,l:lo,n:v.length});
  }
  return r;
}

async function fetchTrend(){
  var hrs={day:'24',week:'168',month:'720'}[_trendRange]||'168';
  var since=new Date(Date.now()-hrs*3600000).toISOString();
  try{
    var r=await fetch(SB_URL+'/rest/v1/economy_history?ts=gte.'+since+'&order=ts.asc&limit=2000',{headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}});
    var d=await r.json();
    _trendData=(Array.isArray(d)&&d.length>0)?d:_fbTrend();
  }catch(e){_trendData=_fbTrend()}
  _candles=_agg(_trendData,_trendMetric);_hoverIdx=-1;
  var info=$('trend-info');
  if(info){
    if(_candles.length>1)info.textContent=_candles.length+' candles ('+_trendData.length+' snapshots)';
    else if(_candles.length===1)info.textContent='1 candle — data bertambah setiap sync BDS.';
    else info.textContent='Menunggu data dari BDS sync...';
  }
  drawTrendChart();renderTrendDeltas();
}

function _fbTrend(){
  if(!_data||!_data.lb||!_data.lb.summary)return[];
  var s=_data.lb.summary;
  return[{ts:_data.synced||new Date().toISOString(),coin_total:s.coin?s.coin.total:0,player_count:s.n||0,coin_median:s.coin?s.coin.median:0,coin_avg:s.coin?s.coin.avg:0}];
}

function _updHdr(c){
  var el=$('trend-hdr');if(!el)return;
  if(!c){el.innerHTML='<span style="color:var(--mute)">— Menunggu data —</span>';return}
  var d=c.c-c.o,pct=c.o>0?((d/c.o)*100).toFixed(2):'0.00',clr=d>=0?CU:CD,sg=d>=0?'+':'';
  var t=new Date(c.t),ts=t.getDate()+'/'+(t.getMonth()+1)+' '+String(t.getHours()).padStart(2,'0')+':00';
  el.innerHTML='<span style="color:var(--mute)">'+ts+'</span> <span>O:<b style="color:var(--dim)">'+fmtN(c.o)+'</b></span> <span>H:<b style="color:'+CU+'">'+fmtN(c.h)+'</b></span> <span>L:<b style="color:'+CD+'">'+fmtN(c.l)+'</b></span> <span>C:<b style="color:var(--text)">'+fmtN(c.c)+'</b></span> <span style="color:'+clr+'">'+sg+fmtN(Math.abs(Math.round(d)))+' ('+sg+pct+'%)</span>';
}

function drawTrendChart(){
  var cv=$('trend-chart');if(!cv)return;
  var par=cv.parentElement;
  var W=par?(par.clientWidth||600):600;if(W<100)W=600;
  var H=220;
  cv.width=W;cv.height=H;
  var ctx=cv.getContext('2d');
  ctx.clearRect(0,0,W,H);
  var pad={t:12,r:52,b:20,l:6},cw=W-pad.l-pad.r,ch=H-pad.t-pad.b;
  if(cw<=0||ch<=0)return;
  var n=_candles.length;
  if(!n){
    ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=1;
    for(var g=0;g<=5;g++){var gy=pad.t+ch*(g/5);ctx.beginPath();ctx.moveTo(pad.l,gy);ctx.lineTo(W-pad.r,gy);ctx.stroke()}
    ctx.fillStyle='rgba(255,255,255,0.12)';ctx.font='600 11px JetBrains Mono,monospace';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('Menunggu data dari BDS sync...',W/2,H/2);
    _updHdr(null);return;
  }
  var mn=Infinity,mx=-Infinity;
  for(var i=0;i<n;i++){if(_candles[i].l<mn)mn=_candles[i].l;if(_candles[i].h>mx)mx=_candles[i].h}
  if(mx<=mn)mx=mn+1;
  var rng=mx-mn,pv=rng*0.08;mn=Math.max(0,mn-pv);mx=mx+pv;
  function yOf(v){return pad.t+ch*(1-(v-mn)/(mx-mn))}
  ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=1;
  ctx.fillStyle='rgba(255,255,255,0.22)';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='left';
  for(var g=0;g<=5;g++){
    var gy=pad.t+ch*(g/5);ctx.beginPath();ctx.moveTo(pad.l,gy);ctx.lineTo(W-pad.r,gy);ctx.stroke();
    var val=mx-(mx-mn)*(g/5);ctx.fillText(fmtN(Math.round(val)),W-pad.r+4,gy+3);
  }
  var gap=Math.max(1,Math.round(cw*0.12/n));
  var bw=Math.max(3,Math.floor((cw-gap*(n-1))/n));if(bw>28)bw=28;
  var tw=n*bw+(n-1)*gap,ox=pad.l+Math.floor((cw-tw)/2);
  for(var i=0;i<n;i++){
    var c=_candles[i],x=ox+i*(bw+gap),cx=x+bw/2,up=c.c>=c.o,clr=up?CU:CD;
    ctx.strokeStyle=clr;ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(Math.round(cx)+.5,yOf(c.h));ctx.lineTo(Math.round(cx)+.5,yOf(c.l));ctx.stroke();
    var bt=yOf(up?c.c:c.o),bb=yOf(up?c.o:c.c),bh=Math.max(1,bb-bt);
    ctx.fillStyle=up?'rgba(38,166,154,0.85)':'rgba(239,83,80,0.85)';
    ctx.fillRect(x,bt,bw,bh);
    ctx.strokeRect(x+.5,bt+.5,bw-1,Math.max(0,bh-1));
    if(i===_hoverIdx){ctx.fillStyle='rgba(255,255,255,0.05)';ctx.fillRect(x-1,pad.t,bw+2,ch)}
  }
  ctx.fillStyle='rgba(255,255,255,0.2)';ctx.font='8px JetBrains Mono,monospace';ctx.textAlign='center';
  var ls=Math.max(1,Math.floor(n/7));
  for(var i=0;i<n;i+=ls){
    var t=new Date(_candles[i].t);
    var lb=_trendRange==='day'?t.getHours()+':00':_trendRange==='week'?(t.getDate()+'/'+(t.getMonth()+1)):t.getDate()+'/'+(t.getMonth()+1);
    ctx.fillText(lb,ox+i*(bw+gap)+bw/2,H-pad.b+14);
  }
  if(_hoverIdx>=0&&_hoverIdx<n){
    var hc=_candles[_hoverIdx],hx=ox+_hoverIdx*(bw+gap)+bw/2;
    ctx.setLineDash([2,2]);ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(hx,pad.t);ctx.lineTo(hx,pad.t+ch);ctx.stroke();
    var hy=yOf(hc.c);ctx.beginPath();ctx.moveTo(pad.l,hy);ctx.lineTo(W-pad.r,hy);ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle=hc.c>=hc.o?'rgba(38,166,154,0.9)':'rgba(239,83,80,0.9)';
    ctx.fillRect(W-pad.r,hy-7,pad.r,14);
    ctx.fillStyle='#fff';ctx.font='bold 8px JetBrains Mono,monospace';ctx.textAlign='left';
    ctx.fillText(fmtN(Math.round(hc.c)),W-pad.r+3,hy+3);
  }
  _updHdr(_hoverIdx>=0?_candles[_hoverIdx]:_candles[n-1]);
}

function renderTrendDeltas(){
  var el=$('trend-deltas');if(!el||!_trendData.length)return;
  if(_trendData.length<4){el.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--mute);font-size:.45rem;padding:8px">Minimal 4 data points untuk delta.</div>';return}
  var mid=Math.floor(_trendData.length/2);
  var keys=[{k:'coin_total',label:'Coin Supply',color:'var(--gold)'},{k:'player_count',label:'Pemain',color:'var(--cyan)'},{k:'coin_median',label:'Median Coin',color:'var(--green)'},{k:'coin_avg',label:'Avg Coin',color:'var(--ac)'}];
  var h='';
  for(var i=0;i<keys.length;i++){
    var ki=keys[i],sA=0,cA=0,sB=0,cB=0;
    for(var j=0;j<mid;j++){sA+=(_trendData[j][ki.k]||0);cA++}
    for(var j=mid;j<_trendData.length;j++){sB+=(_trendData[j][ki.k]||0);cB++}
    var aA=cA?sA/cA:0,aB=cB?sB/cB:0,d=aB-aA,pct=aA>0?Math.round(d/aA*100):0;
    var sg=d>0?'+':'',cl=Math.abs(pct)<2?'var(--mute)':d>0?'var(--green)':'var(--red)';
    var last=_trendData[_trendData.length-1][ki.k]||0;
    h+=mkStatCard(ki.label,ki.color,fmtN(last),'<span style="color:'+cl+'">'+sg+pct+'%</span>');
  }
  el.innerHTML=h;
}

setInterval(fetchAll,120000);
document.addEventListener('visibilitychange',function(){if(!document.hidden)fetchAll()});

window.addEventListener('DOMContentLoaded',function(){
  bindTrendTabs();
  setTimeout(drawTrendChart,100);
  var cv=$('trend-chart');
  if(cv){
    cv.addEventListener('mousemove',function(e){
      if(!_candles.length)return;
      var rect=cv.getBoundingClientRect(),sc=cv.width/rect.width;
      var sx=(e.clientX-rect.left)*sc,n=_candles.length;
      var pad_l=6,pad_r=52,cw=cv.width-pad_l-pad_r;
      var gap=Math.max(1,Math.round(cw*0.12/n));
      var bw=Math.max(3,Math.floor((cw-gap*(n-1))/n));if(bw>28)bw=28;
      var tw=n*bw+(n-1)*gap,ox=pad_l+Math.floor((cw-tw)/2);
      var idx=Math.round((sx-ox-bw/2)/(bw+gap));
      if(idx<0)idx=0;if(idx>=n)idx=n-1;
      if(_hoverIdx!==idx){_hoverIdx=idx;drawTrendChart()}
    });
    cv.addEventListener('mouseleave',function(){if(_hoverIdx!==-1){_hoverIdx=-1;drawTrendChart()}});
  }
});
window.addEventListener('resize',function(){drawTrendChart()});
})();
