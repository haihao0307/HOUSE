from pathlib import Path
ROOT=Path(__file__).resolve().parent
BRICK=ROOT.parent.parent/'yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/brick-mother'
p=BRICK/'experiments/atelier-r6/src/kernel.js'
p.parent.mkdir(parents=True,exist_ok=True)
s=(BRICK/'experiments/atelier-r5/src/kernel.js').read_text()
def sub(a,b):
 global s
 assert a in s,a[:100]
 s=s.replace(a,b)
s=s.replace('Brick Mother R5','Brick Mother R6').replace("version:'R5.0.0'","version:'R6.0.0'")
sub('function validate(c){', '''function validate(c){for(const k of ['strawDensity','huskDensity','chisel','strata','roundness'])if(c?.[k]!==undefined&&(!Number.isFinite(c[k])||c[k]<0||c[k]>1))throw Error('参数越界 '+k);if(c?.rock!==undefined&&(!Number.isInteger(c.rock)||c.rock<0||c.rock>7))throw Error('岩性越界');''')
sub("const R=rng(ss),D=rng(ds),h=", "const hard=isStone&&[1,3,4].includes(c.rock),bedded=isStone&&![1,3,4].includes(c.rock)&&(family==='stone'||[5,6].includes(c.rock)),chisel=c.chisel??.45,strata=c.strata??(family==='stone'?.8:.2),roundness=c.roundness??.85;\n const R=rng(ss),D=rng(ds),h=")
sub("const phase=R()*20,radius=soft?(family==='adobe'?.055+wear*.135:.042+wear*.098):.036;", "const phase=R()*20,radius=soft?(family==='adobe'?.048+wear*.067:.042+wear*.098):.036;")
sub("level+=.09+R()*.22;beds.push([level,(R()-.5)*.16]);", "level+=.09+R()*.22;beds.push([level,(R()-.5)*(.06+strata*.23)]);")
sub("bedOffset=0;if(family==='stone')", "bedOffset=0;if(bedded)")
sub("const qx=Math.abs(px+.018*a)-h[0]+radius,qy=Math.abs(py+.02*a)-h[1]+radius,qz=Math.abs(pz)-h[2]-bedOffset*c.relief+radius;", "const rLocal=family==='adobe'?radius*(.76+.34*(a+.5)+.28*(b+.5)):radius;\n  const recess=family==='adobe'?.019*Math.max(0,noise(px*4.1,py*3.8,pz*4.1,ss+718)-.47):0;\n  const qx=Math.abs(px+.018*a)-h[0]+rLocal+recess,qy=Math.abs(py+.02*a+(family==='adobe'?.016*px-.009*pz:0))-h[1]+rLocal+recess,qz=Math.abs(pz)-h[2]-bedOffset*c.relief+rLocal+recess;")
sub("Math.min(Math.max(qx,qy,qz),0)-radius;", "Math.min(Math.max(qx,qy,qz),0)-rLocal;")
sub("sd=k1>1e-9?k0*(k0-1)/k1:-Math.min(...h);}", "sd=k1>1e-9?k0*(k0-1)/k1:-Math.min(...h);sd+=(1-roundness)*(.055*a+.018*b+.016*Math.sin(px*3+py*2));}")
sub("sd+=(a*.032+b*.028*(.16+.84*faceWeight))*c.relief;", "sd+=(a*(family==='adobe'?.063:.032)+b*.028*(.16+.84*faceWeight))*c.relief;")
sub("}else sd+=a*(family==='rubble'?.16:.060)*c.relief+(b*(isStone?.072:.052)+Math.pow(clamp((b+.5-.35)/.36),.32)*.035)*c.relief;", "}else sd+=a*(family==='rubble'?.16:.060)*c.relief+(b*(isStone?.072:.052)+Math.pow(clamp((b+.5-.35)/.36),.32)*.035)*c.relief*(hard?.26:1);")
sub("const count=Math.round(c.damage*(isPebble?7:isStone?55:isBrick?66:54));", "const count=Math.round(c.damage*(isPebble?7:isStone?(hard?22:48):isBrick?66:54));")
sub("if(isStone){ru*=1.1;rv*=.58;}", "if(isStone){ru*=hard?.75:1.1;rv*=hard?.72:.58;rd*=hard?.28:.8;}")
sub("if(c.damage>(soft?.50:0)&&!isPebble)for(let k=0;k<(isStone?9:3);k++){", "if(c.damage>(soft?.50:0)&&!isPebble&&!hard)for(let k=0;k<(isStone?9:3);k++){")
sub("if(isStone&&c.damage>0)","if(isStone)")
sub("for(let k=0;k<18;k++){", "for(let k=0;k<Math.round(chisel*32);k++){")
sub(".035+c.damage*.045,angle,'chip');", ".018+chisel*.044+(hard?.006:c.damage*.03),angle,'chip');")
sub("if(c.shape==='half')faceEvent", "if(bedded&&strata>0){for(let k=0;k<beds.length;k++){for(const sign of [-1,1])faceEvent(2,sign,(D()-.5)*h[0],beds[k][0],.30+D()*.35,.022+strata*.014,.037+strata*.067,-.14,'chip');}}\n if(c.shape==='half')faceEvent")
sub("const fiberAudit=[],rejectedFibers=[];", "const fiberAudit=[],rejectedFibers=[],huskAudit=[];")
sub("for(let f=0;f<288;f++){", "for(let f=0;f<Math.round(384*(c.strawDensity??.6));f++){")
marker="\n }\n const allEnd=performance.now();"
assert marker in s
shell=r'''
  const H=rng(derive(fs,'grain-hulls'));
  function finishPart(start,indexStart){
   for(let j=start*3;j<P.length;j++)normals[j]=0;
   for(let i=indexStart;i<I.length;i+=3){const a=I[i]*3,b=I[i+1]*3,d=I[i+2]*3,n=cross([P[b]-P[a],P[b+1]-P[a+1],P[b+2]-P[a+2]],[P[d]-P[a],P[d+1]-P[a+1],P[d+2]-P[a+2]]);for(const v of[a,b,d])for(let k=0;k<3;k++)normals[v+k]+=n[k];}
   for(let j=start;j<P.length/3;j++){const n=norm(normals.slice(j*3,j*3+3));for(let k=0;k<3;k++)normals[j*3+k]=n[k];}
  }
  // Individual open valve: inner bowl, outer wall, connected lip. No rice kernel.
  for(let f=0;f<Math.round(180*(c.huskDensity??.38));f++){
   const axis=[2,2,1,0][Math.floor(f/2)%4],sign=f%2?1:-1,N=[0,0,0];N[axis]=sign;
   const oth=[0,1,2].filter(a=>a!==axis),p=[0,0,0];p[axis]=sign*h[axis];for(const a of oth)p[a]=(H()*1.68-.84)*h[a];
   const hit=surface(p,N);if(!hit)continue;
   const angle=H()*6.283185,U=[0,0,0];U[oth[0]]=Math.cos(angle);U[oth[1]]=Math.sin(angle);const V=norm(cross(N,U));
   const halfLength=.021+H()*.015,halfWidth=halfLength*(.27+H()*.14),depth=.004+H()*.003,wall=.0015+H()*.0008;
   const tilt=(H()-.5)*.18,raise=.002+H()*.0015;
   const start=P.length/3,idxStart=I.length,S=16,RINGS=3;
   const point=(r,ang,outer)=>{const x=halfLength*r*Math.cos(ang),y=halfWidth*r*Math.sin(ang)*(.72+.28*Math.abs(Math.sin(ang)));const z=raise-depth*(1-r*r)-wall*outer+tilt*x;return hit.map((v,k)=>v+U[k]*x+V[k]*y+N[k]*z);};
   const anchor=point(0,0,1);if(sample(...anchor)>=-wall*.40)continue;
   const emit=(r,a,o)=>{P.push(...point(r,a,o));K.push(5);C.push((Math.cos(a)*r+1)*.5,o,r,clamp(-sample(...point(r,a,o))/Math.max(wall,dx*.1)));normals.push(0,0,0);};
   for(let outer=0;outer<2;outer++){
    const off=P.length/3;emit(0,0,outer);
    for(let ring=1;ring<=RINGS;ring++)for(let a=0;a<S;a++)emit(ring/RINGS,a/S*6.283185,outer);
    function tri(a,b,c){if(outer)I.push(a,c,b);else I.push(a,b,c);}
    for(let a=0;a<S;a++)tri(off,off+1+a,off+1+(a+1)%S);
    for(let ring=1;ring<RINGS;ring++)for(let a=0;a<S;a++){const x=off+1+(ring-1)*S+a,y=off+1+(ring-1)*S+(a+1)%S;tri(x,x+S,y);tri(y,x+S,y+S);}
   }
   const side=1+S*RINGS,lip0=start+1+(RINGS-1)*S,lip1=lip0+side;
   for(let a=0;a<S;a++){const j=(a+1)%S;I.push(lip0+a,lip1+a,lip0+j,lip0+j,lip1+a,lip1+j);}
   finishPart(start,idxStart);
   const rim=[];for(let a=0;a<S;a++)rim.push(P.slice((lip0+a)*3,(lip0+a)*3+3));
   huskAudit.push({id:'husk-'+f,face:['x','y','z'][axis]+(sign>0?'+':'-'),length:2*halfLength,width:2*halfWidth,wall,anchor,anchorField:sample(...anchor),lip:rim,vertexStart:start,vertexCount:P.length/3-start,innerOuterAndRim:true});
  }
'''
s=s.replace(marker,shell+marker)
sub("riceHusks:0,fiberAudit", "riceHusks:huskAudit.length,huskAudit,mechanicalProfile:hard?'hard-fracture':isStone?'bedded-or-clastic':isPebble?'worn':'moulded',strata:bedded?strata:null,fiberAudit")
sub("dims=h.map(a=>Math.ceil(2*(a+.14)/dx)+1)","padding=isStone?.28:.18,dims=h.map(a=>Math.ceil(2*(a+padding)/dx)+1)")
sub("spacing:dx,baseFieldEvaluations", "spacing:dx,gridPadding:padding,baseFieldEvaluations")
p.write_text(s)
