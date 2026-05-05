/* Service Worker — Laughtale SMP Monitor */
var CACHE='lt-monitor-v1';
var ASSETS=[
  'monitor.html',
  'js/monitor-page.js',
  'css/pages.css',
  'assets/favicon.svg'
];

self.addEventListener('install',function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(ASSETS);}));
  self.skipWaiting();
});

self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
  }));
  self.clients.claim();
});

self.addEventListener('fetch',function(e){
  // Network first for API calls, cache first for assets
  if(e.request.url.indexOf('supabase.co')!==-1){
    e.respondWith(fetch(e.request).catch(function(){return caches.match(e.request);}));
  }else{
    e.respondWith(caches.match(e.request).then(function(r){
      return r||fetch(e.request).then(function(res){
        if(res.status===200){
          var cl=res.clone();
          caches.open(CACHE).then(function(c){c.put(e.request,cl);});
        }
        return res;
      });
    }).catch(function(){
      if(e.request.mode==='navigate'){
        return new Response('<html><body style="background:#09090f;color:#fff;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2>⚡ Laughtale SMP</h2><p>Monitor membutuhkan koneksi internet.</p><p style="opacity:.5">Coba refresh halaman saat online.</p></div></body></html>',{headers:{'Content-Type':'text/html'}});
      }
    }));
  }
});
