import * as THREE from 'three';
import {ModuleDescriptor, Subdetector} from '../types';
import {SERVICE_CARTRIDGES, cartridgeCount, modulePhotoKind, PortcardKind} from './componentLayout';
import {mm} from './config';

export interface PortcardSlot {
  id:string; owner:Subdetector; kind:PortcardKind; side:'+z'|'-z'; half:'right'|'left';
  disk?:number; matrix:THREE.Matrix4;
}
// Slot IDs identify model positions; physical board serials are supplied only by YAML.
export function portcardSlots():PortcardSlot[] {
  const slots:PortcardSlot[]=[];
  for(const side of [-1,1]) for(const half of [-1,1]) for(const c of SERVICE_CARTRIDGES){
    const locations=SERVICE_CARTRIDGES.filter(x=>x.owner===c.owner),index=locations.indexOf(c)+1;
    for(let row=0;row<c.rows;row++)for(let col=0;col<c.columns;col++){
      if(row*c.columns+col>=cartridgeCount(c,side)){continue;}
      const theta=Math.PI*(.62+.76*col/Math.max(1,c.columns-1));
      const matrix=new THREE.Matrix4().makeBasis(new THREE.Vector3(Math.sin(theta),-Math.cos(theta),0),new THREE.Vector3(0,0,1),new THREE.Vector3(-Math.cos(theta),-Math.sin(theta),0));
      matrix.setPosition(mm(c.radiusMm)*Math.cos(theta),mm(c.radiusMm)*Math.sin(theta),side*mm(c.zMm));
      matrix.multiply(new THREE.Matrix4().makeTranslation(0,mm((row-(c.rows-1)/2)*52),0));
      if(half===1){matrix.premultiply(new THREE.Matrix4().makeRotationZ(Math.PI));}
      const z=side>0?'+z':'-z',h=half>0?'right':'left';
      slots.push({id:`${c.owner}:${z}:${h}:${c.owner==='TBPX'?'W':'D'}${index}:R${row+1}:C${col+1}`,owner:c.owner,kind:c.kind,side:z,half:h,disk:c.owner==='TBPX'?undefined:index,matrix});
    }
  }
  return slots;
}

export function moduleMatrix(m:ModuleDescriptor):THREE.Matrix4{
  return new THREE.Matrix4().compose(new THREE.Vector3(...m.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,m.rotationZ)),new THREE.Vector3(m.size[0],m.size[1],m.size[2]));
}
// Opaque image bounds (alpha >= 0.5). Fit the PCB, rather than the padded
// bitmap, to its physical envelope. The same transform anchors its connectors.
export const MODULE_IMAGE_BOUNDS:Record<string,[number,number,number,number,number,number]>={
 'tbpx-l1':[2039,771,23,10,2005,756],
 'tbpx-l2':[2052,766,55,20,2014,754],
 'tbpx-quad':[1536,1024,61,76,1476,992],
 'tfpx-double':[2172,724,101,60,2071,696],
 'tfpx-quad':[1536,1024,30,31,1485,1016],
 tepx:[1536,1024,46,39,1476,1008],
};
export function moduleFaceMatrix(m:ModuleDescriptor):THREE.Matrix4{
  const face=m.subdetector==='TBPX'
    ?new THREE.Matrix4().makeTranslation(0,.56,0).multiply(new THREE.Matrix4().makeRotationX(-Math.PI/2))
    :new THREE.Matrix4().makeTranslation(0,0,moduleNormal(m).z*.56)
      .multiply(new THREE.Matrix4().makeRotationX(moduleNormal(m).z<0?Math.PI:0));
  const [w,h,x0,y0,x1,y1]=MODULE_IMAGE_BOUNDS[modulePhotoKind(m)];
  const sx=w/(x1-x0),sy=h/(y1-y0);
  const fit=new THREE.Matrix4().makeTranslation((.5-(x0+x1)/(2*w))*sx,((y0+y1)/(2*h)-.5)*sy,0)
    .multiply(new THREE.Matrix4().makeScale(sx,sy,1));
  return moduleMatrix(m).multiply(face).multiply(new THREE.Matrix4().makeRotationZ(Math.PI/2)).multiply(fit);
}
// Image-relative socket centres, measured on the displayed board assets.
// These are visual anchors, not surveyed connector coordinates or a pinout.
const SOCKETS:Record<string,{elink:[number,number];power:[number,number]}>={
 'tbpx-l1':{elink:[.03,.015],power:[.42,.02]},
 'tbpx-l2':{elink:[.05,0],power:[-.4,0]},
 'tbpx-quad':{elink:[.05,-.03],power:[-.4,-.02]},
 'tfpx-double':{elink:[.06,.04],power:[.42,0]},
 'tfpx-quad':{elink:[.4,0],power:[-.42,0]},
 tepx:{elink:[-.43,.08],power:[-.43,-.15]},
};
export function moduleSocket(m:ModuleDescriptor,kind:'elink'|'power'):THREE.Vector3{
  const [u,v]=SOCKETS[modulePhotoKind(m)][kind];
  return new THREE.Vector3(u,v,0).applyMatrix4(moduleFaceMatrix(m));
}
export function moduleNormal(m:ModuleDescriptor):THREE.Vector3{
  if(m.subdetector==='TBPX'){return new THREE.Vector3(-Math.sin(m.rotationZ),Math.cos(m.rotationZ),0);}
  return new THREE.Vector3(0,0,m.position[2]>=(m.supportZ??m.position[2])?1:-1);
}
export function portcardSocketLocal(slot:PortcardSlot,lpgbt:number):THREE.Vector3{
  // TEPX uses one long board connector: the three positions are logical lane banks.
  return slot.kind==='tepx'?new THREE.Vector3(mm(15),mm(10-lpgbt*9),mm(1.8))
    :new THREE.Vector3(mm(-7),mm([18,10,-10][lpgbt]),mm(1.8));
}
export function portcardSocket(slot:PortcardSlot,lpgbt:number):THREE.Vector3{return portcardSocketLocal(slot,lpgbt).applyMatrix4(slot.matrix);}
export function slotMatchesModule(slot:PortcardSlot,m:ModuleDescriptor):boolean{
  return slot.owner===m.subdetector && slot.side===(m.zSide??m.side) && slot.half===(m.position[0]>=0?'right':'left') && (m.subdetector==='TBPX'||slot.disk===m.disk);
}

// Dress cables along the ladder edge, outside the module footprint.
export function moduleCableExit(m:ModuleDescriptor,kind:'elink'|'power'):THREE.Vector3 {
  const [u]=SOCKETS[modulePhotoKind(m)][kind];
  return new THREE.Vector3(u,kind==='elink'?.54:-.54,0).applyMatrix4(moduleFaceMatrix(m)).addScaledVector(moduleNormal(m),mm(1.2));
}
