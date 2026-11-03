// GameTime release 20261016b — refresh branding metadata without reloading active work.
self.addEventListener('install', event => {
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('push',event=>{event.waitUntil((async()=>{let data={};try{data=event.data?.json()||{}}catch{}const url=new URL(data.url||'/index.html',self.location.origin);if(url.origin!==self.location.origin)return;await self.registration.showNotification(data.title||'GameTime',{body:data.body||'New work is available.',icon:'/app-icon-192.png',badge:'/app-icon-192.png',tag:data.tag||'gametime-work',data:{url:url.href}})})())});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const url=new URL(event.notification.data?.url||'/index.html',self.location.origin);if(url.origin!==self.location.origin)return;const tabs=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const tab of tabs){if(new URL(tab.url).origin===url.origin){await tab.navigate(url.href);await tab.focus();return}}await self.clients.openWindow(url.href)})())});
