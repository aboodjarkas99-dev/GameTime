import {createClient} from '@supabase/supabase-js';
import {buildPlan,isPlan,productLabel} from './plan';
import {DEFAULT_RULES,DEFAULT_SETTINGS} from './defaults';
import type {OrderLine,SizeKey} from './types';
export const db=createClient('https://bqnptjfdsxzbxtkzigim.supabase.co','sb_publishable_PW16QU5CtZBRe42mGPBrHg_g8McvcP1');
export type FloorPerson={session:string;name:string;role:'admin'|'annette';orderName:string;customer:string;since:number;seenAt:number};
export type ReturnLine={name:string;qty:string;sku:string;size:string;batch:string};
export type OpenOrder={id:string;orderName:string;customer:string;notes:string;lines:{sku:string;description:string;size:SizeKey;qty:number}[];openedAt:number;worker:string;workerSession:string;claimedAt:number;checked:number;total:number;ready:boolean};
export type DoneOrder={id:string;orderName:string;customer:string;notes:string;finishedBy:string;finishedAt:number;day:string;pallets:number;pails:number;boxes:number;lines:ReturnLine[]};
export type ReturnSlip=Omit<DoneOrder,'day'>;
type Request={data:any};
export let account:{id:string;display_name:string;role:string;page_roles?:string[]}|null=null;
export async function authorize(){const {data:{session}}=await db.auth.getSession();if(!session)return null;const {data,error}=await db.from('profiles').select('id,display_name,role,page_roles,active').eq('id',session.user.id).single();if(error||!data?.active||![data.role,...(data.page_roles||[])].some(r=>['manager','chemist','shipping'].includes(r)))return null;account=data;return data;}
async function rpc(name:string,params:any){const {data,error}=await db.rpc(name,params);if(error)throw new Error(error.message.includes('shipping_packing_slip_unique')?'Packing Slip number already exists. Open the existing order to reprint; inventory will not be deducted twice.':error.message);return data;}
export async function deskStatus(id:string){const {data,error}=await db.from('shipping_shipments').select('*').eq('id',id).single();if(error)throw new Error(error.message);return data;}
export function storagePlan(lines:OrderLine[],rules=DEFAULT_RULES,mixSmall=true,palletTareLb=45){const plan=buildPlan(lines,rules,{mixSmall,palletTareLb});if(!isPlan(plan))throw new Error(plan.error);return {ok:true,...plan,pallets:plan.pallets.map(p=>({...p,items:p.lines.map(l=>({product:productLabel(l.sku,l.description,l.size),sku:l.sku,size:l.size,units:l.units,boxes:l.size==='gal5'?null:l.packs,onTop:l.onTop}))}))};}
export async function persistDesk(state:any,status='DRAFT'){
 if(!account)throw new Error('Sign in with Shipping or Management.');
 const lines:OrderLine[]=state.lines.filter((l:OrderLine)=>l.qty>0);if(!lines.length)throw new Error('Add shipment lines first.');
 const prior=state.id?await deskStatus(state.id):null;if(prior&&['SHIPPED','CANCELED'].includes(prior.status))throw new Error('Shipment locked: '+prior.status);
 const plan=storagePlan(lines,state.rules??DEFAULT_RULES,state.mixSmall??true,state.palletTareLb??45);
 const floor={...prior?.pallet_plan?.floor,...state,lines};
 return await rpc('save_shipping_shipment',{p_shipment_id:state.id||null,p_header:{shipment_number:state.orderName,packing_slip:state.orderName,customer:state.customer,notes:state.notes,status,salesperson_name:state.salespersonName||'',salesperson_email:state.salespersonEmail||'',source_kind:'upload',slip_text:state.slipText||'',batch_codes:Object.values(state.batchCodes||{})},p_lines:lines.map(l=>({...l,inventory_product:state.inventoryProducts?.[l.id]||productLabel(l.sku,l.description,l.size),batch:state.batchCodes?.[l.id]||''})),p_plan:{...plan,floor},p_totals:plan.totals}) as string;
}
export async function postDeskOrder({data}:Request){let existing=null;if(data.orderName){const r=await db.from('shipping_shipments').select('id').eq('shipment_number',data.orderName).eq('customer',data.customer).in('status',['DRAFT','READY']).limit(1);if(r.error)throw r.error;existing=r.data?.[0]?.id;}const id=await persistDesk({...data,id:existing,lines:data.lines.map((l:any,i:number)=>({...l,id:l.id||String(i)})),rules:DEFAULT_RULES,...DEFAULT_SETTINGS});return {ok:true as const,id};}
export async function listWork({data}:Request){
 const res=await db.from('shipping_shipments').select('*').neq('status','CANCELED').order('created_at',{ascending:false}).limit(500);if(res.error)throw new Error(res.error.message);
 const open:OpenOrder[]=[],done:DoneOrder[]=[];
 for(const s of res.data||[]){const f=s.pallet_plan?.floor||{},d=f.done;
  if(d||s.status==='SHIPPED'){if((d?.day||s.shipped_date||s.created_at.slice(0,10))===data.day)done.push({id:s.id,orderName:s.shipment_number||'',customer:s.customer||'',notes:s.notes||'',finishedBy:d?.finishedBy||'',finishedAt:d?.finishedAt||Date.parse(s.shipped_at||s.updated_at),day:d?.day||s.shipped_date,pallets:s.totals?.pallets||0,pails:d?.pails||0,boxes:d?.boxes||0,lines:d?.lines||[]});continue;}
  let lines=f.lines;if(!lines){const r=await db.from('shipping_lines').select('sku,description,size,qty').eq('shipment_id',s.id).order('line_order');if(r.error)throw new Error(r.error.message);lines=r.data;}
  open.push({id:s.id,orderName:s.shipment_number||'',customer:s.customer||'',notes:s.notes||'',lines,openedAt:Date.parse(s.created_at),worker:f.worker||'',workerSession:f.workerSession||'',claimedAt:f.claimedAt||0,checked:f.checked||0,total:f.total||0,ready:f.ready||s.status==='READY'});
 }
 const people=await db.from('shipping_desk_sessions').select('*').gte('seen_at',new Date(Date.now()-45000).toISOString());if(people.error)throw new Error(people.error.message);
 return {ok:true as const,open,done,people:(people.data||[]).map(p=>({session:p.session,name:p.name,role:p.role,orderName:p.order_name,customer:p.customer,since:p.since,seenAt:Date.parse(p.seen_at)})) as FloorPerson[]};
}
export async function pulseWork({data}:Request){if(!account)return {ok:false};const r=await db.from('shipping_desk_sessions').upsert({user_id:account.id,session:data.session,name:account.display_name,role:account.role==='shipping'?'annette':'admin',order_name:data.orderName,customer:data.customer,since:data.since,seen_at:new Date(data.active?Date.now():0).toISOString()},{onConflict:'user_id,session'});if(r.error)throw r.error;return {ok:true};}
const patch=async(id:string,data:any)=>rpc('shipping_desk_patch',{p_id:id,p_patch:data});
export async function claimDeskOrder({data}:Request){return patch(data.id,{worker:account?.display_name||data.worker,workerSession:data.session,claimedAt:Date.now()})}
export async function touchDeskOrder({data}:Request){return patch(data.id,{checked:data.checked,total:data.total,ready:data.ready})}
export async function releaseDeskOrder({data}:Request){return patch(data.id,{worker:'',workerSession:'',claimedAt:0})}
export async function cancelDeskOpen({data}:Request){await rpc('cancel_shipping_shipment',{p_shipment_id:data.id});return {ok:true};}
export async function cancelDeskDone({data}:Request){return cancelDeskOpen({data})}
export async function completeDeskOrder({data}:Request){const s=await deskStatus(data.id),f=s.pallet_plan?.floor||{};if(s.status==='SHIPPED'){const {floor,...done}=data;return rpc('complete_printed_shipping',{p_id:data.id,p_floor:floor,p_done:done});}await persistDesk({...f,id:data.id,done:{...data,finishedAt:Date.now(),finishedBy:account?.display_name}},'READY');return {ok:true};}
export async function pullDeskOrder(_r:Request){return {ok:true,order:null};}
export async function returnDeskOrder({data}:Request){if(!data.id){const r=await db.from('shipping_shipments').select('id').eq('shipment_number',data.orderName).eq('customer',data.customer).in('status',['DRAFT','READY']).limit(1);if(r.error)throw r.error;data.id=r.data?.[0]?.id;if(!data.id)throw new Error('Save the live order first.');}return completeDeskOrder({data});}
export async function confirmDeskOrder(_r:Request){return {ok:true};}
export async function shipDesk(id:string){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const part=(t:string)=>parts.find(p=>p.type===t)?.value;return rpc('mark_shipping_shipped',{p_shipment_id:id,p_ship_date:`${part('year')}-${part('month')}-${part('day')}`})}
export async function readPackingSlip({data}:Request){
 try{const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc='/shipping-desk/pdf.worker.min.mjs';const doc=await pdfjs.getDocument({data:Uint8Array.from(atob(data.base64),c=>c.charCodeAt(0))}).promise;const {pdfPageText}=await import('../../document-scan.mjs');let text='';
  if(doc.numPages>30){await doc.destroy();throw new Error('Split PDFs longer than 30 pages. No pages were skipped.');}
  try{for(let n=1;n<=doc.numPages;n++){const p=await doc.getPage(n),tc=await p.getTextContent();let t=pdfPageText(tc.items);if(t.replace(/\s/g,'').length<80){const v=p.getViewport({scale:2.5}),c=document.createElement('canvas');c.width=v.width;c.height=v.height;await p.render({canvasContext:c.getContext('2d')!,viewport:v}).promise;const {readSlipPhoto}=await import('./scan');const blob=await new Promise<Blob>(r=>c.toBlob(b=>r(b!),'image/jpeg',.98));t=await readSlipPhoto(new File([blob],`page-${n}.jpg`,{type:'image/jpeg'}));}text+=t+'\n\n';p.cleanup();}return {ok:true as const,text};}finally{await doc.destroy()}
 }catch(e){return {ok:false as const,error:e instanceof Error?e.message:'Could not read PDF'};}
}

export async function confirmDeskPrint(id:string,state:any){return rpc('confirm_shipping_print',{p_shipment_id:id,p_expected_floor:state})}
