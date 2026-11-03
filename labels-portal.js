const db=window.supabase.createClient('https://bqnptjfdsxzbxtkzigim.supabase.co','sb_publishable_PW16QU5CtZBRe42mGPBrHg_g8McvcP1',{auth:{persistSession:true,autoRefreshToken:true,storage:window.localStorage}});
const $=id=>document.getElementById(id),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let profile=null,labelTimer=null,labelActionPending=false;
function groupedLabelRequests(requests,filter='active',query=''){
 const groups=new Map();
 for(const r of requests){if(filter==='history'?r.active:filter!=='all'&&!r.active)continue;const key=r.stock_id+':'+r.active;let g=groups.get(key);if(!g){g={...r,id:key,requests:[],requested_units:0,printed_units:0};groups.set(key,g)}g.requests.push(r);g.requested_units+=Number(r.requested_units);g.printed_units+=Number(r.printed_units);if(r.due_date&&(!g.due_date||r.due_date<g.due_date))g.due_date=r.due_date;}
 return [...groups.values()].map(g=>{g.status=g.requests.every(r=>r.status==='READY')?'READY':g.requests.some(r=>r.status==='PREPARING')?'PREPARING':g.requests.some(r=>r.status==='NEEDED')?'NEEDED':'PENDING';g.availability=g.requests.every(r=>r.availability==='HAVE')?'HAVE':g.requests.every(r=>r.availability==='NONE')?'NONE':g.requests.every(r=>r.availability==='UNKNOWN')?'UNKNOWN':'PARTIAL';return g}).filter(g=>(filter!=='ready'||g.status==='READY')&&(filter!=='active'||g.status!=='READY')&&(g.product+' '+labelPackage(g.package_type)).toLowerCase().includes(query.toLowerCase()));
}
function renderLabelSheet(){
 const rows=groupedLabelRequests(labelRequests,$('labelFilter').value,$('labelSearch').value);
 $('labelSummary').textContent=rows.length+' product / size groups · '+rows.reduce((n,r)=>n+r.requested_units,0).toLocaleString()+' labels requested';
 $('labelRows').innerHTML=rows.map(r=>'<article class="label-row"><div><small>Needed '+esc(r.due_date||'Not scheduled')+'</small><h2>'+esc(r.product)+'</h2><p class="label-package">'+esc(labelPackage(r.package_type).toUpperCase())+'</p><span class="status '+r.status.toLowerCase()+'">'+esc(r.active?r.status:'CLOSED')+'</span> <small>'+esc({UNKNOWN:'Availability not checked',HAVE:'Labels available',NONE:'No labels available',PARTIAL:'Partly available'}[r.availability])+'</small></div><div class="numbers"><div><b>'+Number(r.requested_units).toLocaleString()+'</b><small>LABELS REQUESTED</small></div><div><b>'+Number(r.printed_units).toLocaleString()+'</b><small>LABELS PRINTED</small></div><p>'+Number(labelStock.find(s=>s.id===r.stock_id)?.stock_units||0).toLocaleString()+' labels in stock</p></div>'+(labelManage()&&r.active?'<div class="row-actions"><button data-group="'+r.id+'" data-action="have">Have labels / Count</button><button data-group="'+r.id+'" data-action="need">Need labels</button><button data-group="'+r.id+'" data-action="start">Preparing</button><button class="primary" data-group="'+r.id+'" data-action="print">+ Record printed</button></div>':'')+'</article>').join('')||'<p class="empty">No requests in this view.</p>';
 $('labelRows').querySelectorAll('[data-group]').forEach(b=>{b.disabled=labelActionPending;b.onclick=()=>actOnLabel(b.dataset.group,b.dataset.action)});
}
async function actOnLabel(id,action){
 const r=groupedLabelRequests(labelRequests,$('labelFilter').value,$('labelSearch').value).find(r=>r.id===id);if(!r||!labelManage()||labelActionPending)return;
 const snapshot=r.requests.map(r=>({id:r.id,version:r.version})).sort((a,b)=>a.id.localeCompare(b.id));
 if(['have','print'].includes(action)){openLabelOperation({group:snapshot,stock:r.stock_id,kind:action==='have'?'count':'printed'});return}
 labelActionPending=true;renderLabelSheet();try{const {data,error}=await db.rpc('update_label_group',{p_stock:r.stock_id,p_requests:snapshot,p_action:action});if(error)throw error;if(data?.conflict)throw new Error('Requests changed. Refresh the sheet.');await loadLabels()}catch(e){$('labelLive').textContent=e.message}finally{labelActionPending=false;renderLabelSheet()}
}
async function startLabelPortal(){
 try{const {data,error}=await db.auth.getSession();if(error)throw error;if(!data.session){$('labelLive').textContent='Sign in required';return}
 const result=await db.from('profiles').select('*').eq('id',data.session.user.id).single();if(result.error)throw result.error;profile=result.data;
 if(!profile.active||!labelRoles().some(r=>['manager','chemist','labels','prod'].includes(r)))throw new Error('Labels access required. Ask Management to update your allowed pages.');
 $('labelGate').hidden=true;$('labelContent').hidden=false;$('labelSignOut').hidden=false;
 $('labelSearch').oninput=renderLabelSheet;$('labelFilter').onchange=renderLabelSheet;$('fillSuppliesSearch').oninput=renderLabelStock;$('labelPrint').onclick=()=>window.print();$('labelSignOut').onclick=async()=>{await db.auth.signOut();location.replace('/index.html?workspace=labels')};await loadLabels();labelTimer=setInterval(()=>{if(!document.hidden)loadLabels()},5000);
 }catch(e){$('labelLive').textContent=e.message}
}
