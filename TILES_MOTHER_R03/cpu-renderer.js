function cpuWorkerMain(){
 let latest=0;
 const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],norm=a=>{let n=Math.hypot(...a);return a.map(v=>v/n)},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],add=(a,b,t=1)=>a.map((v,i)=>v+b[i]*t);
 onmessage=async({data:d})=>{latest=d.id;const id=d.id,{w,h,size,bend,eye,target,viewMode}=d,ray=createIntersector(size,bend),f=norm(target.map((v,i)=>v-eye[i])),r=norm(cross(f,[0,1,0])),u=cross(r,f),L=norm([-3.6,7.5,4.1]),F=norm([1.2,.6,-.8]),floorY=Math.min(-size[2]/2,.45*size[1]*bend-size[2]/2)-.012,buffer=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++){if(id!==latest)return;for(let x=0;x<w;x++){const sx=(2*(x+.5)-w)/h*.33,sy=(h-2*(y+.5))/h*.33,rd=norm(add(add(f,r,sx),u,sy)),q=ray.hit(eye,rd),g=Math.abs(rd[1])>1e-10?(floorY-eye[1])/rd[1]:Infinity;let c=[.76,.77,.75];
    if(Number.isFinite(q.t)&&(g<0||q.t<g)){const p=add(eye,rd,q.t),n=q.normal,shadow=Number.isFinite(ray.hit(add(p,n,.00001),L).t)?.25:1,light=.26+.60*Math.max(0,dot(n,L))*shadow+.20*Math.max(0,dot(n,F));c=viewMode?n.map(v=>v*.5+.5):[0,0,0].map(()=>Math.pow(.47*light,1/2.2));}
    else if(g>0&&Number.isFinite(g)){const p=add(eye,rd,g),shadow=Number.isFinite(ray.hit(add(p,[0,1,0],.00001),L).t)?.78:1;c=c.map(v=>v*shadow);}
    const j=(y*w+x)*4;buffer[j]=c[0]*255;buffer[j+1]=c[1]*255;buffer[j+2]=c[2]*255;buffer[j+3]=255;
   }if(y%12===11)await new Promise(resolve=>setTimeout(resolve,0));}
  if(id===latest)postMessage({id,w,h,buffer},[buffer.buffer]);
 };
}
class CPUAnalyticRenderer{
 constructor(canvas){this.canvas=canvas;this.context=canvas.getContext('2d',{alpha:false});if(!this.context)throw Error('无法建立解析像素显示器');this.mode='CPU analytic rays';this.frames=0;this.serial=0;const source=createIntersector.toString()+';('+cpuWorkerMain.toString()+')();';this.url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));this.worker=new Worker(this.url);this.worker.onmessage=({data:d})=>{if(d.id!==this.serial)return;canvas.width=d.w;canvas.height=d.h;this.context.putImageData(new ImageData(d.buffer,d.w,d.h),0,0);this.frames++;document.body.dataset.ready='true';document.getElementById('status').textContent='CPU 解析三维 · 无物体网格';};this.worker.onerror=e=>{document.body.dataset.ready='failed';document.getElementById('error').textContent='解析显示失败：'+e.message;};window.addEventListener('pagehide',e=>{if(!e.persisted){this.worker.terminate();URL.revokeObjectURL(this.url);}});}
 render(record,camera,viewMode=0){const c=this.canvas,scale=Math.min(1,600/c.clientWidth,480/c.clientHeight),w=Math.max(1,Math.round(c.clientWidth*scale)),h=Math.max(1,Math.round(c.clientHeight*scale)),eye=[camera.target[0]+camera.distance*Math.cos(camera.pitch)*Math.sin(camera.yaw),camera.target[1]+camera.distance*Math.sin(camera.pitch),camera.target[2]+camera.distance*Math.cos(camera.pitch)*Math.cos(camera.yaw)];this.worker.postMessage({id:++this.serial,w,h,size:record.Object.size,bend:record.Object.bend,eye,target:camera.target,viewMode});}
}
