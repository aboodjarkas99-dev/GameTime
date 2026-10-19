const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app.js','utf8'),nodes={};
const get=id=>nodes[id]??=({value:'',textContent:'',className:'',disabled:false});
for(const [id,value] of Object.entries({inventorySetProduct:'OverTime Catalyst',inventorySetCategory:'sport',inventorySetPackage:'quart_can',inventorySetQty:'212',inventorySetDate:'2026-10-19',inventorySetNote:'Cycle count'}))get(id).value=value;
let calls=0;const ctx={$:get,canEditInventoryStock:()=>true,canonicalFactoryProduct:v=>v,db:{functions:{invoke:async()=>{calls++;return {error:{message:'Edge Function returned a non-2xx status code',context:new Response(JSON.stringify({error:'Specific stock save error'}))}}}}}};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function saveInventorySet(){'),source.indexOf('let managerShippingRows=')),ctx);
(async()=>{await ctx.saveInventorySet();assert.equal(calls,1);assert.equal(get('inventorySetMessage').textContent,'Specific stock save error');assert.equal(get('saveInventorySetBtn').disabled,false);get('inventorySetCategory').value='';await ctx.saveInventorySet();assert.equal(calls,1);console.log('Stock save shows the actual server error and preserves category validation.');})().catch(e=>{console.error(e);process.exitCode=1});
