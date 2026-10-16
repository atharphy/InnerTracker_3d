// Counts per service quarter from Antler Updates (2026-02-03), page 2.
// Coordinates and lane spacing are visual reconstruction, not survey CAD.
export type ServiceFamily = 'TBPX' | 'TFPX' | 'TEPX';
export interface ServiceLane { family:ServiceFamily; index:number; angle:number; startZ:number; antlerAngle:number; }
export const SERVICE_LANES:ServiceLane[] = [
  ...Array.from({length:32},(_,index)=>({family:'TFPX' as const,index,angle:.13+index*.047,startZ:340,antlerAngle:.13+index*.047})),
  ...Array.from({length:18},(_,index)=>({family:'TBPX' as const,index,angle:1.73+index*.07,startZ:230,antlerAngle:1.73+index*.07})),
  ...Array.from({length:20},(_,index)=>({family:'TEPX' as const,index,angle:.19+index*.145,startZ:1700,antlerAngle:.19+index*.145})),
];
export function serviceRadius(z:number,family:ServiceFamily):number {
  const shell=z<=1450?198:z>=1660?283:198+(z-1450)*85/210;
  return shell+(family==='TEPX'?9:0);
}
export const ANTLER_Z=2730;
