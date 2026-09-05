/* Reference-informed surface layers. These are editable visual candidates,
   not measured albedo/roughness/height. Original clayShader remains unmodified. */
const studySurfaceShader=`
uniform vec4 studySurface;
vec3 studySurfaceColor(vec3 base){
  vec3 p=vRest*26.+identity.xyz;
  float coarse=tf(p*.36+vec3(12.,-7.,9.));
  float mid=tf(p*1.8+vec3(31.,8.,2.));
  float mineral=tf(p*6.1+vec3(8.,19.,-4.));
  float warm=smoothstep(.52,.70,coarse+(mid-.5)*.22);
  float pale=smoothstep(.54,.73,tf(p*.72+41.)+(mineral-.5)*.23);
  float deep=smoothstep(.59,.77,tf(p*.53-26.));
  vec3 c=mix(base,vec3(.48,.37,.275),warm*.32*studySurface.y);
  c=mix(c,vec3(.60,.585,.54),pale*.30*studySurface.y);
  c=mix(c,vec3(.265,.305,.325),deep*.16*studySurface.y);
  // Low-amplitude interrupted striations, varied per stable material identity.
  float direction=(identity.x*.073-.5)*.5;
  float line=sin((vRest.x+vRest.z*direction)*3600.+tn(p*2.)*7.);
  float mask=smoothstep(.44,.61,mid)*smoothstep(.78,.97,line);
  c-=mask*.018*studySurface.z;
  c+=(mineral-.5)*.025*studySurface.y;
  return mix(base,clamp(c,vec3(.16),vec3(.76)),studySurface.x);
}
`;
function studyClayMaterial(kind,variant,age,wet=0){
  if(state.mode==='clay')return new THREE.MeshStandardMaterial({color:0x969e9b,roughness:.82,metalness:0,side:THREE.FrontSide,envMapIntensity:.55});
  const m=clayMaterial(kind,variant,age,wet);
  if(!m.userData.study){
    const before=m.onBeforeCompile;
    m.userData.study={value:new THREE.Vector4(state.surfaceRevision?1:0,state.colorLayer??1,state.striations??.7,0)};
    m.onBeforeCompile=s=>{before(s);s.uniforms.studySurface=m.userData.study;
      s.fragmentShader=s.fragmentShader.replace('vec3 clayColor(){',studySurfaceShader+'\nvec3 clayColor(){');
      s.fragmentShader=s.fragmentShader.replace('srgbLinear(clayColor())','srgbLinear(studySurfaceColor(clayColor()))');
      s.fragmentShader=s.fragmentShader.replace('roughnessFactor=clayRough();','roughnessFactor=clayRough(); roughnessFactor=clamp(roughnessFactor+studySurface.x*(tf(vRest*120.+identity.xyz)-.5)*.075,.30,.95);');
    };
    m.customProgramCacheKey=()=>`tm099-study-${kind}`;
  }
  return m;
}
function updateStudySurface(){
  for(const m of materialCache.values())if(m.userData.study)m.userData.study.value.set(state.surfaceRevision?1:0,state.colorLayer??1,state.striations??.7,0);
  needsRender=true;
}
