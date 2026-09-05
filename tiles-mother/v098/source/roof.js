let lastRoof=null;
const placementCache=new Map();
function packFit(f){if(!f)return null;return {matrix:f.proxy.matrix.elements.slice(),tilt:f.tilt,roll:f.roll,leftGap:f.leftGap,rightGap:f.rightGap,overlapGap:f.overlapGap,contacts:f.contacts,unsupported:f.unsupported,iterations:f.iterations};}
function unpackFit(f,g){if(!f)return null;const proxy=makeProxy(g,new THREE.Matrix4().fromArray(f.matrix));return {...f,proxy};}
let woodMaterials=null,woodUVMats=null;
function getWoodMaterials(check=false){
  if(check&&woodUVMats)return woodUVMats;if(!check&&woodMaterials)return woodMaterials;
  function texture(end=false,uvMode=false){const c=document.createElement('canvas');c.width=512;c.height=end?512:1024;const ctx=c.getContext('2d');
    if(uvMode){ctx.fillStyle='#ecede3';ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle='#426370';ctx.lineWidth=3;for(let x=0;x<=512;x+=64){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,c.height);ctx.stroke();}for(let y=0;y<=c.height;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();}ctx.fillStyle='#c24931';ctx.font='bold 36px sans-serif';ctx.fillText(end?'END / 横断面':'SIDE / 木纹纵向',30,55);ctx.fillText('U →',300,c.height-35);ctx.fillStyle='#32678b';ctx.fillText('V ↑',25,160);ctx.lineWidth=12;ctx.strokeStyle='#32678b';ctx.beginPath();ctx.moveTo(65,c.height-100);ctx.lineTo(65,220);ctx.lineTo(40,255);ctx.moveTo(65,220);ctx.lineTo(90,255);ctx.stroke();}
    else{const image=ctx.createImageData(c.width,c.height);for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){let f;
      if(end){const r=Math.hypot(x-252,y-258),a=Math.atan2(y-258,x-252);f=.83+.033*Math.sin(r*.19+fbm(x*.018,y*.018,313,3)*3)+.012*Math.cos(a*44);}
      else{const u=x/512,v=y/1024,wave=Math.sin(v*7+Math.sin(v*19)*.13)*.9,fiber=Math.sin(x*.24+wave*.3+noise2(x*.008,y*.002,73)*15);f=.83+.03*fiber+.08*(fbm(x*.035,y*.0015,713,3)-.5);if(Math.pow(Math.max(0,Math.sin(x*.042+wave*.3)),28)>.88)f-=.033;}
      const k=(y*c.width+x)*4;image.data[k]=Math.round(clamp(f)*255);image.data[k+1]=Math.round(clamp(f)*255);image.data[k+2]=Math.round(clamp(f)*255);image.data[k+3]=255;}ctx.putImageData(image,0,0);}
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
  }
  const arr=[false,true].map(end=>check?new THREE.MeshBasicMaterial({map:texture(end,true),side:THREE.FrontSide,toneMapped:false}):new THREE.MeshStandardMaterial({map:texture(end),vertexColors:true,roughness:.93,metalness:0,side:THREE.FrontSide,envMapIntensity:.40}));arr.forEach(m=>PERSISTENT_MATERIALS.add(m));if(check)woodUVMats=arr;else woodMaterials=arr;return arr;
}
function timberNodes(roof,rows,cols,stepX,stepZ,model){
  const length=(rows-1)*stepZ+PROFILE.pan.length+.10,mid=(rows-1)*stepZ*.5,beamZ=Array.from({length:4},(_,i)=>lerp(-.042,(rows-1)*stepZ+.042,i/3));
  const crossLength=cols*stepX+.20,beams=[],rafters=[],mat=getWoodMaterials(state.mode==='uv');let brokenRafters=0,brokenBeams=0;
  const gapForPeak=(fn,n,threshold,padding=.01)=>{let best=0,at=.5;for(let i=2;i<n-2;i++){const t=i/(n-1),v=fn(t);if(v>best){best=v;at=t;}}return best>threshold?[[clamp(at-padding,.03,.90),clamp(at+padding,.10,.97)]]:[];};
  for(let b=0;b<4;b++){
    const lossFn=t=>interpArray(model.beamLoss,b*cols,clamp((t*crossLength-.10)/(cols*stepX)),cols);
    const broken=state.care==='abandoned'?gapForPeak(lossFn,Math.max(8,cols*2),.20,.025):[];if(broken.length)brokenBeams++;
    const sample=t=>({loss:lossFn(t),stain:clamp(lossFn(t)*2),y:-(lossFn(t)**2)*.012*Math.sin(Math.PI*t)});
    const g=woodGeometry(crossLength,Math.max(20,cols*3),state.seed+b*433,TIMBER.beamRadius,sample,broken);const m=new THREE.Mesh(g,mat);m.rotation.y=Math.PI/2;m.position.set(0,-TIMBER.rafterRadius-TIMBER.beamRadius,beamZ[b]);m.castShadow=m.receiveShadow=cols<=4;m.userData.kind='crossbeam';m.updateMatrix();roof.add(m);beams.push({proxy:makeProxy(g,m.matrix),mesh:m,lossFn,broken});
  }
  for(let c=0;c<=cols;c++){
    const at=t=>clamp(((t-.5)*length+mid)/Math.max(.01,(rows-1)*stepZ));
    const lossFn=t=>interpArray(model.loss,c*rows,at(t),rows),stainFn=t=>interpArray(model.stain,c*rows,at(t),rows);
    const broken=[];
    if(state.care==='abandoned')for(let b=0;b<3;b++){
      const z=lerp(beamZ[b],beamZ[b+1],.52),t=(z-mid)/length+.5,l=lossFn(t);
      if(l>.48){const w=(.024+l*.055)/length;broken.push([t-w,t+w]);}
    }
    if(broken.length)brokenRafters++;
    const x=(c-cols/2)*stepX;
    // Surviving support anchors define the centreline. A missing beam station
    // does not teleport a rafter downward through the remaining beam ends.
    const anchors=beamZ.map((z,k)=>({z,h:beams[k].proxy.height(x,z)})).filter(a=>Number.isFinite(a.h));
    const sample=t=>{
      const z=(t-.5)*length+mid,loss=lossFn(t),r=TIMBER.rafterRadius*(1-loss);
      let ai=0;while(ai<anchors.length-2&&z>anchors[ai+1].z)ai++;
      const A=anchors[ai]??{z:beamZ[0],h:-TIMBER.rafterRadius},B=anchors[Math.min(ai+1,anchors.length-1)]??{z:beamZ[3],h:-TIMBER.rafterRadius};
      const q=clamp((z-A.z)/Math.max(.001,B.z-A.z)),base=lerp(A.h,B.h,q)+r;
      const relativeEI=Math.max(.035,Math.exp(-interpArray(model.dose,c*rows,at(t),rows)*.022)*Math.pow(1-loss,4));
      const sag=Math.min(.065,(1/relativeEI-1)*.0018)*Math.sin(Math.PI*q)**2;
      return {loss,stain:stainFn(t),y:base-sag};
    };
    const g=woodGeometry(length,Math.max(32,rows*5),state.seed+c*97,TIMBER.rafterRadius,sample,broken);const m=new THREE.Mesh(g,mat);m.position.set(x,0,mid);m.castShadow=m.receiveShadow=cols<=4;m.userData.kind='round-rafter';m.updateMatrix();
    // Exact mesh clearance, including the finite width of a round beam.
    // Lift the local support zone only; intermediate span sag is retained.
    let proxy=makeProxy(g,m.matrix),corrections=[];
    for(let k=0;k<beams.length;k++){
      const zc=beamZ[k]-mid,flat=TIMBER.beamRadius+length/Math.max(32,rows*5)*1.6,fade=Math.min(.18,(beamZ[1]-beamZ[0])*.46);
      const weight=z=>Math.abs(z-zc)<=flat?1:Math.max(0,1-(Math.abs(z-zc)-flat)/Math.max(.015,fade-flat));
      for(let iteration=0;iteration<4;iteration++){
        const check=exactGap(proxy,beams[k].proxy);if(!Number.isFinite(check.gap)||check.gap>=CONTACT_EPS-1e-7)break;
        const dy=CONTACT_EPS-check.gap+1e-7,pa=g.attributes.position;
        for(let j=0;j<pa.count;j++)pa.setY(j,pa.getY(j)+dy*weight(pa.getZ(j)));
        for(const node of g.userData.centreLine)node[1]+=dy*weight(node[0]);
        corrections.push({beam:k,liftMm:dy*1000});g.attributes.position.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();proxy=makeProxy(g,m.matrix);
      }
    }
    roof.add(m);rafters.push({mesh:m,proxy,broken,corrections,supportAnchors:anchors});
  }
  return {beams,rafters,beamZ,brokenRafters,brokenBeams};
}
function summarizeContact(fits){const cases=fits.filter(f=>f&&!f.unsupported),gaps=cases.flatMap(f=>[f.leftGap,f.rightGap]),overlaps=cases.map(f=>f.overlapGap).filter(Number.isFinite);return {tested:cases.length,maxSeatGapMm:gaps.length?Math.max(...gaps)*1000:0,minSeatGapMm:gaps.length?Math.min(...gaps)*1000:0,minOverlapGapMm:overlaps.length?Math.min(...overlaps)*1000:null,unresolved:fits.filter(f=>f?.unsupported).length,clearanceToleranceMm:CONTACT_EPS*1000};}
function buildRoofLike(kind){
  clearStage();const is48=kind==='forty8',cols=is48?4:22,rows=is48?6:20,coverRows=is48?8:20,seams=cols-1,stepX=.264,stepZ=.198;
  const roof=new THREE.Group();roof.rotation.x=-.43;roof.position.set(0,.36,is48?-.48:-1.82);stageRoot.add(roof);
  const layoutKey=[kind,state.year,state.seed,state.care].join('/'),cached=placementCache.get(layoutKey);
  const model=cached?.model??integrateTimber(rows,cols),panStates=model.panStates,timber=timberNodes(roof,rows,cols,stepX,stepZ,model);
  const geos={},lod=is48?{nu:16,nv:22}:{nu:10,nv:14};for(const family of ['pan','cover'])for(let d=0;d<3;d++){geos[`${family}/${d}`]=makeTileGeometry(family,{seed:state.seed+(family==='cover'?2000:0)+d*31,damageClass:d,nu:lod.nu,nv:lod.nv});}
  const buckets=new Map(),fits=[],panFits=[],coverFits=[],contacts=[],crackPoints=[];let panVisible=0,coverVisible=0,missing=0,damaged=0,replaced=0,unsupported=0;const populations=Object.fromEntries(POPULATION.map(x=>[x.name,0]));
  function addTile(family,r,c,st,fit,id){const variant=Math.floor(hash01(r,c,state.seed,family==='pan'?83:123)*3),ageTier=st.age<15?5:st.age<50?30:75,d=st.damageClass,key=`${family}/${variant}/${d}/${ageTier}`;let b=buckets.get(key);
    if(!b){const mat=state.mode==='uv'?UV_MATERIALS[family]:clayMaterial(family,variant,ageTier,state.light==='rain'?1:0),m=new THREE.InstancedMesh(geos[`${family}/${d}`],mat,is48?48:860);m.castShadow=m.receiveShadow=is48;m.userData.kind='tile-batch';roof.add(m);b={m,n:0};buckets.set(key,b);}
    if(st.damageClass)crackPoints.push(...crackSegments(geos[`${family}/${d}`],state.seed+id*127,st.damageClass,fit.proxy.matrix));
    b.m.setMatrixAt(b.n,fit.proxy.matrix);if(state.mode!=='uv')b.m.setColorAt(b.n,tileTint(id,st.age,st.generation));b.n++;
    if(st.damageClass)damaged++;if(st.generation)replaced++;fits.push(fit);fit.family=family;fit.id=id;for(const p of fit.contacts)if(p)contacts.push({p,family});
  }
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const i=r*cols+c,st=panStates[i];populations[populationFor(i,st.generation).name]++;if(st.missing){missing++;panFits[i]=null;continue;}
    const previous=[...(r&&panFits[(r-1)*cols+c]?[panFits[(r-1)*cols+c].proxy]:[]),...timber.beams.map(b=>b.proxy)];
    const s=cached?unpackFit(cached.pan[i],geos[`pan/${st.damageClass}`]):settleTile(geos[`pan/${st.damageClass}`],(c-(cols-1)/2)*stepX,r*stepZ,[timber.rafters[c].proxy],[timber.rafters[c+1].proxy],previous,stepX);
    if(!s||s.unsupported){unsupported++;missing++;panFits[i]=null;continue;}panFits[i]=s;addTile('pan',r,c,st,s,i);panVisible++;
  }
  const coverStep=((rows-1)*stepZ+PROFILE.pan.length-PROFILE.cover.length)/(coverRows-1);
  for(let r=0;r<coverRows;r++)for(let c=0;c<seams;c++){
    const i=r*seams+c,id=440+i,z=(PROFILE.cover.length-PROFILE.pan.length)/2+r*coverStep,st=lifecycle(r,c,'cover',coverRows,seams);populations[populationFor(id,st.generation).name]++;
    if(st.missing){missing++;coverFits[i]=null;continue;}
    const left=[],right=[];for(let pr=0;pr<rows;pr++)if(Math.abs(pr*stepZ-z)<.25){const a=panFits[pr*cols+c],b=panFits[pr*cols+c+1];if(a)left.push(a.proxy);if(b)right.push(b.proxy);}
    const previous=[...(r&&coverFits[(r-1)*seams+c]?[coverFits[(r-1)*seams+c].proxy]:[]),...timber.beams.map(b=>b.proxy)];
    const s=cached?unpackFit(cached.cover[i],geos[`cover/${st.damageClass}`]):settleTile(geos[`cover/${st.damageClass}`],(c+1-cols/2)*stepX,z,left,right,previous,.085);
    if(!s||s.unsupported){unsupported++;missing++;coverFits[i]=null;continue;}coverFits[i]=s;addTile('cover',r,c,st,s,id);coverVisible++;
  }
  for(const b of buckets.values()){b.m.count=b.n;b.m.instanceMatrix.needsUpdate=true;if(b.m.instanceColor)b.m.instanceColor.needsUpdate=true;b.m.computeBoundingSphere();}
  const crackMesh=crackLines(crackPoints);if(crackMesh)roof.add(crackMesh);
  const markerGeo=new THREE.SphereGeometry(.0038,7,5),markerMat=new THREE.MeshBasicMaterial({color:0x39a57f,depthTest:false}),markers=new THREE.InstancedMesh(markerGeo,markerMat,Math.max(1,contacts.length));markers.renderOrder=5;markers.count=contacts.length;
  contacts.forEach((d,i)=>{markers.setMatrixAt(i,new THREE.Matrix4().makeTranslation(...d.p));markers.setColorAt(i,new THREE.Color(d.family==='cover'?0xd19a37:0x24ab88));});markers.visible=state.showContacts;markers.userData.kind='contact-markers';roof.add(markers);
  const contactReport=summarizeContact(fits),designTotal=is48?48:860;
  const woodContacts=[];for(let c=0;c<timber.rafters.length;c++)for(let b=0;b<timber.beams.length;b++){const gap=exactGap(timber.rafters[c].proxy,timber.beams[b].proxy).gap;if(Number.isFinite(gap))woodContacts.push({rafter:c,beam:b,gapMm:gap*1000});}
  contactReport.timber={tested:woodContacts.length,minGapMm:Math.min(...woodContacts.map(c=>c.gapMm)),penetrations:woodContacts.filter(c=>c.gapMm<-.05),absentStations:timber.rafters.reduce((n,r)=>n+4-r.supportAnchors.length,0)};
  const actualGeometry=[...Object.values(geos).map(g=>({kind:g.userData.kind,qa:uvGate(g)})),...timber.rafters.concat(timber.beams).map(m=>({kind:'timber',qa:woodUVGate(m.mesh.geometry)}))];
  contactReport.actualGeometry={tested:actualGeometry.length,failures:actualGeometry.filter(x=>!x.qa.allPassed),allPassed:actualGeometry.every(x=>x.qa.allPassed)};
  if(!cached){placementCache.set(layoutKey,{model,pan:panFits.map(packFit),cover:coverFits.map(packFit)});if(placementCache.size>8)placementCache.delete(placementCache.keys().next().value);}
  lastRoof={kind,roof,rows,cols,coverRows,stepX,stepZ,panFits,coverFits,timber,contactReport,model,populations,counts:{design:designTotal,panVisible,coverVisible,missing,damaged,replaced,unsupported},markers};
  $('#sceneStats').innerHTML=`<b>${is48?'48片瓦构造检查':'860片屋面检查'}</b><span>${is48?'24片板瓦（4垄×6行）＋24片筒瓦（3缝×8行）':'440片板瓦＋420片筒瓦'}。筒瓦按自身搭接长度铺设。</span><span>${cols+1}根共享圆椽，直径8 cm；下方4根横梁，直径13.8 cm。尺寸为当前可调展示值。</span><span>${state.year}年 · ${state.care==='maintained'?'持续维护':'停止维护'}：在役 ${panVisible+coverVisible} / ${designTotal}，缺失或失去支承 ${missing}，可见破损 ${damaged}</span><span>双侧接触检查 ${contactReport.tested}片；最大落座间隙 ${contactReport.maxSeatGapMm.toFixed(2)} mm；搭接最小间隙 ${contactReport.minOverlapGapMm?.toFixed(2)??'无'} mm</span><span>断段圆椽 ${timber.brokenRafters}根；断段横梁 ${timber.brokenBeams}根。木板、望板、隐藏平面：0</span><span>整片色群：${Object.entries(populations).map(([k,v])=>k+' '+v).join('，')}</span>`;
  $('#contactGate').textContent=contactReport.unresolved===0&&contactReport.maxSeatGapMm<.5&&contactReport.timber.penetrations.length===0&&contactReport.actualGeometry.allPassed?'本场景检查通过':'本场景需复核';$('#contactGate').className=contactReport.maxSeatGapMm<.5&&contactReport.timber.penetrations.length===0&&contactReport.actualGeometry.allPassed?'pill ok':'pill bad';
  fitCamera(is48?'forty8':'roof',state.cameraSide);applyTimberOnly();
}
function applyTimberOnly(){stageRoot.traverse(o=>{if(o.userData.kind==='tile-batch')o.visible=!state.timberOnly;if(o.userData.kind==='contact-markers')o.visible=!!state.showContacts;});needsRender=true;}
