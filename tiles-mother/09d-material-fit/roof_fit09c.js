// Fit the existing tile/rafter assembly to a declared source rafter-top line.
// Tile lengths remain unchanged; longitudinal overlap is solved for the run.
const SOURCE_FIT_CACHE09C=new Map();
function fitSourceRoof09C(run,makeRoof,workshop){
 const oldSet=STUDY.set;STUDY.set=run.set||'L9';
 try{
  const from=run.from,to=run.to,dx=to[0]-from[0],dz=to[2]-from[2],span=Math.hypot(dx,dz);if(span<.001)throw Error('Zero source roof span '+run.id);
  const b=(to[1]-from[1])/span,dir=[dx/span,dz/span],p=spec(),base=roofSeats();let seat=base,step=base.step,S=0,A=1,rows=2;
  const key=[STUDY.set,STUDY.datum,settings.micStrength,settings.micScale,span.toFixed(8),b.toFixed(8)].join('/'),cached=SOURCE_FIT_CACHE09C.get(key);
  if(cached){step=cached.step;rows=cached.rows;}else for(let k=0;k<4;k++){
   const s=seat.rise/seat.step;S=Math.atan(b)-Math.atan(s);A=Math.cos(S)-Math.sin(S)*s;
   if(k===0)rows=Math.max(2,Math.ceil((span/A-p.pan.l)/base.step)+1);
   let next=Math.max(.045,(span/A-p.pan.l)/(rows-1));
   if(Math.abs(next-step)<.000003)break;step=next;
   const pan=shellMesh('pan'),pm=M.rx(base.panAngle),lap=contact(pan,pm,pan,M.mul(M.translate(0,0,step),pm));
   seat={...base,step,rise:-lap.minGapM+.00005};
  }
  seat=roofSeats(step);
  SOURCE_FIT_CACHE09C.set(key,{step,rows});
  const s=seat.rise/seat.step,total=(rows-1)*seat.step+p.pan.l;S=Math.atan(b)-Math.atan(s);A=Math.cos(S)-Math.sin(S)*s;
  const c=.024+s*total/2,ctop=c+.024*Math.sqrt(1+s*s),rootAlong=span/2+Math.sin(S)*c;
  const root=model(from[0]+dir[0]*rootAlong,from[1]+b*rootAlong-ctop/A,from[2]+dir[1]*rootAlong,0,Math.atan2(dir[0],dir[1]));
  const cols=Math.max(2,Math.round((run.width_m||.8)/seat.spacing));
  const first=workshop.records.length;makeRoof(cols,rows,!!run.withEnds,root,S,false,seat.step);
  const rafter=workshop.records.slice(first).find(q=>q.id.startsWith('roof-rafter-')),center=rafter?M.transform(rafter.m,[0,0,0]):null,n=[-dir[0]*b,1,-dir[1]*b].map(x=>x/Math.sqrt(1+b*b));
  const bearings=(run.purlins||[]).map(q=>({center:q.center,gap_m:center?n.reduce((sum,x,i)=>sum+x*(center[i]-q.center[i]),0)-q.radius-.024:null}));
  (workshop.definition.sourceRoofFits||(workshop.definition.sourceRoofFits=[])).push({id:run.id,source:run.source,datum:run.datum,from,to,rows,cols,step_m:seat.step,tile_length_m:p.pan.l,width_m:cols*seat.spacing,requested_width_m:run.width_m,actual_horizontal_span_m:A*total,endpoint_error_m:Math.abs(A*total-span)/2,rafter_top_line_slope:b,roof_contact:seat.coverLap.pass&&seat.panLap.pass,purlin_rafter_bearings:bearings,bearing_scope:'transformed nominal axes and radii; timber surface displacement excluded',unmeasured:'transverse extent and source diagram error remain separate from numeric fit'});
 }finally{STUDY.set=oldSet;}
}
