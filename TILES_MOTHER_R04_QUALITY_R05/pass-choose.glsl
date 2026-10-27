uniform sampler2D stateTex,point0,previousBest;uniform bool firstBatch;
out vec4 outBest;
void main(){ivec2 xy=ivec2(gl_FragCoord.xy);vec3 rd=rayDirection();vec4 best=firstBatch?vec4(0):texelFetch(previousBest,xy,0);float distance=best.w>.5?best.z:1e9,bestResidual=best.w>.5?fract(best.w):1e9;
 for(int layer=0;layer<4;layer++){ivec2 k=xy+ivec2(0,int(resolution.y)*layer);vec4 s=texelFetch(stateTex,k,0);if(s.w<.5)continue;vec3 p=texelFetch(point0,k,0).xyz;float residual=length(p-(eye+s.z*rd));if(residual<.00002&&s.z>0.&&(s.z<distance-.00005||(abs(s.z-distance)<.00005&&residual<bestResidual))){best=s;best.w=floor(s.w)+residual;bestResidual=residual;distance=s.z;}}outBest=best;}
