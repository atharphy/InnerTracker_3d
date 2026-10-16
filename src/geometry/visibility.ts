import { ModuleDescriptor, Subdetector, VisibilityState } from '../types';
export const SUBDETECTORS: Subdetector[] = ['TBPX', 'TFPX', 'TEPX'];
export const PART_LABELS = {
  TBPX: ['Right / Z+', 'Right / Z−', 'Left / Z+', 'Left / Z−'],
  TFPX: ['Z+ / right Dee', 'Z+ / left Dee', 'Z− / right Dee', 'Z− / left Dee'],
  TEPX: ['Z+ / right Dee', 'Z+ / left Dee', 'Z− / right Dee', 'Z− / left Dee'],
};
export function sectionKeys(s: Subdetector): string[] {
  return s === 'TBPX' ? ['TBPX:right:+z','TBPX:right:-z','TBPX:left:+z','TBPX:left:-z'] : [`${s}:+z:upper`,`${s}:+z:lower`,`${s}:-z:upper`,`${s}:-z:lower`];
}
export function elementParts(v: VisibilityState, s: Subdetector, index: number): boolean[] {
  const stored = v.elementParts?.[`${s}:${index+1}`];
  return (Array.isArray(stored) && stored.length === 4 ? stored : v[`${s}Parts`]).map(x => x === true);
}
export function setElementParts(v: VisibilityState,s: Subdetector,index:number,parts:boolean[],resetDees=false): VisibilityState {
  const dees={...v.dees};
  parts.forEach((on,j)=>{if(on!==elementParts(v,s,index)[j] || resetDees){dees[`${s}:${index+1}|${sectionKeys(s)[j]}`]=[on,on];}});
  return {...v,dees,[s]:v[s].map((x,i)=>i===index ? parts.some(Boolean):x),elementParts:{...v.elementParts,[`${s}:${index+1}`]:parts}};
}
export function setSubdetector(v:VisibilityState,s:Subdetector,enabled:boolean): VisibilityState {
  return v[s].reduce((state,_,i)=>setElementParts(state,s,i,Array(4).fill(enabled),true),v);
}
export function partVisible(v:VisibilityState,element:string,section:string): boolean {
  const [sub,n]=element.split(':');const s=sub as Subdetector;const i=Number(n)-1;
  return !!v[s]?.[i] && (elementParts(v,s,i)[sectionKeys(s).indexOf(section)] ?? false);
}
export function visiblePartCount(v:VisibilityState): number {
  return SUBDETECTORS.reduce((total,s)=>total+v[s].reduce((n,on,i)=>n+(on ? elementParts(v,s,i).filter(Boolean).length:0),0),0);
}

// Dee 1 is the support closer to the interaction point, on either Z side.
export function moduleDee(m:ModuleDescriptor):number|undefined {
 return m.subdetector==='TBPX'?undefined:(Math.abs(m.supportZ!)<Math.abs(m.diskCenterZ!)?0:1);
}
export function deeParts(v:VisibilityState,element:string,section:string):boolean[]{
 return v.dees?.[element+'|'+section]??[true,true];
}
export function deeVisible(v:VisibilityState,element:string,section:string,dee?:number):boolean {
 return partVisible(v,element,section)&&(dee===undefined?deeParts(v,element,section).some(Boolean):deeParts(v,element,section)[dee]);
}
export function moduleVisible(v:VisibilityState,m:ModuleDescriptor):boolean {
 return deeVisible(v,m.visibilityKey,m.sectionKey,moduleDee(m));
}
export function setDee(v:VisibilityState,s:Subdetector,index:number,part:number,dee:number,on:boolean):VisibilityState{
 const element=`${s}:${index+1}`,section=sectionKeys(s)[part];
 const selected=partVisible(v,element,section)?[...deeParts(v,element,section)]:[false,false];selected[dee]=on;
 const parts=elementParts(v,s,index);parts[part]=selected.some(Boolean);
 const next=setElementParts(v,s,index,parts);
 return {...next,dees:{...next.dees,[element+'|'+section]:selected}};
}
