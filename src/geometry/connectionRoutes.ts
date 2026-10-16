import * as THREE from 'three';
import {ModuleDescriptor} from '../types';
import {InstalledPortcard} from '../data/portcards';
import {mm} from './config';
import {moduleSocket,moduleNormal,moduleCableExit,portcardSlots,portcardSocket,portcardSocketLocal,slotMatchesModule,PortcardSlot} from './connectionAnchors';
export interface Route {module:ModuleDescriptor;slot:PortcardSlot;lpgbt:number;explicit:boolean;points:THREE.Vector3[]}
export function connectionRoutes(modules:ModuleDescriptor[],cards:InstalledPortcard[],installed:Set<string>,installedOnly:boolean,connectedOnly:boolean):Route[]{
 const slots=portcardSlots(),explicit=new Map(cards.flatMap(c=>c.connections.map(link=>[link.module.id,{slot:c.slot,lpgbt:link.lpgbt}] as const)));
 return modules.filter(m=>(!installedOnly||installed.has(m.id))&&(!connectedOnly||explicit.has(m.id))).map(m=>{
   const candidates=slots.filter(s=>slotMatchesModule(s,m));
   const start=moduleSocket(m,'elink'),normal=moduleNormal(m);
   // Keep routing demonstrations separate from YAML connectivity.
   const known=explicit.get(m.id);
   const slot=known?.slot??candidates.sort((a,b)=>portcardSocket(a,1).distanceToSquared(start)-portcardSocket(b,1).distanceToSquared(start))[0];
   const lpgbt=known?.lpgbt??(m.moduleIndex%3),end=portcardSocket(slot,lpgbt);
   const side=Math.sign(m.position[2]),angle=Math.atan2(start.y,start.x),r=Math.hypot(start.x,start.y);
   const radial=(radius:number,z:number,a=angle)=>new THREE.Vector3(radius*Math.cos(a),radius*Math.sin(a),z);
   const local=portcardSocketLocal(slot,lpgbt),edgeX=mm(slot.kind==='tepx'?23:-23);
   // Bring the loom around the PCB edge onto the connector face before seating
   // the paddle. The last run is normal to the socket, not parallel to the beam.
   const approach=[
     new THREE.Vector3(edgeX,local.y,mm(-8)).applyMatrix4(slot.matrix),
     new THREE.Vector3(edgeX,local.y,mm(6)).applyMatrix4(slot.matrix),
     local.clone().add(new THREE.Vector3(0,0,mm(3))).applyMatrix4(slot.matrix),
     end,
   ];
   let points:THREE.Vector3[];
   if(m.subdetector==='TBPX'){
     const half=m.position[0]>0?1:-1,exitAngle=half>0?(start.y>=0?.95:-.95):(start.y>=0?Math.PI-.95:Math.PI+.95);
     // Run down the ladder edge, around its flange, through the service window,
     // along the outer forward envelope, then return to the cartridge socket.
     const exit=moduleCableExit(m,'elink'),edgeR=Math.hypot(exit.x,exit.y);
     const ladderEnd=exit.clone();ladderEnd.z=side*mm(208);
     const arc=Array.from({length:7},(_,i)=>{const t=i/6;let delta=exitAngle-angle;while(delta>Math.PI){delta-=2*Math.PI;}while(delta< -Math.PI){delta+=2*Math.PI;}return radial(edgeR+(mm(180)-edgeR)*t,side*mm(219+m.layer!*1.5),angle+delta*t);});
     const endAngle=Math.atan2(end.y,end.x);
     points=[start,start.clone().addScaledVector(normal,mm(1.8)),exit,ladderEnd,...arc,radial(mm(198),side*mm(245),exitAngle),radial(mm(198),end.z-side*mm(32),exitAngle),radial(mm(190),end.z-side*mm(18),endAngle),...approach];
   }else{
     const face=m.position[2]>=(m.supportZ??m.position[2])?1:-1;
     const surface=m.position[2]+face*mm(1.1),outer=mm(m.subdetector==='TEPX'?258:170);
     // TEPX path lies on its disk PCB, followed by a short peripheral flex.
     const exit=radial(outer,surface),endAngle=Math.atan2(end.y,end.x);
     const arc=Array.from({length:6},(_,i)=>{let delta=endAngle-angle;while(delta>Math.PI){delta-=2*Math.PI;}while(delta< -Math.PI){delta+=2*Math.PI;}return radial(outer,surface,angle+delta*i/5);});
     points=[start,start.clone().addScaledVector(normal,mm(1.1)),radial(r+mm(4),surface),exit,...arc.slice(1),...approach];
   }
   return {module:m,slot,lpgbt,explicit:!!known,points};
 });
}

