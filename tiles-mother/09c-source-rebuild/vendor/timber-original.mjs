// Exact source sections from the user-owned Library timber v3. No field/shader/preset rewrite.
/* ===== shaders.js ===== */
const vertexShaderSource = `#version 300 es
precision highp float;

in vec3 a_position;
in vec3 a_normal;
in vec3 a_grainPosition;
in vec3 a_grainNormal;
in float a_surfaceClass;

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;
uniform float u_isWood;
uniform float u_seed;
uniform float u_textureScale;
uniform float u_macroDisplacementM;
uniform float u_reliefScale;

out vec3 v_worldPosition;
out vec3 v_worldNormal;
out vec3 v_localNormal;
out vec3 v_grainPosition;
out vec3 v_objectPosition;
out float v_surfaceClass;

float vertexHash(vec3 p) {
  p = fract(p * 0.1031 + u_seed * vec3(17.17, 41.73, 83.11));
  p += dot(p, p.yzx + 31.32);
  return fract((p.x + p.y) * p.z);
}

float vertexNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(vertexHash(i + vec3(0,0,0)), vertexHash(i + vec3(1,0,0)), f.x),
        mix(vertexHash(i + vec3(0,1,0)), vertexHash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(vertexHash(i + vec3(0,0,1)), vertexHash(i + vec3(1,0,1)), f.x),
        mix(vertexHash(i + vec3(0,1,1)), vertexHash(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}

float macroField(vec3 p) {
  float result = 0.0;
  float amplitude = 0.58;
  for (int i = 0; i < 3; i++) {
    result += amplitude * vertexNoise(p);
    p = p * 2.07 + vec3(5.2, 9.1, 3.7);
    amplitude *= 0.45;
  }
  return result / 0.94;
}

void main() {
  vec3 localPosition = a_position;
  if (u_isWood > 0.5 && u_macroDisplacementM > 0.0) {
    vec3 grain = a_grainPosition * max(u_textureScale, 0.001);
    float broad = macroField(grain * vec3(0.28, 1.15, 1.15) + vec3(u_seed * 7.0));
    float longWave = 0.5 + 0.5 * sin(grain.x * 0.82 + u_seed * 29.0 + broad * 1.55);
    float macroHeight = (broad - 0.5) * 0.78 + (longWave - 0.5) * 0.22;
    float classWeight = 1.0;
    if (a_surfaceClass > 0.5 && a_surfaceClass < 2.5) classWeight = 0.0;
    else if (a_surfaceClass > 2.5 && a_surfaceClass < 3.5) classWeight = 1.08;
    localPosition += normalize(a_normal) * macroHeight * u_macroDisplacementM * u_reliefScale * classWeight;
  }

  vec4 worldPosition = u_model * vec4(localPosition, 1.0);
  v_worldPosition = worldPosition.xyz;
  v_worldNormal = normalize(mat3(u_model) * a_normal);
  v_localNormal = normalize(a_grainNormal);
  v_grainPosition = a_grainPosition;
  v_objectPosition = localPosition;
  v_surfaceClass = a_surfaceClass;
  gl_Position = u_projection * u_view * worldPosition;
}
`;

