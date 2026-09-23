const SUPABASE_URL='https://usbcryjzesfitoddojit.supabase.co';
const SUPABASE_KEY='sb_publishable_9HRzmDByZwIRKG_18w9XIw_TOkk9bJV';
const BUILD='20260923e';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{realtime:{params:{eventsPerSecond:20}}});

const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const view=params.get('view')||'all';
const isManager=view==='all';
const CACHE_KEY='gametime_cloud_cache_v1';
const LEGACY_KEY='gametime_factory_orders_v2';
const DEVICE_KEY='gametime_device_id';
const NAME_KEY='gametime_device_name';
let deviceId=localStorage.getItem(DEVICE_KEY);
if(!deviceId){deviceId=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random());localStorage.setItem(DEVICE_KEY,deviceId)}
let deviceName=(localStorage.getItem(NAME_KEY)||'').trim();
function roleLabel(){return isManager?'Manager':view==='prod'?'Production':'Batch Maker'}
function actor(){return deviceName?deviceName:roleLabel()+'-'+deviceId.slice(-5)}
function refreshUserLabel(){const el=$('currentUser');if(el)el.textContent='👤 '+(deviceName||'Set Your Name')}
let orders=[],logs=[],selected=new Date(),monthCursor=new Date(),editorMode='order',editingId=null,editingVersion=null,autoTarget=null,qtyState=null,saveBusy=false,dragState=null,channel=null,reconcileTimer=null,logPollTick=0;
selected.setHours(12,0,0,0);

function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function num(v){let m=String(v??'').match(/-?\d+(?:\.\d+)?/);return m?Math.max(0,Number(m[0])||0):0}
function boxes(v){return Math.ceil(num(v)/4)}
function prodBatch(v){let m=String(v||'').trim().match(/^(.*?)(\d+)\s*$/);return m?m[1]+String(Number(m[2])+1).padStart(m[2].length,'0'):String(v||'')}
function pretty(d=selected){return d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}
function nextId(){return Date.now()*1000+Math.floor(Math.random()*1000)}
function titleCase(s){return String(s||'').replace(/(^|\s)([a-z])/g,(m,a,b)=>a+b.toUpperCase())}
function statusText(s){return s==='done'?'✓ COMPLETED':s==='progress'?'● IN PROGRESS':'○ NOT STARTED'}
function statusClass(s){return s==='done'?'done-status':s==='progress'?'progress':'ready'}
function setSync(state,label){const el=$('syncStatus');el.className='sync '+state;el.textContent=label||state.toUpperCase()}
let toastTimer=null;function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2200)}
function cache(){localStorage.setItem(CACHE_KEY,JSON.stringify(orders))}
function normalizeLegacy(raw){
  const out=[],seen=new Set();
  for(const o of Array.isArray(raw)?raw:[]){
    const sig=[o.date||'',o.product||'',o.batch||'',o.tank||0,o.quart||'0',o.gallon||'0',o.five||'0',!!o.holdLine].join('|').toLowerCase();
    if(seen.has(sig))continue;seen.add(sig);
    out.push({
      id:Number(o.id)||nextId(),date:o.holdLine?'':(o.date||''),product:o.product||'Untitled',batch:o.batch||'',tank:Number(o.tank)||0,
      quart:String(o.quart??'0'),gallon:String(o.gallon??'0'),five:String(o.five??'0'),batchNote:o.batchNote||'',prodNote:o.prodNote||'',
      priority:o.priority||'Normal',autoTarget:o.autoTarget||null,batchChecked:!!o.batchChecked,prodChecked:!!o.prodChecked,
      batchStatus:o.batchStatus||'ready',prodStatus:o.prodStatus||'ready',held:!!o.held,
      actualQuart:o.actual?.quart??null,actualGallon:o.actual?.gallon??null,actualFive:o.actual?.five??null,
      batchOrder:Number(o.batchOrder)||999,prodOrder:Number(o.prodOrder)||999,holdLine:!!o.holdLine,version:1
    });
  }
  return out;
}
function fromRow(r){return{
  id:Number(r.id),date:r.work_date||'',product:r.product||'',batch:r.batch||'',tank:Number(r.tank)||0,
  quart:String(r.quart??'0'),gallon:String(r.gallon??'0'),five:String(r.five??'0'),batchNote:r.batch_note||'',prodNote:r.prod_note||'',
  priority:r.priority||'Normal',autoTarget:r.auto_target||null,batchChecked:!!r.batch_checked,prodChecked:!!r.prod_checked,
  batchStatus:r.batch_status||'ready',prodStatus:r.prod_status||'ready',held:!!r.held,
  actualQuart:r.actual_quart==null?null:Number(r.actual_quart),actualGallon:r.actual_gallon==null?null:Number(r.actual_gallon),actualFive:r.actual_five==null?null:Number(r.actual_five),
  batchOrder:Number(r.batch_order)||999,prodOrder:Number(r.prod_order)||999,holdLine:!!r.hold_line,version:Number(r.version)||1,
  updatedAt:r.updated_at||null,deletedAt:r.deleted_at||null
}}
function toRow(o){return{
  id:Number(o.id),work_date:o.holdLine?null:(o.date||null),product:o.product||'',batch:o.batch||'',tank:Number(o.tank)||0,
  quart:String(o.quart??'0'),gallon:String(o.gallon??'0'),five:String(o.five??'0'),batch_note:o.batchNote||'',prod_note:o.prodNote||'',
  priority:o.priority||'Normal',auto_target:o.autoTarget||null,batch_checked:!!o.batchChecked,prod_checked:!!o.prodChecked,
  batch_status:o.batchStatus||'ready',prod_status:o.prodStatus||'ready',held:!!o.held,
  actual_quart:o.actualQuart==null?null:Number(o.actualQuart),actual_gallon:o.actualGallon==null?null:Number(o.actualGallon),actual_five:o.actualFive==null?null:Number(o.actualFive),
  actual:{quart:o.actualQuart??null,gallon:o.actualGallon??null,five:o.actualFive??null},
  batch_order:Number(o.batchOrder)||999,prod_order:Number(o.prodOrder)||999,hold_line:!!o.holdLine,
  updated_by:actor(),updated_from:isManager?'manager':view
}}
function mergeOrder(o){const i=orders.findIndex(x=>x.id===o.id);if(o.deletedAt){if(i>=0)orders.splice(i,1)}else if(i>=0)orders[i]=o;else orders.push(o);cache()}
function orderSig(list){return JSON.stringify(list.map(o=>[o.id,o.version,o.batchStatus,o.prodStatus,o.batchChecked,o.prodChecked,o.held,o.actualQuart,o.actualGallon,o.actualFive,o.batchOrder,o.prodOrder,o.holdLine,o.date,o.deletedAt]))}

