import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{...corsHeaders,"Content-Type":"application/json"}
});

function packageInfo(raw:string){
  const p=String(raw||"").trim().toLowerCase().replace(/[\s-]+/g,"_");
  const map:Record<string,string>={
    "5_gallon":"five_gallon_pail","5_gallon_pail":"five_gallon_pail","five":"five_gallon_pail","five_gallon":"five_gallon_pail","five_gallon_pail":"five_gallon_pail","pail":"five_gallon_pail",
    "gallon":"gallon","gallons":"gallon","1_gallon":"gallon","one_gallon":"gallon",
    "quart":"quart_can","quarts":"quart_can","quart_can":"quart_can",
    "pint":"pint_can","pints":"pint_can","pint_can":"pint_can",
    "jerry":"jerry_1_25","jerry_can":"jerry_1_25","jerry_1_25":"jerry_1_25",
    "vinyl_box":"vinyl_box","drawdown_box":"drawdown_box","box":"box","boxes":"box","unit":"unit","units":"unit"
  };
  const type=map[p];
  if(!type)return null;
  const gpu:Record<string,number|null>={five_gallon_pail:5,gallon:1,quart_can:.25,pint_can:.125,jerry_1_25:1.25,vinyl_box:null,drawdown_box:null,box:null,unit:null};
  return {type,gpu:gpu[type]};
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);

  const url=Deno.env.get("SUPABASE_URL")!;
  const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth=req.headers.get("Authorization")||"";
  const caller=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:u,error:uerr}=await caller.auth.getUser();
  if(uerr||!u.user)return json({error:"Unauthorized"},401);

  const {data:p,error:perr}=await caller.from("profiles").select("role,page_roles,active").eq("id",u.user.id).single();
  if(perr||!p?.active||![p.role,...(p.page_roles||[])].some(r=>["manager","chemist","inventory"].includes(r)))return json({error:"Full access required"},403);

  let body:any;
  try{body=await req.json()}catch{return json({error:"Invalid JSON"},400)}
  let product=String(body.product||"").trim().replace(/\s+/g," ");
  const pkg=packageInfo(body.package_type);
  const target=Number(body.target_units);
  const date=String(body.event_date||"").trim();

  if(!product)return json({error:"Product is required"},400);
  if(!pkg)return json({error:"Choose a valid package type"},400);
  if(!Number.isFinite(target)||target<0)return json({error:"Current stock must be 0 or higher"},400);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return json({error:"Valid date required"},400);

  if(![p.role,...(p.page_roles||[])].some(r=>["manager","chemist"].includes(r))){const {data:productRow}=await caller.from("factory_products").select("id,name").eq("name_key",product.toLowerCase()).eq("active",true).maybeSingle();if(!productRow)return json({error:"Choose an active company product."},400);product=productRow.name;}

  const admin=createClient(url,serviceRole);
  const {data,error}=await admin.rpc("set_inventory_stock_service",{
    p_event_id:"stock_set_"+crypto.randomUUID(),
    p_event_date:date,
    p_product:product,
    p_package_type:pkg.type,
    p_target_units:target,
    p_gallons_per_unit:pkg.gpu,
    p_note:String(body.note||"Manual current stock set").trim(),
    p_actor:u.user.id
  });
  if(error)return json({error:error.message},400);
  return json(data||{ok:true});
});