const fragmentShaderSource = `#version 300 es
precision highp float;

in vec3 v_worldPosition;
in vec3 v_worldNormal;
in vec3 v_localNormal;
in vec3 v_grainPosition;
in vec3 v_objectPosition;
in float v_surfaceClass;

uniform vec3 u_cameraPosition;
uniform vec3 u_cameraLocalPosition;
uniform vec3 u_cameraGrainPosition;
uniform vec3 u_lightDirection;
uniform vec3 u_lightColor;
uniform vec3 u_skyColor;
uniform vec3 u_groundColor;

uniform float u_seed;
uniform float u_ringFrequency;
uniform float u_ringScale;
uniform float u_ringWarp;
uniform float u_fiberFrequency;
uniform float u_fineFiberFrequency;
uniform float u_poreFrequency;
uniform float u_fiberStrength;
uniform float u_colorBias;
uniform float u_roughness;
uniform float u_angleOffset;
uniform vec2 u_pithOffset;
uniform float u_textureScale;
uniform float u_grainContrast;
uniform float u_detailFineness;
uniform float u_microReliefM;
uniform float u_parallaxM;
uniform float u_reliefScale;
uniform float u_shapeMode;
uniform float u_memberRadius;
uniform float u_roundGrainFlip;
uniform float u_reliefQuality;
uniform float u_parallaxSteps;
uniform float u_clearcoat;
uniform float u_clearcoatRoughness;
uniform float u_specularLevel;
uniform float u_distanceFadeStart;
uniform float u_distanceFadeEnd;
uniform float u_toolPhase;
uniform float u_crackPhase;
uniform float u_knotPhase;

uniform vec3 u_darkGrainColor;
uniform vec3 u_lightGrainColor;
uniform vec3 u_agedSurfaceColor;
uniform vec3 u_weatheredColor;
uniform vec3 u_freshCutColor;
uniform vec3 u_cavityColor;
uniform vec3 u_solidColor;
uniform float u_isWood;
uniform float u_alpha;
uniform float u_shadowDisc;
uniform float u_selected;
uniform int u_debugMode;

out vec4 outColor;

const float PI = 3.141592653589793;
const float TAU = 6.283185307179586;

float saturate(float value) { return clamp(value, 0.0, 1.0); }

float hash31(vec3 p) {
  p = fract(p * 0.1031 + u_seed * vec3(13.71, 47.13, 91.77));
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float valueNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i + vec3(0,0,0)), hash31(i + vec3(1,0,0)), f.x),
        mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
        mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}

float fbm(vec3 p) {
  float result = 0.0;
  float amplitude = 0.5;
  mat3 rotation = mat3(
    0.00, 0.80, 0.60,
   -0.80, 0.36,-0.48,
   -0.60,-0.48, 0.64
  );
  for (int i = 0; i < 5; i++) {
    result += amplitude * valueNoise(p);
    p = rotation * p * 2.03 + vec3(7.1, 3.7, 5.9);
    amplitude *= 0.5;
  }
  return result;
}

float aaSine(float coordinate) {
  float footprint = fwidth(coordinate);
  float attenuation = 1.0 - smoothstep(0.42, 1.15, footprint);
  return 0.5 + 0.5 * sin(TAU * coordinate) * attenuation;
}

float aaRidge(float coordinate, float width) {
  float cell = fract(coordinate);
  float distanceToLine = min(cell, 1.0 - cell);
  float footprint = min(0.24, fwidth(coordinate) * 0.85);
  return 1.0 - smoothstep(width + footprint, width + 0.16 + footprint, distanceToLine);
}

float aaThinLine(float coordinate, float width) {
  float distanceToLine = abs(sin(PI * coordinate));
  float footprint = min(0.22, fwidth(coordinate) * 0.75);
  return 1.0 - smoothstep(width + footprint, width + 0.085 + footprint, distanceToLine);
}

vec3 perturbNormalArb(vec3 surfPosition, vec3 surfNormal, float heightMeters) {
  vec3 sigmaX = dFdx(surfPosition);
  vec3 sigmaY = dFdy(surfPosition);
  vec3 r1 = cross(sigmaY, surfNormal);
  vec3 r2 = cross(surfNormal, sigmaX);
  float determinant = dot(sigmaX, r1);
  vec2 gradient = vec2(dFdx(heightMeters), dFdy(heightMeters));
  vec3 surfaceGradient = sign(determinant) * (gradient.x * r1 + gradient.y * r2);
  return normalize(abs(determinant) * surfNormal - surfaceGradient);
}

vec3 classificationColor(float surfaceClass) {
  if (surfaceClass < 0.5) return vec3(0.10, 0.55, 0.82);
  if (surfaceClass < 1.5) return vec3(0.95, 0.58, 0.12);
  if (surfaceClass < 2.5) return vec3(0.81, 0.22, 0.50);
  if (surfaceClass < 3.5) return vec3(0.34, 0.66, 0.43);
  return vec3(0.42, 0.44, 0.46);
}

float flatAcross(vec3 g, vec3 localNormal) {
  return abs(localNormal.y) > abs(localNormal.z) ? g.z : g.y;
}

float flatDepth(vec3 g, vec3 localNormal) {
  return abs(localNormal.y) > abs(localNormal.z) ? g.y : g.z;
}

float roundCycleCount(float multiplier) {
  float rawCount = TAU * max(u_memberRadius, 0.08) * max(u_fiberFrequency, 1.0) * multiplier;
  return max(12.0, floor(rawCount * 0.25 + 0.5) * 4.0);
}

float roundPhase(vec2 crossPosition, float multiplier) {
  float theta = atan(crossPosition.y, crossPosition.x) * (u_roundGrainFlip < 0.0 ? -1.0 : 1.0);
  return theta / TAU * roundCycleCount(multiplier);
}

float sidePhase(vec3 g, vec2 crossPosition, vec3 localNormal, float multiplier) {
  float planarValue = flatAcross(g, localNormal) * u_fiberFrequency * multiplier;
  float roundValue = roundPhase(crossPosition, multiplier);
  return mix(planarValue, roundValue, step(0.5, u_shapeMode));
}

float sideAnisotropicNoise(
  vec3 g,
  vec2 crossPosition,
  vec3 localNormal,
  float axialFrequency,
  float crossFrequency,
  float phase
) {
  float theta = atan(crossPosition.y, crossPosition.x) * (u_roundGrainFlip < 0.0 ? -1.0 : 1.0);
  float planarAcross = flatAcross(g, localNormal);
  float planarDepth = flatDepth(g, localNormal);
  vec3 planarCoordinate = vec3(
    g.x * axialFrequency + phase,
    planarAcross * crossFrequency + u_seed * 4.7,
    planarDepth * 0.72 + u_seed * 9.1
  );
  vec3 roundCoordinate = vec3(
    g.x * axialFrequency + phase,
    cos(theta) * crossFrequency + u_seed * 4.7,
    sin(theta) * crossFrequency + u_seed * 9.1
  );
  return mix(fbm(planarCoordinate), fbm(roundCoordinate), step(0.5, u_shapeMode));
}

float sideValueNoise(
  vec3 g,
  vec2 crossPosition,
  vec3 localNormal,
  float axialFrequency,
  float crossFrequency,
  float phase
) {
  float theta = atan(crossPosition.y, crossPosition.x) * (u_roundGrainFlip < 0.0 ? -1.0 : 1.0);
  float planarAcross = flatAcross(g, localNormal);
  float planarDepth = flatDepth(g, localNormal);
  vec3 planarCoordinate = vec3(
    g.x * axialFrequency + phase,
    planarAcross * crossFrequency + u_seed * 6.3,
    planarDepth * 0.54 + u_seed * 3.8
  );
  vec3 roundCoordinate = vec3(
    g.x * axialFrequency + phase,
    cos(theta) * crossFrequency + u_seed * 6.3,
    sin(theta) * crossFrequency + u_seed * 3.8
  );
  return mix(valueNoise(planarCoordinate), valueNoise(roundCoordinate), step(0.5, u_shapeMode));
}

float ridgeFromNoise(float value) {
  return 1.0 - abs(value * 2.0 - 1.0);
}

float knotSignal(vec3 g, vec2 crossPosition, vec3 localNormal) {
  float broad = sideAnisotropicNoise(
    g,
    crossPosition,
    localNormal,
    0.34,
    1.35,
    u_knotPhase + 8.0
  );
  float compact = sideValueNoise(
    g,
    crossPosition,
    localNormal,
    0.72,
    2.25,
    u_knotPhase * 0.37 + 17.0
  );
  return smoothstep(0.71, 0.91, broad) * smoothstep(0.58, 0.86, compact);
}

vec4 woodSignals(vec3 g, vec3 localNormal, float surfaceClass) {
  float crossSection = step(0.72, abs(localNormal.x));

  float driftY = fbm(vec3(g.x * 0.24 + u_seed * 3.1, 1.17, 7.93)) - 0.5;
  float driftZ = fbm(vec3(g.x * 0.21 - u_seed * 4.7, 9.31, 2.41)) - 0.5;
  vec2 longWarp = vec2(driftY, driftZ) * u_ringWarp * 0.115;
  vec2 crossPosition = g.yz + u_pithOffset + longWarp;
  float theta = atan(crossPosition.y, crossPosition.x);

  float oval = 0.075 * sin(u_seed * 31.0 + u_angleOffset);
  vec2 ringPosition = crossPosition * vec2(1.0 + oval, 1.0 - oval);
  float radial = length(ringPosition);
  float ringNoise = fbm(vec3(
    g.x * 0.18 + u_seed * 2.4,
    ringPosition.x * 2.2,
    ringPosition.y * 2.2
  ));
  float ringCoordinate = radial * u_ringFrequency * u_ringScale;
  ringCoordinate += (ringNoise - 0.5) * u_ringWarp * 1.18;
  ringCoordinate += sin(theta * 2.0 + u_seed * 13.0) * 0.12 * u_ringWarp;
  ringCoordinate += sin(theta * 5.0 - u_seed * 7.0) * 0.045 * u_ringWarp;
  float ringLine = aaThinLine(ringCoordinate, 0.060);
  float ringBody = aaSine(ringCoordinate + (ringNoise - 0.5) * 0.16);
  float ring = saturate(ringBody * 0.62 + ringLine * 0.38);

  float broad = sideAnisotropicNoise(g, crossPosition, localNormal, 0.18, 1.55, u_angleOffset);
  float flow = sideAnisotropicNoise(g, crossPosition, localNormal, 0.42, 3.35, u_seed * 11.0 + 2.4);
  float medium = sideAnisotropicNoise(g, crossPosition, localNormal, 0.88, 7.20, u_seed * 17.0 + 4.7);
  float knot = knotSignal(g, crossPosition, localNormal);

  float phaseWarp = (broad - 0.5) * 5.4 + (flow - 0.5) * 2.9;
  phaseWarp += sin(g.x * 0.58 + theta * 1.7 + u_seed * 19.0) * 0.50;
  phaseWarp += knot * (4.0 + 1.6 * sin(g.x * 1.05 + u_knotPhase));

  float coarseLine = aaThinLine(
    sidePhase(g, crossPosition, localNormal, 0.58) + phaseWarp + u_angleOffset / TAU,
    0.065
  );
  float coarseVein = ridgeFromNoise(flow);
  float coarseFiber = saturate(
    broad * 0.47 +
    coarseVein * 0.31 +
    coarseLine * 0.22
  );

  float mediumLine = aaThinLine(
    sidePhase(g, crossPosition, localNormal, 1.85) + phaseWarp * 1.72 + u_seed * 7.0,
    0.040
  );
  float mediumFiber = saturate(
    medium * 0.47 +
    ridgeFromNoise(flow * 0.62 + medium * 0.38) * 0.37 +
    mediumLine * 0.16
  );

  float crackGate = smoothstep(
    0.79,
    0.94,
    sideValueNoise(g, crossPosition, localNormal, 0.32, 3.1, u_crackPhase + 13.0)
  );
  float sideCrack = aaThinLine(
    sidePhase(g, crossPosition, localNormal, 0.17)
      + phaseWarp * 0.16
      + u_crackPhase / TAU,
    0.014
  ) * crackGate;
  float radialGate = smoothstep(
    0.72,
    0.93,
    valueNoise(vec3(radial * 1.9, g.x * 0.27, u_seed * 9.0))
  );
  float radialCrack = pow(max(0.0, sin(theta * 7.0 + u_crackPhase)), 26.0)
    * smoothstep(0.08, 0.27, radial)
    * radialGate;
  float cracks = mix(sideCrack, max(sideCrack * 0.12, radialCrack), crossSection);

  return vec4(ring, coarseFiber, mediumFiber, cracks);
}

vec4 secondarySignals(vec3 g, vec3 localNormal) {
  vec2 crossPosition = g.yz + u_pithOffset;
  float broadWarp = sideAnisotropicNoise(
    g,
    crossPosition,
    localNormal,
    0.46,
    4.4,
    u_seed * 21.0 + 1.7
  );
  float fineNoise = sideAnisotropicNoise(
    g,
    crossPosition,
    localNormal,
    1.55,
    18.0 * max(u_detailFineness, 0.45),
    u_seed * 29.0 + 5.3
  );
  float fineLine = aaThinLine(
    sidePhase(g, crossPosition, localNormal, 4.6 * max(u_detailFineness, 0.45))
      + (broadWarp - 0.5) * 8.5
      + u_seed * 19.0,
    0.026
  );
  float fineFiber = saturate(
    fineNoise * 0.53 +
    ridgeFromNoise(fineNoise) * 0.30 +
    fineLine * 0.17
  );

  float poreNoise = sideValueNoise(
    g,
    crossPosition,
    localNormal,
    4.2 * max(u_detailFineness, 0.45),
    38.0 * max(u_detailFineness, 0.45),
    u_seed * 23.0 + 11.0
  );
  float poreGate = sideValueNoise(
    g,
    crossPosition,
    localNormal,
    0.85,
    7.0,
    u_seed * 31.0 + 2.0
  );
  float pores = smoothstep(0.865, 0.982, poreNoise)
    * smoothstep(0.52, 0.82, poreGate);

  float toolWave = aaSine(g.x * 1.45 + flatAcross(g, localNormal) * 0.22 + u_toolPhase / TAU);
  float toolMask = smoothstep(
    0.79,
    0.96,
    sideValueNoise(g, crossPosition, localNormal, 0.54, 2.3, u_toolPhase + 5.0)
  );
  float tool = toolWave * toolMask;

  float knot = knotSignal(g, crossPosition, localNormal);
  return vec4(fineFiber, pores, tool, knot);
}

float macroSignal(vec3 g) {
  return fbm(g * vec3(0.12, 0.70, 0.70) + vec3(u_seed * 5.0));
}

float coarseRelief(vec3 g, vec3 localNormal, float surfaceClass) {
  float crossSection = step(0.72, abs(localNormal.x));
  vec2 crossPosition = g.yz + u_pithOffset;
  float theta = atan(crossPosition.y, crossPosition.x);
  float radial = length(crossPosition);

  float broadWarp = valueNoise(vec3(g.x * 0.18, crossPosition * 2.4) + vec3(u_seed * 3.1));
  float sideBand = aaSine(
    sidePhase(g, crossPosition, localNormal, 0.62)
    + (broadWarp - 0.5) * 3.2
    + u_angleOffset / TAU
  );
  float ringBand = aaSine(
    radial * u_ringFrequency * u_ringScale
    + (broadWarp - 0.5) * u_ringWarp * 0.55
  );
  float sparseGate = smoothstep(
    0.84,
    0.965,
    valueNoise(vec3(g.x * 0.31 + u_crackPhase, crossPosition * 4.1))
  );
  float sideCrack = aaThinLine(
    sidePhase(g, crossPosition, localNormal, 0.20)
    + (broadWarp - 0.5) * 0.22
    + u_crackPhase / TAU,
    0.015
  ) * sparseGate;
  float radialCrack = pow(max(0.0, sin(theta * 7.0 + u_crackPhase)), 24.0)
    * smoothstep(0.08, 0.28, radial)
    * sparseGate;

  float sideHeight = (sideBand - 0.5) * 0.36 - sideCrack * 0.60;
  float endHeight = (ringBand - 0.5) * 0.34 - radialCrack * 0.68;
  return saturate(0.5 + mix(sideHeight, endHeight, crossSection));
}

vec3 applyParallax(vec3 baseGrain, vec3 localNormal, float surfaceClass, vec3 viewGrain) {
  float stepCount = clamp(floor(u_parallaxSteps + 0.5), 1.0, 12.0);
  float facing = max(abs(dot(viewGrain, localNormal)), 0.30);
  vec3 tangentView = viewGrain - localNormal * dot(viewGrain, localNormal);
  float tangentLength = length(tangentView);
  if (tangentLength < 0.00001) return baseGrain;
  tangentView /= tangentLength;

  float layerStep = 1.0 / stepCount;
  vec3 delta = tangentView * (u_parallaxM * max(u_textureScale, 0.001) * u_reliefScale / facing) / stepCount;
  vec3 currentGrain = baseGrain;
  vec3 previousGrain = currentGrain;
  float currentLayer = 0.0;
  float previousLayer = 0.0;
  float currentDepth = 1.0 - coarseRelief(currentGrain, localNormal, surfaceClass);
  float previousDepth = currentDepth;

  for (int i = 0; i < 12; i++) {
    if (float(i) >= stepCount || currentLayer >= currentDepth) break;
    previousGrain = currentGrain;
    previousLayer = currentLayer;
    previousDepth = currentDepth;
    currentGrain -= delta;
    currentLayer += layerStep;
    currentDepth = 1.0 - coarseRelief(currentGrain, localNormal, surfaceClass);
  }

  float after = currentDepth - currentLayer;
  float before = previousDepth - previousLayer;
  float denominator = after - before;
  float weight = abs(denominator) > 0.00001 ? clamp(after / denominator, 0.0, 1.0) : 0.0;
  return mix(currentGrain, previousGrain, weight);
}

void main() {
  if (u_shadowDisc > 0.5) {
    float radius = length(v_objectPosition.xz);
    float alpha = (1.0 - smoothstep(0.05, 1.0, radius)) * u_alpha;
    outColor = vec4(u_solidColor, alpha);
    return;
  }

  vec3 baseColor = u_solidColor;
  float surfaceClass = v_surfaceClass;
  float heightMeters = 0.0;
  float roughness = u_roughness;
  float cavity = 1.0;
  float ringCoordinateDebug = 0.0;

  if (u_isWood > 0.5) {
    vec3 localNormal = normalize(v_localNormal);
    vec3 g = v_grainPosition * max(u_textureScale, 0.001);

    if (u_reliefQuality > 1.5 && u_parallaxM > 0.0 && u_parallaxSteps > 0.5) {
      vec3 viewGrain = normalize(u_cameraGrainPosition * max(u_textureScale, 0.001) - g);
      g = applyParallax(g, localNormal, surfaceClass, viewGrain);
    }

    vec4 signals = woodSignals(g, localNormal, surfaceClass);
    vec4 secondary = secondarySignals(g, localNormal);
    float ring = signals.x;
    float coarseFiber = signals.y;
    float mediumFiber = signals.z;
    float cracks = signals.w;
    float fineFiber = secondary.x;
    float pores = secondary.y;
    float tool = secondary.z;
    float knot = secondary.w;
    float macro = macroSignal(g);

    float crossSection = step(0.72, abs(localNormal.x));
    vec2 crossPosition = g.yz + u_pithOffset;
    float radial = length(crossPosition);
    float endRay = aaSine(atan(crossPosition.y, crossPosition.x) * 3.0 / TAU + radial * 2.0 + u_seed * 7.0);

    float longitudinalTone =
      (coarseFiber - 0.5) * 1.02 +
      (mediumFiber - 0.5) * 0.43 +
      (macro - 0.5) * 0.56 +
      (fineFiber - 0.5) * 0.11 +
      knot * 0.26 -
      cracks * 0.70 -
      pores * 0.08;
    float endTone =
      (ring - 0.5) * 1.08 +
      (endRay - 0.5) * 0.19 +
      (macro - 0.5) * 0.38 -
      cracks * 0.72 -
      pores * 0.05;
    float grainTone = mix(longitudinalTone, endTone, crossSection) + u_colorBias;
    float grainMix = saturate(0.50 + grainTone * u_grainContrast * 2.72);
    vec3 grainColor = mix(u_lightGrainColor, u_darkGrainColor, grainMix);
    baseColor = mix(u_agedSurfaceColor, grainColor, 0.78);

    if (surfaceClass > 0.5 && surfaceClass < 1.5) {
      baseColor = mix(baseColor, u_freshCutColor, 0.20);
    } else if (surfaceClass > 1.5 && surfaceClass < 2.5) {
      baseColor = mix(baseColor, u_freshCutColor, 0.27);
    } else if (surfaceClass > 2.5 && surfaceClass < 3.5) {
      baseColor = mix(baseColor, u_weatheredColor, 0.53);
      roughness = min(0.98, roughness + 0.045);
    }

    baseColor *= 0.905 + macro * 0.19;
    baseColor = mix(baseColor, u_cavityColor, cracks * 0.40 + pores * 0.065 + knot * 0.025);

    float distanceToCamera = length(u_cameraPosition - v_worldPosition);
    float detailFade = 1.0 - smoothstep(u_distanceFadeStart, u_distanceFadeEnd, distanceToCamera);
    float sideMicro =
      (coarseFiber - 0.5) * 0.32 +
      (mediumFiber - 0.5) * 0.24 +
      (fineFiber - 0.5) * 0.12 -
      pores * 0.30 -
      cracks * 0.94 -
      tool * 0.13 +
      knot * 0.09;
    float endMicro =
      (ring - 0.5) * 0.34 +
      (fineFiber - 0.5) * 0.05 -
      pores * 0.22 -
      cracks * 1.0;
    float microSignal = mix(sideMicro, endMicro, crossSection);
    heightMeters = microSignal * u_microReliefM * u_reliefScale * detailFade;

    roughness = clamp(
      roughness + pores * 0.045 + cracks * 0.075 + (0.5 - macro) * 0.022 - u_clearcoat * 0.085,
      0.18,
      0.98
    );
    cavity = clamp(1.0 - cracks * 0.34 - pores * 0.06 - ring * crossSection * 0.035, 0.60, 1.0);
    ringCoordinateDebug = radial * u_ringFrequency * u_ringScale;

    if (u_debugMode == 1) {
      baseColor = classificationColor(surfaceClass);
      heightMeters = 0.0;
    } else if (u_debugMode == 2) {
      baseColor = mix(vec3(coarseFiber), vec3(ring, mediumFiber, fineFiber), crossSection * 0.78);
      heightMeters = 0.0;
    } else if (u_debugMode == 3) {
      baseColor = vec3(abs(localNormal.x), abs(localNormal.y), abs(localNormal.z));
      heightMeters = 0.0;
    } else if (u_debugMode == 4) {
      float h = saturate(0.5 + microSignal * 0.68);
      baseColor = vec3(h);
      heightMeters = 0.0;
    }
  }

  vec3 normal = normalize(v_worldNormal);
  if (u_isWood > 0.5 && u_debugMode == 0 && u_reliefQuality > 0.5) {
    normal = perturbNormalArb(v_worldPosition, normal, heightMeters);
  }

  vec3 lightDir = normalize(u_lightDirection);
  vec3 viewDir = normalize(u_cameraPosition - v_worldPosition);
  float nDotL = max(dot(normal, lightDir), 0.0);
  float hemi = saturate(normal.y * 0.5 + 0.5);
  vec3 ambient = mix(u_groundColor, u_skyColor, hemi);
  vec3 halfVector = normalize(lightDir + viewDir);

  float baseSpecPower = mix(10.0, 86.0, 1.0 - roughness);
  float baseSpecular = pow(max(dot(normal, halfVector), 0.0), baseSpecPower)
    * (1.0 - roughness) * u_specularLevel;
  float coatPower = mix(42.0, 180.0, 1.0 - u_clearcoatRoughness);
  float coatSpecular = pow(max(dot(normal, halfVector), 0.0), coatPower)
    * u_clearcoat * 0.24;
  float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0) * 0.045;

  vec3 litColor = baseColor * (ambient * 0.80 + u_lightColor * nDotL * 1.05) * cavity;
  litColor += u_lightColor * (baseSpecular + coatSpecular);
  litColor += baseColor * rim;

  if (u_selected > 0.5) {
    float pulse = 0.5 + 0.5 * sin(u_seed * 41.0 + ringCoordinateDebug * 0.24);
    litColor = mix(litColor, litColor * 1.13 + vec3(0.035, 0.020, 0.010), 0.08 + 0.03 * pulse);
  }

  litColor = pow(max(litColor, vec3(0.0)), vec3(1.0 / 2.2));
  outColor = vec4(litColor, u_alpha);
}
`;


