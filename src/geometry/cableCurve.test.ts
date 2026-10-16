import * as THREE from 'three';
import {cableCurve} from './cableCurve';
import {connectionRoutes} from './connectionRoutes';
import {buildDetectorGeometry} from './buildGeometry';
import {DEFAULT_GEOMETRY,mm} from './config';
it('rounds a sharp corner without overshooting the route or losing socket endpoints',()=>{
 const points=[new THREE.Vector3(0,0,0),new THREE.Vector3(1,0,0),new THREE.Vector3(1,.1,0),new THREE.Vector3(1,.1,2)];
 const curve=cableCurve(points,.03);
 expect(curve.getPoint(0).distanceTo(points[0])).toBeLessThan(1e-12);
 expect(curve.getPoint(1).distanceTo(points[3])).toBeLessThan(1e-12);
 for(const p of curve.getPoints(1000)){
  expect(p.x).toBeGreaterThanOrEqual(0);expect(p.x).toBeLessThanOrEqual(1+1e-12);
  expect(p.y).toBeGreaterThanOrEqual(0);expect(p.y).toBeLessThanOrEqual(.1+1e-12);
  expect(p.z).toBeGreaterThanOrEqual(0);expect(p.z).toBeLessThanOrEqual(2);
 }
});
it('enters every portcard along its socket normal, after clearing the PCB edge',()=>{
 const routes=connectionRoutes(buildDetectorGeometry(DEFAULT_GEOMETRY),[],new Set(),false,false);
 for(const route of routes){
  const points=route.points,end=points[points.length-1],approach=points[points.length-2];
  const normal=new THREE.Vector3(0,0,1).transformDirection(route.slot.matrix);
  expect(approach.clone().sub(end).normalize().dot(normal)).toBeCloseTo(1,9);
  const edge=points[points.length-3].clone().applyMatrix4(route.slot.matrix.clone().invert());
  expect(Math.abs(edge.x)).toBeGreaterThan(mm(21));
 }
});
