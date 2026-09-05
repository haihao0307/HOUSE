()=>{
 const D=window.__tilesDebug,R=D.getRoof();if(!R)return null;
 const pairs=[],fail=[],tiles=R.panFits.map((f,i)=>f?{f,id:i,type:'pan',r:Math.floor(i/R.cols),c:i%R.cols}:null).filter(Boolean).concat(R.coverFits.map((f,i)=>f?{f,id:i,type:'cover',r:Math.floor(i/(R.cols-1)),c:i%(R.cols-1)}:null).filter(Boolean));
 let pairCount=0,minGap=Infinity,adjacentCount=0;
 const record=(name,gap)=>{if(!Number.isFinite(gap))return;pairCount++;minGap=Math.min(minGap,gap);if(gap<-.00005)fail.push({pair:name,gapMm:gap*1000});};
 for(let i=0;i<tiles.length;i++){
   const a=tiles[i],A=a.f.proxy;
   for(let j=0;j<i;j++){const b=tiles[j],B=b.f.proxy;if(A.xmax<B.xmin||B.xmax<A.xmin||A.zmax<B.zmin||B.zmax<A.zmin)continue;
     let upper=a,lower=b;if(a.type==='pan'&&b.type==='cover'){upper=b;lower=a;}else if(a.type===b.type&&a.r<b.r){upper=b;lower=a;}
     let g=D.exactGap(upper.f.proxy,lower.f.proxy).gap;
     if(a.type===b.type&&a.c!==b.c){g=Math.max(g,D.exactGap(lower.f.proxy,upper.f.proxy).gap);adjacentCount++;}
     record(`${upper.type}${upper.id}/${lower.type}${lower.id}`,g);
   }
   for(let j=0;j<R.timber.beams.length;j++){record(`${a.type}${a.id}/beam${j}`,D.exactGap(A,R.timber.beams[j].proxy).gap);}
   for(let j=0;j<R.timber.rafters.length;j++){const B=R.timber.rafters[j].proxy;if(A.xmax<B.xmin||B.xmax<A.xmin)continue;record(`${a.type}${a.id}/rafter${j}`,D.exactGap(A,B).gap);}
 }
 let woodMinGap=Infinity,woodMaxSeatGap=0;
 for(let c=0;c<R.timber.rafters.length;c++)for(let b=0;b<R.timber.beams.length;b++){const gap=D.exactGap(R.timber.rafters[c].proxy,R.timber.beams[b].proxy).gap;if(Number.isFinite(gap)){woodMinGap=Math.min(woodMinGap,gap);woodMaxSeatGap=Math.max(woodMaxSeatGap,gap);}record(`rafter${c}/beam${b}`,gap);}
 const seen=new Set(),geometry=[];D.stageRoot.traverse(o=>{const g=o.geometry;if(!g||seen.has(g))return;seen.add(g);if(g.userData.kind==='round-timber')geometry.push({kind:'timber',qa:D.woodUVGate(g)});else if(g.userData.kind==='pan'||g.userData.kind==='cover')geometry.push({kind:g.userData.kind,qa:D.uvGate(g)});});
 return {pairCount,adjacentCount,minGapMm:minGap*1000,woodMinGapMm:woodMinGap*1000,woodMaxSeatGapMm:woodMaxSeatGap*1000,penetrations:fail,actualGeometryGroups:geometry.length,geometryFailures:geometry.filter(x=>!x.qa.allPassed),bodyReadiness:document.body.dataset.ready};
}
