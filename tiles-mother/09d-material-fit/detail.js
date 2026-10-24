// 09B continuous relief: one connected face, never detached decorative tubes.
const DETAIL_CACHE=new Map();
function inside2(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){let a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function reliefField(t){
 const cell=.004,bins=new Map(),fills=new Map();
 const curves=t.curves.map(c=>({...c,points:c.points.map((p,i,a)=>p.map((v,k)=>(a[(i-1+a.length)%a.length][k]+v*2+a[(i+1)%a.length][k])/4))}));
 for(let c of curves){
  // Closed small motifs are broad moulded features, not pairs of wire outlines.
  if(c.hole&&Math.abs(area2(c.points))/2<.00072){let xs=c.points.map(p=>p[0]),ys=c.points.map(p=>p[1]);for(let x=Math.floor(Math.min(...xs)/cell);x<=Math.floor(Math.max(...xs)/cell);x++)for(let y=Math.floor(Math.min(...ys)/cell);y<=Math.floor(Math.max(...ys)/cell);y++){let k=x+','+y;if(!fills.has(k))fills.set(k,[]);fills.get(k).push(c.points);}}
  for(let i=0;i<c.points.length;i++){let a=c.points[i],b=c.points[(i+1)%c.points.length];for(let x=Math.floor((Math.min(a[0],b[0])-.003)/cell);x<=Math.floor((Math.max(a[0],b[0])+.003)/cell);x++)for(let y=Math.floor((Math.min(a[1],b[1])-.003)/cell);y<=Math.floor((Math.max(a[1],b[1])+.003)/cell);y++){let k=x+','+y;if(!bins.has(k))bins.set(k,[]);bins.get(k).push([a,b]);}}
 }
 const traced=(x,y)=>{let key=Math.floor(x/cell)+','+Math.floor(y/cell);if((fills.get(key)||[]).some(p=>inside2([x,y],p)))return 1;let d=.003;for(let [a,b]of bins.get(key)||[]){let dx=b[0]-a[0],dy=b[1]-a[1],u=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1));d=Math.min(d,Math.hypot(x-a[0]-u*dx,y-a[1]-u*dy));}return 1-smooth(.00012,.0014,d);};
 if(t.kind==='round'&&t.source_box_px[0]===825)return(x,y)=>{
  // L9 circular rafter coin: 16 long petals + 8 inner petals observed in the drawing.
  // The outer meander is still evaluated from the retained source curves.
  const yy=y*t.width_m/t.height_m,r=Math.hypot(x,yy),a=Math.atan2(yy,x),petal=(count,r0,r1,width)=>{let angle=Math.atan2(Math.sin(a*count),Math.cos(a*count))/count,along=r*Math.cos(angle),across=r*Math.sin(angle),u=(along-r0)/(r1-r0);if(u<=0||u>=1)return 0;let w=width*Math.pow(Math.sin(Math.PI*u),.85),body=1-smooth(w-.0006,w+.0003,Math.abs(across)),vein=(1-smooth(.00025,.0008,Math.abs(across)))*smooth(.20,.30,u)*(1-smooth(.85,.94,u));return body*(.85-.32*vein);};
  const leaves=petal(16,.010,.043,.0057),heart=petal(8,.0038,.0175,.0045),circle=c=>1-smooth(.0004,.0012,Math.abs(r-c));
  return Math.max(leaves,heart,circle(.0455)*.8,circle(.048)*.65,r>.050?traced(x,y):0,circle(.0635)*.65);
 };
 return traced;
}
function pressedMesh(id,depth=STUDY.depth,relief=STUDY.relief){
 const key=[id,depth,relief].join('/');if(DETAIL_CACHE.has(key))return DETAIL_CACHE.get(key);
 let t=SOURCE_CURVES[id],poly=t.kind==='round'?Array.from({length:192},(_,i)=>[t.width_m/2*Math.cos(i*TAU/192),t.height_m/2*Math.sin(i*TAU/192)]):t.outline;
 if(!poly)poly=t.curves.filter(c=>!c.hole).sort((a,b)=>Math.abs(area2(b.points))-Math.abs(area2(a.points)))[0].points;
 if(area2(poly)<0)poly=poly.slice().reverse();
 const G=new Mesh(),field=reliefField(t),map=new Map(),edges=new Map(),step=t.kind==='silhouette'?.0015:.00065;
 const vertex=(x,y)=>{let key=Math.round(x*1e8)+','+Math.round(y*1e8);if(map.has(key))return map.get(key);let a=G.vertex([x,y,depth/2+relief*field(x,y)]);map.set(key,a);return a;};
 // Clip regular cells to the source outline; avoid long skinny ear triangles on relief.
 const xmin=Math.min(...poly.map(p=>p[0])),xmax=Math.max(...poly.map(p=>p[0])),ymin=Math.min(...poly.map(p=>p[1])),ymax=Math.max(...poly.map(p=>p[1])),nx=Math.ceil((xmax-xmin)/step),ny=Math.ceil((ymax-ymin)/step);
 const clip=(pts,axis,edge,sign)=>{let out=[];for(let i=0;i<pts.length;i++){let a=pts[i],b=pts[(i+1)%pts.length],inside=sign*(a[axis]-edge)>=-1e-12,next=sign*(b[axis]-edge)>=-1e-12;if(inside)out.push(a);if(inside!==next){let f=(edge-a[axis])/(b[axis]-a[axis]);out.push(a.map((v,k)=>k===axis?edge:mix(v,b[k],f)));}}return out;};
 if(id==='rosette'){
  const sectors=256,rings=144,holeRadius=.0023;let previous=null;
  for(let j=0;j<=rings;j++){let row=[];for(let i=0;i<sectors;i++){let a=i*TAU/sectors,r=mix(holeRadius,1,j/rings),x=j===0?holeRadius*Math.cos(a):mix(holeRadius,t.width_m/2,j/rings)*Math.cos(a),y=j===0?holeRadius*Math.sin(a):mix(holeRadius,t.height_m/2,j/rings)*Math.sin(a);row.push(vertex(x,y));}if(previous)for(let i=0;i<sectors;i++){let k=(i+1)%sectors;G.tri(previous[i],row[i],row[k]);G.tri(previous[i],row[k],previous[k]);}previous=row;}
 }else for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
  let x0=mix(xmin,xmax,i/nx),x1=mix(xmin,xmax,(i+1)/nx),y0=mix(ymin,ymax,j/ny),y1=mix(ymin,ymax,(j+1)/ny),p=clip(clip(clip(clip(poly,0,x0,1),0,x1,-1),1,y0,1),1,y1,-1);
  if(p.length<3)continue;let ids=p.map(v=>vertex(...v));ids=ids.filter((v,i)=>v!==ids[(i+ids.length-1)%ids.length]);if(ids.length<3)continue;
  for(let k=1;k<ids.length-1;k++)G.tri(ids[0],ids[k],ids[k+1]);
 }
 const count=G.p.length/3,front=G.idx.slice();for(let i=0;i<count;i++)G.vertex([G.p[i*3],G.p[i*3+1],-depth/2]);
 for(let j=0;j<front.length;j+=3){let f=front.slice(j,j+3);G.tri(f[2]+count,f[1]+count,f[0]+count);for(let k=0;k<3;k++){let a=f[k],b=f[(k+1)%3],key=[a,b].sort((a,b)=>a-b).join(',');if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}}
 for(let [a,b]of edges.values())G.quad(a,a+count,b,b+count);
 G.frontCount=count;G.frontIndexCount=front.length;G.frontBoundary=Array.from(edges.values());
 G.definition={id,kind:'single closed pressed relief surface',source:t.source,curves_ref:'source-curves.json#'+id,relief_m:relief,depth_m:depth,depth_status:'display assumption',nailHoleRadius_m:id==='rosette'?.0023:null,separate_relief_tubes:0};G.finish();DETAIL_CACHE.set(key,G);return G;
}
function allSurfaceOffset(p,m,kind){
 const P=PROFILE[kind],u=m[3],q=m[2],t=clamp(p[2]/P.l+.5),n=tileN(kind,u,t,23),strength=settings.micStrength;
 const broad=clamp(tileBand(p,31,6*settings.micScale,.0012),-1,1),mid=clamp(tileBand(p,31,26*settings.micScale,.0012),-1,1),pore=smooth(.56,.67,tileBand(p,31,80*settings.micScale,.0012));
 const neck=kind==='cover'?smooth((ACTIVE_COVER.body-.005)/P.l,ACTIVE_COVER.body/P.l,t):0;
 const edge=smooth(.85,1,Math.abs(u)),end=Math.pow(Math.abs(2*t-1),8),amplitude=mix(1,.52,Math.max(q,edge,end,neck));
 const h=strength*amplitude*(.00135*broad+.00045*mid-.00075*pore),side=.00018*strength*mid;
 // Continuous in q at the lips: identical boundary coordinates receive identical offsets.
 return [n[0]*h+Math.sign(u)*edge*side,n[1]*h,Math.sign(t-.5)*end*side];
}
const END_CACHE=new Map();
function integratedEnd(id,set=STUDY.set){
 const key=[id,set,STUDY.datum,STUDY.depth,STUDY.relief,settings.micStrength,settings.micScale,STUDY.family==='tile'].join('/');if(END_CACHE.has(key))return END_CACHE.get(key);
 const kind=id.startsWith('drip')?'pan':'cover',body=shellMesh(kind,set),face=pressedMesh(id),P=spec(set)[kind],n=STUDY.family==='tile'?192:80,bands=15,layer=(n+1)*(n+1),frontStart=2*layer+2*(n+1)*bands,firstCapIndex=2*n*n*6+2*n*(bands-1)*6,capIndexCount=n*(bands-1)*6,z0=-(kind==='pan'?P.l:P.body+P.neck)/2;
 const G=new Mesh(),reference=[],frontKeys=new Set(),poskey=p=>p.map(v=>Math.round(v*1e8)).join(','),t=SOURCE_CURVES[id];
 let centerY;if(kind==='pan'){let atCenter=t.outline.filter(p=>p[1]>0&&Math.abs(p[0])<.035);centerY=-(atCenter.length?Math.min(...atCenter.map(p=>p[1])):t.height_m/2)+.003;}
 const outlineXs=(t.outline||[]).map(p=>-p[0]),frontLeft=Math.min(...outlineXs)+.0012,frontRight=Math.max(...outlineXs)-.0012;
 const faceSection=x=>{let hits=[];for(let i=0;i<t.outline?.length;i++){let a=t.outline[i],b=t.outline[(i+1)%t.outline.length],ax=-a[0],bx=-b[0];if(x>=Math.min(ax,bx)-1e-12&&x<=Math.max(ax,bx)+1e-12&&Math.abs(bx-ax)>1e-12)hits.push(a[1]+(b[1]-a[1])*(x-ax)/(bx-ax)+centerY);}return hits.length?[Math.min(...hits),Math.max(...hits)]:null;};
 const topKnots=kind==='pan'?[frontLeft,...t.outline.filter(p=>-p[0]>frontLeft&&-p[0]<frontRight&&Math.abs(p[1]+centerY-faceSection(-p[0])[1])<1e-8).map(p=>-p[0]),frontRight].sort((a,b)=>a-b):[];
 const knotColumns=topKnots.map((x,i)=>[Math.round(i*n/(topKnots.length-1)),x]);
 const frontX=u=>{let col=(u+1)*n/2;for(let i=0;i<knotColumns.length-1;i++){let a=knotColumns[i],b=knotColumns[i+1];if(col<=b[0]+1e-6)return mix(a[1],b[1],clamp((col-a[0])/(b[0]-a[0])));}return frontRight;};
 for(let i=0;i<(n+1)*bands;i++)frontKeys.add(poskey(Array.from(body.p.slice((frontStart+i)*3,(frontStart+i)*3+3))));
 for(let i=0;i<body.p.length/3;i++){let p=Array.from(body.p.slice(i*3,i*3+3)),front=frontKeys.has(poskey(p)),m=Array.from(body.meta.slice(i*4,i*4+4));if(kind==='pan'){
   // The eave lip terminates on the drip's upper boundary, not above it as a residual triangular flange.
   // Morph the last 24 mm continuously into that shared edge; the rest is the original pan rule.
   let blend=front?1:1-smooth(0,.024,p[2]-z0),x=frontX(m[3])*(1-m[2]*.008),range=faceSection(x);
   if(range&&blend>0){let y=range[1]-.00005-m[2]*Math.min(P.t,Math.max(.0006,range[1]-range[0]-.00025));p[0]=mix(p[0],x,blend);p[1]=mix(p[1],y,blend);}
  }if(front)p[2]=z0;G.vertex(p,...m);reference.push(...body.reference.slice(i*3,i*3+3));}
 for(let j=0;j<body.idx.length;j+=3)if(j<firstCapIndex||j>=firstCapIndex+capIndexCount)G.tri(...body.idx.slice(j,j+3));
 let hole=[];for(let i=0;i<=n;i++)hole.push(frontStart+i*bands);for(let q=1;q<bands;q++)hole.push(frontStart+n*bands+q);for(let i=n-1;i>=0;i--)hole.push(frontStart+i*bands+bands-1);for(let q=bands-2;q>0;q--)hole.push(frontStart+q);
 const hp=hole.map(i=>[G.p[i*3],G.p[i*3+1]]);
 if(kind==='cover'){
  let low=-Infinity,high=Infinity,rx=t.width_m/2,ry=t.height_m/2;for(let [x,y]of hp){let d=ry*Math.sqrt(Math.max(0,1-(x/rx)**2));low=Math.max(low,y-d+.0003);high=Math.min(high,y+d-.0003);}centerY=clamp(P.h-ry+.003,Math.min(low,high),Math.max(low,high));
 }
 const faceBase=G.p.length/3;
 for(let i=0;i<face.frontCount;i++){let p=[-face.p[i*3],face.p[i*3+1]+centerY,z0-STUDY.depth/2-face.p[i*3+2]];G.vertex(p);reference.push(...p);}
 for(let j=0;j<face.frontIndexCount;j+=3)G.tri(...Array.from(face.idx.slice(j,j+3)).map(i=>i+faceBase));
 // Ordered outer face boundary, retaining the supplied silhouette exactly.
 const next=new Map(face.frontBoundary),start=face.frontBoundary[0][0],outer=[];let at=start;
 do{outer.push(at);at=next.get(at);if(at===undefined)throw Error('Pressed face boundary is not continuous');}while(at!==start&&outer.length<=next.size);
 let back=[];
 for(let i of outer){let p=[-face.p[i*3],centerY+face.p[i*3+1],z0];back.push(G.vertex(p));reference.push(...p);}
 for(let i=0;i<outer.length;i++){let j=(i+1)%outer.length;G.quad(faceBase+outer[i],back[i],faceBase+outer[j],back[j]);}
 const fp=back.map(i=>[G.p[i*3],G.p[i*3+1]]),simplify=poly=>{let p=poly.slice();if(Math.hypot(p[0][0]-p.at(-1)[0],p[0][1]-p.at(-1)[1])<1e-10)p.pop();let changed=true;while(changed&&p.length>3){changed=false;for(let i=0;i<p.length;i++){let a=p[(i-1+p.length)%p.length],b=p[i],c=p[(i+1)%p.length],dx=c[0]-a[0],dy=c[1]-a[1],len=Math.hypot(dx,dy);if(len>1e-12&&Math.abs((b[0]-a[0])*dy-(b[1]-a[1])*dx)/len<1e-8&&(b[0]-a[0])*(b[0]-c[0])+(b[1]-a[1])*(b[1]-c[1])<=0){p.splice(i,1);changed=true;i--;}}}return p;};
 const facePoly=[simplify(fp)],holePoly=[simplify(hp)],backRegion=polygonClipping.difference(facePoly,holePoly),frontRegion=polygonClipping.difference(holePoly,facePoly),common=polygonClipping.intersection(facePoly,holePoly),preCapIndexCount=G.idx.length;
 const allBoundary=fp.concat(hp,backRegion.flat(2),frontRegion.flat(2)),candidates=new Map();for(let p of allBoundary)candidates.set(p.map(v=>Math.round(v*1e9)).join(','),p);let boundary=Array.from(candidates.values());
 const onEdge=(a,b,pts)=>{let dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;if(len<1e-20)return[];let out=[];for(let p of pts){let u=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len;if(u>1e-6&&u<1-1e-6&&Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)/Math.sqrt(len)<1.1e-8)out.push([u,p]);}return out.sort((a,b)=>a[0]-b[0]).filter((p,i,a)=>!i||p[0]-a[i-1][0]>1e-6);};
 const cap=(regions,sign)=>{for(let region of regions){let rings=region.map(simplify),points=rings.flat(),holes=[],cursor=rings[0].length,edgeMap=new Map();for(let k=1;k<rings.length;k++){holes.push(cursor);cursor+=rings[k].length;}let offset=0;for(let ring of rings){for(let i=0;i<ring.length;i++){let a=offset+i,b=offset+(i+1)%ring.length;edgeMap.set(a+','+b,true);edgeMap.set(b+','+a,true);}offset+=ring.length;}let ix=triangulateHoles(points.flat(),holes,2);
   for(let j=0;j<ix.length;j+=3){let ids=ix.slice(j,j+3),p=ids.map(i=>points[i]),center=[(p[0][0]+p[1][0]+p[2][0])/3,(p[0][1]+p[1][1]+p[2][1])/3,z0],c=G.vertex(center);reference.push(...center);
    for(let k=0;k<3;k++){let ia=ids[k],ib=ids[(k+1)%3],a=points[ia],b=points[ib],chain=[a,...(edgeMap.has(ia+','+ib)?onEdge(a,b,boundary).map(v=>v[1]):[]),b],idx=chain.map(p=>{let v=G.vertex([...p,z0]);reference.push(...p,z0);return v;});for(let l=0;l<idx.length-1;l++)sign>0?G.tri(c,idx[l],idx[l+1]):G.tri(c,idx[l+1],idx[l]);}
   }
  }};
 cap(backRegion,1);cap(frontRegion,-1);
 // Split the existing carrier/plate rim triangles wherever the planar union inserted a crossing.
 let original=G.idx.slice(0,preCapIndexCount),after=G.idx.slice(preCapIndexCount);G.idx=[];
 for(let j=0;j<original.length;j+=3){let ids=original.slice(j,j+3),done=false;for(let k=0;k<3;k++){let ia=ids[k],ib=ids[(k+1)%3],ic=ids[(k+2)%3],a=G.p.slice(ia*3,ia*3+3),b=G.p.slice(ib*3,ib*3+3);if(a[2]!==z0||b[2]!==z0)continue;let chain=onEdge(a,b,boundary);if(!chain.length)continue;let prev=ia;for(let [u,p]of chain){let m=Array.from({length:4},(_,k)=>mix(G.meta[ia*4+k],G.meta[ib*4+k],u)),v=G.vertex([...p,z0],...m);reference.push(...[0,1,2].map(k=>mix(reference[ia*3+k],reference[ib*3+k],u)));G.tri(prev,v,ic);prev=v;}G.tri(prev,ib,ic);done=true;break;}if(!done)G.tri(...ids);}
 for(let i of after)G.idx.push(i);
 let joinedArea=common.reduce((sum,poly)=>sum+Math.abs(area2(poly[0]))/2-poly.slice(1).reduce((s,r)=>s+Math.abs(area2(r))/2,0),0);G.qaPolygons={hp,fp,frontRegion,backRegion};
 G.finish();G.reference=new Float32Array(reference);G.definition={id,kind:'pressed face united with actual carrier cross-section',carrier:kind,set,faceSource:t.source,sourceFaceWidth_m:t.width_m,depth_m:STUDY.depth,relief_m:STUDY.relief,junctionArea_m2:joinedArea,exposedCarrierEndArea_m2:frontRegion.reduce((s,p)=>s+Math.abs(area2(p[0]))/2-p.slice(1).reduce((a,r)=>a+Math.abs(area2(r))/2,0),0),eaveLip:kind==='pan'?'shared upper boundary with source drip; 24 mm continuous transition':'source round face',backShapeStatus:'planar joint assumption; rear profile unmeasured',separateFloatingParts:0,construction:'both internal end caps removed in overlap; visible source silhouette preserved',unit:'m'};END_CACHE.set(key,G);return G;
}
let woodSampler=null;
function sampleWoodGrain(raw,round,radius){
 if(typeof document==='undefined')return new Float32Array(raw.positions.length/3);
 if(!woodSampler){
  const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2',{antialias:false,preserveDrawingBuffer:true});if(!gl)throw Error('Wood geometry sampler requires WebGL2');
  const src=TimberOriginal.fragmentShaderSource,decl=src.slice(src.indexOf('uniform vec3 u_cameraPosition'),src.indexOf('out vec4 outColor')),func=src.slice(src.indexOf('const float PI'),src.indexOf('void main()')).replaceAll('fwidth(coordinate)','0.035');
  const vs='#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}',fs='#version 300 es\nprecision highp float;precision highp int;'+decl+func+'\nuniform sampler2D gpTex;uniform sampler2D gnTex;out vec4 result;void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec4 gp=texelFetch(gpTex,p,0);vec3 n=texelFetch(gnTex,p,0).xyz;vec4 s=woodSignals(gp.xyz*max(u_textureScale,.001),normalize(n),gp.w);float h=(s.y-.5)*.0009+(s.z-.5)*.0003-s.w*.0003;float v=floor(clamp((h+.002)/.004,0.,1.)*65535.+.5);result=vec4(floor(v/256.)/255.,mod(v,256.)/255.,0.,1.);}';
  const shader=(type,s)=>{let sh=gl.createShader(type);gl.shaderSource(sh,s);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;},program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));woodSampler={canvas,gl,program};
 }
 const {canvas,gl,program}=woodSampler,count=raw.positions.length/3,w=256,h=Math.ceil(count/w);canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);gl.useProgram(program);gl.disable(gl.DITHER);bindWood(gl,program,{round,radius},[0,0,0]);let textures=[];
 for(let [slot,key,name]of [[0,'grainPositions','gpTex'],[1,'normals','gnTex']]){let data=new Float32Array(w*h*4);for(let i=0;i<count;i++){data.set(raw[key].slice(i*3,i*3+3),i*4);data[i*4+3]=raw.surfaceClasses[i];}let tex=gl.createTexture();textures.push(tex);gl.activeTexture(gl.TEXTURE0+slot);gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,w,h,0,gl.RGBA,gl.FLOAT,data);gl.uniform1i(gl.getUniformLocation(program,name),slot);}
 gl.drawArrays(gl.TRIANGLES,0,3);let pixels=new Uint8Array(w*h*4),out=new Float32Array(count);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);if(gl.getError())throw Error('Wood field readback failed');for(let i=0;i<count;i++)out[i]=(pixels[i*4]*256+pixels[i*4+1])/65535*.004-.002;for(let tex of textures)gl.deleteTexture(tex);return out;
}
