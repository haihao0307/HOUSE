uniform vec2 resolution;uniform vec3 eye,target,cameraUp;uniform float focal;
vec3 rayDirection(){vec3 f=normalize(target-eye),r=normalize(cross(f,cameraUp)),v=cross(r,f);vec2 pixel=vec2(gl_FragCoord.x,mod(gl_FragCoord.y,resolution.y));vec2 uv=(2.*pixel-resolution)/resolution.y/focal;return normalize(f+uv.x*r+uv.y*v);}
vec3 coordinates(int face,float a,float b){if(face<2)return vec3(2.*a-1.,b,face==0?0.:1.);if(face<4)return vec3(face==2?-1.:1.,a,b);return vec3(2.*a-1.,face==4?0.:1.,b);}
