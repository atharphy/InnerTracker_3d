import { ModuleDescriptor } from '../types';

export type ModulePhotoKind = 'tbpx-l1' | 'tbpx-l2' | 'tbpx-quad' | 'tfpx-double' | 'tfpx-quad' | 'tepx';
export type PortcardKind = 'tbpx-tfpx' | 'tepx';

export function modulePhotoKind(module: ModuleDescriptor): ModulePhotoKind {
  if (module.subdetector === 'TEPX') { return 'tepx'; }
  if (module.subdetector === 'TFPX') { return module.moduleType === 'double' ? 'tfpx-double' : 'tfpx-quad'; }
  return module.layer === 1 ? 'tbpx-l1' : module.layer === 2 ? 'tbpx-l2' : 'tbpx-quad';
}

export interface CartridgeLocation {
  kind: PortcardKind;
  owner: 'TBPX' | 'TFPX' | 'TEPX';
  positiveCount?: number;
  negativeCount?: number;
  zMm: number;
  radiusMm: number;
  lengthMm: number;
  rows: number;
  columns: number;
  label: string;
}

// Arrangement follows the system-test assembly drawing (PDF page 2), with
// populated internal TBPX cartridges between TFPX disks and separate TEPX
// peripheral service trays. Dimensions/counts are visual reconstructions,
// not an electronics installation database.
// Explicit 2020 service-table population; the TFPX eight-card cartridge is also
// documented by Orfanelli (2021/2022). Do not infer a current split from 680.
export const SERVICE_CARTRIDGES: CartridgeLocation[] = [
  ...[253,322.95,412.23,526.2,671.68,842.38,1109.42,1397].map((zMm,i)=>({
    kind:'tbpx-tfpx' as const,owner:'TFPX' as const,zMm,radiusMm:174,lengthMm:52,rows:1,columns:8,label:`TFPX disk ${i+1} service cartridge`,
  })),
  {kind:'tbpx-tfpx',owner:'TBPX',positiveCount:18,negativeCount:17,zMm:750,radiusMm:174,lengthMm:110,rows:2,columns:9,label:'TBPX cartridges between TFPX D5–D6'},
  {kind:'tbpx-tfpx',owner:'TBPX',positiveCount:17,negativeCount:16,zMm:975,radiusMm:174,lengthMm:162,rows:3,columns:6,label:'TBPX cartridges between TFPX D6–D7'},
  ...[1750,2009.59,2307.69,2650].map((zMm,i)=>({
    kind:'tepx' as const,owner:'TEPX' as const,zMm:zMm+65,radiusMm:262,lengthMm:110,rows:2,columns:5,label:`TEPX double-Dee ${i+1} supply portcards`,
  })),
];

export function cartridgeCount(c: CartridgeLocation, side: number): number {
  return (side>0 ? c.positiveCount : c.negativeCount) ?? c.rows*c.columns;
}
export const PORTCARD_COUNTS=Object.fromEntries(['TBPX','TFPX','TEPX'].map(owner=>[owner,
  SERVICE_CARTRIDGES.filter(c=>c.owner===owner).reduce((sum,c)=>sum+2*(cartridgeCount(c,1)+cartridgeCount(c,-1)),0)
])) as Record<'TBPX'|'TFPX'|'TEPX',number>;
