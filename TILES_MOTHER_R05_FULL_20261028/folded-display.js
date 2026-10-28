const FOLDED_TILE_CACHE=new Map();
function foldedTileMesh09N(outerHalf,innerHalf,outerRise,innerRise,innerDrop,depth){
 const key=[outerHalf,innerHalf,outerRise,innerRise,innerDrop,depth,settings.micStrength,settings.micScale].join('/');if(FOLDED_TILE_CACHE.has(key))return FOLDED_TILE_CACHE.get(key);
 const e=TilesFolded.create({library:SHEET_LIBRARY,outerHalf,innerHalf,outerRise,innerRise,innerDrop,depth,strength:settings.micStrength,scale:settings.micScale}),G=new Mesh(),reference=[],indices=new Map(),U=96,V=8,Q=4;
 function vertex(u,v,q){let key=[u,v,q].map(x=>Math.round(x*1e8)).join('/');if(indices.has(key))return indices.get(key);let p=e.position(2*u-1,v,q),r=e.materialPoint(2*u-1,v,q),i=G.vertex(p,1,3,q,2*u-1);reference.push(...r);indices.set(key,i);return i}
 function grid(A,B,point,flip){let rows=[];for(let j=0;j<=B;j++){let row=[];for(let i=0;i<=A;i++)row.push(vertex(...point(i/A,j/B)));rows.push(row)}for(let j=0;j<B;j++)for(let i=0;i<A;i++)G.quad(rows[j][i],rows[j][i+1],rows[j+1][i],rows[j+1][i+1],flip)}
 for(const q of [0,1])grid(U,V,(u,v)=>[u,v,q],q===0);
 // Here v runs from the upper outer surface toward the lower inner surface.
 for(const v of [0,1])grid(U,Q,(u,q)=>[u,v,q],v===1);
 for(const u of [0,1])grid(V,Q,(v,q)=>[u,v,q],u===0);
 G.finish();G.reference=new Float32Array(reference);G.definition={kind:'D5 folded tile',continuous:e.definition()};FOLDED_TILE_CACHE.set(key,G);return G;
}
