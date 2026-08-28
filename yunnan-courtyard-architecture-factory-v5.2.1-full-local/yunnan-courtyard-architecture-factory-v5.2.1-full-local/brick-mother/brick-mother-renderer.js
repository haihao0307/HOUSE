'use strict';
const { clamp, vec3, norm3, sub3, cross3, dot3 } = window.BrickMotherGeometry;
function mat4Identity() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
function mat4Multiply(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
function mat4Perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
function mat4LookAt(eye, target, up) {
  let z = norm3(sub3(eye, target)), x = norm3(cross3(up, z)), y = cross3(z, x);
  return new Float32Array([
    x.x, y.x, z.x, 0, x.y, y.y, z.y, 0, x.z, y.z, z.z, 0,
    -dot3(x, eye), -dot3(y, eye), -dot3(z, eye), 1
  ]);
}
function mat4Model(position, yaw = 0) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, position.x, position.y, position.z, 1]);
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Shader compile failed');
  return shader;
}
function createProgram(gl, vsSource, fsSource) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource), fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Program link failed');
  gl.deleteShader(vs); gl.deleteShader(fs); return program;
}

const vertexShader = `#version 300 es
precision highp float;
in vec3 aPosition;
in vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uViewProj;
out vec3 vWorldPos;
out vec3 vLocalPos;
out vec3 vNormal;
void main(){
  vec4 wp=uModel*vec4(aPosition,1.0);
  vWorldPos=wp.xyz;
  vLocalPos=aPosition;
  vNormal=normalize(mat3(uModel)*aNormal);
  gl_Position=uViewProj*wp;
}`;

