import * as THREE from 'three';

export interface ModuleInstances {
  mesh: THREE.InstancedMesh;
  ids: string[];
  matrices: THREE.Matrix4[];
}
export function captureModuleInstances(mesh: THREE.InstancedMesh, ids: string[]): ModuleInstances {
  const matrices=ids.map((_,i)=>{const m=new THREE.Matrix4();mesh.getMatrixAt(i,m);return m;});
  return {mesh,ids,matrices};
}
// Preserve instance indices used by chip measurements and picking.
export function filterModuleInstances(batch: ModuleInstances, installed: Set<string>, onlyInstalled: boolean): void {
  const hidden=new THREE.Matrix4().makeScale(0,0,0);
  let shown=0;
  batch.ids.forEach((id,i)=>{const on=!onlyInstalled || installed.has(id);batch.mesh.setMatrixAt(i,on?batch.matrices[i]:hidden);if(on){shown++;}});
  batch.mesh.instanceMatrix.needsUpdate=true;
  batch.mesh.computeBoundingSphere();
  batch.mesh.userData.visibleInstanceCount=shown;
}