/* ===== preset.js ===== */
const BASE_PRESET = Object.freeze({
  system: 'yunnan-procedural-timber@3.0',
  grainSpace: 'member_local',
  lengthAxis: [1, 0, 0],
  units: Object.freeze({ geometry: 'meter', relief: 'millimeter' }),
  grain: Object.freeze({
    ringFrequency: 22.0,
    ringWarp: 1.08,
    fiberFrequency: 7.4,
    fineFiberFrequency: 72.0,
    poreFrequency: 280.0,
    fiberStrength: 0.34,
    poreStrength: 0.08,
    toolMarkStrength: 0.05,
    crackStrength: 0.09,
    knotStrength: 0.13
  }),
  relief: Object.freeze({
    mode: 'hybrid-height-field',
    microReliefMm: 0.22,
    parallaxMm: 0.82,
    macroDisplacementMm: 0.42,
    maxMicroReliefMm: 0.42,
    maxParallaxMm: 1.65,
    maxMacroDisplacementMm: 0.95,
    parallaxStepsClose: 6,
    parallaxStepsInspection: 12,
    macroGeometryThresholdMm: 4.0,
    distanceFadeStartM: 9.0,
    distanceFadeEndM: 28.0,
    autoInspectionDistanceM: 5.2,
    autoCloseDistanceM: 11.0
  }),
  variation: Object.freeze({
    colorAmount: 0.042,
    ringScaleAmount: 0.18,
    grainWarpAmount: 0.20,
    roughnessAmount: 0.065,
    reliefAmount: 0.24,
    knotAmount: 0.30,
    toolMarkAmount: 0.26
  })
});

function definePreset({
  id,
  label,
  description,
  colors,
  surface,
  controls = {},
  relief = {}
}) {
  return Object.freeze({
    ...BASE_PRESET,
    id,
    label,
    description,
    colors: Object.freeze(colors),
    surface: Object.freeze(surface),
    controls: Object.freeze({
      textureScale: 1,
      grainContrast: 0.235,
      detailFineness: 1.0,
      reliefScale: 1.0,
      ...controls
    }),
    relief: Object.freeze({
      ...BASE_PRESET.relief,
      ...relief
    })
  });
}

