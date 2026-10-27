// Display-only direct intersection renderer. No object vertex/index buffers.
const TILE_VERTEX=`#version 300 es
precision highp float;
void main(){vec2 p=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.);gl_Position=vec4(p,0,1);}`;
const TILE_FRAGMENT=`#version 300 es
precision highp float;
uniform vec2 resolution;uniform vec3 eye,target,size;uniform float bend,floorY;uniform int viewMode;
out vec4 color;
float K,H,CE,CAP;
// Implicit annular sector: 0 <= k(x²+y²)-2y <= 2T+kT², with two side planes.
bool domain(vec3 p,float eps){float y=p.y-size.z*.5,f=K*(p.x*p.x+y*y)-2.*y;return f>=-eps&&f<=CAP+eps&&CE*abs(p.x)+K*size.y*.5*(y-H)<=size.y*.5*CE+eps&&abs(p.z)<=size.x*.5+eps;}
void candidate(float t,vec3 n,vec3 ro,vec3 rd,inout float best,inout vec3 normal){if(t>.000001&&t<best&&domain(ro+rd*t,0.000002)){best=t;normal=normalize(n);}}
void cylinder(float q,vec3 ro,vec3 rd,inout float best,inout vec3 normal){
 float oy=ro.y-size.z*.5,A=K*dot(rd.xy,rd.xy),B=2.*K*(ro.x*rd.x+oy*rd.y)-2.*rd.y,C=K*(ro.x*ro.x+oy*oy)-2.*oy-q*CAP;
 if(abs(A)<1e-10){if(abs(B)>1e-10){float t=-C/B;vec3 p=ro+rd*t,n=vec3(K*p.x,K*(p.y-size.z*.5)-1.,0);candidate(t,q<.5?-n:n,ro,rd,best,normal);}return;}
 float D=B*B-4.*A*C,tol=(B*B+abs(4.*A*C))*1e-6;if(D < -tol)return;float root=sqrt(max(0.,D)),v=-.5*(B+(B>=0.?root:-root));float ta=v/A,tb=abs(v)>1e-20?C/v:-B/(2.*A);
 for(int i=0;i<2;i++){float t=i==0?ta:tb;vec3 p=ro+rd*t,n=vec3(K*p.x,K*(p.y-size.z*.5)-1.,0);candidate(t,q<.5?-n:n,ro,rd,best,normal);}
}
float hit(vec3 ro,vec3 rd,out vec3 n){float best=1e10;n=vec3(0);cylinder(0.,ro,rd,best,n);cylinder(1.,ro,rd,best,n);
 for(int i=0;i<2;i++){float s=i==0?-1.:1.;vec3 side=vec3(s*CE,K*size.y*.5,0);float den=dot(side,rd);if(abs(den)>1e-10){float d=size.y*.5*CE+K*size.y*.5*(H+size.z*.5);candidate((d-dot(side,ro))/den,side,ro,rd,best,n);}if(abs(rd.z)>1e-10)candidate((s*size.x*.5-ro.z)/rd.z,vec3(0,0,s),ro,rd,best,n);}
 return best;}
void main(){H=.45*size.y*bend;K=2.*H/(size.y*size.y*.25+H*H);CE=sqrt(max(0.,1.-K*K*size.y*size.y*.25));CAP=2.*size.z+K*size.z*size.z;
 vec3 forward=normalize(target-eye),right=normalize(cross(forward,vec3(0,1,0))),up=cross(right,forward);vec2 uv=(2.*gl_FragCoord.xy-resolution)/resolution.y;vec3 rd=normalize(forward+0.33*(uv.x*right+uv.y*up));vec3 n;float t=hit(eye,rd,n),ground=abs(rd.y)>1e-8?(floorY-eye.y)/rd.y:1e10;
 vec3 col=vec3(.76,.77,.75),L=normalize(vec3(-3.6,7.5,4.1)),F=normalize(vec3(1.2,.6,-.8));
 if(t<1e9&&(ground<0.||t<ground)){vec3 p=eye+t*rd;float key=max(0.,dot(n,L)),fill=max(0.,dot(n,F));vec3 nn;float shadow=hit(p+n*.00001,L,nn)<1e9?.25:1.;float light=.26+.60*key*shadow+.20*fill;col=vec3(.47)*light;col=pow(col,vec3(1./2.2));if(viewMode==1)col=n*.5+.5;}
 else if(ground>0.&&ground<1e9){vec3 p=eye+ground*rd,nn;float shadow=hit(p+vec3(0,.00001,0),L,nn)<1e9?.78:1.;col=vec3(.76,.77,.75)*shadow;}
 color=vec4(col,1);
}`;
class TileRenderer{
 constructor(canvas){this.canvas=canvas;this.gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true});if(!this.gl)return new CPUAnalyticRenderer(canvas);this.mode='GPU analytic rays';const gl=this.gl;
 const compile=(type,s)=>{const h=gl.createShader(type);gl.shaderSource(h,s);gl.compileShader(h);if(!gl.getShaderParameter(h,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(h));return h};const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,TILE_VERTEX));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,TILE_FRAGMENT));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));this.program=p;this.uniforms={};for(const k of ['resolution','eye','target','size','bend','floorY','viewMode'])this.uniforms[k]=gl.getUniformLocation(p,k);this.frames=0;}
 render(record,camera,viewMode=0){const gl=this.gl,c=this.canvas,dpr=Math.min(devicePixelRatio||1,1.5),w=Math.max(1,Math.round(c.clientWidth*dpr)),h=Math.max(1,Math.round(c.clientHeight*dpr));if(c.width!==w||c.height!==h){c.width=w;c.height=h;}gl.viewport(0,0,w,h);gl.useProgram(this.program);const s=record.Object.size,b=record.Object.bend,eye=[camera.target[0]+camera.distance*Math.cos(camera.pitch)*Math.sin(camera.yaw),camera.target[1]+camera.distance*Math.sin(camera.pitch),camera.target[2]+camera.distance*Math.cos(camera.pitch)*Math.cos(camera.yaw)];const scale=Math.max(...s),scaled=a=>a.map(v=>v/scale);const u=this.uniforms;gl.uniform2f(u.resolution,w,h);gl.uniform3fv(u.eye,scaled(eye));gl.uniform3fv(u.target,scaled(camera.target));gl.uniform3fv(u.size,scaled(s));gl.uniform1f(u.bend,b);gl.uniform1f(u.floorY,(Math.min(-s[2]/2,.45*s[1]*b-s[2]/2)-.012)/scale);gl.uniform1i(u.viewMode,viewMode);gl.drawArrays(gl.TRIANGLES,0,3);this.frames++;}
}