async function fetchOrders(){
  const {data,error}=await db.from('work_orders').select('*').is('deleted_at',null);
  if(error)throw error;
  return (data||[]).map(fromRow);
}
async function fetchLogs(){
  const {data,error}=await db.from('activity_logs').select('*').order('event_ts',{ascending:false}).limit(200);
  if(error)throw error;
  return (data||[]).map(r=>({id:r.id,ts:new Date(r.event_ts).getTime(),date:r.event_date,product:r.product,dept:r.dept,type:r.event_type,extra:r.extra||'',actor:r.actor||''}));
}
async function importLegacyIfNeeded(cloud){
  if(!isManager||cloud.length)return cloud;
  let raw=[];
  try{raw=JSON.parse(localStorage.getItem(LEGACY_KEY)||'[]')}catch{}
  const legacy=normalizeLegacy(raw).filter(o=>o.product);
  if(!legacy.length)return cloud;
  setSync('syncing','IMPORTING');
  const rows=legacy.map(toRow);
  const {error}=await db.from('work_orders').upsert(rows,{onConflict:'id',ignoreDuplicates:true});
  if(error)throw error;
  toast('Existing work imported to cloud');
  return await fetchOrders();
}
async function initialLoad(){
  try{
    setSync('syncing','SYNCING');
    const cached=JSON.parse(localStorage.getItem(CACHE_KEY)||'[]');if(Array.isArray(cached))orders=cached;
    render();
    let cloud=await fetchOrders();cloud=await importLegacyIfNeeded(cloud);orders=cloud;cache();
    logs=await fetchLogs();render();subscribeLive();setSync('live','LIVE');
    reconcileTimer=setInterval(reconcile,4000);setInterval(checkAppVersion,30000);checkAppVersion();
  }catch(e){console.error(e);setSync('offline','OFFLINE');toast('Cloud connection problem — retrying');setTimeout(initialLoad,3500)}
}
async function checkAppVersion(){
  try{
    const {data,error}=await db.from('app_config').select('config_value').eq('config_key','build').maybeSingle();
    if(error||!data)return;
    if(data.config_value&&data.config_value!==BUILD){
      const u=new URL(location.href);u.searchParams.set('refresh',Date.now().toString());location.replace(u.toString());
    }
  }catch{}
}
async function reconcile(){
  if(!navigator.onLine){setSync('offline','OFFLINE');return}
  try{
    const cloud=await fetchOrders();
    if(orderSig(cloud)!==orderSig(orders)){orders=cloud;cache();render()}
    logPollTick++;if(logPollTick%3===0){logs=await fetchLogs();renderFeedIfOpen()}
    if(!channel)setSync('syncing','SYNCING');
  }catch(e){console.error(e);setSync('offline','OFFLINE')}
}
function subscribeLive(){
  if(channel){db.removeChannel(channel);channel=null}
  channel=db.channel('gametime-live-v3')
    .on('postgres_changes',{event:'*',schema:'public',table:'work_orders'},payload=>{
      if(payload.eventType==='DELETE'){orders=orders.filter(o=>o.id!==Number(payload.old.id));cache();render();return}
      const o=fromRow(payload.new);mergeOrder(o);render();setSync('live','LIVE');
    })
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'activity_logs'},payload=>{
      const r=payload.new;logs.unshift({id:r.id,ts:new Date(r.event_ts).getTime(),date:r.event_date,product:r.product,dept:r.dept,type:r.event_type,extra:r.extra||'',actor:r.actor||''});
      logs=logs.slice(0,200);renderFeedIfOpen();setSync('live','LIVE');
    })
    .subscribe(status=>{if(status==='SUBSCRIBED')setSync('live','LIVE');else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')setSync('syncing','RECONNECTING')});
}
async function patchOrder(id,patch,expectedVersion=null){
  setSync('syncing','SAVING');
  let q=db.from('work_orders').update({...patch,updated_by:actor(),updated_from:isManager?'manager':view}).eq('id',Number(id)).is('deleted_at',null);
  if(expectedVersion!=null)q=q.eq('version',Number(expectedVersion));
  const {data,error}=await q.select().maybeSingle();
  if(error)throw error;
  if(expectedVersion!=null&&!data)return{conflict:true};
  if(data){mergeOrder(fromRow(data));render()}
  setSync('live','LIVE');return{conflict:false,data}
}
async function insertOrder(o){
  setSync('syncing','SAVING');
  const {data,error}=await db.from('work_orders').insert(toRow(o)).select().single();
  if(error)throw error;mergeOrder(fromRow(data));render();setSync('live','LIVE');return data
}

function currentDay(){
  const q=$('search').value.trim().toLowerCase();
  return orders.filter(o=>!o.holdLine&&o.date===iso(selected)&&(!q||(o.product+' '+o.batch+' '+prodBatch(o.batch)).toLowerCase().includes(q)));
}
function actual(o,k){return k==='quart'?o.actualQuart:k==='gallon'?o.actualGallon:o.actualFive}
function pkgClass(o,k){const a=actual(o,k),p=num(o[k]);if(a==null)return'';return a>=p?'done':'partial'}
function pkgCard(o,k,label){
  const a=actual(o,k),p=num(o[k]),mark=a==null?'':(a>=p?'✓':'◐');
  return '<div class="pkg '+pkgClass(o,k)+'" data-qty="'+o.id+'" data-key="'+k+'"><span class="pkgmark">'+mark+'</span><b>'+esc(o[k])+'</b><span>'+label+'</span><small>'+(a==null?(k==='five'?'Tap when filled':boxes(o[k])+' BOXES • Tap when filled'):'ACTUAL '+a+' / '+p)+'</small></div>';
}
function card(o,dept,i){
  const checked=dept==='batch'?o.batchChecked:o.prodChecked,st=dept==='batch'?o.batchStatus:o.prodStatus,bn=dept==='prod'?prodBatch(o.batch):o.batch,note=dept==='prod'?o.prodNote:o.batchNote;
  const drag=isManager?' draggable="true" data-card="'+o.id+'" data-dept="'+dept+'"':'';
  return '<article class="card"'+drag+'>'+
    (isManager?'<div class="draghandle" data-drag="'+o.id+'" data-dept="'+dept+'">☰ DRAG TO REORDER</div>':'')+
    '<div class="tank"><b>'+esc(o.tank||'—')+'</b><span>TANK GAL</span></div>'+
    '<div class="order">'+(dept==='prod'?'FILLING':'BATCH')+' PRIORITY #'+(i+1)+'</div>'+
    '<div class="productrow"><h3>'+esc(o.product)+'</h3>'+(bn?'<span class="batch">BATCH # '+esc(bn)+'</span>':'')+'</div>'+
    (o.held?'<div class="note"><b>ON HOLD</b></div>':'')+
    (dept==='prod'?'<div class="qty">'+pkgCard(o,'quart','QUARTS')+pkgCard(o,'gallon','1 GALLON')+pkgCard(o,'five','5 GALLON')+'</div>'+(note?'<div class="note"><b>Production Note:</b> '+esc(note)+'</div>':''):'<div class="note">'+esc(note||'Prepare batch for production.')+'</div>')+
    '<label class="precheck '+(checked?'ok':'')+'" data-check="'+o.id+'" data-dept="'+dept+'"><span class="sq">'+(checked?'✓':'')+'</span><span class="checktxt"><b>PRE-CHECK</b><small>'+(dept==='prod'?'Labels • Pallets • Containers / Cans':'All raw materials are available and ready')+'</small></span></label>'+
    '<div class="status '+statusClass(st)+'">'+statusText(st)+'</div>'+
    '<div class="actions"><button class="start '+(checked?'':'locked')+'" data-action="start" data-id="'+o.id+'" data-dept="'+dept+'">▶ START WORK</button><button class="finish '+(checked?'':'locked')+'" data-action="done" data-id="'+o.id+'" data-dept="'+dept+'">✓ WORK DONE</button><button class="hold" data-action="hold" data-id="'+o.id+'">'+(o.held?'RESUME WORK':'PUT ON HOLD')+'</button></div>'+
    (isManager?'<div class="manage"><button data-edit="'+o.id+'">Edit</button><button data-tohold="'+o.id+'">Move to Hold Line</button><button data-delete="'+o.id+'">Delete</button></div>':'')+
    '</article>';
}
function render(){
  $('viewLabel').textContent=isManager?'ALL WORK':view==='prod'?'PRODUCTION / FILLING':'BATCH MAKER';
  $('dateLabel').textContent=pretty();
  $('managerTools').style.display=isManager?'flex':'none';$('addBtn').style.display=isManager?'':'none';
  const day=currentDay(),batch=[...day].sort((a,b)=>a.batchOrder-b.batchOrder),prod=[...day].sort((a,b)=>a.prodOrder-b.prodOrder);
  $('sOrders').textContent=day.length;$('sBatch').textContent=day.length;$('sProd').textContent=day.length;$('sDone').textContent=day.filter(o=>o.batchStatus==='done').length+day.filter(o=>o.prodStatus==='done').length;
  $('batchCount').textContent=batch.length+' tasks';$('prodCount').textContent=prod.length+' tasks';
  $('batchList').innerHTML=batch.length?batch.map((o,i)=>card(o,'batch',i)).join(''):'<div class="empty">No Batch Maker work.</div>';
  $('prodList').innerHTML=prod.length?prod.map((o,i)=>card(o,'prod',i)).join(''):'<div class="empty">No Production work.</div>';
  $('batchPanel').style.display=view==='prod'?'none':'';$('prodPanel').style.display=view==='batch'?'none':'';$('board').style.gridTemplateColumns=isManager?'1fr 1fr':'1fr';
  bindDynamic();
}
function bindDynamic(){
  document.querySelectorAll('[data-check]').forEach(el=>el.onclick=async()=>{const o=orders.find(x=>x.id===Number(el.dataset.check)),dept=el.dataset.dept;if(!o)return;try{await patchOrder(o.id,{[dept==='batch'?'batch_checked':'prod_checked']:!(dept==='batch'?o.batchChecked:o.prodChecked)})}catch(e){fail(e)}});
  document.querySelectorAll('[data-action]').forEach(btn=>btn.onclick=()=>handleAction(btn));
  document.querySelectorAll('[data-qty]').forEach(el=>el.onclick=()=>openQty(Number(el.dataset.qty),el.dataset.key));
  if(isManager){
    document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEditor(Number(b.dataset.edit),false));
    document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>softDelete(Number(b.dataset.delete)));
    document.querySelectorAll('[data-tohold]').forEach(b=>b.onclick=()=>moveToHold(Number(b.dataset.tohold)));
    bindDrag();
  }
}
async function handleAction(btn){
  const id=Number(btn.dataset.id),o=orders.find(x=>x.id===id);if(!o)return;
  try{
    if(btn.dataset.action==='hold'){await patchOrder(id,{held:!o.held});return}
    const dept=btn.dataset.dept,checked=dept==='batch'?o.batchChecked:o.prodChecked;if(!checked){toast('Complete PRE-CHECK first');return}
    if(btn.dataset.action==='done'&&dept==='prod'){
      const needed=['quart','gallon','five'].filter(k=>num(o[k])>0),ok=needed.every(k=>actual(o,k)!=null);if(!ok){toast('Enter actual filled quantity for each planned package first');return}
    }
    await patchOrder(id,{[dept==='batch'?'batch_status':'prod_status']:btn.dataset.action==='start'?'progress':'done'});
  }catch(e){fail(e)}
}
function openQty(id,key){
  if(view!=='prod'&&!isManager)return;const o=orders.find(x=>x.id===id);if(!o)return;qtyState={id,key};
  const label=key==='quart'?'Quarts':key==='gallon'?'1 Gallon':'5 Gallon',a=actual(o,key),p=num(o[key]);
  $('qtyTitle').textContent=label+' — Actual Filled';$('qtyPlanned').innerHTML='Planned amount: <b>'+p+'</b><br><small>You may enter any number 0 or higher.</small>';$('qtyInput').value=a==null?String(p):String(a);showModal('qtyModal');setTimeout(()=>$('qtyInput').select(),50)
}
async function saveQty(){
  if(!qtyState)return;const raw=$('qtyInput').value.trim(),v=Number(raw);if(raw===''||!Number.isFinite(v)||v<0){toast('Enter a valid number 0 or higher');return}
  const field=qtyState.key==='quart'?'actual_quart':qtyState.key==='gallon'?'actual_gallon':'actual_five';
  try{$('saveQtyBtn').disabled=true;await patchOrder(qtyState.id,{[field]:v});hideModal('qtyModal');toast('Actual quantity saved')}catch(e){fail(e)}finally{$('saveQtyBtn').disabled=false}
}
function openEditor(id=null,hold=false){
  if(!isManager)return;const o=id?orders.find(x=>x.id===id):null;editorMode=hold||o?.holdLine?'hold':'order';editingId=o?.id||null;editingVersion=o?.version||null;
  $('editorTitle').textContent=editorMode==='hold'?(o?'Edit Hold Line Item':'Add Hold Line Item'):(o?'Edit Work Order':'Add Work Order');
  $('editId').value=o?.id||'';$('editVersion').value=o?.version||'';$('product').value=o?.product||'';$('workDate').value=editorMode==='hold'?'':(o?.date||iso(selected));$('dateField').style.display=editorMode==='hold'?'none':'';
  $('batchNumber').value=o?.batch||'';$('tank').value=o?.tank||'';$('priority').value=o?.priority||'Normal';$('quart').value=o?.quart??'0';$('gallon').value=o?.gallon??'0';$('five').value=o?.five??'0';$('batchNote').value=o?.batchNote||'';$('prodNote').value=o?.prodNote||'';setAuto(o?.autoTarget||null);showModal('editorModal')
}
function setAuto(t){autoTarget=t;document.querySelectorAll('[data-auto]').forEach(b=>b.classList.toggle('on',b.dataset.auto===t));['quart','gallon','five'].forEach(k=>$(k).readOnly=k===t);recalc()}
function recalc(){
  const total=num($('tank').value);
  if(autoTarget){let used=0;for(const k of ['quart','gallon','five'])if(k!==autoTarget){const v=num($(k).value);used+=k==='five'?v*5:k==='gallon'?v:v*.25}const rem=Math.max(0,total-used);$(autoTarget).value=String(autoTarget==='five'?Math.floor(rem/5):autoTarget==='gallon'?Math.floor(rem):Math.floor(rem*4))}
  const q=num($('quart').value),g=num($('gallon').value),f=num($('five').value),used=f*5+g+q*.25,left=total-used;$('qBoxes').textContent=Math.ceil(q/4)+' boxes';$('gBoxes').textContent=Math.ceil(g/4)+' boxes';$('calc').innerHTML='Total: <b>'+total+'</b> gal • Used: <b>'+used+'</b> gal • '+(Math.abs(left)<.001?'<b>Exact total ✓</b>':(left>0?'Unassigned: ':'Over: ')+'<b>'+Math.abs(left).toFixed(2)+'</b> gal')
}
async function saveEditor(){
  if(saveBusy)return;const product=titleCase($('product').value.trim()),date=editorMode==='hold'?'':$('workDate').value;if(!product||(!date&&editorMode!=='hold')){toast(editorMode==='hold'?'Enter Product Name':'Enter Product Name and Date');return}
  saveBusy=true;$('saveOrderBtn').disabled=true;$('saveOrderBtn').textContent='Saving…';
  try{
    const plan={work_date:editorMode==='hold'?null:date,hold_line:editorMode==='hold',product,batch:$('batchNumber').value.trim(),tank:num($('tank').value),priority:$('priority').value,quart:$('quart').value.trim()||'0',gallon:$('gallon').value.trim()||'0',five:$('five').value.trim()||'0',batch_note:$('batchNote').value.trim(),prod_note:$('prodNote').value.trim(),auto_target:autoTarget};
    if(editingId){
      const res=await patchOrder(editingId,plan,editingVersion);
      if(res.conflict){await reconcile();hideModal('editorModal');toast('This order changed on another manager screen. Latest version loaded.');return}
    }else{
      const sameDate=orders.filter(o=>!o.holdLine&&o.date===date),o={id:nextId(),date,holdLine:editorMode==='hold',product,batch:plan.batch,tank:plan.tank,priority:plan.priority,quart:plan.quart,gallon:plan.gallon,five:plan.five,batchNote:plan.batch_note,prodNote:plan.prod_note,autoTarget,batchChecked:false,prodChecked:false,batchStatus:'ready',prodStatus:'ready',held:false,actualQuart:null,actualGallon:null,actualFive:null,batchOrder:editorMode==='hold'?999:Math.max(0,...sameDate.map(x=>x.batchOrder))+1,prodOrder:editorMode==='hold'?999:Math.max(0,...sameDate.map(x=>x.prodOrder))+1};
      await insertOrder(o)
    }
    hideModal('editorModal');if(editorMode!=='hold')selected=new Date(date+'T12:00:00');render();toast('Saved to cloud')
  }catch(e){fail(e)}finally{saveBusy=false;$('saveOrderBtn').disabled=false;$('saveOrderBtn').textContent='Save Work Order'}
}
async function softDelete(id){if(!isManager||!confirm('Move this order to deleted history?'))return;try{await patchOrder(id,{deleted_at:new Date().toISOString()});orders=orders.filter(o=>o.id!==id);cache();render();toast('Deleted — recoverable from audit history')}catch(e){fail(e)}}
async function moveToHold(id){if(!isManager)return;try{await patchOrder(id,{hold_line:true,work_date:null});toast('Moved to Hold Line')}catch(e){fail(e)}}
async function scheduleHold(id,date){if(!date)return;const day=orders.filter(o=>!o.holdLine&&o.date===date);try{await patchOrder(id,{hold_line:false,work_date:date,batch_order:Math.max(0,...day.map(x=>x.batchOrder))+1,prod_order:Math.max(0,...day.map(x=>x.prodOrder))+1});selected=new Date(date+'T12:00:00');closeDrawer();toast('Scheduled')}catch(e){fail(e)}}
async function reschedule(id,date){if(!date)return;try{await patchOrder(id,{work_date:date});selected=new Date(date+'T12:00:00');closeDrawer();toast('Rescheduled')}catch(e){fail(e)}}

