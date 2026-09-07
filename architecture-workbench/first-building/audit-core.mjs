// Project-specific geometric checks. Passing never certifies historical or structural safety.
export const AUDIT_VERSION='0.1.0';
const num=(n,label)=>{if(typeof n!=='number'||!Number.isFinite(n))throw Error(label+' must be finite');return n;};
export function chainCheck(parts,total,tolerance=1e-8){
 if(!Array.isArray(parts)||!parts.length)throw Error('empty dimension chain');
 num(total,'total');num(tolerance,'tolerance');if(total<=0||tolerance<0)throw Error('invalid total or tolerance');
 for(const n of parts)if(num(n,'dimension')<=0)throw Error('non-positive dimension');
 const sum=parts.reduce((a,b)=>a+b,0),residual=sum-total;
 return {status:Math.abs(residual)<=tolerance?'pass':'fail',sum,total,residual,unit:'m',meaning:'arithmetic_consistency_only'};
}
export function axisCheck(axes,spans){
 if(!Array.isArray(axes)||!Array.isArray(spans)||!spans.length||axes.length!==spans.length+1)throw Error('axis count mismatch');
 axes.forEach(x=>num(x,'axis'));spans.forEach(x=>num(x,'span'));
 const errors=spans.map((s,i)=>axes[i+1]-axes[i]-s);
 return {status:axes.every((x,i)=>i===0||x>axes[i-1])&&spans.every(x=>x>0)&&errors.every(x=>Math.abs(x)<1e-8)?'pass':'fail',errors,meaning:'axis_consistency_only'};
}
function heightAt(x,z,tri){
 const [a,b,c]=tri;const det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
 if(Math.abs(det)<1e-12)return null;
 const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det;
 const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det,w=1-u-v;
 return Math.min(u,v,w)>=-1e-7?u*a[1]+v*b[1]+w*c[1]:null;
}
export function envelopeCheck(points,triangles,{unit='m',toleranceM=.01,termination='under-roof'}={}){
 if(unit!=='m'||termination!=='under-roof')throw Error('unsupported units or termination; declare a separate case rule');
 num(toleranceM,'tolerance');if(toleranceM<0)throw Error('negative tolerance');
 if(!Array.isArray(points)||!Array.isArray(triangles))throw Error('invalid geometry');
 for(const p of [...points,...triangles.flat()]){if(!Array.isArray(p)||p.length!==3)throw Error('invalid vertex');p.forEach(x=>num(x,'vertex'));}
 if(!points.length||!triangles.length)return {status:'unknown',reason:'missing_actual_geometry',samples:[]};
 const samples=points.map(p=>{const hits=triangles.map(t=>heightAt(p[0],p[2],t)).filter(y=>y!==null);const lower=hits.length?Math.min(...hits):null;return {point:p,roofLowerY:lower,excessM:lower===null?null:p[1]-lower};});
 const maxExcessM=Math.max(...samples.map(x=>x.excessM??-Infinity));
 return {status:maxExcessM>toleranceM?'fail':samples.some(s=>s.roofLowerY===null)?'unknown':'pass',maxExcessM:Number.isFinite(maxExcessM)?maxExcessM:null,uncovered:samples.filter(s=>s.roofLowerY===null).length,samples,unit,toleranceM,scope:'sampled_vertices_against_actual_roof_mesh_not_full_collision_or_safety_certificate'};
}
export function drainageEvidence(declared,actual){
 // A boolean, target name or empty test packet cannot prove a drainage route.
 if(!actual||!Array.isArray(actual.samples)||actual.samples.length===0)return {status:'unknown',declared,reason:'no_complete_independent_flow_evidence'};
 return {status:'pending',declared,reason:'flow_paths_require_case_specific_geometry_and_outfall_review'};
}
export function releaseDecision(checks,{primarySourcesVerified=false,historicalIdentityVerified=false,userVisualRecord=null,userProductionRecord=null}={}){
 if(!Array.isArray(checks)||!checks.length)throw Error('missing checks');
 const blockers=checks.filter(c=>c.status!=='pass').length;
 return {technicalEligible:blockers===0&&primarySourcesVerified===true&&historicalIdentityVerified===true,visualApproved:false,productionApproved:false,blockers,reason:'advisory_auditor_cannot_grant_user_approval',userRecordsSupplied:Boolean(userVisualRecord||userProductionRecord)};
}
