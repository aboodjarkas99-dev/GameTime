/* Factory Board: integrated read-only workspace. Uses the existing GameTime session. */
(() => {
"use strict";
window.mountGameTimeFactoryBoard = function(host, client, urlBase, publishableKey) {
 if (!host || !client) throw Error("Factory Board is not initialized");
 const root=host.shadowRoot||host.attachShadow({mode:"open"});
 root.innerHTML="<style>\n:host{color-scheme:light;--bg:#f4f4f1;--ink:#202020;--muted:#686866;--rule:#b4b4af;font-family:Arial,Helvetica,sans-serif}\n*{box-sizing:border-box}\n:host{display:block;height:100%;min-height:0;direction:ltr;text-align:left}\n:host{background:var(--bg);color:var(--ink)}\n[hidden]{display:none!important}\n#display{direction:ltr;height:100vh;min-height:680px;display:grid;grid-template-rows:66px minmax(0,1fr) minmax(180px,28vh);gap:14px;padding:16px 24px 18px;max-width:2600px;margin:auto}\nheader{display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:1px solid var(--rule);padding-bottom:12px}\n.brand{display:flex;align-items:center;gap:16px}.logo{font-weight:900;letter-spacing:-1.4px;font-size:clamp(25px,2.2vw,40px);color:#202020}.brandline{border-left:1px solid var(--rule);padding-left:16px;font-size:clamp(16px,1.4vw,25px);font-weight:700}.brandline small{display:block;color:var(--muted);font-size:.65em;letter-spacing:1px;margin-top:4px}\n.clock{text-align:right;font-size:clamp(25px,2.5vw,46px);font-weight:700;white-space:nowrap}.clock small{display:block;font-size:clamp(12px,1vw,19px);color:var(--muted);font-weight:400}\n#connection{font-size:clamp(12px,1vw,18px);color:#454545;white-space:nowrap;font-weight:700}#connection.stale,#connection.demo{color:#454545;border-bottom:1px dashed #777}\n.board{direction:ltr;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;min-height:0}\n.lane{min-width:0;overflow:hidden;display:flex;flex-direction:column;background:transparent}\n.lane+.lane{border-left:1px solid var(--rule)}\n.lane-head{padding:9px 23px 15px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-shrink:0}\n.lane-head h2{font-size:clamp(20px,1.75vw,34px);margin:0;font-weight:800;letter-spacing:-.4px;color:var(--ink)}.count{font-size:clamp(16px,1.4vw,26px);font-weight:500;color:var(--muted)}\n.lane-body{flex:1;min-height:0;display:flex;flex-direction:column;gap:19px;padding:12px 23px 17px;overflow:hidden}\n.pagehint{min-height:19px;color:var(--muted);font-size:12px;text-align:right;padding:0 23px 4px}\n.paper{position:relative;flex:0 0 auto;background:#fff;color:var(--ink);border:1px solid #d2d2cd;border-radius:0;padding:21px 17px 14px;box-shadow:1px 3px 5px #00000012,3px 7px 12px #0000000a;min-height:108px;overflow:visible}\n.paper h3{margin:0 0 9px;font-size:clamp(19px,1.75vw,31px);line-height:1.08;overflow-wrap:anywhere;font-weight:800}\n.paper .meta{display:flex;justify-content:space-between;align-items:center;gap:7px;font-size:clamp(13px,1vw,19px);font-weight:700}\n.paper .detail{border-top:1px solid #deded9;padding-top:8px;margin-top:9px;font-size:clamp(13px,1.02vw,19px);font-weight:600;line-height:1.3;overflow-wrap:anywhere}\n.paper .extra{font-size:clamp(11px,.85vw,16px);margin-top:5px;color:var(--muted)}\n.tag{display:inline-block;font-size:clamp(10px,.8vw,15px);white-space:nowrap;line-height:1.1;font-weight:600;color:#666}\n.tag.rush{font-weight:900;color:#222;text-decoration:underline}.tag.working{font-weight:800;color:#222}.tag.done{font-weight:800;color:#222}\n.empty{display:grid;place-items:center;flex:1;min-height:50px;color:#898986;font-size:clamp(16px,1.5vw,26px);text-align:center;padding:10px}\n.shipping{border-top:1px solid var(--rule);min-height:0;overflow:hidden;display:flex;flex-direction:column;background:transparent}\n.ship-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0 9px;flex-shrink:0}.ship-head h2{font-size:clamp(18px,1.65vw,30px);margin:0;white-space:nowrap;font-weight:800}.ship-head h2 small{display:inline-block;font-size:clamp(11px,.85vw,16px);color:var(--muted);font-weight:400;margin-left:9px;white-space:normal}\n.ship-counts{display:flex;gap:14px;color:#555;font-size:clamp(12px,1vw,18px);white-space:nowrap}.ship-counts b{color:#202020}\n.ship-body{min-height:0;flex:1;overflow:hidden;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 24px;padding:0 0 7px;align-content:start}\n.shiprow{background:transparent;border-bottom:1px solid #d9d9d5;display:grid;grid-template-columns:minmax(84px,19%) minmax(0,1fr) auto;align-items:center;gap:10px;padding:8px 0;min-height:37px;font-size:clamp(13px,1.1vw,22px);line-height:1.2}.shiprow .number{font-weight:700;color:#222;overflow-wrap:anywhere}.shiprow .product{overflow-wrap:anywhere}.shiprow .qty{font-weight:700;white-space:nowrap}.shiprow .number small{display:block;color:var(--muted);font-size:.65em;font-weight:400}\n.ship-footer{display:flex;justify-content:space-between;gap:12px;padding:0 0 4px;color:var(--muted);font-size:12px}\n@media(max-width:850px){#display{height:auto;min-height:100vh;grid-template-rows:auto auto auto;padding:12px}.board{grid-template-columns:1fr}.lane+.lane{border-left:0;border-top:1px solid var(--rule)}.lane-body{min-height:180px;max-height:400px}.shipping{height:380px}.ship-body{grid-template-columns:1fr}.ship-head{flex-wrap:wrap}header{flex-wrap:wrap}.paper{min-height:95px}.brandline small{font-size:12px}}\n@media(prefers-reduced-motion:reduce){*{animation:none!important}}\n/* 03 — Executive: tailored navy and ivory, print-like */\n:host{--bg:#fbfaf7;--ink:#1d2937;--muted:#65717d;--rule:#9ba7b1;font-family:Arial,Helvetica,sans-serif}\nheader{border-bottom:3px solid #20374b}\n.logo{color:#20374b;letter-spacing:2px;font-size:clamp(21px,2vw,35px)}\n.brandline{font-size:clamp(15px,1.3vw,23px);text-transform:uppercase;letter-spacing:1px}\n.lane-head{border-bottom:1px solid #b9c1c7;margin:0 18px;padding:12px 0}\n.lane-head h2{font-family:Georgia,serif;font-size:clamp(20px,2vw,36px);font-weight:400;color:#20374b}\n.count{font-family:Georgia,serif;font-size:30px;color:#20374b}\n.paper{border:1px solid #d8dce0;border-top:3px solid #20374b;box-shadow:0 2px 5px #20374b0b;padding:15px}\n.paper h3{font-weight:700}\n.tag{letter-spacing:.9px;background:#f1f5f9;color:#475569;border-radius:5px;padding:5px 7px}\n.tag.working{background:#fef3c7;color:#92400e}\n.tag.done{background:#dcfce7;color:#166534}\n.tag.rush{background:#fee2e2;color:#991b1b;text-decoration:none}\n.shipping{border-top:3px solid #20374b}\n.ship-head h2{font-family:Georgia,serif;font-weight:400;color:#20374b}\n\n#display{height:100%;min-height:0;max-width:none;grid-template-rows:60px minmax(0,1fr) minmax(140px,28%);gap:10px;padding:14px 18px}\n@media(min-width:851px) and (max-height:780px){#display{grid-template-rows:48px minmax(0,1fr) minmax(115px,25%);gap:6px;padding:8px 13px}.lane-head{padding-top:7px;padding-bottom:7px}.lane-body{gap:10px;padding-top:8px;padding-bottom:8px}.paper{padding:12px;min-height:82px}.paper .detail{margin-top:5px;padding-top:5px}.ship-head{padding-top:7px;padding-bottom:6px}}\n@media(max-width:850px){:host{height:auto;min-height:0}#display{height:auto;min-height:0;grid-template-rows:auto auto auto}.lane-body{min-height:180px;max-height:400px}.shipping{height:380px}.ship-head h2{white-space:normal}}\n:host{container-type:inline-size}\n@container (max-width:660px){.board{grid-template-columns:1fr}.lane+.lane{border-left:0;border-top:1px solid var(--rule)}#display{height:auto;grid-template-rows:auto auto auto}.lane-body{min-height:180px;max-height:400px}.shipping{height:380px}.ship-body{grid-template-columns:1fr}.ship-head{flex-wrap:wrap}header{flex-wrap:wrap}}\n</style><main id=\"display\">\n<header><div class=\"brand\"><div class=\"logo\">GAMETIME</div><div class=\"brandline\">FACTORY BOARD<small>TODAY'S PRODUCTION</small></div></div><span id=\"connection\">Connecting…</span><div class=\"clock\" id=\"clock\"></div></header>\n<section class=\"board\" aria-label=\"Today's production\">\n<article class=\"lane batch\"><div class=\"lane-head\"><h2>Batch Maker</h2><span class=\"count\" id=\"batchCount\">0</span></div><div class=\"lane-body\" id=\"batchBody\"></div><div class=\"pagehint\" id=\"batchPage\"></div></article>\n<article class=\"lane fill\"><div class=\"lane-head\"><h2>Fill Line</h2><span class=\"count\" id=\"fillCount\">0</span></div><div class=\"lane-body\" id=\"fillBody\"></div><div class=\"pagehint\" id=\"fillPage\"></div></article>\n<article class=\"lane done\"><div class=\"lane-head\"><h2>Work Done</h2><span class=\"count\" id=\"doneCount\">0</span></div><div class=\"lane-body\" id=\"doneBody\"></div><div class=\"pagehint\" id=\"donePage\"></div></article>\n</section>\n<section class=\"shipping\"><div class=\"ship-head\"><h2>Shipping Queue <small>Open shipments · no scheduled ship date</small></h2><div class=\"ship-counts\" id=\"shipCounts\"></div></div><div class=\"ship-body\" id=\"shipBody\"></div><div class=\"ship-footer\"><span>Shipment # · Product · Qty / size</span><span id=\"shipPage\"></span></div></section>\n</main>";
 const $=id=>root.getElementById(id);
 const zone="America/Chicago";
const dateKey=()=>{const p=new Intl.DateTimeFormat("en-US",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());return ["year","month","day"].map(k=>p.find(v=>v.type===k)?.value).join("-");};
const fmtDate=d=>d?new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}):"";
const num=v=>Number(v)||0;
const qty=v=>Number.isFinite(Number(v))?Number(v).toLocaleString("en-US"):String(v??"");
const make=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=String(txt);return e;};
let snapshot=null,signature="",pages={batch:0,fill:0,done:0,ship:0},lastGood=0,busy=false,disposed=false,request=null;
function tick(){const n=new Date();const time=n.toLocaleTimeString("en-US",{timeZone:zone,hour:"numeric",minute:"2-digit"});const date=n.toLocaleDateString("en-US",{timeZone:zone,weekday:"long",month:"short",day:"numeric",year:"numeric"});$("clock").replaceChildren(document.createTextNode(time),make("small","",date));}
function lanes(data){
 const result={batch:[],fill:[],done:[]};
 for(const o of data.orders||[]){
  const bd=o.batch_work_date||o.work_date,pd=o.prod_work_date||o.work_date;
  const b=bd===data.date&&o.batch_active!==false&&!o.production_only;
  const p=pd===data.date&&o.prod_active!==false;
  if(!b&&!p)continue;
  if(o.prod_status==="done"){if(p)result.done.push(o);continue;}
  if(o.batch_status==="done"||o.production_only||o.batch_active===false){if(p||b)result.fill.push(o);}
  else if(b||p)result.batch.push(o);
 }
 const sort=(a,b,k)=>(Number(a[k])||999)-(Number(b[k])||999)||String(a.id).localeCompare(String(b.id));
 result.batch.sort((a,b)=>sort(a,b,"batch_order"));result.fill.sort((a,b)=>sort(a,b,"prod_order"));result.done.sort((a,b)=>sort(a,b,"prod_order"));
 return result;
}
function paper(o,lane,date){
 const e=make("article","paper");e.dataset.order=String(o.id);
 const h=make("h3","",o.product||"Unnamed product");e.append(h);
 const m=make("div","meta");m.append(make("span","","Batch "+(o.batch||"—")));
 const state=lane==="batch"?o.batch_status:o.prod_status;
 const tag=o.held?["tag rush","ON HOLD"]:lane==="done"?["tag done","COMPLETE"]:state==="progress"?["tag working","IN PROGRESS"]:o.priority&&o.priority.toLowerCase()!=="normal"?["tag rush",o.priority]:["tag","READY"];
 m.append(make("span",tag[0],tag[1]));e.append(m);
 const info=[];
 if(num(o.tank)>0)info.push(qty(o.tank)+" gal batch");
 for(const [key,label] of [["quart","Qt"],["gallon","1 Gal"],["five","5 Gal"],["jerry","Jerry"]]){
  if(key==="jerry"&&!o.jerry_enabled&&!num(o.jerry)&&!num(o.actual_jerry))continue;
  const v=lane==="done"?(o["actual_"+key]??o[key]):o[key];
  if(v!==null&&v!==undefined&&v!==""&&String(v)!=="0")info.push(qty(v)+" "+label);
 }
 e.append(make("div","detail",info.join("  ·  ")||"No packaging quantities entered"));
 const extra=[];
 if(lane!=="batch"&&o.batch_made_date&&o.batch_made_date!==date)extra.push("Made "+fmtDate(o.batch_made_date));
 const scheduled=lane==="batch"?(o.batch_work_date||o.work_date):(o.prod_work_date||o.work_date);
 if(scheduled&&scheduled!==date)extra.push("Scheduled "+fmtDate(scheduled));
 if(o.catalyst)extra.push("Catalyst");
 if(o.priority&&o.priority.toLowerCase()!=="normal"&&tag[0]!=="tag rush")extra.push(o.priority);
 if(extra.length)e.append(make("div","extra",extra.join(" · ")));
 return e;
}
function fillPage(host,items,build,pageKey){
 const nodes=items.map(build);host.replaceChildren();
 if(!nodes.length){host.append(make("div","empty",pageKey==="ship"?"No open shipments or shipments completed today":"No orders in this stage"));return {page:0,total:1};}
 // Measure in the actual lane, then group by available screen height.
 const groups=[];let group=[],used=0;
 const styles=getComputedStyle(host);const available=Math.max(100,(host.clientHeight||300)-parseFloat(styles.paddingTop||0)-parseFloat(styles.paddingBottom||0)),gap=parseFloat(styles.rowGap)||0;
 const cols=pageKey==="ship"&&getComputedStyle(host).gridTemplateColumns.split(" ").length>1?2:1;
 if(cols===1){
  for(const node of nodes){host.append(node);const h=node.getBoundingClientRect().height;host.removeChild(node);if(group.length&&used+h+gap>available){groups.push(group);group=[];used=0;}used+=(group.length?gap:0)+h;group.push(node);}
 }else{
  for(let i=0;i<nodes.length;i+=cols){const row=nodes.slice(i,i+cols);host.append(...row);const h=Math.max(...row.map(n=>n.getBoundingClientRect().height));host.replaceChildren();if(group.length&&used+h+gap>available){groups.push(group);group=[];used=0;}used+=(group.length?gap:0)+h;group.push(...row);}
 }
 if(group.length)groups.push(group);
 const index=pages[pageKey]%groups.length;host.append(...groups[index]);return {page:index,total:groups.length};
}
function shippingItems(data){
 const statusRank={READY:0,DRAFT:1,SHIPPED:2};const shipments=[...(data.shipments||[])].sort((a,b)=>(statusRank[a.status]??9)-(statusRank[b.status]??9)||String(b.updated_at||"").localeCompare(String(a.updated_at||"")));
 const lines=[];
 for(const s of shipments){
  const groups=new Map();
  for(const l of s.products||[]){const product=String(l.product||"Unnamed product").replace(/\[\[.*?\]\]/g,"").trim(),size=String(l.size||"");const key=JSON.stringify([product,size]);const old=groups.get(key)||{product,size,qty:0};old.qty+=num(l.qty);groups.set(key,old);}
  if(!groups.size)groups.set("empty",{product:"No product lines",size:"",qty:0});
  for(const l of groups.values())lines.push({...l,number:s.number,status:s.status});
 }
 return lines;
}
function shipRow(l){
 const row=make("div","shiprow"),n=make("div","number",l.number);
 const status=l.status==="READY"?"Ready":l.status==="DRAFT"?"Preparing":"Shipped today";
 n.append(make("small",status.split(" ")[0].toLowerCase(),status));row.append(n,make("div","product",l.product),make("div","qty",qty(l.qty)+(l.size?" · "+l.size:"")));return row;
}
function render(animate=false){
 if(!snapshot)return;
 const prev=new Map([...root.querySelectorAll("[data-order]")].map(e=>[e.dataset.order,{rect:e.getBoundingClientRect(),lane:e.parentElement.id}]));
 const state=lanes(snapshot);
 for(const k of ["batch","fill","done"]){
  $(k+"Count").textContent=state[k].length;
  const r=fillPage($(k+"Body"),state[k],o=>paper(o,k,snapshot.date),k);
  $(k+"Page").textContent=r.total>1?"Page "+(r.page+1)+" / "+r.total:"";
 }
 const count=$("shipCounts");count.replaceChildren();
 for(const [status,label] of [["READY","Ready"],["DRAFT","Preparing"],["SHIPPED","Shipped today"]]){const s=make("span","",label+" ");s.append(make("b","",(snapshot.shipments||[]).filter(x=>x.status===status).length));count.append(s);}
 const sr=fillPage($("shipBody"),shippingItems(snapshot),shipRow,"ship");$("shipPage").textContent=sr.total>1?"Page "+(sr.page+1)+" / "+sr.total+" · auto-rotates":"";
 if(animate&&!matchMedia("(prefers-reduced-motion: reduce)").matches){for(const e of root.querySelectorAll("[data-order]")){const old=prev.get(e.dataset.order);if(!old||old.lane===e.parentElement.id)continue;const next=e.getBoundingClientRect();const ghost=e.cloneNode(true);const style=getComputedStyle(e);Object.assign(ghost.style,{position:"fixed",zIndex:"99",pointerEvents:"none",margin:"0",left:old.rect.left+"px",top:old.rect.top+"px",width:next.width+"px",height:next.height+"px",background:style.backgroundColor,borderLeftColor:style.borderLeftColor});ghost.removeAttribute("data-order");root.append(ghost);e.style.visibility="hidden";const anim=ghost.animate([{transform:"translate(0,0)",opacity:.95},{transform:"translate("+(next.left-old.rect.left)+"px,"+(next.top-old.rect.top)+"px)",opacity:1}],{duration:650,easing:"ease-out"});const finish=()=>{ghost.remove();e.style.visibility="";};anim.onfinish=finish;anim.oncancel=finish;}}
}
function setSnapshot(data){const s=JSON.stringify([data.date,data.orders,data.shipments]);snapshot=data;const changed=s!==signature;if(changed){signature=s;render(true);}}
function status(text,cls=""){$("connection").textContent=text;$("connection").className=cls;}

 function clearData(message,cls="stale"){
  snapshot=null;signature="";lastGood=0;
  for(const k in pages)pages[k]=0;
  for(const id of ["batchCount","fillCount","doneCount"])$(id).textContent="—";
  for(const id of ["batchBody","fillBody","doneBody","shipBody","shipCounts","batchPage","fillPage","donePage","shipPage"])$(id).replaceChildren();
  status(message,cls);
 }
 async function refresh(){
  if(disposed||busy)return;busy=true;
  try{
   const {data:{session}}=await client.auth.getSession();
   if(disposed)return;
   if(!session){clearData("SIGN IN REQUIRED");return;}
   request=new AbortController();
   const timeout=setTimeout(()=>request?.abort(),12000);
   let response;
   try{
    response=await fetch(urlBase+"/functions/v1/factory-display",{method:"POST",headers:{"apikey":publishableKey,"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"},body:"{}",cache:"no-store",signal:request.signal});
   }finally{clearTimeout(timeout);}
   if(disposed)return;
   if(response.status===401||response.status===403){clearData(response.status===403?"ACCESS REQUIRED · contact Management":"SESSION EXPIRED · sign in again");return;}
   if(!response.ok)throw Error("Refresh failed");
   const data=await response.json();
   if(disposed)return;
   if(!Array.isArray(data.orders)||!Array.isArray(data.shipments))throw Error("Invalid snapshot");
   setSnapshot(data);lastGood=Date.now();status("● LIVE");
  }catch(e){
   if(disposed)return;
   if(snapshot&&snapshot.date!==dateKey())clearData("OFFLINE · waiting for today's data");
   else status(lastGood?"OFFLINE · last update "+new Date(lastGood).toLocaleTimeString("en-US",{timeZone:zone,hour:"numeric",minute:"2-digit"}):"CONNECTING · no live data","stale");
  }finally{request=null;busy=false;}
 }
 tick();const clockTimer=setInterval(tick,1000);
 const rotateTimer=setInterval(()=>{if(snapshot&&!disposed){for(const k in pages)pages[k]++;render(false);}},12000);
 const refreshTimer=setInterval(refresh,5000);
 let resizeTimer;
 const resize=new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(!disposed)render(false)},150)});
 resize.observe(host);
 void refresh();
 return {refresh,stop(){disposed=true;request?.abort();clearInterval(clockTimer);clearInterval(rotateTimer);clearInterval(refreshTimer);clearTimeout(resizeTimer);resize.disconnect();root.replaceChildren();}};
};
})();
