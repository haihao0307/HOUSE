/* Small, reversible material-coordinate experiment on the frozen V0.15.0.
   No source geometry, construction records, placements, lighting or motion changes.
   Wood-board axes are procedural candidates, not measurements from the original SKP. */
const mb151 = (() => {
  const woodMaterials = [mats.wood, mats.woodLight, mats.woodDark, mats.temp];
  const originals = woodMaterials.map(m => ({m, compile:m.onBeforeCompile, key:m.customProgramCacheKey}));
  const uniforms = {mode:{value:1}};
  const records = [], modes = Object.freeze({baseline:0, grain:1, response:2, endgrain:3});
  let mode = 'grain';
  const hash = s => {let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
  function chooseAxis(size, generatedAlongY=false) {
    if(!Array.isArray(size)||size.length!==3||size.some(v=>!Number.isFinite(v)||v<=0))throw Error('Invalid local dimensions');
    if(generatedAlongY) return {axis:1, policy:'generator_y_axis', ambiguous:false};
    const order=[0,1,2].sort((a,b)=>size[b]-size[a]);
    const ambiguous=size[order[0]]<size[order[1]]*1.25;
    return {axis:ambiguous?1:order[0], policy:ambiguous?'unresolved_keep_baseline':'long_box_axis_candidate', ambiguous};
  }
  scene.traverse(o => {
    if(!o.isMesh || !woodMaterials.includes(o.userData.originalMaterial || o.material)) return;
    const originalGeometry=o.geometry;
    if(!originalGeometry.boundingBox) originalGeometry.computeBoundingBox();
    const dimensions=originalGeometry.boundingBox.getSize(new THREE.Vector3()).toArray();
    const generatedAlongY=!!(o.userData.a && o.userData.b) || originalGeometry.type==='CylinderGeometry';
    const decision=chooseAxis(dimensions,generatedAlongY);
    const id=o.userData.record?.id || null;
    const seed=id ? hash(id)/4294967296*23 : 0;
    // Clone before adding attributes: shared primitive data remains untouched.
    o.geometry=originalGeometry.clone();
    const count=o.geometry.attributes.position.count;
    o.geometry.setAttribute('mbAxis151',new THREE.Float32BufferAttribute(new Float32Array(count).fill(decision.axis),1));
    o.geometry.setAttribute('mbSeed151',new THREE.Float32BufferAttribute(new Float32Array(count).fill(seed),1));
    records.push({object:o,id,dimensions,seed,...decision,registered:!!id});
  });
  const vertexHead='attribute float mbAxis151; attribute float mbSeed151; varying float vMBAxis151; varying float vMBSeed151;\n';
  const fragmentHead='varying float vMBAxis151; varying float vMBSeed151; uniform float mbMode151;\n';
  const remap = `
    vec3 mbQ151=vpLocal, mbN151=vnLocal;
    if(mbMode151>.5) {
      if(vMBAxis151<.5){mbQ151=vpLocal.yxz;mbN151=vnLocal.yxz;}
      else if(vMBAxis151>1.5){mbQ151=vpLocal.xzy;mbN151=vnLocal.xzy;}
    }
  `;
  for(const {m,compile,key} of originals) {
    m.onBeforeCompile=sh=>{
      // Keep the exact original material in baseline mode. Geometry attributes
      // select the local timber axis; the rest of the legacy noise is unchanged.
      compile(sh);
      sh.uniforms.mbMode151=uniforms.mode;
      sh.vertexShader=vertexHead+sh.vertexShader;
      const begin='#include <begin_vertex>';
      if(!sh.vertexShader.includes(begin))throw Error('Missing vertex hook');
      sh.vertexShader=sh.vertexShader.replace(begin,begin+'\nvMBAxis151=mbAxis151;vMBSeed151=mbSeed151;');
      sh.fragmentShader=fragmentHead+sh.fragmentShader;
      const old='vec3 q=vpLocal;';
      if(!sh.fragmentShader.includes(old))throw Error('Missing frozen wood hook');
      sh.fragmentShader=sh.fragmentShader.replace(old,remap+'\nvec3 q=mbQ151;');
      sh.fragmentShader=sh.fragmentShader.replace('abs(vnLocal.y)','abs(mbN151.y)');
      // The optional response mode adds only a bounded, independent roughness field.
      // It is a visual experiment, with no claim of measured material calibration.
      const rough='#include <roughnessmap_fragment>';
      if(!sh.fragmentShader.includes(rough))throw Error('Missing roughness hook');
      sh.fragmentShader=sh.fragmentShader.replace(rough,rough+`
        if(mbMode151>1.5 && mbMode151<2.5){
          float mbR151=n3(vec3(mbQ151.x*170.,mbQ151.y*.7,mbQ151.z*170.)+vMBSeed151);
          roughnessFactor=clamp(roughnessFactor+(mbR151-.5)*.08,.65,.88);
        }
      `);
      // The original wood signal is deliberately retained even in the debug mode;
      // the final unlit-like diagnostic is written after all lighting operations.
      const output='#include <opaque_fragment>';
      if(!sh.fragmentShader.includes(output))throw Error('Missing output hook');
      sh.fragmentShader=sh.fragmentShader.replace(output,output+`
        if(mbMode151>2.5)gl_FragColor.rgb=mix(vec3(.09,.42,.50),vec3(.90,.30,.09),smoothstep(.65,.95,abs(mbN151.y)));
      `);
    };
    m.customProgramCacheKey=()=>key()+'_MB151';m.needsUpdate=true;
  }
  function setMode(value) {
    if(!Object.prototype.hasOwnProperty.call(modes,value))throw Error('Unknown material mode: '+value);
    mode=value;uniforms.mode.value=modes[value];needsRender=true;
    const select=document.getElementById('mb151-mode');if(select)select.value=value;
    return getProbe();
  }
  function inspectMaterial(id) {
    const r=records.find(r=>r.id===id);if(!r)return null;
    scene.updateMatrixWorld(true);
    const axis=new THREE.Vector3().setComponent(r.axis,1).transformDirection(r.object.matrixWorld);
    const worldSize=new THREE.Box3().setFromObject(r.object).getSize(new THREE.Vector3()).toArray();
    return {id:r.id,axis:['x','y','z'][r.axis],policy:r.policy,ambiguous:r.ambiguous,
      localDimensions:r.dimensions,worldAxis:axis.toArray(),worldAABBDimensions:worldSize,
      matrixWorld:r.object.matrixWorld.toArray(),seed:r.seed,
      coordinateUnit:'metres_in_current_generator',measurementStatus:'candidate_not_verified_against_SKP',
      sourceGeometryChanged:false};
  }
  function getProbe() {
    const registered=records.filter(r=>r.registered);
    return {version:'0.15.1',mode,materialCount:woodMaterials.length,meshCount:records.length,
      registeredCount:registered.length,changedAxisCount:registered.filter(r=>r.axis!==1).length,
      unresolved:registered.filter(r=>r.ambiguous).map(r=>r.id),
      roughnessDeltaBound:.04,roughnessEnabled:mode==='response',reliefEnabled:false,
      geometryModified:false,measurementTruthApproved:false,visualApproved:false,productionApproved:false,
      candidates:registered.filter(r=>r.axis!==1).map(r=>({id:r.id,axis:['x','y','z'][r.axis],policy:r.policy}))};
  }
  function exportReport() {
    const payload={...getProbe(),records:records.filter(r=>r.id).map(r=>inspectMaterial(r.id))};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='Xiaoli_V0.15.1_Material_Coordinates.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);return payload;
  }
  const panel=document.createElement('details');panel.id='mb151-panel';panel.open=false;
  panel.innerHTML='<summary>小妈方法试验 · V0.15.1</summary><label for="mb151-mode">同相机材质对照</label><select id="mb151-mode"><option value="baseline">A · 原版材质</option><option value="grain" selected>B · 顺构件木纹</option><option value="response">C · 独立粗糙度试验</option><option value="endgrain">端面检查 · 橙色为端面</option></select><button id="mb151-export" type="button">导出材质轴与尺寸候选</button><small>几何、施工与通行保持 V0.15.0。正方形木板方向待核；SU 尺度尚未核准。</small>';
  const host=document.querySelector('.righttools')||viewport;host.prepend(panel);
  panel.querySelector('select').onchange=e=>setMode(e.target.value);
  panel.querySelector('button').onclick=exportReport;
  return {setMode,getProbe,inspect:inspectMaterial,exportReport,chooseAxis};
})();
