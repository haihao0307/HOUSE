import * as THREE from 'three';

/**
 * Reusable material rules extracted from the user-confirmed 团结乡 sample.
 *
 * This module deliberately contains no site-specific texture files.  It produces
 * editable MeshStandardMaterials with stable macro/meso variation so the same
 * weathered wall, aged timber and ceramic tile language can be used by the
 * 滇中一颗印 generator and later Yunnan courtyard families.
 *
 * Exact tile dimensions, soil recipe, wood species and repair chronology remain
 * data-gated in data/production/yunnan_threejs_production_system_v5_4_0.json.
 */

export const YUNNAN_MATERIAL_PROFILES = Object.freeze({
  weatheredEarthWall: {
    id: 'TJ001-MAT-EARTH-WALL-WEATHERED',
    color: '#9f7052',
    roughness: 0.93,
    metalness: 0,
    weathering: 0.86,
    heightMeters: 4.8,
    exposure: 0.62,
    note: 'warm reddish earth-ochre body; coarse loss, pale patches and dark flow marks'
  },
  agedTimber: {
    id: 'TJ001-MAT-AGED-EXTERIOR-TIMBER',
    color: '#6f5140',
    roughness: 0.86,
    metalness: 0,
    weathering: 0.62,
    heightMeters: 4,
    exposure: 0.58,
    note: 'low-saturation grey-brown to dark brown; matte sheltered variation'
  },
  weatheredOpeningTimber: {
    id: 'YKY-MAT-OPENING-TIMBER-WEATHERED',
    color: '#604637',
    roughness: 0.89,
    metalness: 0,
    weathering: 0.72,
    heightMeters: 2.5,
    exposure: 0.62,
    note: 'role-specific doors and windows with deterministic sun, rain, patina, damp, edge wear and replacement age'
  },
  weatheredTile: {
    id: 'TJ001-ROOF-YUNNAN-PAN-COVER-TILE-AGED',
    color: '#77736b',
    roughness: 0.88,
    metalness: 0,
    weathering: 0.48,
    heightMeters: 1,
    exposure: 0.75,
    note: 'discrete ceramic pieces; pan channels below, cover pieces bridging joints'
  },
  stoneBase: {
    id: 'YKY-MAT-STONE-BASE-WEATHERED',
    color: '#77766c',
    roughness: 0.96,
    metalness: 0,
    weathering: 0.45,
    heightMeters: 0.55,
    exposure: 0.7,
    note: 'irregular grey stone plinth and courtyard slabs'
  },
  darkDoorOpening: {
    id: 'YKY-MAT-DOOR-OPENING-SHADOW',
    color: '#28231f',
    roughness: 0.98,
    metalness: 0,
    weathering: 0.12,
    heightMeters: 2.4,
    exposure: 0.2,
    note: 'deep, non-reflective recess behind a timber door frame'
  }
});

const WALL_FRAGMENT = `
float yunnanHash(vec3 p){
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}
float yunnanNoise(vec3 p){
  vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
  float n000=yunnanHash(i+vec3(0.0,0.0,0.0));
  float n100=yunnanHash(i+vec3(1.0,0.0,0.0));
  float n010=yunnanHash(i+vec3(0.0,1.0,0.0));
  float n110=yunnanHash(i+vec3(1.0,1.0,0.0));
  float n001=yunnanHash(i+vec3(0.0,0.0,1.0));
  float n101=yunnanHash(i+vec3(1.0,0.0,1.0));
  float n011=yunnanHash(i+vec3(0.0,1.0,1.0));
  float n111=yunnanHash(i+vec3(1.0,1.0,1.0));
  float x00=mix(n000,n100,f.x); float x10=mix(n010,n110,f.x);
  float x01=mix(n001,n101,f.x); float x11=mix(n011,n111,f.x);
  return mix(mix(x00,x10,f.y),mix(x01,x11,f.y),f.z);
}
float yunnanFbm(vec3 p){
  float v=0.0; float a=0.5;
  for(int i=0;i<4;i++){ v += a*yunnanNoise(p); p=p*2.03+vec3(17.0,5.0,11.0); a*=0.5; }
  return v;
}
`;

function color(value, fallback) {
  return new THREE.Color(value || fallback);
}

function seedValue(seed) {
  let n = Number(seed);
  if (!Number.isFinite(n)) {
    n = String(seed ?? 'yunnan').split('').reduce((a, c) => (a * 33 + c.charCodeAt(0)) % 9973, 17);
  }
  return n;
}

