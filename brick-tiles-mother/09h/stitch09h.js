const STITCH_MESH09H=new WeakMap(),STITCH_SOLVE09H=new Map();
function stitchMesh09H(g,step=8){
 let cache=STITCH_MESH09H.get(g);if(!cache){cache=new Map();STITCH_MESH09H.set(g,cache)}if(cache.has(step))return cache.get(step);
 const count=g.p.length/3,n=Math.round((-64+Math.sqrt(4096-8*(62-count)))/4),axis=Array.from({length:Math.ceil(n/step)+1},(_,i)=>Math.min(n,i*step)),zs=g.definition.kind==='cover'?Array.from({length:n+1},(_,i)=>i):axis,idx=[];
 for(let side=0;side<2;side++)for(let a=0;a<zs.length-1;a++)for(let b=0;b<axis.length-1;b++){let o=side*(n+1)*(n+1),i=o+zs[a]*(n+1)+axis[b],j=o+zs[a]*(n+1)+axis[b+1],k=o+zs[a+1]*(n+1)+axis[b],l=o+zs[a+1]*(n+1)+axis[b+1];idx.push(i,j,k,j,l,k)}idx.push(...g.idx.slice(12*n*n));let out={...g,idx:new Uint32Array(idx)};cache.set(step,out);return out;
}
function solveBridge09H(g,previous,current,next){
 let key='bridge2/'+JSON.stringify([g.definition.kind,settings.micStrength,settings.micScale,...previous,...current,...next]);if(STITCH_SOLVE09H.has(key)){let q=STITCH_SOLVE09H.get(key),r=Array.isArray(q.residual)?q.residual:[q.residual];if(r.every(x=>typeof x==='number'&&Number.isFinite(x))&&Math.max(...r.map(Math.abs))<.0009)return q;}
 let mesh=stitchMesh09H(g),evaluate=angle=>{let m=M.mul(current,M.rx(angle)),low=contact(mesh,previous,mesh,m),high=contact(mesh,m,mesh,next);return {angle,dy:-low.minGapM+.00008,residual:low.minGapM+high.minGapM-.00016,low,high,m}};
 let samples=[];for(let k=0;k<=16;k++){let q=evaluate(-.4+k*.05);if(Number.isFinite(q.residual))samples.push(q)}let roots=[];
 for(let j=1;j<samples.length;j++){let a=samples[j-1],b=samples[j];if(a.residual*b.residual>0)continue;for(let k=0;k<12;k++){let q=evaluate((a.angle+b.angle)/2);if(a.residual*q.residual<=0)b=q;else a=q;}roots.push(evaluate((a.angle+b.angle)/2))}
 let chosen=roots.sort((a,b)=>Math.abs(a.angle)-Math.abs(b.angle))[0]||samples.sort((a,b)=>Math.abs(a.residual)-Math.abs(b.residual))[0];if(!chosen)return null;
 let best=null;for(let k=0;k<10;k++){let m=M.mul(current,M.rx(chosen.angle)),low=contact(g,previous,g,m),high=contact(g,m,g,next),residual=low.minGapM+high.minGapM-.00016;if(!Number.isFinite(residual))break;chosen={angle:chosen.angle,dy:-low.minGapM+.00008,residual};if(!best||Math.abs(residual)<Math.abs(best.residual))best={...chosen};if(Math.abs(residual)<.000015||k===9)break;let delta=.001,mt=M.mul(current,M.rx(chosen.angle+delta)),rt=contact(g,previous,g,mt).minGapM+contact(g,mt,g,next).minGapM-.00016,slope=(rt-residual)/delta;if(!Number.isFinite(slope)||Math.abs(slope)<.001)break;chosen.angle-=clamp(residual/slope,-.03,.03);}
 chosen=best||chosen;STITCH_SOLVE09H.set(key,chosen);return chosen;
}
function stitchSourceRoofs09H(workshop){
 let fits=workshop.definition.sourceRoofFits||[],result=[];
 for(let j=1;j<fits.length;j++){
  let a=fits[j-1],b=fits[j],aj=j-1,bj=j;if(a.id.split('-roof-run-')[0]!==b.id.split('-roof-run-')[0]||(a.to[0]-a.from[0])*(b.to[0]-b.from[0])<0)continue;if(a.from[1]+a.to[1]>b.from[1]+b.to[1]){[a,b]=[b,a];[aj,bj]=[bj,aj]}
  let pa=workshop.groups.get('panL9-run-'+aj),pb=workshop.groups.get('panL9-run-'+bj),ca=workshop.groups.get('coverL9-run-'+aj),cb=workshop.groups.get('coverL9-run-'+bj);if(!pa||!pb||!ca||!cb||b.rows<2)continue;
  let foldKey='fold5/'+JSON.stringify([STUDY.id,aj,bj,pa.mesh.definition.set,STUDY.datum,settings.micStrength,settings.micScale,a.rows,b.rows,...pa.items[a.rows-1].m,...pb.items[0].m,...pb.items[1].m,...ca.items[a.rows-1].m,...cb.items[0].m,...cb.items[1].m]),chosen=STITCH_SOLVE09H.get(foldKey),candidates=[];if(chosen&&(!Number.isFinite(chosen.score)||chosen.score>=.001))chosen=null;if(!chosen){for(let shift of [0,-.03,.03,-.06,.06,-.10,.10,-.015,.015]){
   let original=M.mul(pb.items[0].m,M.translate(0,0,shift)),ps=solveBridge09H(pb.mesh,pa.items[a.rows-1].m,original,pb.items[1].m);if(!ps){if(typeof process!=='undefined')console.log('no pan candidate',STUDY.id,aj,bj,shift);continue;}
   let pm=[0,1].map(c=>{let m=M.mul(M.mul(pb.items[c*b.rows].m,M.translate(0,0,shift)),M.rx(ps.angle));m[13]+=ps.dy;return [m,pa.items[c*a.rows+a.rows-1].m,pb.items[c*b.rows+1].m]});
   let cs=solveCoverBridge09H(cb.mesh,ca.items[a.rows-1].m,cb.items[0].m,cb.items[1].m,pb.mesh,pm,ps);if(cs.fitError>.0009){let ci=solveBridge09H(cb.mesh,ca.items[a.rows-1].m,cb.items[0].m,cb.items[1].m);if(ci){let alt=solveCoverBridge09H(cb.mesh,ca.items[a.rows-1].m,cb.items[0].m,cb.items[1].m,pb.mesh,pm,{...ci,phase:0});if(alt.fitError<cs.fitError)cs=alt;}}if(cs.fitError>.0009){let alt=solveCoverBridge09H(cb.mesh,ca.items[a.rows-1].m,cb.items[0].m,cb.items[1].m,pb.mesh,pm,{angle:.22,phase:-.013,skipCoarse:true});if(alt.fitError<cs.fitError)cs=alt;}if(cs.fitError>.0009){let alt=solveCoverBridge09H(cb.mesh,ca.items[a.rows-1].m,cb.items[0].m,cb.items[1].m,pb.mesh,pm,{angle:cs.angle,phase:cs.shift,roll:cs.roll,skipCoarse:true,skipApprox:true,uniform:true});if(alt.fitError<cs.fitError)cs=alt;}let score=Math.max(Math.abs(ps.residual),cs.fitError);candidates.push({shift,ps,cs,score});if(typeof process!=='undefined')console.log('candidate',STUDY.id,aj,bj,shift,score,ps.residual,cs.residual);if(score<.0009)break;
  }
  chosen=candidates.sort((a,b)=>a.score-b.score)[0];if(chosen&&Number.isFinite(chosen.score)&&chosen.score<.001)STITCH_SOLVE09H.set(foldKey,chosen);}if(!chosen)continue;let {shift,ps,cs}=chosen;
  for(let c=0;c<pb.items.length/b.rows;c++){let it=pb.items[c*b.rows];it.supportRole09H='lap_bridge';it.m=M.mul(M.mul(it.m,M.translate(0,0,shift)),M.rx(ps.angle));it.m[13]+=ps.dy;}
  for(let c=0;c<cb.items.length/b.rows;c++){let it=cb.items[c*b.rows];it.m=M.mul(it.m,M.mul(M.translate(cs.lateral||0,0,cs.shift),M.mul(M.rz(cs.roll),M.rx(cs.angle))));it.m[13]+=cs.dy;}
  b.roof_contact_scope='nominal double-rafter fit for unmodified rows; first row uses explicit fold overlap connections';b.fold_first_row_support='adjacent tile overlap';
  result.push({runs:[aj,bj],pan:ps,panShift:shift,cover:cs,score:chosen.score});if(typeof process!=='undefined')console.log('fold',STUDY.id,aj,bj,chosen.score);
 }
 for(let f of result){let [aj,bj]=f.runs,a=fits[aj],b=fits[bj],link=(from,to,kind,gap)=>workshop.connections.push({a:from,b:to,kind,contact_region:'fold roof surfaces',tolerance_m:.001,gap_m:gap??null,validated:Number.isFinite(gap)&&Math.abs(gap)<.001});
  for(let kind of ['pan','cover']){let id=kind+'L9-run-'+bj,group=workshop.groups.get(id);for(let c=0;c<group.items.length/b.rows;c++){let index=c*b.rows,key=id+'#'+(index+1),record=workshop.records.find(r=>r.id===key);if(record)record.m=Array.from(group.items[index].m);let gaps=kind==='pan'?[.00008,f.pan.residual+.00008]:f.cover.contactGaps;
   link(key,kind+'L9-run-'+aj+'#'+((c+1)*a.rows),'overlaps_lower_tile',gaps?.[0]);link(key,id+'#'+(index+2),'overlapped_by_next_tile',gaps?.[1]);
   if(kind==='cover'&&f.cover.supportRows)for(let side=0;side<2;side++){let choice=f.cover.supportRows[side],col=c+side,target=choice===1?'panL9-run-'+aj+'#'+((col+1)*a.rows):'panL9-run-'+bj+'#'+(col*b.rows+(choice===2?2:1));link(key,target,'bears_on_pan',gaps?.[side+2]);}
  }}
 }
 workshop.definition.foldBridges=result;
}
function linear3_09H(A,b){let m=A.map((a,i)=>[...a,b[i]]);for(let i=0;i<3;i++){let row=i;for(let j=i+1;j<3;j++)if(Math.abs(m[j][i])>Math.abs(m[row][i]))row=j;[m[i],m[row]]=[m[row],m[i]];if(Math.abs(m[i][i])<1e-9)return null;let d=m[i][i];for(let k=i;k<4;k++)m[i][k]/=d;for(let j=0;j<3;j++)if(j!==i){let q=m[j][i];for(let k=i;k<4;k++)m[j][k]-=q*m[i][k]}}return m.map(r=>r[3]);}
function balanceCoverFit09H(q){
 if(!q?.coverSideGaps?.every(x=>typeof x==='number'&&Number.isFinite(x))||!q.residual?.every(x=>typeof x==='number'&&Number.isFinite(x)))return {...q,fitError:Infinity};
 let low=q.coverSideGaps[0]+q.residual[1],high=q.residual[0]+.00016-low,targets=[-low,...q.coverSideGaps.map(x=>-x),high],dy=(Math.min(...targets)+Math.max(...targets))/2,gaps=[low+dy,high-dy,...q.coverSideGaps.map(x=>x+dy)];
 return {...q,dy,contactGaps:gaps,fitError:Math.max(...gaps.map(Math.abs)),fitMethod:'bounded minimax vertical placement; signed actual surface gaps'};
}
function polishCoverFit09H(evaluate,start){
 const bound=v=>v.map((x,i)=>clamp(x,i===0?-.5:i===1?-.14:-.1,i===0?.5:i===1?.14:.1)),sample=v=>{v=bound(v);let q=evaluate(v,'exact'),t=[-q.low,-q.sides[0],-q.sides[1],q.high],error=t.every(Number.isFinite)?(Math.max(...t)-Math.min(...t))/2:Infinity;return{v,q,error}};
 let simplex=[sample(start),...start.map((_,i)=>sample(start.map((x,j)=>x+(i===j?[.008,.003,.008][i]:0))))];
 for(let k=0;k<40;k++){simplex.sort((a,b)=>a.error-b.error);if(simplex[0].error<.0008)break;let center=[0,1,2].map(i=>(simplex[0].v[i]+simplex[1].v[i]+simplex[2].v[i])/3),worst=simplex[3],reflect=sample(center.map((x,i)=>2*x-worst.v[i]));
  if(reflect.error<simplex[0].error){let expand=sample(center.map((x,i)=>x+2*(reflect.v[i]-x)));simplex[3]=expand.error<reflect.error?expand:reflect;}
  else if(reflect.error<simplex[2].error)simplex[3]=reflect;
  else {let outside=reflect.error<worst.error,target=outside?reflect:worst,contract=sample(center.map((x,i)=>x+.5*(target.v[i]-x)));if(contract.error<(outside?reflect.error:worst.error))simplex[3]=contract;else for(let i=1;i<4;i++)simplex[i]=sample(simplex[i].v.map((x,j)=>(x+simplex[0].v[j])/2));}
 }
 return simplex.sort((a,b)=>a.error-b.error)[0];
}
function solveCoverBridge09H(g,previous,current,next,pan,pans,initial){
 let key='cover-side4/'+JSON.stringify([initial.angle,initial.phase??-.04,!!initial.skipCoarse,settings.micStrength,settings.micScale,...previous,...current,...next,...pans.flat(1).flatMap(m=>Array.from(m))]);if(initial.x)key+='x'+initial.x;if(initial.roll)key+='r'+initial.roll;if(STITCH_SOLVE09H.has(key)){let q=balanceCoverFit09H(STITCH_SOLVE09H.get(key));if(q.fitError<.0009)return q;}
 const evaluate=(v,full=false)=>{let a=full==='exact'?g:stitchMesh09H(g,full?2:8),b=full==='exact'?pan:stitchMesh09H(pan,full?2:8),m=M.mul(current,M.mul(M.translate(initial.x||0,0,v[1]),M.mul(M.rz(v[2]),M.rx(v[0])))),low=contact(a,previous,a,m).minGapM,high=contact(a,m,a,next).minGapM,sideContacts=pans.map(ps=>ps.map(p=>contact(b,p,a,m).minGapM)),sides=sideContacts.map(xs=>Math.min(...xs)),supportRows=sideContacts.map(xs=>xs.indexOf(Math.min(...xs)));return{v,m,low,high,sides,supportRows,r:[low+high-.00016,low-sides[0],low-sides[1]]}};
 let v=[initial.angle,initial.phase??-.04,initial.roll||0],q;
 for(let full of [false,true,'exact']){if((!full&&initial.skipCoarse)||(full===true&&initial.skipApprox))continue;for(let k=0;k<(full==='exact'?8:24);k++){
 q=evaluate(v,full);let norm=r=>r.every(Number.isFinite)?r.reduce((s,x)=>s+x*x,0):Infinity,old=norm(q.r);if(!Number.isFinite(old)||Math.max(...q.r.map(Math.abs))<.00002)break;
 let eps=full==='exact'?.00005:full?.0005:.002,J=[[],[],[]];for(let j=0;j<3;j++){let x=v.slice();x[j]+=eps;let t=evaluate(x,full);for(let i=0;i<3;i++)J[i][j]=(t.r[i]-q.r[i])/eps;}
 let d=linear3_09H(J,q.r.map(x=>-x));if(!d)break;if(initial.uniform){let factor=Math.min(1,...d.map((x,i)=>(i===1?.025:.06)/Math.max(1e-12,Math.abs(x))));d=d.map(x=>x*factor);}let best=null;if(initial.debug&&typeof process!=='undefined')console.log('iteration',full,k,v,q.r,d);
 for(let alpha of [1,.5,.25,.125,.0625,.03125]){let x=v.map((z,i)=>clamp(z+alpha*clamp(d[i],i===1?-.025:-.06,i===1?.025:.06),i===0?-.5:i===1?-.14:-.1,i===0?.5:i===1?.14:.1)),t=evaluate(x,full),n=norm(t.r);if(n<old){best={x,n};break;}}
 if(!best)break;v=best.x;
 }}
 q=evaluate(v,'exact');let makeResult=()=>balanceCoverFit09H({lateral:initial.x||0,angle:v[0],shift:v[1],roll:v[2],dy:0,residual:q.r,coverSideGaps:q.sides,supportRows:q.supportRows}),result=makeResult();if(result.fitError>.0009&&result.fitError<.01){let polished=polishCoverFit09H(evaluate,v);if(polished.error<result.fitError){v=polished.v;q=polished.q;result=makeResult();}}STITCH_SOLVE09H.set(key,result);return result;
}
