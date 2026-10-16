import {useEffect,useState} from 'react';
import {db} from '@/lib/pallet/api';
type Row={id:string;shipment_number:string;packing_slip:string;customer:string;status:string;updated_at:string};
const tabs=[{key:'DRAFT',title:'Draft',hint:'Saved drafts'},{key:'READY',title:'Ready',hint:'Ready for printing / dispatch'},{key:'SHIPPED',title:'Finished / Shipped',hint:'Completed shipments — safe to reprint'},{key:'CLEANUP',title:'Clear Drafts',hint:'Select draft packing slips to clear. Ready and finished orders are protected.'}];
export function ShippingStatusTabs({onOpen,onCleared}:{onOpen:(id:string)=>Promise<void>;onCleared:(ids:string[])=>void}){
 const [selected,setSelected]=useState('DRAFT'),[rows,setRows]=useState<Row[]>([]),[search,setSearch]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true),[opening,setOpening]=useState('');
 const [checked,setChecked]=useState<string[]>([]),[clearing,setClearing]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{
  let stopped=false,busy=false;
  async function refresh(){
   if(busy)return;busy=true;
   try{
    const all:Row[]=[];
    for(let start=0;;start+=500){
     const {data,error}=await db.from('shipping_shipments').select('id,shipment_number,packing_slip,customer,status,updated_at').in('status',['DRAFT','READY','SHIPPED']).order('updated_at',{ascending:false}).order('id').range(start,start+499);
     if(error)throw error;all.push(...(data||[]));if((data||[]).length<500)break;
    }
    if(!stopped){setRows(all);setError('');}
   }catch(e){if(!stopped)setError(e instanceof Error?e.message:'Could not load saved shipments.');}
   finally{busy=false;if(!stopped)setLoading(false);}
  }
  void refresh();const timer=setInterval(()=>void refresh(),4000);
  return()=>{stopped=true;clearInterval(timer);};
 },[]);
 const q=search.trim().toLowerCase();
 const visible=rows.filter(r=>r.status===(selected==='CLEANUP'?'DRAFT':selected)&&(!q||[r.shipment_number,r.packing_slip,r.customer].some(v=>(v||'').toLowerCase().includes(q))));
 async function clearSelected(){
  const ids=checked.filter(id=>rows.some(r=>r.id===id&&r.status==='DRAFT'));
  if(!ids.length||!confirm('Clear '+ids.length+' selected draft packing slips? Ready and finished orders will be kept. Cleared slip numbers remain reserved to prevent duplicates.'))return;
  setClearing(true);setError('');
  try{
   const {data,error}=await db.rpc('clear_shipping_drafts',{p_ids:ids});if(error)throw error;
   const cleared:string[]=data?.cleared_ids||[];
   setRows(current=>current.filter(r=>!cleared.includes(r.id)));setChecked([]);onCleared(cleared);
   setNotice(cleared.length+' drafts cleared.'+(data?.skipped?' '+data.skipped+' orders were kept because their status changed.':''));
  }catch(e){setError(e instanceof Error?e.message:'Could not clear drafts.');}finally{setClearing(false);}
 }
 return <section className="no-print border-b border-line bg-paper px-5 py-4"><div className="mx-auto max-w-6xl">
  <div role="tablist" aria-label="Shipping order status" className="flex flex-wrap gap-3">{tabs.map(t=><button key={t.key} type="button" role="tab" aria-selected={selected===t.key} aria-controls="saved-shipping-panel" id={'shipping-tab-'+t.key} className={'katchup-btn '+(selected===t.key?'is-lit':'')} onClick={()=>{setSelected(t.key);setNotice('')}}>{t.title} ({rows.filter(r=>r.status===(t.key==='CLEANUP'?'DRAFT':t.key)).length})</button>)}</div>
  <div id="saved-shipping-panel" role="tabpanel" aria-labelledby={'shipping-tab-'+selected}>
   <div className="flex flex-wrap items-center gap-3 mt-3"><p className="text-muted text-sm">{tabs.find(t=>t.key===selected)?.hint}</p><input aria-label="Search saved shipments" placeholder="Search Packing Slip / customer" className="border border-line rounded-lg bg-card p-2 text-sm min-w-0" value={search} onChange={e=>setSearch(e.target.value)}/></div>
   {notice&&<p role="status" className="mt-3">{notice}</p>}
   {selected==='CLEANUP'&&<div className="flex flex-wrap gap-3 mt-3"><button type="button" className="katchup-btn" disabled={clearing||!visible.length} onClick={()=>setChecked(current=>[...new Set([...current,...visible.map(r=>r.id)])])}>Select visible drafts</button><button type="button" className="katchup-btn" disabled={clearing} onClick={()=>setChecked([])}>Deselect all</button><button type="button" className="katchup-btn" disabled={clearing||!checked.length} onClick={()=>void clearSelected()}>{clearing?'Clearing…':'Clear selected drafts ('+checked.length+')'}</button></div>}
   {error&&<p role="alert" className="mt-3">{error} — retrying live.</p>}
   {loading?<p className="my-4 text-muted">Loading saved shipments…</p>:<div className="max-h-72 overflow-auto mt-3">{visible.length?visible.map(r=><div key={r.id} className="flex flex-wrap items-center gap-3 border-b border-line py-3">{selected==='CLEANUP'&&<input type="checkbox" aria-label={'Select draft '+(r.packing_slip||r.shipment_number)} checked={checked.includes(r.id)} disabled={clearing} onChange={e=>setChecked(current=>e.target.checked?[...current,r.id]:current.filter(id=>id!==r.id))}/>}<div className="flex-1 min-w-0"><strong className="block break-words">{r.packing_slip||r.shipment_number||'Missing Packing Slip number'}</strong><span className="text-sm text-muted">{r.customer||'Customer not entered'}</span></div><button type="button" className="katchup-btn" disabled={!!opening} onClick={async()=>{setOpening(r.id);try{await onOpen(r.id)}finally{setOpening('')}}}>{opening===r.id?'Opening…':r.status==='SHIPPED'?'Open / reprint':'Open order'}</button></div>):<p className="my-4 text-muted">No {selected==='SHIPPED'?'finished':selected==='CLEANUP'?'draft':selected.toLowerCase()} shipments{q?' match your search':''}.</p>}</div>}
  </div>
 </div></section>;
}