function bindDrag(){
  document.querySelectorAll('.card[draggable="true"]').forEach(card=>{
    card.ondragstart=e=>{if(!e.target.closest('.draghandle')){e.preventDefault();return}dragState={id:Number(card.dataset.card),dept:card.dataset.dept};card.classList.add('dragging');e.dataTransfer.effectAllowed='move'};
    card.ondragover=e=>{if(dragState&&dragState.dept===card.dataset.dept){e.preventDefault();card.classList.add('dropzone')}};
    card.ondragleave=()=>card.classList.remove('dropzone');
    card.ondrop=e=>{e.preventDefault();card.classList.remove('dropzone');if(dragState&&dragState.dept===card.dataset.dept)reorder(dragState.id,Number(card.dataset.card),dragState.dept)};
    card.ondragend=()=>{document.querySelectorAll('.dragging,.dropzone').forEach(x=>x.classList.remove('dragging','dropzone'));dragState=null}
  });
}
let touchDrag=null;
document.addEventListener('touchstart',e=>{const h=e.target.closest('.draghandle');if(!h||!isManager)return;touchDrag={id:Number(h.dataset.drag),dept:h.dataset.dept,target:null};h.closest('.card')?.classList.add('dragging')},{passive:true});
document.addEventListener('touchmove',e=>{if(!touchDrag)return;const t=e.touches[0],card=document.elementFromPoint(t.clientX,t.clientY)?.closest('.card');document.querySelectorAll('.dropzone').forEach(x=>x.classList.remove('dropzone'));if(card&&card.dataset.dept===touchDrag.dept){card.classList.add('dropzone');touchDrag.target=Number(card.dataset.card)}e.preventDefault()},{passive:false});
document.addEventListener('touchend',()=>{if(!touchDrag)return;document.querySelectorAll('.dragging,.dropzone').forEach(x=>x.classList.remove('dragging','dropzone'));if(touchDrag.target)reorder(touchDrag.id,touchDrag.target,touchDrag.dept);touchDrag=null});
async function reorder(dragId,targetId,dept){
  if(dragId===targetId)return;const day=currentDay().sort((a,b)=>(dept==='batch'?a.batchOrder-b.batchOrder:a.prodOrder-b.prodOrder)),from=day.findIndex(o=>o.id===dragId),to=day.findIndex(o=>o.id===targetId);if(from<0||to<0)return;const item=day.splice(from,1)[0];day.splice(to,0,item);
  try{setSync('syncing','SAVING');const {error}=await db.rpc('reorder_work_orders',{p_work_date:iso(selected),p_dept:dept,p_ids:day.map(o=>o.id),p_actor:actor()});if(error)throw error;day.forEach((o,i)=>{if(dept==='batch')o.batchOrder=i+1;else o.prodOrder=i+1});cache();render();setSync('live','LIVE')}catch(e){fail(e)}
}

