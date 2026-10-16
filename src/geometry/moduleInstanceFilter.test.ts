import * as THREE from 'three';
import {captureModuleInstances,filterModuleInstances} from './moduleInstanceFilter';
it('filters module instances without shifting chip indices, and restores the original matrices',()=>{
 const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial(),3);
 [1,2,3].forEach((x,i)=>mesh.setMatrixAt(i,new THREE.Matrix4().makeTranslation(x,0,0)));
 const batch=captureModuleInstances(mesh,['A','B','A']),m=new THREE.Matrix4();
 filterModuleInstances(batch,new Set(['A']),true);
 mesh.getMatrixAt(1,m);expect(m.determinant()).toBe(0);expect(mesh.userData.visibleInstanceCount).toBe(2);
 mesh.getMatrixAt(2,m);expect(m.elements[12]).toBe(3);
 filterModuleInstances(batch,new Set(),true);expect(mesh.userData.visibleInstanceCount).toBe(0);
 filterModuleInstances(batch,new Set(),false);mesh.getMatrixAt(1,m);expect(m.elements[12]).toBe(2);expect(mesh.userData.visibleInstanceCount).toBe(3);
 mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();
});

import {defaultVisibility} from '../components/VisibilityTree';
import {partVisible,sectionKeys,setElementParts} from './visibility';
it.each(['TBPX','TFPX','TEPX'] as const)('combines installed filtering with independent %s regions',subdetector=>{
 const sections=sectionKeys(subdetector);
 let visibility=defaultVisibility();
 const batches=sections.map((section,index)=>{
  const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial(),2);
  mesh.setMatrixAt(0,new THREE.Matrix4().makeTranslation(index+1,1,1));
  mesh.setMatrixAt(1,new THREE.Matrix4().makeTranslation(index+1,2,1));
  const batch=captureModuleInstances(mesh,[section,'not-installed']);
  filterModuleInstances(batch,new Set(sections),true);
  return batch;
 });
 visibility=setElementParts(visibility,subdetector,0,[false,true,false,false]);
 batches.forEach((batch,index)=>{
  batch.mesh.visible=partVisible(visibility,subdetector+':1',sections[index]);
  expect(batch.mesh.visible).toBe(index===1);
  expect(batch.mesh.userData.visibleInstanceCount).toBe(1);
  expect(partVisible(visibility,subdetector+':2',sections[index])).toBe(true);
  const matrix=new THREE.Matrix4();batch.mesh.getMatrixAt(1,matrix);expect(matrix.determinant()).toBe(0);
  batch.mesh.geometry.dispose();(batch.mesh.material as THREE.Material).dispose();
 });
});
