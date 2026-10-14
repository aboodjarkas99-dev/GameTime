const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const src=fs.readFileSync('src/components/pallet-desk.tsx','utf8');
const functions=src.slice(src.indexOf('  async function preparePrintedSnapshot('),src.indexOf('  async function confirmPrinted('));
const calls=[];
const ctx={Error,printLock:{current:false},autoSaveTimer:{current:null},cloudQueue:{current:new Promise(()=>{})},lines:[{qty:2}],mismatch:false,window:{print(){calls.push('print')}},deskState:()=>({id:'',orderName:'SLIP-1',lines:[{qty:2}]}),setPrintBusy:v=>{ctx.busy=v},setPrintError:v=>{ctx.error=v},setPrintPending:v=>{ctx.pending=v},setActiveOpenId(){},setCloudStatus(){},deskStatus:async()=>null,persistDesk:async()=>{calls.push('save');return 'saved-id'},clearTimeout};
vm.createContext(ctx);vm.runInContext(ts.transpileModule(functions,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
(async()=>{
 ctx.printBreakdown();assert.deepEqual(calls,['print']);assert.equal(ctx.pending.id,'');assert.equal(ctx.printLock.current,true);
 ctx.cloudQueue.current=Promise.resolve();await ctx.preparePrintedSnapshot(ctx.pending.state);assert.equal(ctx.pending.id,'saved-id');assert.deepEqual(calls,['print','save']);
 await ctx.preparePrintedSnapshot({orderName:'',id:''});assert.match(ctx.error,/Packing Slip number/);
 ctx.persistDesk=async()=>{throw new Error('offline')};await ctx.preparePrintedSnapshot({orderName:'SLIP-1',id:''});assert.match(ctx.error,/offline/);assert.equal(ctx.busy,false);
 ctx.printLock.current=false;ctx.mismatch=true;ctx.printBreakdown();assert.equal(calls.filter(c=>c==='print').length,2);
 console.log('Print opens before cloud saving; missing slip and failed save show errors without blocking printing.');
})().catch(e=>{console.error(e);process.exitCode=1});
