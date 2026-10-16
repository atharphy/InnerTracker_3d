import { buildDetectorGeometry, detectorModuleShapeKey } from './buildGeometry';
import { DEFAULT_GEOMETRY, MM_PER_UNIT } from './config';

describe('buildDetectorGeometry', () => {
  const modules = buildDetectorGeometry(DEFAULT_GEOMETRY);

  it('builds the complete Inner Tracker topology', () => {
    expect(modules).toHaveLength(3892);
    expect(modules.filter((module) => module.subdetector === 'TBPX')).toHaveLength(756);
    expect(modules.filter((module) => module.subdetector === 'TFPX')).toHaveLength(1728);
    expect(modules.filter((module) => module.subdetector === 'TEPX')).toHaveLength(1408);
  });

  it('assigns a unique id to every module', () => {
    expect(new Set(modules.map((module) => module.id)).size).toBe(modules.length);
  });

  it('does not duplicate any detector position', () => {
    const positions = modules.map((module) => [
      module.subdetector,
      module.side,
      module.layer,
      module.disk,
      module.ladder,
      module.zSide,
      module.ring,
      module.half,
      module.moduleIndex,
    ].join(':'));
    expect(new Set(positions).size).toBe(modules.length);
  });

  it('creates all configured elements', () => {
    expect(new Set(modules.map((module) => module.visibilityKey))).toEqual(
      new Set([
        'TBPX:1', 'TBPX:2', 'TBPX:3', 'TBPX:4',
        'TFPX:1', 'TFPX:2', 'TFPX:3', 'TFPX:4',
        'TFPX:5', 'TFPX:6', 'TFPX:7', 'TFPX:8',
        'TEPX:1', 'TEPX:2', 'TEPX:3', 'TEPX:4',
      ])
    );
  });

  it('assigns every module to one selectable detector section', () => {
    const sections = new Set(modules.map((module) => module.sectionKey));
    expect(sections).toEqual(new Set([
      'TBPX:right:+z', 'TBPX:right:-z',
      'TBPX:left:+z', 'TBPX:left:-z',
      'TFPX:+z:upper', 'TFPX:+z:lower',
      'TFPX:-z:upper', 'TFPX:-z:lower',
      'TEPX:+z:upper', 'TEPX:+z:lower',
      'TEPX:-z:upper', 'TEPX:-z:lower',
    ]));
  });

  it('places configured disk halves on the right and left', () => {
    const right = modules.filter((module) =>
      module.subdetector === 'TFPX'
      && module.side === '+z'
      && module.disk === 1
      && module.half === 'upper'
    );
    const left = modules.filter((module) =>
      module.subdetector === 'TFPX'
      && module.side === '+z'
      && module.disk === 1
      && module.half === 'lower'
    );
    expect(right.every((module) => module.position[0] >= -1e-12)).toBe(true);
    expect(left.every((module) => module.position[0] <= 1e-12)).toBe(true);
  });

  it('keeps barrel modules wholly inside their spatial half', () => {
    const barrel = modules.filter((module) => module.subdetector === 'TBPX');
    expect(barrel.every((module) =>
      module.sectionKey.includes(':right:')
        ? module.position[0] > 0
        : module.position[0] < 0
    )).toBe(true);
  });

  it('places positive ladders on the right and negative ladders on the left', () => {
    const barrel = modules.filter((module) => module.subdetector === 'TBPX');
    expect(barrel.every((module) =>
      module.ladder! > 0
        ? module.sectionKey.includes(':right:') && module.position[0] > 0
        : module.sectionKey.includes(':left:') && module.position[0] < 0
    )).toBe(true);
  });

  it('places odd TFPX rings downstream of even rings on both detector sides', () => {
    const plusInner = modules.find((module) =>
      module.subdetector === 'TFPX'
      && module.side === '+z'
      && module.disk === 1
      && module.ring === 1
    );
    const plusOuter = modules.find((module) =>
      module.subdetector === 'TFPX'
      && module.side === '+z'
      && module.disk === 1
      && module.ring === 2
    );
    const minusInner = modules.find((module) =>
      module.subdetector === 'TFPX'
      && module.side === '-z'
      && module.disk === 1
      && module.ring === 1
    );
    const minusOuter = modules.find((module) =>
      module.subdetector === 'TFPX'
      && module.side === '-z'
      && module.disk === 1
      && module.ring === 2
    );

    expect(plusInner!.position[2]).toBeGreaterThan(plusOuter!.position[2]);
    expect(minusInner!.position[2]).toBeLessThan(minusOuter!.position[2]);
    expect(plusInner!.rotationY).toBe(0);
    expect(plusOuter!.rotationY).toBe(0);
    expect(minusInner!.rotationY).toBe(0);
    expect(minusOuter!.rotationY).toBe(0);
  });

  it('points the narrow edge of every disk wedge towards the beam opening', () => {
    const diskModules = modules.filter((module) => module.subdetector !== 'TBPX');
    expect(diskModules.every((module) => {
      const theta = Math.atan2(module.position[1], module.position[0]);
      const difference = module.rotationZ - theta;
      return Math.abs(Math.sin(difference) + 1) < 1e-12
        && Math.abs(Math.cos(difference)) < 1e-12;
    })).toBe(true);
  });

  it('changes the disk wedge taper with the radial ring position', () => {
    const tepxDiskOne = modules.filter((module) =>
      module.subdetector === 'TEPX'
      && module.side === '+z'
      && module.disk === 1
      && module.half === 'upper'
    );
    const ringRatios = [1, 2, 3, 4, 5].map((ring) =>
      tepxDiskOne.find((module) => module.ring === ring)!.wedgeInnerRatio!
    );
    expect(ringRatios.every((ratio, index) =>
      index === 0 || ratio > ringRatios[index - 1]
    )).toBe(true);
  });

  it('keeps different disk rings in different instanced geometry groups', () => {
    const tepxDiskOne = modules.filter((module) =>
      module.subdetector === 'TEPX'
      && module.side === '+z'
      && module.disk === 1
      && module.half === 'upper'
    );
    const ringOne = tepxDiskOne.find((module) => module.ring === 1)!;
    const anotherRingOne = tepxDiskOne.find(
      (module) => module.ring === 1 && module.id !== ringOne.id
    )!;
    const ringFive = tepxDiskOne.find((module) => module.ring === 5)!;

    expect(detectorModuleShapeKey(ringOne)).toBe(detectorModuleShapeKey(anotherRingOne));
    expect(detectorModuleShapeKey(ringOne)).not.toBe(detectorModuleShapeKey(ringFive));
  });

  it('uses rectangular physical module sizes, independent of angular pitch', () => {
    for (const module of modules.filter(m => m.subdetector !== 'TBPX')) {
      expect(module.size[0] * MM_PER_UNIT).toBeCloseTo(module.moduleType === 'double' ? 18.8 : 35.85, 8);
      expect(module.size[1] * MM_PER_UNIT).toBeCloseTo(44.45, 8);
      expect(module.size[2] * MM_PER_UNIT).toBeCloseTo(1.15, 8);
    }
  });

  it('has four staggered module planes in every double disk', () => {
    for (const subdetector of ['TFPX', 'TEPX']) {
      const disk = modules.filter(m => m.subdetector === subdetector && m.side === '+z' && m.disk === 1);
      expect(new Set(disk.map(m => m.position[2].toFixed(8))).size).toBe(4);
      expect(new Set(disk.map(m => m.supportZ!.toFixed(8))).size).toBe(2);
    }
  });

  it('uses nonuniform nominal disk spacing and the documented 5.3 m active span', () => {
    expect(DEFAULT_GEOMETRY.TFPX.diskZ.map(z => Math.round(z * MM_PER_UNIT * 100) / 100))
      .toEqual([253, 322.95, 412.23, 526.2, 671.68, 842.38, 1109.42, 1397]);
    expect(DEFAULT_GEOMETRY.TEPX.diskZ.map(z => Math.round(z * MM_PER_UNIT * 100) / 100))
      .toEqual([1750, 2009.59, 2307.69, 2650]);
  });

  it('matches the documented module population', () => {
    expect(modules.filter(m => m.moduleType === 'double')).toHaveLength(1156);
    expect(modules.filter(m => m.moduleType === 'quad')).toHaveLength(2736);
    expect(modules.reduce((n, m) => n + (m.moduleType === 'double' ? 2 : 4), 0)).toBe(13256);
  });

  it('alternates the four- and five-module barrel sides by layer', () => {
    const expected = [
      { minus: 4, plus: 5 },
      { minus: 5, plus: 4 },
      { minus: 4, plus: 5 },
      { minus: 5, plus: 4 },
    ];
    expected.forEach(({ minus, plus }, index) => {
      const layer = index + 1;
      const ladderOne = modules.filter((module) =>
        module.subdetector === 'TBPX'
        && module.layer === layer
        && module.ladder === 1
      );
      expect(ladderOne.filter((module) => module.zSide === '-z')).toHaveLength(minus);
      expect(ladderOne.filter((module) => module.zSide === '+z')).toHaveLength(plus);
      expect(ladderOne.every((module) => Math.abs(module.position[2]) > 0)).toBe(true);
    });
  });

  it('keeps the complete barrel symmetric across its four layers', () => {
    const barrel = modules.filter((module) => module.subdetector === 'TBPX');
    const zPositions = barrel.map((module) => module.position[2]);
    expect(Math.max(...zPositions)).toBeCloseTo(-Math.min(...zPositions), 12);
  });
});