function dayState(d){
  const arr=orders.filter(o=>!o.holdLine&&o.date===d);if(!arr.length)return'emptyday';
  const complete=arr.every(o=>view==='batch'?o.batchStatus==='done':view==='prod'?o.prodStatus==='done':o.batchStatus==='done'&&o.prodStatus==='done');return complete?'good':'bad'
}
function openMonth(){monthCursor=new Date(selected.getFullYear(),selected.getMonth(),1);showModal('monthModal');renderMonth()}
function orderCompleteForView(o){return view==='batch'?o.batchStatus==='done':view==='prod'?o.prodStatus==='done':o.batchStatus==='done'&&o.prodStatus==='done'}
function renderMonth(){
  $('monthTitle').textContent=monthCursor.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  let html=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>'<div class="dow">'+x+'</div>').join(''),
      first=new Date(monthCursor.getFullYear(),monthCursor.getMonth(),1),start=new Date(first);
  start.setDate(1-first.getDay());const today=iso(new Date());
  for(let i=0;i<42;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);const di=iso(d);
    const arr=orders.filter(o=>!o.holdLine&&o.date===di).sort((a,b)=>(a.batchOrder||999)-(b.batchOrder||999));
    const chips=arr.map(o=>'<div class="calorder '+(orderCompleteForView(o)?'calgood':'calbad')+'" title="'+esc(o.product)+'">'+esc(o.product)+(o.batch?' <span>'+esc(o.batch)+'</span>':'')+'</div>').join('');
    html+='<div class="day '+(!arr.length?'emptyday ':'')+(di===today?'today':'')+'" data-day="'+di+'"><div class="daynum">'+d.getDate()+'</div><div class="calorders">'+chips+'</div></div>';
  }
  $('calendar').innerHTML=html;
  document.querySelectorAll('[data-day]').forEach(el=>el.onclick=()=>{selected=new Date(el.dataset.day+'T12:00:00');hideModal('monthModal');render()})
}
function renderFeedHTML(){return logs.length?logs.slice(0,80).map(e=>'<div class="event '+(e.type==='progress'?'start':e.type==='done'?'done':e.type==='package'?'package':'')+'"><b>'+esc(e.product)+' — '+esc(e.dept||'')+'</b><small>'+new Date(e.ts).toLocaleString()+' • '+esc(String(e.type||'').toUpperCase())+(e.actor?' • BY '+esc(e.actor):'')+(e.extra?' • '+esc(e.extra):'')+'</small></div>').join(''):'<div class="event">No activity yet.</div>'}
function renderQueueHTML(){const today=iso(new Date()),q=orders.filter(o=>!o.holdLine&&o.date&&o.date<today&&(o.batchStatus!=='done'||o.prodStatus!=='done'));return q.length?q.map(o=>'<div class="queueitem"><b>'+esc(o.product)+(o.batch?' • '+esc(o.batch):'')+'</b><small>From '+o.date+' • '+(o.batchStatus!=='done'?'Batch unfinished ':'')+(o.prodStatus!=='done'?'Production unfinished':'')+'</small><input type="date" data-resdate="'+o.id+'" value="'+iso(selected)+'"><button data-reschedule="'+o.id+'">Schedule on selected date</button></div>').join(''):'<div class="queueitem">Nothing unfinished.</div>'}
function renderHoldHTML(){const q=orders.filter(o=>o.holdLine);return '<div style="padding:8px"><button class="draweraction" id="addHold">+ Add Hold Line Item</button></div>'+(q.length?q.map(o=>'<div class="holditem"><b>'+esc(o.product)+(o.batch?' • '+esc(o.batch):'')+'</b><small>'+(o.tank?o.tank+' gal • ':'')+esc(o.batchNote||'No date assigned yet')+'</small><input type="date" data-holddate="'+o.id+'" value="'+iso(selected)+'"><div class="holdactions"><button data-schedulehold="'+o.id+'">Schedule</button><button class="secondary" data-edithold="'+o.id+'">Edit</button><button class="secondary" data-delhold="'+o.id+'">Delete</button></div></div>').join(''):'<div class="holditem">Hold Line is empty.</div>')}
function openDrawer(type){
  if(!isManager)return;$('drawerBackdrop').classList.add('show');$('drawerBackdrop').dataset.type=type;$('drawerTitle').textContent=type==='activity'?'LIVE ACTIVITY':type==='queue'?'UNFINISHED QUEUE':type==='holdline'?'HOLD LINE':'PRINT / SAVE PDF';
  if(type==='activity')$('drawerBody').innerHTML=renderFeedHTML();
  if(type==='queue'){$('drawerBody').innerHTML=renderQueueHTML();document.querySelectorAll('[data-reschedule]').forEach(b=>b.onclick=()=>reschedule(Number(b.dataset.reschedule),document.querySelector('[data-resdate="'+b.dataset.reschedule+'"]').value))}
  if(type==='holdline'){$('drawerBody').innerHTML=renderHoldHTML();$('addHold').onclick=()=>{closeDrawer();openEditor(null,true)};document.querySelectorAll('[data-schedulehold]').forEach(b=>b.onclick=()=>scheduleHold(Number(b.dataset.schedulehold),document.querySelector('[data-holddate="'+b.dataset.schedulehold+'"]').value));document.querySelectorAll('[data-edithold]').forEach(b=>b.onclick=()=>{closeDrawer();openEditor(Number(b.dataset.edithold),true)});document.querySelectorAll('[data-delhold]').forEach(b=>b.onclick=()=>softDelete(Number(b.dataset.delhold)))}
  if(type==='print'){$('drawerBody').innerHTML='<div style="padding:8px"><button class="draweraction" data-print="all">Full Day — Batch + Production</button><button class="draweraction" data-print="batch">Batch Maker</button><button class="draweraction" data-print="prod">Production / Filling</button></div>';document.querySelectorAll('[data-print]').forEach(b=>b.onclick=()=>{closeDrawer();printSheet(b.dataset.print)})}
}
function renderFeedIfOpen(){if($('drawerBackdrop').classList.contains('show')&&$('drawerBackdrop').dataset.type==='activity')$('drawerBody').innerHTML=renderFeedHTML()}
function closeDrawer(){$('drawerBackdrop').classList.remove('show')}
async function shareDept(dept){const base=location.href.split('?')[0].replace(/[^/]*$/,''),url=base+(dept==='prod'?'production.html?build=20260923d':'batch-maker.html?build=20260923d'),title=dept==='prod'?'Production Work Board':'Batch Maker Work Board';try{if(navigator.share){await navigator.share({title,text:'GameTime Factory Work Board',url});return}}catch(e){if(e.name==='AbortError')return}try{await navigator.clipboard.writeText(url);toast(title+' link copied')}catch{prompt('Copy this link:',url)}}

