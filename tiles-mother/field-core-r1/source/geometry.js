/* Geometric carriers for the new field core. No UV channel and no texture input.
 * Fixed tessellation. Rest coordinates belong to the parent material before splitting.
 */
const FieldGeometry=(()=>{
 const {h,noise,mix,smooth,clamp,profiles,surface,macroNormal,crackPath}=FieldCore;
 class Builder{
  constructor(){this.p=[];this.q=[];this.tag=[];this.i=[];}
  add(p,q=p,interior=0,ao=1){let n=this.p.length/3;this.p.push(...p);this.q.push(...q);this.tag.push(interior,ao);return n;}
  tri(a,b,c,out){if(out){const p=this.p,u=[p[b*3]-p[a*3],p[b*3+1]-p[a*3+1],p[b*3+2]-p[a*3+2]],v=[p[c*3]-p[a*3],p[c*3+1]-p[a*3+1],p[c*3+2]-p[a*3+2]],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];if(n.reduce((s,x,i)=>s+x*out[i],0)<0)[b,c]=[c,b];}this.i.push(a,b,c);}
  quad(a,b,c,d,out){this.tri(a,b,c,out);this.tri(b,d,c,out);}
  finish(smoothEdges=false){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));g.setAttribute('rest',new THREE.Float32BufferAttribute(this.q,3));g.setAttribute('tag',new THREE.Float32BufferAttribute(this.tag,2));g.setIndex(this.i);g.computeVertexNormals();
   if(smoothEdges){const sums=new Map(),pa=g.attributes.position.array,na=g.attributes.normal.array;for(let i=0;i<pa.length/3;i++){if(this.tag[i*2]>.3)continue;let key=[pa[i*3],pa[i*3+1],pa[i*3+2]].map(v=>Math.round(v*1e6)).join(','),o=sums.get(key)||[0,0,0];for(let k=0;k<3;k++)o[k]+=na[i*3+k];sums.set(key,o);}for(let i=0;i<pa.length/3;i++){if(this.tag[i*2]>.3)continue;let key=[pa[i*3],pa[i*3+1],pa[i*3+2]].map(v=>Math.round(v*1e6)).join(','),o=sums.get(key),l=Math.hypot(...o)||1;for(let k=0;k<3;k++)na[i*3+k]=o[k]/l;}}
   g.computeBoundingBox();g.computeBoundingSphere();return g;}
 }
 function tile(kind='pan',seed=11,piece=0,path=null){const b=new Builder(),P=profiles[kind],NU=18,NV=6,top=[],bottom=[],sample=(s,v)=>{let t=piece<0?v*path.at(s):piece>0?path.at(s)+(1-path.at(s))*v:v;return {t,p:surface(kind,s,t,seed),n:macroNormal(kind,s,t)};};
  for(let j=0;j<=NV;j++){top[j]=[];bottom[j]=[];for(let i=0;i<=NU;i++){const s=i/NU*2-1,o=sample(s,j/NV),thick=P.T*(1+.025*Math.sin(s*3.2+seed)*Math.sin(o.t*Math.PI)),bottomP=o.p.map((v,k)=>v-o.n[k]*thick);top[j][i]=b.add(o.p,o.p,0,1);bottom[j][i]=b.add(bottomP,bottomP,0,.82);}}
  for(let j=0;j<NV;j++)for(let i=0;i<NU;i++){const n=macroNormal(kind,(i+.5)/NU*2-1,sample((i+.5)/NU*2-1,(j+.5)/NV).t);b.quad(top[j][i],top[j][i+1],top[j+1][i],top[j+1][i+1],n);b.quad(bottom[j][i],bottom[j][i+1],bottom[j+1][i],bottom[j+1][i+1],n.map(x=>-x));}
  function band(name,count,sAt,vAt,out,fracture){const grid=[],nr=3;for(let k=0;k<=count;k++){grid[k]=[];let a=k/count,s=sAt(a),v=vAt(a),o=sample(s,v),thick=P.T*(1+.025*Math.sin(s*3.2+seed)*Math.sin(o.t*Math.PI));for(let j=0;j<=nr;j++){let d=j/nr,side=fracture?0:Math.sin(Math.PI*d)*.0010*Math.sqrt(Math.max(0,Math.sin(Math.PI*a))),pt=o.p.map((x,n)=>x-o.n[n]*thick*d+out[n]*side),q=[...pt];grid[k][j]=b.add(pt,q,fracture?.88:0,fracture?.92:1);}}
   for(let k=0;k<count;k++)for(let j=0;j<nr;j++)b.quad(grid[k][j],grid[k+1][j],grid[k][j+1],grid[k+1][j+1],out);
  }
  band('left',NV,()=>-1,a=>a,[-1,0,0],false);band('right',NV,()=>1,a=>a,[1,0,0],false);
  band('eave',NU,a=>2*a-1,()=>0,[0,0,-1],piece>0);band('ridge',NU,a=>2*a-1,()=>1,[0,0,1],piece<0);
  const g=b.finish(true);g.userData={kind,seed,piece,closedExpected:true,fixedGrid:[NU,NV],unit:'m'};return g;
 }
 function wood(seed=5,piece=0){const b=new Builder(),L=.63,R=.057,NA=96,NZ=52,grid=[];
  const cut=(x,y)=>.006+.48*y+.060*(noise(x*48+7,y*45+4,0,seed+6)-.5)+.015*(noise(x*156+3,y*161+11,0,seed+33)-.5)+.004*Math.sin(x*210+Math.sin(y*53)*1.8);
  function radial(theta,z){const knots=.0009*Math.sin(theta*9+z*7)+.0008*Math.sin(theta*23+z*1.8),groove=.00055*Math.pow(.5+.5*Math.cos(theta*39+Math.sin(z*5.1)*.8+3*(noise(Math.cos(theta)*6+3,Math.sin(theta)*6+4,z*6,seed+8)-.5)),10);const a=Math.atan2(Math.sin(theta-1.7-.07*Math.sin(z*13)),Math.cos(theta-1.7-.07*Math.sin(z*13))),crack=.010*Math.exp(-a*a/.003)*Math.exp(-Math.pow((z+.06)/.17,4));return R+knots-groove-crack;}
  function point(theta,v){let x=Math.cos(theta)*R,y=Math.sin(theta)*R,zcut=cut(x,y),z=piece<0?mix(-L/2,zcut,v):piece>0?mix(zcut,L/2,v):mix(-L/2,L/2,v);let r=radial(theta,z);return [Math.cos(theta)*r,Math.sin(theta)*r*.94,z];}
  for(let j=0;j<=NZ;j++){grid[j]=[];for(let i=0;i<=NA;i++){const p=point(i/NA*Math.PI*2,j/NZ);grid[j][i]=b.add(p,p,0,1);}}
  for(let j=0;j<NZ;j++)for(let i=0;i<NA;i++)b.quad(grid[j][i],grid[j][i+1],grid[j+1][i],grid[j+1][i+1],[Math.cos((i+.5)/NA*Math.PI*2),Math.sin((i+.5)/NA*Math.PI*2),0]);
  for(let end of [0,1]){const fract=piece<0?end===1:piece>0?end===0:false,radials=12,cap=[];let z0=fract?cut(0,0):end?L/2:-L/2,center=b.add([0,0,z0],[0,0,z0],fract?.9:.15,1);for(let k=1;k<=radials;k++){cap[k]=[];for(let i=0;i<=NA;i++){const angle=i/NA*Math.PI*2,edge=point(angle,end),r=k/radials,x=edge[0]*r,y=edge[1]*r,z=fract?mix(cut(x,y),edge[2],Math.pow(r,6)):edge[2],p=[x,y,z];cap[k][i]=b.add(p,p,fract?.9:.15,1);}}
   const out=[0,0,end?1:-1];for(let i=0;i<NA;i++)b.tri(center,cap[1][i],cap[1][i+1],out);for(let k=1;k<radials;k++)for(let i=0;i<NA;i++)b.quad(cap[k][i],cap[k][i+1],cap[k+1][i],cap[k+1][i+1],out);
  }
  const g=b.finish(false);g.userData={kind:'wood',seed,piece,closedExpected:true,unit:'m'};return g;
 }
 // True polar boundary with a tapered perimeter and a closed bottom. No cropped plane.
 function moss(seed=1){const b=new Builder(),N=64,NR=6,grid=[],radial=a=>1+.19*Math.sin(3*a+seed)+.10*Math.sin(5*a+seed*.7)+.035*Math.cos(13*a+seed*.2)+.016*Math.sin(29*a+seed);
  const center=b.add([0,1,0],[0,.01,0],0,1);for(let j=1;j<=NR;j++){grid[j]=[];for(let i=0;i<=N;i++){const a=i/N*2*Math.PI,r=j/NR,rr=radial(a)*r,x=Math.cos(a)*rr,z=Math.sin(a)*rr,crest=(.78+.26*noise(x*3+4,z*3+2,0,seed))*(1-smooth(.08,1,r));let y=.05+crest+.055*(noise(x*15+7,z*15+2,0,seed+15)-.5)*Math.pow(Math.sin(Math.PI*r),2);grid[j][i]=b.add([x,y,z],[x*.026,y*.012,z*.026],0,mix(1,.63,r*r));}}
  for(let i=0;i<N;i++)b.tri(center,grid[1][i+1],grid[1][i],[0,1,0]);for(let j=1;j<NR;j++)for(let i=0;i<N;i++)b.quad(grid[j][i],grid[j][i+1],grid[j+1][i],grid[j+1][i+1],[0,1,0]);
  const cb=b.add([0,0,0],[0,0,0],0,.5);for(let i=0;i<N;i++)b.tri(cb,grid[NR][i],grid[NR][i+1],[0,-1,0]);const g=b.finish();g.userData={kind:'moss',seed,boundary:'64-segment irregular polar contour, no rectangular clipping'};return g;
 }
 // A separate fixed carrier for roof timber: exact circular bearing surface.
 // Fine fibres remain in the material field; no camera-dependent geometry changes.
 function bearingWood(){const g=new THREE.CylinderGeometry(.057,.057,.63,64,4,false);g.rotateX(Math.PI/2);g.deleteAttribute('uv');g.setAttribute('rest',g.attributes.position.clone());const tag=new Float32Array(g.attributes.position.count*2);for(let i=0;i<g.attributes.position.count;i++){tag[2*i]=Math.abs(g.attributes.normal.getZ(i))>.8?.15:0;tag[2*i+1]=1;}g.setAttribute('tag',new THREE.BufferAttribute(tag,2));g.computeBoundingBox();g.computeBoundingSphere();g.userData={kind:'bearingWood',unit:'m',circularBearing:true,closedExpected:true};return g;}
 // Sampled support template: computed for each profile, reused by every instance.
 function graph(g,angle=0){const pa=g.attributes.position.array,ix=g.index.array,cs=Math.cos(angle),sn=Math.sin(angle),v=[];for(let i=0;i<pa.length;i+=3)v.push([pa[i],pa[i+1]*cs-pa[i+2]*sn,pa[i+1]*sn+pa[i+2]*cs]);const nx=22,nz=32,minx=g.boundingBox.min.x-.003,maxx=g.boundingBox.max.x+.003,minz=Math.min(...v.map(x=>x[2]))-.002,maxz=Math.max(...v.map(x=>x[2]))+.002,bins=Array.from({length:nx*nz},()=>[]),tops=[],bottoms=[];const X=x=>clamp(Math.floor((x-minx)/(maxx-minx)*nx),0,nx-1),Z=z=>clamp(Math.floor((z-minz)/(maxz-minz)*nz),0,nz-1);
   for(let k=0;k<ix.length;k+=3){let a=v[ix[k]],b=v[ix[k+1]],c=v[ix[k+2]],den=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);if(Math.abs(den)<1e-12)continue;const t={a,b,c,den};if(den<0){const idx=tops.length;tops.push(t);for(let z=Z(Math.min(a[2],b[2],c[2]));z<=Z(Math.max(a[2],b[2],c[2]));z++)for(let x=X(Math.min(a[0],b[0],c[0]));x<=X(Math.max(a[0],b[0],c[0]));x++)bins[z*nx+x].push(idx);}else{bottoms.push(a,b,c);}}
   function height(x,z){if(x<minx||x>maxx||z<minz||z>maxz)return -Infinity;let y=-Infinity;for(const it of bins[Z(z)*nx+X(x)]){const {a,b,c,den}=tops[it],u=((x-a[0])*(c[2]-a[2])-(z-a[2])*(c[0]-a[0]))/den,w=((b[0]-a[0])*(z-a[2])-(b[2]-a[2])*(x-a[0]))/den;if(u>=-1e-7&&w>=-1e-7&&u+w<=1+1e-7)y=Math.max(y,a[1]+u*(b[1]-a[1])+w*(c[1]-a[1]));}return y;}
   return {bottoms,height,angle};
 }
 function shingle(g){let result;for(let angle=.045;angle<=.18;angle+=.005){let gr=graph(g,angle),gap=Infinity,n=0;for(const p of gr.bottoms){let y=gr.height(p[0],p[2]+.198);if(Number.isFinite(y)){gap=Math.min(gap,p[1]-y);n++;}}result={...gr,pitch:angle,overlapGap:gap,samples:n};if(gap>.00012)break;}return result;}
 function seats(pan,cover){let p=Object.assign(graph(pan,.126),{pitch:.126}),c=Object.assign(graph(cover,.045),{pitch:.045,offsetZ:-.045}),spacing=.244,R=.029;
  const rf=(x,center)=>Math.abs(x-center)<=R?Math.sqrt(Math.max(0,R*R-(x-center)**2))-R:-Infinity;
  let gap=Infinity;for(const v of p.bottoms)gap=Math.min(gap,v[1]-Math.max(rf(v[0],-spacing/2),rf(v[0],spacing/2)));p.raise=-gap+.00015;
  let gapC=Infinity;for(const v of c.bottoms){const y=Math.max(...[-.198,0,.198].flatMap(d=>[p.height(v[0]-spacing/2,v[2]+c.offsetZ+d),p.height(v[0]+spacing/2,v[2]+c.offsetZ+d)]));if(Number.isFinite(y))gapC=Math.min(gapC,v[1]-y-p.raise);}c.raise=-gapC+.00115;
  return {pan:p,cover:c,spacing,rafterRadius:R,contract:'sampled triangle height graph; template placement, not exhaustive triangle-triangle certification'};
 }
 return {Builder,tile,wood,bearingWood,moss,graph,seats};
})();
