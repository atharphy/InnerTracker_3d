import mapping from '../generatedModuleMapping.json';
import { buildInventory } from './inventory';
import { buildDetectorGeometry } from '../geometry/buildGeometry';
import { DEFAULT_GEOMETRY } from '../geometry/config';
const modules=buildDetectorGeometry(DEFAULT_GEOMETRY);
const placement={subdetector:'TBPX',layer:3,signed_ladder:1,z_side:'z+',module_index:1};
it('uses YAML membership for installation independently of legacy flags and measurement availability',()=>{
 const mapping=JSON.stringify({A:{...placement,installed:true,connected:false}});
 const noData=buildInventory(mapping,modules,new Map());expect(noData.entries[0]).toMatchObject({installed:true,hasData:false});
 const m=noData.entries[0].module;
 const withData=buildInventory(mapping,modules,new Map([[m.id,{moduleId:'A',value:3,chipCount:1,chips:{}}]]));
 expect(withData.entries[0]).toMatchObject({installed:true,hasData:true});
 expect(buildInventory(JSON.stringify({A:placement}),modules,new Map()).entries[0].installed).toBe(true);
 expect(buildInventory(JSON.stringify({A:{...placement,installed:false}}),modules,new Map()).entries[0].installed).toBe(true);
});
it('reports invalid mapping and suppresses contradictory installation positions',()=>{
 expect(buildInventory('{',modules,new Map()).issues).toHaveLength(1);
 expect(buildInventory(JSON.stringify({A:{...placement,installed:'false'}}),modules,new Map()).entries[0].installed).toBe(true);
 const duplicate=buildInventory(JSON.stringify({A:{...placement,installed:true},B:{...placement,installed:true}}),modules,new Map());
 expect(duplicate.issues).toHaveLength(1);expect(duplicate.entries.every(e=>!e.installed)).toBe(true);
 expect(buildInventory(JSON.stringify({A:{...placement,layer:99}}),modules,new Map()).issues).toHaveLength(1);
});

it('highlights both current mapped modules without requiring new flags',()=>{const result=buildInventory(JSON.stringify(mapping),modules,new Map());expect(result.issues).toEqual([]);expect(result.entries).toHaveLength(2);expect(result.entries.every(e=>e.installed && !e.hasData)).toBe(true);});