const fragmentShader = `#version 300 es
precision highp float;
in vec3 vWorldPos;
in vec3 vLocalPos;
in vec3 vNormal;
out vec4 outColor;
uniform vec3 uCamera;
uniform vec3 uLowColor;
uniform vec3 uMeanColor;
uniform vec3 uHighColor;
uniform vec2 uRoughness;
uniform float uGrainScale;
uniform float uFineScale;
uniform float uMineral;
uniform float uFiringBand;
uniform float uBump;
uniform float uSeed;
uniform int uFamily;
uniform int uGround;
uniform vec3 uShadowPos0;
uniform vec3 uShadowPos1;
uniform vec3 uShadowPos2;
uniform vec2 uShadowSize0;
uniform vec2 uShadowSize1;
uniform vec2 uShadowSize2;

float hash31(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise3(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  float n000=hash31(i+vec3(0,0,0)),n100=hash31(i+vec3(1,0,0));
  float n010=hash31(i+vec3(0,1,0)),n110=hash31(i+vec3(1,1,0));
  float n001=hash31(i+vec3(0,0,1)),n101=hash31(i+vec3(1,0,1));
  float n011=hash31(i+vec3(0,1,1)),n111=hash31(i+vec3(1,1,1));
  return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y),mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y),f.z);
}
float fbm(vec3 p){float v=0.0,a=.5;for(int i=0;i<4;i++){v+=noise3(p)*a;p=p*2.03+vec3(17.1,9.2,13.7);a*=.5;}return v/.9375;}
vec3 srgbToLinear(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 linearToSrgb(vec3 c){return mix(c*12.92,1.055*pow(max(c,0.0),vec3(1.0/2.4))-.055,step(vec3(.0031308),c));}
float shadowBlob(vec3 p,vec3 c,vec2 s){vec2 q=(p.xz-c.xz)/max(s,vec2(.01));return exp(-dot(q,q)*2.7);}
float D_GGX(float NoH,float a){float a2=a*a,d=(NoH*NoH*(a2-1.0)+1.0);return a2/(3.14159265*d*d+.00001);}
float G_Schlick(float NoV,float k){return NoV/(NoV*(1.0-k)+k+.00001);}
vec3 F_Schlick(float VoH,vec3 F0){return F0+(1.0-F0)*pow(1.0-VoH,5.0);}
void main(){
  if(uGround==1){
    vec3 c=vec3(.115,.12,.115);
    float grain=noise3(vWorldPos*2.8+uSeed)*.025;
    float sh=clamp(shadowBlob(vWorldPos,uShadowPos0,uShadowSize0)+shadowBlob(vWorldPos,uShadowPos1,uShadowSize1)+shadowBlob(vWorldPos,uShadowPos2,uShadowSize2),0.0,1.0);
    c=(c+grain)*(1.0-.34*sh);
    float grid=min(abs(fract(vWorldPos.x*.5)-.5),abs(fract(vWorldPos.z*.5)-.5));
    c+=(1.0-smoothstep(0.0,.035,grid))*.018;
    outColor=vec4(linearToSrgb(c),1.0);return;
  }
  vec3 p=vLocalPos;
  vec3 seedV=vec3(uSeed*.013,uSeed*.021,uSeed*.034);
  float macro=fbm(p*uGrainScale*.34+seedV);
  float fine=fbm(p*uFineScale*.12+seedV*1.7);
  float fleck=noise3(p*uFineScale*.72+seedV*3.1);
  float band=sin((p.x*.92+p.z*.31)*3.2+macro*2.0+uSeed)*.5+.5;
  float mixValue=clamp(.18+macro*.72+fine*.12,0.0,1.0);
  vec3 low=srgbToLinear(uLowColor),mean=srgbToLinear(uMeanColor),high=srgbToLinear(uHighColor);
  vec3 albedo=mix(low,high,mixValue);
  albedo=mix(albedo,mean,.34);
  if(uFamily==0){
    albedo*=mix(.88,1.08,mix(band,macro,uFiringBand));
    float iron=smoothstep(.89,.965,fleck)*uMineral;
    albedo=mix(albedo,high*vec3(.92,.67,.42),iron*.36);
    float soot=smoothstep(.91,.98,noise3(p*18.0+seedV*5.0));
    albedo*=1.0-soot*.18;
  }else if(uFamily==1){
    float clayLump=smoothstep(.58,.9,macro)*.16;
    albedo=mix(albedo,high,clayLump);
    float fibre=smoothstep(.955,.988,fleck)*uMineral;
    albedo*=1.0-fibre*.20;
  }else{
    float vein=1.0-abs(noise3(p*5.7+seedV)-.5)*2.0;
    vein=smoothstep(.82,.97,vein)*uMineral;
    albedo=mix(albedo,high*1.18,vein*.38);
    float dark=smoothstep(.90,.98,fleck);
    albedo*=1.0-dark*.20;
  }
  float h=macro*.52+fine*.32+fleck*.16;
  vec3 N=normalize(vNormal);
  vec3 dpdx=dFdx(vWorldPos),dpdy=dFdy(vWorldPos);
  float dhdx=dFdx(h),dhdy=dFdy(h);
  vec3 R1=cross(dpdy,N),R2=cross(N,dpdx);
  float det=dot(dpdx,R1);
  vec3 surfGrad=sign(det)*(dhdx*R1+dhdy*R2);
  N=normalize(abs(det)*N-surfGrad*uBump);
  float rough=mix(uRoughness.x,uRoughness.y,clamp(.18+fine*.78,0.0,1.0));
  vec3 V=normalize(uCamera-vWorldPos);
  vec3 L=normalize(vec3(-.42,.82,.39));
  vec3 L2=normalize(vec3(.55,.42,-.72));
  vec3 H=normalize(V+L);
  float NoL=max(dot(N,L),0.0),NoL2=max(dot(N,L2),0.0),NoV=max(dot(N,V),.001),NoH=max(dot(N,H),0.0),VoH=max(dot(V,H),0.0);
  float a=max(.05,rough*rough),k=(rough+1.0)*(rough+1.0)/8.0;
  vec3 F=F_Schlick(VoH,vec3(.035));
  float D=D_GGX(NoH,a),G=G_Schlick(NoV,k)*G_Schlick(NoL,k);
  vec3 spec=(D*G*F)/(4.0*NoV*max(NoL,.001)+.0001);
  vec3 kd=(1.0-F);
  vec3 direct=(kd*albedo/3.14159265+spec)*NoL*vec3(2.45,2.40,2.32);
  vec3 fill=albedo*NoL2*vec3(.19,.23,.28);
  float hemi=.28+.24*clamp(N.y*.5+.5,0.0,1.0);
  float cavity=mix(.80,1.0,smoothstep(.18,.88,fine));
  vec3 color=(direct+fill+albedo*hemi)*cavity;
  color=color/(color+vec3(1.0));
  outColor=vec4(linearToSrgb(color),1.0);
}`;

class BrickRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', { antialias: true, alpha: false, preserveDrawingBuffer: true });
    if (!this.gl) throw new Error('当前浏览器没有可用的 WebGL2');
    this.program = createProgram(this.gl, vertexShader, fragmentShader);
    this.loc = this.locations();
    this.camera = { yaw: 0.76, pitch: 0.27, distance: 13.5, target: vec3(0, 0.7, 0) };
    this.meshes = [];
    this.autoRotate = false;
    this.drag = false;
    this.pan = false;
    this.lastTime = 0;
    this.lightMode = 'neutral';
    this.bind();
    this.createGround();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    requestAnimationFrame((t) => this.loop(t));
  }
  locations() {
    const gl = this.gl, p = this.program;
    const a = (n) => gl.getAttribLocation(p, n), u = (n) => gl.getUniformLocation(p, n);
    return {
      position: a('aPosition'), normal: a('aNormal'), model: u('uModel'), viewProj: u('uViewProj'), camera: u('uCamera'),
      low: u('uLowColor'), mean: u('uMeanColor'), high: u('uHighColor'), roughness: u('uRoughness'), grainScale: u('uGrainScale'), fineScale: u('uFineScale'),
      mineral: u('uMineral'), firingBand: u('uFiringBand'), bump: u('uBump'), seed: u('uSeed'), family: u('uFamily'), ground: u('uGround'),
      shadowPos: [u('uShadowPos0'), u('uShadowPos1'), u('uShadowPos2')], shadowSize: [u('uShadowSize0'), u('uShadowSize1'), u('uShadowSize2')]
    };
  }
  bind() {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => { this.drag = true; this.pan = e.button === 2 || e.shiftKey; this.px = e.clientX; this.py = e.clientY; c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const dx = e.clientX - this.px, dy = e.clientY - this.py; this.px = e.clientX; this.py = e.clientY;
      if (this.pan) {
        const scale = this.camera.distance * 0.0018;
        this.camera.target.x -= dx * scale * Math.cos(this.camera.yaw);
        this.camera.target.z += dx * scale * Math.sin(this.camera.yaw);
        this.camera.target.y += dy * scale;
      } else {
        this.camera.yaw += dx * 0.007;
        this.camera.pitch = clamp(this.camera.pitch + dy * 0.006, -1.15, 1.05);
      }
    });
    const stop = () => { this.drag = false; };
    c.addEventListener('pointerup', stop); c.addEventListener('pointercancel', stop);
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.camera.distance = clamp(this.camera.distance * Math.exp(e.deltaY * 0.001), 3.4, 26); }, { passive: false });
  }
  createBuffer(data) {
    const gl = this.gl, b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b;
  }
  createGround() {
    const p = new Float32Array([-20, 0, -20, 20, 0, -20, 20, 0, 20, -20, 0, -20, 20, 0, 20, -20, 0, 20]);
    const n = new Float32Array(18); for (let i = 0; i < 6; i++) { n[i * 3 + 1] = 1; }
    this.ground = { p: this.createBuffer(p), n: this.createBuffer(n), count: 6, model: mat4Identity() };
  }
  clearMeshes() {
    const gl = this.gl; for (const m of this.meshes) { gl.deleteBuffer(m.p); gl.deleteBuffer(m.n); }
    this.meshes = [];
  }
  setMeshes(items) {
    this.clearMeshes();
    const gl = this.gl;
    this.meshes = items.map((item) => ({
      ...item,
      p: this.createBuffer(item.mesh.positions),
      n: this.createBuffer(item.mesh.normals),
      count: item.mesh.vertices,
      model: mat4Model(item.position, item.yaw)
    }));
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
  resetView() { this.camera = { yaw: 0.76, pitch: 0.27, distance: 13.5, target: vec3(0, 0.7, 0) }; }
  focus(index) {
    const m = this.meshes[index]; if (!m) return;
    this.camera.target = vec3(m.position.x, m.mesh.dims.y * 0.48, m.position.z);
    this.camera.distance = Math.max(4.2, Math.max(m.mesh.dims.x, m.mesh.dims.z) * 2.1);
    this.camera.yaw = 0.82 + m.yaw * 0.25; this.camera.pitch = 0.24;
  }
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.8);
    const w = Math.max(2, Math.floor(this.canvas.clientWidth * dpr)), h = Math.max(2, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.gl.viewport(0, 0, w, h);
  }
  bindAttributes(mesh) {
    const gl = this.gl, l = this.loc;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.p); gl.enableVertexAttribArray(l.position); gl.vertexAttribPointer(l.position, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.n); gl.enableVertexAttribArray(l.normal); gl.vertexAttribPointer(l.normal, 3, gl.FLOAT, false, 0, 0);
  }
  setMaterial(profile, seed) {
    const gl = this.gl, l = this.loc, d = profile.runtimeDNA;
    gl.uniform3fv(l.low, d.colorLowSRGB); gl.uniform3fv(l.mean, d.colorMeanSRGB); gl.uniform3fv(l.high, d.colorHighSRGB);
    gl.uniform2fv(l.roughness, d.roughnessRange); gl.uniform1f(l.grainScale, d.grainScale); gl.uniform1f(l.fineScale, d.fineScale);
    gl.uniform1f(l.mineral, d.mineralFleck); gl.uniform1f(l.firingBand, d.firingBand); gl.uniform1f(l.bump, profile.family === 'STONE' ? 0.026 : profile.family === 'ADOBE' ? 0.038 : 0.044);
    gl.uniform1f(l.seed, seed); gl.uniform1i(l.family, profile.family === 'STONE' ? 2 : profile.family === 'ADOBE' ? 1 : 0);
  }
  cameraEye() {
    const c = this.camera, cp = Math.cos(c.pitch);
    return vec3(c.target.x + Math.sin(c.yaw) * cp * c.distance, c.target.y + Math.sin(c.pitch) * c.distance, c.target.z + Math.cos(c.yaw) * cp * c.distance);
  }
  draw() {
    const gl = this.gl, l = this.loc; this.resize();
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.clearColor(0.055, 0.058, 0.055, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    const eye = this.cameraEye(), view = mat4LookAt(eye, this.camera.target, vec3(0, 1, 0));
    const proj = mat4Perspective(Math.PI / 4.2, this.canvas.width / this.canvas.height, 0.05, 100);
    const viewProj = mat4Multiply(proj, view);
    gl.uniformMatrix4fv(l.viewProj, false, viewProj); gl.uniform3f(l.camera, eye.x, eye.y, eye.z);
    for (let i = 0; i < 3; i++) {
      const m = this.meshes[i];
      const pos = m ? m.position : vec3(1000, 0, 1000), dims = m ? m.mesh.dims : vec3(1, 1, 1);
      gl.uniform3f(l.shadowPos[i], pos.x, 0, pos.z); gl.uniform2f(l.shadowSize[i], dims.x * 0.66, dims.z * 0.72);
    }
    gl.uniform1i(l.ground, 1); gl.uniform1f(l.seed, 17); gl.uniformMatrix4fv(l.model, false, this.ground.model); this.bindAttributes(this.ground); gl.drawArrays(gl.TRIANGLES, 0, this.ground.count);
    gl.uniform1i(l.ground, 0);
    for (const mesh of this.meshes) {
      gl.uniformMatrix4fv(l.model, false, mesh.model); this.bindAttributes(mesh); this.setMaterial(mesh.profile, mesh.mesh.seed); gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    }
  }
  loop(t) {
    const dt = Math.min(0.05, (t - this.lastTime) / 1000 || 0); this.lastTime = t;
    if (this.autoRotate && !this.drag) this.camera.yaw += dt * 0.16;
    this.draw(); requestAnimationFrame((n) => this.loop(n));
  }
  capture() { return this.canvas.toDataURL('image/png'); }
}


window.BrickMotherRenderer = { BrickRenderer };
