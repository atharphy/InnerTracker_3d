import { deeParts, setDee, sectionKeys, elementParts, PART_LABELS, setElementParts, setSubdetector, SUBDETECTORS } from '../geometry/visibility';
import React, { useEffect, useRef } from 'react';
import { CameraMode, ModuleAppearance, Subdetector, VisibilityState } from '../types';

export interface HardwareDetails { tbpxPortcards:boolean; tepxPortcards:boolean; cartridges:boolean; rails:boolean; mechanics:boolean; installedOnly:boolean; connectedPortcardsOnly:boolean; electrical:boolean; tbpxCables:boolean; exterior:boolean; cylinderLeft:boolean; axisX:boolean; axisY:boolean; axisZ:boolean; }
interface VisibilityTreeProps {
  hardwareDetails: HardwareDetails;
  onHardwareDetailsChange:(v:HardwareDetails)=>void;
  moduleAppearance: ModuleAppearance;
  onModuleAppearanceChange: (mode: ModuleAppearance) => void;
  portcardsVisible: boolean;
  onPortcardsVisibleChange: (value: boolean) => void;
  antlersVisible: boolean;
  onAntlersVisibleChange: (value: boolean) => void;
  value: VisibilityState;
  onChange: (value: VisibilityState) => void;
  onResetCamera: () => void;
  cameraMode: CameraMode;
  onCameraModeChange: (mode: CameraMode) => void;
  beamPipeVisible: boolean;
  onBeamPipeVisibleChange: (visible: boolean) => void;
  serviceCylinderVisible: boolean;
  onServiceCylinderVisibleChange: (visible: boolean) => void;
  serviceCylinderCutaway: boolean;
  onServiceCylinderCutawayChange: (cutaway: boolean) => void;
  servicesVisible: boolean;
  onServicesVisibleChange: (visible: boolean) => void;
}

export const CheckBox = ({
  checked,
  indeterminate = false,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.currentTarget.checked)}
    />
  );
};

const VisibilityGroup = ({subdetector:s,value,onChange}:{subdetector:Subdetector;value:VisibilityState;onChange:(v:VisibilityState)=>void}) => {
  const perElement=s==='TBPX'?4:8;
  const counts=value[s].map((on,i)=>on?elementParts(value,s,i).reduce((n,part,j)=>n+(part?(s==='TBPX'?1:deeParts(value,`${s}:${i+1}`,sectionKeys(s)[j]).filter(Boolean).length):0),0):0);
  const count=counts.reduce((a,b)=>a+b,0), total=counts.length*perElement;
  return <details className="cmsit3d-group" open>
    <summary><label onClick={e=>e.stopPropagation()}><CheckBox checked={count===total} indeterminate={count>0 && count<total} onChange={on=>onChange(setSubdetector(value,s,on))} /><strong>{s}</strong></label><small>{count}/{total} parts</small></summary>
    {counts.map((count,i)=><details key={i} className="cmsit3d-element">
      <summary><label onClick={e=>e.stopPropagation()}><CheckBox checked={count===perElement} indeterminate={count>0 && count<perElement} onChange={on=>onChange(setElementParts(value,s,i,Array(4).fill(on),true))} /><span>{s==='TBPX'?'Layer':'Disk'} {i+1}</span></label><small>{count}/{perElement}</small></summary>
      <div className="cmsit3d-children">{s==='TBPX' ? elementParts(value,s,i).map((on,j)=><label key={j}><CheckBox checked={value[s][i] && on} onChange={next=>{const parts=elementParts(value,s,i);parts[j]=next;onChange(setElementParts(value,s,i,parts));}} /><span>Quarter: {PART_LABELS[s][j]}</span></label>) : [0,2].map(start=>{
        const parts=elementParts(value,s,i), selected=value[s][i]?[start,start+1].reduce((n,j)=>n+(parts[j]?deeParts(value,`${s}:${i+1}`,sectionKeys(s)[j]).filter(Boolean).length:0),0):0;
        return <details key={start} open><summary><label onClick={e=>e.stopPropagation()}><CheckBox checked={selected===4} indeterminate={selected>0&&selected<4} onChange={on=>{let next=value;for(const j of [start,start+1])for(const k of [0,1]){next=setDee(next,s,i,j,k,on);}onChange(next);}}/><span>{start===0?'Z+':'Z−'} side</span></label></summary>
          <div className="cmsit3d-children">{[start,start+1].map(j=>{
            const dees=deeParts(value,`${s}:${i+1}`,sectionKeys(s)[j]),active=value[s][i]&&parts[j];
            return <details key={j}><summary><label onClick={e=>e.stopPropagation()}><CheckBox checked={active&&dees.every(Boolean)} indeterminate={active&&dees.some(Boolean)&&!dees.every(Boolean)} onChange={on=>{let next=setDee(value,s,i,j,0,on);onChange(setDee(next,s,i,j,1,on));}}/><span>{j%2===0?'Right':'Left'} half</span></label></summary>
              <div className="cmsit3d-children">{dees.map((on,k)=><label key={k}><CheckBox checked={active&&on} onChange={next=>onChange(setDee(value,s,i,j,k,next))}/><span>Dee {k+1} ({k===0?'near interaction point':'far from interaction point'})</span></label>)}</div>
            </details>;
          })}</div>
        </details>;
      })}</div>
    </details>)}
  </details>;
};

function allVisibility(enabled: boolean): VisibilityState {
  return {
    TBPX: Array(4).fill(enabled),
    TFPX: Array(8).fill(enabled),
    TEPX: Array(4).fill(enabled),
    TBPXParts: Array(4).fill(enabled),
    TFPXParts: Array(4).fill(enabled),
    TEPXParts: Array(4).fill(enabled),
  };
}

