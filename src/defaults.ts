import { InnerTracker3DOptions } from './types';
import generatedPortcardMapping from './generatedPortcardMapping.json';
import generatedModuleMapping from './generatedModuleMapping.json';

export const DEFAULT_HARDWARE_MAPPING = JSON.stringify(generatedModuleMapping);

export const DEFAULT_OPTIONS: InnerTracker3DOptions = {
  nominalValue: 20,
  deviation: 2,
  goodColor: '#329b62',
  badColor: '#e24d42',
  noDataColor: '#8193a8',
  selectedColor: '#f2c96d',
  aggregation: 'mean',
  detailsDashboardUid: '',
  hardwareMappingJson: DEFAULT_HARDWARE_MAPPING,
  portcardMappingJson: JSON.stringify(generatedPortcardMapping),
  defaultAssembly: 'bare',
  geometryOverridesJson: '',
  showBeamAxis: true,
  rememberVisibility: true,
  showServiceCylinder: false,
  serviceCylinderCutaway: true,
  showServices: false,
  showPortcards: false,
  showAntlers: false,
  moduleAppearance: 'photos',
};
