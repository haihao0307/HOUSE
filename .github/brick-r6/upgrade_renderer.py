from pathlib import Path
ROOT=Path(__file__).resolve().parent
BRICK=ROOT.parent.parent/'yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/brick-mother'
s=(BRICK/'experiments/atelier-r5/src/renderer.js').read_text()
def sub(a,b):
 global s
 assert a in s,a[:120]
 s=s.replace(a,b)
sub('uniform float uColor;', 'uniform float uColor;uniform float uRed;uniform float uChar;uniform float uKiln;uniform float uTone;uniform float uMineral;uniform float uPolish;uniform float uStrata;')
start=s.index('// R5: lithology');end=s.index('\nvoid main(){',start)
s=s[:start]+r'''
// R6: limited analytic mineral masks. No 27-cell neighbour search per pixel.
// Shared continuous fields drive related, independently remapped material outputs.
void rockMaterial(vec3 q,float macro,float meso,float micro,float fp,out vec3 base,out float rough,out float height){
 bool worn=uFamily==6;float wear=worn?1.:0.;float variety=clamp(uColor,0.,1.5);
 float g=noise(q*129.7+vec3(2.8,15.7,7.1));
 g=mix(.5,g,1.-smoothstep(.004,.018,fp));
 float broad=noise(q*3.4+vec3(14.1,-8.3,2.7));
 float weather=smoothstep(.60,.83,broad+.15*(meso-.5));
 if(uRock==1){
  // Compact granite candidate: three mineral populations with irregular contacts.
  vec3 gp=q*vec3(45.3,48.1,41.7);
  float cr=noise(gp+vec3(12.3,7.1,-3.4)),other=noise(gp*1.91+vec3(-17.1,4.3,9.7));
  float resolved=1.-smoothstep(.3,.95,fp*48.1);
  float mica=(1.-smoothstep(.23,.32,cr+.13*(other-.5)))*resolved;
  float quartz=smoothstep(.42,.50,cr)*(1.-smoothstep(.64,.72,cr));
  float warm=clamp(.3+.7*meso+uTone*.42,0.,1.);
  vec3 feldspar=mix(vec3(.69,.67,.62),vec3(.67,.44,.34),warm);
  vec3 mineral=mix(feldspar,vec3(.49,.525,.52),quartz);
  mineral=mix(mineral,vec3(.14,.16,.15),mica*(.55+.4*uMineral));
  mineral*=.84+.31*g;
  base=mix(vec3(.57,.54,.49),mineral,resolved*(.25+.75*uMineral));
  rough=(worn?.60:.81)+(uRough-.8)*.68-.06*quartz-.10*mica+.04*(other-.5);
  height=(cr-.5)*(worn?.0005:.0020)+(g-.5)*(worn?.0004:.0014);
 }else if(uRock==2){
  float fine=noise(q*vec3(91.,104.,98.)+vec3(19.,2.,7.));
  fine=mix(.5,fine,1.-smoothstep(.32,1.2,fp*104.));
  float bed=noise(vec3(q.x*3.1,q.y*16.7+macro*.38,q.z*4.3));
  base=mix(vec3(.48,.33,.20),vec3(.73,.62,.44),clamp(.49+(macro-.5)*variety*1.5+.10*(bed-.5),0.,1.));
  base=mix(base,vec3(.54,.36,.23),weather*.28);
  base*=.96+.20*(fine-.5)*(.25+.75*uMineral);
  rough=(worn?.76:.90)+(uRough-.8)*.62+.055*(fine-.5);
  height=(fine-.5)*(worn?.00055:.0027)+(bed-.5)*uStrata*(worn?.0006:.0036);
 }else if(uRock==3){
  float fine=noise(q*vec3(70.,148.,99.)+vec3(14.2,2.7,-8.3));
  float fleck=smoothstep(.72,.86,fine)*(1.-smoothstep(.3,1.2,fp*148.));
  base=mix(vec3(.22,.25,.29),vec3(.38,.405,.386),clamp(.5+(macro-.5)*1.7*variety,0.,1.));
  base=mix(base,vec3(.62,.61,.52),fleck*(.15+.5*uMineral));
  base=mix(base,vec3(.38,.29,.22),weather*.4);
  rough=(worn?.60:.82)+(uRough-.8)*.67+.045*(g-.5);
  height=(g-.5)*(worn?.00033:.0015)+fleck*.0004;
 }else if(uRock==4){
  float gran=noise(q*67.2+vec3(14.,6.,1.));
  float vein=noise(q*vec3(3.1,7.4,4.7)+vec3(18.7,5.3,7.4));
  base=mix(vec3(.52,.52,.48),vec3(.79,.745,.643),clamp(.5+(macro-.5)*1.4*variety,0.,1.));
  base=mix(base,vec3(.86,.84,.76),smoothstep(.51,.67,vein)*uMineral*.45);
  base*=.97+.16*(gran-.5);
  rough=(worn?.56:.79)+(uRough-.8)*.67-.09*smoothstep(.52,.7,vein);
  height=(gran-.5)*(worn?.00035:.0017);
 }else if(uRock==5){
  float layer=noise(vec3(q.x*2.5,q.y*(17.+20.*uStrata)+broad*.38,q.z*2.7));
  base=mix(vec3(.20,.255,.285),vec3(.45,.49,.478),clamp(.52+(layer-.5)*1.2*variety,0.,1.));
  base=mix(base,vec3(.53,.394,.28),weather*.28);
  base=mix(base,vec3(.62,.63,.60),smoothstep(.64,.80,g)*uMineral*.22);
  rough=(worn?.56:.78)+(uRough-.8)*.67+.1*(layer-.5);
  height=(layer-.5)*(.001+uStrata*.005)*(worn?.22:1.)+(g-.5)*.0008;
 }else if(uRock==6){
  float band=noise(vec3(q.x*3.2,q.y*(12.+uStrata*13.)+macro*.7,q.z*3.6));
  float grain=noise(q*52.1+vec3(11.7,-3.9,4.2));
  base=mix(vec3(.21,.23,.24),vec3(.73,.70,.63),smoothstep(.30,.65,band));
  base=mix(base,vec3(.40,.31,.275),weather*.28);
  base*=.90+.21*grain*(.25+.75*uMineral);
  rough=(worn?.58:.81)+(uRough-.8)*.68+.08*(grain-.5);
  height=(grain-.5)*(worn?.0004:.0023)+(band-.5)*uStrata*(worn?.0003:.0028);
 }else{
  float vein=noise(vec3(q.x*3.8,q.y*9.1+broad*.6,q.z*4.1));
  float mask=(1.-smoothstep(.018,.095,abs(vein-.49)))*(.3+.7*meso);
  base=mix(vec3(.64,.67,.653),vec3(.81,.78,.69),clamp(.5+(macro-.5)*1.8,0.,1.));
  base=mix(base,vec3(.27,.32,.34),mask*(.20+.62*uMineral));
  rough=(worn?.49:.72)+(uRough-.8)*.68+.07*mask;
  height=(g-.5)*(worn?.0002:.0010);
 }
 // Coherent colour variation uses low-frequency regions, not independent RGB dots.
 base*=1.+(macro-.5)*.20*variety;
 base=mix(base,base*vec3(1.13,.99,.85),max(uTone,0.));
 base=mix(base,base*vec3(.86,.99,1.16),max(-uTone,0.));
 rough=clamp(rough-(worn?uPolish*.20:0.),.27,.99);
 if(!worn)height+=(broad-.5)*.0012;
}
''' + s[end:]
start=s.index('  base=mix(vec3(.61,.249,.116)');end=s.index(' }else if(uFamily==3)',start)
s=s[:start]+r'''
  // Coverage and contrast are independent, as in a remapped material mask.
  vec3 clay=mix(vec3(.62,.305,.18),vec3(.73,.245,.14),uRed);
  base=clay*(.92+.18*b);
  float soot=smoothstep(1.-uChar*.56,1.08-uChar*.56,a+.20*(drift-.5));
  base=mix(base,vec3(.22,.175,.145),soot*.78);
  base=mix(base,vec3(.74,.58,.41),smoothstep(.66,.82,b)*.16*weight);
  base=mix(base,vec3(.71,.68,.58),mineral*smoothstep(.60,.78,b)*.30*weight);
  detail=field*.010+(grain-.5)*.005;
  rough=clamp(rough+.08*(drift-.5)-.04*soot,.48,.99);
  if(uFamily==4){
   float fired=smoothstep(.38,.68,drift*.62+a*.38);
   base=mix(base,vec3(.47,.235,.212),fired*uKiln*.67);
   base=mix(base,vec3(.78,.42,.235),smoothstep(.52,.75,b)*(1.-fired)*uKiln*.50);
   rough=clamp(rough-fired*uKiln*.17,.40,.99);
  }
  base*=.98+.08*c;
  base=mix(base,base*vec3(1.10,.99,.88),max(uTone,0.));
  base=mix(base,base*vec3(.90,1.,1.12),max(-uTone,0.));
''' + s[end:]
sub('  detail=(abs(field)-.30)*.010+(grain-.5)*.006;', '  base*=vec3(1.+uTone*.10,1.,1.-uTone*.12);\n  detail=(abs(field)-.30)*.0045+(grain-.5)*.0045+(drift-.5)*.0015;')
sub('  detail=fiber*.00025;rough=.93;ao=.92;', '''  if(vKind>4.5){
   float rim=smoothstep(.85,.985,vD.z),ribs=sin(vD.x*43.+vD.z*2.3);
   base=mix(vec3(.52,.409,.24),vec3(.73,.61,.39),rim*.70+.16*(ribs*.5+.5));
   base=mix(base,vec3(.43,.329,.211),clamp(vD.w*.55,0.,.85));
   detail=ribs*.00010;rough=.87;ao=.94;
  }else{detail=fiber*.00025;rough=.93;ao=.92;}''')
sub('Math.min(4,Math.round(rock))','Math.min(7,Math.round(rock))')
sub("'uColor','uExposure'", "'uColor','uRed','uChar','uKiln','uTone','uMineral','uPolish','uStrata','uExposure'")
sub('rock:0,mode:0', 'rock:0,red:.72,char:.16,kiln:.45,tone:0,mineral:.6,polish:.3,strata:.7,mode:0')
sub("['uColor','color'],['uExposure','exposure']", "['uColor','color'],['uRed','red'],['uChar','char'],['uKiln','kiln'],['uTone','tone'],['uMineral','mineral'],['uPolish','polish'],['uStrata','strata'],['uExposure','exposure']")
sub('gl,object:()=>lastGeometry', 'gl,programCount:()=>materialPrograms.size,object:()=>lastGeometry')
(BRICK/'experiments/atelier-r6/src/renderer.js').write_text(s)
