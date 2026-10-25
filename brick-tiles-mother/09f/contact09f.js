function roofBase09F(panAngle,seat){
 const slope=seat.rise/seat.step,p=spec();let minimum=Infinity;
 for(let kind of ['pan','cover']){let mesh=shellMesh(kind),m=kind==='pan'?M.rx(panAngle):M.mul(M.translate(0,seat.coverY,seat.phase),M.mul(M.rz(seat.roll),M.rx(seat.angle)));for(let i=0;i<mesh.p.length;i+=3){let q=M.transform(m,Array.from(mesh.p.slice(i,i+3)));minimum=Math.min(minimum,q[1]-slope*q[2])}}
 return Math.max(.101,.060+slope*p.pan.l/2-minimum+.002);
}
// Explicit tile termination at obstructing column face; no collision masking.
function clipTileAtColumn09F(mesh,m,xLimit){
 const G=new Mesh(),reference=[],segments=[],dist=p=>M.transform(m,p)[0]-xLimit,key=p=>p.map(x=>Math.round(x*1e7)).join(','),nodes=new Map();
 const sample=i=>({p:Array.from(mesh.p.slice(i*3,i*3+3)),meta:Array.from(mesh.meta.slice(i*4,i*4+4)),ref:Array.from((mesh.reference||mesh.p).slice(i*3,i*3+3))});
 const blend=(a,b,t)=>({p:a.p.map((v,k)=>mix(v,b.p[k],t)),meta:a.meta.map((v,k)=>mix(v,b.meta[k],t)),ref:a.ref.map((v,k)=>mix(v,b.ref[k],t))});
 const vertex=a=>{let i=G.vertex(a.p,...a.meta);reference.push(...a.ref);return i};
 for(let j=0;j<mesh.idx.length;j+=3){let tri=Array.from(mesh.idx.slice(j,j+3)).map(sample),poly=[],cuts=[];for(let k=0;k<3;k++){let a=tri[k],b=tri[(k+1)%3],da=dist(a.p),db=dist(b.p);if(da<=0)poly.push(a);if((da<=0)!==(db<=0)){let c=blend(a,b,da/(da-db));poly.push(c);cuts.push(c)}}if(poly.length>=3){let ids=poly.map(vertex);for(let k=1;k<ids.length-1;k++)G.tri(ids[0],ids[k],ids[k+1])}if(cuts.length===2){let a=key(cuts[0].p),b=key(cuts[1].p);if(a!==b){nodes.set(a,cuts[0]);nodes.set(b,cuts[1]);segments.push([a,b])}}}
 const adj=new Map();for(let [a,b]of segments){if(!adj.has(a))adj.set(a,[]);if(!adj.has(b))adj.set(b,[]);adj.get(a).push(b);adj.get(b).push(a)}let used=new Set(),rings=[];
 for(let first of adj.keys()){if(used.has(first))continue;let ring=[],prev=null,cur=first;for(let guard=0;guard<segments.length+2;guard++){if(used.has(cur))break;used.add(cur);ring.push(nodes.get(cur));let next=(adj.get(cur)||[]).find(x=>x!==prev);prev=cur;cur=next;if(cur===first)break;}if(cur!==first)throw Error('Open tile clipping contour');if(ring.length>=3)rings.push(ring)}
 const projected=ring=>ring.map(v=>{let p=M.transform(m,v.p);return[p[1],p[2]]}),info=rings.map(r=>({r,p:projected(r)}));info.sort((a,b)=>Math.abs(area2(b.p))-Math.abs(area2(a.p)));
 let roots=[];for(let q of info){let parent=roots.find(r=>inside2(q.p[0],r.p));if(parent)parent.holes.push(q);else roots.push({...q,holes:[]})}
 for(let r of roots){let all=[r,...r.holes],flat=all.flatMap(q=>q.r),coords=all.flatMap(q=>q.p.flat()),holes=[],offset=r.r.length;for(let q of r.holes){holes.push(offset);offset+=q.r.length}let ids=flat.map(v=>vertex({...v,meta:[0,mesh.definition.kind==='pan'?1:2,.5,0]})),ix=triangulateHoles(coords,holes,2);for(let k=0;k<ix.length;k+=3){let a=ids[ix[k]],b=ids[ix[k+1]],c=ids[ix[k+2]],p=[a,b,c].map(i=>M.transform(m,Array.from(G.p.slice(i*3,i*3+3)))),n=V.cross(V.sub(p[1],p[0]),V.sub(p[2],p[0]));G.tri(a,...(n[0]>0?[b,c]:[c,b]))}}
 G.finish();G.reference=new Float32Array(reference);G.definition={...mesh.definition,kind:'tile cut at column face',originalKind:mesh.definition.kind,columnFaceWorldX:xLimit,cutStatus:'explicit display termination, original hidden detail unmeasured',closedCap:true};return G;
}
function resolveColumnTileEnds09F(workshop,id){
 let limit=id==='mainHouse'?-.118:id==='sideHouse'?-.088:null,maxY=id==='mainHouse'?4.5:3.8;if(limit===null)return;
 let additions=[];for(let [name,g]of workshop.groups){if(!['pan','cover'].includes(g.mesh.definition?.kind))continue;let keep=[];for(let [i,it]of g.items.entries()){let center=M.transform(it.m,[0,0,0]);if(center[1]>=maxY){keep.push(it);continue}let max=-Infinity;for(let j=0;j<g.mesh.p.length;j+=3)max=Math.max(max,M.transform(it.m,Array.from(g.mesh.p.slice(j,j+3)))[0]);if(max<=limit){keep.push(it);continue}let cut=clipTileAtColumn09F(g.mesh,it.m,limit);additions.push([name+'-column-cut-'+i,{...g,mesh:cut,items:[it]}]);let record=workshop.records.find(r=>r.kind===name&&r.m.every((v,k)=>v===it.m[k]));if(record)record.geometry=cut.definition;}g.items=keep;}
 for(let [key,g]of additions)workshop.groups.set(key,g);workshop.definition.columnTileTermination={columnFaceOffsetM:.003,cutTiles:additions.length,method:'closed planar cut outside column face',structuralProof:false};
}
