// ureten: codex · Yalnız açık uygulama kabuğu; /api ve özel veri hiçbir zaman cache'lenmez.
const CACHE_PREFIX = `ucuz-radar-shell:${self.registration.scope}:`;
const CACHE_NAME = `${CACHE_PREFIX}2026.10.20.2`;
const SHELL = ['index.html','styles.css','app.js','manifest.webmanifest','icons/icon.svg','icons/icon-192.png','icons/icon-512.png'];
const baseUrl = new URL(self.registration.scope);
const shellUrls = new Set(SHELL.map(path=>new URL(path,baseUrl).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll([...shellUrls]))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const request=event.request;const url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==baseUrl.origin||url.pathname.includes('/api/')||request.headers.has('Authorization'))return;
  if(url.href===new URL('config.json',baseUrl).href){event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>new Response('{"apiBase":"","offline":true}',{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})));return;}
  if(request.mode==='navigate'&&url.pathname.startsWith(baseUrl.pathname)){
    event.respondWith(fetch(request).catch(()=>caches.open(CACHE_NAME).then(cache=>cache.match(new URL('index.html',baseUrl).href))));return;
  }
  if(shellUrls.has(url.href))event.respondWith(caches.open(CACHE_NAME).then(async cache=>(await cache.match(request))||fetch(request)));
});
self.addEventListener('push',event=>event.waitUntil((async()=>{
  let data={};try{data=event.data?.json()||{};}catch{}
  // Bildirim payload'ı yönlendirme adresi veya HTML çalıştıramaz.
  await self.registration.showNotification('RADAR · Yeni fırsat',{body:typeof data.body==='string' ? data.body.slice(0,180) : 'Çalışma masanda yeni bir fırsat var.',icon:new URL('icons/icon-192.png',baseUrl).href,badge:new URL('icons/icon-192.png',baseUrl).href,tag:typeof data.tag==='string'?data.tag.slice(0,80):'radar-opportunity',data:{route:baseUrl.pathname}});
})()));
self.addEventListener('notificationclick',event=>{
  event.notification.close();event.waitUntil((async()=>{
    for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})){const url=new URL(client.url);if(url.origin===baseUrl.origin&&url.pathname.startsWith(baseUrl.pathname)){await client.focus();return;}}
    await self.clients.openWindow(baseUrl.href);
  })());
});