const YUNNAN_TIMBER_PRESETS = Object.freeze({
  yunnan_dark_aged_v2: definePreset({
    id: 'yunnan_dark_aged_v2',
    label: '深色旧木',
    description: '深褐、低反光、轻灰化，适合柱梁、檩枋与长期使用的室内构架。',
    colors: {
      darkGrain: '#2b1c15',
      lightGrain: '#76563f',
      agedSurface: '#443229',
      weatheredSurface: '#5a4d42',
      freshCut: '#8b6b50',
      cavity: '#190f0c'
    },
    surface: {
      roughnessMin: 0.82,
      roughnessMax: 0.93,
      clearcoat: 0.0,
      clearcoatRoughness: 1.0,
      specular: 0.17
    },
    controls: {
      grainContrast: 0.275,
      detailFineness: 1.08,
      reliefScale: 0.94
    },
    relief: {
      microReliefMm: 0.24,
      parallaxMm: 0.88,
      macroDisplacementMm: 0.44
    }
  }),

  yunnan_warm_medium_v2: definePreset({
    id: 'yunnan_warm_medium_v2',
    label: '暖褐中等',
    description: '暖褐、轻度氧化、层次柔和，适合门框、窗框、楼板与较少风化的木构件。',
    colors: {
      darkGrain: '#3b281c',
      lightGrain: '#765740',
      agedSurface: '#594235',
      weatheredSurface: '#675b52',
      freshCut: '#8c7056',
      cavity: '#271b15'
    },
    surface: {
      roughnessMin: 0.72,
      roughnessMax: 0.87,
      clearcoat: 0.0,
      clearcoatRoughness: 1.0,
      specular: 0.21
    },
    controls: {
      grainContrast: 0.225,
      detailFineness: 1.06,
      reliefScale: 0.78
    },
    relief: {
      microReliefMm: 0.20,
      parallaxMm: 0.72,
      macroDisplacementMm: 0.34
    }
  }),

  yunnan_light_weathered_v2: definePreset({
    id: 'yunnan_light_weathered_v2',
    label: '浅色风化',
    description: '浅灰褐、日晒褪色、哑光，适合檐下、外墙木板、旧门板和次要构件。',
    colors: {
      darkGrain: '#5a4839',
      lightGrain: '#987a5f',
      agedSurface: '#786758',
      weatheredSurface: '#858078',
      freshCut: '#a88c70',
      cavity: '#392e27'
    },
    surface: {
      roughnessMin: 0.84,
      roughnessMax: 0.96,
      clearcoat: 0.0,
      clearcoatRoughness: 1.0,
      specular: 0.13
    },
    controls: {
      grainContrast: 0.205,
      detailFineness: 1.14,
      reliefScale: 0.96
    },
    relief: {
      microReliefMm: 0.28,
      parallaxMm: 1.05,
      macroDisplacementMm: 0.56
    }
  }),

  yunnan_lacquered_chestnut_v2: definePreset({
    id: 'yunnan_lacquered_chestnut_v2',
    label: '栗褐上漆',
    description: '克制的栗红褐与旧漆光泽，适合厅堂门窗、栏板和维护较好的可见构件。',
    colors: {
      darkGrain: '#351812',
      lightGrain: '#743d2c',
      agedSurface: '#55291f',
      weatheredSurface: '#5b3930',
      freshCut: '#8b5741',
      cavity: '#21100d'
    },
    surface: {
      roughnessMin: 0.44,
      roughnessMax: 0.63,
      clearcoat: 0.32,
      clearcoatRoughness: 0.44,
      specular: 0.32
    },
    controls: {
      grainContrast: 0.20,
      detailFineness: 1.06,
      reliefScale: 0.30
    },
    relief: {
      microReliefMm: 0.10,
      parallaxMm: 0.30,
      macroDisplacementMm: 0.16
    }
  })
});

const DEFAULT_PRESET_ID = 'yunnan_dark_aged_v2';
const DEFAULT_YUNNAN_TIMBER_PRESET_ID = DEFAULT_PRESET_ID;
const YUNNAN_DARK_TIMBER_PRESET = YUNNAN_TIMBER_PRESETS[DEFAULT_PRESET_ID];

function getYunnanTimberPreset(id = DEFAULT_PRESET_ID) {
  return YUNNAN_TIMBER_PRESETS[id] ?? YUNNAN_TIMBER_PRESETS[DEFAULT_PRESET_ID];
}

function listYunnanTimberPresets() {
  return Object.values(YUNNAN_TIMBER_PRESETS);
}

function resolvePresetWithControls(preset, overrides = {}) {
  return Object.freeze({
    ...preset,
    controls: Object.freeze({ ...preset.controls, ...(overrides.controls ?? overrides) }),
    relief: Object.freeze({ ...preset.relief, ...(overrides.relief ?? {}) }),
    surface: Object.freeze({ ...preset.surface, ...(overrides.surface ?? {}) })
  });
}

function hexToRgb01(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255
  ];
}

function srgbChannelToLinear(value) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function hexToLinearRgb01(hex) {
  return hexToRgb01(hex).map(srgbChannelToLinear);
}

