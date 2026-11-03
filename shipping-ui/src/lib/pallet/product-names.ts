/** Canonical names shared by inventory mappings and packing-slip labels. */
export function canonicalProductName(name:string):string {
 const clean=name.replace(/\bper[\s-]+cases?\b/gi,' ').replace(/^[\s\-/(),]+|[\s\-/(),]+$/g,'').replace(/\s+/g,' ').trim();
 const family=clean.match(/^(Omega|Alpha|Phoenix|Hydra)\s+(?:1k\s+)?(Matte|Satin|Gloss|Semi[\s-]*(?:Gloss|Glass))$/i);
 if(family){const brand=family[1][0].toUpperCase()+family[1].slice(1).toLowerCase(),sheen=family[2].toLowerCase().startsWith('semi')?(brand==='Phoenix'||brand==='Hydra'?'SemiGlass':'Semi Gloss'):family[2][0].toUpperCase()+family[2].slice(1).toLowerCase();return brand+' '+sheen}
 const key=clean.toLowerCase().replace(/[\s-]+/g,'');
 const aliases:Record<string,string>={'1k':'AND1k',and1k:'AND1k',hybild:'Hybild Sealer',hybildsealer:'Hybild Sealer',overtime:'OverTime Finish',overtimefinish:'OverTime Finish',overtimecatalyst:'OverTime Catalyst',xcela:'X-cel 2k High Solids Part A',xcelparta:'X-cel 2k High Solids Part A',xcel2khighsolidsparta:'X-cel 2k High Solids Part A',xcelb:'X-cel Catalyst Part B',xcelpartb:'X-cel Catalyst Part B',xcelcatalystpartb:'X-cel Catalyst Part B'};
 return aliases[key]||clean;
}
