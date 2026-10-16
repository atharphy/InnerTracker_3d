/* Export actual generated geometry, not manually maintained population tables.
 * Run: node export_module_counts.cjs
 */
require('ts-node').register({skipProject:true,transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node',target:'ES2020'}});
const fs=require('node:fs');
const path=require('node:path');
const {buildDetectorGeometry}=require('./src/geometry/buildGeometry');
const {DEFAULT_GEOMETRY,MM_PER_UNIT}=require('./src/geometry/config');
const modules=buildDetectorGeometry(DEFAULT_GEOMETRY);
const destination=path.join(__dirname,'exports/module_counts');
fs.mkdirSync(destination,{recursive:true});
const quote=v=>{const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
function csv(name,headers,rows){fs.writeFileSync(path.join(destination,name),[headers,...rows].map(r=>r.map(quote).join(',')).join('\n')+'\n');}
function location(m){return [m.subdetector,m.layer??'',m.ladder??'',m.zSide??m.side,m.disk??'',m.ring??'',m.subdetector==='TBPX'?m.sectionKey.split(':')[1]:(m.half==='upper'?'right':'left')];}
const headers=['subdetector','layer','ladder','z_side','disk','ring','spatial_half'];
const groups=new Map();
for(const m of modules){const fields=location(m),key=fields.join('|');if(!groups.has(key)){groups.set(key,{fields,modules:[]});}groups.get(key).modules.push(m);}
const ordered=[...groups.values()].sort((a,b)=>a.fields.join('|').localeCompare(b.fields.join('|'),'en',{numeric:true}));
csv('module_counts_by_location.csv',[...headers,'module_type','module_count','surviving_module_indices'],ordered.map(g=>[...g.fields,g.modules[0].moduleType,g.modules.length,g.modules.map(m=>m.moduleIndex).sort((a,b)=>a-b).join(';')]));
const summaries=new Map();
for(const m of modules){
 const keys=[['subdetector',m.subdetector,'','','',''],m.subdetector==='TBPX'?['layer',m.subdetector,m.layer,'','','']:['disk',m.subdetector,'',m.side,m.disk,'']];
 if(m.subdetector!=='TBPX'){keys.push(['disk_ring',m.subdetector,'',m.side,m.disk,m.ring]);}
 for(const fields of keys){const key=fields.join('|');if(!summaries.has(key)){summaries.set(key,{fields,count:0});}const s=summaries.get(key);s.count++;}
}
csv('module_count_summary.csv',['aggregation','subdetector','layer','z_side','disk','ring','module_count'],[...summaries.values()].map(s=>[...s.fields,s.count]));
csv('module_positions.csv',['module_id',...headers,'module_index','module_type','x_mm','y_mm','z_mm','dee_support_z_mm','populated_face'],modules.map(m=>[m.id,...location(m),m.moduleIndex,m.moduleType,...m.position.map(x=>+(x*MM_PER_UNIT).toFixed(6)),m.supportZ===undefined?'':+(m.supportZ*MM_PER_UNIT).toFixed(6),m.supportZ===undefined?'':m.position[2]>m.supportZ?'+z':'-z']));
// Independent reference populations verified against CMS IT711 ring placements.
const referenceRings={TFPX:[20,32,24,32],TEPX:[20,28,36,44,48]};
csv('ring_count_discrepancy.csv',['subdetector','z_side','disk','ring','reference_modules','current_model_modules','missing_modules'],[...summaries.values()].filter(s=>s.fields[0]==='disk_ring').map(s=>{const [,subdetector,,side,disk,ring]=s.fields;const reference=referenceRings[subdetector][ring-1];return [subdetector,side,disk,ring,reference,s.count,reference-s.count];}));
const sum=ordered.reduce((n,g)=>n+g.modules.length,0);
if(sum!==3892||new Set(modules.map(m=>m.id)).size!==sum){throw Error('Unexpected population or duplicate module IDs; review changed geometry.');}
fs.writeFileSync(path.join(destination,'README.md'),`# Module count export\n\nGenerated with \`node export_module_counts.cjs\` from the current default geometry.\n\n- module_counts_by_location.csv: mutually exclusive groups; sum module_count for the total. TBPX rows are per layer, signed ladder and Z side. Disk rows are per subdetector, Z side, disk, ring and spatial half.\n- module_count_summary.csv: separate subtotal levels; filter aggregation before summing (do not sum all levels together).\n- module_positions.csv: one row per module, with stable geometry ID and coordinates in mm. These are nominal geometry positions, not installed serial numbers.\n\nPopulation: 3,892 = 756 TBPX + 1,728 TFPX + 1,408 TEPX. The restored two-sided Dee population matches the slides. It includes all positions in that model, not just YAML-installed modules. All original disk indices are restored.\n\nDisk spatial_half right corresponds to the legacy YAML half 'upper'; left corresponds to 'lower'. Disk indices start at 0; barrel module indices start at 1. +z and -z disk numbers are separate physical disks. Coordinates use restored nominal ring radii and staggered Z planes.\n`);
console.log(JSON.stringify({modules:sum,locationRows:ordered.length,output:destination}));