export const VisibilityTree = ({
  hardwareDetails,onHardwareDetailsChange,
  moduleAppearance, onModuleAppearanceChange, portcardsVisible, onPortcardsVisibleChange, antlersVisible, onAntlersVisibleChange,
  value,
  onChange,
  onResetCamera,
  cameraMode,
  onCameraModeChange,
  beamPipeVisible,
  onBeamPipeVisibleChange,
  serviceCylinderVisible,
  onServiceCylinderVisibleChange,
  serviceCylinderCutaway,
  onServiceCylinderCutawayChange,
  servicesVisible,
  onServicesVisibleChange,
}: VisibilityTreeProps) => (
  <aside className="cmsit3d-sidebar">
    <div className="cmsit3d-sidebar-title">Inner Tracker</div>
    <div className="cmsit3d-actions">
      <button type="button" onClick={() => onChange(allVisibility(true))}>Enable all</button>
      <button type="button" onClick={() => onChange(allVisibility(false))}>Disable all</button>
    </div>
    <button type="button" className="cmsit3d-reset" onClick={onResetCamera}>Reset camera</button>
    <div className="cmsit3d-control-title">Camera drag mode</div>
    <div className="cmsit3d-mode-switch" role="group" aria-label="Camera drag mode">
      <button
        type="button"
        className={cameraMode === 'rotate' ? 'active' : ''}
        onClick={() => onCameraModeChange('rotate')}
      >
        Rotate
      </button>
      <button
        type="button"
        className={cameraMode === 'pan' ? 'active' : ''}
        onClick={() => onCameraModeChange('pan')}
      >
        Move
      </button>
    </div>
    <label className="cmsit3d-beam-toggle">
      <CheckBox checked={beamPipeVisible} onChange={onBeamPipeVisibleChange} />
      <span>Show beam pipe</span>
    </label>
    <label className="cmsit3d-beam-toggle">
      <CheckBox checked={serviceCylinderVisible} onChange={onServiceCylinderVisibleChange} />
      <span>Show IT service cylinder</span>
    </label>
    {serviceCylinderVisible && <label className="cmsit3d-beam-toggle" style={{paddingLeft:"1.25rem"}}><CheckBox checked={hardwareDetails.cylinderLeft} onChange={on=>onHardwareDetailsChange({...hardwareDetails,cylinderLeft:on})}/><span>Left half (−X), both Z sides</span></label>}
    {serviceCylinderVisible && (
      <label className="cmsit3d-beam-toggle" style={{ paddingLeft: '1.25rem' }}>
        <CheckBox checked={!serviceCylinderCutaway} onChange={on=>onServiceCylinderCutawayChange(!on)} />
        <span>Right half (+X), both Z sides</span>
      </label>
    )}
    <label className="cmsit3d-beam-toggle">
      <CheckBox checked={servicesVisible} onChange={onServicesVisibleChange} />
      <span>Show auxiliary services</span>
    </label>

    <div className="cmsit3d-control-title">Module appearance</div>
    <div className="cmsit3d-mode-switch" role="group" aria-label="Module appearance">
      <button type="button" className={moduleAppearance === 'photos' ? 'active' : ''} onClick={() => onModuleAppearanceChange('photos')}>Modules</button>
      <button type="button" className={moduleAppearance === 'chips' ? 'active' : ''} onClick={() => onModuleAppearanceChange('chips')}>Chips</button>
    </div>
    <label className="cmsit3d-beam-toggle"><CheckBox checked={hardwareDetails.installedOnly} onChange={on=>{onHardwareDetailsChange({...hardwareDetails,installedOnly:on});if(on){onModuleAppearanceChange('photos');}}}/><span>Installed modules only</span></label>
    <label className="cmsit3d-beam-toggle"><CheckBox checked={hardwareDetails.connectedPortcardsOnly} onChange={on=>{onHardwareDetailsChange({...hardwareDetails,connectedPortcardsOnly:on});if(on){onPortcardsVisibleChange(true);}}}/><span>Connected portcards only</span></label>
    <label className="cmsit3d-beam-toggle"><CheckBox checked={portcardsVisible} onChange={onPortcardsVisibleChange} /><span>Portcards / cartridges</span></label>
    <label className="cmsit3d-beam-toggle"><CheckBox checked={antlersVisible} onChange={onAntlersVisibleChange} /><span>Service antlers</span></label>
    <details className="cmsit3d-group"><summary>Component controls</summary>
      {([['axisX','X axis (red)'],['axisY','Y axis (green)'],['axisZ','Z / beam axis (blue)'],['electrical','Module e-links / power flexes'],['tbpxCables','TBPX cooling / power services'],['exterior','Exterior cables / PP-2'],['tbpxPortcards','TBPX / TFPX portcards'],['tepxPortcards','TEPX portcards'],['cartridges','Cartridge backing trays'],['rails','TEPX service rails'],['mechanics','Disk / ladder supports']] as Array<[keyof HardwareDetails,string]>).map(([key,label])=><label className="cmsit3d-beam-toggle" key={key}><CheckBox checked={hardwareDetails[key]} onChange={on=>onHardwareDetailsChange({...hardwareDetails,[key]:on})}/><span>{label}</span></label>)}
    </details>
    {SUBDETECTORS.map(s=><VisibilityGroup key={s} subdetector={s} value={value} onChange={onChange} />)}
    <div className="cmsit3d-help">
      Drag to {cameraMode === 'rotate' ? 'rotate' : 'move camera'}<br />
      Scroll to zoom<br />
      Right-drag to {cameraMode === 'rotate' ? 'move camera' : 'rotate'}<br />
      Double-click to focus
    </div>
  </aside>
);

export function defaultVisibility(): VisibilityState {
  return allVisibility(true);
}
