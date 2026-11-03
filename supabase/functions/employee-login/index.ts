import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 let body:any;try{body=await req.json()}catch{return json({error:'Invalid request'},400)}
 const login=String(body.name||'').trim().replace(/\s+/g,' ').toLowerCase(),pin=String(body.pin||'').trim();
 if(!login||!/^\d{4,12}$/.test(pin))return json({error:'Invalid employee name or PIN'},400);
 const url=Deno.env.get('SUPABASE_URL')!,admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const {data:matches,error:lookupError}=await admin.rpc('employee_login_identity',{p_login:login});
 if(lookupError)return json({error:'Sign in unavailable'},500);
 if(!Array.isArray(matches)||matches.length!==1||!matches[0].email)return json({error:'Invalid employee name or PIN'},401);
 const client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!);
 const {data,error}=await client.auth.signInWithPassword({email:matches[0].email,password:pin});
 if(error||!data.session||!data.user||data.user.id!==matches[0].id)return json({error:'Invalid employee name or PIN'},401);
 return json({ok:true,session:{access_token:data.session.access_token,refresh_token:data.session.refresh_token}});
});