function printSheet(mode){
  const day=orders.filter(o=>!o.holdLine&&o.date===iso(selected)),n=Math.max(day.length,1),scale=n<=4?1:n<=6?.88:n<=8?.75:n<=10?.64:.54;
  const rows=dept=>day.slice().sort((a,b)=>dept==='batch'?a.batchOrder-b.batchOrder:a.prodOrder-b.prodOrder).map((o,i)=>'<div class="j"><div class="jt"><div><small>'+dept.toUpperCase()+' #'+(i+1)+'</small><h3>'+esc(o.product)+'</h3><span class="bb">BATCH # '+esc(dept==='prod'?prodBatch(o.batch):o.batch)+'</span></div><div class="tb"><b>'+esc(o.tank)+'</b><span>TANK GAL</span></div></div>'+(dept==='prod'?'<div class="pq"><div><b>'+esc(o.quart)+'</b><small>Q / '+boxes(o.quart)+' BX</small></div><div><b>'+esc(o.gallon)+'</b><small>1G / '+boxes(o.gallon)+' BX</small></div><div><b>'+esc(o.five)+'</b><small>5G</small></div></div><p>'+esc(o.prodNote||'')+'</p>':'<p>'+esc(o.batchNote||'Prepare batch for production.')+'</p>')+'<div class="ck">'+((dept==='batch'?o.batchChecked:o.prodChecked)?'✓':'□')+' '+(dept==='prod'?'Labels • Pallets • Containers':'Raw materials ready')+'</div><div class="st">STATUS <b>'+statusText(dept==='batch'?o.batchStatus:o.prodStatus).replace(/[✓●○]/g,'')+'</b></div></div>').join('');
  const showBatch=mode!=='prod',showProd=mode!=='batch',cols=showBatch&&showProd?'1fr 1fr':'1fr';
  const h='<!doctype html><html><head><meta charset="utf-8"><style>@page{size:Letter;margin:.2in}*{box-sizing:border-box}body{font-family:Arial;margin:0;color:#111}.head{border:1.5px solid #111;border-radius:7px;background:#eee;padding:6px 8px;display:flex;justify-content:space-between}.head h1{font-size:14pt;margin:0}.head p{font-size:7pt;margin:2px 0}.cols{display:grid;grid-template-columns:'+cols+';gap:7px;margin-top:6px;zoom:'+scale+'}.sh{background:#e8e8e8;border:1px solid #444;border-radius:5px;padding:4px 6px;font-size:8pt;font-weight:bold;margin-bottom:4px}.j{border:1px solid #555;border-radius:6px;padding:5px;margin-bottom:4px;break-inside:avoid}.jt{display:flex;justify-content:space-between}.jt small{font-size:5pt}.jt h3{font-size:9pt;margin:1px 0}.bb{border:1px solid #111;background:#eee;border-radius:3px;padding:2px 3px;font-size:5.5pt;font-weight:bold}.tb{border:1px solid #111;background:#f3f3f3;border-radius:4px;padding:3px;text-align:center}.tb b{display:block;font-size:8pt}.tb span{font-size:4.5pt}.pq{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin-top:3px}.pq div{border:1px solid #999;background:#f7f7f7;border-radius:3px;padding:2px;text-align:center}.pq b{display:block;font-size:8pt}.pq small,p,.ck,.st{font-size:5.5pt}p{margin:3px 0}.st{border-top:1px solid #bbb;padding-top:2px}@media print{button{display:none}}</style></head><body><button onclick="print()">Print</button><div class="head"><div><h1>FACTORY DAILY WORK SHEET</h1><p>'+pretty()+'</p></div><b>'+ (mode==='all'?'ALL WORK':mode==='prod'?'PRODUCTION':'BATCH MAKER') +'</b></div><div class="cols">'+(showBatch?'<section><div class="sh">BATCH MAKER</div>'+rows('batch')+'</section>':'')+(showProd?'<section><div class="sh">PRODUCTION / FILLING</div>'+rows('prod')+'</section>':'')+'</div><script>setTimeout(()=>print(),250)<\/script></body></html>';
  const w=open('','_blank');w.document.write(h);w.document.close()
}
function showModal(id){$(id).classList.add('show')}function hideModal(id){$(id).classList.remove('show')}
function fail(e){console.error(e);setSync('offline','RETRYING');toast('Could not save. Nothing was deleted — retrying sync.')}

