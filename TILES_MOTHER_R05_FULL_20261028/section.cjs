'use strict';
// Continuous section tool. t is a length coordinate, not an index into stored samples.
function createSection(S,P){
 const N=P.shoulder,mix=(a,b,t)=>a+(b-a)*t;
 const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
 return function section(t){
  const v=N?Math.min(t/N.at,1):t;
  let out=[mix(S.width,P.endWidth,v),mix(...P.rise,v),mix(...P.lift,v),mix(S.thickness,P.endThickness,v)];
  if(N){const s=smooth(N.at-N.span,N.at,t);out=out.map((x,i)=>mix(x,[N.width,N.rise,N.lift,N.thickness][i],s))}
  return out;
 };
}
module.exports={createSection};