function relativeLuminance(hex) {
  const rgb = hexToRgb01(hex).map((v) => (
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}


/* ===== math.js ===== */
function mat4Identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

function mat4Translation(x, y, z) {
  const out = mat4Identity();
  out[12] = x;
  out[13] = y;
  out[14] = z;
  return out;
}

function mat4RotationX(radians) {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}

function mat4RotationY(radians) {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}

function mat4RotationZ(radians) {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function mat4FromTR(position = [0, 0, 0], rotation = [0, 0, 0]) {
  const translate = mat4Translation(position[0], position[1], position[2]);
  const rotateX = mat4RotationX(rotation[0]);
  const rotateY = mat4RotationY(rotation[1]);
  const rotateZ = mat4RotationZ(rotation[2]);
  return mat4Multiply(translate, mat4Multiply(rotateZ, mat4Multiply(rotateY, rotateX)));
}

function mat4Perspective(fovRadians, aspect, near, far) {
  const f = 1 / Math.tan(fovRadians / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0
  ]);
}

function normalize(v) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function mat4LookAt(eye, target, up = [0, 1, 0]) {
  const zAxis = normalize(subtract(eye, target));
  const xAxis = normalize(cross(up, zAxis));
  const yAxis = cross(zAxis, xAxis);
  return new Float32Array([
    xAxis[0], yAxis[0], zAxis[0], 0,
    xAxis[1], yAxis[1], zAxis[1], 0,
    xAxis[2], yAxis[2], zAxis[2], 0,
    -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1
  ]);
}

function transformPoint(matrix, point) {
  const x = point[0];
  const y = point[1];
  const z = point[2];
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  return [
    (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w,
    (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w,
    (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) / w
  ];
}

function mat4Scale(x, y, z) {
  return new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]);
}

function mat4Compose({ position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  return mat4Multiply(mat4FromTR(position, rotation), mat4Scale(scale[0], scale[1], scale[2]));
}

function transformDirection(matrix, direction) {
  const x = matrix[0] * direction[0] + matrix[4] * direction[1] + matrix[8] * direction[2];
  const y = matrix[1] * direction[0] + matrix[5] * direction[1] + matrix[9] * direction[2];
  const z = matrix[2] * direction[0] + matrix[6] * direction[1] + matrix[10] * direction[2];
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

const radians = (degrees) => degrees * Math.PI / 180;

function mat4Inverse(matrix) {
  const m = matrix;
  const out = new Float32Array(16);
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
  const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
  const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  let determinant = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (Math.abs(determinant) < 1e-12) throw new RangeError('矩阵不可逆');
  determinant = 1 / determinant;

  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * determinant;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * determinant;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * determinant;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * determinant;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * determinant;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * determinant;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * determinant;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * determinant;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * determinant;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * determinant;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * determinant;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * determinant;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * determinant;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * determinant;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * determinant;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * determinant;
  return out;
}


/* ===== deterministic.js ===== */
function fnv1a32(input) {
  let hash = 0x811c9dc5;
  const text = String(input);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function seed01(input) {
  return fnv1a32(input) / 0xffffffff;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomGenerationSeed() {
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0] >>> 0;
  }
  const entropy = `${Date.now()}|${Math.random()}|${globalThis.performance?.now?.() ?? 0}`;
  return fnv1a32(entropy);
}

function normalizeGenerationSeed(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value >>> 0;
  const text = String(value ?? '').trim();
  if (!text) return randomGenerationSeed();
  if (/^0x[0-9a-f]+$/i.test(text)) return Number.parseInt(text.slice(2), 16) >>> 0;
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10) >>> 0;
  return fnv1a32(text);
}

function memberSeed(buildingId, floorId, memberId, revision = 'v2', generationSeed = 0) {
  return fnv1a32(`${generationSeed >>> 0}|${buildingId}|${floorId}|${memberId}|${revision}`);
}

function deriveMemberParameters(seed, finishSeed = seed ^ 0x9e3779b9) {
  const random = mulberry32(seed);
  const finishRandom = mulberry32(finishSeed);
  return Object.freeze({
    ringScale: 0.86 + random() * 0.30,
    warpScale: 0.78 + random() * 0.44,
    colorBias: -0.045 + finishRandom() * 0.09,
    contrastBias: -0.08 + finishRandom() * 0.16,
    detailScale: 0.84 + random() * 0.34,
    reliefBias: 0.78 + finishRandom() * 0.44,
    angleOffset: random() * Math.PI * 2,
    knotPhase: random() * Math.PI * 2,
    roughnessBias: -0.038 + finishRandom() * 0.076,
    reliefScale: 0.78 + finishRandom() * 0.44,
    fiberScale: 0.82 + random() * 0.36,
    toolPhase: finishRandom() * Math.PI * 2,
    crackPhase: finishRandom() * Math.PI * 2,
    pithOffset: [(random() - 0.5) * 0.18, (random() - 0.5) * 0.18]
  });
}

function sourceTimberSeed({
  buildingId,
  generationSeed,
  floorId,
  sourceTimberId,
  materialRevision = 'grain-v003'
}) {
  const master = normalizeGenerationSeed(generationSeed);
  return memberSeed(buildingId, floorId, sourceTimberId, materialRevision, master);
}

function memberFinishSeed({
  buildingId,
  generationSeed,
  floorId,
  sourceTimberId,
  memberId,
  materialRevision = 'grain-v003'
}) {
  const master = normalizeGenerationSeed(generationSeed);
  return fnv1a32(`${master}|${buildingId}|${floorId}|${sourceTimberId}|${memberId}|${materialRevision}|finish`);
}


/* ===== grain-contract.js ===== */
const SURFACE = Object.freeze({
  END_GRAIN: 'end_grain',
  LONGITUDINAL: 'longitudinal',
  JOINT_CUT: 'joint_cut'
});

function classifyFaceByLocalNormal(normal, endThreshold = 0.82) {
  if (!Array.isArray(normal) || normal.length !== 3) {
    throw new TypeError('normal 必须是三个数值组成的数组');
  }
  const length = Math.hypot(normal[0], normal[1], normal[2]);
  if (length < 1e-8) throw new RangeError('normal 长度不能为 0');
  const axial = Math.abs(normal[0] / length);
  return axial >= endThreshold ? SURFACE.END_GRAIN : SURFACE.LONGITUDINAL;
}

function inheritedSourceCoordinate(localPosition, grainOffset) {
  if (localPosition.length !== 3 || grainOffset.length !== 3) {
    throw new TypeError('位置与偏移均须包含三个数值');
  }
  return [
    localPosition[0] + grainOffset[0],
    localPosition[1] + grainOffset[1],
    localPosition[2] + grainOffset[2]
  ];
}

function childOffsetFromParent(childCenterInParent) {
  if (childCenterInParent.length !== 3) {
    throw new TypeError('childCenterInParent 必须包含三个数值');
  }
  return [...childCenterInParent];
}

function continuityError({ leftLocal, leftOffset, rightLocal, rightOffset }) {
  const left = inheritedSourceCoordinate(leftLocal, leftOffset);
  const right = inheritedSourceCoordinate(rightLocal, rightOffset);
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}


/* ===== geometry.js ===== */
const SURFACE_CODE = Object.freeze({
  [SURFACE.LONGITUDINAL]: 0,
  [SURFACE.END_GRAIN]: 1,
  [SURFACE.JOINT_CUT]: 2,
  weathered: 3,
  solid: 4
});

function resolveSurfaceCode(value, fallback) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value in SURFACE_CODE) return SURFACE_CODE[value];
  return fallback;
}

function add3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function pushFace(target, corners, normal, surfaceCode, grainOffset = [0, 0, 0]) {
  const start = target.positions.length / 3;
  for (const corner of corners) {
    target.positions.push(...corner);
    target.normals.push(...normal);
    target.grainPositions.push(...add3(corner, grainOffset));
    target.surfaceClasses.push(surfaceCode);
  }
  target.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
}

function pushTriangle(target, corners, normal, surfaceCode, grainOffset = [0, 0, 0]) {
  const start = target.positions.length / 3;
  for (const corner of corners) {
    target.positions.push(...corner);
    target.normals.push(...normal);
    target.grainPositions.push(...add3(corner, grainOffset));
    target.surfaceClasses.push(surfaceCode);
  }
  target.indices.push(start, start + 1, start + 2);
}


function pushGridFace(target, origin, uVector, vVector, uSegments, vSegments, normal, surfaceCode, grainOffset = [0, 0, 0]) {
  const start = target.positions.length / 3;
  const uCount = Math.max(1, Math.floor(uSegments));
  const vCount = Math.max(1, Math.floor(vSegments));
  for (let v = 0; v <= vCount; v += 1) {
    const tv = v / vCount;
    for (let u = 0; u <= uCount; u += 1) {
      const tu = u / uCount;
      const point = [
        origin[0] + uVector[0] * tu + vVector[0] * tv,
        origin[1] + uVector[1] * tu + vVector[1] * tv,
        origin[2] + uVector[2] * tu + vVector[2] * tv
      ];
      target.positions.push(...point);
      target.normals.push(...normal);
      target.grainPositions.push(...add3(point, grainOffset));
      target.surfaceClasses.push(surfaceCode);
    }
  }
  const stride = uCount + 1;
  for (let v = 0; v < vCount; v += 1) {
    for (let u = 0; u < uCount; u += 1) {
      const a = start + v * stride + u;
      const b = a + 1;
      const d = a + stride;
      const c = d + 1;
      target.indices.push(a, b, c, a, c, d);
    }
  }
}

function result(target, bounds, metadata = {}) {
  const maximumIndex = target.indices.length ? Math.max(...target.indices) : 0;
  const IndexArray = maximumIndex > 65535 ? Uint32Array : Uint16Array;
  return {
    positions: new Float32Array(target.positions),
    normals: new Float32Array(target.normals),
    grainPositions: new Float32Array(target.grainPositions),
    surfaceClasses: new Float32Array(target.surfaceClasses),
    indices: new IndexArray(target.indices),
    bounds,
    metadata
  };
}

function planeX(target, x, y0, y1, z0, z1, sign, surfaceCode, grainOffset) {
  if (sign > 0) {
    pushFace(target, [[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]], [1, 0, 0], surfaceCode, grainOffset);
  } else {
    pushFace(target, [[x, y0, z1], [x, y1, z1], [x, y1, z0], [x, y0, z0]], [-1, 0, 0], surfaceCode, grainOffset);
  }
}

function planeY(target, y, x0, x1, z0, z1, sign, surfaceCode, grainOffset) {
  if (sign > 0) {
    pushFace(target, [[x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]], [0, 1, 0], surfaceCode, grainOffset);
  } else {
    pushFace(target, [[x0, y, z1], [x0, y, z0], [x1, y, z0], [x1, y, z1]], [0, -1, 0], surfaceCode, grainOffset);
  }
}

function planeZ(target, z, x0, x1, y0, y1, sign, surfaceCode, grainOffset) {
  if (sign > 0) {
    pushFace(target, [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], [0, 0, 1], surfaceCode, grainOffset);
  } else {
    pushFace(target, [[x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z]], [0, 0, -1], surfaceCode, grainOffset);
  }
}

/**
 * Rectangular timber. Local +X is always the fibre and member length axis.
 * `grainOffset` maps a detached sub-piece into its parent timber coordinate.
 */
function createBoxGeometry(length, height, depth, options = {}) {
  const x = length / 2;
  const y = height / 2;
  const z = depth / 2;
  const grainOffset = options.grainOffset ?? [0, 0, 0];
  const side = resolveSurfaceCode(options.sideClass, SURFACE_CODE.longitudinal);
  const end = resolveSurfaceCode(options.endClass, SURFACE_CODE.end_grain);
  const face = options.faceClasses ?? {};
  const target = { positions: [], normals: [], grainPositions: [], surfaceClasses: [], indices: [] };

  planeX(target, x, -y, y, -z, z, 1, resolveSurfaceCode(face.posX, end), grainOffset);
  planeX(target, -x, -y, y, -z, z, -1, resolveSurfaceCode(face.negX, end), grainOffset);
  planeY(target, y, -x, x, -z, z, 1, resolveSurfaceCode(face.posY, side), grainOffset);
  planeY(target, -y, -x, x, -z, z, -1, resolveSurfaceCode(face.negY, side), grainOffset);
  planeZ(target, z, -x, x, -y, y, 1, resolveSurfaceCode(face.posZ, side), grainOffset);
  planeZ(target, -z, -x, x, -y, y, -1, resolveSurfaceCode(face.negZ, side), grainOffset);

  return result(target, { length, height, depth }, {
    type: 'box-member',
    grainAxis: [1, 0, 0],
    grainOffset: [...grainOffset]
  });
}


/** Densely tessellated box for millimetre-scale silhouette displacement. */
function createSubdividedBoxGeometry(length, height, depth, options = {}) {
  const x = length / 2;
  const y = height / 2;
  const z = depth / 2;
  const grainOffset = options.grainOffset ?? [0, 0, 0];
  const side = resolveSurfaceCode(options.sideClass, SURFACE_CODE.longitudinal);
  const endClass = resolveSurfaceCode(options.endClass, SURFACE_CODE.end_grain);
  const face = options.faceClasses ?? {};
  const lengthSegments = Math.max(1, Math.floor(options.lengthSegments ?? 28));
  const crossSegments = Math.max(1, Math.floor(options.crossSegments ?? 4));
  const endSegments = Math.max(1, Math.floor(options.endSegments ?? 5));
  const target = { positions: [], normals: [], grainPositions: [], surfaceClasses: [], indices: [] };

  pushGridFace(target, [x, -y, -z], [0, height, 0], [0, 0, depth], endSegments, endSegments, [1, 0, 0], resolveSurfaceCode(face.posX, endClass), grainOffset);
  pushGridFace(target, [-x, -y, z], [0, height, 0], [0, 0, -depth], endSegments, endSegments, [-1, 0, 0], resolveSurfaceCode(face.negX, endClass), grainOffset);
  pushGridFace(target, [-x, y, z], [length, 0, 0], [0, 0, -depth], lengthSegments, crossSegments, [0, 1, 0], resolveSurfaceCode(face.posY, side), grainOffset);
  pushGridFace(target, [-x, -y, -z], [length, 0, 0], [0, 0, depth], lengthSegments, crossSegments, [0, -1, 0], resolveSurfaceCode(face.negY, side), grainOffset);
  pushGridFace(target, [-x, -y, z], [length, 0, 0], [0, height, 0], lengthSegments, crossSegments, [0, 0, 1], resolveSurfaceCode(face.posZ, side), grainOffset);
  pushGridFace(target, [x, -y, -z], [-length, 0, 0], [0, height, 0], lengthSegments, crossSegments, [0, 0, -1], resolveSurfaceCode(face.negZ, side), grainOffset);

  return result(target, { length, height, depth }, {
    type: 'subdivided-box-member',
    grainAxis: [1, 0, 0],
    grainOffset: [...grainOffset],
    tessellation: { lengthSegments, crossSegments, endSegments },
    supportsMacroDisplacement: true
  });
}

/** Round timber aligned to local +X.
 * `axialSegments` and `macroAmplitude` provide true low-frequency silhouette relief.
 * Fine fibres and pores remain shader-level normal/parallax detail.
 */
function createCylinderGeometry(length, radius, segments = 64, options = {}) {
  const target = { positions: [], normals: [], grainPositions: [], surfaceClasses: [], indices: [] };
  const half = length / 2;
  const grainOffset = options.grainOffset ?? [0, 0, 0];
  const irregularity = options.irregularity ?? 0;
  const phase = options.phase ?? 0;
  const axialSegments = Math.max(1, Math.floor(options.axialSegments ?? 1));
  const macroAmplitude = Math.max(0, options.macroAmplitude ?? 0);
  const macroFrequency = options.macroFrequency ?? 1.6;
  const sideClass = resolveSurfaceCode(options.sideClass, SURFACE_CODE.longitudinal);
  const leftEndClass = resolveSurfaceCode(options.leftEndClass ?? options.endClass, SURFACE_CODE.end_grain);
  const rightEndClass = resolveSurfaceCode(options.rightEndClass ?? options.endClass, SURFACE_CODE.end_grain);

  const radiusAt = (t, x) => {
    const angular = irregularity * (
      0.55 * Math.sin(t * 3 + phase) +
      0.28 * Math.sin(t * 7 + phase * 1.7) +
      0.17 * Math.sin(t * 11 - phase * 0.4)
    );
    const axial = macroAmplitude * (
      0.55 * Math.sin(x * macroFrequency + phase) +
      0.27 * Math.sin(x * macroFrequency * 2.17 + t * 2.0 - phase * 0.3) +
      0.18 * Math.sin(x * macroFrequency * 0.61 - t * 5.0 + phase * 1.4)
    );
    return radius * (1 + angular) + axial;
  };

  for (let j = 0; j <= axialSegments; j += 1) {
    const x = -half + (j / axialSegments) * length;
    for (let i = 0; i <= segments; i += 1) {
      const t = (i / segments) * Math.PI * 2;
      const r = radiusAt(t, x);
      const y = Math.cos(t) * r;
      const z = Math.sin(t) * r;
      const ny = Math.cos(t);
      const nz = Math.sin(t);
      target.positions.push(x, y, z);
      target.grainPositions.push(x + grainOffset[0], y + grainOffset[1], z + grainOffset[2]);
      target.normals.push(0, ny, nz);
      target.surfaceClasses.push(sideClass);
    }
  }

  const row = segments + 1;
  for (let j = 0; j < axialSegments; j += 1) {
    for (let i = 0; i < segments; i += 1) {
      const a = j * row + i;
      const b = (j + 1) * row + i;
      const c = j * row + i + 1;
      const d = (j + 1) * row + i + 1;
      target.indices.push(a, b, d, a, d, c);
    }
  }

  const leftCenter = target.positions.length / 3;
  target.positions.push(-half, 0, 0);
  target.grainPositions.push(-half + grainOffset[0], grainOffset[1], grainOffset[2]);
  target.normals.push(-1, 0, 0);
  target.surfaceClasses.push(leftEndClass);
  const leftRingStart = target.positions.length / 3;
  for (let i = 0; i <= segments; i += 1) {
    const t = (i / segments) * Math.PI * 2;
    const r = radiusAt(t, -half);
    const y = Math.cos(t) * r;
    const z = Math.sin(t) * r;
    target.positions.push(-half, y, z);
    target.grainPositions.push(-half + grainOffset[0], y + grainOffset[1], z + grainOffset[2]);
    target.normals.push(-1, 0, 0);
    target.surfaceClasses.push(leftEndClass);
  }
  for (let i = 0; i < segments; i += 1) target.indices.push(leftCenter, leftRingStart + i + 1, leftRingStart + i);

  const rightCenter = target.positions.length / 3;
  target.positions.push(half, 0, 0);
  target.grainPositions.push(half + grainOffset[0], grainOffset[1], grainOffset[2]);
  target.normals.push(1, 0, 0);
  target.surfaceClasses.push(rightEndClass);
  const rightRingStart = target.positions.length / 3;
  for (let i = 0; i <= segments; i += 1) {
    const t = (i / segments) * Math.PI * 2;
    const r = radiusAt(t, half);
    const y = Math.cos(t) * r;
    const z = Math.sin(t) * r;
    target.positions.push(half, y, z);
    target.grainPositions.push(half + grainOffset[0], y + grainOffset[1], z + grainOffset[2]);
    target.normals.push(1, 0, 0);
    target.surfaceClasses.push(rightEndClass);
  }
  for (let i = 0; i < segments; i += 1) target.indices.push(rightCenter, rightRingStart + i, rightRingStart + i + 1);

  return result(target, { length, radius, segments, axialSegments }, {
    type: 'cylinder-member',
    grainAxis: [1, 0, 0],
    grainOffset: [...grainOffset],
    supportsMacroDisplacement: axialSegments > 1,
    macroGeometry: { amplitude: macroAmplitude, frequency: macroFrequency }
  });
}

function macroOffsetAt(position, normal, seed, amplitude, frequency) {
  if (amplitude <= 0) return 0;
  const phase = ((seed >>> 0) / 0xffffffff) * Math.PI * 2;
  const cross = position[1] * 0.71 + position[2] * 0.47;
  const value =
    0.54 * Math.sin(position[0] * frequency + phase) +
    0.28 * Math.sin(position[0] * frequency * 2.13 + cross * 3.1 - phase * 0.37) +
    0.18 * Math.sin(position[0] * frequency * 0.63 - cross * 5.2 + phase * 1.31);
  const faceBias = 0.88 + 0.12 * Math.abs(normal[1] * 0.7 + normal[2] * 0.3);
  return amplitude * value * faceBias;
}

function pushSubdividedFace(target, {
  origin,
  u,
  v,
  uSegments,
  vSegments,
  normal,
  surfaceCode,
  grainOffset,
  seed,
  macroAmplitude,
  macroFrequency
}) {
  const baseIndex = target.positions.length / 3;
  for (let j = 0; j <= vSegments; j += 1) {
    const tv = j / vSegments;
    for (let i = 0; i <= uSegments; i += 1) {
      const tu = i / uSegments;
      const source = [
        origin[0] + u[0] * tu + v[0] * tv,
        origin[1] + u[1] * tu + v[1] * tv,
        origin[2] + u[2] * tu + v[2] * tv
      ];
      const offset = macroOffsetAt(source, normal, seed, macroAmplitude, macroFrequency);
      target.positions.push(
        source[0] + normal[0] * offset,
        source[1] + normal[1] * offset,
        source[2] + normal[2] * offset
      );
      target.grainPositions.push(
        source[0] + grainOffset[0],
        source[1] + grainOffset[1],
        source[2] + grainOffset[2]
      );
      target.normals.push(...normal);
      target.surfaceClasses.push(surfaceCode);
    }
  }
  const row = uSegments + 1;
  for (let j = 0; j < vSegments; j += 1) {
    for (let i = 0; i < uSegments; i += 1) {
      const a = baseIndex + j * row + i;
      const b = a + 1;
      const c = baseIndex + (j + 1) * row + i;
      const d = c + 1;
      target.indices.push(a, b, d, a, d, c);
    }
  }
}

/** Rectangular hewn member with low-frequency true geometry relief on long faces. */
function createHewnBoxGeometry(length, height, depth, options = {}) {
  const target = { positions: [], normals: [], grainPositions: [], surfaceClasses: [], indices: [] };
  const x = length / 2;
  const y = height / 2;
  const z = depth / 2;
  const grainOffset = options.grainOffset ?? [0, 0, 0];
  const side = resolveSurfaceCode(options.sideClass, SURFACE_CODE.longitudinal);
  const end = resolveSurfaceCode(options.endClass, SURFACE_CODE.end_grain);
  const face = options.faceClasses ?? {};
  const segmentsLength = Math.max(1, Math.floor(options.segmentsLength ?? 16));
  const segmentsCross = Math.max(1, Math.floor(options.segmentsCross ?? 3));
  const seed = options.seed ?? 0;
  const macroAmplitude = Math.max(0, options.macroAmplitude ?? 0);
  const macroFrequency = options.macroFrequency ?? 1.6;

  // Long faces use source coordinates for grain, displaced positions for silhouette.
  pushSubdividedFace(target, {
    origin: [-x, y, z], u: [length, 0, 0], v: [0, 0, -depth],
    uSegments: segmentsLength, vSegments: segmentsCross, normal: [0, 1, 0],
    surfaceCode: resolveSurfaceCode(face.posY, side), grainOffset, seed, macroAmplitude, macroFrequency
  });
  pushSubdividedFace(target, {
    origin: [-x, -y, -z], u: [length, 0, 0], v: [0, 0, depth],
    uSegments: segmentsLength, vSegments: segmentsCross, normal: [0, -1, 0],
    surfaceCode: resolveSurfaceCode(face.negY, side), grainOffset, seed, macroAmplitude, macroFrequency
  });
  pushSubdividedFace(target, {
    origin: [-x, -y, z], u: [length, 0, 0], v: [0, height, 0],
    uSegments: segmentsLength, vSegments: segmentsCross, normal: [0, 0, 1],
    surfaceCode: resolveSurfaceCode(face.posZ, side), grainOffset, seed, macroAmplitude, macroFrequency
  });
  pushSubdividedFace(target, {
    origin: [x, -y, -z], u: [-length, 0, 0], v: [0, height, 0],
    uSegments: segmentsLength, vSegments: segmentsCross, normal: [0, 0, -1],
    surfaceCode: resolveSurfaceCode(face.negZ, side), grainOffset, seed, macroAmplitude, macroFrequency
  });

  // End and joint-cut faces stay dimensionally exact.
  planeX(target, x, -y, y, -z, z, 1, resolveSurfaceCode(face.posX, end), grainOffset);
  planeX(target, -x, -y, y, -z, z, -1, resolveSurfaceCode(face.negX, end), grainOffset);

  return result(target, { length, height, depth }, {
    type: 'hewn-box-member',
    grainAxis: [1, 0, 0],
    grainOffset: [...grainOffset],
    macroGeometry: { amplitude: macroAmplitude, frequency: macroFrequency, segmentsLength, segmentsCross }
  });
}

/** True through-mortise cut into a rectangular post. Local X remains the post grain axis. */
function createMortisedPostGeometry({
  length,
  width,
  depth,
  mortiseCenter,
  mortiseHeight,
  mortiseDepth,
  grainOffset = [0, 0, 0]
}) {
  const target = { positions: [], normals: [], grainPositions: [], surfaceClasses: [], indices: [] };
  const x0 = -length / 2;
  const x1 = length / 2;
  const y0 = -width / 2;
  const y1 = width / 2;
  const z0 = -depth / 2;
  const z1 = depth / 2;
  const hx0 = mortiseCenter - mortiseHeight / 2;
  const hx1 = mortiseCenter + mortiseHeight / 2;
  const hz0 = -mortiseDepth / 2;
  const hz1 = mortiseDepth / 2;

  planeX(target, x0, y0, y1, z0, z1, -1, SURFACE_CODE.end_grain, grainOffset);
  planeX(target, x1, y0, y1, z0, z1, 1, SURFACE_CODE.end_grain, grainOffset);
  planeZ(target, z0, x0, x1, y0, y1, -1, SURFACE_CODE.longitudinal, grainOffset);
  planeZ(target, z1, x0, x1, y0, y1, 1, SURFACE_CODE.longitudinal, grainOffset);

  for (const [y, sign] of [[y0, -1], [y1, 1]]) {
    planeY(target, y, x0, hx0, z0, z1, sign, SURFACE_CODE.longitudinal, grainOffset);
    planeY(target, y, hx1, x1, z0, z1, sign, SURFACE_CODE.longitudinal, grainOffset);
    planeY(target, y, hx0, hx1, z0, hz0, sign, SURFACE_CODE.longitudinal, grainOffset);
    planeY(target, y, hx0, hx1, hz1, z1, sign, SURFACE_CODE.longitudinal, grainOffset);
  }

  planeX(target, hx0, y0, y1, hz0, hz1, 1, SURFACE_CODE.joint_cut, grainOffset);
  planeX(target, hx1, y0, y1, hz0, hz1, -1, SURFACE_CODE.joint_cut, grainOffset);
  planeZ(target, hz0, hx0, hx1, y0, y1, 1, SURFACE_CODE.joint_cut, grainOffset);
  planeZ(target, hz1, hx0, hx1, y0, y1, -1, SURFACE_CODE.joint_cut, grainOffset);

  return result(target, { length, width, depth }, {
    type: 'mortised-post',
    grainAxis: [1, 0, 0],
    mortise: { center: mortiseCenter, height: mortiseHeight, depth: mortiseDepth, throughAxis: 'local-y' },
    inheritedCoordinateDomain: true
  });
}

function addShoulders(target, x, sign, body, tenon, grainOffset) {
  planeX(target, x, body.y0, tenon.y0, body.z0, body.z1, sign, SURFACE_CODE.joint_cut, grainOffset);
  planeX(target, x, tenon.y1, body.y1, body.z0, body.z1, sign, SURFACE_CODE.joint_cut, grainOffset);
  planeX(target, x, tenon.y0, tenon.y1, body.z0, tenon.z0, sign, SURFACE_CODE.joint_cut, grainOffset);
  planeX(target, x, tenon.y0, tenon.y1, tenon.z1, body.z1, sign, SURFACE_CODE.joint_cut, grainOffset);
}

/** Beam body plus two reduced tenons. All newly exposed surfaces share the parent grain field. */
function createTenonedBeamGeometry({
  bodyLength,
  bodyHeight,
  bodyDepth,
  tenonLength,
  tenonHeight,
  tenonDepth,
  grainOffset = [0, 0, 0]
}) {
  const target = { positions: [], normals: [], grainPositions: [], surfaceClasses: [], indices: [] };
  const body = {
    x0: -bodyLength / 2,
    x1: bodyLength / 2,
    y0: -bodyHeight / 2,
    y1: bodyHeight / 2,
    z0: -bodyDepth / 2,
    z1: bodyDepth / 2
  };
  const tenon = {
    y0: -tenonHeight / 2,
    y1: tenonHeight / 2,
    z0: -tenonDepth / 2,
    z1: tenonDepth / 2
  };
  const leftX0 = body.x0 - tenonLength;
  const rightX1 = body.x1 + tenonLength;

  planeY(target, body.y0, body.x0, body.x1, body.z0, body.z1, -1, SURFACE_CODE.longitudinal, grainOffset);
  planeY(target, body.y1, body.x0, body.x1, body.z0, body.z1, 1, SURFACE_CODE.longitudinal, grainOffset);
  planeZ(target, body.z0, body.x0, body.x1, body.y0, body.y1, -1, SURFACE_CODE.longitudinal, grainOffset);
  planeZ(target, body.z1, body.x0, body.x1, body.y0, body.y1, 1, SURFACE_CODE.longitudinal, grainOffset);
  addShoulders(target, body.x0, -1, body, tenon, grainOffset);
  addShoulders(target, body.x1, 1, body, tenon, grainOffset);

  for (const [tx0, tx1] of [[leftX0, body.x0], [body.x1, rightX1]]) {
    planeY(target, tenon.y0, tx0, tx1, tenon.z0, tenon.z1, -1, SURFACE_CODE.joint_cut, grainOffset);
    planeY(target, tenon.y1, tx0, tx1, tenon.z0, tenon.z1, 1, SURFACE_CODE.joint_cut, grainOffset);
    planeZ(target, tenon.z0, tx0, tx1, tenon.y0, tenon.y1, -1, SURFACE_CODE.joint_cut, grainOffset);
    planeZ(target, tenon.z1, tx0, tx1, tenon.y0, tenon.y1, 1, SURFACE_CODE.joint_cut, grainOffset);
  }
  planeX(target, leftX0, tenon.y0, tenon.y1, tenon.z0, tenon.z1, -1, SURFACE_CODE.joint_cut, grainOffset);
  planeX(target, rightX1, tenon.y0, tenon.y1, tenon.z0, tenon.z1, 1, SURFACE_CODE.joint_cut, grainOffset);

  return result(target, { length: bodyLength + tenonLength * 2, bodyLength, bodyHeight, bodyDepth }, {
    type: 'tenoned-beam',
    grainAxis: [1, 0, 0],
    tenon: { length: tenonLength, height: tenonHeight, depth: tenonDepth },
    inheritedCoordinateDomain: true
  });
}

function createConeGeometry(length, radius, segments = 32) {
  const target = { positions: [], normals: [], grainPositions: [], surfaceClasses: [], indices: [] };
  const x0 = -length / 2;
  const x1 = length / 2;
  for (let i = 0; i < segments; i += 1) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const p0 = [x0, Math.cos(a0) * radius, Math.sin(a0) * radius];
    const p1 = [x0, Math.cos(a1) * radius, Math.sin(a1) * radius];
    const tip = [x1, 0, 0];
    const mid = (a0 + a1) * 0.5;
    const normal = [radius / length, Math.cos(mid), Math.sin(mid)];
    const magnitude = Math.hypot(...normal);
    pushTriangle(target, [p0, p1, tip], normal.map((v) => v / magnitude), SURFACE_CODE.solid);
  }
  for (let i = 0; i < segments; i += 1) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    pushTriangle(target, [
      [x0, 0, 0],
      [x0, Math.cos(a1) * radius, Math.sin(a1) * radius],
      [x0, Math.cos(a0) * radius, Math.sin(a0) * radius]
    ], [-1, 0, 0], SURFACE_CODE.solid);
  }
  return result(target, { length, radius, segments }, { type: 'cone' });
}

