/** Review-only logic kernels. Not a structural solver or a calibrated decay model. */
const finite=(v,n)=>{if(!Number.isFinite(v))throw new TypeError(n+' must be finite');return v;};
const unit=(v,n)=>{finite(v,n);if(v<0||v>1)throw new RangeError(n+' must be in [0,1]');return v;};
export function clocks({initialBuildingAge=25,elapsedYears=0,maintenanceStoppedAt=0,maintenanceRestoredAt=null,occupied=false}={}){
  for(const [k,v] of Object.entries({initialBuildingAge,elapsedYears,maintenanceStoppedAt}))if(finite(v,k)<0)throw new RangeError(k);
  if(typeof occupied!=='boolean')throw new TypeError('occupied');
  if(maintenanceRestoredAt!==null&&finite(maintenanceRestoredAt,'maintenanceRestoredAt')<maintenanceStoppedAt)throw new RangeError('maintenance order');
  return {buildingAge:initialBuildingAge+elapsedYears,elapsedYears,
    pastUnmaintainedYears:Math.max(0,Math.min(elapsedYears,maintenanceRestoredAt??elapsedYears)-maintenanceStoppedAt),
    currentlyMaintained:elapsedYears<maintenanceStoppedAt||(maintenanceRestoredAt!==null&&elapsedYears>=maintenanceRestoredAt),
    occupied};
}
/** Constant environment on this interval; integrate wetness exactly.
 * wetness/damage are dimensionless display state, never measured moisture or strength.
 * Restoration/drying does not reset existing damage. Only an explicit replacement may.
 */
export function integrateExposure({wetness,damage},dt,{targetWetness,tauYears,ratePerWetYear}){
  unit(wetness,'wetness');unit(damage,'damage');unit(targetWetness,'targetWetness');
  if(finite(dt,'dt')<0||finite(tauYears,'tauYears')<=0||finite(ratePerWetYear,'rate')<0)throw new RangeError('interval parameters');
  const e=Math.exp(-dt/tauYears);
  const integratedWetness=targetWetness*dt+(wetness-targetWetness)*tauYears*(-Math.expm1(-dt/tauYears));
  return {wetness:targetWetness+(wetness-targetWetness)*e,
    damage:1-(1-damage)*Math.exp(-ratePerWetYear*Math.max(0,integratedWetness)),integratedWetness};
}
/** A directed support-graph closure, not contact or load analysis.
 * 'detached' is an event for future fragment handling, never a suspended mesh.
 * A supported label remains a topology candidate until geometric/load checks pass.
 */
export function supportClosure(nodes,failedIds=[]){
  const byId=new Map();for(const n of nodes){if(!n.id||byId.has(n.id))throw new Error('duplicate/empty id');byId.set(n.id,n);}
  const failed=new Set(failedIds);for(const id of failed)if(!byId.has(id))throw new Error('unknown failed id');
  const result=new Map(),visiting=new Set();
  function visit(id){
    if(result.has(id))return result.get(id);
    if(visiting.has(id))throw new Error('support cycle');const n=byId.get(id);if(!n)throw new Error('unknown support '+id);
    visiting.add(id);
    const supports=n.supports??[];
    if(new Set(supports).size!==supports.length)throw new Error('duplicate support');
    const states=supports.map(visit);visiting.delete(id);
    if(!n.anchor&&(!Number.isInteger(n.minSupports)||n.minSupports<1||n.minSupports>supports.length))throw new Error('invalid support contract');
    if(n.anchor&&supports.length)throw new Error('anchor cannot depend on another node');
    const live=states.filter(s=>s.status==='supported').length;
    const status=failed.has(id)?'failed':n.anchor||live>=n.minSupports?'supported':'detached';
    const record={id,status,liveSupports:live,cause:status==='failed'?'own_material_failure':status==='detached'?'support_loss':null};result.set(id,record);return record;
  }
  nodes.forEach(n=>visit(n.id));return nodes.map(n=>result.get(n.id));
}
