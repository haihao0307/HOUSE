import {
  TIMBER_PRESETS,
  chooseReliefMode,
  resolveProfileCode
} from "../core/YunnanTimberSkill.mjs";

function normalized(v, fallback = [1, 0, 0]) {
  const length = Math.hypot(v[0], v[1], v[2]);
  return length > 1e-8 ? v.map((value) => value / length) : [...fallback];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function variationFromSeed(seed) {
  let x = seed >>> 0;
  const next = () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0xffffffff;
  };
  return [next(), next(), next(), next()];
}

/**
 * Converts indexed geometry to face independent vertices and writes a
 * surfaceClass attribute.
 * 0 longitudinal
 * 1 end grain
 * 2 joint or fresh cut
 * 3 weathered override
 *
 * Three.js CylinderGeometry grows along local Y. For a standard round column,
 * pass geometryLengthAxis [0, 1, 0], radialAxisHint [1, 0, 0], profile round.
 */
export function prepareTimberGeometry(
  THREE,
  sourceGeometry,
  {
    geometryLengthAxis = [1, 0, 0],
    radialAxisHint = [0, 1, 0],
    profile = "rectangular",
    endThreshold = 0.86,
    jointTriangles = [],
    weatheredTriangles = []
  } = {}
) {
  if (!sourceGeometry?.attributes?.position) {
    throw new Error("sourceGeometry with a position attribute is required");
  }

  const geometry = sourceGeometry.index
    ? sourceGeometry.toNonIndexed()
    : sourceGeometry.clone();

  if (!geometry.attributes.normal) geometry.computeVertexNormals();

  const axis = normalized(geometryLengthAxis);
  const normals = geometry.attributes.normal;
  const classes = new Float32Array(normals.count);
  const jointSet = new Set(jointTriangles);
  const weatheredSet = new Set(weatheredTriangles);

  for (let vertex = 0; vertex < normals.count; vertex += 1) {
    const triangle = Math.floor(vertex / 3);
    if (jointSet.has(triangle)) {
      classes[vertex] = 2;
      continue;
    }
    if (weatheredSet.has(triangle)) {
      classes[vertex] = 3;
      continue;
    }
    const normal = [normals.getX(vertex), normals.getY(vertex), normals.getZ(vertex)];
    classes[vertex] = Math.abs(dot(normal, axis)) >= endThreshold ? 1 : 0;
  }

  geometry.setAttribute("surfaceClass", new THREE.BufferAttribute(classes, 1));
  geometry.userData.yunnanTimber = {
    geometryLengthAxis: [...geometryLengthAxis],
    radialAxisHint: [...radialAxisHint],
    profile,
    profileCode: resolveProfileCode(profile),
    endThreshold,
    surfaceClassVersion: 2
  };
  return geometry;
}

