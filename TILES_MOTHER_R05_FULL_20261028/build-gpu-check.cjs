const fs=require('fs'),core=fs.readFileSync(__dirname+'/route-a.cjs','utf8'),section=fs.readFileSync(__dirname+'/section.cjs','utf8'),tile=fs.readFileSync(__dirname+'/tile.cjs','utf8'),glsl=require('./shader-adapter.cjs').glsl(),library=require('./library.json');
const code=`const Section=(()=>{const module={exports:{}};${section}\nreturn module.exports})();const Tile=(()=>{const module={exports:{}};${tile}\nreturn module.exports})();const require=id=>id==='./section.cjs'?Section:id==='./tile.cjs'?Tile:(()=>{throw Error(id)})();const module={exports:{}};${core}\nconst Mother=module.exports,library=${JSON.stringify(library)},sharedGLSL=${JSON.stringify(glsl)};
const report={version:'sheet/3-09N',checks:[],pass:false};
try{
 const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2');if(!gl)throw Error('WebGL2 unavailable');
 if(!gl.getExtension('EXT_color_buffer_float'))throw Error('Float target unavailable');
 const compile=(kind,source)=>{const s=gl.createShader(kind);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 const vs=compile(gl.VERTEX_SHADER,'#version 300 es\\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}');
 const fs=compile(gl.FRAGMENT_SHADER,'#version 300 es\\nprecision highp float;\\n'+sharedGLSL+\`
 uniform vec4 points[64];uniform float shift;uniform float footprint;
 layout(location=0) out vec4 a;layout(location=1) out vec4 b;layout(location=2) out vec4 c;
 void main(){vec4 p=points[int(gl_FragCoord.x)];MotherWave w=fieldRule(p.x,p.y,p.z,shift,24.,footprint,.30,.85);
 MotherMaterial m=MotherMaterial(.30,.30,.96,.36,.38,0.,.5,.58,.48);
 MotherSurface s=materialRule(w.value,w.fine,w.gradient.x,w.gradient.y,w.gradient.z,m,1.,skinRule(p.w));
 a=vec4(w.value,w.fine,w.gradient.xy);b=vec4(w.gradient.z,s.roughness,s.microHeight,0.);c=vec4(s.color,1.);}\`);
 const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 const framebuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);const attachments=[];
 for(let i=0;i<3;i++){let texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,64,1,0,gl.RGBA,gl.FLOAT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0+i,gl.TEXTURE_2D,texture,0);attachments.push(gl.COLOR_ATTACHMENT0+i)}
 gl.drawBuffers(attachments);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete float target');gl.viewport(0,0,64,1);
 const e=Mother.instantiate(library,'pan-L9'),points=new Float32Array(64*4);
 for(let i=0;i<64;i++){let u=2*((i*.61803398875)%1)-1,t=(i*.41421356237)%1,q=i%3/2;points.set([...e.materialPoint(u,t,q),q],4*i)}
 gl.uniform4fv(gl.getUniformLocation(program,'points[0]'),points);
 for(let seed of [31,47])for(let fp of [.0002,.002]){
  gl.uniform1f(gl.getUniformLocation(program,'shift'),Mother.identity(seed));gl.uniform1f(gl.getUniformLocation(program,'footprint'),fp);gl.drawArrays(gl.TRIANGLES,0,3);
  const buffers=attachments.map(att=>{gl.readBuffer(att);const p=new Float32Array(256);gl.readPixels(0,0,64,1,gl.RGBA,gl.FLOAT,p);return p;});
  let value=0,gradient=0,color=0,roughness=0;
  for(let i=0;i<64;i++){let p=[...points.slice(4*i,4*i+3)],q=points[4*i+3],w=Mother.fieldRule(...p,Math.fround(Mother.identity(seed)),24,Math.fround(fp),.30,.85),s=Mother.materialRule(w.value,w.fine,...w.gradient,library.common.material,1,Mother.skinRule(q));value=Math.max(value,Math.abs(w.value-buffers[0][4*i]),Math.abs(w.fine-buffers[0][4*i+1]));gradient=Math.max(gradient,...w.gradient.map((x,k)=>Math.abs(x-(k<2?buffers[0][4*i+2+k]:buffers[1][4*i]))));color=Math.max(color,...s.color.map((x,k)=>Math.abs(x-buffers[2][4*i+k])));roughness=Math.max(roughness,Math.abs(s.roughness-buffers[1][4*i+1]));}
  report.checks.push({seed,footprint:fp,samples:64,maxFieldError:value,maxGradientError:gradient,maxMicroHeightError_m:value*.00018,maxMicroSlopeError:gradient*.00018,maxColorError:color,maxRoughnessError:roughness,pass:value*.00018<.000001&&gradient*.00018<.0002&&color<.00001&&roughness<.00005});
 }
 report.pass=report.checks.every(x=>x.pass);report.glError=gl.getError();report.pass=report.pass&&report.glError===0;
}catch(error){report.error=error.message;}
document.querySelector('pre').textContent=JSON.stringify(report,null,2);document.title=report.pass?'PASS · Tiles Mother GPU':'FAIL · Tiles Mother GPU';`;
fs.writeFileSync(__dirname+'/GPU_CHECK.html','<!doctype html><meta charset="utf-8"><title>Tiles Mother GPU</title><h1>共享规则 CPU / GPU 对照</h1><pre>检查中…</pre><script>'+code+'</script>');
