export type AggregationMode = 'mean' | 'max' | 'min' | 'last';
export type CameraMode = 'rotate' | 'pan';
export type ModuleAppearance = 'photos' | 'chips';

export interface InnerTracker3DOptions {
  nominalValue: number;
  deviation: number;
  lowerLimit?: number;
  upperLimit?: number;
  goodColor: string;
  badColor: string;
  noDataColor: string;
  selectedColor: string;
  aggregation: AggregationMode;
  detailsDashboardUid: string;
  hardwareMappingJson: string;
  portcardMappingJson: string;
  defaultAssembly: 'bare' | 'full';
  geometryOverridesJson: string;
  showBeamAxis: boolean;
  rememberVisibility: boolean;
  showServiceCylinder: boolean;
  serviceCylinderCutaway: boolean;
  showServices: boolean;
  showPortcards: boolean;
  showAntlers: boolean;
  moduleAppearance: ModuleAppearance;
}

export interface VisibilityState {
  dees?: Record<string, boolean[]>;
  elementParts?: Record<string, boolean[]>;
  TBPX: boolean[];
  TFPX: boolean[];
  TEPX: boolean[];
  TBPXParts: boolean[];
  TFPXParts: boolean[];
  TEPXParts: boolean[];
}

export type Subdetector = 'TBPX' | 'TFPX' | 'TEPX';
export type DetectorSide = '+z' | '-z' | undefined;

export interface ModuleDescriptor {
  id: string;
  visibilityKey: string;
  sectionKey: string;
  subdetector: Subdetector;
  side?: DetectorSide;
  layer?: number;
  disk?: number;
  ladder?: number;
  zSide?: '+z' | '-z';
  ring?: number;
  half?: 'upper' | 'lower';
  moduleIndex: number;
  moduleType: 'double' | 'quad';
  position: [number, number, number];
  rotationY: number;
  rotationZ: number;
  size: [number, number, number];
  diskSurface?: 'inner' | 'outer';
  diskCenterZ?: number;
  supportZ?: number;
  wedgeInnerRatio?: number;
  wedgeHalfAngle?: number;
}

export interface ModuleMeasurement {
  value: number;
  unit?: string;
  register?: string;
  chipCount: number;
  chips: Record<number, ChipMeasurement>;
  moduleId: string;
}

export interface ChipMeasurement {
  value: number;
  unit?: string;
  register?: string;
  efuse?: string;
}

export interface HoveredModule {
  module: ModuleDescriptor;
  measurement?: ModuleMeasurement;
  chipIndex?: number;
  chipMeasurement?: ChipMeasurement;
  clientX: number;
  clientY: number;
}
