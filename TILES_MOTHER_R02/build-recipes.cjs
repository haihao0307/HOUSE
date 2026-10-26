const fs=require('fs');
const common={function:'kaopu.sheet/2',unit:'m',frame:'local x transverse, y up, z longitudinal',sheet:{seed:23},press:{amount:1,formGain:1,handGain:.55,edgeGain:1,handReferenceHalfWidth:.121,handReferenceLength:.238,longitudinalNormal:1,lift:[0,0],shoulder:null},wave:{seed:31,scale:1,strength:1},material:{color:.30,roughness:.30,brightness:.96,warmth:.36,patina:.38,wet:0,tint:.5,variation:.58,core:.48}};
const instances={};
for(let set of ['D7','L9']){
 const p=set==='D7'?{l:.238,w0:.242,w1:.221,h:.05,t:.012}:{l:.240,w0:.210,w1:.190,h:.045,t:.014};
 const c=set==='D7'?{body:.222,neck:.032,w:.115,wn:.09,h:.035,hn:.032,t:.010,tn:.008}:{body:.210,neck:.030,w:.125,wn:.102,h:.052,hn:.040,t:.010,tn:.008},length=c.body+c.neck;
 const evidence={source:set,shape:'09H source-dimension interpretation; not measured manufacture',error_m:null};
 instances['pan-'+set]={id:'pan-'+set,sheet:{length:p.l,width:p.w0,thickness:p.t},press:{endWidth:p.w1,rise:[p.h,p.h*.94]},evidence};
 instances['cover-'+set]={id:'cover-'+set,sheet:{length,width:c.w,thickness:c.t},press:{endWidth:c.w*.965,rise:[-c.h,-c.h],lift:[c.h,c.h],longitudinalNormal:0,handReferenceHalfWidth:.0575,handReferenceLength:.222,shoulder:{at:c.body/length,span:.002/length,width:c.wn,rise:-c.hn,lift:c.hn,thickness:c.tn}},evidence};
}
instances.flat={id:'flat',sheet:{length:.24,width:.21,thickness:.014},press:{rise:[0,0],amount:0},evidence:{source:'shared sheet identity state',error_m:null}};
fs.writeFileSync(__dirname+'/library.json',JSON.stringify({common,instances}));
console.log('Wrote five value-only recipes; one shared function.');
