'use strict';
// Shared label stock view; all mutations are validated atomically by the database.
let labelStock=[],labelRequests=[],labelBusy=false,labelOperation=null;
const labelPackage=key=>({quart_can:'QUART',gallon:'GALLON',jerry_1_25:'Jerry Can',f_style:'F Style'}[key]||key);
function labelRoles(){return [...new Set([profile?.role,...(profile?.page_roles||[])])]}
function labelManage(){return labelRoles().some(r=>['manager','chemist','labels'].includes(r))}
function labelUse(){return labelRoles().some(r=>['manager','chemist','prod','inventory'].includes(r))}
async function loadLabels(){
 if(labelBusy)return;labelBusy=true;
 try{
  const stock=await db.from('fill_line_label_stock').select('*').order('product');if(stock.error)throw stock.error;labelStock=stock.data||[];
  if(labelRoles().some(r=>['manager','chemist','labels','prod'].includes(r))){const requests=await db.from('label_requests').select('*').order('due_date').order('created_at');if(requests.error)throw requests.error;labelRequests=requests.data||[]}
  renderLabelStock();if(typeof renderLabelSheet==='function')renderLabelSheet();
  if($('labelLive'))$('labelLive').textContent='Live · '+new Date().toLocaleTimeString();
 }catch(e){if($('labelLive'))$('labelLive').textContent=e.message;else if($('fillSuppliesMessage'))$('fillSuppliesMessage').textContent='Labels: '+e.message}finally{labelBusy=false}
}
function renderLabelStock(){
 if(typeof renderSimpleLabelInventory==='function'){renderSimpleLabelInventory();return}
 const target=$('fillLineLabelsBody');if(!target)return;const q=($('fillSuppliesSearch')?.value||'').toLowerCase();
 target.innerHTML='<h3>Labels</h3><p>Physical labels on hand. Printing adds stock. Fill Line Work Done deducts labels automatically; use − Used only for extra use outside completed jobs.</p>'+labelStock.filter(s=>(s.product+' '+labelPackage(s.package_type)).toLowerCase().includes(q)).map(s=>'<article class="fill-supply-row"><div class="fill-supply-info"><h4>'+esc(s.product)+'</h4><p>'+esc(labelPackage(s.package_type))+' labels</p></div><div class="fill-supply-count"><b>'+Number(s.stock_units).toLocaleString()+'</b><span>LABELS</span></div><div class="fill-supply-row-actions"><button data-label-stock="'+s.id+'" data-kind="count">Count</button>'+(labelUse()?'<button data-label-stock="'+s.id+'" data-kind="use">− Used</button>':'')+(labelManage()?'<button data-label-stock="'+s.id+'" data-kind="printed">+ Printed</button>':'')+'</div></article>').join('');
 target.querySelectorAll('[data-label-stock]').forEach(b=>b.onclick=()=>openLabelOperation({stock:b.dataset.labelStock,kind:b.dataset.kind}));
}
function openLabelOperation(op){
 const stock=labelStock.find(s=>s.id===op.stock);if(!stock)return;
 labelOperation={...op,id:crypto.randomUUID()};$('labelQuantityTitle').textContent=({count:'Set physical label count',printed:'Record labels printed',use:'Record labels used',finish:'Labels done',minimum:'Set minimum labels'}[op.kind])+' — '+stock.product+' · '+labelPackage(stock.package_type);
 $('labelQuantity').value=op.kind==='minimum'?(stock.minimum_units??''):op.kind==='count'?stock.stock_units:'';$('labelQuantityCaption').textContent=op.kind==='finish'?'How many labels did you make?':op.kind==='minimum'?'Minimum labels (leave blank to remove)':op.kind==='printed'?'How many labels did you print?':op.kind==='use'?'How many labels were used?':'Labels on hand';$('labelOnHandField').hidden=op.kind!=='finish';$('labelOnHand').value=stock.stock_units;$('labelOnHand').dataset.edited='';$('labelQuantity').oninput=()=>{if(op.kind==='finish'&&!$('labelOnHand').dataset.edited)$('labelOnHand').value=Number(stock.stock_units)+Number($('labelQuantity').value||0)};$('labelOnHand').oninput=()=>{$('labelOnHand').dataset.edited='yes'};$('labelQuantityError').textContent='';$('labelQuantityDialog').showModal();
}
async function saveLabelOperation(){
 if(!labelOperation)return;const raw=$('labelQuantity').value.trim(),qty=Number(raw);if((!raw&&labelOperation.kind!=='minimum')||!Number.isSafeInteger(qty)||qty<0||labelOperation.kind==='printed'&&qty===0){$('labelQuantityError').textContent='Enter a whole number'+(labelOperation.kind==='printed'?' greater than zero.':', 0 or higher.');return}
 const onHand=Number($('labelOnHand').value);if(labelOperation.kind==='finish'&&(!$('labelOnHand').value.trim()||!Number.isSafeInteger(onHand)||onHand<0)){$('labelQuantityError').textContent='Enter a whole on-hand quantity, 0 or higher.';return}
 if(labelOperation.quantity!==undefined&&(labelOperation.quantity!==qty||labelOperation.onHand!==onHand))labelOperation.id=crypto.randomUUID();labelOperation.quantity=qty;labelOperation.onHand=onHand;
 $('labelQuantitySave').disabled=true;
 try{const op=labelOperation;const result=op.kind==='minimum'?await db.rpc('set_label_minimum',{p_stock:op.stock,p_minimum:raw===''?null:qty}):op.kind==='finish'?await db.rpc('finish_label_group',{p_stock:op.stock,p_requests:op.group,p_printed:qty,p_on_hand:onHand,p_operation:op.id}):op.group?await db.rpc('update_label_group',{p_stock:op.stock,p_requests:op.group,p_action:op.kind==='count'?'have':'print',p_quantity:qty,p_operation:op.id}):op.request?await db.rpc('update_label_request',{p_request:op.request,p_version:op.version,p_action:op.kind==='count'?'have':'print',p_quantity:qty,p_operation:op.id}):await db.rpc('record_label_stock',{p_operation:op.id,p_stock:op.stock,p_kind:op.kind,p_quantity:qty,p_note:''});if(result.error)throw result.error;if(result.data?.conflict)throw new Error('This request changed. Close this window and refresh before saving.');$('labelQuantityDialog').close();labelOperation=null;await loadLabels()}catch(e){$('labelQuantityError').textContent=e.message}finally{$('labelQuantitySave').disabled=false}
}
function labelDialogHTML(){return '<dialog id="labelQuantityDialog"><form method="dialog"><h3 id="labelQuantityTitle"></h3><label><span id="labelQuantityCaption">Labels on hand</span><input id="labelQuantity" type="number" min="0" step="1"></label><label id="labelOnHandField" hidden>Total labels on hand now<input id="labelOnHand" type="number" min="0" step="1"></label><p id="labelQuantityError" role="alert"></p><div class="label-dialog-actions"><button value="cancel">Cancel</button><button id="labelQuantitySave" type="button">Save</button></div></form></dialog>'}
function initializeLabelControls(){document.body.insertAdjacentHTML('beforeend',labelDialogHTML());document.getElementById('labelQuantitySave').onclick=saveLabelOperation;document.getElementById('labelQuantityDialog').addEventListener('close',()=>{labelOperation=null})}
initializeLabelControls();
