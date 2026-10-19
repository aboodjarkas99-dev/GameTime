const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {productLabel}=require('../src/lib/pallet/plan.ts');
assert.equal(productLabel('GTHS-5','Hybild','gal5'),'Hybild Sealer');
assert.equal(productLabel('GTHS-5','Hybild Sealer','gal5'),'Hybild Sealer');
assert.notEqual(productLabel('GTHS-5','Hybild Tinted Sealer','gal5'),'Hybild Sealer');
console.log('Hybild resolves to Hybild Sealer; tinted products remain distinct.');
