import * as THREE from 'three';
import {mm} from './config';

// Round each waypoint locally. Unlike a global spline, this cannot overshoot
// the neighbouring segments and sweep a cable back through the detector.
export function cableCurve(points:THREE.Vector3[],bend=mm(2)):THREE.CurvePath<THREE.Vector3>{
 const clean=points.filter((p,i)=>i===0||p.distanceToSquared(points[i-1])>1e-18);
 const path=new THREE.CurvePath<THREE.Vector3>();
 let previous=clean[0];
 for(let i=1;i<clean.length-1;i++){
  const p=clean[i],before=clean[i-1],after=clean[i+1];
  const distance=Math.min(bend,p.distanceTo(before)*.25,p.distanceTo(after)*.25);
  const entry=p.clone().lerp(before,distance/p.distanceTo(before));
  const exit=p.clone().lerp(after,distance/p.distanceTo(after));
  path.add(new THREE.LineCurve3(previous,entry));
  path.add(new THREE.QuadraticBezierCurve3(entry,p,exit));
  previous=exit;
 }
 if(clean.length>1){path.add(new THREE.LineCurve3(previous,clean[clean.length-1]));}
 return path;
}

export class PairedConductor extends THREE.Curve<THREE.Vector3>{
 constructor(private base:THREE.Curve<THREE.Vector3>,private strand:number){super();}
 getPointAt(t:number,target=new THREE.Vector3()):THREE.Vector3{return this.getPoint(t,target);}
 getTangentAt(t:number,target=new THREE.Vector3()):THREE.Vector3{return this.getTangent(t,target);}
 getPoint(t:number,target=new THREE.Vector3()):THREE.Vector3{
  const p=this.base.getPoint(t),tangent=this.base.getTangent(t);
  const across=new THREE.Vector3().crossVectors(tangent,new THREE.Vector3(0,0,1));
  if(across.lengthSq()<.01){across.set(1,0,0);}across.normalize();
  return target.copy(p).addScaledVector(across,this.strand*mm(.18)*Math.sin(Math.PI*t));
 }
}

// Allocate vertices to bends and connector tails instead of distributing them
// uniformly along metre-long runs (which otherwise erases millimetre-scale bends).
export class SampledCable extends THREE.Curve<THREE.Vector3>{
 readonly points:THREE.Vector3[];
 constructor(points:THREE.Vector3[]){
  super();const path=cableCurve(points);this.points=[];
  path.curves.forEach((segment,index)=>{
   const step=segment instanceof THREE.LineCurve3?mm(8):mm(.3);
   const vertices=segment.getPoints(Math.max(1,Math.ceil(segment.getLength()/step)));
   this.points.push(...(index?vertices.slice(1):vertices));
  });
 }
 getPoint(t:number,target=new THREE.Vector3()):THREE.Vector3{
  const u=Math.max(0,Math.min(1,t))*(this.points.length-1),i=Math.min(this.points.length-2,Math.floor(u));
  return target.copy(this.points[i]).lerp(this.points[i+1],u-i);
 }
 getPointAt(t:number,target=new THREE.Vector3()):THREE.Vector3{return this.getPoint(t,target);}
 getTangentAt(t:number,target=new THREE.Vector3()):THREE.Vector3{return this.getTangent(t,target);}
}
