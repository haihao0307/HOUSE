/* Tiles Mother Field Core R1. Original implementation, metres and years.
 * Sampling is pure. Time/state changes never originate from the render clock.
 */
const FieldCore=(()=>{
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
 const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
 const h=(a,b=0,c=0)=>{let x=(Math.imul(a|0,374761393)^Math.imul(b|0,668265263)^Math.imul(c|0,1442695041))>>>0;x=Math.imul(x^(x>>>13),1274126177);return ((x^(x>>>16))>>>0)/4294967295;};
 function field(p){const skew=(p[0]+p[1]+p[2])/3,i=p.map(x=>Math.floor(x+skew)),un=(i[0]+i[1]+i[2])/6,x=p.map((v,k)=>v-i[k]+un),u=[x[0]>=x[1]?1:0,x[1]>=x[2]?1:0,x[2]>=x[0]?1:0],lo=u.map(v=>1-v),r1=u.map((v,k)=>Math.min(v,lo[(k+2)%3])),r2=u.map((v,k)=>Math.max(v,lo[(k+2)%3])),out=[0,0,0,0];
  for(const [r,shift] of [[[0,0,0],0],[r1,1/6],[r2,1/3],[[1,1,1],.5]]){const d=x.map((v,k)=>v-r[k]+shift),id=i.map((v,k)=>v+r[k]);let h0=(Math.imul(id[0],374761393)^Math.imul(id[1],668265263)^Math.imul(id[2],1442695041))>>>0;h0=Math.imul(h0^(h0>>>13),1274126177);h0=(h0^(h0>>>16))>>>0;const a=h0%12;let g=a<4?[1,1,0]:a<8?[1,0,1]:[0,1,1];if(h0&16)g=g.map(v=>-v);if(h0&32)g[a<8?0:1]*=-1;const t=Math.max(.6-d.reduce((v,n)=>v+n*n,0),0),v=g.reduce((v,n,k)=>v+n*d[k],0);out[0]+=t**4*v;for(let k=0;k<3;k++)out[k+1]+=t**4*g[k]-8*t**3*v*d[k];}
  return [.5+16*out[0],...out.slice(1).map(v=>v*16)];}
 function noise(x,y,z=0,seed=1){return field([x+seed*11,y,z])[0];}
 const profiles={pan:{L:.238,W0:.242,W1:.221,H0:.050,H1:.047,T:.012},cover:{L:.222,W0:.115,W1:.090,H0:.037,H1:.035,T:.010}};
 function surface(kind,s,t,seed=1){const p=profiles[kind],w=mix(p.W0,p.W1,t),hh=mix(p.H0,p.H1,t),R=w*w/(8*hh)+hh/2,sg=kind==='pan'?-1:1,x=s*w/2,root=Math.sqrt(Math.max(1e-9,R*R-x*x));let y=sg*(root-(R-hh));
   // Small shaping changes stay outside the overlap and bearing regions.
   const gate=smooth(.16,.3,t)*(1-smooth(.70,.84,t))*Math.pow(1-s*s,2);
   y+=gate*(noise(s*2+3,t*5,0,seed)-.5)*.0022;
   const drift=(noise(t*4,2,0,seed+37)-.5)*.0012*s*s*s*s*s*s;const end=(noise(s*4+8,1,0,seed+19)-.5)*.0015*Math.pow(1-s*s,2);return [x+drift,y,(t-.5)*p.L+end*(1-smooth(.04,.17,t))];}
 function macroNormal(kind,s,t){const e=1e-4,a=surface(kind,s-e,t,0),b=surface(kind,s+e,t,0),c=surface(kind,s,t-e,0),d=surface(kind,s,t+e,0);let u=b.map((v,i)=>v-a[i]),v=d.map((n,i)=>n-c[i]),n=[v[1]*u[2]-v[2]*u[1],v[2]*u[0]-v[0]*u[2],v[0]*u[1]-v[1]*u[0]],l=Math.hypot(...n);return n.map(x=>x/l);}
 // Path through a heterogeneous toughness field under a declared bending envelope.
 // This is a dimensionless visual fracture proxy, not calibrated fracture mechanics.
 function crackPath(seed,wet=0.5){const NX=48,NY=36,cost=[],parent=[];for(let i=0;i<=NX;i++){cost[i]=[];parent[i]=[];for(let j=0;j<NY;j++){const t=.23+.56*j/(NY-1),s=i/NX*2-1;
   const demand=4*t*(1-t),weak=noise(s*4+8,t*8,2,seed+21),score=(.60+.55*weak-.22*wet)/(demand+.01);
   if(i===0){cost[i][j]=score+.35*Math.abs(t-(.42+.14*h(seed,8)));parent[i][j]=-1;}else{let best=Infinity,jb=j;for(let q=Math.max(0,j-2);q<=Math.min(NY-1,j+2);q++){let z=cost[i-1][q]+.042*Math.abs(j-q);if(z<best){best=z;jb=q;}}cost[i][j]=best+score;parent[i][j]=jb;}}}
   let j=cost[NX].indexOf(Math.min(...cost[NX])),path=new Array(NX+1);for(let i=NX;i>=0;i--){path[i]=.23+.56*j/(NY-1);j=parent[i][j];}
   const smoothPath=path.map((v,i)=>i===0||i===NX?v:(path[i-1]+2*v+path[i+1])/4);
   return {values:smoothPath,at(s){const a=clamp((s+1)*.5)*NX,i=Math.min(NX-1,Math.floor(a)),t=a-i;return mix(smoothPath[i],smoothPath[i+1],t)+.0018*Math.sin(s*29+seed)*Math.sin(s*13+.7);},method:'heterogeneous shortest path / bending proxy',seed};}
 // Explicit visual checkpoints from user feedback, no claim of universal lifespan.
 function lossFraction(y){const stops=[[0,0],[3,.003],[5,.018],[7,.19],[10,.67],[15,.97]];for(let i=1;i<stops.length;i++)if(y<=stops[i][0])return mix(stops[i-1][1],stops[i][1],smooth(stops[i-1][0],stops[i][0],y));return .97;}
 function snapshot(rows,cols,seed,year,care,wet){if(!Number.isFinite(year)||year<0||year>15)throw Error('Year outside 0..15');const y=care==='maintained'?0:year,w=clamp(wet),n=rows*cols,pan=[],cover=[],beams=[],rafters=[];
   const ranks=Array.from({length:n},(_,i)=>{let r=Math.floor(i/cols),c=i%cols;return {i,v:.45*h(seed,i,101)+.55*noise(c*.27,r*.35,0,seed+701)};}).sort((a,b)=>a.v-b.v);
   const count=Math.floor(n*lossFraction(y)*mix(.75,1.16,w)),failed=new Set(ranks.slice(0,count).map(v=>v.i));
   // Four timber lines, local joint exposure plus time; local segment failures.
   for(let b=0;b<4;b++)for(let c=0;c<cols;c++){const rr=Math.min(rows-1,Math.round(b*(rows-1)/3)),leak=failed.has(rr*cols+c)?1:.14,exposure=clamp((y-3)/7)*mix(.30,.95,leak)*mix(.8,1.1,w),damage=clamp(exposure*(.75+.5*h(seed,b,c)));beams.push({b,c,damage,failed:damage>.71});}
   const beam=(b,c)=>beams[b*cols+clamp(c,0,cols-1)];
   for(let r=0;r<rows;r++)for(let c=0;c<=cols;c++){const b=Math.min(2,Math.floor(r/Math.max(1,rows-1)*3)),joint=(beam(b,c).failed||beam(b+1,c).failed),leak=(failed.has(r*cols+c)||failed.has(r*cols+c-1)),damage=clamp(smooth(3,11,y)*(leak?.94:.19)*(.75+.5*h(seed,r,c)));rafters.push({r,c,damage,failed:joint||damage>.72});}
   const rf=(r,c)=>rafters[r*(cols+1)+c];
   for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const i=r*cols+c,own=failed.has(i),unsupported=rf(r,c).failed||rf(r,c+1).failed;pan.push({id:'p'+i,r,c,seed:Math.floor(h(seed,i,9)*65000),missing:own||unsupported,cause:own?'tile_loss':unsupported?'support_loss':null,damage:own?1:clamp(smooth(1,9,y)*(.25+.6*h(seed,i,5))),wet:clamp(w*(.60+.40*noise(c*.23,r*.18,0,seed+4)))});}
   for(let r=0;r<rows;r++)for(let c=0;c<cols-1;c++){const i=r*(cols-1)+c,a=pan[r*cols+c],b=pan[r*cols+c+1];cover.push({id:'c'+i,r,c,seed:Math.floor(h(seed,i,19)*65000),missing:a.missing||b.missing,cause:a.missing||b.missing?'support_loss':null,damage:clamp(smooth(2,12,y)*h(seed,i,7)),wet:(a.wet+b.wet)*.5});}
   return {rows,cols,seed,year,care,pan,cover,beams,rafters,counts:{total:pan.length+cover.length,live:pan.filter(x=>!x.missing).length+cover.filter(x=>!x.missing).length,panLost:pan.filter(x=>x.missing).length,coverLost:cover.filter(x=>x.missing).length,beamFailed:beams.filter(x=>x.failed).length,rafterFailed:rafters.filter(x=>x.failed).length},model:'user-directed damp-house scenario, no load redistribution or rigid-body debris'};
 }
 return {clamp,mix,smooth,h,noise,field,profiles,surface,macroNormal,crackPath,lossFraction,snapshot};
})();
