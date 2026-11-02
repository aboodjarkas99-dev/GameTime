const db=window.supabase.createClient('https://bqnptjfdsxzbxtkzigim.supabase.co','sb_publishable_PW16QU5CtZBRe42mGPBrHg_g8McvcP1',{auth:{persistSession:true,autoRefreshToken:true,storage:window.localStorage}});
const $=id=>document.getElementById(id),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let profile=null,labelTimer=null,labelActionPending=false;
function renderLabelSheet(){
 const q=$('labelSearch').value.toLowerCase(),filter=$('labelFilter').value;
 const rows=labelRequests.filter(r=>(r.product+' '+r.batch).toLowerCase().includes(q)&&(filter==='all'||filter==='history'?!r.active||filter==='all':r.active&&(filter==='ready'?r.status==='READY':r.status!=='READY')));
 $('labelSummary').textContent=rows.length+' requests · '+rows.reduce((n,r)=>n+Number(r.requested_units),0).toLocaleString()+' labels requested';
 $('labelRows').innerHTML=rows.map(r=>'<article class="label-row"><div><small>'+esc(r.due_date||'Not scheduled')+' · Batch '+esc(r.batch||'—')+'</small><h2>'+esc(r.product)+'</h2><p>'+esc(labelPackage(r.package_type))+' · Order #'+r.work_order_id+'</p><span class="status '+r.status.toLowerCase()+'">'+esc(r.active?r.status:'CLOSED')+'</span> <small>'+esc({UNKNOWN:'Availability not checked',HAVE:'Labels available',NONE:'No labels available',PARTIAL:'Partly available'}[r.availability])+'</small></div><div class="numbers"><div><b>'+Number(r.requested_units).toLocaleString()+'</b><small>REQUESTED</small></div><div><b>'+Number(r.printed_units).toLocaleString()+'</b><small>PRINTED FOR THIS ORDER</small></div><p>'+Number(labelStock.find(s=>s.id===r.stock_id)?.stock_units||0).toLocaleString()+' labels in stock</p></div>'+(labelManage()&&r.active?'<div class="row-actions"><button data-request="'+r.id+'" data-action="have">Have labels / Count</button><button data-request="'+r.id+'" data-action="need">Need labels</button><button data-request="'+r.id+'" data-action="start">Preparing</button><button class="primary" data-request="'+r.id+'" data-action="print">+ Record printed</button></div>':'')+'</article>').join('')||'<p class="empty">No requests in this view.</p>';
 $('labelRows').querySelectorAll('[data-request]').forEach(b=>{b.disabled=labelActionPending;b.onclick=()=>actOnLabel(b.dataset.request,b.dataset.action)});
}
async function actOnLabel(id,action){
 const r=labelRequests.find(r=>r.id===id);if(!r||!labelManage()||labelActionPending)return;
 if(['have','print'].includes(action)){openLabelOperation({request:r.id,version:r.version,stock:r.stock_id,kind:action==='have'?'count':'printed'});return}
 labelActionPending=true;renderLabelSheet();try{const {data,error}=await db.rpc('update_label_request',{p_request:id,p_version:r.version,p_action:action});if(error)throw error;if(data?.conflict)$('labelLive').textContent='Request changed. Latest version loaded.';await loadLabels()}catch(e){$('labelLive').textContent=e.message}finally{labelActionPending=false;renderLabelSheet()}
}
async function startLabelPortal(){
 try{const {data,error}=await db.auth.getSession();if(error)throw error;if(!data.session){$('labelLive').textContent='Sign in required';return}
 const result=await db.from('profiles').select('*').eq('id',data.session.user.id).single();if(result.error)throw result.error;profile=result.data;
 if(!profile.active||!labelRoles().some(r=>['manager','chemist','labels','prod'].includes(r)))throw new Error('Labels access required. Ask Management to update your allowed pages.');
 $('labelGate').hidden=true;$('labelContent').hidden=false;$('labelSignOut').hidden=false;
 $('labelSearch').oninput=renderLabelSheet;$('labelFilter').onchange=renderLabelSheet;$('fillSuppliesSearch').oninput=renderLabelStock;$('labelPrint').onclick=()=>window.print();$('labelSignOut').onclick=async()=>{await db.auth.signOut();location.replace('/index.html?workspace=labels')};await loadLabels();labelTimer=setInterval(()=>{if(!document.hidden)loadLabels()},5000);
 }catch(e){$('labelLive').textContent=e.message}
}