function openIdentity(){
  $('deviceNameInput').value=deviceName;
  $('identityModal').classList.add('show');
  setTimeout(()=>$('deviceNameInput').focus(),50);
}
function saveIdentity(){
  const name=$('deviceNameInput').value.trim();
  if(!name){toast('Enter your name');return}
  deviceName=name;localStorage.setItem(NAME_KEY,name);refreshUserLabel();hideModal('identityModal');toast('This device is now identified as '+name)
}
function ensureIdentity(){refreshUserLabel();if(!deviceName)openIdentity()}

function tick(){$('clock').textContent=new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}

$('prevBtn').onclick=()=>{selected.setDate(selected.getDate()-1);render()};
$('nextBtn').onclick=()=>{selected.setDate(selected.getDate()+1);render()};
$('monthBtn').onclick=openMonth;$('search').oninput=render;$('addBtn').onclick=()=>openEditor(null,false);$('printBtn').onclick=()=>isManager?openDrawer('print'):printSheet(view);
$('shareProd').onclick=()=>shareDept('prod');$('shareBatch').onclick=()=>shareDept('batch');$('currentUser').onclick=openIdentity;$('saveDeviceName').onclick=saveIdentity;document.querySelectorAll('[data-drawer]').forEach(b=>b.onclick=()=>openDrawer(b.dataset.drawer));
$('closeDrawer').onclick=closeDrawer;$('drawerBackdrop').onclick=e=>{if(e.target===$('drawerBackdrop'))closeDrawer()};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>hideModal(b.dataset.close));$('monthPrev').onclick=()=>{monthCursor.setMonth(monthCursor.getMonth()-1);renderMonth()};$('monthNext').onclick=()=>{monthCursor.setMonth(monthCursor.getMonth()+1);renderMonth()};
$('saveQtyBtn').onclick=saveQty;$('saveOrderBtn').onclick=saveEditor;document.querySelectorAll('[data-auto]').forEach(b=>b.onclick=()=>setAuto(autoTarget===b.dataset.auto?null:b.dataset.auto));
for(const id of ['tank','quart','gallon','five'])$(id).oninput=recalc;
$('product').oninput=e=>{const p=e.target.selectionStart;e.target.value=titleCase(e.target.value);try{e.target.setSelectionRange(p,p)}catch{}};
window.addEventListener('online',()=>{setSync('syncing','RECONNECTING');reconcile();if(!channel)subscribeLive()});window.addEventListener('offline',()=>setSync('offline','OFFLINE'));document.addEventListener('visibilitychange',()=>{if(!document.hidden)reconcile()});

tick();setInterval(tick,30000);render();ensureIdentity();initialLoad();