const noiseChunk = /* glsl */`
uniform vec3 uAxisX;
uniform vec3 uAxisY;
uniform vec3 uAxisZ;
uniform vec3 uGrainOffset;
uniform float uSeed;
uniform vec4 uVariation;
uniform float uDetail;
uniform float uProfileType;
uniform float uToolMarks;
uniform float uPoreScale;

vec3 toTimber(vec3 p) {
  return vec3(dot(p, uAxisX), dot(p, uAxisY), dot(p, uAxisZ));
}

float woodHash11(float p) {
  p = fract(p * .1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float woodHash31(vec3 p) {
  p = fract(p * .1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float woodNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(
      mix(woodHash31(i), woodHash31(i + vec3(1, 0, 0)), f.x),
      mix(woodHash31(i + vec3(0, 1, 0)), woodHash31(i + vec3(1, 1, 0)), f.x),
      f.y
    ),
    mix(
      mix(woodHash31(i + vec3(0, 0, 1)), woodHash31(i + vec3(1, 0, 1)), f.x),
      mix(woodHash31(i + vec3(0, 1, 1)), woodHash31(i + vec3(1, 1, 1)), f.x),
      f.y
    ),
    f.z
  );
}

float woodFbm(vec3 p) {
  float sum = 0.0;
  float amplitude = .52;
  mat3 rotation = mat3(0.0, .8, .6, -.8, .36, -.48, -.6, -.48, .64);
  for (int octave = 0; octave < 5; octave += 1) {
    sum += amplitude * woodNoise(p);
    p = rotation * p * 2.02 + 17.13;
    amplitude *= .49;
  }
  return sum;
}

float woodRidged(vec3 p) {
  return 1.0 - abs(woodNoise(p) * 2.0 - 1.0);
}

float roundProfileMask() {
  return 1.0 - step(.25, abs(uProfileType - 1.0));
}

vec4 sampleYunnanWood(vec3 inputPoint, float surfaceClass) {
  vec3 p = inputPoint + uGrainOffset;
  p.x *= mix(.92, 1.09, uVariation.x);
  p.yz *= mix(.94, 1.08, uVariation.y);
  p += vec3(uSeed * 43.7, uSeed * 19.3, uSeed * 31.1);

  float slowBend = woodFbm(vec3(p.x * .075, p.yz * .42));
  vec2 pithDrift = vec2(
    sin(p.x * .16 + uSeed * 18.0),
    cos(p.x * .13 + uSeed * 23.0)
  ) * .035;
  pithDrift += vec2(uVariation.z - .5, uVariation.w - .5) * .15;
  vec2 crossPosition = p.yz - pithDrift;
  float radial = length(crossPosition);
  float angle = atan(crossPosition.y, crossPosition.x);

  float ringWarp = (slowBend - .5) * .13;
  ringWarp += .020 * sin(p.x * .68 + uSeed * 15.0);
  ringWarp += .010 * sin(p.x * 1.75 + angle * .55);
  float ringPhase = (radial + ringWarp) * mix(10.5, 13.8, uVariation.x);
  float ringWave = .5 + .5 * sin(6.2831853 * ringPhase + woodFbm(vec3(p.x * .16, crossPosition * 1.05)) * 1.15);
  float lateWood = smoothstep(.58, .91, ringWave);
  float ringSoft = mix(ringWave, lateWood, .35);

  vec2 fibreWarp = vec2(
    woodFbm(vec3(p.x * .11, crossPosition * 1.3)),
    woodFbm(vec3(p.x * .09 + 13.0, crossPosition * 1.55 + 7.0))
  ) - .5;
  vec2 fibrePosition = crossPosition + fibreWarp * .075;
  float coarseFibre = woodRidged(vec3(p.x * .18, fibrePosition * 7.5) + uSeed * 7.0);
  float mediumFibre = woodRidged(vec3(p.x * .43, fibrePosition * 16.0) + uSeed * 11.0);
  float fineFibre = woodRidged(vec3(p.x * 1.35, fibrePosition * 38.0) + uSeed * 19.0);
  float silk = .57 * coarseFibre + .30 * mediumFibre + .13 * fineFibre;

  float sourceCell = floor((p.x + uSeed * 7.0) * .38);
  float localX = fract((p.x + uSeed * 7.0) * .38) - .5;
  vec2 knotCenter = vec2(
    woodHash11(sourceCell + uSeed * 37.0) - .5,
    woodHash11(sourceCell + uSeed * 71.0) - .5
  ) * .60;
  float knotRadius = length(fibrePosition - knotCenter);
  float knot = exp(-15.0 * (localX * localX * .52 + knotRadius * knotRadius));
  float knotRing = .5 + .5 * sin(34.0 * length(vec3(localX * .46, fibrePosition - knotCenter)));
  float knotTone = knot * (.30 + .70 * knotRing);
  float knotFlow = knot * woodRidged(vec3(p.x * .35, angle * 2.5, radial * 7.0) + uSeed * 41.0);

  float poreField = woodRidged(vec3(p.x * 3.5, fibrePosition * (47.0 * uPoreScale)) + uSeed * 29.0);
  float pores = smoothstep(.945, .992, poreField) * (.30 + .70 * mediumFibre);
  float hairField = woodRidged(vec3(p.x * .16, fibrePosition * 13.0) + uSeed * 43.0);
  float hairCrack = smoothstep(.975, .998, hairField) * smoothstep(.28, .90, slowBend);

  float toolLong = woodRidged(vec3(p.x * .10, fibrePosition * 5.2) + uSeed * 61.0);
  float toolCell = floor((p.x + uSeed * 5.0) * 1.7);
  float adzeWave = sin((p.x + woodHash11(toolCell) * .25) * 10.0 + angle * .25);
  float toolGroove = smoothstep(.90, .995, toolLong) * uToolMarks;
  float adzeMark = smoothstep(.70, .98, adzeWave * .5 + .5) * woodHash11(toolCell + 17.0) * uToolMarks * .35;

  float ray = woodRidged(vec3(radial * 3.7, angle * 9.0, p.x * .14) + uSeed * 31.0);
  float endPore = smoothstep(.94, .992, woodRidged(vec3(crossPosition * 43.0, p.x * .45) + uSeed * 53.0));
  float radialCrack = smoothstep(.978, .999, woodRidged(vec3(angle * 8.5, radial * 1.15, uSeed * 11.0)))
    * smoothstep(.20, .76, radial);

  float isEnd = step(.5, surfaceClass) * step(surfaceClass, 1.5);
  float isJoint = step(1.5, surfaceClass) * step(surfaceClass, 2.5);
  float isRound = roundProfileMask();

  float rectangularSide = .37 * ringSoft + .50 * silk + .13 * slowBend;
  float roundSide = .74 * silk + .16 * slowBend + .10 * (.5 + .5 * sin(p.x * .31 + slowBend * 2.4));
  float sideTone = mix(rectangularSide, roundSide, isRound);
  sideTone += knotTone * .13 + knotFlow * .08;

  float endTone = .70 * ringSoft + .18 * ray + .12 * woodFbm(vec3(crossPosition * 3.8, p.x));
  float tone = mix(sideTone, endTone, isEnd);
  tone = mix(tone, .62 * endTone + .38 * silk, isJoint);

  float rectangularHeight = .5
    + (ringSoft - .5) * .050
    + (silk - .5) * .040 * uDetail;
  float roundHeight = .5
    + (silk - .5) * .052 * uDetail
    + (slowBend - .5) * .020;
  float sideHeight = mix(rectangularHeight, roundHeight, isRound);
  sideHeight += (fineFibre - .5) * .012 * uDetail;
  sideHeight += knotTone * .026 + knotFlow * .012;
  sideHeight -= pores * .022 * uDetail;
  sideHeight -= hairCrack * .080;
  sideHeight -= toolGroove * .018 + adzeMark * .012;

  float endHeight = .5
    + (ringSoft - .5) * .070
    + (ray - .5) * .020 * uDetail
    - endPore * .025 * uDetail
    - radialCrack * .105;

  float height = mix(sideHeight, endHeight, isEnd);
  height = mix(height, .5 + (endHeight - .5) * .75 + (silk - .5) * .014, isJoint);

  float cavity = clamp(
    (.5 - height) * 3.2
    + pores * .20
    + hairCrack * .48
    + radialCrack * .48
    + toolGroove * .12,
    0.0,
    1.0
  );
  float roughSignal = clamp(
    .40
    + .32 * woodFbm(vec3(p.x * .55, fibrePosition * 4.7))
    + .16 * cavity
    + .08 * toolGroove,
    0.0,
    1.0
  );
  return vec4(clamp(tone, 0.0, 1.0), clamp(height, 0.0, 1.0), roughSignal, cavity);
}
`;

