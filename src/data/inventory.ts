import { ModuleDescriptor, ModuleMeasurement } from '../types';
import { moduleForPlacement } from './measurements';
import { PART_LABELS, sectionKeys, SUBDETECTORS } from '../geometry/visibility';
export interface InventoryModule {
  serial: string;
  module: ModuleDescriptor;
  installed: boolean;
  hasData: boolean;
  chips: number;
}
export function inventoryGroupLabel(m:ModuleDescriptor):string {
  return `${m.subdetector} / ${PART_LABELS[m.subdetector][sectionKeys(m.subdetector).indexOf(m.sectionKey)]}`;
}
export function locationLabel(m:ModuleDescriptor):string {
  return `${m.subdetector} / ${PART_LABELS[m.subdetector][sectionKeys(m.subdetector).indexOf(m.sectionKey)]} / ${m.layer ? `Layer ${m.layer}, ladder ${m.ladder}` : `Disk ${m.disk}, ring ${m.ring}`} / module ${m.moduleIndex}`;
}
export function buildInventory(json:string,modules:ModuleDescriptor[],measurements:Map<string,ModuleMeasurement>):{entries:InventoryModule[];issues:string[]} {
  const entries:InventoryModule[]=[],issues:string[]=[];
  let parsed:unknown;
  try { parsed=JSON.parse(json || '{}'); } catch { return {entries,issues:['The hardware mapping is not valid JSON. Regenerate it from the YAML files.']}; }
  if (!parsed || typeof parsed!=='object' || Array.isArray(parsed)) { return {entries,issues:['The mapping must be an object keyed by module serial.']}; }
  const occupied=new Map<string,string>();
  for (const [serial,raw] of Object.entries(parsed)) {
    if(!raw || typeof raw!=='object' || Array.isArray(raw)) {issues.push(`${serial}: invalid placement.`);continue;}
    const entry=raw as Record<string,unknown>;
    const module=moduleForPlacement(entry,modules);
    if (!module) {issues.push(`${serial}: placement does not match the detector geometry.`);continue;}
    const previous=occupied.get(module.id);
    if(previous) {issues.push(`${serial} and ${previous}: duplicate physical position; installation excluded.`);const other=entries.find(e=>e.serial===previous);if(other){other.installed=false;}continue;}
    occupied.set(module.id,serial);
    entries.push({serial,module,installed:true,hasData:measurements.has(module.id),chips:entry.chips && typeof entry.chips==='object'?Object.keys(entry.chips).length:0});
  }
  for(const [id,measurement] of measurements) {
    const module=modules.find(m=>m.id===id);
    if(module && !occupied.has(id)) {entries.push({serial:measurement.moduleId || id,module,installed:false,hasData:true,chips:Object.keys(measurement.chips).length});}
  }
  entries.sort((a,b)=>SUBDETECTORS.indexOf(a.module.subdetector)-SUBDETECTORS.indexOf(b.module.subdetector) || locationLabel(a.module).localeCompare(locationLabel(b.module),undefined,{numeric:true}) || a.serial.localeCompare(b.serial));
  return {entries,issues};
}
