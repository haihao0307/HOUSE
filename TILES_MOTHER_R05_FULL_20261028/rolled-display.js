const ROLLED_TILE_CACHE=new Map();
function rolledTileMesh09N(outer,inner,length,angle,geometryGain=.35){
 const key=[outer,inner,length,angle,geometryGain,settings.micStrength,settings.micScale].join('/');if(ROLLED_TILE_CACHE.has(key))return ROLLED_TILE_CACHE.get(key);
 const e=TilesRolled.create({library:SHEET_LIBRARY,outer,inner,length,angle,geometryGain,strength:settings.micStrength,scale:settings.micScale}),G=new Mesh(),reference=[],N=128,T=length>.5?96:48,B=4,closed=Math.abs(angle-2*Math.PI)<1e-8,C=closed?N:N+1;
 const indices=new Map();function vertex(u,t,q){let key=[u,t,q].map(x=>Math.round(x*1e8)).join('/');if(indices.has(key))return indices.get(key);let p=e.position(u,t,q),r=e.materialPoint(u,t,q),i=G.vertex(p,1,3,q,u);reference.push(...r);indices.set(key,i);return i}
 const surface=[];
 for(const q of [0,1]){
  let grid=[];for(let j=0;j<=T;j++){let row=[];for(let i=0;i<C;i++)row.push(vertex(-1+2*i/N,j/T,q));grid.push(row)}
  for(let j=0;j<T;j++)for(let i=0;i<N;i++){let k=closed?(i+1)%N:i+1;G.quad(grid[j][i],grid[j][k],grid[j+1][i],grid[j+1][k],q===1)}surface.push(grid);
 }
 for(const end of [0,T]){
  let layers=[surface[0][end]];
  for(let b=1;b<B;b++){let row=[];for(let i=0;i<C;i++)row.push(vertex(-1+2*i/N,end/T,b/B));layers.push(row)}layers.push(surface[1][end]);
  for(let b=0;b<B;b++)for(let i=0;i<N;i++){let k=closed?(i+1)%N:i+1;G.quad(layers[b][i],layers[b+1][i],layers[b][k],layers[b+1][k],end===T)}
 }
 if(!closed)for(const side of [0,N]){
  let layers=[surface[0].map(row=>row[side])];
  for(let b=1;b<B;b++){let row=[];for(let j=0;j<=T;j++)row.push(vertex(-1+2*side/N,j/T,b/B));layers.push(row)}layers.push(surface[1].map(row=>row[side]));
  for(let b=0;b<B;b++)for(let j=0;j<T;j++)G.quad(layers[b][j],layers[b][j+1],layers[b+1][j],layers[b+1][j+1],side===N);
 }
 G.finish();G.reference=new Float32Array(reference);G.definition={kind:closed?'hollow eye tile':'ridge baotong independent arch profile',continuous:e.definition(),status:'source profile interpretation; dimensions unmeasured'};ROLLED_TILE_CACHE.set(key,G);return G;
}
