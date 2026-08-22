(function(global){
  'use strict';

  const COMPONENT_BYTES={5121:1,5123:2,5125:4,5126:4};
  const TYPE_SIZE={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};

  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  function mul(a,b){
    const o=new Float32Array(16);
    for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
    return o;
  }
  function perspective(fov,aspect,near,far){
    const f=1/Math.tan(fov/2),nf=1/(near-far);
    return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);
  }
  function lookAt(eye,target,up){
    let zx=eye[0]-target[0],zy=eye[1]-target[1],zz=eye[2]-target[2];
    let n=Math.hypot(zx,zy,zz)||1;zx/=n;zy/=n;zz/=n;
    let xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;
    n=Math.hypot(xx,xy,xz)||1;xx/=n;xy/=n;xz/=n;
    const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
    return new Float32Array([xx,yx,zx,0,xy,yy,zy,0,xz,yz,zz,0,-(xx*eye[0]+xy*eye[1]+xz*eye[2]),-(yx*eye[0]+yy*eye[1]+yz*eye[2]),-(zx*eye[0]+zy*eye[1]+zz*eye[2]),1]);
  }
  function shader(gl,type,source){
    const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'Shader 编译失败');
    return s;
  }
  function program(gl,useDerivatives){
    const vs=shader(gl,gl.VERTEX_SHADER,`attribute vec3 aPosition;attribute vec3 aNormal;attribute vec2 aUV;uniform mat4 uMVP;varying vec3 vPosition;varying vec3 vNormal;varying vec2 vUV;void main(){gl_Position=uMVP*vec4(aPosition,1.0);vPosition=aPosition;vNormal=aNormal;vUV=aUV;}`);
    const normalCode=useDerivatives?`mat3 cotangentFrame(vec3 N,vec3 p,vec2 uv){vec3 dp1=dFdx(p),dp2=dFdy(p),dp2perp=cross(dp2,N),dp1perp=cross(N,dp1);vec2 duv1=dFdx(uv),duv2=dFdy(uv);vec3 T=dp2perp*duv1.x+dp1perp*duv2.x;vec3 B=dp2perp*duv1.y+dp1perp*duv2.y;float invmax=inversesqrt(max(max(dot(T,T),dot(B,B)),1e-6));return mat3(T*invmax,B*invmax,N);}vec3 mappedNormal(vec3 N){vec3 map=texture2D(uNormal,vUV).xyz*2.0-1.0;return normalize(cotangentFrame(N,vPosition,vUV)*map);}`:`vec3 mappedNormal(vec3 N){return N;}`;
    const extension=useDerivatives?'#extension GL_OES_standard_derivatives : enable\n':'';
    const fs=shader(gl,gl.FRAGMENT_SHADER,`${extension}precision mediump float;uniform sampler2D uBase;uniform sampler2D uNormal;uniform float uNormalEnabled;uniform vec4 uFactor;uniform float uAlphaCut;varying vec3 vPosition;varying vec3 vNormal;varying vec2 vUV;${normalCode}void main(){vec4 tex=texture2D(uBase,vUV)*uFactor;if(tex.a<uAlphaCut)discard;vec3 n=normalize(vNormal);if(uNormalEnabled>.5)n=mappedNormal(n);float d=abs(dot(n,normalize(vec3(.35,.82,.44))));float light=.72+.28*d;vec3 albedo=pow(max(tex.rgb,vec3(.035)),vec3(.62));vec3 c=albedo*light+vec3(.025,.022,.018);gl_FragColor=vec4(c,tex.a);}`);
    const p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'Shader 链接失败');
    gl.deleteShader(vs);gl.deleteShader(fs);return p;
  }
  function parseGLB(buffer){
    const view=new DataView(buffer);
    if(view.getUint32(0,true)!==0x46546c67)throw new Error('不是有效 GLB 文件');
    if(view.getUint32(4,true)!==2)throw new Error('仅支持 glTF 2.0');
    let offset=12,json=null,bin=null;
    while(offset<buffer.byteLength){const len=view.getUint32(offset,true),type=view.getUint32(offset+4,true);offset+=8;const chunk=buffer.slice(offset,offset+len);offset+=len;if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(chunk));if(type===0x004e4942)bin=chunk;}
    if(!json||!bin)throw new Error('GLB 缺少 JSON 或 BIN 数据块');
    return {json,bin};
  }
  function groupFor(name){
    if(name.includes('ROOF'))return 'roof';
    if(name.includes('LEVEL_02'))return 'level2';
    if(name.includes('LEVEL_01'))return 'level1';
    if(name.includes('SITE_BASE'))return 'site';
    return 'details';
  }

  class Viewer{
    constructor(canvas,options={}){
      this.canvas=canvas;this.options=options;this.gl=canvas.getContext('webgl',{alpha:false,antialias:true,preserveDrawingBuffer:true});
      if(!this.gl)throw new Error('浏览器不支持 WebGL');
      this.extUint=this.gl.getExtension('OES_element_index_uint');
      this.extDerivatives=this.gl.getExtension('OES_standard_derivatives');
      this.extAnisotropy=this.gl.getExtension('EXT_texture_filter_anisotropic')||this.gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')||this.gl.getExtension('MOZ_EXT_texture_filter_anisotropic');
      this.maxTextureSize=this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);
      this.camera={yaw:-.76,pitch:.28,distance:6.6,target:[0,0.7,0]};
      this.fitCamera={yaw:-.76,pitch:.28,distance:6.6,target:[0,0.7,0]};
      this.visible={site:true,details:true,level1:true,level2:true,roof:true};
      this.draws=[];this.loaded=false;this.auto=false;this.raf=0;this.last=0;this.drag=false;this.resources=[];this.modelStats={};this.textureStats={};
      this._initGL();this._bind();this.resize();this._loop=(timestamp)=>this.loop(timestamp);this.raf=requestAnimationFrame(this._loop);
    }
    _initGL(){
      const gl=this.gl;this.program=program(gl,!!this.extDerivatives);gl.useProgram(this.program);
      this.loc={position:gl.getAttribLocation(this.program,'aPosition'),normal:gl.getAttribLocation(this.program,'aNormal'),uv:gl.getAttribLocation(this.program,'aUV'),mvp:gl.getUniformLocation(this.program,'uMVP'),base:gl.getUniformLocation(this.program,'uBase'),normalMap:gl.getUniformLocation(this.program,'uNormal'),normalEnabled:gl.getUniformLocation(this.program,'uNormalEnabled'),factor:gl.getUniformLocation(this.program,'uFactor'),alphaCut:gl.getUniformLocation(this.program,'uAlphaCut')};
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      this.baseTexture=this._makeTexture([185,171,147,255]);this.normalTexture=this._makeTexture([128,128,255,255]);
    }
    _makeTexture(pixel){const gl=this.gl,t=gl.createTexture();this.resources.push(['texture',t]);gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(pixel));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t}
    _clearDrawBuffers(){const gl=this.gl;for(const [type,obj] of this.resources)if(type==='buffer')gl.deleteBuffer(obj);this.resources=this.resources.filter(([type])=>type!=='buffer');this.draws=[];this.loaded=false}
    _bind(){
      const c=this.canvas;
      this.onDown=e=>{this.drag=true;this.px=e.clientX;this.py=e.clientY;c.setPointerCapture(e.pointerId)};
      this.onMove=e=>{if(!this.drag)return;this.camera.yaw+=(e.clientX-this.px)*.007;this.camera.pitch=clamp(this.camera.pitch+(e.clientY-this.py)*.006,-1.35,1.35);this.px=e.clientX;this.py=e.clientY};
      this.onUp=()=>this.drag=false;this.onWheel=e=>{e.preventDefault();this.camera.distance=clamp(this.camera.distance*Math.exp(e.deltaY*.001),2.7,160)};
      c.addEventListener('pointerdown',this.onDown);c.addEventListener('pointermove',this.onMove);c.addEventListener('pointerup',this.onUp);c.addEventListener('pointercancel',this.onUp);c.addEventListener('wheel',this.onWheel,{passive:false});
      this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(c);
    }
    async load(url){
      this._state('loading','正在读取可编辑 GLB…');
      let response;
      try{response=await fetch(url)}catch(error){
        if(location.protocol==='file:')throw new Error('浏览器阻止本地网页读取旁边的 GLB；请点“选择本地 GLB”并选中下载的模型');
        throw new Error(`GLB 读取失败：${error.message||error}`);
      }
      if(!response.ok)throw new Error(`GLB 读取失败：HTTP ${response.status}`);
      return this.loadArrayBuffer(await response.arrayBuffer(),url);
    }
    async loadFile(file){
      if(!file)throw new Error('没有选择 GLB 文件');
      if(!/\.glb$/i.test(file.name||''))throw new Error('请选择扩展名为 .glb 的文件');
      this._state('loading',`正在读取本地文件 ${file.name}…`);
      return this.loadArrayBuffer(await file.arrayBuffer(),file.name);
    }
    async loadArrayBuffer(buffer,source='本地 GLB'){
      if(!(buffer instanceof ArrayBuffer))throw new Error('GLB 数据格式无效');
      this._clearDrawBuffers();
      const {json,bin}=parseGLB(buffer);
      if((json.animations||[]).length||(json.skins||[]).length||(json.cameras||[]).length)throw new Error('主档包含不应存在的动画、骨骼或相机');
      await this._loadTextures(json,bin);
      const gl=this.gl,bufferCache=new Map();
      const getBuffer=viewIndex=>{if(bufferCache.has(viewIndex))return bufferCache.get(viewIndex);const bv=json.bufferViews[viewIndex],bytes=new Uint8Array(bin,bv.byteOffset||0,bv.byteLength),buf=gl.createBuffer(),target=bv.target===34963?gl.ELEMENT_ARRAY_BUFFER:gl.ARRAY_BUFFER;gl.bindBuffer(target,buf);gl.bufferData(target,bytes,gl.STATIC_DRAW);bufferCache.set(viewIndex,buf);this.resources.push(['buffer',buf]);return buf};
      let triangles=0,vertices=0,primitives=0,boundsMin=[Infinity,Infinity,Infinity],boundsMax=[-Infinity,-Infinity,-Infinity];
      (json.meshes||[]).forEach((mesh,meshIndex)=>(mesh.primitives||[]).forEach(primitive=>{
        if(primitive.mode!==undefined&&primitive.mode!==4)return;
        const name=mesh.name||`MESH_${meshIndex}`,attrs={};
        for(const [semantic,index] of Object.entries(primitive.attributes||{})){const a=json.accessors[index],bv=json.bufferViews[a.bufferView];attrs[semantic]={buffer:getBuffer(a.bufferView),size:TYPE_SIZE[a.type],type:a.componentType,stride:bv.byteStride||0,offset:a.byteOffset||0,normalized:!!a.normalized,count:a.count};}
        const ia=json.accessors[primitive.indices],ibv=json.bufferViews[ia.bufferView];if(ia.componentType===5125&&!this.extUint)throw new Error('当前 WebGL 不支持 32 位索引');
        const draw={name,group:groupFor(name),attrs,index:{buffer:getBuffer(ia.bufferView),type:ia.componentType,count:ia.count,offset:ia.byteOffset||0}};
        this.draws.push(draw);triangles+=ia.count/3;vertices+=attrs.POSITION?.count||0;primitives++;
        const pa=json.accessors[primitive.attributes.POSITION];if(pa&&pa.min&&pa.max)for(let i=0;i<3;i++){boundsMin[i]=Math.min(boundsMin[i],pa.min[i]);boundsMax[i]=Math.max(boundsMax[i],pa.max[i])}
      }));
      const displaySize=boundsMax.map((value,index)=>Number.isFinite(value)?value-boundsMin[index]:0);
      if(Number.isFinite(boundsMin[0])){
        const target=boundsMin.map((v,i)=>(v+boundsMax[i])/2);
        const distance=Math.max(...displaySize)*1.75;
        this.fitCamera={yaw:-.76,pitch:.28,distance,target};
        this.camera={yaw:this.fitCamera.yaw,pitch:this.fitCamera.pitch,distance:this.fitCamera.distance,target:[...this.fitCamera.target]};
      }
      this.modelStats={loaded:true,url:source,source,nodes:(json.nodes||[]).length,meshes:(json.meshes||[]).length,primitives,vertices,triangles:Math.round(triangles),animations:(json.animations||[]).length,skins:(json.skins||[]).length,cameras:(json.cameras||[]).length,textures:{...this.textureStats},normalMapActive:!!(this.textureStats.normal&&this.extDerivatives),maxTextureSize:this.maxTextureSize,dpr:Math.min(devicePixelRatio||1,2.5),bounds:{min:boundsMin,max:boundsMax,size:displaySize}};
      const base=this.textureStats.base,textureLabel=base?` · ${base.width.toLocaleString()}×${base.height.toLocaleString()} 底色`:'';
      this.loaded=true;this._state('ready',`已载入 ${primitives} 个可选网格 · ${Math.round(triangles).toLocaleString()} 三角面${textureLabel}${this.modelStats.normalMapActive?' · 法线贴图已启用':''}`);return this.modelStats;
    }
    _textureSource(json,textureIndex){if(textureIndex===undefined||textureIndex===null)return undefined;const texture=json.textures?.[textureIndex];return texture?.source??texture?.extensions?.KHR_texture_basisu?.source}
    async _loadTextures(json,bin){
      const material=(json.materials||[])[0],baseIndex=material?.pbrMetallicRoughness?.baseColorTexture?.index,normalIndex=material?.normalTexture?.index;
      this.textureStats={};
      const baseSource=this._textureSource(json,baseIndex===undefined?0:baseIndex),normalSource=this._textureSource(json,normalIndex);
      if(baseSource!==undefined)this.textureStats.base=await this._loadImageTexture(json,bin,baseSource,this.baseTexture,'底色');
      if(normalSource!==undefined)this.textureStats.normal=await this._loadImageTexture(json,bin,normalSource,this.normalTexture,'法线');
    }
    async _loadImageTexture(json,bin,sourceIndex,texture,label){
      const image=(json.images||[])[sourceIndex];if(!image||image.bufferView===undefined)return null;
      const bv=json.bufferViews[image.bufferView],blob=new Blob([bin.slice(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength)],{type:image.mimeType||'image/png'}),url=URL.createObjectURL(blob),img=new Image();
      try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error(`GLB ${label}贴图解码失败`));img.src=url});if(img.width>this.maxTextureSize||img.height>this.maxTextureSize)throw new Error(`${label}贴图 ${img.width}×${img.height} 超过当前显卡上限 ${this.maxTextureSize}；请改用网页标准档`);const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);const pot=v=>v>0&&(v&(v-1))===0;gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);if(pot(img.width)&&pot(img.height)){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT)}else{gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE)}if(this.extAnisotropy){const max=gl.getParameter(this.extAnisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT);gl.texParameterf(gl.TEXTURE_2D,this.extAnisotropy.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(max,8))}return {width:img.width,height:img.height,mimeType:image.mimeType||'image/png',source:sourceIndex,label};}finally{URL.revokeObjectURL(url)}
    }
    _state(kind,text){if(this.options.onState)this.options.onState({kind,text,stats:this.modelStats})}
    setGroup(group,value){if(group in this.visible)this.visible[group]=!!value}
    setAuto(value){this.auto=!!value;if(this.auto)this.last=performance.now()}
    fit(){this.camera={yaw:this.fitCamera.yaw,pitch:this.fitCamera.pitch,distance:this.fitCamera.distance,target:[...this.fitCamera.target]}}
    resize(){const d=Math.min(devicePixelRatio||1,2.5),w=Math.max(1,Math.floor(this.canvas.clientWidth*d)),h=Math.max(1,Math.floor(this.canvas.clientHeight*d));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h}this.gl.viewport(0,0,w,h)}
    draw(){
      const gl=this.gl;this.resize();gl.clearColor(.09,.12,.105,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(!this.loaded)return;
      const c=this.camera,cp=Math.cos(c.pitch),eye=[c.target[0]+Math.sin(c.yaw)*cp*c.distance,c.target[1]+Math.sin(c.pitch)*c.distance,c.target[2]+Math.cos(c.yaw)*cp*c.distance],mvp=mul(perspective(Math.PI/4,this.canvas.width/this.canvas.height,.02,Math.max(100,c.distance*8)),lookAt(eye,c.target,[0,1,0]));
      gl.useProgram(this.program);gl.uniformMatrix4fv(this.loc.mvp,false,mvp);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.baseTexture);if(this.loc.base)gl.uniform1i(this.loc.base,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.normalTexture);if(this.loc.normalMap)gl.uniform1i(this.loc.normalMap,1);if(this.loc.normalEnabled)gl.uniform1f(this.loc.normalEnabled,this.modelStats.normalMapActive?1:0);gl.uniform4f(this.loc.factor,1,1,1,1);gl.uniform1f(this.loc.alphaCut,.025);
      for(const d of this.draws){if(!this.visible[d.group])continue;const bind=(key,loc,fallback)=>{const a=d.attrs[key];if(!a){gl.disableVertexAttribArray(loc);gl.vertexAttrib3f(loc,...fallback);return}gl.bindBuffer(gl.ARRAY_BUFFER,a.buffer);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,a.size,a.type,a.normalized,a.stride,a.offset)};bind('POSITION',this.loc.position,[0,0,0]);bind('NORMAL',this.loc.normal,[0,1,0]);const uv=d.attrs.TEXCOORD_0;if(uv){gl.bindBuffer(gl.ARRAY_BUFFER,uv.buffer);gl.enableVertexAttribArray(this.loc.uv);gl.vertexAttribPointer(this.loc.uv,uv.size,uv.type,uv.normalized,uv.stride,uv.offset)}else{gl.disableVertexAttribArray(this.loc.uv);gl.vertexAttrib2f(this.loc.uv,0,0)}gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,d.index.buffer);gl.drawElements(gl.TRIANGLES,d.index.count,d.index.type,d.index.offset)}
    }
    loop(t=0){const dt=Math.min(.05,Math.max(0,(t-this.last)/1000)||0);this.last=t;if(this.auto&&!this.drag)this.camera.yaw+=dt*.18;this.draw();this.raf=requestAnimationFrame(this._loop)}
    stats(){return {...this.modelStats,groups:{...this.visible},auto:this.auto,camera:{yaw:this.camera.yaw,pitch:this.camera.pitch,distance:this.camera.distance,target:[...this.camera.target]}}}
    destroy(){cancelAnimationFrame(this.raf);if(this.observer)this.observer.disconnect();const c=this.canvas;c.removeEventListener('pointerdown',this.onDown);c.removeEventListener('pointermove',this.onMove);c.removeEventListener('pointerup',this.onUp);c.removeEventListener('pointercancel',this.onUp);c.removeEventListener('wheel',this.onWheel);for(const [type,obj] of this.resources){if(type==='buffer')this.gl.deleteBuffer(obj);if(type==='texture')this.gl.deleteTexture(obj)}if(this.program)this.gl.deleteProgram(this.program);this.draws=[];this.loaded=false}
  }

  global.TuanjieGLBViewer={create:(canvas,options)=>new Viewer(canvas,options)};
})(window);
