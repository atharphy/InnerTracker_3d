export interface BarrelLayerConfig {
  halfLadders: number;
  zPlusModules: number;
  zMinusModules: number;
  moduleType: 'double' | 'quad';
  radius: number;
  axialPitch: number;
  radialStagger?: number;
  moduleWidth?: number;
  moduleLength?: number;
}

export interface DiskRingConfig {
  modulesPerHalf: number;
  moduleType: 'double' | 'quad';
  innerRadius: number;
  outerRadius: number;
  surface: 'inner' | 'outer';
  moduleWidth?: number;
  planeOffset?: number;
}

export interface DiskSystemConfig {
  diskZ: number[];
  radialScale: number;
  ringOffset?: number;
  faceOffset?: number;
  rings: DiskRingConfig[];
}

export interface DetectorGeometryConfig {
  TBPX: BarrelLayerConfig[];
  TFPX: DiskSystemConfig;
  TEPX: DiskSystemConfig;
}

// One scene unit = 500 mm, uniformly in X/Y/Z. Nominal active geometry is
// based on CMSSW IT711 (2024-01-11), checked against Bardelli PSD14 p4.
// See PHYSICAL_GEOMETRY.md for provenance and illustrative service dimensions.
export const MM_PER_UNIT = 500;
export const mm = (value: number): number => value / MM_PER_UNIT;

export const DEFAULT_GEOMETRY: DetectorGeometryConfig = {
  TBPX: [
    { halfLadders: 6, zPlusModules: 5, zMinusModules: 4, moduleType: 'double', radius: mm(30), radialStagger: mm(2.5), axialPitch: mm(44.4), moduleWidth: mm(18.8), moduleLength: mm(44) },
    { halfLadders: 12, zPlusModules: 4, zMinusModules: 5, moduleType: 'double', radius: mm(61.5), radialStagger: mm(2.5), axialPitch: mm(44.75), moduleWidth: mm(18.8), moduleLength: mm(44.35) },
    { halfLadders: 10, zPlusModules: 5, zMinusModules: 4, moduleType: 'quad', radius: mm(104.5), radialStagger: mm(2.5), axialPitch: mm(44.75), moduleWidth: mm(35.85), moduleLength: mm(44.35) },
    { halfLadders: 14, zPlusModules: 4, zMinusModules: 5, moduleType: 'quad', radius: mm(146.5), radialStagger: mm(2.5), axialPitch: mm(44.75), moduleWidth: mm(35.85), moduleLength: mm(44.35) },
  ],
  TFPX: {
    diskZ: [253, 322.95, 412.23, 526.2, 671.68, 842.38, 1109.42, 1397].map(mm),
    radialScale: 1,
    ringOffset: mm(6.25),
    faceOffset: mm(2.75),
    rings: [
      { modulesPerHalf: 10, surface: 'outer', moduleType: 'double', innerRadius: mm(30.500), outerRadius: mm(74.950), moduleWidth: mm(18.8) },
      { modulesPerHalf: 16, surface: 'inner', moduleType: 'double', innerRadius: mm(48.500), outerRadius: mm(92.950), moduleWidth: mm(18.8) },
      { modulesPerHalf: 12, surface: 'outer', moduleType: 'quad', innerRadius: mm(82.700), outerRadius: mm(127.150), moduleWidth: mm(35.85) },
      { modulesPerHalf: 16, surface: 'inner', moduleType: 'quad', innerRadius: mm(116.040), outerRadius: mm(160.490), moduleWidth: mm(35.85) },
    ],
  },
  TEPX: {
    diskZ: [1750, 2009.59, 2307.69, 2650].map(mm),
    radialScale: 1,
    ringOffset: mm(2),
    faceOffset: mm(4),
    rings: [
      { modulesPerHalf: 10, surface: 'inner', moduleType: 'quad', innerRadius: mm(62.400), outerRadius: mm(106.850), moduleWidth: mm(35.85) },
      { modulesPerHalf: 14, surface: 'outer', moduleType: 'quad', innerRadius: mm(100.050), outerRadius: mm(144.500), moduleWidth: mm(35.85) },
      { modulesPerHalf: 18, surface: 'inner', moduleType: 'quad', innerRadius: mm(137.350), outerRadius: mm(181.800), moduleWidth: mm(35.85) },
      { modulesPerHalf: 22, surface: 'outer', moduleType: 'quad', innerRadius: mm(173.950), outerRadius: mm(218.400), moduleWidth: mm(35.85) },
      { modulesPerHalf: 24, surface: 'inner', moduleType: 'quad', innerRadius: mm(210.000), outerRadius: mm(254.450), moduleWidth: mm(35.85) },
    ],
  },
};

export function geometryFromJson(json: string): DetectorGeometryConfig {
  if (!json.trim()) {
    return DEFAULT_GEOMETRY;
  }

  try {
    const overrides = JSON.parse(json) as Partial<DetectorGeometryConfig>;
    return {
      TBPX: overrides.TBPX ?? DEFAULT_GEOMETRY.TBPX,
      TFPX: { ...DEFAULT_GEOMETRY.TFPX, ...(overrides.TFPX ?? {}) },
      TEPX: { ...DEFAULT_GEOMETRY.TEPX, ...(overrides.TEPX ?? {}) },
    };
  } catch {
    return DEFAULT_GEOMETRY;
  }
}
