/* V0911. Deterministic exposure and reduced beam-demand model.
   Length m, time year, q N/m, stress Pa. Strength/rates are illustrative,
   deliberately uncalibrated. No FEM, joints, inertia, collision or safety claim. */
function fieldDamageAt(t,years,seed,wet=1){
 const patch=.32+.68*noise2(t*3.7,2.1,seed+70);
 const moisture=clamp(wet*(.36+.64*patch));
 const dose=moisture*Math.max(0,years-.7);
 const damage=1-Math.exp(-dose*.19);
 return {moisture,dose,damage,loss:damage*.52};
}
function fieldBeamDemand(length,radius,years,seed,wet=1,load=1){
 let peak={ratio:0,t:.5,moment:0,stressPa:0,strengthPa:0,damage:0,loss:0};
 // Uniform simply supported beam. Candidate failure location maximizes sigma / strength.
 for(let i=3;i<=61;i++){
  const t=i/64,d=fieldDamageAt(t,years,seed,wet),r=radius*(1-d.loss);
  const q=1050*load,M=q*length*length*t*(1-t)/2;
  const stress=4*M/(Math.PI*r*r*r);
  const strength=3.4e6*(.72+.56*noise2(t*6,1.7,seed+93))*Math.exp(-d.damage*1.7);
  const ratio=stress/strength;
  if(ratio>peak.ratio)peak={ratio,t,moment:M,stressPa:stress,strengthPa:strength,...d};
 }
 return {...peak,failed:peak.ratio>=1,units:{moment:'N m',stress:'Pa'},calibrated:false};
}
function fieldTileDemand(kind,years,seed,wet=1,load=1){
 const p=PROFILE[kind],span=kind==='pan'?.22:.085,h=p.thickness,b=p.length;
 let peak={ratio:0,s:0,damage:0};
 // Strip bending proxy; curved shell/masonry load sharing remains unmodelled.
 for(let i=6;i<=58;i++){
  const t=i/64,d=fieldDamageAt(t,years,seed,wet),M=1100*load*b*span*span*t*(1-t)/2;
  const stress=6*M/(b*h*h),strength=1.0e6*(.70+.5*noise2(t*5,1.4,seed+32))*Math.exp(-d.damage*2.9);
  const ratio=stress/strength;
  if(ratio>peak.ratio)peak={ratio,s:t*2-1,damage:d.damage,stressPa:stress,strengthPa:strength,moisture:d.moisture};
 }
 return {...peak,failed:peak.ratio>=1,calibrated:false};
}
function fieldLife(row,col,kind,rows,cols,Y){
 const seed=state.seed+(kind==='cover'?7001:0),x=col/Math.max(1,cols-1),z=row/Math.max(1,rows-1);
 const patch=noise2(x*3.5,z*3.2,seed+315),exposure=clamp(.25+.50*patch+.22*(1-z));
 const maintained=state.care==='maintained',age=state.initialAge+Y;
 const risk=maintained?.02*(1-Math.exp(-Y/5)):(1-Math.exp(-Math.max(0,Y-.4)*(.08+.105*exposure)*state.rainInput));
 const threshold=.19+.5*hash01(row,col,seed,601),dam=risk>threshold?(risk>threshold+.20?2:1):0;
 const missing=!maintained&&risk>.64+.24*hash01(row,col,seed,641);
 return {age,install:0,generation:0,hazard:risk,missing,damageClass:dam,sag:risk*.03,water:missing?1:dam===2?.70:dam===1?.23:0,exposure,cluster:patch};
}
function fieldIntegrateTimber(rows,cols){
 const n=(cols+1)*rows,loss=new Float64Array(n),dose=new Float64Array(n),moisture=new Float64Array(n),stain=new Float64Array(n),repairs=new Uint16Array(n),beamLoss=new Float64Array(4*cols),beamWet=new Float64Array(4*cols),forced=new Uint8Array(rows*cols);
 const Y=clamp(state.year,0,15),dt=.25,steps=Math.ceil(Y/dt);let panStates=[];
 for(let k=1;k<=steps;k++){
  const y=Math.min(k*dt,Y),step=y-(k-1)*dt,rain=state.rainInput;
  panStates=Array.from({length:rows*cols},(_,i)=>fieldLife(Math.floor(i/cols),i%cols,'pan',rows,cols,y));
  const prev=moisture.slice();
  for(let c=0;c<=cols;c++)for(let r=0;r<rows;r++){
   const i=c*rows+r;let w=.0;
   for(const cc of [c-1,c])if(cc>=0&&cc<cols)w=Math.max(w,panStates[r*cols+cc].water);
   if(r<rows-1)w=Math.max(w,prev[i+1]*.35);
   const target=clamp(w*rain),e=Math.exp(-step/.45);
   const integrated=target*step+(moisture[i]-target)*.45*(1-e);
   moisture[i]=target+(moisture[i]-target)*e;dose[i]+=Math.max(0,integrated);
   const weak=.76+.5*noise2(c*.4,r*.24,state.seed+221);
   loss[i]=Math.min(.74,1-Math.exp(-dose[i]*.145*weak));stain[i]=clamp(1-Math.exp(-dose[i]*.48));
  }
  for(let b=0;b<4;b++)for(let c=0;c<cols;c++){
   const r=Math.round(b/3*(rows-1)),i=b*cols+c,m=(moisture[c*rows+r]+moisture[(c+1)*rows+r])*.5;
   const direct=panStates[r*cols+c].water;
   beamWet[i]+=(Math.max(m*.65,direct*.92)-beamWet[i])*(1-Math.exp(-step/.8));
   // Independent water dose, no multiplication by rafter loss.
   beamLoss[i]=Math.min(.65,1-(1-beamLoss[i])*Math.exp(-beamWet[i]*step*.145*(.80+.45*hash01(b,c,state.seed,876))));
  }
 }
 panStates=Array.from({length:rows*cols},(_,i)=>fieldLife(Math.floor(i/cols),i%cols,'pan',rows,cols,Y));
 for(let c=0;c<=cols;c++)for(let r=0;r<rows;r++)if(loss[c*rows+r]>.48)for(const cc of [c-1,c])if(cc>=0&&cc<cols)forced[r*cols+cc]=1;
 for(let i=0;i<panStates.length;i++)if(forced[i]){panStates[i].missing=true;panStates[i].reason='rafter material loss';}
 return {loss,dose,moisture,stain,repairs,beamLoss,panStates,hailHits:0,forced,fieldModel:true,clock:'years since maintenance stop',calibrated:false};
}
function fieldMergeRanges(ranges){
 const out=[];for(const a of ranges.map(([a,b])=>[clamp(a),clamp(b)]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0])){const last=out.at(-1);if(last&&a[0]<=last[1])last[1]=Math.max(last[1],a[1]);else out.push(a); }return out;
}
