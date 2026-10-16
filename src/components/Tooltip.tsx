import React from 'react';
import { HoveredModule } from '../types';
import { MM_PER_UNIT } from '../geometry/config';

export const Tooltip = ({ hovered }: { hovered?: HoveredModule }) => {
  if (!hovered) {
    return null;
  }
  const { module, measurement, chipIndex, chipMeasurement } = hovered;
  const region = module.subdetector === 'TBPX'
    ? `Layer ${module.layer}, ladder ${module.ladder}, ${module.zSide}`
    : `${module.side}, Disk ${module.disk}, Ring ${module.ring}, ${
      module.half === 'upper' ? 'right half' : 'left half'
    }`;

  return (
    <div
      className="cmsit3d-tooltip"
      style={{ left: hovered.clientX + 14, top: hovered.clientY + 14 }}
    >
      <strong>{module.subdetector}</strong>
      <span>{region}</span>
      <span>Module {module.moduleIndex} ({module.moduleType})</span>
      <span>r = {(Math.hypot(module.position[0], module.position[1]) * MM_PER_UNIT).toFixed(1)} mm · z = {(module.position[2] * MM_PER_UNIT).toFixed(1)} mm</span>
      {chipIndex !== undefined && <span>Chip {chipIndex}</span>}
      {measurement?.moduleId && <span>Module ID: {measurement.moduleId}</span>}
      {chipMeasurement?.efuse && <span>eFuse: {chipMeasurement.efuse}</span>}
      {module.diskSurface && <span>Disk surface: {module.diskSurface}</span>}
      {chipMeasurement || measurement ? (
        <>
          <hr />
          <strong>
            {(chipMeasurement?.value ?? measurement!.value).toFixed(2)}
            {(chipMeasurement?.unit ?? measurement?.unit)
              ? ` ${chipMeasurement?.unit ?? measurement?.unit}`
              : ''}
          </strong>
          {(chipMeasurement?.register ?? measurement?.register)
            && <span>{chipMeasurement?.register ?? measurement?.register}</span>}
          {measurement && (
            <>
              <span>{measurement.chipCount} chip value{measurement.chipCount === 1 ? '' : 's'}</span>
            </>
          )}
          <small>Click to open module details</small>
        </>
      ) : (
        <>
          <hr />
          <span>No live data</span>
        </>
      )}
    </div>
  );
};
