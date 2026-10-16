import {halfAnnulusGeometry} from './halfAnnulusGeometry';
import {buildDetectorGeometry} from './buildGeometry';
import {DEFAULT_GEOMETRY,mm} from './config';

it('keeps perforated Dee cover triangles outside the beam opening on both halves and sides',()=>{
 const modules=buildDetectorGeometry(DEFAULT_GEOMETRY);
 for(const sub of ['TFPX','TEPX'])for(const side of ['+z','-z'])for(const half of ['upper','lower']){
  const all=modules.filter(m=>m.subdetector===sub&&m.disk===1&&m.side===side&&m.half===half);
  const inner=Math.min(...all.map(m=>Math.hypot(m.position[0],m.position[1])-m.size[1]/2))-mm(1);
  const outer=Math.max(...all.map(m=>Math.hypot(m.position[0],m.position[1])+m.size[1]/2))+mm(3);
  for(const z of new Set(all.map(m=>m.supportZ!)))for(const face of [-1,1]){
   const g=halfAnnulusGeometry(inner,outer,half==='upper'?-Math.PI/2:Math.PI/2,mm(.12),all.filter(m=>m.supportZ===z&&Math.sign(m.position[2]-z)===face));
   const p=g.attributes.position;
   for(let i=0;i<p.count;i+=3){
    let x=0,y=0;
    for(let j=0;j<3;j++){x+=p.getX(i+j)/3;y+=p.getY(i+j)/3;}
    // Allow only the small chord approximation of a 128-segment arc.
    expect(Math.hypot(x,y)).toBeGreaterThan(inner-mm(.01));
   }
   g.dispose();
  }
 }
});
