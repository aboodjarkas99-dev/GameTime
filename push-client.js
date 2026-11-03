(()=>{
 const client=db;let busy=false,user=null;
 const panel=document.createElement('details');panel.className='push-settings';panel.hidden=true;panel.innerHTML='<summary>🔔 Notifications</summary><p id="pushStatus">Enable new-work alerts and reminders at 10 AM, noon and 2 PM, Monday–Friday.</p><button type="button" id="pushEnable">Enable notifications</button><button type="button" id="pushDisable" hidden>Turn off on this device</button>';document.body.appendChild(panel);
 const status=panel.querySelector('#pushStatus'),enable=panel.querySelector('#pushEnable'),disable=panel.querySelector('#pushDisable');
 function bytes(key){const value=atob(key.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(value,c=>c.charCodeAt(0))}
 async function existing(){const reg=await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;return{reg,sub:await reg.pushManager.getSubscription()}}
 async function save(sub){const json=sub.toJSON(),r=await client.rpc('register_push',{p_endpoint:json.endpoint,p_keys:json.keys});if(r.error)throw r.error;status.textContent='Notifications on · New work immediately; unfinished work at 10 AM, noon and 2 PM (Arkansas time).';enable.hidden=true;disable.hidden=false}
 async function refresh(){
  const session=await client.auth.getSession();user=session.data.session?.user||null;panel.hidden=!user;if(!user)return;
  if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)){status.textContent='On iPhone: add GameTime to your Home Screen, then open it there to enable notifications.';enable.hidden=true;return}
  try{if(Notification.permission==='granted'){const {sub}=await existing();if(sub)await save(sub)}}catch{status.textContent='Reconnect, then enable notifications again.'}
 }
 enable.onclick=async()=>{if(busy)return;busy=true;enable.disabled=true;try{
  const permission=await Notification.requestPermission();if(permission!=='granted'){status.textContent='Notifications are not allowed. Enable them in your browser or phone settings.';return}
  const {reg,sub}=await existing();const key=await client.rpc('push_public_key');if(key.error||!key.data)throw key.error||new Error('Notifications are not ready');
  await save(sub||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(key.data)}));
 }catch(e){status.textContent=e.message||'Could not enable notifications.'}finally{busy=false;enable.disabled=false}};
 disable.onclick=async()=>{if(busy)return;busy=true;try{const {sub}=await existing();if(sub){const r=await client.from('push_subscriptions').delete().eq('endpoint',sub.endpoint);if(r.error)throw r.error;await sub.unsubscribe()}enable.hidden=false;disable.hidden=true;status.textContent='Notifications off on this device.'}catch(e){status.textContent=e.message}finally{busy=false}};
 client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){panel.hidden=true;if('serviceWorker'in navigator)void navigator.serviceWorker.getRegistration('/').then(r=>r?.pushManager?.getSubscription()).then(s=>s?.unsubscribe())}else if(event==='SIGNED_IN')setTimeout(()=>void refresh(),0)});void refresh();
})();
