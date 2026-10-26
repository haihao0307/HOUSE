// Optional backend adapter. Only translates the three shared scalar rule bodies.
const {fieldRule,colorChannel,skinRule,materialRule}=require('./mother.cjs');
function translate(fn,result,types={}){
 const source=fn.toString(),name=fn.name,params=source.slice(source.indexOf('(')+1,source.indexOf(')')).split(',');
 let body=source.slice(source.indexOf('{')).replace(/for\(let j=/g,'for(int j=').replace(/\blet\b/g,'float').replace(/Math\.atan2/g,'atan').replace(/Math\./g,'').replace(/\bsmooth\(/g,'smoothstep(');
 if(/=>|\[|\]|\.map|\bconst\b|\.\.\./.test(body))throw Error('Non-scalar rule cannot be translated: '+name);
 return result+' '+name+'('+params.map(p=>(types[p]||'float')+' '+p).join(',')+')'+body;
}
function glsl(){return `
struct MotherWave {float value;float fine;vec3 gradient;};
struct MotherMaterial {float color;float roughness;float brightness;float warmth;float patina;float wet;float tint;float variation;float core;};
struct MotherSurface {vec3 color;float roughness;float metallic;float microHeight;vec3 microGradient;};
MotherWave waveResult(float value,float fine,float x,float y,float z){return MotherWave(value,fine,vec3(x,y,z));}
MotherSurface surfaceResult(float r,float g,float b,float rough,float h,float x,float y,float z){return MotherSurface(vec3(r,g,b),rough,0.,h,vec3(x,y,z));}
`+translate(fieldRule,'MotherWave')+'\n'+translate(colorChannel,'float',{M:'MotherMaterial'})+'\n'+translate(skinRule,'float')+'\n'+translate(materialRule,'MotherSurface',{M:'MotherMaterial'});}
module.exports={glsl};
if(require.main===module)require('fs').writeFileSync(__dirname+'/generated-material.glsl',glsl());
