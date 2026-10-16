import {ModuleDescriptor} from '../types';
import {buildInventory} from './inventory';
import {portcardSlots,PortcardSlot,slotMatchesModule} from '../geometry/connectionAnchors';
export interface PortcardConnection {module:ModuleDescriptor;serial:string;lpgbt:number}
export interface InstalledPortcard {id:string;slot:PortcardSlot;connections:PortcardConnection[]}
export function buildPortcardInventory(json:string,moduleJson:string,modules:ModuleDescriptor[]):{entries:InstalledPortcard[];issues:string[]}{
  const issues:string[]=[],entries:InstalledPortcard[]=[];
  let parsed:unknown;
  try{parsed=JSON.parse(json||'{}');}catch{return {entries,issues:['Portcard mapping is not valid JSON.']};}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)){return {entries,issues:['Portcard mapping must be keyed by board ID.']};}
  const installed=new Map(buildInventory(moduleJson,modules,new Map()).entries.filter(e=>e.installed).map(e=>[e.serial,e.module]));
  const slots=new Map(portcardSlots().map(s=>[s.id,s]));
  const usedSlots=new Map<string,InstalledPortcard[]>(),usedModules=new Map<string,InstalledPortcard[]>();
  for(const [id,raw] of Object.entries(parsed)){
    const value=raw as {slot?:string;connections?:Array<{module:string;lpgbt:number}>}|null;
    const slot=value && slots.get(value.slot??'');
    if(!slot||!value||!Array.isArray(value.connections)){issues.push(`${id}: invalid slot or connections list.`);continue;}
    const entry:InstalledPortcard={id,slot,connections:[]};
    const seen=new Set<string>();
    for(const link of value.connections){
      const module=link && installed.get(link.module);
      if(!module||!Number.isInteger(link.lpgbt)||link.lpgbt<0||link.lpgbt>2||!slotMatchesModule(slot,module)){
        issues.push(`${id}: invalid connection to ${link?.module??'unknown module'} (check installed placement, region and lpGBT 0–2).`);continue;
      }
      if(seen.has(module.id)){issues.push(`${id}: duplicate connection to ${link.module}.`);continue;}
      seen.add(module.id);entry.connections.push({module,serial:link.module,lpgbt:link.lpgbt});
      usedModules.set(module.id,[...(usedModules.get(module.id)??[]),entry]);
    }
    entries.push(entry);usedSlots.set(slot.id,[...(usedSlots.get(slot.id)??[]),entry]);
  }
  const rejected=new Set<InstalledPortcard>();
  usedSlots.forEach((cards,slot)=>{if(cards.length>1){issues.push(`${slot}: multiple board IDs occupy this slot; excluded.`);cards.forEach(c=>rejected.add(c));}});
  usedModules.forEach((cards,module)=>{if(cards.length>1){issues.push(`${module}: assigned to multiple portcards; connection excluded.`);cards.forEach(c=>{c.connections=c.connections.filter(link=>link.module.id!==module);});}});
  return {entries:entries.filter(e=>!rejected.has(e)).sort((a,b)=>a.slot.id.localeCompare(b.slot.id,undefined,{numeric:true})),issues};
}