const vertexShader = /* glsl */`
attribute float surfaceClass;
uniform float uRelief;
uniform float uDisplacement;
uniform mat3 uWorldNormalMatrix;
varying vec3 vTimberPosition;
varying vec3 vTimberNormal;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying float vSurfaceClass;
${noiseChunk}

void main() {
  vec3 transformed = position;
  vec3 timberPosition = toTimber(position);
  float displacementLock = 1.0 - step(.5, surfaceClass);
  float low = woodFbm(vec3(timberPosition.x * .14, timberPosition.yz * .62) + uSeed * 9.0) - .5;
  float handWorked = woodFbm(vec3(timberPosition.x * .37, timberPosition.yz * 1.4) + uSeed * 27.0) - .5;
  float macroHeight = low * .72 + handWorked * .28;
  transformed += normal * macroHeight * uDisplacement * uRelief * displacementLock;

  vec4 world = modelMatrix * vec4(transformed, 1.0);
  vTimberPosition = toTimber(transformed);
  vTimberNormal = normalize(toTimber(normal));
  vWorldPosition = world.xyz;
  vWorldNormal = normalize(uWorldNormalMatrix * normal);
  vSurfaceClass = surfaceClass;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragmentShader = /* glsl */`
uniform vec3 uCameraPositionObject;
uniform vec3 uDarkColor;
uniform vec3 uMidColor;
uniform vec3 uLightColor;
uniform vec3 uWeatherColor;
uniform vec3 uFreshColor;
uniform vec2 uRoughnessRange;
uniform float uLacquer;
uniform float uContrast;
uniform float uRelief;
uniform float uWeathering;
uniform float uNormalStrength;
uniform float uParallaxDepth;
uniform int uParallaxSteps;
uniform float uSurfaceDebug;
varying vec3 vTimberPosition;
varying vec3 vTimberNormal;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying float vSurfaceClass;
${noiseChunk}

