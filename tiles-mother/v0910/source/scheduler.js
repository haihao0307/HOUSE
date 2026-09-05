/* True request-on-change scheduling. No frame polling while idle or hidden. */
let perfPending=0,perfLastFrame=performance.now(),perfInFrame=false;
let perfSpin=state.autoRotate;
Object.defineProperty(state,'autoRotate',{enumerable:true,configurable:true,get(){return perfSpin;},set(v){perfSpin=!!v;perfLastFrame=performance.now();perfRequest();}});
function perfRequest(){needsRender=true;if(!perfPending&&!perfInFrame&&!document.hidden)perfPending=requestAnimationFrame(perfFrame);}
function perfFrame(now){
 perfPending=0;perfMetrics.frameCallbacks++;
 if(document.hidden)return;
 perfInFrame=true;
 if(state.autoRotate){yaw+=Math.min(100,now-perfLastFrame)*.00017;updateCamera();}
 perfLastFrame=now;
 if(needsRender){renderer.render(scene,camera);needsRender=false;perfMetrics.frames++;}
 perfInFrame=false;
 if(state.autoRotate&&!document.hidden)perfPending=requestAnimationFrame(perfFrame);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(perfPending)cancelAnimationFrame(perfPending);perfPending=0;}else{perfLastFrame=performance.now();perfRequest();}});
