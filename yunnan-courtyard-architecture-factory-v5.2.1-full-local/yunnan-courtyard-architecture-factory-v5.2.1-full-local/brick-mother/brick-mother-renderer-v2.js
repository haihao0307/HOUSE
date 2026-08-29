(() => {
'use strict';

const { clamp, vec3, norm3, sub3, cross3, dot3 } = window.BrickMotherGeometryV2;
const gaeaGLSL = window.BrickMotherGaeaV1?.glsl || '';

function mat4Identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function mat4Multiply(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

function mat4Perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0
  ]);
}

function mat4LookAt(eye, target, up) {
  const z = norm3(sub3(eye, target));
  const x = norm3(cross3(up, z));
  const y = cross3(z, x);
  return new Float32Array([
    x.x, y.x, z.x, 0,
    x.y, y.y, z.y, 0,
    x.z, y.z, z.z, 0,
    -dot3(x, eye), -dot3(y, eye), -dot3(z, eye), 1
  ]);
}

function mat4Model(position, yaw = 0) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return new Float32Array([
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    position.x, position.y, position.z, 1
  ]);
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || 'Shader compile failed';
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function createProgram(gl, vsSource, fsSource) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) || 'Shader link failed';
    gl.deleteProgram(program);
    throw new Error(log);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

const vertexShader = `#version 300 es
precision highp float;
in vec3 aPosition;
in vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uViewProj;
out vec3 vWorldPos;
out vec3 vLocalPos;
out vec3 vNormal;
void main() {
  vec4 wp = uModel * vec4(aPosition, 1.0);
  vWorldPos = wp.xyz;
  vLocalPos = aPosition;
  vNormal = normalize(mat3(uModel) * aNormal);
  gl_Position = uViewProj * wp;
}`;

