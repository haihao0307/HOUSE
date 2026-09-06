// User-directed neglect scenario. Counts describe in-service pieces, not a
// calibrated building lifetime. No dynamic collision or gravity solver is claimed.
function lossFraction(year){let keys=[[0,0],[3,.0023],[5,.015],[7,.13],[10,.65],[15,1]];for(let i=1;i<keys.length;i++)if(year<=keys[i][0]){let a=keys[i-1],b=keys[i],t=smooth(a[0],b[0],year);return mix(a[1],b[1],t)}return 1}
function roofState(rows,cols,year,care,seed){
 const N=rows*cols,risk=Array.from({length:N},(_,id)=>{let r=Math.floor(id/cols),c=id%cols;return{id,v:.57*noise(c*.42,r*.38,seed+97)+.43*hash(id*1709+seed+97)}}).sort((a,b)=>b.v-a.v),rank=new Int32Array(N);risk.forEach((it,i)=>rank[it.id]=i);
 const lost=new Uint8Array(N),cracked=new Float32Array(N),beams=new Float32Array(4*cols),rafters=new Float32Array((cols+1)*rows),detached=new Uint8Array((cols+1)*rows);
 const loss=care?0:lossFraction(year),n=Math.round(N*loss);for(let id=0;id<N;id++){lost[id]=rank[id]<n?1:0;cracked[id]=(care||year===0)?0:clamp((loss+.025*smooth(0,5,year)-rank[id]/N)/.035)}
 // Each lower member has its own exposure/dose. No multiplication by rafter loss.
 const decay=care?0:smooth(4.8,12.5,year);
 for(let b=0;b<4;b++)for(let c=0;c<cols;c++){
  let wet=.45+.55*noise(c*.41,b*.71,seed+509);beams[b*cols+c]=clamp(decay*wet*1.62);
 }
 for(let r=0;r<rows;r++)for(let c=0;c<=cols;c++){
  let leak=0;for(let cc of [c-1,c])if(cc>=0&&cc<cols)leak=Math.max(leak,lost[r*cols+cc]);
  let d=clamp(decay*(.52+.66*noise(c*.41,r*.23,seed+77))+leak*smooth(3,10,year)*.20),i=c*rows+r;rafters[i]=d;
  let b=Math.min(2,Math.floor(r/(rows-1)*3)),cc=Math.min(cols-1,c),b0=beams[b*cols+cc],b1=beams[(b+1)*cols+cc];
  detached[i]=(d>.77||b0>.81||b1>.81)?1:0;
 }
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)if(detached[c*rows+r]||detached[(c+1)*rows+r])lost[r*cols+c]=1;
 let visibleCover=[];for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  // Restore all 21 seam covers on the 28-pan inspection cut: 49 including the
  // top cover missing in Clean01. The full roof remains 440 pans + 420 covers.
  if(c===cols-1)continue;
  if(!lost[r*cols+c]&&(c===cols-1||!lost[r*cols+c+1]))visibleCover.push([r,c]);
 }
 return {lost,cracked,beams,rafters,detached,rank,visibleCover,panLive:N-lost.reduce((a,b)=>a+b,0),total:rows*(2*cols-1)};
}
class Workshop{
 constructor(renderer){this.r=renderer;this.geometries=new Map();this.stateCache=new Map();this.generation=0;
  this.p=this.geo('pan',()=>ceramic('pan'));this.c=this.geo('cover',()=>ceramic('cover'));
  this.seats=SEATS;this.seatingMs=0;
 }
 geo(id,build){if(!this.geometries.has(id))this.geometries.set(id,build());return this.geometries.get(id)}
 build(s){let start=performance.now();this.r.clear();this.groups=new Map();this.generation++;
  for(let key of this.geometries.keys())if(key.startsWith('decay'))this.geometries.delete(key);this.records=[];this.stats={originalTiles:0,panLive:0,coverLive:0,missing:0,failedBeamSegments:0,failedRafterSegments:0,mossPatches:0};
  const add=(id,mesh,type,m,seed=23,damage=0,tint=.5,offset=0,cast=true)=>{if(!this.groups.has(id))this.groups.set(id,{mesh,type,cast,items:[]});this.groups.get(id).items.push({m,s:[3+hash(seed)*97,damage,tint,offset]});};
  const floor=this.geo('floor',floorMesh),S=this.seats;
  if(s.scene==='roof48'||s.scene==='roof860'){
   let rows=s.scene==='roof860'?20:7,cols=s.scene==='roof860'?22:4,key=[rows,cols,s.year,s.care,s.seed].join('/'),history=this.stateCache.get(key);
   this.cacheHit=!!history;if(!history){history=roofState(rows,cols,s.year,s.care,s.seed);this.stateCache.set(key,history);if(this.stateCache.size>2)this.stateCache.delete(this.stateCache.keys().next().value)}
   let lift=rows===20?.85:.32,group=M.mul(M.translate(0,lift,0),M.rx(-.36)),z0=-(rows-1)*S.step*.5,x0=-(cols-1)*S.spacing*.5;
   let mossMax=rows===20?160:36;
   for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    let id=r*cols+c;if(history.lost[id])continue;
    let m=M.mul(group,tileModel('pan',x0+c*S.spacing,S.panY,z0+r*S.step));let seed=s.seed+id*1777;
    add('pan',this.p,0,m,seed,history.cracked[id],hash(seed+911));this.records.push({kind:'pan',row:r,col:c,m:Array.from(m),seed});
    const growth=s.care?.10:smooth(1,10,s.year),humidity=.25+.75*noise(c*.32,r*.23,s.seed+397);
    let coverage=s.moss*growth;
    // state.w shares the local wet-region bias with the ceramic and moss shaders.
    this.groups.get('pan').items.at(-1).s[3]=humidity;
    if(coverage>.05&&hash(seed+719)<coverage*.72*humidity&&this.stats.mossPatches<mossMax){
     let v=id%6,g=this.geo('mossPan'+v,()=>mossPatch('pan',197+v,[.45-v%3*.40,.35+Math.floor(v/3)*.35],.034,s.mossHeight));
     add('mossPan'+v,g,2,m,seed);this.stats.mossPatches++}

   }
   for(let [r,c] of history.visibleCover){let seed=s.seed+1777*(r*cols+c)+389,m=M.mul(group,tileModel('cover',x0+(c+.5)*S.spacing,S.coverY,z0+r*S.step+S.coverPhase));add('cover',this.c,0,m,seed,0,hash(seed+317),.25+.75*noise(c*.32,r*.23,s.seed+397));this.records.push({kind:'cover',row:r,col:c,m:Array.from(m),seed})}
   // Only generate contiguous surviving lengths. No equally spaced fake saw-cuts.
   const runs=(values,failed,emit)=>{let start=0;while(start<values.length){while(start<values.length&&failed(start))start++;if(start===values.length)break;let end=start;while(end+1<values.length&&!failed(end+1))end++;emit(start,end,values.slice(start,end+1));start=end+1}};
   const putWood=(id,values,failed,axis,seed)=>runs(values,failed,(start,end,doses)=>{
    let damaged=doses.some(d=>d>.06),broken=start>0||end<values.length-1;
    let len=(end-start+1)*(axis===0?S.step:S.spacing)+(broken?-.006:.06),pos=axis===0?z0+(start+end)*S.step*.5:x0+(start+end)*S.spacing*.5;
    let x=axis===0?x0+(id-.5)*S.spacing:pos,z=axis===0?pos:mix(z0-.02,-z0+.02,(id-100)/3),rad=axis===0?S.rafterRadius:.037,y=axis===0?0:-S.rafterRadius-.037;
    const bearings=axis===0?Array.from({length:4},(_,b)=>[(mix(z0-.02,-z0+.02,b/3)-pos)/len+.5,.040/len]):[];
    let gid=damaged||broken?'decay'+id+'/'+start:'woodIntact',g=this.geo(gid,()=>timber(broken,seed,doses,bearings));
    add(gid,g,1,M.mul(group,model(x,y,z,0,axis===0?0:Math.PI/2,[rad,rad,len])),seed,Math.max(...doses),.5,pos);
   });
   for(let c=0;c<=cols;c++){let d=Array.from(history.rafters.slice(c*rows,(c+1)*rows));putWood(c,d,r=>!!history.detached[c*rows+r],0,s.seed+c*277)}
   for(let b=0;b<4;b++){let d=Array.from(history.beams.slice(b*cols,(b+1)*cols));putWood(100+b,d,c=>d[c]>.81,1,s.seed+b*811)}
   this.stats={...this.stats,originalTiles:history.total,panLive:history.panLive,coverLive:history.visibleCover.length,missing:history.total-history.panLive-history.visibleCover.length,failedBeamSegments:Array.from(history.beams).filter(x=>x>.81).length,failedRafterSegments:history.detached.reduce((a,b)=>a+b,0)};
   this.history=history;this.bounds={center:[0,lift,0],radius:rows===20?3.8:1.1};this.fit={target:[0,lift-.02,0],distance:rows===20?10.5:2.7,yaw:-2.53,pitch:.66};
   add('floor',floor,3,model(0,-.07,0,0,0,[50,1,50]),0,0,0,0,false);
  }else if(s.scene==='wood'){
   let wd=s.care?0:smooth(0,15,s.year)*.82;const g=this.geo('decaySpecimen',()=>timber(!!s.fracture,81,[wd*.55,wd,wd*.7])),m=model(0,.046,0,-.035,-.23,[.04,.04,.44]);
   add('wood',g,1,m,s.seed,wd,.5);this.bounds={center:[0,.045,0],radius:.34};this.fit={target:[0,.045,0],distance:.80,yaw:-.80,pitch:.72};
   add('floor',floor,3,model(0,-.006,0,0,0,[2,1,2]),0,0,0,0,false);
  }else{
   let trio=s.scene==='trio',kind=s.scene==='cover'?'cover':'pan';
   let tiles=trio?[{kind:'pan',x:-.275,z:0,seed:s.seed},{kind:'pan',x:0,z:.014,seed:s.seed+314},{kind:'cover',x:.244,z:.02,seed:s.seed+1231}]:[{kind,x:0,z:0,seed:s.seed}];
   for(let t of tiles){
    const parts=s.fracture?[1,2]:[0];for(let piece of parts){let g=this.geo(t.kind+'p'+piece,()=>ceramic(t.kind,23,piece)),offset=s.fracture?(piece===1?-.009:.009)*s.fracture:0;
     let m=model(t.x,.015+(piece===2?.002:0),t.z+offset,0,piece===2?.03*s.fracture:0);
     add(t.kind+'p'+piece,g,0,m,t.seed,s.fracture?.9:0,hash(t.seed+317));
     if(s.moss>0&&piece!==1){for(let k=0;k<3;k++){let g=this.geo(t.kind+'m'+k,()=>mossPatch(t.kind,129+k,[.53-k*.43,.76-k*.05],.023,s.mossHeight));add(t.kind+'m'+k,g,2,m,t.seed+k*3);this.stats.mossPatches++}}
    }
   }
   this.stats.originalTiles=tiles.length;this.bounds={center:[0,.036,0],radius:trio?.56:.23};this.fit={target:[trio?-.008:0,.025,0],distance:trio?1.43:.67,yaw:-.57,pitch:.69};
   add('floor',floor,3,model(0,-.003,0,0,0,[2,1,2]),0,0,0,0,false);
  }
  for(let g of this.groups.values())this.r.add(g.mesh,g.items,g.type,g.cast);
  this.buildMs=performance.now()-start;return this.stats;
 }
}