vec3 parallaxPoint(vec3 p, vec3 viewDirection) {
  if (uParallaxSteps <= 0 || vSurfaceClass > 2.5) return p;
  vec3 direction = normalize(viewDirection);
  float grazing = max(abs(dot(direction, normalize(vTimberNormal))), .30);
  float totalDepth = uParallaxDepth * uRelief / grazing;
  float layerStep = 1.0 / float(max(uParallaxSteps, 1));
  vec3 delta = direction * totalDepth * layerStep;
  vec3 current = p;
  float layer = 0.0;
  for (int index = 0; index < 10; index += 1) {
    if (index >= uParallaxSteps) break;
    float height = sampleYunnanWood(current, vSurfaceClass).y;
    if (height < 1.0 - layer) break;
    current -= delta;
    layer += layerStep;
  }
  return mix(p, current, .68);
}

vec3 perturbNormal(vec3 worldPosition, vec3 baseNormal, float height) {
  vec3 dp1 = dFdx(worldPosition);
  vec3 dp2 = dFdy(worldPosition);
  float dh1 = dFdx(height);
  float dh2 = dFdy(height);
  vec3 r1 = cross(dp2, baseNormal);
  vec3 r2 = cross(baseNormal, dp1);
  float determinant = dot(dp1, r1);
  vec3 gradient = sign(determinant) * (dh1 * r1 + dh2 * r2);
  return normalize(abs(determinant) * baseNormal - gradient * uNormalStrength * uRelief);
}

