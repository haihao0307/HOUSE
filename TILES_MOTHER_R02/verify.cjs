const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const mother=require('./mother.cjs'),library=require('./library.json'),rows=[];
const html=fs.readFileSync('G:/HOUSE/brick-tiles-mother-09h-20261026/START_HERE.html','utf8'),s=html.match(/<script>([\s\S]*?)<\/script>/)[1];
let c=s.slice(s.indexOf('function ceramic('),s.indexOf('// Wood reference cylinder'));c=c.slice(0,c.indexOf(' for(let q of [0,1])'))+' return point;\n}';c=c.replace('function ceramic(','function originalPointFactory(');
const Q=new Function('const settings={micStrength:1,micScale:1};'+s.slice(0,s.indexOf('const $=s=>'))+'\n'+c+'\nreturn{settings,STUDY,shellMesh,originalPointFactory,allSurfaceOffset,tileHand,tileN};')();
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
for(let set of ['D7','L9'])for(let kind of ['pan','cover'])for(let strength of [0,1,2]){
 Q.STUDY.id=kind;Q.STUDY.set=set;Q.settings.micStrength=strength;Q.settings.micScale=1;
 Q.shellMesh(kind,set);const old=Q.originalPointFactory(kind,23,0,80),e=mother.instantiate(library,kind+'-'+set,{wave:{strength}});let error=0,correctedError=0;
 for(let i=0;i<300;i++){let u=i%6===0?-1:i%6===1?1:2*((i*.61803398875)%1)-1,t=i%6===2?0:i%6===3?1:(i*.41421356237)%1,q=i%6===4?0:i%6===5?1:(i*.73205080756)%1,p=old(u,t,q),m=[1,kind==='pan'?1:2,q,u],w=Q.allSurfaceOffset(p,m,kind),h=Q.tileHand(p,m,31),expect=p.map((x,k)=>x+w[k]+h[k]*.55),actual=e.position(u,t,q);error=Math.max(error,distance(expect,actual));let vt=Math.max(0,Math.min(1,p[2]/e.definition().sheet.length+.5)),n=Q.tileN(kind,u,vt,23);expect[2]+=n[2]*w[1]/n[1];correctedError=Math.max(correctedError,distance(expect,actual));}
 rows.push({kind,set,strength,samples:300,maxError_m:error,maxErrorAfterRestoringMissingNormalZ_m:correctedError});console.log(rows.at(-1));
}
let stable=0,finite=0,flatError=0,identityError=0;
for(let name of Object.keys(library.instances)){
 let full=mother.instantiate(library,name);
 for(let amount of [0,1e-10,.01,.25,.5,.75,1]){let e=mother.instantiate(library,name,{press:{amount}});for(let i=0;i<60;i++){let u=2*((i*.61803398875)%1)-1,t=(i*.41421356237)%1,q=i%3/2,a=e.evaluate(u,t,q,.0001),b=full.evaluate(u,t,q,.0001);assert.deepEqual(a.materialPoint,b.materialPoint);assert.deepEqual(a.color,b.color);assert.equal(a.roughness,b.roughness);assert.ok(a.position.every(Number.isFinite));assert.ok(a.color.every(x=>x>=0&&x<=1));assert.ok(a.roughness>=0&&a.roughness<=1);stable++;finite++;}}
}
const flat=mother.instantiate(library,'flat',{press:{formGain:0,handGain:0,edgeGain:0},wave:{strength:0}});
for(let i=0;i<=40;i++)for(let j=0;j<=40;j++){let u=2*i/40-1,t=j/40;flatError=Math.max(flatError,distance(flat.position(u,t,0),[u*.105,0,(t-.5)*.24]));}
let changed={};const base=mother.instantiate(library,'pan-L9'),before=base.evaluate(.23,.41,0);
for(let [k,changes] of Object.entries({shape:{press:{amount:.4}},color:{material:{brightness:.6}},roughness:{material:{roughness:4}},wave:{wave:{strength:2}},seed:{wave:{seed:47}}})){let result=mother.instantiate(library,'pan-L9',changes).evaluate(.23,.41,0);changed[k]=JSON.stringify(result)!==JSON.stringify(before);assert.ok(changed[k]);}
let def=base.definition();def.sheet.length=99;assert.deepEqual(base.evaluate(.23,.41,0),before);
let flatVariants=0,minimumThickness=Infinity,layerSamples=0;
for(let name of Object.keys(library.instances)){
 const e=mother.instantiate(library,name,{press:{amount:0,edgeGain:0},wave:{strength:0}});
 for(let i=0;i<50;i++){const u=2*((i*.61803398875)%1)-1,t=(i*.41421356237)%1,q=(i*.73205080756)%1;assert.ok(distance(e.position(u,t,q),e.sheetPoint(u,t,q))<1e-12);flatVariants++;}
 for(let amount of [0,.5,1]){let a=mother.instantiate(library,name,{press:{amount}});for(let i=0;i<50;i++){let u=-.95+1.9*((i*.61803398875)%1),t=.025+.95*((i*.41421356237)%1),top=a.position(u,t,0),bottom=a.position(u,t,1);let separation=distance(top,bottom);assert.ok(separation>.002);minimumThickness=Math.min(minimumThickness,separation);layerSamples++;}}
}
const trim=mother.instantiate(library,'flat',{holes:[[[-.2,.4],[.2,.4],[.2,.6],[-.2,.6]]]});assert.equal(trim.contains(0,.5),false);assert.throws(()=>trim.position(0,.5));assert.ok(trim.contains(.5,.5));
const relief=mother.instantiate(library,'flat',{emboss:[{points:[[-.5,.5],[.5,.5]],radius:.1,height:.001}]});assert.equal(relief.evaluate(0,.5,0).embossHeight,.001);assert.equal(relief.evaluate(0,.8,0).embossHeight,0);
const long=mother.instantiate(library,'pan-L9',{sheet:{length:1.2}});assert.ok(long.evaluate(0,1/6,0).color.every(Number.isFinite));
const shared=fs.readFileSync(__dirname+'/mother.cjs'),data=fs.readFileSync(__dirname+'/library.json');
let report={version:mother.version,baseline:'bbf1f063c1a256cc1d41f107dcd054e944dcc48d',geometry:rows,pressSamples:finite,materialAddressAndPropertiesStable:stable,flatSamples:1681,flatMaxError_m:flatError,allRecipesReturnToSameSheet:flatVariants,layerSamples,minimumTopBottomDistance_m:minimumThickness,trimAndReliefChecks:true,controls:changed,noDisplayDependencies:!/(Float32Array|Uint32Array|\bMesh\b|document\.|window\.)/.test(shared),noNamedShapeBranches:!/'pan'|'cover'|pan-L9|cover-D7/.test(shared),sharedBytes:shared.length,libraryBytes:data.length,sharedSha256:crypto.createHash('sha256').update(shared).digest('hex'),librarySha256:crypto.createHash('sha256').update(data).digest('hex'),pass:rows.every(r=>r.maxErrorAfterRestoringMissingNormalZ_m<1e-8)&&flatError<1e-12};
fs.writeFileSync(__dirname+'/VALIDATION.json',JSON.stringify(report,null,2));console.log('PASS',report.pass,'shared bytes',shared.length,'library bytes',data.length);assert.ok(report.pass);
