import {InstalledPortcard} from '../data/portcards';
import React, { useMemo, useState } from 'react';
import { InventoryModule, locationLabel, inventoryGroupLabel } from '../data/inventory';
import { ModuleDescriptor } from '../types';
export const InventoryPane=({entries,issues,onClose,onFocus,portcards=[]}:{entries:InventoryModule[];portcards?:InstalledPortcard[];issues:string[];onClose:()=>void;onFocus:(module:ModuleDescriptor)=>void})=>{
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('installed');
  const groups=useMemo(()=>{
    const groups=new Map<string,InventoryModule[]>();
    entries.filter(e=>(filter==='installed'?e.installed:e.hasData) && `${e.serial} ${locationLabel(e.module)}`.toLowerCase().includes(search.toLowerCase())).forEach(e=>{
      const key=inventoryGroupLabel(e.module);groups.set(key,[...(groups.get(key)??[]),e]);
    });return [...groups];
  },[entries,search,filter]);
  return <aside className="cmsit3d-inventory" aria-label="Module inventory">
    <div className="cmsit3d-inventory-heading"><strong>Module inventory</strong><button onClick={onClose} aria-label="Close module inventory">×</button></div>
    <p>{entries.filter(e=>e.installed).length} installed · {entries.filter(e=>e.hasData).length} with data</p>
    <input aria-label="Search module inventory" placeholder="Search serial or location" value={search} onChange={e=>setSearch(e.target.value)}/>
    <select aria-label="Filter module inventory" value={filter} onChange={e=>setFilter(e.target.value)}><option value="installed">Installed</option><option value="data">Data in selected range</option></select>
    <p className="cmsit3d-inventory-note">Modules listed in the YAML are installed. Data availability refers to the selected time range. Select a module to reveal and focus it.</p>
    <details><summary>Portcards ({portcards.filter(c=>c.connections.length>0).length} connected)</summary>
      {portcards.length===0 && <p>No portcard IDs mapped yet.</p>}
      {portcards.map(card=><details key={card.id}><summary>{card.id} · {card.connections.length} module(s)</summary><small>{card.slot.id}</small>
        {card.connections.map(link=><button key={link.module.id} onClick={()=>onFocus(link.module)}>{link.serial} · lpGBT {link.lpgbt}</button>)}
      </details>)}
    </details>
    {issues.length>0 && <details open className="cmsit3d-inventory-issues"><summary>{issues.length} mapping issue(s)</summary>{issues.map((issue,i)=><p key={i}>{issue}</p>)}</details>}
    {groups.length===0 && <p>No modules match. Add valid placements to the YAML mapping, regenerate it, then rebuild the plugin.</p>}
    {groups.map(([name,items])=><details key={name} open><summary>{name} <small>({items.length})</small></summary>{items.map(e=><button className="cmsit3d-inventory-row" key={e.module.id} onClick={()=>onFocus(e.module)}>
      <strong>{e.serial}</strong><span>{locationLabel(e.module).replace(inventoryGroupLabel(e.module)+' / ', '')}</span>
      <span>{e.installed?'● Installed':'Not in installation YAML'}</span>
      <span>{e.hasData?'Data in selected range':'No data in selected range'} · {e.chips} mapped chips</span>
    </button>)}</details>)}
  </aside>;
};