function createPlaneGeometry(width, depth) {
  const x = width / 2;
  const z = depth / 2;
  const positions = new Float32Array([-x, 0, -z, x, 0, -z, x, 0, z, -x, 0, z]);
  return {
    positions,
    normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
    grainPositions: positions.slice(),
    surfaceClasses: new Float32Array([SURFACE_CODE.solid, SURFACE_CODE.solid, SURFACE_CODE.solid, SURFACE_CODE.solid]),
    indices: new Uint16Array([0, 2, 1, 0, 3, 2]),
    bounds: { width, depth },
    metadata: { type: 'plane' }
  };
}

function createDiscGeometry(radius = 1, segments = 48) {
  const target = { positions: [0, 0, 0], normals: [0, 1, 0], grainPositions: [0, 0, 0], surfaceClasses: [SURFACE_CODE.solid], indices: [] };
  for (let i = 0; i <= segments; i += 1) {
    const t = (i / segments) * Math.PI * 2;
    const x = Math.cos(t) * radius;
    const z = Math.sin(t) * radius;
    target.positions.push(x, 0, z);
    target.normals.push(0, 1, 0);
    target.grainPositions.push(x, 0, z);
    target.surfaceClasses.push(SURFACE_CODE.solid);
  }
  for (let i = 0; i < segments; i += 1) target.indices.push(0, i + 2, i + 1);
  return result(target, { radius, segments }, { type: 'disc' });
}

