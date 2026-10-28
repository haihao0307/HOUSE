const BAND_TILE_CACHE=new Map();
function bandTileMesh09N(curve,x0,x1,y,thick,depth){
 const key=[curve,x0,x1,y,thick,depth,settings.micStrength,settings.micScale].join('/');if(BAND_TILE_CACHE.has(key))return BAND_TILE_CACHE.get(key);
 const e=TilesBand.create({library:SHEET_LIBRARY,curve,x0,x1,y,thick,depth,strength:settings.micStrength,scale:settings.micScale}),G=new Mesh(),reference=[],indices=new Map(),U=120,V=8,Q=4;
 function vertex(u,v,q){let key=[u,v,q].map(x=>Math.round(x*1e8)).join('/');if(indices.has(key))return indices.get(key);let p=e.position(u,v,q),r=e.materialPoint(u,v,q),i=G.vertex(p,1,3,q,2*u-1);reference.push(...r);indices.set(key,i);return i}
 function grid(A,B,point,flip){let rows=[];for(let j=0;j<=B;j++){let row=[];for(let i=0;i<=A;i++)row.push(vertex(...point(i/A,j/B)));rows.push(row)}for(let j=0;j<B;j++)for(let i=0;i<A;i++)G.quad(rows[j][i],rows[j][i+1],rows[j+1][i],rows[j+1][i+1],flip)}
 for(const q of [0,1])grid(U,V,(u,v)=>[u,v,q],q===1);
 for(const v of [0,1])grid(U,Q,(u,q)=>[u,v,q],v===0);
 for(const u of [0,1])grid(V,Q,(v,q)=>[u,v,q],u===1);
 G.finish();G.reference=new Float32Array(reference);G.definition={kind:'curved tile band',continuous:e.definition()};BAND_TILE_CACHE.set(key,G);return G;
}