const fragmentShader = `#version 300 es
precision highp float;
${gaeaGLSL}

in vec3 vWorldPos;
in vec3 vLocalPos;
in vec3 vNormal;
out vec4 outColor;

uniform vec3 uCamera;
uniform vec3 uLowColor;
uniform vec3 uMeanColor;
uniform vec3 uHighColor;
uniform vec3 uPaletteDark;
uniform vec3 uPaletteWarm;
uniform vec3 uPaletteOxide;
uniform vec3 uPaletteMineral;
uniform vec3 uPaletteBio;
uniform vec3 uPaletteWet;
uniform vec3 uPaletteStraw;
uniform vec3 uPaletteHusk;
uniform vec3 uPaletteSeedColor;
uniform vec2 uRoughness;
uniform vec3 uDimensions;
uniform float uWarpStrength;
uniform float uMacroScale;
uniform float uRidgedScale;
uniform float uCellScale;
uniform float uPoreThreshold;
uniform float uPoreSharpness;
uniform float uMicroScale;
uniform float uColorContrast;
uniform float uCavityStrength;
uniform float uBumpStrength;
uniform float uRoughnessCorrelation;
uniform float uMineralScale;
uniform float uFiringBand;
uniform float uColorRichness;
uniform float uWaterStrength;
uniform float uWeatherStrength;
uniform float uInclusionStrength;
uniform float uPoreDepth;
uniform float uColorSeed;
uniform float uPoreSeed;
uniform float uWaterSeed;
uniform float uWeatherSeed;
uniform float uInclusionSeed;
uniform float uDetailSeed;
uniform float uGaeaRockDetail;
uniform float uGaeaStrata;
uniform float uGaeaMicroErosion;
uniform float uGaeaColorClarity;
uniform float uGaeaColorGamut;
uniform float uGaeaMaskSharpness;
uniform float uGaeaRuggedScale;
uniform float uGaeaStrataFrequency;
uniform float uGaeaSurfaceScale;
uniform int uFamily;
uniform int uDebugMode;
uniform int uGround;
uniform vec3 uShadowPos0;
uniform vec3 uShadowPos1;
uniform vec3 uShadowPos2;
uniform vec2 uShadowSize0;
uniform vec2 uShadowSize1;
uniform vec2 uShadowSize2;

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

vec3 hash33(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6))
  );
  return fract(sin(p) * 43758.5453123);
}

mat2 rotate2(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

float valueNoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = hash31(i + vec3(0, 0, 0));
  float n100 = hash31(i + vec3(1, 0, 0));
  float n010 = hash31(i + vec3(0, 1, 0));
  float n110 = hash31(i + vec3(1, 1, 0));
  float n001 = hash31(i + vec3(0, 0, 1));
  float n101 = hash31(i + vec3(1, 0, 1));
  float n011 = hash31(i + vec3(0, 1, 1));
  float n111 = hash31(i + vec3(1, 1, 1));
  return mix(
    mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
    mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
    f.z
  );
}

float gradientNoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(normalize(hash33(i + vec3(0, 0, 0)) * 2.0 - 1.0), f - vec3(0, 0, 0));
  float n100 = dot(normalize(hash33(i + vec3(1, 0, 0)) * 2.0 - 1.0), f - vec3(1, 0, 0));
  float n010 = dot(normalize(hash33(i + vec3(0, 1, 0)) * 2.0 - 1.0), f - vec3(0, 1, 0));
  float n110 = dot(normalize(hash33(i + vec3(1, 1, 0)) * 2.0 - 1.0), f - vec3(1, 1, 0));
  float n001 = dot(normalize(hash33(i + vec3(0, 0, 1)) * 2.0 - 1.0), f - vec3(0, 0, 1));
  float n101 = dot(normalize(hash33(i + vec3(1, 0, 1)) * 2.0 - 1.0), f - vec3(1, 0, 1));
  float n011 = dot(normalize(hash33(i + vec3(0, 1, 1)) * 2.0 - 1.0), f - vec3(0, 1, 1));
  float n111 = dot(normalize(hash33(i + vec3(1, 1, 1)) * 2.0 - 1.0), f - vec3(1, 1, 1));
  float n = mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z
  );
  return n * 0.5 + 0.5;
}

float fbmGradient(vec3 p) {
  float v = 0.0;
  float a = 0.52;
  float total = 0.0;
  for (int i = 0; i < 5; i++) {
    v += gradientNoise3(p) * a;
    total += a;
    p = p * 2.03 + vec3(19.1, 7.7, 13.4);
    a *= 0.49;
  }
  return v / total;
}

float ridgedFbm(vec3 p) {
  float v = 0.0;
  float a = 0.56;
  float total = 0.0;
  for (int i = 0; i < 5; i++) {
    float n = 1.0 - abs(gradientNoise3(p) * 2.0 - 1.0);
    v += n * n * a;
    total += a;
    p = p * 2.11 + vec3(11.7, 5.3, 17.9);
    a *= 0.47;
  }
  return v / total;
}

float fbmValueFast(vec3 p) {
  float v = 0.0;
  float a = 0.54;
  float total = 0.0;
  for (int i = 0; i < 4; i++) {
    v += valueNoise3(p) * a;
    total += a;
    p = p * 2.05 + vec3(7.3, 15.1, 3.9);
    a *= 0.48;
  }
  return v / total;
}

float turbulence(vec3 p) {
  float v = 0.0;
  float a = 0.54;
  float total = 0.0;
  for (int i = 0; i < 4; i++) {
    v += abs(valueNoise3(p) * 2.0 - 1.0) * a;
    total += a;
    p = p * 2.07 + vec3(3.7, 17.2, 9.1);
    a *= 0.5;
  }
  return v / total;
}

vec2 worley3(vec3 p) {
  vec3 ip = floor(p);
  vec3 fp = fract(p);
  float f1 = 10.0;
  float f2 = 10.0;
  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 cell = vec3(float(x), float(y), float(z));
        vec3 point = hash33(ip + cell);
        vec3 d = cell + point - fp;
        float dist2 = dot(d, d);
        if (dist2 < f1) {
          f2 = f1;
          f1 = dist2;
        } else if (dist2 < f2) {
          f2 = dist2;
        }
      }
    }
  }
  return sqrt(vec2(f1, f2));
}

vec3 domainWarp(vec3 p) {
  return vec3(
    fbmValueFast(p + vec3(17.1, 3.8, 9.2)),
    fbmValueFast(p + vec3(4.4, 19.7, 12.1)),
    fbmValueFast(p + vec3(13.8, 7.2, 23.4))
  ) - 0.5;
}

vec3 seedVector(float s, float multiplier) {
  return vec3(s * 0.0113, s * 0.0197, s * 0.0311) * multiplier;
}

vec2 surfaceProjection(vec3 p, vec3 n) {
  vec3 a = abs(n);
  if (a.x > a.y && a.x > a.z) return p.zy;
  if (a.y > a.z) return p.xz;
  return p.xy;
}

vec4 organicInclusions(vec2 uv, float seed) {
  vec2 g0 = uv * 8.5;
  vec2 id0 = floor(g0);
  vec2 f0 = fract(g0) - 0.5;
  vec2 r0 = hash22(id0 + seed * 0.013);
  vec2 q0 = rotate2((r0.x - 0.5) * 3.14159265) * (f0 - (r0 - 0.5) * 0.42);
  float gate0 = smoothstep(0.50, 0.82, hash31(vec3(id0, seed * 0.017)));
  float strawLong = (1.0 - smoothstep(0.030, 0.070, abs(q0.y))) *
                    (1.0 - smoothstep(0.30, 0.46, abs(q0.x))) * gate0;

  vec2 g1 = uv * 15.0 + vec2(3.7, 9.1);
  vec2 id1 = floor(g1);
  vec2 f1 = fract(g1) - 0.5;
  vec2 r1 = hash22(id1 + seed * 0.023 + 17.0);
  vec2 q1 = rotate2(r1.y * 6.2831853) * (f1 - (r1 - 0.5) * 0.34);
  float gate1 = smoothstep(0.61, 0.88, hash31(vec3(id1, seed * 0.029 + 11.0)));
  float strawShort = (1.0 - smoothstep(0.035, 0.085, abs(q1.y))) *
                     (1.0 - smoothstep(0.17, 0.30, abs(q1.x))) * gate1;

  vec2 g2 = uv * 19.0 + vec2(11.0, 2.0);
  vec2 id2 = floor(g2);
  vec2 f2 = fract(g2) - 0.5;
  vec2 r2 = hash22(id2 + seed * 0.031 + 29.0);
  vec2 q2 = rotate2((r2.x - 0.5) * 2.2) * (f2 - (r2 - 0.5) * 0.26);
  float ellipseH = length(q2 / vec2(0.30, 0.115));
  float husk = (1.0 - smoothstep(0.08, 0.20, abs(ellipseH - 1.0))) *
               smoothstep(0.68, 0.91, hash31(vec3(id2, seed * 0.037 + 7.0)));

  vec2 g3 = uv * 23.0 + vec2(5.0, 13.0);
  vec2 id3 = floor(g3);
  vec2 f3 = fract(g3) - 0.5;
  vec2 r3 = hash22(id3 + seed * 0.041 + 43.0);
  vec2 q3 = rotate2(r3.y * 6.2831853) * (f3 - (r3 - 0.5) * 0.20);
  float seedEllipse = length(q3 / vec2(0.20, 0.115));
  float seedMask = (1.0 - smoothstep(0.82, 1.15, seedEllipse)) *
                   smoothstep(0.76, 0.94, hash31(vec3(id3, seed * 0.047 + 31.0)));

  vec2 g4 = uv * 28.0 + vec2(17.0, 3.0);
  vec2 id4 = floor(g4);
  vec2 f4 = fract(g4) - 0.5;
  vec2 r4 = hash22(id4 + seed * 0.051 + 59.0);
  float pit = (1.0 - smoothstep(0.08, 0.18, length(f4 - (r4 - 0.5) * 0.34))) *
              smoothstep(0.82, 0.97, hash31(vec3(id4, seed * 0.057 + 47.0)));

  return vec4(max(strawLong, strawShort), husk, seedMask, pit);
}

vec2 waterWeatherMasks(vec3 p, vec3 n, float waterSeed, float weatherSeed) {
  vec3 an = abs(n);
  float horizontal = an.x > an.z ? p.z : p.x;
  float yNorm = clamp(vLocalPos.y / max(uDimensions.y, 0.001) + 0.5, 0.0, 1.0);

  float columnScale = 5.4;
  float column = horizontal * columnScale + waterSeed * 0.0031;
  float columnId = floor(column);
  float local = fract(column) - 0.5;
  float jitter = (hash31(vec3(columnId, waterSeed * 0.013, 7.0)) - 0.5) * 0.56;
  float width = mix(0.045, 0.16, hash31(vec3(columnId, waterSeed * 0.019, 13.0)));
  float line = 1.0 - smoothstep(width, width + 0.055, abs(local - jitter));
  float start = mix(0.52, 1.02, hash31(vec3(columnId, waterSeed * 0.023, 19.0)));
  float lengthV = mix(0.16, 0.78, hash31(vec3(columnId, waterSeed * 0.029, 23.0)));
  float verticalGate = smoothstep(start - lengthV - 0.05, start - lengthV + 0.055, yNorm) *
                       (1.0 - smoothstep(start - 0.025, start + 0.045, yNorm));
  float streakGate = smoothstep(0.48, 0.86, hash31(vec3(columnId, waterSeed * 0.037, 31.0)));
  float streak = line * verticalGate * streakGate;

  vec3 waterCoord = vec3(horizontal * 1.75, yNorm * 3.0, waterSeed * 0.009);
  float broad = smoothstep(0.54, 0.82, fbmValueFast(waterCoord + domainWarp(waterCoord * 0.7) * 0.45));
  float lowerDamp = (1.0 - smoothstep(0.06, 0.34, yNorm)) *
                    smoothstep(0.35, 0.78, fbmValueFast(vec3(p.x * 1.3, p.z * 1.3, waterSeed * 0.011)));
  float waterMask = clamp(streak * 0.92 + broad * verticalGate * 0.32 + lowerDamp * 0.58, 0.0, 1.0);

  vec3 edgeCoord = abs(vLocalPos) / max(uDimensions * 0.5, vec3(0.001));
  float edgeCount = smoothstep(0.72, 0.99, edgeCoord.x) +
                    smoothstep(0.72, 0.99, edgeCoord.y) +
                    smoothstep(0.72, 0.99, edgeCoord.z);
  float edgeMask = smoothstep(1.08, 1.88, edgeCount);
  float topExposure = smoothstep(0.05, 0.72, n.y) * smoothstep(0.35, 0.98, yNorm);
  float weatherNoise = fbmGradient(p * 1.82 + seedVector(weatherSeed, 0.74));
  float weatherFine = ridgedFbm(p * 7.1 + seedVector(weatherSeed, 1.31));
  float weatherMask = clamp((edgeMask * 0.72 + topExposure * 0.55) * smoothstep(0.30, 0.84, weatherNoise) +
                            smoothstep(0.76, 0.96, weatherFine) * 0.18, 0.0, 1.0);
  return vec2(waterMask, weatherMask);
}

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

vec3 adjustSaturation(vec3 c, float saturation) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(l), c, saturation);
}

float shadowBlob(vec3 p, vec3 c, vec2 s) {
  vec2 q = (p.xz - c.xz) / max(s, vec2(0.01));
  return exp(-dot(q, q) * 2.65);
}

float D_GGX(float NoH, float a) {
  float a2 = a * a;
  float d = NoH * NoH * (a2 - 1.0) + 1.0;
  return a2 / (3.14159265 * d * d + 0.00001);
}

float G_Schlick(float NoV, float k) {
  return NoV / (NoV * (1.0 - k) + k + 0.00001);
}

vec3 F_Schlick(float VoH, vec3 F0) {
  return F0 + (1.0 - F0) * pow(1.0 - VoH, 5.0);
}

vec3 shadeLight(vec3 N, vec3 V, vec3 L, vec3 lightColor, float intensity, vec3 albedo, float rough) {
  vec3 H = normalize(V + L);
  float NoL = max(dot(N, L), 0.0);
  float NoV = max(dot(N, V), 0.001);
  float NoH = max(dot(N, H), 0.0);
  float VoH = max(dot(V, H), 0.0);
  float a = max(0.05, rough * rough);
  float k = (rough + 1.0) * (rough + 1.0) / 8.0;
  vec3 F = F_Schlick(VoH, vec3(0.035));
  float D = D_GGX(NoH, a);
  float G = G_Schlick(NoV, k) * G_Schlick(NoL, k);
  vec3 spec = (D * G * F) / (4.0 * NoV * max(NoL, 0.001) + 0.0001);
  vec3 kd = 1.0 - F;
  return (kd * albedo / 3.14159265 + spec) * NoL * lightColor * intensity;
}

void main() {
  if (uGround == 1) {
    vec3 c = vec3(0.126, 0.132, 0.124);
    float grain = valueNoise3(vWorldPos * 3.2 + uColorSeed) * 0.025 - 0.012;
    float sh = clamp(
      shadowBlob(vWorldPos, uShadowPos0, uShadowSize0) +
      shadowBlob(vWorldPos, uShadowPos1, uShadowSize1) +
      shadowBlob(vWorldPos, uShadowPos2, uShadowSize2),
      0.0, 1.0
    );
    c = (c + grain) * (1.0 - 0.34 * sh);
    float gx = abs(fract(vWorldPos.x * 0.5) - 0.5);
    float gz = abs(fract(vWorldPos.z * 0.5) - 0.5);
    float grid = min(gx, gz);
    c += (1.0 - smoothstep(0.0, 0.028, grid)) * 0.014;
    outColor = vec4(linearToSrgb(c), 1.0);
    return;
  }

  float minD = max(0.0001, min(uDimensions.x, min(uDimensions.y, uDimensions.z)));
  vec3 p = vLocalPos / minD;
  vec3 colorSeedV = seedVector(uColorSeed, 1.0);
  vec3 poreSeedV = seedVector(uPoreSeed, 1.0);
  vec3 detailSeedV = seedVector(uDetailSeed, 1.0);
  vec3 warped = p + domainWarp(p * uMacroScale * 0.72 + detailSeedV) * uWarpStrength;
  vec3 colorWarped = p + domainWarp(p * uMacroScale * 0.58 + colorSeedV) * (uWarpStrength * 1.22);
  vec3 poreWarped = p + domainWarp(p * uCellScale * 0.10 + poreSeedV) * (uWarpStrength * 0.72);

  float macro = fbmGradient(colorWarped * uMacroScale + colorSeedV * 0.31);
  float macroB = fbmValueFast(colorWarped * uMacroScale * 0.63 + colorSeedV * 1.27);
  float ridge = ridgedFbm(warped * uRidgedScale + detailSeedV * 0.57);
  float turbul = turbulence(warped * uRidgedScale * 0.68 + detailSeedV * 0.91);
  float micro = gradientNoise3(warped * uMicroScale + detailSeedV * 1.7);
  float grit = valueNoise3(warped * uMicroScale * 2.35 + detailSeedV * 3.1);

  vec2 cell = worley3(poreWarped * uCellScale + poreSeedV * 0.27);
  float poreAA = max(fwidth(cell.x) * 1.4, 0.003);
  float poreCore = 1.0 - smoothstep(
    uPoreThreshold - poreAA,
    uPoreThreshold + uPoreSharpness + poreAA,
    cell.x
  );
  float poreGate = smoothstep(0.53, 0.87, valueNoise3(poreWarped * uCellScale * 0.31 + poreSeedV * 4.3));
  float pore = poreCore * poreGate;

  vec2 mineralCell = worley3(warped * uMineralScale + colorSeedV * 1.17);
  float microPore = (1.0 - smoothstep(0.052, 0.125 + fwidth(mineralCell.x), mineralCell.x)) *
                    smoothstep(0.72, 0.94, valueNoise3(warped * uMicroScale * 0.19 + poreSeedV * 6.7));
  float mineralCore = 1.0 - smoothstep(0.055, 0.145 + fwidth(mineralCell.x), mineralCell.x);
  float mineralGate = smoothstep(0.57, 0.90, valueNoise3(warped * uMineralScale * 0.37 + colorSeedV * 2.9));
  float mineral = mineralCore * mineralGate;
  float cellularEdge = 1.0 - smoothstep(0.018, 0.105 + fwidth(mineralCell.y - mineralCell.x), mineralCell.y - mineralCell.x);

  vec3 baseNormal = normalize(vNormal);
  BMGaeaFields gaea = bmGaeaEvaluate(
    p,
    baseNormal,
    seedVector(uDetailSeed + uColorSeed * 0.37, 0.91),
    uGaeaRuggedScale,
    uGaeaStrataFrequency,
    uGaeaSurfaceScale,
    uGaeaMaskSharpness
  );
  vec2 projected = surfaceProjection(p, baseNormal);
  vec4 inclusions = organicInclusions(projected, uInclusionSeed);
  inclusions *= float(uFamily == 1) * uInclusionStrength;

  float cavity = clamp(
    pore * (0.74 + uPoreDepth * 0.22) +
    microPore * 0.42 +
    smoothstep(0.77, 0.98, turbul) * 0.16 +
    smoothstep(0.84, 0.99, 1.0 - ridge) * 0.10 +
    inclusions.w * 0.52,
    0.0, 1.0
  );

  cavity = clamp(
    cavity +
    gaea.cavity * (0.14 + uGaeaRockDetail * 0.24) +
    gaea.microErosion * uGaeaMicroErosion * 0.11,
    0.0, 1.0
  );

  float tone = clamp(0.06 + macro * 0.55 + macroB * 0.17 + ridge * 0.16 + (micro - 0.5) * 0.23 + (grit - 0.5) * 0.09, 0.0, 1.0);
  tone = clamp((tone - 0.5) * uColorContrast + 0.5, 0.0, 1.0);

  vec3 low = srgbToLinear(uLowColor);
  vec3 mean = srgbToLinear(uMeanColor);
  vec3 high = srgbToLinear(uHighColor);
  vec3 dark = srgbToLinear(uPaletteDark);
  vec3 warm = srgbToLinear(uPaletteWarm);
  vec3 oxideColor = srgbToLinear(uPaletteOxide);
  vec3 mineralColor = srgbToLinear(uPaletteMineral);
  vec3 bioColor = srgbToLinear(uPaletteBio);
  vec3 wetColor = srgbToLinear(uPaletteWet);
  vec3 strawColor = srgbToLinear(uPaletteStraw);
  vec3 huskColor = srgbToLinear(uPaletteHusk);
  vec3 seedColor = srgbToLinear(uPaletteSeedColor);

  vec3 albedo = mix(low, mean, smoothstep(0.06, 0.50, tone));
  albedo = mix(albedo, high, smoothstep(0.49, 0.90, tone));

  float rich = clamp(uColorRichness, 0.0, 2.0);
  float warmMask = smoothstep(0.52, 0.84, macro) * smoothstep(0.34, 0.82, ridge);
  float oxideMask = smoothstep(0.68, 0.92, ridgedFbm(colorWarped * 9.3 + colorSeedV * 2.2)) *
                    smoothstep(0.45, 0.86, macroB);
  float darkAggregate = smoothstep(0.80, 0.96, valueNoise3(colorWarped * 18.0 + colorSeedV * 4.7));
  float paleAggregate = mineral * smoothstep(0.34, 0.84, macro);
  float bioMask = smoothstep(0.67, 0.91, fbmValueFast(colorWarped * 3.1 + seedVector(uWeatherSeed, 0.73))) *
                  smoothstep(-0.2, 0.58, 0.4 - baseNormal.y);

  float gaeaColorDriver = bmClarity(
    bmAutoLevel(
      macro * 0.30 + ridge * 0.16 + gaea.rugged * 0.22 + gaea.strata * 0.16 + gaea.flow * 0.16,
      0.14, 0.88
    ),
    uGaeaColorClarity
  );
  vec3 gaeaClut = bmClut5(gaeaColorDriver, dark, wetColor, mean, warm, mineralColor);
  vec4 gaeaWeights = bmSplatWeights(
    darkAggregate + gaea.cavity * 0.34,
    oxideMask + gaea.flow * 0.24,
    paleAggregate + gaea.strata * 0.34,
    gaea.rockMap + mineral * 0.22,
    uGaeaMaskSharpness
  );
  vec3 gaeaSplat =
    dark * gaeaWeights.x +
    oxideColor * gaeaWeights.y +
    mineralColor * gaeaWeights.z +
    warm * gaeaWeights.w;
  float gaeaColorBlend = clamp(
    uGaeaColorGamut * (0.16 + gaea.separation * 0.28),
    0.0, 0.74
  );
  albedo = mix(albedo, gaeaClut, gaeaColorBlend * 0.58);
  albedo = mix(albedo, gaeaSplat, gaeaColorBlend * 0.52);

  albedo = mix(albedo, warm, warmMask * 0.34 * rich);
  albedo = mix(albedo, oxideColor, oxideMask * (0.26 + 0.22 * rich));
  albedo = mix(albedo, mineralColor, paleAggregate * (0.34 + 0.16 * rich));
  albedo = mix(albedo, dark, darkAggregate * (0.18 + 0.12 * rich));
  albedo = mix(albedo, bioColor, bioMask * (0.08 + 0.14 * uWeatherStrength));

  float axisness = max(abs(baseNormal.x), max(abs(baseNormal.y), abs(baseNormal.z)));
  float brokenFace = smoothstep(0.12, 0.50, 1.0 - axisness);

  if (uFamily == 0) {
    float band = sin((colorWarped.x * 0.88 + colorWarped.z * 0.31) * 3.1 + macro * 3.4 + uColorSeed * 0.017) * 0.5 + 0.5;
    float kiln = smoothstep(0.22, 0.79, mix(band, macro, uFiringBand));
    albedo = mix(albedo * 0.88, albedo * 1.10, kiln * (0.42 + rich * 0.12));
    albedo = mix(albedo, oxideColor, oxideMask * 0.36 * rich);
    float soot = smoothstep(0.87, 0.985, valueNoise3(warped * 22.0 + colorSeedV * 5.1));
    albedo = mix(albedo, dark, soot * (0.16 + rich * 0.10));
  } else if (uFamily == 1) {
    float lump = smoothstep(0.55, 0.91, macro) * 0.28;
    albedo = mix(albedo, warm, lump * rich);
    albedo = mix(albedo, strawColor, inclusions.x * 0.86);
    albedo = mix(albedo, huskColor, inclusions.y * 0.82);
    albedo = mix(albedo, seedColor, inclusions.z * 0.88);
    albedo = mix(albedo, dark, inclusions.w * 0.78);
    cavity *= 1.06;
  } else {
    float vein = cellularEdge * smoothstep(0.34, 0.84, macro);
    albedo = mix(albedo, mineralColor, vein * (0.28 + rich * 0.16));
    albedo = mix(albedo, oxideColor, oxideMask * 0.23 * rich);
    float darkGrain = smoothstep(0.89, 0.985, grit);
    albedo = mix(albedo, dark, darkGrain * 0.42);
    albedo = mix(albedo, mineralColor, gaea.strata * 0.36 * uGaeaStrata);
    albedo = mix(albedo, dark, gaea.rockMap * 0.20 * uGaeaRockDetail);
    albedo = mix(albedo, oxideColor, gaea.flow * 0.14 * uGaeaColorGamut);
  }

  vec2 waterWeather = waterWeatherMasks(p, baseNormal, uWaterSeed, uWeatherSeed);
  float waterMask = waterWeather.x * uWaterStrength;
  float weatherMask = waterWeather.y * uWeatherStrength;
  float saltMask = smoothstep(0.42, 0.80, waterWeather.x) *
                   smoothstep(0.73, 0.94, ridgedFbm(p * 10.2 + seedVector(uWeatherSeed, 1.9))) *
                   uWeatherStrength;
  float sheltered = smoothstep(-0.08, 0.72, 0.38 - baseNormal.y);
  albedo = mix(albedo, wetColor, clamp(waterMask * 0.54, 0.0, 0.72));
  albedo = mix(albedo, mineralColor, clamp(weatherMask * (0.24 + max(baseNormal.y, 0.0) * 0.18) + saltMask * 0.44, 0.0, 0.62));
  albedo = mix(albedo, dark, clamp(weatherMask * sheltered * 0.16, 0.0, 0.30));

  albedo = mix(albedo, mineralColor * 0.92, brokenFace * (0.08 + weatherMask * 0.11));
  albedo *= 1.0 - cavity * (0.40 + 0.24 * uCavityStrength + 0.10 * uPoreDepth);
  albedo = adjustSaturation(albedo, 0.94 + rich * 0.24);
  albedo = clamp(albedo, vec3(0.004), vec3(1.0));

  float inclusionHeight = inclusions.x * 0.15 + inclusions.y * 0.11 + inclusions.z * 0.07 - inclusions.w * 0.28;
  float heightField =
    (macro - 0.5) * 0.16 +
    (ridge - 0.5) * 0.22 +
    (micro - 0.5) * 0.28 +
    (grit - 0.5) * 0.08 +
    mineral * 0.18 +
    weatherMask * 0.08 +
    inclusionHeight +
    (gaea.protrusion - 0.5) * 0.28 * uGaeaRockDetail +
    (gaea.strata - 0.5) * 0.22 * uGaeaStrata -
    gaea.microErosion * 0.24 * uGaeaMicroErosion -
    cavity * (0.62 + uPoreDepth * 0.14);

  vec3 N = baseNormal;
  vec3 dpdx = dFdx(vWorldPos);
  vec3 dpdy = dFdy(vWorldPos);
  float dhdx = dFdx(heightField);
  float dhdy = dFdy(heightField);
  vec3 R1 = cross(dpdy, N);
  vec3 R2 = cross(N, dpdx);
  float det = dot(dpdx, R1);
  vec3 surfGrad = sign(det) * (dhdx * R1 + dhdy * R2);
  N = normalize(abs(det) * N - surfGrad * uBumpStrength);

  float roughDriver = clamp(
    0.14 +
    micro * 0.40 +
    ridge * 0.15 +
    cavity * uRoughnessCorrelation +
    brokenFace * 0.18 +
    weatherMask * 0.18 +
    gaea.rockMap * 0.18 * uGaeaRockDetail +
    gaea.strata * 0.10 * uGaeaStrata +
    gaea.microErosion * 0.15 * uGaeaMicroErosion +
    inclusions.x * 0.12 + inclusions.y * 0.10 -
    mineral * 0.08 -
    waterMask * 0.16,
    0.0, 1.0
  );
  float rough = mix(uRoughness.x, uRoughness.y, roughDriver);

  if (uDebugMode == 1) {
    outColor = vec4(linearToSrgb(clamp(albedo, 0.0, 1.0)), 1.0);
    return;
  }
  if (uDebugMode == 2) {
    outColor = vec4(vec3(cavity), 1.0);
    return;
  }
  if (uDebugMode == 3) {
    outColor = vec4(vec3(rough), 1.0);
    return;
  }
  if (uDebugMode == 4) {
    outColor = vec4(N * 0.5 + 0.5, 1.0);
    return;
  }
  if (uDebugMode == 5) {
    outColor = vec4(vec3(macro, ridge, clamp(pore + mineral, 0.0, 1.0)), 1.0);
    return;
  }
  if (uDebugMode == 6) {
    outColor = vec4(clamp(vec3(waterWeather.x, waterWeather.y, saltMask), 0.0, 1.0), 1.0);
    return;
  }
  if (uDebugMode == 7) {
    outColor = vec4(clamp(vec3(inclusions.x, inclusions.y, inclusions.z + inclusions.w), 0.0, 1.0), 1.0);
    return;
  }
  if (uDebugMode == 8) {
    outColor = vec4(clamp(vec3(gaea.rugged, gaea.strata, max(gaea.rockMap, gaea.microErosion)), 0.0, 1.0), 1.0);
    return;
  }

  vec3 V = normalize(uCamera - vWorldPos);
  vec3 L1 = normalize(vec3(-0.44, 0.83, 0.36));
  vec3 L2 = normalize(vec3(0.62, 0.47, -0.63));
  vec3 L3 = normalize(vec3(-0.12, 0.28, -0.95));

  vec3 color = vec3(0.0);
  color += shadeLight(N, V, L1, vec3(1.0, 0.94, 0.84), 3.10, albedo, rough);
  color += shadeLight(N, V, L2, vec3(0.52, 0.64, 0.78), 0.66, albedo, rough);
  color += shadeLight(N, V, L3, vec3(0.72, 0.62, 0.54), 0.30, albedo, rough);

  float hemi = 0.38 + 0.18 * clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
  float ao = clamp(
    1.0 -
    cavity * (0.42 + uPoreDepth * 0.08) -
    smoothstep(0.82, 1.0, 1.0 - ridge) * 0.10 -
    gaea.cavity * uGaeaRockDetail * 0.10 -
    gaea.microErosion * uGaeaMicroErosion * 0.06,
    0.36, 1.0
  );
  color += albedo * hemi;
  color *= ao;

  color = 1.0 - exp(-color * 1.10);
  color = pow(max(color, 0.0), vec3(0.97));
  outColor = vec4(linearToSrgb(color), 1.0);
}`;

class BrickRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    if (!this.gl) throw new Error('当前浏览器没有可用的 WebGL2');

    this.program = createProgram(this.gl, vertexShader, fragmentShader);
    this.loc = this.locations();
    this.camera = { yaw: 0.76, pitch: 0.27, distance: 13.5, target: vec3(0, 0.7, 0) };
    this.meshes = [];
    this.autoRotate = false;
    this.debugMode = 0;
    this.drag = false;
    this.pan = false;
    this.lastTime = 0;
    this.bind();
    this.createGround();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    requestAnimationFrame((t) => this.loop(t));
  }

  locations() {
    const gl = this.gl, p = this.program;
    const a = (n) => gl.getAttribLocation(p, n);
    const u = (n) => gl.getUniformLocation(p, n);
    return {
      position: a('aPosition'),
      normal: a('aNormal'),
      model: u('uModel'),
      viewProj: u('uViewProj'),
      camera: u('uCamera'),
      low: u('uLowColor'),
      mean: u('uMeanColor'),
      high: u('uHighColor'),
      paletteDark: u('uPaletteDark'),
      paletteWarm: u('uPaletteWarm'),
      paletteOxide: u('uPaletteOxide'),
      paletteMineral: u('uPaletteMineral'),
      paletteBio: u('uPaletteBio'),
      paletteWet: u('uPaletteWet'),
      paletteStraw: u('uPaletteStraw'),
      paletteHusk: u('uPaletteHusk'),
      paletteSeedColor: u('uPaletteSeedColor'),
      roughness: u('uRoughness'),
      dimensions: u('uDimensions'),
      warpStrength: u('uWarpStrength'),
      macroScale: u('uMacroScale'),
      ridgedScale: u('uRidgedScale'),
      cellScale: u('uCellScale'),
      poreThreshold: u('uPoreThreshold'),
      poreSharpness: u('uPoreSharpness'),
      microScale: u('uMicroScale'),
      colorContrast: u('uColorContrast'),
      cavityStrength: u('uCavityStrength'),
      bumpStrength: u('uBumpStrength'),
      roughnessCorrelation: u('uRoughnessCorrelation'),
      mineralScale: u('uMineralScale'),
      firingBand: u('uFiringBand'),
      colorRichness: u('uColorRichness'),
      waterStrength: u('uWaterStrength'),
      weatherStrength: u('uWeatherStrength'),
      inclusionStrength: u('uInclusionStrength'),
      poreDepth: u('uPoreDepth'),
      colorSeed: u('uColorSeed'),
      poreSeed: u('uPoreSeed'),
      waterSeed: u('uWaterSeed'),
      weatherSeed: u('uWeatherSeed'),
      inclusionSeed: u('uInclusionSeed'),
      detailSeed: u('uDetailSeed'),
      gaeaRockDetail: u('uGaeaRockDetail'),
      gaeaStrata: u('uGaeaStrata'),
      gaeaMicroErosion: u('uGaeaMicroErosion'),
      gaeaColorClarity: u('uGaeaColorClarity'),
      gaeaColorGamut: u('uGaeaColorGamut'),
      gaeaMaskSharpness: u('uGaeaMaskSharpness'),
      gaeaRuggedScale: u('uGaeaRuggedScale'),
      gaeaStrataFrequency: u('uGaeaStrataFrequency'),
      gaeaSurfaceScale: u('uGaeaSurfaceScale'),
      family: u('uFamily'),
      debugMode: u('uDebugMode'),
      ground: u('uGround'),
      shadowPos: [u('uShadowPos0'), u('uShadowPos1'), u('uShadowPos2')],
      shadowSize: [u('uShadowSize0'), u('uShadowSize1'), u('uShadowSize2')]
    };
  }

  bind() {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      this.drag = true;
      this.pan = e.button === 2 || e.shiftKey;
      this.px = e.clientX;
      this.py = e.clientY;
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const dx = e.clientX - this.px, dy = e.clientY - this.py;
      this.px = e.clientX;
      this.py = e.clientY;
      if (this.pan) {
        const scale = this.camera.distance * 0.0018;
        this.camera.target.x -= dx * scale * Math.cos(this.camera.yaw);
        this.camera.target.z += dx * scale * Math.sin(this.camera.yaw);
        this.camera.target.y += dy * scale;
      } else {
        this.camera.yaw += dx * 0.007;
        this.camera.pitch = clamp(this.camera.pitch + dy * 0.006, -1.15, 1.05);
      }
    });
    const stop = () => { this.drag = false; };
    c.addEventListener('pointerup', stop);
    c.addEventListener('pointercancel', stop);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.camera.distance = clamp(this.camera.distance * Math.exp(e.deltaY * 0.001), 3.1, 27);
    }, { passive: false });
  }

  createBuffer(data) {
    const gl = this.gl;
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return b;
  }

  createGround() {
    const p = new Float32Array([
      -20, 0, -20, 20, 0, -20, 20, 0, 20,
      -20, 0, -20, 20, 0, 20, -20, 0, 20
    ]);
    const n = new Float32Array(18);
    for (let i = 0; i < 6; i++) n[i * 3 + 1] = 1;
    this.ground = {
      p: this.createBuffer(p),
      n: this.createBuffer(n),
      count: 6,
      model: mat4Identity()
    };
  }

  clearMeshes() {
    const gl = this.gl;
    for (const m of this.meshes) {
      gl.deleteBuffer(m.p);
      gl.deleteBuffer(m.n);
    }
    this.meshes = [];
  }

  setMeshes(items) {
    this.clearMeshes();
    const gl = this.gl;
    this.meshes = items.map((item) => ({
      ...item,
      p: this.createBuffer(item.mesh.positions),
      n: this.createBuffer(item.mesh.normals),
      count: item.mesh.vertices,
      model: mat4Model(item.position, item.yaw)
    }));
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  setDebugMode(mode) {
    this.debugMode = clamp(Number(mode) || 0, 0, 8);
  }

  resetView() {
    this.camera = { yaw: 0.76, pitch: 0.27, distance: 13.5, target: vec3(0, 0.7, 0) };
  }

  focus(index) {
    const m = this.meshes[index];
    if (!m) return;
    this.camera.target = vec3(m.position.x, m.mesh.dims.y * 0.48, m.position.z);
    this.camera.distance = Math.max(4.0, Math.max(m.mesh.dims.x, m.mesh.dims.z) * 2.0);
    this.camera.yaw = 0.82 + m.yaw * 0.25;
    this.camera.pitch = 0.24;
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.floor(this.canvas.clientWidth * dpr));
    const h = Math.max(2, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
  }

  bindAttributes(mesh) {
    const gl = this.gl, l = this.loc;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.p);
    gl.enableVertexAttribArray(l.position);
    gl.vertexAttribPointer(l.position, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.n);
    gl.enableVertexAttribArray(l.normal);
    gl.vertexAttribPointer(l.normal, 3, gl.FLOAT, false, 0, 0);
  }

  setMaterial(profile, mesh) {
    const gl = this.gl, l = this.loc;
    const d = profile.runtimeDNA;
    const n = profile.noiseDNA || {};
    const p = profile.paletteDNA || {};
    const g = profile.gaeaDNA || {};
    const seeds = mesh.seedDNA || {};
    const controls = mesh.controls || {};
    const palette = (key, fallback) => p[key] || fallback;
    gl.uniform3fv(l.low, d.colorLowSRGB);
    gl.uniform3fv(l.mean, d.colorMeanSRGB);
    gl.uniform3fv(l.high, d.colorHighSRGB);
    gl.uniform3fv(l.paletteDark, palette('darkSRGB', d.colorLowSRGB));
    gl.uniform3fv(l.paletteWarm, palette('warmSRGB', d.colorMeanSRGB));
    gl.uniform3fv(l.paletteOxide, palette('oxideSRGB', d.colorHighSRGB));
    gl.uniform3fv(l.paletteMineral, palette('mineralSRGB', d.colorHighSRGB));
    gl.uniform3fv(l.paletteBio, palette('bioSRGB', d.colorLowSRGB));
    gl.uniform3fv(l.paletteWet, palette('wetSRGB', d.colorLowSRGB));
    gl.uniform3fv(l.paletteStraw, palette('strawSRGB', [0.58, 0.43, 0.22]));
    gl.uniform3fv(l.paletteHusk, palette('huskSRGB', [0.72, 0.59, 0.34]));
    gl.uniform3fv(l.paletteSeedColor, palette('seedSRGB', [0.25, 0.18, 0.10]));
    gl.uniform2fv(l.roughness, d.roughnessRange);
    gl.uniform3f(l.dimensions, mesh.dims.x, mesh.dims.y, mesh.dims.z);
    gl.uniform1f(l.warpStrength, n.warpStrength ?? 0.18);
    gl.uniform1f(l.macroScale, n.macroScale ?? 1.7);
    gl.uniform1f(l.ridgedScale, n.ridgedScale ?? 5.5);
    gl.uniform1f(l.cellScale, n.cellScale ?? 12.0);
    gl.uniform1f(l.poreThreshold, n.poreThreshold ?? 0.14);
    gl.uniform1f(l.poreSharpness, n.poreSharpness ?? 0.055);
    gl.uniform1f(l.microScale, n.microScale ?? 44.0);
    gl.uniform1f(l.colorContrast, n.colorContrast ?? 1.35);
    gl.uniform1f(l.cavityStrength, n.cavityStrength ?? 0.72);
    gl.uniform1f(l.bumpStrength, n.bumpStrength ?? 0.085);
    gl.uniform1f(l.roughnessCorrelation, n.roughnessCorrelation ?? 0.45);
    gl.uniform1f(l.mineralScale, n.mineralScale ?? 21.0);
    gl.uniform1f(l.firingBand, d.firingBand ?? 0.0);
    gl.uniform1f(l.colorRichness, controls.colorRichness ?? 1.15);
    gl.uniform1f(l.waterStrength, controls.waterStain ?? 0.72);
    gl.uniform1f(l.weatherStrength, controls.weathering ?? 0.72);
    gl.uniform1f(l.inclusionStrength, controls.inclusion ?? 0.8);
    gl.uniform1f(l.poreDepth, controls.poreDepth ?? 0.9);
    gl.uniform1f(l.colorSeed, seeds.color ?? seeds.master ?? 17);
    gl.uniform1f(l.poreSeed, seeds.pore ?? seeds.master ?? 19);
    gl.uniform1f(l.waterSeed, seeds.water ?? seeds.master ?? 23);
    gl.uniform1f(l.weatherSeed, seeds.weather ?? seeds.master ?? 29);
    gl.uniform1f(l.inclusionSeed, seeds.inclusion ?? seeds.master ?? 31);
    gl.uniform1f(l.detailSeed, seeds.detail ?? seeds.master ?? 37);
    gl.uniform1f(l.gaeaRockDetail, controls.rockDetail ?? 0.68);
    gl.uniform1f(l.gaeaStrata, controls.strata ?? 0.28);
    gl.uniform1f(l.gaeaMicroErosion, controls.microErosion ?? 0.64);
    gl.uniform1f(l.gaeaColorClarity, controls.colorClarity ?? 0.92);
    gl.uniform1f(l.gaeaColorGamut, controls.colorGamut ?? 1.08);
    gl.uniform1f(l.gaeaMaskSharpness, controls.maskSharpness ?? 0.92);
    gl.uniform1f(l.gaeaRuggedScale, g.ruggedScale ?? 6.2);
    gl.uniform1f(l.gaeaStrataFrequency, g.strataFrequency ?? 5.4);
    gl.uniform1f(l.gaeaSurfaceScale, g.surfaceScale ?? 34.0);
    gl.uniform1i(l.family, profile.family === 'STONE' ? 2 : profile.family === 'ADOBE' ? 1 : 0);
    gl.uniform1i(l.debugMode, this.debugMode);
  }

  cameraEye() {
    const c = this.camera, cp = Math.cos(c.pitch);
    return vec3(
      c.target.x + Math.sin(c.yaw) * cp * c.distance,
      c.target.y + Math.sin(c.pitch) * c.distance,
      c.target.z + Math.cos(c.yaw) * cp * c.distance
    );
  }

  draw() {
    const gl = this.gl, l = this.loc;
    this.resize();
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0.060, 0.064, 0.058, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);

    const eye = this.cameraEye();
    const view = mat4LookAt(eye, this.camera.target, vec3(0, 1, 0));
    const proj = mat4Perspective(Math.PI / 4.2, this.canvas.width / this.canvas.height, 0.05, 100);
    const viewProj = mat4Multiply(proj, view);

    gl.uniformMatrix4fv(l.viewProj, false, viewProj);
    gl.uniform3f(l.camera, eye.x, eye.y, eye.z);

    for (let i = 0; i < 3; i++) {
      const m = this.meshes[i];
      const pos = m ? m.position : vec3(1000, 0, 1000);
      const dims = m ? m.mesh.dims : vec3(1, 1, 1);
      gl.uniform3f(l.shadowPos[i], pos.x, 0, pos.z);
      gl.uniform2f(l.shadowSize[i], dims.x * 0.66, dims.z * 0.72);
    }

    gl.uniform1i(l.ground, 1);
    gl.uniform1f(l.colorSeed, 17);
    gl.uniformMatrix4fv(l.model, false, this.ground.model);
    this.bindAttributes(this.ground);
    gl.drawArrays(gl.TRIANGLES, 0, this.ground.count);

    gl.uniform1i(l.ground, 0);
    for (const mesh of this.meshes) {
      gl.uniformMatrix4fv(l.model, false, mesh.model);
      this.bindAttributes(mesh);
      this.setMaterial(mesh.profile, mesh.mesh);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    }
  }

  loop(t) {
    const dt = Math.min(0.05, (t - this.lastTime) / 1000 || 0);
    this.lastTime = t;
    if (this.autoRotate && !this.drag) this.camera.yaw += dt * 0.16;
    this.draw();
    requestAnimationFrame((n) => this.loop(n));
  }

  capture() {
    return this.canvas.toDataURL('image/png');
  }
}

window.BrickMotherRendererV2 = { BrickRenderer };
})();