function countSurfaceClass(geometry, surfaceClass) {
  let count = 0;
  for (const value of geometry.surfaceClasses ?? []) {
    if (Math.abs(value - surfaceClass) < 0.001) count += 1;
  }
  return count;
}


const BUILDING_ID = 'KM-YUNNAN-TIMBER-VALIDATION-1944';
const FLOOR_ID = 'validation-floor';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function materialFor(sourceTimberId, memberId, generationSeed, preset, overrides = {}) {
  const seed = sourceTimberSeed({
    buildingId: BUILDING_ID,
    generationSeed,
    floorId: FLOOR_ID,
    sourceTimberId,
    materialRevision: 'grain-v003'
  });
  const finishSeed = memberFinishSeed({
    buildingId: BUILDING_ID,
    generationSeed,
    floorId: FLOOR_ID,
    sourceTimberId,
    memberId,
    materialRevision: 'grain-v003'
  });
  const parameters = deriveMemberParameters(seed, finishSeed);
  const roughnessCenter = (preset.surface.roughnessMin + preset.surface.roughnessMax) * 0.5;
  return {
    kind: 'wood',
    sourceId: sourceTimberId,
    sourceTimberId,
    memberId,
    seed,
    finishSeed,
    seedHex: seed.toString(16).padStart(8, '0'),
    finishSeedHex: finishSeed.toString(16).padStart(8, '0'),
    seed01: seed / 0xffffffff,
    ringScale: parameters.ringScale,
    warpScale: parameters.warpScale,
    colorBias: parameters.colorBias,
    contrastBias: parameters.contrastBias,
    detailScale: parameters.detailScale,
    fiberScale: parameters.fiberScale,
    reliefBias: parameters.reliefBias,
    reliefScale: parameters.reliefScale,
    roughness: clamp(
      roughnessCenter + parameters.roughnessBias,
      preset.surface.roughnessMin,
      preset.surface.roughnessMax
    ),
    angleOffset: parameters.angleOffset,
    knotPhase: parameters.knotPhase,
    crackPhase: parameters.crackPhase,
    toolPhase: parameters.toolPhase,
    pithOffset: parameters.pithOffset ?? [(random() - 0.5) * 0.10, (random() - 0.5) * 0.10],
    ...overrides
  };
}

function meshOrigin(model) {
  return [model?.[12] ?? 0, model?.[13] ?? 0, model?.[14] ?? 0];
}

