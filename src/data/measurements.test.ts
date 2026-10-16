import { PanelData } from '@grafana/data';
import { ModuleDescriptor } from '../types';
import { mapMeasurementsToModules, measurementColor } from './measurements';

const moduleDescriptor: ModuleDescriptor = {
  id: 'tbpx-l3-l1-zplus-m1',
  visibilityKey: 'TBPX',
  sectionKey: 'TBPX-L3',
  subdetector: 'TBPX',
  layer: 3,
  ladder: 1,
  zSide: '+z',
  moduleIndex: 1,
  moduleType: 'quad',
  position: [0, 0, 0],
  rotationY: 0,
  rotationZ: 0,
  size: [1, 1, 1],
};

function panelData(efuse: string): PanelData {
  return {
    series: [{
      fields: [{
        name: 'Value',
        type: 'number',
        values: [19.5],
        labels: {
          module: 'DEMO-TBPX-QUAD',
          efuse,
          chip: '0',
          register: 'INTERNAL_NTC_REL',
          unit: 'C',
        },
        config: {},
      }],
      length: 1,
    }],
  } as unknown as PanelData;
}

function currentSchemaPanelData(chipEfuse: string): PanelData {
  return {
    series: [{
      fields: [{
        name: 'Value',
        type: 'number',
        values: [19.5],
        labels: {
          module_id: 'DEMO-TBPX-DOUBLE',
          chip_efuse: chipEfuse,
          chip: '0',
          register: 'INTERNAL_NTC_REL',
          unit: 'C',
        },
        config: {},
      }],
      length: 1,
    }],
  } as unknown as PanelData;
}

describe('mapMeasurementsToModules', () => {
  const mapping = JSON.stringify({
    'DEMO-TBPX-QUAD': {
      subdetector: 'TBPX',
      layer: 3,
      signed_ladder: 1,
      z_side: 'z+',
      module_index: 1,
      chips: { 0: '900001', 1: '900002', 2: '900003', 3: '900004' },
    },
  });

  it('maps a local chip ID only when its eFuse matches the module mapping', () => {
    const matched = mapMeasurementsToModules(panelData('900001'), [moduleDescriptor], mapping, 'last');
    expect(matched.get(moduleDescriptor.id)?.chips[0]).toMatchObject({
      value: 19.5,
      efuse: '900001',
    });

    const mismatched = mapMeasurementsToModules(panelData('WRONG'), [moduleDescriptor], mapping, 'last');
    expect(mismatched.size).toBe(0);
  });

  it('maps a measurement using the current module_id/chip_efuse label schema', () => {
    const doubleModuleDescriptor: ModuleDescriptor = {
      ...moduleDescriptor,
      id: 'tbpx-l1-l1-zplus-m2',
      layer: 1,
      moduleIndex: 2,
      moduleType: 'double',
    };
    const currentMapping = JSON.stringify({
      'DEMO-TBPX-DOUBLE': {
        subdetector: 'TBPX',
        layer: 1,
        signed_ladder: 1,
        z_side: 'z+',
        module_index: 2,
        chips: { 0: '900005', 1: '900006' },
      },
    });

    const matched = mapMeasurementsToModules(
      currentSchemaPanelData('900005'),
      [doubleModuleDescriptor],
      currentMapping,
      'last'
    );
    expect(matched.get(doubleModuleDescriptor.id)?.chips[0]).toMatchObject({
      value: 19.5,
      efuse: '900005',
    });
    expect(matched.get(doubleModuleDescriptor.id)?.moduleId).toBe('DEMO-TBPX-DOUBLE');
  });
});

describe('measurementColor', () => {
  const colors = { good: '#00ff00', bad: '#ff0000', noData: '#777777' };

  it('uses no-data color when no measurement exists', () => {
    expect(measurementColor(undefined, {}, colors)).toBe(colors.noData);
  });

  it('uses good color inside the allowed deviation', () => {
    expect(
      measurementColor(
        { value: 21.5, chipCount: 1, chips: {}, moduleId: 'DEMO-TBPX-QUAD' },
        { lowerLimit: 18, upperLimit: 22 },
        colors
      )
    ).toBe(colors.good);
  });

  it('uses bad color outside the allowed deviation', () => {
    expect(
      measurementColor(
        { value: 23, chipCount: 1, chips: {}, moduleId: 'DEMO-TBPX-QUAD' },
        { lowerLimit: 18, upperLimit: 22 },
        colors
      )
    ).toBe(colors.bad);
  });

  it('supports open-ended and disabled limits', () => {
    const measurement = { value: 23, chipCount: 1, chips: {}, moduleId: 'DEMO-TBPX-QUAD' };
    expect(measurementColor(measurement, { lowerLimit: 20 }, colors)).toBe(colors.good);
    expect(measurementColor(measurement, { upperLimit: 20 }, colors)).toBe(colors.bad);
    expect(measurementColor(measurement, {}, colors)).toBe(colors.good);
  });
});
