import {portcardSlots,portcardSocket,moduleSocket,slotMatchesModule} from './connectionAnchors';
import {connectionRoutes} from './connectionRoutes';
import {buildDetectorGeometry} from './buildGeometry';
import {DEFAULT_GEOMETRY} from './config';
import {buildPortcardInventory} from '../data/portcards';
import {DEFAULT_OPTIONS} from '../defaults';
const modules=buildDetectorGeometry(DEFAULT_GEOMETRY);
it('keeps unique stable mounting slots on both halves and ends',()=>{
 const slots=portcardSlots();
 expect(new Set(slots.map(s=>s.id)).size).toBe(slots.length);
 for(const owner of ['TBPX','TFPX','TEPX'])for(const side of ['+z','-z']){
  expect(slots.filter(s=>s.owner===owner&&s.side===side&&s.half==='right').length).toBe(slots.filter(s=>s.owner===owner&&s.side===side&&s.half==='left').length);
 }
});
it('anchors every routing demonstration at the actual shared sockets',()=>{
 const routes=connectionRoutes(modules,[],new Set(),false,false);
 expect(routes).toHaveLength(modules.length);
 for(const r of routes){
  expect(r.points[0].distanceTo(moduleSocket(r.module,'elink'))).toBeLessThan(1e-9);
  expect(r.points[r.points.length-1].distanceTo(portcardSocket(r.slot,r.lpgbt))).toBeLessThan(1e-9);
  expect(slotMatchesModule(r.slot,r.module)).toBe(true);
  expect(r.explicit).toBe(false);
  expect(r.points.every(p=>p.toArray().every(Number.isFinite))).toBe(true);
 }
});
it('connected-only uses explicit lpGBT assignments and intersects the installed filter',()=>{
 const cards=buildPortcardInventory(JSON.stringify({PC:{slot:'TBPX:+z:right:W1:R1:C1',connections:[{module:'DEMO-TBPX-QUAD',lpgbt:2}]}}),DEFAULT_OPTIONS.hardwareMappingJson,modules).entries;
 const id=cards[0].connections[0].module.id;
 const routes=connectionRoutes(modules,cards,new Set([id]),true,true);
 expect(routes).toHaveLength(1);expect(routes[0].lpgbt).toBe(2);expect(routes[0].explicit).toBe(true);
 expect(connectionRoutes(modules,[],new Set([id]),false,true)).toHaveLength(0);
 expect(connectionRoutes(modules,cards,new Set(),true,true)).toHaveLength(0);

});

import * as THREE from 'three';
import {moduleFaceMatrix,moduleNormal} from './connectionAnchors';
it('faces each module image away from its support, including the negative-facing disk surfaces',()=>{
 for(const m of modules){
  const matrix=moduleFaceMatrix(m),normal=new THREE.Vector3(0,0,1).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(matrix)).normalize();
  expect(normal.dot(moduleNormal(m))).toBeCloseTo(1,10);
  const front=new THREE.Vector3(0,0,0).applyMatrix4(matrix);
  expect(front.sub(new THREE.Vector3(...m.position)).dot(moduleNormal(m))).toBeGreaterThan(0);
 }
});


import {MODULE_IMAGE_BOUNDS,moduleMatrix} from './connectionAnchors';
import {modulePhotoKind} from './componentLayout';
it('fits the visible module bounds to the physical face without padding or inset gaps',()=>{
 for(const m of modules){
  const [w,h,x0,y0,x1,y1]=MODULE_IMAGE_BOUNDS[modulePhotoKind(m)];
  const matrix=moduleMatrix(m).invert().multiply(moduleFaceMatrix(m));
  const corners=[];
  for(const x of [x0/w-.5,x1/w-.5])for(const y of [.5-y0/h,.5-y1/h]){
   corners.push(new THREE.Vector3(x,y,0).applyMatrix4(matrix));
  }
  const box=new THREE.Box3().setFromPoints(corners),size=box.getSize(new THREE.Vector3());
  expect(size.x).toBeCloseTo(1,10);
  expect(m.subdetector==='TBPX'?size.z:size.y).toBeCloseTo(1,10);
 }
});
