import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const origin = "https://gametime-secure-v2.vercel.app";
const headers = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
  "Vary": "Origin"
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers });
const day = () => new Intl.DateTimeFormat("en-CA", {timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
async function all(query: any) {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const {data,error} = await query().range(offset,offset+499);
    if(error) throw error;
    rows.push(...(data||[]));
    if(!data || data.length<500) return rows;
  }
}
Deno.serve(async req => {
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers});
  if(req.method!=="POST") return json({error:"Method not allowed"},405);
  const token = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if(!token) return json({error:"Sign in required"},401);
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
  try {
    const {data:{user},error:authError}=await admin.auth.getUser(token);
    if(authError||!user) return json({error:"Sign in required"},401);
    const {data:p,error:profileError}=await admin.from("profiles").select("role,page_roles,active").eq("id",user.id).maybeSingle();
    if(profileError) throw profileError;
    if(!p?.active||p.role!=="viewer"||(p.page_roles||[]).some((r:string)=>r!=="viewer")) return json({error:"Use a dedicated Read Only account"},403);
    const today=day();
    const [orders, shipments] = await Promise.all([
      all(()=>admin.from("work_orders").select("id,product,batch,tank,quart,gallon,five,jerry,jerry_enabled,actual_quart,actual_gallon,actual_five,actual_jerry,priority,batch_status,prod_status,batch_work_date,prod_work_date,work_date,batch_made_date,batch_order,prod_order,production_only,batch_active,prod_active,held,catalyst").is("deleted_at",null).eq("hold_line",false).or("batch_work_date.eq."+today+",prod_work_date.eq."+today+",work_date.eq."+today).order("id")),
      all(()=>admin.from("shipping_shipments").select("id,shipment_number,packing_slip,status,created_at,updated_at,shipped_date").or("status.in.(DRAFT,READY),and(status.eq.SHIPPED,shipped_date.eq."+today+")").order("id"))
    ]);
    const lines: any[]=[];
    for(let i=0;i<shipments.length;i+=50){
      const ids=shipments.slice(i,i+50).map(s=>s.id);
      lines.push(...await all(()=>admin.from("shipping_lines").select("id,shipment_id,inventory_product,description,size,qty,inventory_managed").in("shipment_id",ids).order("id")));
    }
    const byShipment=new Map<string,any[]>();
    for(const l of lines){
      const list=byShipment.get(l.shipment_id)||[];
      list.push({product:(l.inventory_managed?l.inventory_product:l.description)||l.description||"Unnamed product",size:l.size,qty:l.qty});
      byShipment.set(l.shipment_id,list);
    }
    return json({date:today,generated_at:new Date().toISOString(),orders,shipments:shipments.map(s=>({id:s.id,number:s.packing_slip||s.shipment_number||"Unnumbered",status:s.status,created_at:s.created_at,updated_at:s.updated_at,products:byShipment.get(s.id)||[]}))});
  }catch(e){
    console.error("factory-display", e instanceof Error?e.message:"query failed");
    return json({error:"Could not refresh display"},500);
  }
});
