const VERSION='shelfcheck-famicom-test-pwa-v1';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('shelfcheck-')).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
// Deliberately no fetch caching in the test build.
// The service worker exists only to allow real PWA installation while we keep live updates fresh.
self.addEventListener('fetch',()=>{});
