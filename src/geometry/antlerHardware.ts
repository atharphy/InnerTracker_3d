import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ANTLER_Z, SERVICE_LANES, serviceRadius } from './serviceRouting';
import { mm } from './config';

// Mechanical/material references: Antler Updates 2026-02-03, pages 3–15.
export function antlerHardware():THREE.Group {
  const root=new THREE.Group();
  const aluminum=new THREE.MeshStandardMaterial({color:0xb3b7ba,metalness:.7,roughness:.48});
  const stainless=new THREE.MeshStandardMaterial({color:0x999fa4,metalness:.8,roughness:.3});
  const titanium=new THREE.MeshStandardMaterial({color:0x737f88,metalness:.65,roughness:.48});
  const peek=new THREE.MeshStandardMaterial({color:0xd5ccb0,roughness:.85});
  const pcb=new THREE.MeshStandardMaterial({color:0x24633a,roughness:.8});
  const black=new THREE.MeshStandardMaterial({color:0x23282b,roughness:.8});
  const blue=new THREE.MeshStandardMaterial({color:0x226c9c,roughness:.8});
  const green=new THREE.MeshStandardMaterial({color:0x376e3c,roughness:.8});
  const fiber=new THREE.MeshStandardMaterial({color:0xb59954,roughness:.8});
  for(const side of [-1,1]) for(const half of [-1,1]) {
    const group=new THREE.Group();group.userData.nearHalf=half===1;
    const p=(z:number,r:number,a:number)=>new THREE.Vector3(half*mm(r)*Math.sin(a),mm(r)*Math.cos(a),side*mm(z));
    const tube=(points:THREE.Vector3[],r:number,mat:THREE.Material,steps=24)=>group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),steps,mm(r),6,false),mat));
    const plateShape=new THREE.Shape();
    const xy=(r:number,a:number)=>new THREE.Vector2(half*mm(r)*Math.sin(a),mm(r)*Math.cos(a));
    for(let i=0;i<=8;i++){const v=xy(407,.055+(Math.PI-.11)*i/8);if(i===0){plateShape.moveTo(v.x,v.y);}else{plateShape.lineTo(v.x,v.y);}}
    for(let i=40;i>=0;i--){const v=xy(279,.055+(Math.PI-.11)*i/40);plateShape.lineTo(v.x,v.y);}plateShape.closePath();
    // Open triangular lattice follows the machined aluminum base-plate photographs.
    for(let row=0;row<5;row++) for(let col=0;col<38;col++) {
      const r=292+row*18,a=.085+col*(Math.PI-.17)/38;
      for(const reverse of [false,true]) {
        const corners=reverse?[[r+15,a+.005],[r+15,a+.062],[r+2,a+.062]]:[[r,a+.005],[r+13,a+.005],[r,a+.059]];
        const hole=new THREE.Path();corners.forEach(([radius,angle],i)=>{const v=xy(radius,angle);if(i===0){hole.moveTo(v.x,v.y);}else{hole.lineTo(v.x,v.y);}});hole.closePath();plateShape.holes.push(hole);
      }
    }
    const plate=new THREE.Mesh(new THREE.ExtrudeGeometry(plateShape,{depth:mm(4),bevelEnabled:false,curveSegments:40}),aluminum);
    plate.scale.z=side; plate.position.z=side*mm(2754);group.add(plate);
    // Inner fiber channel and outer power/HV strain relief rails.
    for(const r of [284,401]) {
      tube(Array.from({length:41},(_,i)=>p(2752,r,.055+(Math.PI-.11)*i/40)),3.5,aluminum,48);
    }
    const lanes=SERVICE_LANES.filter(l=>l.family!=='TEPX');
    lanes.forEach((lane,i)=>{
      const a=lane.antlerAngle,mat=lane.family==='TBPX'?green:blue;
      // Exactly the same starting point as the end of the exterior lane.
      tube([p(ANTLER_Z,serviceRadius(ANTLER_Z,lane.family),lane.angle),p(2740,296,a),p(2745,315,a)],2.7,mat);
      const board=new THREE.Mesh(new THREE.BoxGeometry(mm(10),mm(62),mm(1.3)),pcb);
      board.position.copy(p(2744,349,a));board.rotation.z=Math.atan2(board.position.y,board.position.x)-Math.PI/2;group.add(board);
      for(const r of [319,379]) {
        const connector=new THREE.Mesh(new THREE.BoxGeometry(mm(9),mm(7),mm(5)),peek);
        connector.position.copy(p(2740,r,a));connector.rotation.z=board.rotation.z;group.add(connector);
      }
      const bracket=new THREE.Mesh(new THREE.BoxGeometry(mm(12),mm(12),mm(7)),peek);bracket.position.copy(p(2750,340,a));group.add(bracket);
      for(const r of [300,393]) {const screw=new THREE.Mesh(new THREE.CylinderGeometry(mm(1.6),mm(1.6),mm(5),6),stainless);screw.rotation.x=Math.PI/2;screw.position.copy(p(2750,r,a));group.add(screw);}
      // Short jumper to tin-plated aluminum grounding region, as on slide 9.
      tube([p(2741,344,a),p(2735,347,a+.008),p(2750,351,a+.015)],.35,stainless,8);
      // Thicker external truck cable emerging from the strain relief.
      const endZ=lane.family==='TFPX'?3000:2950,endR=lane.family==='TFPX'?435:420;
      tube([p(2744,379,a),p(2770,397,a),p(2840,407,a),p(endZ,endR,a)],3.5,mat);
      const housing=new THREE.Mesh(new THREE.BoxGeometry(mm(10),mm(13),mm(23)),black);housing.position.copy(p(endZ+8,endR+2,a));housing.lookAt(p(endZ+45,endR+10,a));group.add(housing);
      const contact=new THREE.Mesh(new THREE.BoxGeometry(mm(7),mm(8),mm(2)),stainless);contact.position.z=mm(12);housing.add(contact);
      if(i%2===0){tube([p(ANTLER_Z,287,a),p(2740,286,a),p(2743,291,a+.04)],.7,fiber,12);}
    });
    // CO2 outer face: distribution manifolds, SS capillary coils, Ti supply and 8-mm return.
    for(const center of [.65,2.35]) {
      tube(Array.from({length:17},(_,i)=>p(2780,390,center-.42+i*.84/16)),4,stainless,24);
      for(let line=0;line<13;line++) {
        const a=center-.4+line*.8/12;
        const coil:THREE.Vector3[]=[];
        for(let j=0;j<=64;j++){const t=j/64,turn=t*Math.PI*6;coil.push(p(2784+8*Math.sin(turn),374-40*t+8*Math.cos(turn),a));}
        tube([p(2780,390,a),...coil,p(2780,320,a)],.65,stainless,88);
        const fitting=new THREE.Mesh(new THREE.CylinderGeometry(mm(3.5),mm(3.5),mm(9),6),stainless);fitting.rotation.x=Math.PI/2;fitting.position.copy(p(2780,320,a));group.add(fitting);
        tube([p(2780,320,a),p(2740,300,a),p(2680,286,a)],.9,titanium);
      }
      tube([p(2680,292,center),p(2740,310,center),p(2810,407,center),p(2870,411,center)],4,stainless);
      const fitting=new THREE.Mesh(new THREE.CylinderGeometry(mm(7),mm(7),mm(20),6),stainless);fitting.rotation.x=Math.PI/2;fitting.position.copy(p(2880,411,center));group.add(fitting);
    }
    for(const a of [.055,Math.PI/2,Math.PI-.055]) {
      const mount=new THREE.Mesh(new THREE.BoxGeometry(mm(18),mm(42),mm(23)),aluminum);mount.position.copy(p(2763,289,a));mount.rotation.z=Math.atan2(mount.position.y,mount.position.x)-Math.PI/2;group.add(mount);
    }
    // Separate lightweight TEPX service runs: do not route them through TBPX/TFPX filter cards.
    SERVICE_LANES.filter(l=>l.family==='TEPX').forEach(l=>tube([p(ANTLER_Z,serviceRadius(ANTLER_Z,l.family),l.angle),p(2780,295,l.angle),p(2870,320,l.angle)],1.8,green));
    group.updateMatrixWorld(true);const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
    group.traverse(o=>{if(o instanceof THREE.Mesh&&!Array.isArray(o.material)){const copy=o.geometry.clone();const g=(copy.index ? copy.toNonIndexed() : copy).applyMatrix4(o.matrixWorld);if(g!==copy){copy.dispose();}batches.set(o.material,[...(batches.get(o.material)??[]),g]);o.geometry.dispose();}});
    group.clear();batches.forEach((gs,mat)=>{const merged=mergeGeometries(gs);if(merged){group.add(new THREE.Mesh(merged,mat));}gs.forEach(g=>g.dispose());});root.add(group);
  }
  return root;
}
