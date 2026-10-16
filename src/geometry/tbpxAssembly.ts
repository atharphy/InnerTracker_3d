import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ModuleDescriptor } from '../types';
import { mm } from './config';

export interface BarrelAssemblyPart { mesh:THREE.Group; visibilityKey:string; sectionKey:string; }
// Basti 18 May 2021, pp.9–15, 19, 32–35; Orfanelli pp.17, 21–23.
// Module centres are untouched. Small supports and cable trajectories are reconstructed.
export function tbpxAssembly(modules:ModuleDescriptor[],carbon:THREE.Material):{mechanics:BarrelAssemblyPart[];services:BarrelAssemblyPart[]} {
  const mechanics:BarrelAssemblyPart[]=[],services:BarrelAssemblyPart[]=[];
  const foam=new THREE.MeshStandardMaterial({color:0x353a3c,roughness:.95});
  const coolingCopper=new THREE.MeshStandardMaterial({color:0xb87333,metalness:.78,roughness:.3});
  const steel=new THREE.MeshStandardMaterial({color:0x909ba2,metalness:.65,roughness:.38});
  const pcb=new THREE.MeshStandardMaterial({color:0x246644,roughness:.72});
  const copper=new THREE.MeshStandardMaterial({color:0xc49a39,metalness:.35,roughness:.65});
  const power=new THREE.MeshStandardMaterial({color:0xa6342e,roughness:.7});
  const bias=new THREE.MeshStandardMaterial({color:0x3c608e,roughness:.7});
  const sections=new Map<string,ModuleDescriptor[]>();
  modules.filter(m=>m.subdetector==='TBPX').forEach(m=>{const key=m.visibilityKey+'|'+m.sectionKey;sections.set(key,[...(sections.get(key)??[]),m]);});
  const batch=(group:THREE.Group)=>{
    group.updateMatrixWorld(true);const mats=new Map<THREE.Material,THREE.BufferGeometry[]>();
    group.traverse(o=>{if(o instanceof THREE.Mesh&&!Array.isArray(o.material)){const clone=o.geometry.clone();const g=(clone.index?clone.toNonIndexed():clone).applyMatrix4(o.matrixWorld);if(g!==clone){clone.dispose();}mats.set(o.material,[...(mats.get(o.material)??[]),g]);o.geometry.dispose();}});
    group.clear();mats.forEach((gs,mat)=>{const geometry=mergeGeometries(gs);if(geometry){group.add(new THREE.Mesh(geometry,mat));}gs.forEach(g=>g.dispose());});
  };
  for(const [key,section] of sections){
    const [visibilityKey,sectionKey]=key.split('|'),first=section[0],layer=first.layer!,side=first.zSide==='+z'?1:-1,half=first.ladder!>0?1:-1;
    const structure=new THREE.Group(),wiring=new THREE.Group();
    structure.name=`TBPX L${layer} ${sectionKey} flange and ladders`;wiring.name=`TBPX L${layer} ${sectionKey} services`;
    const ladders=[...new Set(section.map(m=>m.ladder!))].map(ladder=>section.filter(m=>m.ladder===ladder));
    const front=mm(207),back=Math.min(...section.map(m=>side*m.position[2]-m.size[2]/2))-mm(2);
    const point=(r:number,a:number,z:number)=>new THREE.Vector3(half*r*Math.sin(a),r*Math.cos(a),side*z);
    const angle=(m:ModuleDescriptor)=>Math.acos(m.position[1]/Math.hypot(m.position[0],m.position[1]));
    const rMean=section.reduce((n,m)=>n+Math.hypot(m.position[0],m.position[1]),0)/section.length;
    const tube=(group:THREE.Group,points:THREE.Vector3[],radius:number,material:THREE.Material,segments=48)=>group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),segments,radius,5,false),material));
    const box=(group:THREE.Group,size:number[],position:THREE.Vector3,rotation:number,mat:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size as [number,number,number]),mat);mesh.position.copy(position);mesh.rotation.z=rotation;group.add(mesh);};
    // Slotted semicircular end flange; back ring and short pillars join the ladder ends.
    const flange=new THREE.Shape();
    for(let i=0;i<=64;i++){const p=point(rMean+mm(8),Math.PI*i/64,0);i?flange.lineTo(p.x,p.y):flange.moveTo(p.x,p.y);}
    for(let i=64;i>=0;i--){const p=point(Math.max(mm(25),rMean-mm(8)),Math.PI*i/64,0);flange.lineTo(p.x,p.y);}flange.closePath();
    ladders.forEach(ms=>{const a=angle(ms[0]),da=Math.min(.055,ms[0].size[0]/rMean*.18),hole=new THREE.Path();
      [[rMean-mm(2),a-da],[rMean+mm(3),a-da],[rMean+mm(3),a+da],[rMean-mm(2),a+da]].forEach(([r,t],i)=>{const p=point(r,t,0);i?hole.lineTo(p.x,p.y):hole.moveTo(p.x,p.y);});hole.closePath();flange.holes.push(hole);
    });
    const flangeMesh=new THREE.Mesh(new THREE.ExtrudeGeometry(flange,{depth:mm(1.4),bevelEnabled:false}),carbon);flangeMesh.position.z=side*front;flangeMesh.scale.z=side;structure.add(flangeMesh);
    const ringPoints=Array.from({length:49},(_,i)=>point(rMean,Math.PI*i/48,back));tube(structure,ringPoints,mm(1),carbon);
    ladders.forEach(ms=>{
      const m=ms[0],r=Math.hypot(m.position[0],m.position[1]),theta=Math.atan2(m.position[1],m.position[0]);
      const facing=Math.cos(m.rotationZ-(theta-Math.PI/2));
      const local=(x:number,radial:number,z:number)=>new THREE.Vector3((r+radial)*Math.cos(theta)-x*Math.sin(theta),(r+radial)*Math.sin(theta)+x*Math.cos(theta),side*z);
      const sheetShape=new THREE.Shape(),w=m.size[0]*.45;
      sheetShape.moveTo(-w,back);sheetShape.lineTo(w,back);sheetShape.lineTo(w,front);sheetShape.lineTo(-w,front);sheetShape.closePath();
      ms.forEach(module=>{
        const z=side*module.position[2],lo=Math.max(back+mm(2),z-module.size[2]*.28),hi=Math.min(front-mm(2),z+module.size[2]*.28);
        const hole=new THREE.Path();hole.moveTo(-w*.5,lo);hole.lineTo(-w*.5,hi);hole.lineTo(w*.5,hi);hole.lineTo(w*.5,lo);hole.closePath();sheetShape.holes.push(hole);
        for(const x of [-1,1]){
          const bushing=new THREE.Mesh(new THREE.CylinderGeometry(mm(.45),mm(.45),mm(1),8),steel);
          bushing.position.copy(local(x*w*.9,-facing*mm(1),z));bushing.rotation.z=theta-Math.PI/2;structure.add(bushing);
        }
      });
      const sheet=new THREE.Mesh(new THREE.ExtrudeGeometry(sheetShape,{depth:mm(.5),bevelEnabled:false}),carbon);
      sheet.position.copy(local(0,-facing*mm(1.7),0));
      sheet.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(-Math.sin(theta),Math.cos(theta),0),new THREE.Vector3(0,0,side),new THREE.Vector3(side*Math.cos(theta),side*Math.sin(theta),0)));
      structure.add(sheet);
      for(const x of [-1,1]){
        box(structure,[mm(2.5),mm(1.8),front-back],local(x*m.size[0]*.28,-facing*mm(2.6),(front+back)/2),m.rotationZ,foam);
        box(structure,[mm(2),mm(8),mm(3)],local(x*m.size[0]*.3,0,back+mm(2)),m.rotationZ,carbon);
      }
      box(wiring,[mm(10),mm(8),mm(1)],point(r,angle(m),front+mm(3)),m.rotationZ,pcb);
      for(const x of [-1,1]){box(wiring,[mm(3),mm(4),mm(1.2)],point(r+x*mm(3),angle(m),front+mm(4)),m.rotationZ,copper);}
    });
    // 1,2,3,4 independent serpentine loops per layer/quarter. Barrel OD 1.8 mm.
    for(let loop=0;loop<layer;loop++){
      const members=ladders.slice(Math.floor(loop*ladders.length/layer),Math.floor((loop+1)*ladders.length/layer));
      const path:THREE.Vector3[]=[];
      members.forEach((ms,i)=>{const m=ms[0],a=angle(m),r=Math.hypot(m.position[0],m.position[1]),theta=Math.atan2(m.position[1],m.position[0]),facing=Math.cos(m.rotationZ-(theta-Math.PI/2));const rr=r-facing*mm(2.7),da=m.size[0]*.28/rr;
        if(i===0){path.push(point(mm(177),a,front+mm(17)));}
        path.push(point(rr,a-da,front),point(rr,a-da,back+mm(4)),point(rr,a,back),point(rr,a+da,back+mm(4)),point(rr,a+da,front));
        if(i===members.length-1){path.push(point(mm(177),a+.025,front+mm(17)));}
      });
      for(const endpoint of [path[0],path[path.length-1]]){
        const a=Math.atan2(endpoint.y,endpoint.x),terminal=new THREE.Vector3(mm(198)*Math.cos(a),mm(198)*Math.sin(a),side*mm(270));
        tube(wiring,[endpoint,endpoint.clone().add(new THREE.Vector3(0,0,side*mm(8))),terminal],mm(.9),coolingCopper,24);
        for(const p of [endpoint,terminal]){
          const coupling=new THREE.Mesh(new THREE.CylinderGeometry(mm(1.6),mm(1.6),mm(4),8),coolingCopper);
          coupling.rotation.x=Math.PI/2;coupling.position.copy(p);wiring.add(coupling);
        }
      }
      tube(wiring,path,mm(.9),coolingCopper,members.length*64);wiring.userData.coolingLoops=(wiring.userData.coolingLoops??0)+1;
    }
    // Power/HV routes follow the two service flange openings.
    for(const a of [.62,Math.PI-.62])for(const [i,material] of [power,bias] .entries()){
      tube(wiring,[point(rMean,a,front+mm(5)),point(mm(175),a,front+mm(12)),point(mm(180+i*2),a,mm(230)),point(mm(198+i),a,mm(265))],mm(i?.37:.78),material);
    }
    batch(structure);batch(wiring);
    mechanics.push({mesh:structure,visibilityKey,sectionKey});services.push({mesh:wiring,visibilityKey,sectionKey});
  }
  return {mechanics,services};
}
