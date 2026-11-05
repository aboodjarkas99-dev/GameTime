// Work Done uses actual filled units; physical boxes and new pallets are confirmed.
let fillCompletionState=null,fillCompletionBusy=false;
function fillUsageFromForm(){
 const boxes={};document.querySelectorAll('[data-fill-box]').forEach(el=>{boxes[el.dataset.fillBox]=el.value.trim()===''?null:Number(el.value)});
 const raw=$('fillUsedPallets').value.trim();
 return {boxes,jerry_pallets:raw===''?0:Number(raw),pallets:0,pail_type:$('fillPailType').value};
}
function fillCompletionRequirements(spec,usage){
 const entries=Object.entries(spec.fixed).map(([id,quantity])=>({id,quantity}));
 for(const [id,quantity] of Object.entries({...spec.boxes,...usage.boxes}))entries.push({id,quantity});
 entries.push({id:'pallet',quantity:spec.autoPallets+usage.jerry_pallets});
 if(spec.five>0)entries.push({id:spec.pail_type||'five_unclassified',quantity:spec.five});
 return entries;
}
async function openFillCompletion(o,refresh=false){
 if(fillCompletionBusy)return;fillCompletionBusy=true;
 const previous=refresh&&fillCompletionState?{version:fillCompletionState.order.version,usage:fillUsageFromForm()}:null;
 try{
  const {data,error}=await db.rpc('preview_fill_line_consumption',{p_order_id:o.id});if(error)throw error;
  mergeOrder(fromRow(data.order));render();
  if(data.order.prod_status==='done'){toast('This order is already done. Latest status loaded.');hideModal('fillCompletionModal');return}
  if(data.order.batch_status!=='done'||!data.order.prod_checked)throw new Error('Finish Batch Maker and Fill Line PRE-CHECK first.');
  for(const key of ['quart','gallon','five','jerry'])if((key!=='jerry'||data.order.jerry_enabled)&&num(data.order[key])>0&&data.order['actual_'+key]==null)throw new Error('Enter actual filled quantities first.');
  data.autoPallets=Math.ceil((data.order.actual_quart||0)/720)+Math.ceil((data.order.actual_gallon||0)/120)+Math.ceil((data.order.actual_five||0)/36);
  fillCompletionState=data;
  $('fillCompletionTitle').textContent='Work Done — '+data.order.product;
  $('fillCompletionBatch').textContent='Batch '+(data.order.batch||'—')+' · Actual filled quantities';
  const keep=previous?.version===data.order.version?previous.usage:null;
  $('fillCompletionBoxes').innerHTML=Object.entries(data.boxes).filter(([,n])=>n==null).map(([id,suggested])=>{
   const s=data.stock.find(x=>x.id===id),value=keep?keep.boxes[id]:suggested;
   return '<label>'+esc(s?.name||id)+'<input data-fill-box="'+id+'" type="number" min="0" step="1" inputmode="numeric" required value="'+(value??'')+'" placeholder="Actual boxes used">'+(suggested==null?'<small>Enter the actual number of boxes.</small>':'<small>Suggested: '+suggested+'. Adjust for existing partial boxes.</small>')+'</label>';
  }).join('');
  $('fillPailField').hidden=true; $('fillUsedPallets').parentElement.hidden=!(data.order.jerry_enabled&&data.order.actual_jerry>0);$('fillPailType').value=keep?.pail_type||'';
  $('fillUsedPallets').value=keep?.jerry_pallets??'';
  $('fillCompletionError').textContent='';showModal('fillCompletionModal');updateFillCompletionPreview();
  if(previous&&!keep)toast('This order changed. Review the latest quantities.');
 }finally{fillCompletionBusy=false}
}
function updateFillCompletionPreview(){
 const spec=fillCompletionState;if(!spec)return;const usage=fillUsageFromForm();
 const whole=n=>Number.isSafeInteger(n)&&n>=0;
 let valid=whole(usage.jerry_pallets)&&Object.values(usage.boxes).every(whole);
 let shortage=false;
 const rows=fillCompletionRequirements(spec,usage).filter(e=>e.quantity>0).map(e=>{
  const stock=spec.stock.find(x=>x.id===e.id),balance=stock?.stock_units,low=balance==null||balance<e.quantity;shortage ||=low;
  return '<div class="fill-consumption-row'+(low?' stock-short':'')+'"><span>'+esc(stock?.name||e.id)+'</span><b>− '+e.quantity+'</b><small>'+esc(balance==null?'Not counted · After: −'+e.quantity+'':'On hand: '+balance+' · After: '+(balance-e.quantity))+'</small></div>';
 });
 for(const label of spec.label_details){const low=label.stock_units<label.quantity;shortage ||=low;rows.push('<div class="fill-consumption-row'+(low?' stock-short':'')+'"><span>'+esc(labelPackage(label.package_type))+' labels · '+esc(label.product)+'</span><b>− '+label.quantity+'</b><small>On hand: '+label.stock_units+' · After: '+(label.stock_units-label.quantity)+'</small></div>')}
 $('fillCompletionPreview').innerHTML=rows.join('')||'<p>No containers or labels to deduct.</p>';
 $('fillCompletionStockMessage').textContent=shortage?'Some balances will go negative. You can still confirm Work Done.':valid?'Ready. These materials will be deducted once when you confirm Work Done.':'Enter actual boxes and new pallets used. Use 0 if none were taken.';
 $('confirmFillCompletion').disabled=!valid||fillCompletionBusy;
}
async function saveFillCompletion(){
 if(!fillCompletionState||fillCompletionBusy)return;
 fillCompletionBusy=true;$('confirmFillCompletion').disabled=true;$('fillCompletionError').textContent='';
 try{
  const {data,error}=await db.rpc('complete_fill_line',{p_order_id:fillCompletionState.order.id,p_expected_version:fillCompletionState.order.version,p_usage:fillUsageFromForm()});if(error)throw error;
  if(data?.order){mergeOrder(fromRow(data.order));render()}
  if(data?.conflict){hideModal('fillCompletionModal');fillCompletionState=null;toast('This order changed. Open Work Done again to review the latest quantities.');return}
  hideModal('fillCompletionModal');fillCompletionState=null;toast('Work Done saved. Packaging and labels deducted.');
  await loadFillSupplies();
 }catch(e){$('fillCompletionError').textContent=e.message}finally{fillCompletionBusy=false;updateFillCompletionPreview()}
}
function initializeFillCompletion(){
 $('confirmFillCompletion').onclick=saveFillCompletion;
 $('fillCompletionBoxes').oninput=updateFillCompletionPreview;$('fillUsedPallets').oninput=updateFillCompletionPreview;$('fillPailType').onchange=updateFillCompletionPreview;
 $('fillCompletionRefresh').onclick=async()=>{if(!fillCompletionState)return;try{await openFillCompletion({id:fillCompletionState.order.id},true)}catch(e){$('fillCompletionError').textContent=e.message}finally{updateFillCompletionPreview()}};
 $('fillCompletionInventory').onclick=()=>openFillSupplies();
}
