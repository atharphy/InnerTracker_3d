import {buildPortcardInventory} from './portcards';
import {buildDetectorGeometry} from '../geometry/buildGeometry';
import {DEFAULT_GEOMETRY} from '../geometry/config';
import {DEFAULT_OPTIONS} from '../defaults';
const modules=buildDetectorGeometry(DEFAULT_GEOMETRY);
const slot='TBPX:+z:right:W1:R1:C1';
const card={slot,connections:[{module:'DEMO-TBPX-QUAD',lpgbt:2}]};
const parse=(data:unknown)=>buildPortcardInventory(JSON.stringify(data),DEFAULT_OPTIONS.hardwareMappingJson,modules);
it('requires explicit module connections, independent of live measurements',()=>{
 expect(parse({}).entries).toEqual([]);
 expect(parse({PC:card}).entries[0].connections[0].module.layer).toBe(3);
 expect(parse({PC:{slot,connections:[]}}).entries[0].connections).toEqual([]);
});
it('excludes ambiguous slots and module assignments',()=>{
 expect(parse({A:card,B:{...card,connections:[]}}).entries).toEqual([]);
 const r=parse({A:card,B:{...card,slot:'TBPX:+z:right:W1:R1:C2'}});
 expect(r.entries.every(c=>c.connections.length===0)).toBe(true);
 expect(r.issues.length).toBeGreaterThan(0);
});
it.each([
 {slot:'missing',connections:[]},
 {slot,connections:[{module:'missing',lpgbt:0}]},
 {slot,connections:[{module:'DEMO-TBPX-QUAD',lpgbt:3}]},
 {slot:'TBPX:-z:right:W1:R1:C1',connections:card.connections},
 {slot:'TFPX:+z:right:D1:R1:C1',connections:card.connections},
])('rejects invalid connections without inventing installed hardware',data=>{
 const result=parse({PC:data});
 expect(result.issues.length).toBeGreaterThan(0);
 expect(result.entries.flatMap(e=>e.connections)).toHaveLength(0);
});
