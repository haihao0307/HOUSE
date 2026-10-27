uniform sampler2D stateTex;uniform int shift;uniform float sampleStep;
out vec4 outPoint;
void main(){vec4 s=texelFetch(stateTex,ivec2(gl_FragCoord.xy),0);if(s.w<.5){outPoint=vec4(0);return;}int face=int(s.w)-1;float a=s.x,b=s.y;if(shift==1)a+=a<1.-sampleStep?sampleStep:-sampleStep;if(shift==2)b+=b<1.-sampleStep?sampleStep:-sampleStep;vec3 q=coordinates(face,a,b);outPoint=vec4(evaluateTile(q.x,q.y,q.z,.0012).position,1.);}
