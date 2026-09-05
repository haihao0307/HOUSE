/* Rigid shell contact solver. Units: metres. No mesh is scaled to hide an overlap.
   Lower support top and upper shell underside are piecewise-linear surfaces.
   Final clearance uses projected triangle clipping, including edge crossings. */
const CONTACT_EPS=.00018;
function makeProxy(geometry, matrix=new THREE.Matrix4()){
  const pa=geometry.attributes.position.array,ix=geometry.index.array,v=new Float64Array(pa.length),p=new THREE.Vector3();
  let xmin=Infinity,xmax=-Infinity,zmin=Infinity,zmax=-Infinity;
  for(let i=0;i<pa.length;i+=3){p.set(pa[i],pa[i+1],pa[i+2]).applyMatrix4(matrix);v[i]=p.x;v[i+1]=p.y;v[i+2]=p.z;xmin=Math.min(xmin,p.x);xmax=Math.max(xmax,p.x);zmin=Math.min(zmin,p.z);zmax=Math.max(zmax,p.z);}
  const nx=8,nz=16,dx=Math.max(1e-5,xmax-xmin),dz=Math.max(1e-5,zmax-zmin),top=[],bottom=[],bins=Array.from({length:nx*nz},()=>[]);
  const bx=x=>Math.max(0,Math.min(nx-1,Math.floor((x-xmin)/dx*nx))),bz=z=>Math.max(0,Math.min(nz-1,Math.floor((z-zmin)/dz*nz)));
  for(let k=0;k<ix.length;k+=3){const a=ix[k]*3,b=ix[k+1]*3,c=ix[k+2]*3,ax=v[a],az=v[a+2],by=v[b+1],ay=v[a+1],cy=v[c+1],ux=v[b]-ax,uz=v[b+2]-az,vx=v[c]-ax,vz=v[c+2]-az,den=ux*vz-uz*vx;if(Math.abs(den)<1e-12)continue;
    const A=((by-ay)*vz-(cy-ay)*uz)/den,B=(ux*(cy-ay)-vx*(by-ay))/den,C=ay-A*ax-B*az;
    const t={a:[ax,az],b:[v[b],v[b+2]],c:[v[c],v[c+2]],A,B,C,den,minx:Math.min(ax,v[b],v[c]),maxx:Math.max(ax,v[b],v[c]),minz:Math.min(az,v[b+2],v[c+2]),maxz:Math.max(az,v[b+2],v[c+2])};
    if(den<0){const n=top.length;top.push(t);for(let z=bz(t.minz);z<=bz(t.maxz);z++)for(let x=bx(t.minx);x<=bx(t.maxx);x++)bins[z*nx+x].push(n);}else bottom.push(t);
  }
  const proxy={geometry,matrix:matrix.clone(),v,top,bottom,bins,bx,bz,nx,nz,xmin,xmax,zmin,zmax,yOffset:0};
  proxy.height=(x,z)=>{if(x<xmin-1e-8||x>xmax+1e-8||z<zmin-1e-8||z>zmax+1e-8)return -Infinity;let best=-Infinity;for(const n of bins[bz(z)*nx+bx(x)]){const t=top[n];if(pointInTri(x,z,t))best=Math.max(best,t.A*x+t.B*z+t.C);}return Number.isFinite(best)?best+proxy.yOffset:best;};
  return proxy;
}
function pointInTri(x,z,t){const u=((x-t.a[0])*(t.c[1]-t.a[1])-(z-t.a[1])*(t.c[0]-t.a[0]))/t.den,v=((t.b[0]-t.a[0])*(z-t.a[1])-(t.b[1]-t.a[1])*(x-t.a[0]))/t.den;return u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7;}
function clipTriangle(a,b){let poly=[a.a,a.b,a.c];const edges=[[b.a,b.b],[b.b,b.c],[b.c,b.a]],sign=Math.sign(b.den);for(const [v,w] of edges){if(!poly.length)break;const out=[],cross=p=>sign*((w[0]-v[0])*(p[1]-v[1])-(w[1]-v[1])*(p[0]-v[0]));let prev=poly.at(-1),d0=cross(prev);for(const curr of poly){const d1=cross(curr);if(d1>=-1e-10){if(d0< -1e-10){const k=d0/(d0-d1);out.push([prev[0]+k*(curr[0]-prev[0]),prev[1]+k*(curr[1]-prev[1])]);}out.push(curr);}else if(d0>=-1e-10){const k=d0/(d0-d1);out.push([prev[0]+k*(curr[0]-prev[0]),prev[1]+k*(curr[1]-prev[1])]);}prev=curr;d0=d1;}poly=out;}return poly;}
function exactGap(upper,lower){
  if(upper.xmax<lower.xmin||upper.xmin>lower.xmax||upper.zmax<lower.zmin||upper.zmin>lower.zmax)return {gap:Infinity,point:null,pairs:0};
  let gap=Infinity,point=null,pairs=0;
  for(const a of upper.bottom){if(a.maxx<lower.xmin||a.minx>lower.xmax||a.maxz<lower.zmin||a.minz>lower.zmax)continue;
    const seen=new Set();for(let z=lower.bz(a.minz);z<=lower.bz(a.maxz);z++)for(let x=lower.bx(a.minx);x<=lower.bx(a.maxx);x++)for(const n of lower.bins[z*lower.nx+x]){if(seen.has(n))continue;seen.add(n);const b=lower.top[n];if(a.maxx<b.minx||a.minx>b.maxx||a.maxz<b.minz||a.minz>b.maxz)continue;
      const poly=clipTriangle(a,b);if(!poly.length)continue;pairs++;for(const p of poly){const d=(a.A-b.A)*p[0]+(a.B-b.B)*p[1]+a.C-b.C+upper.yOffset-lower.yOffset;if(d<gap){gap=d;point=[p[0],b.A*p[0]+b.B*p[1]+b.C+lower.yOffset,p[1]];}}
    }
  }
  return {gap,point,pairs};
}
function minSupportGap(proxy,supports){let best={gap:Infinity,point:null};for(const s of supports){const r=exactGap(proxy,s);if(r.gap<best.gap)best=r;}return best;}
function poseMatrix(x,z,tilt,roll,y=0){return new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt,0,roll)),new THREE.Vector3(1,1,1));}
function seatAtAngle(g,x,z,tilt,left,right,width){
  let roll=0,proxy,gl,gr;
  for(let k=0;k<5;k++){
    proxy=makeProxy(g,poseMatrix(x,z,tilt,roll));gl=minSupportGap(proxy,left);gr=minSupportGap(proxy,right);
    if(!Number.isFinite(gl.gap)||!Number.isFinite(gr.gap))return null;
    const err=gl.gap-gr.gap;if(Math.abs(err)<.00005)break;
    const lever=gr.point&&gl.point?Math.abs(gr.point[0]-gl.point[0]):width*.8;
    roll=clamp(roll+err/Math.max(.025,lever),-.22,.22);
  }
  const raise=-Math.min(gl.gap,gr.gap)+CONTACT_EPS;proxy.yOffset=raise;
  proxy.matrix=poseMatrix(x,z,tilt,roll,raise);
  return {proxy,tilt,roll,leftGap:gl.gap+raise,rightGap:gr.gap+raise,contacts:[gl.point,gr.point]};
}
function settleTile(g,x,z,left,right,previous,width){
  if(!left.length||!right.length)return null;
  let current=null,prevGap=Infinity,lo=0,hi=.34,rounds=0;
  // A supported first tile can settle almost flat. Subsequent courses tilt up at
  // the eave; this creates overlap clearance without moving either timber line.
  const test=angle=>{const s=seatAtAngle(g,x,z,angle,left,right,width);if(!s)return null;const sep=minSupportGap(s.proxy,previous);s.overlapGap=sep.gap;return s;};
  current=test(0);if(!current)return null;
  if(current.overlapGap<CONTACT_EPS*.5){let high=test(hi);if(!high||high.overlapGap<CONTACT_EPS*.5)return {...current,unsupported:true,reason:'no rigid placement found within tilt limit'};
    for(let n=0;n<10;n++){const mid=(lo+hi)*.5,s=test(mid);rounds++;if(s&&s.overlapGap>=CONTACT_EPS*.5){hi=mid;high=s;}else lo=mid;}
    current=high;
  }
  current.iterations=rounds;current.unsupported=Math.max(current.leftGap,current.rightGap)>.0005;if(current.unsupported)current.reason='lost bilateral support under roll limit';return current;
}
