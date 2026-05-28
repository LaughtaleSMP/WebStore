/* atmo-canvas.js — Realistic rain & thunder engine untuk Atmosphere card.
   Port dari ref petir.html / hujan.html, modularized.

   Public API (factory):
     var fx = window.AtmoCanvas(canvasEl);
     fx.setMode('clear'|'rain'|'thunder');
     fx.setIntensity(0..1);
     fx.triggerBolt(x?);                  // manual bolt at x (px relative to canvas)
     fx.setPointer(x|null);               // for auto-bolt to bias around pointer
     fx.start(); fx.stop(); fx.destroy();

   Auto-pause: tab hidden / prefers-reduced-motion / mode==='clear'.
   ResizeObserver: re-init gradients & drop count.
   Honor Iron Rules: ≤500 lines, no console.log production.
*/
(function(){
'use strict';

function rnd(a,b){ return a + Math.random()*(b-a); }

window.AtmoCanvas = function(canvas, opts){
  opts = opts || {};
  var ctx = canvas.getContext('2d');
  var W=0, H=0, DPR=1;
  var mode='clear', intensity=1.0;
  var rafId=0, running=false;
  var drops=[], splashes=[], ripples=[], streaks=[], bolts=[], clouds=[];
  var flashAlpha=0, nextBolt=0, pointerX=null;
  var skyG, fogG, groundG, wetG;
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Config
  var DROP_DENSITY = 0.00028;       // drops per sqpx target (scaled by intensity)
  var DROP_SPEED   = [9, 20];
  var DROP_WIND    = 1.6;
  var DROP_LEN     = [10, 26];
  var DROP_ALPHA   = [0.07, 0.26];
  var BOLT_INT     = [1500, 4500];
  var SPLASH_N     = [3, 6];
  var RIPPLE_MAX   = 32;
  var STREAK_MAX   = 40;

  function targetDropCount(){
    var n = W*H * DROP_DENSITY * intensity;
    return Math.max(8, Math.min(260, Math.round(n)));
  }

  function buildGradients(){
    fogG = ctx.createLinearGradient(0, H*0.75, 0, H);
    fogG.addColorStop(0, 'rgba(18,30,52,0)');
    fogG.addColorStop(1, 'rgba(18,30,52,0.20)');
    groundG = ctx.createLinearGradient(0, H*0.93, 0, H);
    groundG.addColorStop(0, 'rgba(10,18,32,0)');
    groundG.addColorStop(1, 'rgba(12,22,40,0.55)');
    wetG = ctx.createLinearGradient(0, H*0.94, 0, H);
    wetG.addColorStop(0, 'rgba(60,100,170,0)');
    wetG.addColorStop(1, 'rgba(60,100,170,0.07)');
  }

  function buildClouds(){
    clouds.length = 0;
    var n = Math.floor(rnd(3,5));
    for(var i=0;i<n;i++){
      clouds.push({
        x: rnd(0,W), y: rnd(H*0.02, H*0.20),
        rx: rnd(70, 180), ry: rnd(20, 50),
        a: rnd(0.05, 0.13),
        drift: rnd(-0.06, 0.06),
      });
    }
  }

  function mkDrop(restart){
    return {
      x: rnd(-W*0.2, W*1.1),
      y: restart ? rnd(-H*0.5, -10) : rnd(-H, H),
      vx: DROP_WIND + rnd(-0.2, 0.2),
      vy: rnd(DROP_SPEED[0], DROP_SPEED[1]),
      len: rnd(DROP_LEN[0], DROP_LEN[1]),
      a: rnd(DROP_ALPHA[0], DROP_ALPHA[1]),
      w: rnd(0.3, 0.65),
    };
  }

  function syncDropCount(){
    var t = targetDropCount();
    while(drops.length < t) drops.push(mkDrop(false));
    if(drops.length > t) drops.length = t;
  }

  function mkSplash(x,y){
    var n = Math.floor(rnd(SPLASH_N[0], SPLASH_N[1]));
    for(var i=0;i<n;i++){
      var ang = rnd(-Math.PI*0.92, -Math.PI*0.08);
      var spd = rnd(0.8, 3.2);
      splashes.push({
        x:x, y:y, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd,
        life:1.0, decay:rnd(0.07, 0.16), r:rnd(0.6, 1.8),
      });
    }
    if(ripples.length < RIPPLE_MAX){
      ripples.push({x:x, y:y, rx:0, ry:0, maxRx:rnd(8,20), life:1.0, decay:rnd(0.03,0.06)});
    }
  }

  function mkSegments(x1,y1,x2,y2,depth,segs){
    if(depth<=0 || Math.abs(y2-y1)<5){
      segs.push({x1:x1,y1:y1,x2:x2,y2:y2, w: depth*0.35 + 0.25});
      return;
    }
    var mx = (x1+x2)/2 + rnd(-30, 30) * (depth/5.5);
    var my = (y1+y2)/2 + rnd(-6, 6);
    mkSegments(x1,y1,mx,my,depth-1,segs);
    mkSegments(mx,my,x2,y2,depth-1,segs);
    if(depth>=2 && Math.random()<0.42){
      var bx = mx + rnd(10, 60) * (Math.random()<0.5 ? 1 : -1);
      var by = my + rnd(H*0.08, H*0.32);
      mkSegments(mx,my,bx,by,depth-2,segs);
    }
  }

  function spawnBolt(tx){
    var sx = (tx !== undefined && tx !== null) ? tx : rnd(W*0.08, W*0.92);
    var sy = rnd(0, H*0.06);
    var ex = sx + rnd(-60, 60);
    var ey = H * rnd(0.55, 0.95);
    var segs = [];
    mkSegments(sx, sy, ex, ey, 5, segs);
    bolts.push({segs:segs, life:1.0, decay:rnd(0.04, 0.08)});
    flashAlpha = rnd(0.12, 0.28);
    scheduleNext();
  }

  function scheduleNext(){
    var k = Math.max(0.3, intensity);
    nextBolt = performance.now() + rnd(BOLT_INT[0]/k, BOLT_INT[1]/k);
  }

  function drawClouds(lit){
    for(var i=0;i<clouds.length;i++){
      var c = clouds[i];
      var base = lit ? 'rgba(100,130,190,'+(c.a*1.6)+')' : 'rgba(65,90,140,'+(c.a*0.7)+')';
      var g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.rx);
      g.addColorStop(0, base);
      g.addColorStop(0.55, lit ? 'rgba(80,110,170,'+(c.a*0.8)+')' : 'rgba(40,65,110,'+(c.a*0.4)+')');
      g.addColorStop(1, 'rgba(20,35,70,0)');
      ctx.save();
      ctx.scale(1, c.ry/c.rx);
      ctx.beginPath();
      ctx.ellipse(c.x, c.y * (c.rx/c.ry), c.rx, c.rx, 0, 0, Math.PI*2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
      c.x += c.drift;
      if(c.x > W + c.rx) c.x = -c.rx;
      if(c.x < -c.rx) c.x = W + c.rx;
    }
  }

  function drawRain(){
    ctx.lineCap = 'round';
    for(var i=0;i<drops.length;i++){
      var d = drops[i];
      var dx = d.vx * (d.len/d.vy);
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - dx, d.y - d.len);
      ctx.strokeStyle = 'rgba(160,205,235,'+d.a+')';
      ctx.lineWidth = d.w;
      ctx.stroke();
      d.x += d.vx; d.y += d.vy;
      if(d.y > H){
        if(Math.random() < 0.55) mkSplash(d.x, H - rnd(1,3));
        Object.assign(d, mkDrop(true));
      }
    }
  }

  function drawSplashes(){
    for(var i=splashes.length-1;i>=0;i--){
      var s = splashes[i];
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(180,215,240,'+(s.life*0.45)+')';
      ctx.fill();
      s.x += s.vx; s.y += s.vy;
      s.vy += 0.14;
      s.life -= s.decay;
      if(s.life <= 0) splashes.splice(i,1);
    }
  }

  function drawRipples(){
    for(var i=ripples.length-1;i>=0;i--){
      var r = ripples[i];
      r.rx = r.maxRx * (1 - r.life);
      r.ry = r.rx * 0.28;
      var a = r.life * 0.55;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.rx + 0.5, r.ry + 0.5, 0, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(160,205,240,'+(a*0.35)+')';
      ctx.lineWidth = 1.0;
      ctx.stroke();
      if(r.rx > 1.5){
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.rx-1.2, Math.max(0.1, r.ry-0.3), 0, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(200,230,255,'+a+')';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      r.life -= r.decay;
      if(r.life <= 0) ripples.splice(i,1);
    }
  }

  function drawBolts(){
    for(var i=bolts.length-1;i>=0;i--){
      var b = bolts[i], a = b.life;
      for(var j=0;j<b.segs.length;j++){
        var s = b.segs[j];
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2);
        ctx.strokeStyle = 'rgba(100,150,255,'+(a*0.08)+')';
        ctx.lineWidth = (s.w + 1) * 8;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.stroke();
        ctx.strokeStyle = 'rgba(160,200,255,'+(a*0.18)+')';
        ctx.lineWidth = (s.w + 1) * 3.5;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(210,230,255,'+(a*0.35)+')';
        ctx.lineWidth = s.w * 1.6;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2);
        ctx.strokeStyle = 'rgba(240,248,255,'+a+')';
        ctx.lineWidth = s.w * 0.7;
        ctx.stroke();
      }
      // Reflection at ground
      if(b.life > 0.4){
        var ra = a * 0.06;
        for(var k=0;k<b.segs.length;k++){
          var s2 = b.segs[k];
          var ry1 = H + (H - s2.y1) * 0.10;
          var ry2 = H + (H - s2.y2) * 0.10;
          if(ry1 > H*0.93 && ry2 > H*0.93){
            ctx.beginPath();
            ctx.moveTo(s2.x1, ry1); ctx.lineTo(s2.x2, ry2);
            ctx.strokeStyle = 'rgba(180,210,255,'+ra+')';
            ctx.lineWidth = s2.w * 0.5;
            ctx.stroke();
          }
        }
      }
      b.life -= b.decay;
      if(b.life <= 0) bolts.splice(i,1);
    }
  }

  function drawFlash(){
    if(flashAlpha <= 0) return;
    ctx.fillStyle = 'rgba(170,195,255,'+flashAlpha+')';
    ctx.fillRect(0,0,W,H);
    flashAlpha *= 0.74;
    if(flashAlpha < 0.004) flashAlpha = 0;
  }

  function drawGround(){
    ctx.fillStyle = groundG; ctx.fillRect(0,0,W,H);
    ctx.fillStyle = wetG;    ctx.fillRect(0,0,W,H);
    for(var i=streaks.length-1;i>=0;i--){
      var s = streaks[i];
      ctx.beginPath();
      ctx.moveTo(s.x, H - s.len*0.5);
      ctx.lineTo(s.x, H);
      ctx.strokeStyle = 'rgba(140,190,230,'+s.a+')';
      ctx.lineWidth = s.w;
      ctx.stroke();
      s.a -= 0.001;
      if(s.a <= 0) streaks.splice(i,1);
    }
    if(Math.random() < 0.06 && streaks.length < STREAK_MAX){
      streaks.push({x:rnd(0,W), len:rnd(4,16), a:rnd(0.03,0.09), w:rnd(0.4,1.0)});
    }
  }

  function loop(now){
    if(!running){ rafId = 0; return; }
    if(document.hidden){ rafId = requestAnimationFrame(loop); return; }
    ctx.clearRect(0,0,W,H);
    if(mode === 'thunder' && now >= nextBolt){
      spawnBolt(pointerX !== null ? pointerX + rnd(-40,40) : undefined);
    }
    var lit = mode === 'thunder' && flashAlpha > 0.05;
    if(mode !== 'clear'){ drawClouds(lit); drawRain(); }
    if(mode === 'thunder'){ drawBolts(); drawFlash(); }
    drawGround();
    drawSplashes();
    drawRipples();
    ctx.fillStyle = fogG; ctx.fillRect(0,0,W,H);
    rafId = requestAnimationFrame(loop);
  }

  function resize(){
    DPR = Math.min(window.devicePixelRatio || 1, 1.5) * 0.7;
    // Pakai clientWidth/clientHeight (mengikuti CSS inset:0 stretch ke parent),
    // BUKAN getBoundingClientRect/style.width — supaya canvas tetap stretchy saat parent resize.
    W = Math.max(40, canvas.clientWidth | 0);
    H = Math.max(40, canvas.clientHeight | 0);
    canvas.width  = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildGradients();
    syncDropCount();
  }

  function start(){
    if(running) return;
    if(reduceMotion){
      // Static one-time render
      ctx.clearRect(0,0,W,H);
      drawGround();
      ctx.fillStyle = fogG; ctx.fillRect(0,0,W,H);
      return;
    }
    running = true;
    scheduleNext();
    if(!rafId) rafId = requestAnimationFrame(loop);
  }

  function stop(){
    running = false;
    if(rafId){ cancelAnimationFrame(rafId); rafId = 0; }
    ctx.clearRect(0,0,W,H);
  }

  function setMode(m){
    if(m === mode) return;
    mode = m;
    if(mode === 'clear'){ stop(); return; }
    if(mode !== 'thunder'){ bolts.length = 0; flashAlpha = 0; }
    syncDropCount();
    start();
  }

  function setIntensity(v){
    intensity = Math.max(0, Math.min(1, Number(v) || 0));
    syncDropCount();
  }

  // Init
  resize();
  buildClouds();

  // ResizeObserver / fallback
  var ro = null;
  if(window.ResizeObserver){
    ro = new ResizeObserver(function(){ resize(); buildClouds(); });
    ro.observe(canvas);
  } else {
    window.addEventListener('resize', function(){ resize(); buildClouds(); });
  }

  // Reduce-motion live update
  if(window.matchMedia){
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var onMQ = function(e){
      reduceMotion = e.matches;
      if(reduceMotion){ stop(); }
      else if(mode !== 'clear' && !running){ start(); }
    };
    if(mq.addEventListener) mq.addEventListener('change', onMQ);
    else if(mq.addListener) mq.addListener(onMQ);
  }

  // Visibility resume
  document.addEventListener('visibilitychange', function(){
    if(!document.hidden && mode !== 'clear' && running && !rafId){
      rafId = requestAnimationFrame(loop);
    }
  });

  return {
    setMode: setMode,
    setIntensity: setIntensity,
    triggerBolt: function(x){ if(mode === 'thunder') spawnBolt(x); },
    setPointer: function(x){ pointerX = (x === null || x === undefined) ? null : x; },
    start: start,
    stop: stop,
    destroy: function(){ stop(); if(ro) ro.disconnect(); },
  };
};

})();
