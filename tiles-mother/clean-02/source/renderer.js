class Renderer{
 constructor(canvas){
  this.canvas=canvas;this.gl=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'low-power'});
  if(!this.gl)throw Error('浏览器未能建立 WebGL 2，请在支持硬件加速的浏览器中打开。');
  this.draws=0;this.frames=0;this.shadowDirty=true;this.groups=[];this.bytes=0;this.triangles=0;
  const gl=this.gl;this.program=this.compile(VERT,FRAG);this.depthProgram=this.compile(DEPTH_VERTEX,DEPTH_FRAGMENT);
  this.uniforms={};for(let s of ['uVP','uLightVP','uEye','uLight','uType','uSurface','uColor','uBio','uDiagnostic','uShadowTexel','uShadowEnabled','uShadow'])this.uniforms[s]=gl.getUniformLocation(this.program,s);
  this.depthLoc=gl.getUniformLocation(this.depthProgram,'uLightVP');
  this.shadowSize=1024;this.depth=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.depth);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,1024,1024,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_MODE,gl.COMPARE_REF_TO_TEXTURE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_FUNC,gl.LEQUAL);
  this.fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,this.depth,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);
  if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('阴影缓冲建立失败');gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
 }
 compile(v,f){const g=this.gl,shader=(t,s)=>{let h=g.createShader(t);g.shaderSource(h,s);g.compileShader(h);if(!g.getShaderParameter(h,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(h));return h};let vs=shader(g.VERTEX_SHADER,v),fs=shader(g.FRAGMENT_SHADER,f),p=g.createProgram();g.attachShader(p,vs);g.attachShader(p,fs);g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(g.getProgramInfoLog(p));g.deleteShader(vs);g.deleteShader(fs);return p}
 clear(){const g=this.gl;for(let m of this.groups){for(let b of m.buffers)g.deleteBuffer(b);g.deleteVertexArray(m.vao)}this.groups=[];this.bytes=0;this.triangles=0}
 add(mesh,instances,type,cast=true){
  if(!instances.length)return;
  const g=this.gl,vao=g.createVertexArray(),buffers=[];g.bindVertexArray(vao);
  const attr=(data,loc,size)=>{let b=g.createBuffer();buffers.push(b);g.bindBuffer(g.ARRAY_BUFFER,b);g.bufferData(g.ARRAY_BUFFER,data,g.STATIC_DRAW);g.enableVertexAttribArray(loc);g.vertexAttribPointer(loc,size,g.FLOAT,false,0,0);this.bytes+=data.byteLength;};
  attr(mesh.p,0,3);attr(mesh.n,1,3);attr(mesh.meta,2,2);
  let ib=g.createBuffer();buffers.push(ib);g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,ib);g.bufferData(g.ELEMENT_ARRAY_BUFFER,mesh.idx,g.STATIC_DRAW);this.bytes+=mesh.idx.byteLength;
  let data=new Float32Array(instances.length*20);instances.forEach((it,i)=>{data.set(it.m,i*20);data.set(it.s,i*20+16)});
  let b=g.createBuffer();buffers.push(b);g.bindBuffer(g.ARRAY_BUFFER,b);g.bufferData(g.ARRAY_BUFFER,data,g.STATIC_DRAW);this.bytes+=data.byteLength;
  for(let k=0;k<4;k++){g.enableVertexAttribArray(3+k);g.vertexAttribPointer(3+k,4,g.FLOAT,false,80,k*16);g.vertexAttribDivisor(3+k,1)}
  g.enableVertexAttribArray(7);g.vertexAttribPointer(7,4,g.FLOAT,false,80,64);g.vertexAttribDivisor(7,1);
  this.groups.push({vao,buffers,count:mesh.idx.length,instances:instances.length,type,cast});this.triangles+=mesh.idx.length/3*instances.length;g.bindVertexArray(null);this.shadowDirty=true;
 }
 resize(){let dpr=Math.min(window.devicePixelRatio||1,1.5),w=Math.round(this.canvas.clientWidth*dpr),h=Math.round(this.canvas.clientHeight*dpr);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}return[w,h]}
 render(camera,settings,bounds){
  const g=this.gl,[w,h]=this.resize(),eye=[camera.target[0]+camera.distance*Math.cos(camera.pitch)*Math.sin(camera.yaw),camera.target[1]+camera.distance*Math.sin(camera.pitch),camera.target[2]+camera.distance*Math.cos(camera.pitch)*Math.cos(camera.yaw)];
  const VP=M.mul(M.perspective(.61,w/h,.008,100),M.look(eye,camera.target)),L=V.norm([-3.6,7.5,4.1]),center=bounds.center,rad=bounds.radius;
  let lightEye=V.add(center,V.scale(L,rad*3.4)),lightVP=M.mul(M.ortho(-rad,rad,-rad,rad,.02,rad*7),M.look(lightEye,center));
  if(this.shadowDirty){g.bindFramebuffer(g.FRAMEBUFFER,this.fbo);g.viewport(0,0,1024,1024);g.clear(g.DEPTH_BUFFER_BIT);g.useProgram(this.depthProgram);g.uniformMatrix4fv(this.depthLoc,false,lightVP);g.enable(g.POLYGON_OFFSET_FILL);g.polygonOffset(1.4,2.5);
   for(let m of this.groups)if(m.cast){g.bindVertexArray(m.vao);g.drawElementsInstanced(g.TRIANGLES,m.count,g.UNSIGNED_INT,0,m.instances)}g.disable(g.POLYGON_OFFSET_FILL);g.bindFramebuffer(g.FRAMEBUFFER,null);this.shadowDirty=false;
  }
  g.viewport(0,0,w,h);g.clearColor(.878,.885,.865,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.useProgram(this.program);
  const U=this.uniforms;g.uniformMatrix4fv(U.uVP,false,VP);g.uniformMatrix4fv(U.uLightVP,false,lightVP);g.uniform3fv(U.uEye,eye);g.uniform3fv(U.uLight,L);
  g.uniform4fv(U.uSurface,[settings.relief,settings.warmth,settings.patina,settings.wet]);g.uniform4fv(U.uColor,[settings.brightness,settings.temperature,settings.variation,settings.core]);g.uniform4fv(U.uBio,[settings.moss*(settings.care?.10:settings.scene.startsWith('roof')?smooth(1,10,settings.year):.72),settings.mossHeight,settings.twist,0]);g.uniform1i(U.uDiagnostic,settings.diagnostic);g.uniform1f(U.uShadowTexel,1/1024);g.uniform1f(U.uShadowEnabled,settings.shadows===false?0:1);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.depth);g.uniform1i(U.uShadow,0);
  this.draws=0;for(let m of this.groups){if(m.type===3&&camera.pitch<0)continue;g.uniform1i(U.uType,m.type);g.bindVertexArray(m.vao);g.drawElementsInstanced(g.TRIANGLES,m.count,g.UNSIGNED_INT,0,m.instances);this.draws++}
  g.bindVertexArray(null);this.frames++;return {drawCalls:this.draws,triangles:this.triangles,geometryBytes:this.bytes,width:w,height:h,eye};
 }
}
