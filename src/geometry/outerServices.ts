import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mm } from './config';
import { SERVICE_LANES, serviceRadius, ANTLER_Z } from './serviceRouting';

/** Visual reconstruction of the service-cylinder exterior in Bardelli, page 5. */
export function outerServices(): THREE.Group {
  const root=new THREE.Group();root.name='Exterior service harnesses';
  const blue=new THREE.MeshStandardMaterial({color:0x1278b8,roughness:.72});
  const green=new THREE.MeshStandardMaterial({color:0x208d45,roughness:.72});
  const purple=new THREE.MeshStandardMaterial({color:0x8529b8,roughness:.7});
  const black=new THREE.MeshStandardMaterial({color:0x272c30,roughness:.8});
  const copper=new THREE.MeshStandardMaterial({color:0xa3744a,roughness:.6});
  const metal=new THREE.MeshStandardMaterial({color:0x9aa5ad,roughness:.55});
  for(const side of [-1,1]) for(const half of [-1,1]) {
    const group=new THREE.Group();group.userData.nearHalf=half===1;group.name=`Exterior Z${side>0?'+':'−'} ${half>0?'near':'far'} half`;
    const point=(z:number,r:number,a:number)=>new THREE.Vector3(half*mm(r)*Math.sin(a),mm(r)*Math.cos(a),side*mm(z));
    const tube=(points:THREE.Vector3[],r:number,material:THREE.Material,segments=36)=>group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),segments,mm(r),5,false),material));
    // Packed axial cable lanes follow the stepped forward/adapter/endcap shell.
    for(const lane of SERVICE_LANES) {
      const mat=lane.family==='TFPX'?blue:lane.family==='TBPX'?green:purple;
      const zs=[lane.startZ,650,1380,1450,1510,1605,1660,2290,ANTLER_Z].filter(z=>z>=lane.startZ);
      const points=zs.map(z=>point(z,serviceRadius(z,lane.family),lane.angle));
      tube(points,lane.family==='TEPX'?1.8:2.7,mat);
    }
    // Broad transverse PP-2 routing on the forward section.
    for(let route=0;route<15;route++) {
      const z=300+route*19;
      const points=Array.from({length:25},(_,i)=>point(z,207,.04+(Math.PI-.08)*i/24));
      tube(points,3,purple,32);
    }
    // Retaining straps, discrete saddles and bolt heads, including adapter collars.
    for(const z of [235,410,665,880,1120,1375,1470,1650,1900,2180,2440,2700]) {
      const r=z<1450?212:z<1600?214:290;
      const points=Array.from({length:33},(_,i)=>point(z,r,.015+(Math.PI-.03)*i/32));
      tube(points,3.5,black,40);
      for(let j=0;j<7;j++) {
        const a=.05+(Math.PI-.1)*j/6;
        const saddle=new THREE.Mesh(new THREE.BoxGeometry(mm(13),mm(8),mm(12)),copper);
        saddle.position.copy(point(z,r+2,a));saddle.rotation.z=-half*a;group.add(saddle);
        const bolt=new THREE.Mesh(new THREE.SphereGeometry(mm(2.2),6,4),metal);bolt.position.copy(point(z,r+7,a));group.add(bolt);
      }
    }
    // PP-2 junction blocks at the edges of the service quarter.
    for(const a of [.035,Math.PI-.035]) for(let j=0;j<12;j++) {
      const block=new THREE.Mesh(new THREE.BoxGeometry(mm(14),mm(14),mm(21)),black);
      block.position.copy(point(300+j*25,216,a));group.add(block);
      for(let pin=0;pin<4;pin++) {
        const contact=new THREE.Mesh(new THREE.BoxGeometry(mm(1.3),mm(4),mm(8)),metal);
        contact.position.set(mm((pin-1.5)*2.5),mm(8),0);block.add(contact);
      }
    }
    // Batch each half independently so cutaway remains available without losing exterior detail.
    group.updateMatrixWorld(true);
    const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
    group.traverse(o=>{if(o instanceof THREE.Mesh && !Array.isArray(o.material)) {
      const g=o.geometry.clone().applyMatrix4(o.matrixWorld);batches.set(o.material,[...(batches.get(o.material)??[]),g]);o.geometry.dispose();
    }});
    group.clear();batches.forEach((geometries,material)=>{const merged=mergeGeometries(geometries);if(merged){group.add(new THREE.Mesh(merged,material));}geometries.forEach(g=>g.dispose());});root.add(group);
  }
  return root;
}
