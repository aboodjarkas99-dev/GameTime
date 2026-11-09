// Packaging supplies have their own physical counts and immutable movement history.
let fillSupplies=[],fillSupplyMovements=[],fillSupplyLoading=false,fillSupplyRequest=null;
function canUseFillSupplies(){return isManager||hasEmployeeRole('prod')||hasEmployeeRole('inventory')}
async function openFillSupplies(){if(!canUseFillSupplies())return;showModal('fillSuppliesModal');await loadFillSupplies();await loadLabels();await loadProductPailSettings()}
async function loadFillSupplies(quiet=false){
 if(!canUseFillSupplies()||fillSupplyLoading)return;fillSupplyLoading=true;
 try{
  const [items,movements]=await Promise.all([db.from('fill_line_supplies').select('*').order('name'),db.from('fill_line_supply_movements').select('*').order('created_at',{ascending:false}).limit(100)]);
  if(items.error||movements.error)throw items.error||movements.error;
  fillSupplies=items.data||[];fillSupplyMovements=movements.data||[];renderFillSupplies();await loadLabels();$('fillSuppliesMessage').textContent='Live stock · whole items';
 }catch(e){$('fillSuppliesMessage').textContent='Could not load: '+e.message}finally{fillSupplyLoading=false}
}
function renderFillSupplies(){
 if(typeof renderLabelStock==='function')renderLabelStock();
 const q=$('fillSuppliesSearch').value.trim().toLowerCase();
 $('fillSuppliesBody').innerHTML=['boxes','containers','lids','pallets'].map(category=>{const items=fillSupplies.filter(r=>r.category===category&&(!q||(r.name+' '+r.description).toLowerCase().includes(q)));if(!items.length)return '';return '<section class="fill-supply-section compact"><h3>'+({boxes:'Boxes',containers:'Empty Containers',lids:'F Style Lids',pallets:'Pallets'}[category])+'</h3><div class="fill-supply-simple-list">'+items.map(r=>'<article class="fill-supply-simple-row"><div class="fill-supply-simple-name"><b>'+esc(r.name)+'</b></div><div class="fill-supply-simple-count">'+(r.stock_units==null?'<b>—</b><small>NOT COUNTED</small>':'<b>'+Number(r.stock_units).toLocaleString(locale())+'</b><small>'+({boxes:'BOXES',containers:'CONTAINERS',lids:'LIDS',pallets:'PALLETS'}[category])+'</small>')+'</div><button class="fill-supply-simple-add" type="button" data-supply="'+r.id+'" data-kind="count">+ Add</button></article>').join('')+'</div></section>'}).join('')||'<p>No matching supplies.</p>';
 $('fillSuppliesBody').querySelectorAll('[data-supply]').forEach(b=>b.onclick=()=>openFillSupplyMovement(b.dataset.supply,b.dataset.kind));
 $('fillSupplyHistory').innerHTML=fillSupplyMovements.map(m=>'<tr><td>'+esc(new Date(m.created_at).toLocaleString(locale(),{timeZone:'America/Chicago'}))+'</td><td>'+esc(fillSupplies.find(i=>i.id===m.supply_id)?.name||m.supply_id)+'</td><td>'+esc({count:'Physical count',receive:'Received',use:'Used',undo:'Undo Work Done'}[m.kind])+'</td><td><b>'+Number(m.quantity).toLocaleString(locale())+'</b></td><td>'+Number(m.result_units).toLocaleString(locale())+'</td><td>'+esc(m.actor_name)+'</td><td>'+esc(m.note)+'</td></tr>').join('')||'<tr><td colspan="7">No movements recorded.</td></tr>';
}
function openFillSupplyMovement(id,kind){
 const item=fillSupplies.find(r=>r.id===id);if(!item)return;
 fillSupplyRequest={id:crypto.randomUUID(),supply:id,kind};
 $('fillSupplyMovementTitle').textContent='Inventory — '+item.name;
 $('fillSupplyCurrent').textContent=item.stock_units==null?'Not counted yet.':('Current: '+Number(item.stock_units).toLocaleString(locale()));
 $('fillSupplyQuantity').value=kind==='count'&&item.stock_units!=null?String(item.stock_units):'';
 $('fillSupplyNote').value='Physical inventory count';$('fillSupplyMovementMessage').textContent='';showModal('fillSupplyMovementModal');
}
async function saveFillSupplyMovement(){
 if(!fillSupplyRequest||!canUseFillSupplies())return;
 const raw=$('fillSupplyQuantity').value.trim(),quantity=Number(raw),note=$('fillSupplyNote').value.trim();
 if(raw===''||!Number.isSafeInteger(quantity)||quantity<0){$('fillSupplyMovementMessage').textContent='Enter a whole number, 0 or higher.';return}
 const signature=JSON.stringify([quantity,note]);
 if(fillSupplyRequest.signature&&fillSupplyRequest.signature!==signature)fillSupplyRequest.id=crypto.randomUUID();
 fillSupplyRequest.signature=signature;
 $('saveFillSupplyBtn').disabled=true;
 try{
  const {error}=await db.rpc('record_fill_line_supply',{p_request_id:fillSupplyRequest.id,p_supply_id:fillSupplyRequest.supply,p_kind:fillSupplyRequest.kind,p_quantity:quantity,p_note:note});
  if(error)throw error;hideModal('fillSupplyMovementModal');await loadFillSupplies();toast('Fill Line stock saved.');
 }catch(e){$('fillSupplyMovementMessage').textContent=e.message}finally{$('saveFillSupplyBtn').disabled=false}
}
function fillGallonLabel(o){return o.fillPackaging?.gallon_style==='f_style'?'F STYLE · 1 GALLON':t('oneGallon')}
function fillPackagingBadge(o){return o.fillPackaging?.gallon_style==='f_style'?'F STYLE · '+(o.fillPackaging.f_style_lid==='seal'?'SEAL LID':'SPONGE LID'):''}

async function loadProductPailSettings(){
 const target=$('fillPailSettings');if(!target)return;target.hidden=!isManager;if(!isManager)return;
 const {data,error}=await db.from('factory_products').select('id,name,five_pail_type').eq('active',true).order('name');
 if(error){target.textContent=error.message;return}
 target.innerHTML='<summary>Products — 5 Gallon Pail Type</summary>'+data.map(p=>'<label class="fill-supply-row"><span>'+esc(p.name)+'</span><select aria-label="'+esc(p.name)+' pail type" data-pail-product="'+p.id+'"><option value="">Not set</option><option value="five_water">Water Based</option><option value="five_oil">Oil Based</option></select></label>').join('');
 target.querySelectorAll('select').forEach((el,i)=>{el.value=data[i].five_pail_type||'';el.onchange=async()=>{el.disabled=true;try{const {error}=await db.rpc('set_product_pail_type',{p_id:data[i].id,p_type:el.value||null});if(error)throw error;data[i].five_pail_type=el.value;toast('Pail type saved.')}catch(e){el.value=data[i].five_pail_type||'';fail(e)}finally{el.disabled=false}}});
}
