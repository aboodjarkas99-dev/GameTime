import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

// Configure a libpq service and password file outside the repository.
const destination = process.argv[2];
if (!destination || !process.env.PGSERVICE) throw Error('Usage: PGSERVICE=gametime node scripts/backup-gametime.mjs /private/backup/folder');
process.umask(0o077);
const root = resolve(destination);
mkdirSync(root, { recursive: true, mode: 0o700 });
const stage = mkdtempSync(join(root, '.incomplete-'));
const tables = ['work_orders','work_order_history','work_order_daily_progress','activity_logs','factory_products','inventory_product_aliases','inventory_events','inventory_event_lines','shipping_shipments','shipping_lines','shipping_product_reviews','fill_line_supplies','fill_line_supply_movements','fill_line_label_stock','fill_line_label_movements','label_requests','fill_line_consumption'];
const sql = query => execFileSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-c',query],{encoding:'utf8',maxBuffer:256*1024*1024});
const stamp = new Date().toISOString().replace(/[:.]/g,'-');
const dump = join(stage,'GameTime.dump');
try {
 execFileSync('pg_dump',['-Fc','--no-owner','--no-acl','-f',dump],{stdio:'inherit'});
 execFileSync('pg_restore',['--list',dump],{stdio:'ignore'});
 const workbook = Workbook.create();
 const overview = workbook.worksheets.add('Index');
 const index = [['Table','Rows'],['Exported UTC',stamp]];
 // Fetch these allowlisted tables in one statement for a consistent export snapshot.
 const data = JSON.parse(sql('SELECT json_build_object('+tables.map(t=>"'"+t+"',(SELECT coalesce(json_agg(row_to_json(r)),'[]') FROM public."+t+" r)").join(',')+')'));
 for (const table of tables) {
  const rows = data[table];
  index.push([table,rows.length]);
  const keys = Object.keys(rows[0]||{});
  const sheet = workbook.worksheets.add(table.slice(0,31));
  if (!keys.length) { sheet.getRange('A1').values=[['No records']]; continue; }
  if (rows.length>=1048576) throw Error('Excel row limit exceeded: '+table);
  const cell = x => {
   const v=x==null?'':typeof x==='object'?JSON.stringify(x):String(x);
   if(v.length>32767) throw Error('Excel cell limit exceeded: '+table);
   return /^[=+@\-]/.test(v)&&typeof x==='string'?"'"+v:v;
  };
  sheet.getRangeByIndexes(0,0,1,keys.length).values=[keys];
  for(let offset=0;offset<rows.length;offset+=1000) {
   const block=rows.slice(offset,offset+1000).map(row=>keys.map(k=>cell(row[k])));
   sheet.getRangeByIndexes(offset+1,0,block.length,keys.length).values=block;
  }
 }
 overview.getRangeByIndexes(0,0,index.length,2).values=index;
 await (await SpreadsheetFile.exportXlsx(workbook)).save(join(stage,'GameTime.xlsx'));
 const final=join(root,'GameTime-'+stamp);
 renameSync(stage,final);
 console.log(final);
} catch(error) {
 // Keep a valid database archive even if the optional workbook export failed.
 try { execFileSync('pg_restore',['--list',dump],{stdio:'ignore'}); console.error('Database archive retained at '+dump); }
 catch { rmSync(stage,{recursive:true,force:true}); }
 throw error;
}