describe('disk face coverage',()=>{
 const modules=buildDetectorGeometry(DEFAULT_GEOMETRY);
 for(const subdetector of ['TFPX','TEPX'] as const){
  it(subdetector+' never duplicates a projected module centre across the disk faces',()=>{
   for(const side of ['+z','-z'])for(const disk of new Set(modules.filter(m=>m.subdetector===subdetector).map(m=>m.disk))){
    const cells=modules.filter(m=>m.subdetector===subdetector&&m.side===side&&m.disk===disk);
    const xy=cells.map(m=>m.position.slice(0,2).map(x=>x.toFixed(10)).join(':'));
    expect(new Set(xy).size).toBe(cells.length);
   }
  });
 }
 it('TEPX puts odd rings toward the interaction point and even rings away on both Dees',()=>{
  for(const m of modules.filter(m=>m.subdetector==='TEPX')){
   const localFace=Math.sign(m.position[2])*(m.position[2]-m.supportZ!);
   expect(Math.sign(localFace)).toBe(m.ring!%2?-1:1);
  }
 });
 it('populates both faces of every Dee without renumbering ring positions',()=>{
  for(const detector of ['TFPX','TEPX']){
   const faces=new Map<string,Set<number>>();
   for(const m of modules.filter(m=>m.subdetector===detector)){
    const key=[m.side,m.disk,m.half,m.supportZ].join(':');
    if(!faces.has(key)){faces.set(key,new Set());}
    faces.get(key)!.add(Math.sign(m.position[2]-m.supportZ!));
   }
   expect([...faces.values()].every(f=>f.size===2)).toBe(true);
  }
 });
 it('retains nominal projected ring overlap with nonintersecting Z envelopes',()=>{
  for(const detector of ['TFPX','TEPX'] as const){
   const config=DEFAULT_GEOMETRY[detector];
   let overlaps=0;
   for(let i=0;i<config.rings.length;i++)for(let j=i+1;j<config.rings.length;j++){
    if(config.rings[i].outerRadius<=config.rings[j].innerRadius){continue;}
    overlaps++;
    for(const side of ['+z','-z']){
     const a=modules.filter(m=>m.subdetector===detector&&m.side===side&&m.disk===1&&m.ring===i+1);
     const b=modules.filter(m=>m.subdetector===detector&&m.side===side&&m.disk===1&&m.ring===j+1);
     for(const x of a)for(const y of b){expect(Math.abs(x.position[2]-y.position[2])).toBeGreaterThan((x.size[2]+y.size[2])/2);}
    }
   }
   expect(overlaps).toBeGreaterThan(0);
  }
 });
});
