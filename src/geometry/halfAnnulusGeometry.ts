import * as THREE from 'three';
import {ModuleDescriptor} from '../types';

export function halfAnnulusGeometry(
  innerRadius: number,
  outerRadius: number,
  thetaStart: number,
  depth: number,
  apertures: ModuleDescriptor[] = []
): THREE.ExtrudeGeometry {
  const thetaEnd = thetaStart + Math.PI;
  const shape = new THREE.Shape();
  shape.moveTo(
    outerRadius * Math.cos(thetaStart),
    outerRadius * Math.sin(thetaStart)
  );
  shape.absarc(0, 0, outerRadius, thetaStart, thetaEnd, false);
  shape.lineTo(
    innerRadius * Math.cos(thetaEnd),
    innerRadius * Math.sin(thetaEnd)
  );
  shape.absarc(0, 0, innerRadius, thetaEnd, thetaStart, true);
  shape.closePath();

  const seen = new Set<string>();
  for (const m of apertures) {
    const key = `${m.position[0].toFixed(5)}:${m.position[1].toFixed(5)}`;
    if (seen.has(key)) { continue; } seen.add(key);
    const hole = new THREE.Path();
    const c = Math.cos(m.rotationZ), s = Math.sin(m.rotationZ);
    const corners = [[-1,-1],[-1,1],[1,1],[1,-1]].map(([x,y]) => {
      const dx=x*m.size[0]*.43, dy=y*m.size[1]*.43;
      return new THREE.Vector2(m.position[0]+dx*c-dy*s,m.position[1]+dx*s+dy*c);
    });
    // A closed hole must stay inside the half-plate. Seam-crossing apertures
    // otherwise make Earcut bridge triangles across the central beam opening.
    if (corners.some(p => p.length() <= innerRadius || p.length() >= outerRadius
      || p.x*Math.cos(thetaStart+Math.PI/2)+p.y*Math.sin(thetaStart+Math.PI/2) <= 1e-9)) { continue; }
    corners.forEach((p,i) => { if (i===0) { hole.moveTo(p.x,p.y); } else { hole.lineTo(p.x,p.y); } });
    hole.closePath();shape.holes.push(hole);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    bevelSize: Math.min(0.006, depth * 0.12),
    bevelThickness: Math.min(0.004, depth * 0.1),
    bevelSegments: 2,
    curveSegments: 128,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}
