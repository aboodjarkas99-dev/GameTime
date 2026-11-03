import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import webpush from 'npm:web-push@3.6.7';
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 const secret=req.headers.get('x-gametime-push');if(!secret)return new Response('Unauthorized',{status:401});
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const batch=await db.rpc('claim_push',{p_secret:secret});if(batch.error||!batch.data)return new Response('Unauthorized',{status:401});
 webpush.setVapidDetails('https://gametime-secure-v2.vercel.app',batch.data.public_key,batch.data.private_key);
 let delivered=0,skipped=0,retried=0;
 for(const job of batch.data.jobs){
  const result=await db.rpc('push_payload',{p_id:job.id,p_claim:job.claim});let state='skipped';
  if(result.error)state='retry';else if(result.data){const payload=result.data;let sent=false,failed=false;
   for(const sub of payload.subscriptions){try{const url=new URL(sub.endpoint),host=url.hostname;if(url.protocol!=='https:'||!(host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host.endsWith('.push.services.mozilla.com')||host.endsWith('.push.apple.com')||host.endsWith('.notify.windows.com')))throw new Error('Invalid push endpoint');
    await webpush.sendNotification({endpoint:sub.endpoint,keys:sub.keys},JSON.stringify({title:payload.title,body:payload.body,url:payload.url,tag:payload.tag}),{TTL:900,timeout:10000});sent=true;
   }catch(e){if(e.statusCode===404||e.statusCode===410)await db.from('push_subscriptions').delete().eq('id',sub.id);else failed=true;}}
   state=sent?'delivered':failed?'retry':'skipped';
  }
  const saved=await db.rpc('finish_push',{p_id:job.id,p_claim:job.claim,p_state:state});if(saved.error)return new Response('Could not record delivery',{status:500});
  if(state==='delivered')delivered++;else if(state==='retry')retried++;else skipped++;
 }
 return Response.json({delivered,skipped,retried});
});
