'use strict';
// Original analytic wave material, attached to the same flat material coordinates.
function create(frequency,amplitude,seed){
 if(!Number.isFinite(frequency)||frequency<=0||frequency>100||!Number.isFinite(amplitude)||amplitude<0||amplitude>1||!Number.isFinite(seed)||Math.abs(seed)>1e6)throw Error('Invalid wave variables');
 return Object.freeze({evaluate:p=>{if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))throw Error('Invalid material coordinate');const[x,y,z]=p,f=frequency,broad=(Math.sin((x+z*.37)*f+seed)+.5*Math.cos((z-x*.21)*f*1.7-seed*.3))/1.5,fine=Math.sin((x+z*.8)*f*5+seed)*Math.cos((z-y)*f*4.3-seed),wave=amplitude*(.7*broad+.3*fine),v=.30+.16*wave;return{color:[v*.94,v,v*.97],roughness:Math.max(.6,Math.min(1,.87+.1*wave)),wave}}});
}
module.exports=Object.freeze({create});