function injectWeathering(material, mode, options = {}) {
  const seed = seedValue(options.seed ?? material.userData?.yunnanSeed ?? 17);
  const profile = options.profile || YUNNAN_MATERIAL_PROFILES[mode] || YUNNAN_MATERIAL_PROFILES.agedTimber;
  const channels = options.surfaceChannels || {};
  if (mode === 'tile') material.vertexColors = true;
  material.userData = {
    ...(material.userData || {}),
    yunnanProfile: profile.id,
    yunnanMode: mode,
    yunnanSeed: seed,
    yunnanEvidenceStatus: 'userConfirmedAppearance_only',
    yunnanExactDimensionsLocked: false,
    yunnanSurfaceChannels: { ...channels },
    yunnanSurfaceFingerprint: JSON.stringify(Object.keys(channels).sort().map((key) => [key, channels[key]])),
  };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uYunnanSeed = { value: seed };
    shader.uniforms.uYunnanWeathering = { value: Number(options.weathering ?? profile.weathering) };
    shader.uniforms.uYunnanExposure = { value: Number(options.exposure ?? profile.exposure) };
    shader.uniforms.uYunnanHeight = { value: Number(options.heightMeters ?? profile.heightMeters) };
    shader.uniforms.uYunnanFiring = { value: Number(channels.baseFiringTone ?? 0.46) };
    shader.uniforms.uYunnanDust = { value: Number(channels.dust ?? 0.34) };
    shader.uniforms.uYunnanMoss = { value: Number(channels.moss ?? 0.12) };
    shader.uniforms.uYunnanRain = { value: Number(channels.rainWash ?? 0.28) };
    shader.uniforms.uYunnanEdgeWear = { value: Number(channels.edgeWear ?? 0.32) };
    shader.uniforms.uYunnanSunExposure = { value: Number(channels.sunExposure ?? channels.orientationExposure ?? 0.42) };
    shader.uniforms.uYunnanRainExposure = { value: Number(channels.rainExposure ?? channels.rainWash ?? 0.28) };
    shader.uniforms.uYunnanPatina = { value: Number(channels.patina ?? 0.36) };
    shader.uniforms.uYunnanRisingDamp = { value: Number(channels.risingDamp ?? 0.18) };
    shader.uniforms.uYunnanReplacementAge = { value: Number(channels.replacementAge ?? 0.74) };
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vYunnanWorldPosition;'
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvYunnanWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;'
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>\nvarying vec3 vYunnanWorldPosition;\nuniform float uYunnanSeed;\nuniform float uYunnanWeathering;\nuniform float uYunnanExposure;\nuniform float uYunnanHeight;\nuniform float uYunnanFiring;\nuniform float uYunnanDust;\nuniform float uYunnanMoss;\nuniform float uYunnanRain;\nuniform float uYunnanEdgeWear;\nuniform float uYunnanSunExposure;\nuniform float uYunnanRainExposure;\nuniform float uYunnanPatina;\nuniform float uYunnanRisingDamp;\nuniform float uYunnanReplacementAge;\n${WALL_FRAGMENT}`
    );
    const replacement = mode === 'wall' ? `
      #include <color_fragment>
      vec3 yp=vYunnanWorldPosition*0.22+vec3(uYunnanSeed*0.013);
      float macro=yunnanFbm(yp*0.34);
      float meso=yunnanNoise(yp*1.55+vec3(3.0,11.0,7.0));
      float fine=yunnanNoise(yp*5.5+vec3(19.0,2.0,13.0));
      float heightMask=1.0-clamp(vYunnanWorldPosition.y/max(uYunnanHeight,0.01),0.0,1.0);
      float pale=smoothstep(0.63,0.9,meso)*(0.25+0.75*heightMask)*uYunnanWeathering;
      float dark=smoothstep(0.68,0.94,macro)*(0.2+0.8*uYunnanExposure)*heightMask;
      float grain=(fine-0.5)*0.075*uYunnanWeathering;
      vec3 warmPatch=vec3(0.72,0.58,0.47);
      vec3 palePatch=vec3(0.77,0.73,0.64);
      vec3 darkPatch=vec3(0.22,0.18,0.15);
      diffuseColor.rgb=mix(diffuseColor.rgb,warmPatch,0.12*macro*uYunnanWeathering);
      diffuseColor.rgb=mix(diffuseColor.rgb,palePatch,pale*0.34);
      diffuseColor.rgb=mix(diffuseColor.rgb,darkPatch,dark*0.24);
      diffuseColor.rgb+=grain;
    ` : mode === 'openingTimber' ? `
      #include <color_fragment>
      vec3 yp=vYunnanWorldPosition*0.58+vec3(uYunnanSeed*0.019);
      float macro=yunnanFbm(yp*0.62);
      float fine=yunnanNoise(yp*4.1+vec3(5.0,13.0,2.0));
      float localHeight=clamp(vYunnanWorldPosition.y/max(uYunnanHeight,0.01),0.0,1.0);
      float sunMask=clamp(0.35+0.65*abs(normalize(vNormal).x),0.0,1.0)*uYunnanSunExposure;
      float rainMask=(0.25+0.75*smoothstep(0.44,0.92,macro))*uYunnanRainExposure;
      float dampMask=(1.0-localHeight)*(0.35+0.65*macro)*uYunnanRisingDamp;
      float patinaMask=smoothstep(0.42,0.88,fine)*uYunnanPatina;
      float edgeMask=smoothstep(0.62,0.94,abs(fine-0.5)*2.0)*uYunnanEdgeWear;
      vec3 sunBleached=vec3(0.48,0.39,0.31);
      vec3 rainDark=vec3(0.20,0.145,0.11);
      vec3 handPatina=vec3(0.16,0.105,0.075);
      vec3 dampBrown=vec3(0.22,0.18,0.14);
      vec3 replacementWarm=vec3(0.43,0.30,0.21);
      diffuseColor.rgb=mix(diffuseColor.rgb,sunBleached,sunMask*0.24);
      diffuseColor.rgb=mix(diffuseColor.rgb,rainDark,rainMask*0.20);
      diffuseColor.rgb=mix(diffuseColor.rgb,handPatina,patinaMask*0.22);
      diffuseColor.rgb=mix(diffuseColor.rgb,dampBrown,dampMask*0.36);
      diffuseColor.rgb=mix(diffuseColor.rgb,replacementWarm,uYunnanReplacementAge*0.34);
      diffuseColor.rgb*=1.0-edgeMask*0.16;
    ` : mode === 'timber' ? `
      #include <color_fragment>
      vec3 yp=vYunnanWorldPosition*0.42+vec3(uYunnanSeed*0.02);
      float grain=yunnanFbm(yp*0.7);
      float knots=yunnanNoise(yp*2.8+vec3(8.0,1.0,4.0));
      float sheltered=1.0-uYunnanExposure*0.35;
      vec3 greyBrown=vec3(0.35,0.29,0.24);
      vec3 darkBrown=vec3(0.18,0.13,0.10);
      diffuseColor.rgb=mix(diffuseColor.rgb,greyBrown,0.34+0.18*grain);
      diffuseColor.rgb=mix(diffuseColor.rgb,darkBrown,smoothstep(0.68,0.94,knots)*0.13*sheltered);
      diffuseColor.rgb*=1.0-0.08*uYunnanWeathering;
    ` : mode === 'tile' ? `
      #include <color_fragment>
      vec3 instanceBase=diffuseColor.rgb;
      vec3 yp=vYunnanWorldPosition*1.8+vec3(uYunnanSeed*0.017);
      float tone=yunnanNoise(yp*0.5);
      float wear=yunnanNoise(yp*3.0+vec3(4.0,8.0,2.0));
      float sun=clamp(vYunnanWorldPosition.x*0.035+0.5,0.0,1.0);
      float rain=abs(sin(vYunnanWorldPosition.z*0.72))*uYunnanRain;
      float dust=yunnanFbm(yp*0.22+vec3(7.0))*uYunnanDust;
      float moss=smoothstep(0.58,0.9,dust)*(1.0-sun)*uYunnanMoss;
      vec3 coolGrey=vec3(0.39,0.40,0.38);
      vec3 warmGrey=vec3(0.50,0.47,0.41);
      vec3 brownGrey=vec3(0.43,0.38,0.33);
      vec3 blueGrey=vec3(0.34,0.39,0.39);
      diffuseColor.rgb=mix(coolGrey,warmGrey,clamp(tone*0.30+uYunnanFiring*0.36,0.0,1.0));
      diffuseColor.rgb=mix(diffuseColor.rgb,instanceBase,0.55);
      diffuseColor.rgb=mix(diffuseColor.rgb,brownGrey,dust*0.18);
      diffuseColor.rgb=mix(diffuseColor.rgb,blueGrey,moss*0.32);
      diffuseColor.rgb*=1.0-(0.11*wear*uYunnanEdgeWear);
      diffuseColor.rgb+=rain*0.035+sun*0.025;
    ` : `
      #include <color_fragment>
    `;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', replacement);
    material.userData.yunnanShader = shader;
  };
  material.needsUpdate = true;
  return material;
}

export function createWeatheredEarthWallMaterial(options = {}) {
  const profile = { ...YUNNAN_MATERIAL_PROFILES.weatheredEarthWall, ...options };
  const material = new THREE.MeshStandardMaterial({
    color: color(profile.color, '#9f7052'),
    roughness: profile.roughness,
    metalness: profile.metalness,
    flatShading: false
  });
  return injectWeathering(material, 'wall', { ...profile, profile });
}

export function createAgedTimberMaterial(options = {}) {
  const profile = { ...YUNNAN_MATERIAL_PROFILES.agedTimber, ...options };
  const material = new THREE.MeshStandardMaterial({
    color: color(profile.color, '#6f5140'),
    roughness: profile.roughness,
    metalness: profile.metalness,
    flatShading: false
  });
  return injectWeathering(material, 'timber', { ...profile, profile });
}

export function createWeatheredTileMaterial(options = {}) {
  const profile = { ...YUNNAN_MATERIAL_PROFILES.weatheredTile, ...options };
  const material = new THREE.MeshStandardMaterial({
    color: color(profile.color, '#77736b'),
    roughness: profile.roughness,
    metalness: profile.metalness,
    flatShading: false
  });
  return injectWeathering(material, 'tile', { ...profile, profile });
}

export function createWeatheredOpeningTimberMaterial(options = {}) {
  const profile = { ...YUNNAN_MATERIAL_PROFILES.weatheredOpeningTimber, ...options };
  const channels = {
    sunExposure: 0.52, rainExposure: 0.38, patina: 0.42, risingDamp: 0.16,
    edgeWear: 0.34, replacementAge: 0, ...(options.surfaceChannels || {}),
  };
  const material = new THREE.MeshStandardMaterial({
    color: color(profile.color, '#604637'),
    roughness: profile.roughness,
    metalness: profile.metalness,
    flatShading: false,
  });
  injectWeathering(material, 'openingTimber', { ...profile, profile, surfaceChannels: channels });
  material.userData.yunnanOpeningRole = options.openingRole || 'openingFrame';
  material.userData.yunnanDeterministicChannels = [
    'sunExposure', 'rainExposure', 'patina', 'risingDamp', 'edgeWear', 'replacementAge',
  ];
  return material;
}

export function createStoneBaseMaterial(options = {}) {
  const profile = { ...YUNNAN_MATERIAL_PROFILES.stoneBase, ...options };
  return new THREE.MeshStandardMaterial({
    color: color(profile.color, '#77766c'),
    roughness: profile.roughness,
    metalness: profile.metalness,
    flatShading: true
  });
}

export function createDoorOpeningMaterial(options = {}) {
  const profile = { ...YUNNAN_MATERIAL_PROFILES.darkDoorOpening, ...options };
  return new THREE.MeshStandardMaterial({
    color: color(profile.color, '#28231f'),
    roughness: profile.roughness,
    metalness: profile.metalness
  });
}

export function createYunnanMaterialSet(options = {}) {
  const seed = seedValue(options.seed ?? 17);
  const openingEnabled = options.openingWeathering?.enabled !== false;
  const makeOpening = (role, offset, defaults) => createWeatheredOpeningTimberMaterial({
    seed: seed + offset,
    openingRole: role,
    weathering: openingEnabled ? 0.72 : 0,
    exposure: openingEnabled ? 0.62 : 0,
    surfaceChannels: openingEnabled
      ? { ...defaults, ...(options.openingWeathering?.[role] || {}) }
      : { sunExposure: 0, rainExposure: 0, patina: 0, risingDamp: 0, edgeWear: 0, replacementAge: 0 },
  });
  return {
    wall: createWeatheredEarthWallMaterial({ seed, ...(options.wall || {}) }),
    timber: createAgedTimberMaterial({ seed: seed + 19, ...(options.timber || {}) }),
    doorLeaf: makeOpening('doorLeaf', 71, { sunExposure: 0.62, rainExposure: 0.44, patina: 0.58, risingDamp: 0.24, edgeWear: 0.46, replacementAge: 0 }),
    windowLeaf: makeOpening('windowLeaf', 73, { sunExposure: 0.68, rainExposure: 0.52, patina: 0.34, risingDamp: 0.08, edgeWear: 0.42, replacementAge: 0 }),
    openingFrame: makeOpening('openingFrame', 79, { sunExposure: 0.48, rainExposure: 0.40, patina: 0.46, risingDamp: 0.18, edgeWear: 0.38, replacementAge: 0 }),
    openingSill: makeOpening('openingSill', 83, { sunExposure: 0.52, rainExposure: 0.76, patina: 0.38, risingDamp: 0.28, edgeWear: 0.56, replacementAge: 0 }),
    replacementTimber: makeOpening('replacementPart', 89, { sunExposure: 0.28, rainExposure: 0.30, patina: 0.12, risingDamp: 0.08, edgeWear: 0.18, replacementAge: 0.86 }),
    tilePan: createWeatheredTileMaterial({ seed: seed + 37, ...(options.tilePan || {}) }),
    tileCover: createWeatheredTileMaterial({ seed: seed + 53, color: '#858076', ...(options.tileCover || {}) }),
    stone: createStoneBaseMaterial(options.stone || {}),
    opening: createDoorOpeningMaterial(options.opening || {})
  };
}

export function disposeYunnanMaterialSet(set) {
  if (!set) return;
  Object.values(set).forEach((material) => material?.dispose?.());
}
