uniform vec4 uS,uE,uC,uNA,uNB,uX;uniform int layerOffset;
out vec4 outState;
vec4 sect(float t){float v=uNB.z>.5?min(t/uNA.x,1.):t;vec4 q=vec4(mix(uS.x,uE.x,v),mix(uC.x,uC.y,v),mix(uC.z,uC.w,v),mix(uS.z,uE.y,v));if(uNB.z>.5)q=mix(q,vec4(uNA.z,uNA.w,uNB.x,uNB.y),smoothstep(uNA.x-uNA.y,uNA.x,t));return q;}
bool boxInterval(vec3 ro,vec3 rd,vec3 bound,out float lo,out float hi){vec3 safe=mix(rd,vec3(1e-8),lessThan(abs(rd),vec3(1e-8)));vec3 a=(-bound-ro)/safe,b=(bound-ro)/safe;vec3 low=min(a,b),high=max(a,b);lo=max(0.,max(low.x,max(low.y,low.z)));hi=min(high.x,min(high.y,high.z));return lo<=hi;}
void coarseValues(vec3 p,out float values[6]){
 float t=clamp(p.z/uS.y+.5,0.,1.);vec4 sc=sect(t);float w=mix(uS.x,sc.x,uE.z),h=sc.y*uE.z,th=mix(uS.z,sc.w,uE.z),k=2.*h/(w*w*.25+h*h),x=clamp(p.x,-w*.5,w*.5),c=sqrt(max(1e-10,1.-k*k*x*x)),top=uE.z*sc.z+k*x*x/(1.+c),bottom=top-th/c;
 values[0]=p.y-top;values[1]=bottom-p.y;values[2]=-w*.5-p.x;values[3]=p.x-w*.5;values[4]=-uS.y*.5-p.z;values[5]=p.z-uS.y*.5;
}
float maximum6(float v[6]){float m=v[0];for(int j=1;j<6;j++)m=max(m,v[j]);return m;}
void main(){vec3 rd=rayDirection();float th=max(uS.z,max(uE.y,uNB.y)),w=max(uS.x,max(uE.x,uNA.z)),y=max(max(abs(uC.x),abs(uC.y)),max(abs(uC.z),abs(uC.w)));y=max(y,max(abs(uNA.w),abs(uNB.x)));vec3 bound=vec3(w*.5+th+.02,y*2.+th+.02,uS.y*.5+th+.02);float lo,hi;
 if(!boxInterval(eye,rd,bound,lo,hi)){outState=vec4(0);return;}
 float seed=lo,bestNear=1e9,previous=lo;float values[6];bool inside=false;
 for(int i=0;i<=96;i++){float s=mix(lo,hi,float(i)/96.);coarseValues(eye+rd*s,values);float v=maximum6(values);if(v<bestNear){bestNear=v;seed=s;}if(v<=0.){float l=previous,h=s;for(int j=0;j<8;j++){float m=(l+h)*.5;coarseValues(eye+rd*m,values);if(maximum6(values)<=0.)h=m;else l=m;}seed=h;inside=true;break;}previous=s;}
 if(!inside&&bestNear>.02){outState=vec4(0);return;}int layer=int(floor(gl_FragCoord.y/resolution.y))+layerOffset;int face=layer<6?layer:layer<10?(layer-6)/2:layer-10;vec3 p=eye+seed*rd;float a=clamp(face<2?p.x/w+.5:face<4?p.z/uS.y+.5:p.x/w+.5,0.,1.),b=clamp(face<2?p.z/uS.y+.5:.5,0.,1.);
 if(layer>=6&&layer<10){a=mod(float(layer-6),2.)<.5?.2:.8;float t=b;vec4 sc=sect(t);float ww=mix(uS.x,sc.x,uE.z),h=sc.y*uE.z,th=mix(uS.z,sc.w,uE.z),k=2.*h/(ww*ww*.25+h*h),x=(2.*a-1.)*ww*.5,c=sqrt(max(1e-10,1.-k*k*x*x)),top=uE.z*sc.z+k*x*x/(1.+c);vec3 q=vec3(x,top-(face==1?th/c:0.),(t-.5)*uS.y);seed=dot(q-eye,rd);}
 if(layer>=10){float shoulder=uNB.z>.5?uNA.x-uNA.y*.5:.5;float t=face<2?shoulder:face<4?shoulder:face==4?0.:1.,q=face==0?0.:face==1?1.:.9;vec4 sc=sect(t);float ww=mix(uS.x,sc.x,uE.z),h=sc.y*uE.z,th=mix(uS.z,sc.w,uE.z),k=2.*h/(ww*ww*.25+h*h);a=face<2?clamp(p.x/ww+.5,0.,1.):face<4?t:clamp(p.x/ww+.5,0.,1.);b=face<2?t:q;float x=face<4&&face>=2?(face==2?-.5:.5)*ww:(2.*a-1.)*.5*ww,c=sqrt(max(1e-10,1.-k*k*x*x)),top=uE.z*sc.z+k*x*x/(1.+c);vec3 point=vec3(x,top-q*th/c,(t-.5)*uS.y);seed=dot(point-eye,rd);}
 outState=vec4(a,b,seed,float(face+1));
}
