/** Canonical names shared by inventory mappings and packing-slip labels. */
export function canonicalProductName(name:string):string {
 const key=name.trim().toLowerCase().replace(/[\s-]+/g,'');
 const aliases:Record<string,string>={hybild:'Hybild Sealer',hybildsealer:'Hybild Sealer',overtime:'OverTime Finish',overtimefinish:'OverTime Finish',overtimecatalyst:'OverTime Catalyst',xcela:'X-cel 2k High Solids Part A',xcelparta:'X-cel 2k High Solids Part A',xcel2khighsolidsparta:'X-cel 2k High Solids Part A',xcelb:'X-cel Catalyst Part B',xcelpartb:'X-cel Catalyst Part B',xcelcatalystpartb:'X-cel Catalyst Part B'};
 return aliases[key]||name;
}
