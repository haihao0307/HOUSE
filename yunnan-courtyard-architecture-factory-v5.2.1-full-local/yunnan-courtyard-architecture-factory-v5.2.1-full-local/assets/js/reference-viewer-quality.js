(function enhanceYunnanReferenceViewer(global) {
  'use strict';

  const api = global.TuanjieGLBViewer;
  if (!api || typeof api.create !== 'function' || api.__qualityEnhanced) return;

  const originalCreate = api.create.bind(api);

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || 'quality shader compile failed';
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function createQualityProgram(gl, derivatives) {
    const vertex = compile(gl, gl.VERTEX_SHADER, `
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      attribute vec2 aUV;
      uniform mat4 uMVP;
      uniform mat4 uModel;
      uniform mat3 uNormalMatrix;
      varying highp vec3 vPosition;
      varying highp vec3 vNormal;
      varying highp vec2 vUV;
      void main() {
        vec4 worldPosition = uModel * vec4(aPosition, 1.0);
        gl_Position = uMVP * vec4(aPosition, 1.0);
        vPosition = worldPosition.xyz;
        vNormal = uNormalMatrix * aNormal;
        vUV = aUV;
      }
    `);

    const derivativeExtension = derivatives ? '#extension GL_OES_standard_derivatives : enable\n' : '';
    const normalCode = derivatives ? `
      mat3 cotangentFrame(vec3 N, vec3 p, vec2 uv) {
        vec3 dp1 = dFdx(p);
        vec3 dp2 = dFdy(p);
        vec3 dp2perp = cross(dp2, N);
        vec3 dp1perp = cross(N, dp1);
        vec2 duv1 = dFdx(uv);
        vec2 duv2 = dFdy(uv);
        vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
        vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
        float inverseMaximum = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-7));
        return mat3(T * inverseMaximum, B * inverseMaximum, N);
      }
      vec3 mappedNormal(vec3 N) {
        vec3 sampleNormal = texture2D(uNormal, vUV).xyz * 2.0 - 1.0;
        sampleNormal.xy *= uNormalStrength;
        return normalize(cotangentFrame(N, vPosition, vUV) * sampleNormal);
      }
    ` : 'vec3 mappedNormal(vec3 N) { return N; }';

    const fragment = compile(gl, gl.FRAGMENT_SHADER, `
      ${derivativeExtension}
      precision highp float;
      uniform sampler2D uBase;
      uniform sampler2D uNormal;
      uniform float uNormalEnabled;
      uniform vec4 uFactor;
      uniform float uAlphaCut;
      uniform vec2 uBaseTexel;
      uniform float uDetailBoost;
      uniform float uNormalStrength;
      varying highp vec3 vPosition;
      varying highp vec3 vNormal;
      varying highp vec2 vUV;
      ${normalCode}

      vec4 sharpenedBase(vec2 uv) {
        vec4 center = texture2D(uBase, uv);
        vec4 north = texture2D(uBase, uv + vec2(0.0, uBaseTexel.y));
        vec4 south = texture2D(uBase, uv - vec2(0.0, uBaseTexel.y));
        vec4 east = texture2D(uBase, uv + vec2(uBaseTexel.x, 0.0));
        vec4 west = texture2D(uBase, uv - vec2(uBaseTexel.x, 0.0));
        vec4 blur = (north + south + east + west) * 0.25;
        vec4 detail = center + (center - blur) * (0.42 * uDetailBoost);
        return clamp(detail, 0.0, 1.0);
      }

      void main() {
        vec4 textureColor = sharpenedBase(vUV) * uFactor;
        if (textureColor.a < uAlphaCut) discard;

        vec3 normal = normalize(vNormal);
        if (uNormalEnabled > 0.5) normal = mappedNormal(normal);

        vec3 lightDirection = normalize(vec3(-0.42, 0.83, 0.36));
        float diffuse = max(dot(normal, lightDirection), 0.0);
        float hemisphere = 0.46 + 0.28 * clamp(normal.y * 0.5 + 0.5, 0.0, 1.0);
        float grazing = pow(1.0 - max(dot(normal, normalize(vec3(0.2, 0.5, 0.84))), 0.0), 2.0);

        vec3 linearAlbedo = pow(max(textureColor.rgb, vec3(0.003)), vec3(2.2));
        vec3 linearColor = linearAlbedo * (hemisphere + diffuse * 0.72);
        linearColor += linearAlbedo * grazing * 0.035;
        linearColor += vec3(0.012, 0.014, 0.013);
        vec3 outputColor = pow(max(linearColor, vec3(0.0)), vec3(1.0 / 2.2));
        gl_FragColor = vec4(outputColor, textureColor.a);
      }
    `);

    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) || 'quality shader link failed';
      gl.deleteProgram(program);
      throw new Error(message);
    }
    return program;
  }

  function createLocations(gl, program) {
    return {
      position: gl.getAttribLocation(program, 'aPosition'),
      normal: gl.getAttribLocation(program, 'aNormal'),
      uv: gl.getAttribLocation(program, 'aUV'),
      mvp: gl.getUniformLocation(program, 'uMVP'),
      model: gl.getUniformLocation(program, 'uModel'),
      normalMatrix: gl.getUniformLocation(program, 'uNormalMatrix'),
      base: gl.getUniformLocation(program, 'uBase'),
      normalMap: gl.getUniformLocation(program, 'uNormal'),
      normalEnabled: gl.getUniformLocation(program, 'uNormalEnabled'),
      factor: gl.getUniformLocation(program, 'uFactor'),
      alphaCut: gl.getUniformLocation(program, 'uAlphaCut'),
      baseTexel: gl.getUniformLocation(program, 'uBaseTexel'),
      detailBoost: gl.getUniformLocation(program, 'uDetailBoost'),
      normalStrength: gl.getUniformLocation(program, 'uNormalStrength')
    };
  }

  function applyMaximumAnisotropy(viewer) {
    if (!viewer.extAnisotropy) return 1;
    const gl = viewer.gl;
    const extension = viewer.extAnisotropy;
    const maximum = gl.getParameter(extension.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1;
    const applied = Math.min(maximum, 16);
    [viewer.baseTexture, viewer.normalTexture].forEach((texture) => {
      if (!texture) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameterf(gl.TEXTURE_2D, extension.TEXTURE_MAX_ANISOTROPY_EXT, applied);
    });
    return applied;
  }

  api.create = function createEnhancedViewer(canvas, options = {}) {
    const viewer = originalCreate(canvas, options);
    const gl = viewer.gl;
    const mobile = Math.min(global.innerWidth || 1920, global.innerHeight || 1080) < 720;
    viewer.qualityProfile = {
      id: mobile ? 'reference-inspection-mobile' : 'reference-inspection-desktop',
      dprCap: mobile ? 2.0 : 3.0,
      detailBoost: options.detailBoost ?? (mobile ? 0.55 : 0.88),
      normalStrength: options.normalStrength ?? 1.18,
      anisotropy: 1,
      shader: 'srgb-linear-lighting-five-tap-detail-recovery-v2'
    };

    const originalResize = viewer.resize.bind(viewer);
    viewer.resize = function resizeQualityCanvas() {
      const dpr = Math.min(global.devicePixelRatio || 1, viewer.qualityProfile.dprCap);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      if (viewer.modelStats) viewer.modelStats.dpr = dpr;
    };

    try {
      const qualityProgram = createQualityProgram(gl, Boolean(viewer.extDerivatives));
      if (viewer.program) gl.deleteProgram(viewer.program);
      viewer.program = qualityProgram;
      viewer.loc = createLocations(gl, qualityProgram);
      gl.useProgram(qualityProgram);
      if (viewer.loc.detailBoost !== null) gl.uniform1f(viewer.loc.detailBoost, viewer.qualityProfile.detailBoost);
      if (viewer.loc.normalStrength !== null) gl.uniform1f(viewer.loc.normalStrength, viewer.qualityProfile.normalStrength);
      if (viewer.loc.baseTexel !== null) gl.uniform2f(viewer.loc.baseTexel, 1 / 4096, 1 / 4096);
      gl.hint(gl.GENERATE_MIPMAP_HINT, gl.NICEST);
    } catch (error) {
      console.warn('云南参考模型高清着色器启用失败，保留基础查看器', error);
      viewer.resize = originalResize;
      viewer.qualityProfile.shader = 'fallback-original-viewer';
    }

    const originalLoadArrayBuffer = viewer.loadArrayBuffer.bind(viewer);
    viewer.loadArrayBuffer = async function loadArrayBufferWithQuality(...args) {
      const stats = await originalLoadArrayBuffer(...args);
      viewer.qualityProfile.anisotropy = applyMaximumAnisotropy(viewer);
      gl.useProgram(viewer.program);
      const base = stats.textures?.base;
      if (viewer.loc.baseTexel !== null && base?.width && base?.height) {
        gl.uniform2f(viewer.loc.baseTexel, 1 / base.width, 1 / base.height);
      }
      if (viewer.loc.detailBoost !== null) gl.uniform1f(viewer.loc.detailBoost, viewer.qualityProfile.detailBoost);
      if (viewer.loc.normalStrength !== null) gl.uniform1f(viewer.loc.normalStrength, viewer.qualityProfile.normalStrength);
      stats.qualityProfile = { ...viewer.qualityProfile };
      stats.dpr = Math.min(global.devicePixelRatio || 1, viewer.qualityProfile.dprCap);
      viewer.resize();
      viewer.draw();
      return stats;
    };

    viewer.resize();
    return viewer;
  };

  api.__qualityEnhanced = true;
})(window);
