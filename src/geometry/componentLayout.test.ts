import {PORTCARD_COUNTS,cartridgeCount} from './componentLayout';
import { buildDetectorGeometry } from './buildGeometry';
import { DEFAULT_GEOMETRY } from './config';
import { modulePhotoKind, SERVICE_CARTRIDGES } from './componentLayout';

it('selects all six subsystem-specific module photographs', () => {
  const modules = buildDetectorGeometry(DEFAULT_GEOMETRY);
  const counts: Record<string, number> = {};
  modules.forEach(m => { const key = modulePhotoKind(m); counts[key] = (counts[key] ?? 0) + 1; });
  expect(counts).toEqual({ 'tbpx-l1': 108, 'tbpx-l2': 216, 'tbpx-quad': 432, 'tfpx-double': 832, 'tfpx-quad': 896, tepx: 1408 });
});

it('keeps the distinct TEPX portcards out of the TBPX/TFPX cartridges', () => {
  expect(SERVICE_CARTRIDGES.filter(c => c.zMm < 1600).every(c => c.kind === 'tbpx-tfpx')).toBe(true);
  expect(SERVICE_CARTRIDGES.filter(c => c.zMm > 1600).every(c => c.kind === 'tepx')).toBe(true);
});

it('places the populated middle cartridges between, not through, forward disks', () => {
  for (const cartridge of SERVICE_CARTRIDGES.filter(c => c.owner === 'TBPX')) {
    const lo = cartridge.zMm - cartridge.lengthMm / 2;
    const hi = cartridge.zMm + cartridge.lengthMm / 2;
    expect(DEFAULT_GEOMETRY.TFPX.diskZ.some(z => z * 500 >= lo && z * 500 <= hi)).toBe(false);
  }
});

it('alternates inward and outward barrel faces without moving nominal module centres', () => {
  const modules = buildDetectorGeometry(DEFAULT_GEOMETRY).filter(m => m.subdetector === 'TBPX');
  for (let layer=1;layer<=4;layer++) {
    const first = modules.filter(m => m.layer === layer && m.moduleIndex === 1 && m.zSide === '+z');
    const facings=first.map(m => Math.round(Math.cos(m.rotationZ-(Math.atan2(m.position[1],m.position[0])-Math.PI/2))));
    expect(new Set(facings)).toEqual(new Set([-1,1]));
    facings.forEach((v,i) => expect(v).toBe(i%2 ? 1 : -1));
  }
});

 it('uses the documented asymmetric TBPX portcard totals on both halves',()=>{expect(PORTCARD_COUNTS.TBPX).toBe(136);expect(SERVICE_CARTRIDGES.filter(c=>c.owner==='TBPX').reduce((n,c)=>n+cartridgeCount(c,1),0)).toBe(35);expect(SERVICE_CARTRIDGES.filter(c=>c.owner==='TBPX').reduce((n,c)=>n+cartridgeCount(c,-1),0)).toBe(33);});

it('populates every TFPX and TEPX double-Dee using the explicit service-table design',()=>{
 expect(PORTCARD_COUNTS).toEqual({TBPX:136,TFPX:256,TEPX:160});
 expect(SERVICE_CARTRIDGES.filter(c=>c.owner==='TFPX')).toHaveLength(8);
 expect(SERVICE_CARTRIDGES.filter(c=>c.owner==='TEPX')).toHaveLength(4);
 const barrel=SERVICE_CARTRIDGES.filter(c=>c.owner==='TBPX');expect(barrel.map(c=>c.rows)).toEqual([2,3]);expect(barrel.map(c=>c.zMm)).toEqual([750,975]);
});
