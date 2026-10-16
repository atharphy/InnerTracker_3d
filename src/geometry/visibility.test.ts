import { defaultVisibility } from '../components/VisibilityTree';
import { elementParts, partVisible, setElementParts, setSubdetector, visiblePartCount } from './visibility';
it('hides a quarter only in its own layer and derives mixed parent counts',()=>{
 let v=defaultVisibility();v=setElementParts(v,'TBPX',0,[false,true,true,true]);
 expect(partVisible(v,'TBPX:1','TBPX:right:+z')).toBe(false);
 expect(partVisible(v,'TBPX:2','TBPX:right:+z')).toBe(true);
 expect(visiblePartCount(v)).toBe(63);
 v=setSubdetector(v,'TBPX',false);expect(visiblePartCount(v)).toBe(48);
 v=setElementParts(v,'TBPX',2,[false,false,true,false]);expect(visiblePartCount(v)).toBe(49);
 expect(partVisible(v,'TBPX:3','TBPX:left:+z')).toBe(true);
 expect(partVisible(v,'TBPX:1','TBPX:left:+z')).toBe(false);
});
it('migrates legacy global section masks without losing hidden sections',()=>{
 const v=defaultVisibility();v.TFPXParts=[true,false,true,false];
 expect(elementParts(v,'TFPX',0)).toEqual([true,false,true,false]);
 const changed=setElementParts(v,'TFPX',0,[true,true,true,false]);
 expect(partVisible(changed,'TFPX:1','TFPX:+z:lower')).toBe(true);
 expect(partVisible(changed,'TFPX:2','TFPX:+z:lower')).toBe(false);
 expect(setSubdetector(changed,'TFPX',true).TFPX.every(Boolean)).toBe(true);
});

import {deeParts,moduleVisible,setDee} from './visibility';
import {buildDetectorGeometry} from './buildGeometry';
import {DEFAULT_GEOMETRY} from './config';
it('isolates either Dee in one disk half, preserves other selections and restores parents',()=>{
 const modules=buildDetectorGeometry(DEFAULT_GEOMETRY);
 for(const sub of ['TFPX','TEPX'] as const){
  let v=defaultVisibility();
  const half=modules.filter(m=>m.subdetector===sub&&m.disk===1&&m.side==='+z'&&m.half==='upper');
  v=setDee(v,sub,0,0,0,false);
  expect(half.filter(m=>moduleVisible(v,m))).toHaveLength(sub==='TFPX'?22:44);
  v=setDee(v,sub,0,1,1,false);
  expect(deeParts(v,`${sub}:1`,`${sub}:+z:upper`)).toEqual([false,true]);
  v=setDee(v,sub,0,0,1,false);
  expect(half.some(m=>moduleVisible(v,m))).toBe(false);
  v=setDee(v,sub,0,0,0,true);
  expect(half.filter(m=>moduleVisible(v,m))).toHaveLength(sub==='TFPX'?32:44);
  expect(modules.filter(m=>m.subdetector===sub&&m.disk===2).every(m=>moduleVisible(v,m))).toBe(true);
  v=setSubdetector(v,sub,true);
  expect(modules.filter(m=>m.subdetector===sub).every(m=>moduleVisible(v,m))).toBe(true);
 }
});

it('enables only the requested Dee from a legacy all-disabled state',()=>{
 const v=defaultVisibility();v.TEPX.fill(false);v.TEPXParts.fill(false);
 const next=setDee(v,'TEPX',0,0,1,true);
 expect(deeParts(next,'TEPX:1','TEPX:+z:upper')).toEqual([false,true]);
});
