import { PanelPlugin } from '@grafana/data';
import { InnerTracker3DPanel } from './components/InnerTracker3DPanel';
import { DEFAULT_OPTIONS } from './defaults';
import { InnerTracker3DOptions } from './types';

export const plugin = new PanelPlugin<InnerTracker3DOptions>(InnerTracker3DPanel)
  .setPanelOptions((builder) => {
    return builder
      .addRadio({path:'defaultAssembly',name:'Default assembly view',defaultValue:'bare',settings:{options:[{label:'Subsystems only',value:'bare'},{label:'Full assembly',value:'full'}]}})
      .addTextInput({path:'portcardMappingJson',name:'Portcard connections (JSON)',description:'Board IDs, mounting slots and explicit module/lpGBT connections generated from portcards.yaml.',defaultValue:DEFAULT_OPTIONS.portcardMappingJson,settings:{useTextarea:true,rows:8}})

      .addRadio({
        path: 'aggregation',
        name: 'Chip-to-module aggregation',
        description: 'How multiple live chip values are combined for the module colour.',
        defaultValue: DEFAULT_OPTIONS.aggregation,
        settings: {
          options: [
            { label: 'Mean', value: 'mean' },
            { label: 'Maximum', value: 'max' },
            { label: 'Minimum', value: 'min' },
            { label: 'Latest', value: 'last' },
          ],
        },
      })
      .addRadio({
        path: 'moduleAppearance',
        name: 'Module appearance',
        defaultValue: DEFAULT_OPTIONS.moduleAppearance,
        settings: { options: [
          { label: 'Modules', value: 'photos' },
          { label: 'Chips', value: 'chips' },
        ] },
      })
      .addBooleanSwitch({ path: 'showPortcards', name: 'Show portcards and service cartridges', defaultValue: false })
      .addBooleanSwitch({ path: 'showAntlers', name: 'Show end supports / antlers', defaultValue: false })
      .addColorPicker({
        path: 'goodColor',
        name: 'Within-limits colour',
        defaultValue: DEFAULT_OPTIONS.goodColor,
      })
      .addColorPicker({
        path: 'badColor',
        name: 'Outside-limits colour',
        defaultValue: DEFAULT_OPTIONS.badColor,
      })
      .addColorPicker({
        path: 'noDataColor',
        name: 'No-data colour',
        defaultValue: DEFAULT_OPTIONS.noDataColor,
      })
      .addColorPicker({
        path: 'selectedColor',
        name: 'Hover outline colour',
        defaultValue: DEFAULT_OPTIONS.selectedColor,
      })
      .addTextInput({
        path: 'detailsDashboardUid',
        name: 'Module-details dashboard UID',
        defaultValue: DEFAULT_OPTIONS.detailsDashboardUid,
      })
      .addBooleanSwitch({
        path: 'showBeamAxis',
        name: 'Show beam axis',
        defaultValue: DEFAULT_OPTIONS.showBeamAxis,
      })
      .addBooleanSwitch({
        path: 'rememberVisibility',
        name: 'Remember visibility controls',
        defaultValue: DEFAULT_OPTIONS.rememberVisibility,
      })
      .addBooleanSwitch({
        path: 'showServiceCylinder',
        name: 'Show IT service cylinder',
        defaultValue: DEFAULT_OPTIONS.showServiceCylinder,
      })
      .addBooleanSwitch({
        path: 'serviceCylinderCutaway',
        name: 'Service cylinder cutaway view',
        defaultValue: DEFAULT_OPTIONS.serviceCylinderCutaway,
      })
      .addBooleanSwitch({
        path: 'showServices',
        name: 'Show auxiliary services & portcards',
        defaultValue: DEFAULT_OPTIONS.showServices,
      })
      .addTextInput({
        path: 'hardwareMappingJson',
        name: 'Hardware mapping (JSON)',
        description:
          'Map module serial numbers to detector positions and chip eFuses.',
        defaultValue: DEFAULT_OPTIONS.hardwareMappingJson,
        settings: {
          useTextarea: true,
          rows: 8,
        },
      })
      .addTextInput({
        path: 'geometryOverridesJson',
        name: '3D placement overrides (JSON)',
        description:
          'Optional TBPX/TFPX/TEPX geometry overrides. Leave empty to use the bundled complete topology.',
        defaultValue: DEFAULT_OPTIONS.geometryOverridesJson,
        settings: {
          useTextarea: true,
          rows: 8,
        },
      });
  });
