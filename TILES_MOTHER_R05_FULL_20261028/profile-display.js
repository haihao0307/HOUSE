// Temporary display sampling of the continuous elliptic-sheet rule.
const PROFILE_TILE_CACHE=new Map();
function profileTileMesh09N(rx,ry,depth){
 const key=[rx,ry,depth,settings.micStrength,settings.micScale].join('/');if(PROFILE_TILE_CACHE.has(key))return PROFILE_TILE_CACHE.get(key);
 const e=TilesProfile.create({library:SHEET_LIBRARY,rx,ry,depth,waveStrength:settings.micStrength,waveScale:settings.micScale}),G=new Mesh(),reference=[],N=96,R=24;
 function vertex(u,t,q){const p=e.position(u,t,q),ref=e.materialPoint(u,t,q),i=G.vertex(p,1,3,q,u);reference.push(...ref);return i}
 const sides=[];
 for(const q of [0,1]){
  const center=vertex(0,.5,q);let prior=null;
  for(let j=1;j<=R;j++){
   const rad=j/R,row=[];for(let i=0;i<N;i++){let a=i*Math.PI*2/N;row.push(vertex(rad*Math.cos(a),.5+rad*Math.sin(a)/2,q))}
   if(!prior){for(let i=0;i<N;i++){let k=(i+1)%N;q===0?G.tri(center,row[i],row[k]):G.tri(center,row[k],row[i]);}}
   else for(let i=0;i<N;i++){let k=(i+1)%N;if(q===0){G.tri(prior[i],row[i],row[k]);G.tri(prior[i],row[k],prior[k])}else{G.tri(prior[i],row[k],row[i]);G.tri(prior[i],prior[k],row[k])}}
   prior=row;
  }
  sides.push(prior);
 }
 for(let i=0;i<N;i++){let k=(i+1)%N;G.quad(sides[0][i],sides[1][i],sides[0][k],sides[1][k])}
 G.finish();G.reference=new Float32Array(reference);G.definition={kind:'elliptic tile',continuous:e.definition()};PROFILE_TILE_CACHE.set(key,G);return G;
}
