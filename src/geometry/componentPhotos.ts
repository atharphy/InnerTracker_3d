import * as THREE from 'three';
import { antlerHardware } from './antlerHardware';
import l1 from '../img/components/tbpx-l1-ai.png';
import l2 from '../img/components/tbpx-l2-ai.png';
import bq from '../img/components/tbpx-quad-ai.png';
import fd from '../img/components/tfpx-double-ai.png';
import fq from '../img/components/tfpx-quad-ai.png';
import eq from '../img/components/tepx-ai.png';
import pf from '../img/components/portcard-tbpx-tfpx-front.png';
import pb from '../img/components/portcard-tbpx-tfpx-back.png';
import ef from '../img/components/portcard-tepx-ai.png';
import eb from '../img/components/portcard-tepx-back.png';
import { portcardSlots, portcardSocketLocal } from './connectionAnchors';
import { mm } from './config';
export const COMPONENT_PHOTOS = { 'tbpx-l1': l1, 'tbpx-l2': l2, 'tbpx-quad': bq, 'tfpx-double': fd, 'tfpx-quad': fq, tepx: eq };
export function photoMaterial(url: string): THREE.MeshBasicMaterial {
  const map = new THREE.TextureLoader().load(url);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return new THREE.MeshBasicMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide, toneMapped: false });
}
export function serviceHardware(): { portcards: THREE.Group; antlers: THREE.Group; rails: THREE.Group } {
  const portcards = new THREE.Group(), antlers = antlerHardware(), rails = new THREE.Group();
  const faces = { 'tbpx-tfpx': [photoMaterial(pf), photoMaterial(pb)], tepx: [photoMaterial(ef), photoMaterial(eb)] };
  const metal = new THREE.MeshStandardMaterial({ color: 0x40494d, roughness: .85 });
  const trayShape=new THREE.Shape();trayShape.moveTo(mm(-21),mm(-25));trayShape.lineTo(mm(21),mm(-25));trayShape.lineTo(mm(21),mm(25));trayShape.lineTo(mm(-21),mm(25));trayShape.closePath();
  const aperture=new THREE.Path();aperture.moveTo(mm(-16),mm(-20));aperture.lineTo(mm(-16),mm(20));aperture.lineTo(mm(16),mm(20));aperture.lineTo(mm(16),mm(-20));aperture.closePath();trayShape.holes.push(aperture);
  const trayGeometry=new THREE.ExtrudeGeometry(trayShape,{depth:mm(2),bevelEnabled:false});
  const green = new THREE.MeshStandardMaterial({ color: 0x298346, roughness: .65 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xd69720, roughness: .55 });
  const connector=new THREE.MeshStandardMaterial({color:0xc9c2a5,roughness:.65});
  const socketDark=new THREE.MeshStandardMaterial({color:0x25282a,roughness:.7});
  const contact=new THREE.MeshStandardMaterial({color:0xb69c53,roughness:.4,metalness:.6});
  const slots=portcardSlots();
  for(const slot of slots){
    const mount=new THREE.Group();mount.name=slot.id;
    mount.userData={kind:slot.kind,owner:slot.owner,nearHalf:slot.half==='right',slotId:slot.id};
    mount.applyMatrix4(slot.matrix);
    const add=(mesh:THREE.Mesh,component='portcard')=>{mesh.userData={component,slotId:slot.id};mount.add(mesh);};
    const tray=new THREE.Mesh(trayGeometry.clone(),metal);tray.position.z=-mm(4);add(tray,'cartridge');
    const board=new THREE.Mesh(new THREE.BoxGeometry(mm(36),mm(46),mm(1.2)),green);add(board);
    faces[slot.kind].forEach((mat,face)=>{
      const photo=new THREE.Mesh(new THREE.PlaneGeometry(mm(38),mm(48)),mat);
      photo.position.z=mm(face===0?1:-1);if(face){photo.rotation.y=Math.PI;}add(photo);
    });
    // Socket housings and seated polyimide paddle adapters share cable endpoints.
    const banks=slot.kind==='tepx'?[1]:[0,1,2];
    for(const bank of banks){
      const centre=portcardSocketLocal(slot,bank),w=mm(slot.kind==='tepx'?2.2:10),h=mm(slot.kind==='tepx'?26:2),wall=mm(.24);
      const piece=(width:number,height:number,depth:number,x:number,y:number,z:number,material:THREE.Material)=>{
        const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),material);mesh.position.set(centre.x+x,centre.y+y,mm(z));add(mesh);
      };
      piece(w,h,mm(.3),0,0,1.2,socketDark);
      piece(w,wall,mm(.7),0,(h-wall)/2,1.5,connector);
      piece(w,wall,mm(.7),0,-(h-wall)/2,1.5,connector);
      piece(wall,h,mm(.7),(w-wall)/2,0,1.5,connector);
      piece(wall,h,mm(.7),-(w-wall)/2,0,1.5,connector);
      for(let pin=0;pin<10;pin++){
        const t=(pin-4.5)/10;
        piece(mm(.16),mm(.35),mm(.12),slot.kind==='tepx'?0:w*t,slot.kind==='tepx'?h*t:0,1.43,contact);
      }
    }
    portcards.add(mount);
  }
  for(const side of [-1,1])for(const up of [-1,1]){
    const rail=new THREE.Mesh(new THREE.BoxGeometry(mm(70),mm(5),mm(1020)),orange);
    rail.position.set(0,up*mm(258),side*mm(2190));rails.add(rail);
  }
  trayGeometry.dispose();
  // Batch the larger population by subsystem/quarter while retaining component switches.
  const quarters=new Map<string,{group:THREE.Group;parts:Map<string,THREE.Mesh[]>}>();
  for(const mount of portcards.children){
    mount.updateMatrixWorld(true);
    const key=`${mount.userData.owner}:${mount.userData.nearHalf}:${Math.sign(mount.position.z)}`;
    let q=quarters.get(key);
    if(!q){const group=new THREE.Group();group.name=key;group.userData={...mount.userData};q={group,parts:new Map()};quarters.set(key,q);}
    mount.children.forEach(part=>{const mesh=part as THREE.Mesh;const mat=mesh.material as THREE.Material;const key=mat.uuid+JSON.stringify((mesh.geometry as THREE.BoxGeometry).parameters);q!.parts.set(key,[...(q!.parts.get(key)??[]),mesh]);});
  }
  portcards.clear();
  quarters.forEach(({group,parts})=>{parts.forEach((meshes)=>{
    const material=meshes[0].material;
    const instances=new THREE.InstancedMesh(meshes[0].geometry.clone(),material,meshes.length);
    instances.userData={...meshes[0].userData,slotIds:meshes.map(m=>m.userData.slotId)};
    meshes.forEach((mesh,i)=>{instances.setMatrixAt(i,mesh.matrixWorld);mesh.geometry.dispose();});
    group.add(instances);
  });portcards.add(group);});
  return {portcards,antlers,rails};
}