void main() {
  if (uSurfaceDebug > .5) {
    vec3 debugColor = vSurfaceClass < .5 ? vec3(.16, .58, .82)
      : vSurfaceClass < 1.5 ? vec3(.95, .66, .15)
      : vSurfaceClass < 2.5 ? vec3(.82, .25, .18)
      : vec3(.45);
    gl_FragColor = vec4(debugColor, 1.0);
    return;
  }

  vec3 cameraTimber = toTimber(uCameraPositionObject);
  vec3 point = parallaxPoint(vTimberPosition, cameraTimber - vTimberPosition);
  vec4 signals = sampleYunnanWood(point, vSurfaceClass);
  float softTone = mix(.5, signals.x, uContrast);

  vec3 color = mix(uDarkColor, uMidColor, smoothstep(.13, .62, softTone));
  color = mix(color, uLightColor, smoothstep(.58, .94, softTone) * .48);

  float isEnd = step(.5, vSurfaceClass) * step(vSurfaceClass, 1.5);
  float isJoint = step(1.5, vSurfaceClass) * step(vSurfaceClass, 2.5);
  color = mix(color, mix(color, uFreshColor, .34), isEnd * .40 + isJoint * .58);

  float greyMask = uWeathering * (.26 + .74 * woodFbm(vec3(point.x * .14, point.yz * .72) + uSeed * 5.0));
  color = mix(color, uWeatherColor, greyMask * .31);
  color *= 1.0 + (uVariation.z - .5) * .065;
  color *= 1.0 - signals.w * .18;

  vec3 normal = perturbNormal(vWorldPosition, normalize(vWorldNormal), signals.y);
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  vec3 lightDirection = normalize(vec3(-.48, .80, .36));
  vec3 halfDirection = normalize(viewDirection + lightDirection);
  float diffuse = max(dot(normal, lightDirection), 0.0);
  float roughness = mix(uRoughnessRange.x, uRoughnessRange.y, signals.z);
  roughness = mix(roughness, max(.25, roughness * .66), uLacquer);
  float specularPower = mix(12.0, 92.0, 1.0 - roughness);
  float specular = pow(max(dot(normal, halfDirection), 0.0), specularPower) * mix(.09, .30, uLacquer);
  float hemisphere = .31 + .27 * clamp(normal.y * .5 + .5, 0.0, 1.0);
  vec3 result = color * (hemisphere + diffuse * .86) * (1.0 - signals.w * .24)
    + vec3(specular)
    + vec3(.12, .105, .09) * (.10 + .08 * max(-normal.y, 0.0));
  result = result / (result + vec3(1.0));
  result = pow(result, vec3(1.0 / 2.2));
  gl_FragColor = vec4(result, 1.0);
}
`;

function applyPresetUniforms(THREE, uniforms, preset) {
  uniforms.uDarkColor.value.setRGB(...preset.dark);
  uniforms.uMidColor.value.setRGB(...preset.mid);
  uniforms.uLightColor.value.setRGB(...preset.light);
  uniforms.uWeatherColor.value.setRGB(...preset.weather);
  uniforms.uFreshColor.value.setRGB(...preset.freshCut);
  uniforms.uRoughnessRange.value.set(...preset.roughness);
  uniforms.uLacquer.value = preset.lacquer;
  uniforms.uPoreScale.value = preset.poreScale;
}

/**
 * Creates a Three.js ShaderMaterial that follows the same axis, seed, profile
 * and relief contracts as the standalone validator.
 */
export function createYunnanTimberMaterial(
  THREE,
  memberSpec,
  {
    quality = "inspection",
    distanceMeters = 2,
    contrast,
    detail = 0.92,
    relief = 0.68,
    weathering = memberSpec.weathering ?? 0.34,
    toolMarks = memberSpec.toolMarks ?? 0.28,
    surfaceDebug = false
  } = {}
) {
  const preset = TIMBER_PRESETS[memberSpec.presetId];
  if (!preset) throw new Error(`Unknown timber preset: ${memberSpec.presetId}`);
  const reliefMode = chooseReliefMode(distanceMeters, quality);
  const variation = variationFromSeed(memberSpec.memberSeed);

  const uniforms = {
    uAxisX: { value: new THREE.Vector3(...memberSpec.canonicalBasis.x) },
    uAxisY: { value: new THREE.Vector3(...memberSpec.canonicalBasis.y) },
    uAxisZ: { value: new THREE.Vector3(...memberSpec.canonicalBasis.z) },
    uGrainOffset: { value: new THREE.Vector3(...memberSpec.grainOffset) },
    uSeed: { value: memberSpec.sourceSeed / 0xffffffff },
    uVariation: { value: new THREE.Vector4(...variation) },
    uDetail: { value: detail },
    uProfileType: { value: memberSpec.profileCode ?? resolveProfileCode(memberSpec.profile) },
    uToolMarks: { value: toolMarks },
    uPoreScale: { value: preset.poreScale },
    uRelief: { value: relief * preset.relief },
    uDisplacement: { value: reliefMode.displacementMeters },
    uWorldNormalMatrix: { value: new THREE.Matrix3() },
    uCameraPositionObject: { value: new THREE.Vector3() },
    uDarkColor: { value: new THREE.Color(...preset.dark) },
    uMidColor: { value: new THREE.Color(...preset.mid) },
    uLightColor: { value: new THREE.Color(...preset.light) },
    uWeatherColor: { value: new THREE.Color(...preset.weather) },
    uFreshColor: { value: new THREE.Color(...preset.freshCut) },
    uRoughnessRange: { value: new THREE.Vector2(...preset.roughness) },
    uLacquer: { value: preset.lacquer },
    uContrast: { value: contrast ?? preset.contrast },
    uWeathering: { value: weathering },
    uNormalStrength: { value: reliefMode.normalStrength },
    uParallaxDepth: { value: reliefMode.parallaxDepthMeters },
    uParallaxSteps: { value: reliefMode.parallaxSteps },
    uSurfaceDebug: { value: surfaceDebug ? 1 : 0 }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
    extensions: { derivatives: true },
    toneMapped: false
  });

  const cameraLocal = new THREE.Vector3();
  material.onBeforeRender = (_renderer, _scene, camera, _geometry, object) => {
    cameraLocal.copy(camera.position);
    object.worldToLocal(cameraLocal);
    uniforms.uCameraPositionObject.value.copy(cameraLocal);
    uniforms.uWorldNormalMatrix.value.getNormalMatrix(object.matrixWorld);
  };

  material.userData.yunnanTimber = {
    skillVersion: memberSpec.skillVersion,
    memberId: memberSpec.memberId,
    sourceTimberId: memberSpec.sourceTimberId,
    profile: memberSpec.profile,
    updateQuality(nextDistanceMeters, nextQuality = quality) {
      const next = chooseReliefMode(nextDistanceMeters, nextQuality);
      uniforms.uDisplacement.value = next.displacementMeters;
      uniforms.uParallaxSteps.value = next.parallaxSteps;
      uniforms.uParallaxDepth.value = next.parallaxDepthMeters;
      uniforms.uNormalStrength.value = next.normalStrength;
    },
    updatePreset(nextPresetId) {
      const nextPreset = TIMBER_PRESETS[nextPresetId];
      if (!nextPreset) throw new Error(`Unknown timber preset: ${nextPresetId}`);
      applyPresetUniforms(THREE, uniforms, nextPreset);
      uniforms.uContrast.value = nextPreset.contrast;
      uniforms.uRelief.value = relief * nextPreset.relief;
    },
    setSurfaceDebug(enabled) {
      uniforms.uSurfaceDebug.value = enabled ? 1 : 0;
    }
  };

  return material;
}
