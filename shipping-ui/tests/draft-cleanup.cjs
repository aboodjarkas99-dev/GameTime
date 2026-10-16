const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const source=fs.readFileSync('src/components/shipping-status-tabs.tsx','utf8');const code=source.slice(source.indexOf(' async function clearSelected(){'),source.indexOf(' return <section'));
let sent=[],clearNotice='',cleared=[],error='',currentRows=[{id:'draft',status:'DRAFT'},{id:'ready',status:'READY'},{id:'finished',status:'SHIPPED'}];
const ctx={checked:['draft','ready','finished'],rows:currentRows,confirm:()=>true,setClearing(){},setError:v=>error=v,setRows:fn=>currentRows=fn(currentRows),setChecked(){},setNotice:v=>clearNotice=v,onCleared:ids=>cleared=ids,db:{rpc:async(name,args)=>{sent.push({name,args});return {data:{cleared_ids:['draft'],skipped:0},error:null}}}};
vm.createContext(ctx);vm.runInContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
(async()=>{
 ctx.confirm=()=>false;await ctx.clearSelected();assert.equal(sent.length,0);
 ctx.confirm=()=>true;await ctx.clearSelected();assert.deepEqual(Array.from(sent[0].args.p_ids),['draft']);assert.deepEqual(currentRows.map(r=>r.id),['ready','finished']);assert.deepEqual(Array.from(cleared),['draft']);assert.match(clearNotice,/1 drafts cleared/);
 ctx.db.rpc=async()=>({error:{message:'offline'}});const before=currentRows;await ctx.clearSelected();assert.equal(currentRows,before);assert.ok(error);
 console.log('Draft cleanup confirms selection, excludes ready/finished, and preserves rows on failure.');
})().catch(e=>{console.error(e);process.exitCode=1});
