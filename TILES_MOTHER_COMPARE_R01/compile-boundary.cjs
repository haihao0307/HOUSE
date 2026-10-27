'use strict';
// Display-only specialization compiler: query each actual shape evaluator, not a preset.
function compileBoundary(e,edges){
 let sourceCalls=0;const P=(...a)=>{sourceCalls++;return e.position(...a)},N=u=>{sourceCalls++;return e.normal(u)};
 const top=P(0,.5,0),bottom=P(0,.5,1),side=P(edges[1],.5,0),n=N(edges[1]),ends=[P(0,0,0),P(0,1,0)];
 const L=ends[1][2]-ends[0][2],W=2*side[0]/edges[1],T=top[1]-bottom[1],k=-n[0]/side[0],h=k*W*W/4/(1+Math.sqrt(Math.max(0,1-k*k*W*W/4))),bend=h/(.45*W);
 let maxFitError=0;
 for(const u of [-edges[0],0,edges[1]])for(const t of [0,.5,1])for(const q of [0,.5,1]){const p=P(u,t,q),x=u*W/2,c=Math.sqrt(Math.max(0,1-k*k*x*x)),ref=[x*(1+q*T*k),T/2+k*x*x/(1+c)-q*T*c,(t-.5)*L];maxFitError=Math.max(maxFitError,Math.hypot(...p.map((v,i)=>v-ref[i])));}
 if(![L,W,T,k,bend,maxFitError].every(Number.isFinite)||maxFitError>Math.max(L,W,T)*1e-10)throw Error('Evaluator is not the supported straight circular-sheet family');
 return {size:[L,W,T],bend,edges:edges.slice(),compiledFromSource:true,sourceCalls,maxFitError};
}
module.exports={compileBoundary};
