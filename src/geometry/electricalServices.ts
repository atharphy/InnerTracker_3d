import {moduleDee} from './visibility';
import {SampledCable} from './cableCurve';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {ModuleDescriptor} from '../types';
import {Route} from './connectionRoutes';
import {mm} from './config';
import {moduleSocket,moduleNormal,moduleCableExit} from './connectionAnchors';

export interface ElectricalPart {dee?:number;mesh:THREE.Group;visibilityKey:string;sectionKey:string}

export function electricalServices(routes:Route[]):ElectricalPart[]{
 // Amber polyimide and fine parallel copper traces, following the supplied bench photos.
 const pixels=new Uint8Array(256*4);
 for(let x=0;x<256;x++){
   const trace=x%16<3,edge=x<5||x>250;
   const rgb=edge?[91,39,12]:trace?[229,153,49]:[153,65,13];
   pixels.set([...rgb,255],x*4);
 }
 const texture=new THREE.DataTexture(pixels,256,1);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;
 const kapton=new THREE.MeshPhysicalMaterial({map:texture,roughness:.32,metalness:.28,clearcoat:.75,clearcoatRoughness:.22});
 const power=kapton;
 const socket=new THREE.MeshStandardMaterial({color:0xe8debf,roughness:.65});
 const groups=new Map<string,{parts:Map<THREE.Material,THREE.BufferGeometry[]>;first:ModuleDescriptor}>();
 for(const route of routes){
   const m=route.module,key=m.visibilityKey+'|'+m.sectionKey+'|'+moduleDee(m);
   if(!groups.has(key)){groups.set(key,{parts:new Map(),first:m});}
   const add=(g:THREE.BufferGeometry,mat:THREE.Material)=>{const gs=groups.get(key)!.parts;gs.set(mat,[...(gs.get(mat)??[]),g]);};
   const points=route.points;
   const normal=moduleNormal(m);
   // Flat flexes have connector-sized width and remain on the existing service corridors.
   add(ribbonGeometry(points,mm(3),mm(.12),normal),kapton);
   // Seated paddle: shares its tip with the first/last point of the conductors.
   const paddle=new THREE.BoxGeometry(mm(3),mm(1.5),mm(.32));
   const rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
   paddle.applyMatrix4(new THREE.Matrix4().compose(points[0].clone().addScaledVector(normal,mm(.2)),rotation,new THREE.Vector3(1,1,1)));add(paddle,kapton);
   const endPaddle=new THREE.BoxGeometry(mm(3),mm(1.2),mm(.25));
   endPaddle.applyQuaternion(new THREE.Quaternion().setFromRotationMatrix(route.slot.matrix));
   endPaddle.translate(points[points.length-1].x,points[points.length-1].y,points[points.length-1].z);add(endPaddle,kapton);
   // Separate HDI power connection, terminating on the local power distribution.
   const powerStart=moduleSocket(m,'power');
   const powerExit=moduleCableExit(m,'power'),r=Math.hypot(m.position[0],m.position[1]);
   const end=m.subdetector==='TBPX'
     ?new THREE.Vector3(m.position[0],m.position[1],Math.sign(m.position[2])*mm(210))
     :new THREE.Vector3(m.position[0]*(r+mm(1))/r,m.position[1]*(r+mm(1))/r,(m.supportZ??m.position[2])+normal.z*mm(m.subdetector==='TFPX'?2.12:1.28));
   const powerPoints=[powerStart,powerStart.clone().addScaledVector(normal,mm(1.2)),...(m.subdetector==='TBPX'?[powerExit,new THREE.Vector3(powerExit.x,powerExit.y,end.z)]:[]),end.clone().addScaledVector(normal,mm(1.2)),end];
   add(ribbonGeometry(powerPoints,mm(5),mm(.15),normal),power);
   for(const point of [powerStart,end]){
     const body=new THREE.BoxGeometry(mm(5.4),mm(1.7),mm(.8));body.applyQuaternion(rotation);body.translate(point.x,point.y,point.z);add(body,socket);
   }
 }
 return [...groups.values()].map(({parts,first})=>{
   const mesh=new THREE.Group();mesh.name=first.visibilityKey+' '+first.sectionKey+' module connections';
   parts.forEach((geometries,mat)=>{
     const normalized=geometries.map(g=>{const n=g.index?g.toNonIndexed():g;return n;});
     const merged=mergeGeometries(normalized);
     if(merged){mesh.add(new THREE.Mesh(merged,mat));}
     normalized.forEach(g=>g.dispose());geometries.forEach(g=>g.dispose());
   });
   return {mesh,visibilityKey:first.visibilityKey,sectionKey:first.sectionKey,dee:moduleDee(first)};
 });
}
// Rectangular ribbon cross section with a smooth centreline, not a round pipe.
export function ribbonGeometry(points:THREE.Vector3[],width:number,thickness:number,surfaceNormal=new THREE.Vector3(0,0,1)):THREE.BufferGeometry{
 const curve=new SampledCable(points),steps=curve.points.length-1,frames=curve.computeFrenetFrames(steps,false),positions:number[]=[],uvs:number[]=[],indices:number[]=[];
 let previousAcross:THREE.Vector3|undefined;
 for(let i=0;i<=steps;i++){
   const p=curve.getPointAt(i/steps),tangent=curve.getTangentAt(i/steps);
   const across=new THREE.Vector3().crossVectors(surfaceNormal,tangent);
   if(across.lengthSq()<1e-6){across.copy(frames.normals[i]);}else{across.normalize();}
   if(previousAcross&&across.dot(previousAcross)<0){across.negate();}
   previousAcross=across.clone();
   const normal=new THREE.Vector3().crossVectors(tangent,across).normalize();
   for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
     const v=p.clone().addScaledVector(across,x*width/2).addScaledVector(normal,y*thickness/2);positions.push(v.x,v.y,v.z);uvs.push((x+1)/2,i/steps);
   }
   if(i<steps)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4;indices.push(a,b,a+4,b,b+4,a+4);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function disposeElectrical(parts:ElectricalPart[]):void{
 const mats=new Set<THREE.Material>();
 parts.forEach(({mesh})=>{mesh.removeFromParent();mesh.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();mats.add(o.material as THREE.Material);}});});
 const textures=new Set<THREE.Texture>();
 mats.forEach(m=>{const map=(m as THREE.MeshStandardMaterial).map;if(map){textures.add(map);}m.dispose();});
 textures.forEach(t=>t.dispose());
}