function distance3(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function resolveReliefPolicy({ preset, settings = {}, geometry, cameraPosition, model }) {
  const relief = preset.relief;
  const controls = preset.controls;
  const distance = distance3(cameraPosition, meshOrigin(model));
  let mode = settings.reliefMode ?? 'auto';
  if (mode === 'auto') {
    if (distance <= relief.autoInspectionDistanceM) mode = 'inspection';
    else if (distance <= relief.autoCloseDistanceM) mode = 'close';
    else mode = 'building';
  }

  const quality = mode === 'inspection' ? 3 : mode === 'close' ? 2 : 1;
  const supportsMacro = Boolean(
    geometry?.metadata?.supportsMacroDisplacement ||
    (geometry?.metadata?.type === 'cylinder-member' && (geometry?.bounds?.axialSegments ?? 1) > 1)
  );
  const reliefScale = clamp(
    (controls.reliefScale ?? 1) * (settings.reliefStrength ?? 1),
    0,
    1.6
  );
  const parallaxStrength = clamp(settings.parallaxStrength ?? 1, 0, 1.5);
  const macroMm = mode === 'inspection' && supportsMacro
    ? clamp(relief.macroDisplacementMm, 0, relief.maxMacroDisplacementMm)
    : 0;
  const parallaxMm = quality >= 2
    ? clamp(relief.parallaxMm * parallaxStrength, 0, relief.maxParallaxMm)
    : 0;
  const microMm = clamp(relief.microReliefMm, 0, relief.maxMicroReliefMm);
  const parallaxSteps = mode === 'inspection'
    ? relief.parallaxStepsInspection
    : mode === 'close'
      ? relief.parallaxStepsClose
      : 0;

  return Object.freeze({
    mode,
    distance,
    quality,
    parallaxSteps,
    macroM: macroMm / 1000,
    parallaxM: parallaxMm / 1000,
    microM: microMm / 1000,
    reliefScale,
    textureScale: controls.textureScale ?? 1,
    grainContrast: clamp((controls.grainContrast ?? 0.17) * (settings.textureContrast ?? 1), 0.04, 0.36),
    detailFineness: clamp((controls.detailFineness ?? 1) * (settings.fineness ?? 1), 0.45, 1.65)
  });
}

function set1f(gl, location, value) {
  if (location !== null && location !== undefined) gl.uniform1f(location, value);
}

function set1i(gl, location, value) {
  if (location !== null && location !== undefined) gl.uniform1i(location, value);
}

function set2fv(gl, location, value) {
  if (location !== null && location !== undefined) gl.uniform2fv(location, value);
}

function set3fv(gl, location, value) {
  if (location !== null && location !== undefined) gl.uniform3fv(location, value);
}

function normalizedColor(value, fallback = [0.25, 0.25, 0.25]) {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) return value;
  return fallback;
}

function bindOriginalTimberUniforms(gl, uniforms, mesh, frame) {
 function bind() {
    const material = mesh.material ?? {};
    const preset = frame.preset;
    const settings = frame.settings ?? {};
    const isWood = mesh.kind === 'wood' || material.kind === 'wood';
    const alpha = material.alpha ?? material.opacity ?? 1;
    const shadowDisc = mesh.kind === 'shadow' || material.shadowDisc ? 1 : 0;
    const model = mesh.model ?? mat4Identity();
    const policy = resolveReliefPolicy({
      preset,
      settings,
      geometry: mesh.geometry,
      cameraPosition: frame.cameraPosition,
      model
    });

    gl.uniformMatrix4fv(this.uniforms.u_model, false, model);
    gl.uniformMatrix4fv(this.uniforms.u_view, false, frame.view);
    gl.uniformMatrix4fv(this.uniforms.u_projection, false, frame.projection);
    set3fv(gl, this.uniforms.u_cameraPosition, frame.cameraPosition);
    let cameraLocal = frame.cameraPosition;
    try {
      cameraLocal = transformPoint(mat4Inverse(model), frame.cameraPosition);
    } catch {
      cameraLocal = frame.cameraPosition;
    }
    set3fv(gl, this.uniforms.u_cameraLocalPosition, cameraLocal);
    const grainOffset = mesh.geometry?.metadata?.grainOffset ?? material.grainOffset ?? [0, 0, 0];
    const cameraGrain = [
      cameraLocal[0] + (grainOffset[0] ?? 0),
      cameraLocal[1] + (grainOffset[1] ?? 0),
      cameraLocal[2] + (grainOffset[2] ?? 0)
    ];
    set3fv(gl, this.uniforms.u_cameraGrainPosition, cameraGrain);
    set3fv(gl, this.uniforms.u_lightDirection, frame.lightDirection ?? [-0.48, 0.86, 0.27]);
    set3fv(gl, this.uniforms.u_lightColor, frame.lightColor ?? [1.0, 0.91, 0.78]);
    set3fv(gl, this.uniforms.u_skyColor, frame.skyColor ?? [0.34, 0.39, 0.36]);
    set3fv(gl, this.uniforms.u_groundColor, frame.groundColor ?? [0.12, 0.105, 0.09]);

    set1f(gl, this.uniforms.u_seed, material.seed01 ?? 0.5);
    set1f(gl, this.uniforms.u_ringFrequency, preset.grain.ringFrequency);
    set1f(gl, this.uniforms.u_ringScale, material.ringScale ?? 1);
    set1f(gl, this.uniforms.u_ringWarp, preset.grain.ringWarp * (material.warpScale ?? 1));
    set1f(gl, this.uniforms.u_fiberFrequency, preset.grain.fiberFrequency * (material.fiberScale ?? 1));
    set1f(gl, this.uniforms.u_fineFiberFrequency, preset.grain.fineFiberFrequency);
    set1f(gl, this.uniforms.u_poreFrequency, preset.grain.poreFrequency);
    set1f(gl, this.uniforms.u_fiberStrength, preset.grain.fiberStrength);
    set1f(gl, this.uniforms.u_colorBias, material.colorBias ?? 0);
    set1f(gl, this.uniforms.u_roughness, material.roughness ?? 0.84);
    set1f(gl, this.uniforms.u_angleOffset, material.angleOffset ?? 0);
    set2fv(gl, this.uniforms.u_pithOffset, material.pithOffset ?? [0, 0]);
    set1f(gl, this.uniforms.u_textureScale, policy.textureScale);
    set1f(gl, this.uniforms.u_grainContrast, clamp(policy.grainContrast + (material.contrastBias ?? 0) * 0.10, 0.04, 0.38));
    set1f(gl, this.uniforms.u_detailFineness, clamp(policy.detailFineness * (material.detailScale ?? 1), 0.45, 1.75));
    set1f(gl, this.uniforms.u_macroDisplacementM, isWood ? policy.macroM : 0);
    set1f(gl, this.uniforms.u_microReliefM, isWood ? policy.microM : 0);
    set1f(gl, this.uniforms.u_parallaxM, isWood ? policy.parallaxM : 0);
    set1f(gl, this.uniforms.u_reliefScale, (material.reliefScale ?? material.reliefBias ?? 1) * policy.reliefScale);
    const geometryType = mesh.geometry?.metadata?.type ?? '';
    const inferredRound = geometryType === 'cylinder-member';
    set1f(gl, this.uniforms.u_shapeMode, material.shapeMode === 'round' || material.shapeMode === 1 || inferredRound ? 1 : 0);
    set1f(gl, this.uniforms.u_memberRadius, material.memberRadius ?? mesh.geometry?.bounds?.radius ?? 0.35);
    set1f(gl, this.uniforms.u_roundGrainFlip, Number(material.roundGrainFlip ?? 1) < 0 ? -1 : 1);
    set1f(gl, this.uniforms.u_reliefQuality, isWood ? policy.quality : 0);
    set1f(gl, this.uniforms.u_parallaxSteps, isWood ? policy.parallaxSteps : 0);
    set1f(gl, this.uniforms.u_clearcoat, preset.surface.clearcoat ?? 0);
    set1f(gl, this.uniforms.u_clearcoatRoughness, preset.surface.clearcoatRoughness ?? 1);
    set1f(gl, this.uniforms.u_specularLevel, preset.surface.specular ?? 0.18);
    set1f(gl, this.uniforms.u_distanceFadeStart, preset.relief.distanceFadeStartM ?? 7);
    set1f(gl, this.uniforms.u_distanceFadeEnd, preset.relief.distanceFadeEndM ?? 22);
    set1f(gl, this.uniforms.u_toolPhase, material.toolPhase ?? 0);
    set1f(gl, this.uniforms.u_crackPhase, material.crackPhase ?? 0);
    set1f(gl, this.uniforms.u_knotPhase, material.knotPhase ?? 0);

    set3fv(gl, this.uniforms.u_darkGrainColor, hexToLinearRgb01(preset.colors.darkGrain));
    set3fv(gl, this.uniforms.u_lightGrainColor, hexToLinearRgb01(preset.colors.lightGrain));
    set3fv(gl, this.uniforms.u_agedSurfaceColor, hexToLinearRgb01(preset.colors.agedSurface));
    set3fv(gl, this.uniforms.u_weatheredColor, hexToLinearRgb01(preset.colors.weatheredSurface));
    set3fv(gl, this.uniforms.u_freshCutColor, hexToLinearRgb01(preset.colors.freshCut));
    set3fv(gl, this.uniforms.u_cavityColor, hexToLinearRgb01(preset.colors.cavity));
    set3fv(gl, this.uniforms.u_solidColor, normalizedColor(material.color));
    set1f(gl, this.uniforms.u_isWood, isWood ? 1 : 0);
    set1f(gl, this.uniforms.u_alpha, alpha);
    set1f(gl, this.uniforms.u_shadowDisc, shadowDisc);
    const selected = mesh.id === frame.selectedId || mesh.groupId === frame.selectedGroup;
    set1f(gl, this.uniforms.u_selected, selected ? 1 : 0);
    set1i(gl, this.uniforms.u_debugMode, isWood ? (frame.debugMode ?? 0) : 0);


 }
 return bind.call({uniforms});
}

export {mat4Identity,bindOriginalTimberUniforms,vertexShaderSource,fragmentShaderSource,getYunnanTimberPreset,YUNNAN_TIMBER_PRESETS,hexToLinearRgb01,createBoxGeometry,createSubdividedBoxGeometry,createHewnBoxGeometry,createMortisedPostGeometry,createTenonedBeamGeometry,createCylinderGeometry,sourceTimberSeed,memberFinishSeed,deriveMemberParameters,materialFor,resolveReliefPolicy,SURFACE_CODE,continuityError,mat4Inverse,transformPoint};
