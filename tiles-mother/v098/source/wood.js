/* Timber: longitudinal UV seam, separate end-grain UVs, outward triangles.
   Damage rates are explicit illustration parameters, not surveyed service life. */
const TIMBER={rafterRadius:.040,beamRadius:.069,beamCount:4};
function woodGeometry(length,segments,seed,radius=.04,sampler=()=>({loss:0,y:0}),breakRanges=[]){
  const radial=24,pos=[],uv=[],col=[],idx=[],faces=[],rings=[];
  const cuts=new Set(Array.from({length:segments+1},(_,j)=>j/segments));
  for(const [a,b] of breakRanges){cuts.add(clamp(a));cuts.add(clamp(b));}
  const ts=[...cuts].sort((a,b)=>a-b);
  const colorAt=(loss,stain,t)=>{const n=(noise2(t*4.3,1,seed)-.5)*.04;return new THREE.Color().setRGB(clamp(lerp(.27,.047,clamp(stain))+n),clamp(lerp(.176,.047,clamp(stain))+n*.7),clamp(lerp(.091,.044,clamp(stain))+n*.3));};
  for(const t of ts){const s=sampler(t),r=radius*(1-clamp(s.loss,0,.86)),z=(t-.5)*length,ring=[];for(let i=0;i<=radial;i++){const angle=(i%radial)/radial*Math.PI*2;
    // Fine furrows stay inward; seam endpoints are exactly coincident.
    const grooves=(.00018+clamp(s.loss)*.0008)*(.5+.5*Math.sin(angle*11+seed*.03+Math.sin(t*6)*.12));
    const rr=Math.max(.004,r-grooves),x=Math.cos(angle)*rr,y=Math.sin(angle)*rr+(s.y||0),n=pos.length/3;
    pos.push(x,y,z);uv.push(i/radial,t);const c=colorAt(s.loss,s.stain??s.loss,t);col.push(c.r,c.g,c.b);ring.push(n);
  }rings.push(ring);}
  const disabled=t=>breakRanges.some(([a,b])=>t>a+1e-9&&t<b-1e-9);
  const alive=[];const start=idx.length;for(let j=0;j<ts.length-1;j++){alive[j]=!disabled((ts[j]+ts[j+1])*.5);if(!alive[j])continue;for(let i=0;i<radial;i++){const a=rings[j][i],b=rings[j][i+1],c=rings[j+1][i],d=rings[j+1][i+1];idx.push(a,b,c,b,d,c);}}
  faces.push({name:'side',start,count:idx.length-start});
  function cap(j,end,broken){const t=ts[j],s=sampler(t),z=(t-.5)*length,offset=idx.length,center=pos.length/3,r=radius*(1-clamp(s.loss,0,.86));pos.push(0,s.y||0,z);uv.push(.5,.5);const cc=colorAt(s.loss,clamp((s.stain??s.loss)*.65),t);col.push(cc.r,cc.g,cc.b);const rim=[];
    for(let i=0;i<radial;i++){const k=rings[j][i]*3,n=pos.length/3;const zz=pos[k+2];pos.push(pos[k],pos[k+1],zz);uv.push(.5+(end?1:-1)*pos[k]/(radius*2),.5+(pos[k+1]-(s.y||0))/(radius*2));col.push(cc.r,cc.g,cc.b);rim.push(n);}
    for(let i=0;i<radial;i++){const a=rim[i],b=rim[(i+1)%radial];end?idx.push(center,a,b):idx.push(center,b,a);}faces.push({name:end?'end':'start',broken,start:offset,count:idx.length-offset});}
  for(let j=0;j<ts.length-1;j++)if(alive[j]){if(j===0||!alive[j-1])cap(j,false,j>0);if(j===ts.length-2||!alive[j+1])cap(j+1,true,j<ts.length-2);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();g.clearGroups();faces.forEach(f=>g.addGroup(f.start,f.count,f.name==='side'?0:1));g.computeBoundingBox();g.computeBoundingSphere();g.userData={kind:'round-timber',length,radius,radial,segments:ts.length-1,surfaces:faces,breakRanges,centreLine:ts.map(t=>[(t-.5)*length,sampler(t).y||0]),uvConvention:{side:'U around circumference; V along grain; duplicate seam',ends:'end +X/+Y; start -X/+Y; viewed outward, never mirrored'}};
  return g;
}
function woodUVGate(g){const P=g.attributes.position.array,N=g.attributes.normal.array,U=g.attributes.uv?.array,I=g.index.array,finite=U&&Array.from(U).every(Number.isFinite),report=[];
  for(const type of ['side','start','end']){const parts=g.userData.surfaces.filter(f=>f.name===type);let good=0,total=0,minOutwardDot=1,areaOK=true,rangeOK=true,axisOK=true,orientationOK=true;
    for(const part of parts)for(let k=part.start;k<part.start+part.count;k+=3){const a=I[k],b=I[k+1],c=I[k+2],A=new THREE.Vector3(P[a*3],P[a*3+1],P[a*3+2]),B=new THREE.Vector3(P[b*3],P[b*3+1],P[b*3+2]),C=new THREE.Vector3(P[c*3],P[c*3+1],P[c*3+2]),n=B.clone().sub(A).cross(C.clone().sub(A)).normalize();let expected;if(type==='side'){const z=(A.z+B.z+C.z)/3,cl=g.userData.centreLine;let j=0;while(j<cl.length-2&&cl[j+1][0]<z)j++;const cy=lerp(cl[j][1],cl[j+1][1],clamp((z-cl[j][0])/(cl[j+1][0]-cl[j][0])));expected=new THREE.Vector3(A.x+B.x+C.x,A.y+B.y+C.y-3*cy,0).normalize();}else expected=new THREE.Vector3(0,0,type==='end'?1:-1);const outwardDot=n.dot(expected);minOutwardDot=Math.min(minOutwardDot,outwardDot);if(outwardDot>(type==='side'?1e-6:.6))good++;total++;
      const den=(U[b*2]-U[a*2])*(U[c*2+1]-U[a*2+1])-(U[b*2+1]-U[a*2+1])*(U[c*2]-U[a*2]);if(Math.abs(den)<1e-10)areaOK=false;if(den<=0)orientationOK=false;
      for(const i of [a,b,c])if(U[i*2]<-1e-6||U[i*2]>1+1e-6||U[i*2+1]<-1e-6||U[i*2+1]>1+1e-6)rangeOK=false;
      if(type==='side'){for(const [i,j] of [[a,b],[a,c]])if(Math.abs(P[i*3+2]-P[j*3+2])>1e-8&&(U[i*2+1]-U[j*2+1])*(P[i*3+2]-P[j*3+2])<=0)axisOK=false;}
    }
    report.push({face:type,minOutwardDot,outwardCriterion:type==='side'?'positive radial dot against local centreline':'end-facing normal',finite:!!finite,uvRange:rangeOK,nonzeroArea:areaOK,nonMirrored:orientationOK,longitudinalV:axisOK,outward:good===total&&total>0,triangles:total,passed:!!finite&&rangeOK&&areaOK&&orientationOK&&axisOK&&good===total&&total>0});
  }return {allPassed:report.every(f=>f.passed),faces:report};
}
function integrateTimber(rows,cols){
  const n=(cols+1)*rows,loss=new Float64Array(n),dose=new Float64Array(n),moisture=new Float64Array(n),stain=new Float64Array(n),repairs=new Uint16Array(n),beamLoss=new Float64Array(4*cols),forced=new Uint8Array(rows*cols);let panStates=[],hailHits=0;
  for(let year=0;year<=state.year;year++){
    const rain=.75+.5*hash01(state.seed,year,822),storm=year>10&&hash01(state.seed,year,910)>.91;
    panStates=Array.from({length:rows*cols},(_,i)=>{const r=Math.floor(i/cols),c=i%cols,s=lifecycle(r,c,'pan',rows,cols,year);if(state.care==='abandoned'&&forced[i]){s.missing=true;s.damageClass=2;s.reason='support loss';}
      if(storm&&hash01(state.seed,r,c,year,911)>.93){s.damageClass=Math.max(s.damageClass,1);s.hail=true;hailHits++;}return s;});
    for(let c=0;c<=cols;c++)for(let r=0;r<rows;r++){const i=c*rows+r;let water=0;for(const cc of [c-1,c])if(cc>=0&&cc<cols){const s=panStates[r*cols+cc];water=Math.max(water,s.missing?1:s.damageClass===2?.50:s.damageClass===1?.13:0);}if(r<rows-1)water=Math.max(water,moisture[c*rows+r+1]*.23);
      moisture[i]=moisture[i]*.72+water*.28;dose[i]+=moisture[i]*rain;stain[i]=clamp(stain[i]+water*.043+moisture[i]*.023);
      loss[i]=clamp(loss[i]+(.0006*water+.020*moisture[i])*(1+loss[i]*.8)*rain,0,.82);
      if(state.care==='maintained'&&loss[i]>.09&&hash01(i,year,state.seed,875)<.68){loss[i]=0;dose[i]=0;stain[i]=.08;moisture[i]=0;repairs[i]++;}
      if(state.care==='abandoned'&&loss[i]>.48){for(const cc of [c-1,c])if(cc>=0&&cc<cols)forced[r*cols+cc]=1;}
    }
    for(let b=0;b<4;b++)for(let c=0;c<cols;c++){const row=Math.round((b/3)*(rows-1)),i=b*cols+c,L=(loss[c*rows+row]+loss[(c+1)*rows+row])*.5,M=(moisture[c*rows+row]+moisture[(c+1)*rows+row])*.5;
      // Heavy horizontal members deteriorate after prolonged direct exposure.
      beamLoss[i]=clamp(beamLoss[i]+M*L*.0125*rain,0,.66);if(state.care==='maintained'&&beamLoss[i]>.075)beamLoss[i]=0;
    }
  }
  return {loss,dose,moisture,stain,repairs,beamLoss,panStates,hailHits,forced};
}
function interpArray(a,offset,t,n){const p=clamp(t)*Math.max(0,n-1),i=Math.floor(p);return lerp(a[offset+i]||0,a[offset+Math.min(n-1,i+1)]||0,p-i);}
