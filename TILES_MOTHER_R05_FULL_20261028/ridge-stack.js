const RIDGE_STACK_CACHE09N=new Map();
function ridgeStackFit09N(){
 const key=[settings.micStrength,settings.micScale].join('/');if(RIDGE_STACK_CACHE09N.has(key))return RIDGE_STACK_CACHE09N.get(key);
 const get=id=>{const r=TILE_INSTANCES.instances.find(x=>x.id===id);if(!r)throw Error('Missing ridge recipe '+id);return r.variables},a=get('ridge-eye-L7'),b=get('ridge-board-L7');
 const eye=TilesRolled.create({library:SHEET_LIBRARY,outer:a.outer_m,inner:a.inner_m,length:a.length_m,angle:a.angle_rad,geometryGain:a.geometryGain,strength:settings.micStrength,scale:settings.micScale});
 const board=TilesFlat.create({library:SHEET_LIBRARY,width:b.width,length:b.length,thickness:b.thickness,geometryGain:b.geometryGain,strength:settings.micStrength,scale:settings.micScale});
 let eyeTop=-Infinity,boardBottom=Infinity,boardTop=-Infinity;
 for(let i=0;i<=128;i++)for(let j=0;j<=48;j++)eyeTop=Math.max(eyeTop,eye.position(-1+2*i/128,j/48,0)[1]);
 for(let i=0;i<=96;i++)for(let j=0;j<=48;j++){let u=-1+2*i/96,t=j/48;boardBottom=Math.min(boardBottom,board.position(u,t,1)[1]);boardTop=Math.max(boardTop,board.position(u,t,0)[1]);}
 const gap=.00015,boardY=Math.max(.142,.075+eyeTop-boardBottom+gap),lowerY=Math.max(.164,boardY+boardTop+gap),top=lowerY+.022;
 const result={boardY,lowerY,top,eyeTop,boardBottom,boardTop,minimumSampledEyeGap_m:boardY+boardBottom-(.075+eyeTop),minimumSampledBoardGap_m:lowerY-(boardY+boardTop),scope:'independent bounded continuous-function samples; not structural or waterproofing verification'};
 RIDGE_STACK_CACHE09N.set(key,result);return result;
}
