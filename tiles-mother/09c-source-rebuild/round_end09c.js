// D7 plain round head: the side drawing has an inclined plate, not a vertical disc.
function roundEnd09C(){
 const id='plainD7',oldDepth=STUDY.depth,oldRelief=STUDY.relief;
 SOURCE_CURVES[id]={source:'D7',kind:'round',source_box_px:[235,638,371,782],width_m:.123,height_m:.123,curves:[],outline:Array.from({length:192},(_,i)=>[.0615*Math.cos(i*TAU/192),.0615*Math.sin(i*TAU/192)])};
 STUDY.depth=.010;STUDY.relief=0;
 try{
  const raw=integratedEnd(id,'D7'),G=new Mesh(),p=spec('D7'),L=p.cover.body+p.cover.neck,z0=-L/2;
  // Diameter and projected total height determine the displayed inclination.
  let lo=0,hi=1;for(let i=0;i<30;i++){let a=(lo+hi)/2;if(.123*Math.cos(a)+.010*Math.sin(a)>.11)lo=a;else hi=a;}const angle=(lo+hi)/2;
  let face=[];for(let i=0;i<raw.p.length;i+=3)if(raw.p[i+2]<z0-.009)face.push(raw.p[i+1]);const cy=(face.reduce((a,b)=>Math.min(a,b),Infinity)+face.reduce((a,b)=>Math.max(a,b),-Infinity))/2;
  for(let i=0;i<raw.p.length;i+=3){let x=raw.p[i],y=raw.p[i+1],z=raw.p[i+2],blend=1-smooth(0,.035,z-z0),dy=y-cy;
   G.vertex([x,y+blend*(dy*Math.cos(angle)-dy),(z-z0)*(.232/L)-blend*dy*Math.sin(angle)]);
  }
  const zs=G.p.filter((_,i)=>i%3===2),min=zs.reduce((a,b)=>Math.min(a,b),Infinity),max=zs.reduce((a,b)=>Math.max(a,b),-Infinity),frontExtra=.278-(max-min);
  for(let i=0;i<G.p.length;i+=3){let z=G.p[i+2];G.p[i+2]=z-(1-smooth(min,min+.07,z))*frontExtra;}
  G.idx=Array.from(raw.idx);G.finish();G.definition={source:'D7',kind:'inclined plain round head continuously joined to cover',diameter_m:.123,total_length_m:.278,projected_height_m:.110,plate_thickness_m:.010,side_labels_m:[.232,.198],inclination_rad:angle,status:'side-profile reconstruction; inclination inferred from diameter and projected height; 232/198 dimension endpoints still uncertain',separateFloatingParts:0};return G;
 }finally{STUDY.depth=oldDepth;STUDY.relief=oldRelief;}
}
