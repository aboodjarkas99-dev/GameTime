const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const nodes={};const node=id=>nodes[id]??=({value:'',textContent:'',innerHTML:'',disabled:false,querySelectorAll:()=>[]});
let ids=0,calls=[],offline=true,closed=[];
const ctx={isManager:true,hasEmployeeRole:()=>false,$:node,crypto:{randomUUID:()=> 'request-'+(++ids)},locale:()=> 'en-US',esc:s=>String(s).replace(/</g,'&lt;'),showModal(){},hideModal:id=>closed.push(id),toast(){},t:k=>k,db:{rpc:async(name,body)=>{calls.push({name,body});return {error:offline?{message:'offline'}:null}}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('fill-line.js','utf8'),ctx);
vm.runInContext("fillSupplies=[{id:'four_gallon_box',name:'4 Gallon Box',category:'boxes',description:'4 containers',units_per_box:4,stock_units:null},{id:'f_style',name:'F Style',category:'containers',description:'1 gallon',stock_units:1234}];",ctx);
ctx.renderFillSupplies();assert.match(node('fillSuppliesBody').innerHTML,/Not counted yet/);assert.match(node('fillSuppliesBody').innerHTML,/1,234/);
node('fillSuppliesSearch').value='F Style';ctx.renderFillSupplies();assert.doesNotMatch(node('fillSuppliesBody').innerHTML,/4 Gallon Box/);
assert.equal(ctx.fillGallonLabel({fillPackaging:{gallon_style:'f_style'}}),'F STYLE · 1 GALLON');assert.match(ctx.fillPackagingBadge({fillPackaging:{gallon_style:'f_style',f_style_lid:'seal'}}),/SEAL LID/);
ctx.loadFillSupplies=async()=>{};
(async()=>{
 ctx.openFillSupplyMovement('four_gallon_box','count');node('fillSupplyQuantity').value='1.5';await ctx.saveFillSupplyMovement();assert.equal(calls.length,0);
 node('fillSupplyQuantity').value='100';await ctx.saveFillSupplyMovement();assert.equal(calls.length,1);assert.equal(closed.length,0);const request=calls[0].body.p_request_id;
 offline=false;await ctx.saveFillSupplyMovement();assert.equal(calls[1].body.p_request_id,request);assert.ok(closed.includes('fillSupplyMovementModal'));
 node('fillSupplyQuantity').value='101';await ctx.saveFillSupplyMovement();assert.notEqual(calls[2].body.p_request_id,request);
 console.log('Supply search, unknown opening counts, whole quantities, F Style labels, and safe retry IDs passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
