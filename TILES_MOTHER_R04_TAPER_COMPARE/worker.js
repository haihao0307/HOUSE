// Each output pixel queries the continuous surface; no object mesh is generated.
let latest=0;const norm=a=>{let n=Math.hypot(...a);return a.map(x=>x/n)},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
onmessage=async({data:d})=>{latest=d.id;try{
 const e=(d.route==='A'?MotherA:MotherB).instantiate(LIB,d.recipe,d.changes),ray=Ray.createRay(e),f=norm(d.target.map((v,i)=>v-d.eye[i])),r=norm(cross(f,[0,1,0])),up=cross(r,f),L=norm([-.5,.8,.65]),buffer=new Uint8ClampedArray(d.w*d.h*4),started=performance.now();let hits=0;
 for(let i=0;i<buffer.length;i+=4){buffer[i]=199;buffer[i+1]=207;buffer[i+2]=196;buffer[i+3]=255}
 for(let y=0;y<d.h;y++){
  if(d.id!==latest)return;
  for(let x=0;x<d.w;x++){
   const px=(2*(x+.5)-d.w)/d.h/2.1,py=(d.h-2*(y+.5))/d.h/2.1,rd=norm(f.map((v,i)=>v+px*r[i]+py*up[i]));let best=null,bestOrigin=null;
   for(let j=0;j<d.placements.length;j+=4){const offset=[d.placements[j+1],d.placements[j+2],d.placements[j]],ro=d.eye.map((v,i)=>v-offset[i]),h=ray.hit(ro,rd);if(h&&(!best||h.distance<best.distance)){best=h;bestOrigin=ro}}
   let color=[.78,.81,.77];if(best){hits++;const v=e.evaluate(best.u,best.t,best.q,.0012),n=best.normal,light=.35+.65*Math.max(0,dot(n,L)),view=norm(rd.map(x=>-x)),half=norm(L.map((x,i)=>x+view[i])),spec=(1-v.roughness)*.18*Math.max(0,dot(n,half))**24;color=v.color.map(c=>Math.max(0,c*light+spec)**(1/2.2))}
   const i=(y*d.w+x)*4;buffer[i]=255*color[0];buffer[i+1]=255*color[1];buffer[i+2]=255*color[2];buffer[i+3]=255;
  }
  if(y%12===11){const partial=buffer.slice();postMessage({id:d.id,w:d.w,h:d.h,buffer:partial,progress:(y+1)/d.h},[partial.buffer])}
  if(y%3===2)await new Promise(resolve=>setTimeout(resolve,0));
 }
 if(d.id===latest)postMessage({id:d.id,w:d.w,h:d.h,buffer,hits,milliseconds:performance.now()-started},[buffer.buffer]);
}catch(e){if(d.id===latest)postMessage({id:d.id,error:String(e.message||e)})}};
