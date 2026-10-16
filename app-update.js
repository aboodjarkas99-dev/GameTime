(()=>{
  if(window.__gameTimeUpdates)return;window.__gameTimeUpdates=true;
  let latest='',checking=false;
  async function check(){
    if(checking||document.hidden||!navigator.onLine)return;checking=true;
    try{
      const response=await fetch('/release.json',{cache:'no-store'});if(!response.ok)return;
      const release=await response.json();if(!/^[A-Za-z0-9_-]{1,60}$/.test(release.version||''))return;
      if(release.version!==latest){
        latest=release.version;
        const manifest=document.querySelector('link[rel="manifest"]');if(manifest)manifest.href='/manifest.webmanifest?v='+latest;
        const apple=document.querySelector('link[rel="apple-touch-icon"]');if(apple)apple.href='/app-icon-180.png?v='+latest;
        const icon=document.querySelector('link[rel="icon"]');if(icon)icon.href='/app-icon-192.png?v='+latest;
      }
      if('serviceWorker' in navigator){const registration=await navigator.serviceWorker.register('/sw.js');await registration.update();}
    }catch{}finally{checking=false;}
  }
  void check();setInterval(check,300000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check()});
  window.addEventListener('online',()=>void check());
})();
