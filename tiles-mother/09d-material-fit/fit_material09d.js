// Geometry in metres, canonical grain coordinate x is longitudinal.
function woodProfile(poly,depth){
 const g=extrude(poly,depth),xmin=Math.min(...poly.map(p=>p[0])),xmax=Math.max(...poly.map(p=>p[0])),ymin=Math.min(...poly.map(p=>p[1])),ymax=Math.max(...poly.map(p=>p[1])),vertical=ymax-ymin>xmax-xmin,cx=(xmin+xmax)/2,cy=(ymin+ymax)/2;
 const raw={positions:[],normals:[],grainPositions:[],surfaceClasses:[],indices:[],bounds:{length:vertical?ymax-ymin:xmax-xmin},metadata:{type:'source-plane timber profile',profile_m:poly,depth_m:depth,depth_status:'assumed',fibre_axis:vertical?'y':'x'}};
 for(let j=0;j<g.idx.length;j+=3){let v=Array.from(g.idx.slice(j,j+3)).map(i=>Array.from(g.p.slice(i*3,i*3+3))),n=V.norm(V.cross(V.sub(v[1],v[0]),V.sub(v[2],v[0])));for(let p of v){let q=vertical?[p[1]-cy,-(p[0]-cx),p[2]]:[p[0]-cx,p[1]-cy,p[2]],nn=vertical?[n[1],-n[0],n[2]]:n;raw.indices.push(raw.positions.length/3);raw.positions.push(...q);raw.grainPositions.push(...q);raw.normals.push(...nn);raw.surfaceClasses.push(Math.abs(nn[0])>.72?1:0)}}
 for(let k of ['positions','normals','grainPositions','surfaceClasses'])raw[k]=new Float32Array(raw[k]);
 let out=woodMesh(raw,vertical?'y':'x');for(let i=0;i<out.p.length;i+=3){out.p[i]+=cx;out.p[i+1]+=cy}out.definition.grainAxis=vertical?'y':'x';return out;
}
function woodCurvedRound09D(points,radii){
 const raw={positions:[],normals:[],grainPositions:[],surfaceClasses:[],indices:[],bounds:{},metadata:{type:'curved circular timber',centerline_m:points,radii_m:radii,section_status:'round section requested; radius from drawn band, unseen depth unmeasured'}},N=64,steps=12,centres=[],rs=[],distance=[];
 for(let j=0;j<points.length-1;j++)for(let k=0;k<steps;k++){let u=k/steps;centres.push([mix(points[j][0],points[j+1][0],u),mix(points[j][1],points[j+1][1],u),0]);rs.push(mix(radii[j],radii[j+1],u))}centres.push([...points.at(-1),0]);rs.push(radii.at(-1));
 for(let j=0;j<centres.length;j++){distance.push(j?distance[j-1]+Math.hypot(...V.sub(centres[j],centres[j-1])):0);let tangent=V.norm(V.sub(centres[Math.min(j+1,centres.length-1)],centres[Math.max(0,j-1)])),u=[-tangent[1],tangent[0],0];for(let k=0;k<=N;k++){let a=k*TAU/N,n=[u[0]*Math.cos(a),u[1]*Math.cos(a),Math.sin(a)],p=V.add(centres[j],V.scale(n,rs[j]));raw.positions.push(...p);raw.normals.push(...n);raw.grainPositions.push(distance[j],rs[j]*Math.cos(a),rs[j]*Math.sin(a));raw.surfaceClasses.push(0)}}
 for(let j=0;j<centres.length-1;j++)for(let k=0;k<N;k++){let a=j*(N+1)+k,b=a+N+1;raw.indices.push(a,b,a+1,a+1,b,b+1)}
 for(let end of [0,1]){let j=end?centres.length-1:0,t=V.norm(V.sub(centres[Math.min(j+1,centres.length-1)],centres[Math.max(0,j-1)])),n=V.scale(t,end?1:-1),base=raw.positions.length/3;raw.positions.push(...centres[j]);raw.normals.push(...n);raw.grainPositions.push(distance[j],0,0);raw.surfaceClasses.push(1);for(let k=0;k<=N;k++){let i=j*(N+1)+k;raw.positions.push(...raw.positions.slice(i*3,i*3+3));raw.normals.push(...n);raw.grainPositions.push(...raw.grainPositions.slice(i*3,i*3+3));raw.surfaceClasses.push(1)}for(let k=0;k<N;k++)raw.indices.push(base,base+1+k,base+2+k)}
 for(let k of ['positions','normals','grainPositions','surfaceClasses'])raw[k]=new Float32Array(raw[k]);let g=woodMesh(raw);g.definition.grainAxis='arc length of curved member';return g;
}
function dripFace09D(id,body){
 const key=id+'/full-lip/'+STUDY.set+'/'+settings.micStrength+'/'+settings.micScale+'/'+STUDY.depth+'/'+STUDY.relief+'/'+STUDY.family;if(DETAIL_CACHE.has(key))return DETAIL_CACHE.get(key);
 const n=STUDY.family==='tile'?192:80,B=15,start=2*(n+1)*(n+1)+2*(n+1)*B,t=SOURCE_CURVES[id],hp=[],point=(i,q)=>{let j=(start+i*B+q)*3;return[-body.p[j],body.p[j+1]]};
 for(let i=0;i<=n;i++)hp.push(point(i,0));for(let q=1;q<B;q++)hp.push(point(n,q));for(let i=n-1;i>=0;i--)hp.push(point(i,B-1));for(let q=B-2;q>0;q--)hp.push(point(0,q));
 const section=(poly,x)=>{let hits=[];for(let i=0;i<poly.length;i++){let a=poly[i],b=poly[(i+1)%poly.length];if(Math.abs(a[0]-x)<1e-9)hits.push(a[1]);if(x>=Math.min(a[0],b[0])-1e-10&&x<=Math.max(a[0],b[0])+1e-10&&Math.abs(b[0]-a[0])>1e-12)hits.push(mix(a[1],b[1],clamp((x-a[0])/(b[0]-a[0]))))}return[Math.min(...hits),Math.max(...hits)]};
 const xmin=Math.min(...hp.map(p=>p[0])),xmax=Math.max(...hp.map(p=>p[0])),omin=Math.min(...t.outline.map(p=>p[0])),omax=Math.max(...t.outline.map(p=>p[0]));
 let xs=[...hp.map(p=>p[0]),...t.outline.map(p=>mix(xmin,xmax,(p[0]-omin)/(omax-omin))),...Array.from({length:321},(_,i)=>mix(xmin,xmax,i/320))].sort((a,b)=>a-b).filter((x,i,a)=>!i||x-a[i-1]>1e-7);
 const center=t.outline.filter(p=>p[1]>0&&Math.abs(p[0])<.035),cy=-(center.length?Math.min(...center.map(p=>p[1])):t.height_m/2)+.003;
 const top=[],bottom=[];for(let x of xs){let p=section(hp,x),old=section(t.outline,mix(omin,omax,(x-xmin)/(xmax-xmin)));top.push([x,p[1]+.0002]);bottom.push([x,Math.min(p[0]-.0002,p[1]-Math.max(.001,old[1]-old[0]))]);}
 const trace={...t,outline:[...top,...bottom.slice().reverse()],curves:t.curves.map(c=>({...c,points:c.points.map(p=>[p[0],p[1]+cy])})),width_m:xmax-xmin};
 const G=new Mesh(),field=reliefField(trace),rows=180,stride=rows+1;
 for(let i=0;i<xs.length;i++)for(let j=0;j<=rows;j++){let x=xs[i],y=mix(bottom[i][1],top[i][1],j/rows);G.vertex([x,y,STUDY.depth/2+STUDY.relief*field(x,y)])}
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<rows;j++){let a=i*stride+j,b=a+stride;G.tri(a,b,a+1);G.tri(a+1,b,b+1)}
 G.frontCount=G.p.length/3;G.frontIndexCount=G.idx.length;let edges=[];for(let i=0;i<xs.length-1;i++)edges.push([i*stride,(i+1)*stride]);for(let j=0;j<rows;j++)edges.push([(xs.length-1)*stride+j,(xs.length-1)*stride+j+1]);for(let i=xs.length-1;i>0;i--)edges.push([i*stride+rows,(i-1)*stride+rows]);for(let j=rows;j>0;j--)edges.push([j,j-1]);G.frontBoundary=edges;G.fittedTrace=trace;G.definition={kind:'connected pressed drip surface',source:t.source,sourceOutlineAdaptation:'complete actual pan front section; source interior motif translated without arbitrary new motifs',relief_m:STUDY.relief};G.finish();DETAIL_CACHE.set(key,G);return G;
}
const BRICK_CACHE09D=new Map();
function brickMesh09D(w,h,d){
 let key=[w,h,d].join('/');if(BRICK_CACHE09D.has(key))return BRICK_CACHE09D.get(key);
 const G=new Mesh(),half=[w/2,h/2,d/2],r=Math.min(.004,h*.055,d*.04),N=18;
 for(let axis=0;axis<3;axis++)for(let side of [-1,1]){let a=(axis+1)%3,b=(axis+2)%3,base=G.p.length/3;
  for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){let p=[0,0,0];p[axis]=side*half[axis];p[a]=mix(-half[a],half[a],i/N);p[b]=mix(-half[b],half[b],j/N);let c=p.map((x,k)=>Math.max(-half[k]+r,Math.min(half[k]-r,x))),normal=V.norm(V.sub(p,c)),edge=1-Math.min(...p.map((x,k)=>(half[k]-Math.abs(x))/r).filter((_,k)=>k!==axis));edge=clamp(edge);let chip=edge*.0009*(.5+.5*Math.sin(p[0]*391+p[1]*877+p[2]*559))*Math.pow(.5+.5*Math.sin(p[0]*137-p[1]*217+p[2]*313),3),q=V.add(c,V.scale(normal,r-chip));q[1]+=h/2;G.vertex(q)}
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){let k=base+j*(N+1)+i;G.quad(k,k+1,k+N+1,k+N+2,side<0)}
 }
 G.finish();G.definition={kind:'brick mother material on dimensioned masonry',width_m:w,height_m:h,depth_m:d,edgeRadius_m:r,edgeChippingMax_m:.0009,material:'Brick Mother R2.1 accepted B, angular pole fix',material_source:'vendor/Brick_Material_Microscope_Lab_R2_1.html',material_coordinate_scale_m:.14423,shape_status:'current source dimensions retained; edge wear display assumption',colour_status:'accepted Brick Mother burnt clay palette, not established by monochrome historical drawing'};BRICK_CACHE09D.set(key,G);return G;
}
