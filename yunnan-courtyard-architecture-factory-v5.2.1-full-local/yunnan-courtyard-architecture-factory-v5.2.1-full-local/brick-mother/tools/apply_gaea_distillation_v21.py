from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Patch anchor missing: {label}")
    return text.replace(old, new, 1)


def patch_html() -> None:
    path = ROOT / "index.html"
    html = path.read_text(encoding="utf-8")
    html = html.replace("20260828-v2a1", "20260829-v21-gaea")
    html = replace_once(
        html,
        '<link rel="stylesheet" href="./style.css?v=20260829-v21-gaea">',
        '<link rel="stylesheet" href="./style.css?v=20260829-v21-gaea">\n'
        '  <link rel="stylesheet" href="./gaea-distilled.css?v=20260829-v21-gaea">',
        "gaea css link",
    )
    html = replace_once(
        html,
        '<script src="./brick-mother-geometry-v2.js?v=20260829-v21-gaea" defer></script>',
        '<script src="./brick-mother-gaea-kernel-v1.js?v=20260829-v21-gaea" defer></script>\n'
        '  <script src="./brick-mother-geometry-v2.js?v=20260829-v21-gaea" defer></script>',
        "gaea kernel script",
    )
    html = html.replace(
        "COMPOSITE MATERIAL DNA · V2 ALPHA 1",
        "COMPOSITE MATERIAL DNA · V2.1 GAEA DISTILLED",
    )
    html = html.replace("V2 复合材质首轮", "V2.1 Gaea 蒸馏图谱")
    html = replace_once(
        html,
        '<span class="pill">深孔负向几何</span>',
        '<span class="pill">深孔负向几何</span>\n'
        '        <span class="pill">Gaea 场图蒸馏</span>',
        "gaea status pill",
    )
    html = html.replace(
        "让色彩、孔洞、水痕、风化、破碎和有机夹杂共同形成砖材身份。",
        "让形体场、侵蚀场、数据遮罩和综合色彩共同形成砖材身份。",
    )
    html = html.replace(
        "这一轮把单一种子拆成形体、破损、孔洞、色彩、水痕、风化、夹杂和微细节八类种子。每一层都可独立调整，同时继续通过域扭曲、分形、脊状、湍流和细胞距离场互相复合，形成更丰富的颜色簇、深孔、边缘侵蚀和沉积痕迹。",
        "这一轮在八类独立种子上加入 Gaea 工作流蒸馏层。多重分形、域扭曲、低强度双层破碎、局部分层、微侵蚀、岩石图、流水与分离遮罩共同进入颜色、粗糙度、微法线和 AO，形成更锐利、更丰富且可解释的材料细节。",
    )
    html = replace_once(
        html,
        '<button class="channel-button" data-channel="7" data-label="土坯有机夹杂">夹杂</button>',
        '<button class="channel-button" data-channel="7" data-label="土坯有机夹杂">夹杂</button>\n'
        '              <button class="channel-button" data-channel="8" data-label="Gaea 岩层与数据场">岩层</button>',
        "debug channel 8",
    )
    html = replace_once(
        html,
        '<label><span><b>形体变化</b><output data-control-output="shapeVariation">0.90</output></span><input data-control="shapeVariation" type="range" min="0.20" max="1.70" step="0.01"></label>',
        '<label><span><b>形体变化</b><output data-control-output="shapeVariation">0.90</output></span><input data-control="shapeVariation" type="range" min="0.20" max="1.70" step="0.01"></label>\n'
        '            <label><span><b>岩石细节</b><output data-control-output="rockDetail">0.68</output></span><input data-control="rockDetail" type="range" min="0" max="1.60" step="0.01"></label>\n'
        '            <label><span><b>局部分层</b><output data-control-output="strata">0.28</output></span><input data-control="strata" type="range" min="0" max="1.60" step="0.01"></label>\n'
        '            <label><span><b>微侵蚀</b><output data-control-output="microErosion">0.64</output></span><input data-control="microErosion" type="range" min="0" max="1.60" step="0.01"></label>\n'
        '            <label><span><b>色彩清晰度</b><output data-control-output="colorClarity">0.92</output></span><input data-control="colorClarity" type="range" min="0" max="1.60" step="0.01"></label>\n'
        '            <label><span><b>综合色域</b><output data-control-output="colorGamut">1.08</output></span><input data-control="colorGamut" type="range" min="0" max="1.60" step="0.01"></label>\n'
        '            <label><span><b>遮罩锐度</b><output data-control-output="maskSharpness">0.92</output></span><input data-control="maskSharpness" type="range" min="0" max="1.60" step="0.01"></label>',
        "gaea control sliders",
    )
    contract_anchor = (
        '        <section class="section">\n'
        '          <p class="eyebrow">05 · COMPOSITE CONTRACT</p>'
    )
    gaea_panel = (
        '        <section class="section gaea-panel">\n'
        '          <p class="eyebrow">05 · GAEA DISTILLED GRAPH</p>\n'
        '          <h2>从地形节点蒸馏到材料场</h2>\n'
        '          <div class="gaea-node-flow">\n'
        '            <span>Primitives<br>多重分形</span>\n'
        '            <span>Warp / Profile<br>扭曲与轮廓</span>\n'
        '            <span>Erosion / Data<br>侵蚀与遮罩</span>\n'
        '            <span>CLUT / Splat<br>颜色与渲染</span>\n'
        '          </div>\n'
        '          <div class="gaea-contract">\n'
        '            <div><b>岩石链</b><span>双层低强度 Rugged、Stratify、MicroErosion 与 RockMap 复合。</span></div>\n'
        '            <div><b>颜色链</b><span>AutoLevel、Clarity、CLUT5 与归一化 Splat 共同扩展色域。</span></div>\n'
        '            <div><b>关联链</b><span>几何、颜色、粗糙度、微法线与 AO 共用数据遮罩。</span></div>\n'
        '          </div>\n'
        '          <span class="gaea-control-tag">独立实现 · 无 Gaea 运行时依赖</span>\n'
        '        </section>\n\n'
        '        <section class="section">\n'
        '          <p class="eyebrow">06 · COMPOSITE CONTRACT</p>'
    )
    html = replace_once(html, contract_anchor, gaea_panel, "gaea graph panel")
    path.write_text(html, encoding="utf-8")


def patch_geometry() -> None:
    path = ROOT / "brick-mother-geometry-v2.js"
    geometry = path.read_text(encoding="utf-8")
    geometry = replace_once(
        geometry,
        "'use strict';\n",
        "'use strict';\n\nconst GAEA = window.BrickMotherGaeaV1 || null;\n",
        "geometry gaea dependency",
    )
    geometry = replace_once(
        geometry,
        "    inclusion: number('inclusion', 0.8, 0, 1.6),\n"
        "    colorRichness: number('colorRichness', 1.15, 0.35, 1.9),\n"
        "    waterStain: number('waterStain', 0.72, 0, 1.6)\n",
        "    inclusion: number('inclusion', 0.8, 0, 1.6),\n"
        "    colorRichness: number('colorRichness', 1.15, 0.35, 1.9),\n"
        "    waterStain: number('waterStain', 0.72, 0, 1.6),\n"
        "    rockDetail: number('rockDetail', 0.68, 0, 1.6),\n"
        "    strata: number('strata', 0.28, 0, 1.6),\n"
        "    microErosion: number('microErosion', 0.64, 0, 1.6),\n"
        "    colorClarity: number('colorClarity', 0.92, 0, 1.6),\n"
        "    colorGamut: number('colorGamut', 1.08, 0, 1.6),\n"
        "    maskSharpness: number('maskSharpness', 0.92, 0, 1.6)\n",
        "geometry gaea controls",
    )
    geometry = replace_once(
        geometry,
        "  const phase = new RNG(seeds.shape).range(-100, 100);\n",
        "  const phase = new RNG(seeds.shape).range(-100, 100);\n"
        "  const gaeaDNA = profile.gaeaDNA || {};\n"
        "  const gaeaNoiseApi = GAEA ? { noise3, fbm3, ridgedFbm3 } : null;\n",
        "geometry gaea dna",
    )
    geometry = replace_once(
        geometry,
        "    d += (broad * 0.64 + ridge * 0.27 + crust * 0.09 * controls.weathering) * reliefAmp;\n",
        "    d += (broad * 0.64 + ridge * 0.27 + crust * 0.09 * controls.weathering) * reliefAmp;\n"
        "    if (GAEA) {\n"
        "      d += GAEA.geometryDisplacement(p, seeds, controls, gaeaDNA, gaeaNoiseApi) * minD;\n"
        "    }\n",
        "geometry gaea displacement",
    )
    geometry = geometry.replace(
        "noiseVersion: 'v2.0-composite-material-dna-alpha1'",
        "noiseVersion: 'v2.1-gaea-distilled-field-graph-alpha1'",
    )
    path.write_text(geometry, encoding="utf-8")


def patch_renderer() -> None:
    path = ROOT / "brick-mother-renderer-v2.js"
    renderer = path.read_text(encoding="utf-8")
    renderer = replace_once(
        renderer,
        "const { clamp, vec3, norm3, sub3, cross3, dot3 } = window.BrickMotherGeometryV2;\n",
        "const { clamp, vec3, norm3, sub3, cross3, dot3 } = window.BrickMotherGeometryV2;\n"
        "const gaeaGLSL = window.BrickMotherGaeaV1?.glsl || '';\n",
        "renderer gaea dependency",
    )
    renderer = replace_once(
        renderer,
        "const fragmentShader = `#version 300 es\nprecision highp float;\n",
        "const fragmentShader = `#version 300 es\nprecision highp float;\n${gaeaGLSL}\n",
        "renderer gaea glsl injection",
    )
    renderer = replace_once(
        renderer,
        "uniform float uDetailSeed;\nuniform int uFamily;\n",
        "uniform float uDetailSeed;\n"
        "uniform float uGaeaRockDetail;\n"
        "uniform float uGaeaStrata;\n"
        "uniform float uGaeaMicroErosion;\n"
        "uniform float uGaeaColorClarity;\n"
        "uniform float uGaeaColorGamut;\n"
        "uniform float uGaeaMaskSharpness;\n"
        "uniform float uGaeaRuggedScale;\n"
        "uniform float uGaeaStrataFrequency;\n"
        "uniform float uGaeaSurfaceScale;\n"
        "uniform int uFamily;\n",
        "renderer gaea uniforms",
    )
    renderer = replace_once(
        renderer,
        "  vec3 baseNormal = normalize(vNormal);\n  vec2 projected = surfaceProjection(p, baseNormal);\n",
        "  vec3 baseNormal = normalize(vNormal);\n"
        "  BMGaeaFields gaea = bmGaeaEvaluate(\n"
        "    p,\n"
        "    baseNormal,\n"
        "    seedVector(uDetailSeed + uColorSeed * 0.37, 0.91),\n"
        "    uGaeaRuggedScale,\n"
        "    uGaeaStrataFrequency,\n"
        "    uGaeaSurfaceScale,\n"
        "    uGaeaMaskSharpness\n"
        "  );\n"
        "  vec2 projected = surfaceProjection(p, baseNormal);\n",
        "renderer gaea field evaluation",
    )
    renderer = replace_once(
        renderer,
        "  float tone = clamp(0.06 + macro * 0.55 + macroB * 0.17 + ridge * 0.16 + (micro - 0.5) * 0.23 + (grit - 0.5) * 0.09, 0.0, 1.0);\n",
        "  cavity = clamp(\n"
        "    cavity +\n"
        "    gaea.cavity * (0.14 + uGaeaRockDetail * 0.24) +\n"
        "    gaea.microErosion * uGaeaMicroErosion * 0.11,\n"
        "    0.0, 1.0\n"
        "  );\n\n"
        "  float tone = clamp(0.06 + macro * 0.55 + macroB * 0.17 + ridge * 0.16 + (micro - 0.5) * 0.23 + (grit - 0.5) * 0.09, 0.0, 1.0);\n",
        "renderer gaea cavity correlation",
    )
    renderer = replace_once(
        renderer,
        "  float bioMask = smoothstep(0.67, 0.91, fbmValueFast(colorWarped * 3.1 + seedVector(uWeatherSeed, 0.73))) *\n"
        "                  smoothstep(-0.2, 0.58, 0.4 - baseNormal.y);\n\n"
        "  albedo = mix(albedo, warm, warmMask * 0.34 * rich);\n",
        "  float bioMask = smoothstep(0.67, 0.91, fbmValueFast(colorWarped * 3.1 + seedVector(uWeatherSeed, 0.73))) *\n"
        "                  smoothstep(-0.2, 0.58, 0.4 - baseNormal.y);\n\n"
        "  float gaeaColorDriver = bmClarity(\n"
        "    bmAutoLevel(\n"
        "      macro * 0.30 + ridge * 0.16 + gaea.rugged * 0.22 + gaea.strata * 0.16 + gaea.flow * 0.16,\n"
        "      0.14, 0.88\n"
        "    ),\n"
        "    uGaeaColorClarity\n"
        "  );\n"
        "  vec3 gaeaClut = bmClut5(gaeaColorDriver, dark, wetColor, mean, warm, mineralColor);\n"
        "  vec4 gaeaWeights = bmSplatWeights(\n"
        "    darkAggregate + gaea.cavity * 0.34,\n"
        "    oxideMask + gaea.flow * 0.24,\n"
        "    paleAggregate + gaea.strata * 0.34,\n"
        "    gaea.rockMap + mineral * 0.22,\n"
        "    uGaeaMaskSharpness\n"
        "  );\n"
        "  vec3 gaeaSplat =\n"
        "    dark * gaeaWeights.x +\n"
        "    oxideColor * gaeaWeights.y +\n"
        "    mineralColor * gaeaWeights.z +\n"
        "    warm * gaeaWeights.w;\n"
        "  float gaeaColorBlend = clamp(\n"
        "    uGaeaColorGamut * (0.16 + gaea.separation * 0.28),\n"
        "    0.0, 0.74\n"
        "  );\n"
        "  albedo = mix(albedo, gaeaClut, gaeaColorBlend * 0.58);\n"
        "  albedo = mix(albedo, gaeaSplat, gaeaColorBlend * 0.52);\n\n"
        "  albedo = mix(albedo, warm, warmMask * 0.34 * rich);\n",
        "renderer gaea color graph",
    )
    renderer = replace_once(
        renderer,
        "    float darkGrain = smoothstep(0.89, 0.985, grit);\n"
        "    albedo = mix(albedo, dark, darkGrain * 0.42);\n"
        "  }\n",
        "    float darkGrain = smoothstep(0.89, 0.985, grit);\n"
        "    albedo = mix(albedo, dark, darkGrain * 0.42);\n"
        "    albedo = mix(albedo, mineralColor, gaea.strata * 0.36 * uGaeaStrata);\n"
        "    albedo = mix(albedo, dark, gaea.rockMap * 0.20 * uGaeaRockDetail);\n"
        "    albedo = mix(albedo, oxideColor, gaea.flow * 0.14 * uGaeaColorGamut);\n"
        "  }\n",
        "renderer stone gaea color",
    )
    renderer = replace_once(
        renderer,
        "    weatherMask * 0.08 +\n"
        "    inclusionHeight -\n"
        "    cavity * (0.62 + uPoreDepth * 0.14);\n",
        "    weatherMask * 0.08 +\n"
        "    inclusionHeight +\n"
        "    (gaea.protrusion - 0.5) * 0.28 * uGaeaRockDetail +\n"
        "    (gaea.strata - 0.5) * 0.22 * uGaeaStrata -\n"
        "    gaea.microErosion * 0.24 * uGaeaMicroErosion -\n"
        "    cavity * (0.62 + uPoreDepth * 0.14);\n",
        "renderer gaea height correlation",
    )
    renderer = replace_once(
        renderer,
        "    weatherMask * 0.18 +\n"
        "    inclusions.x * 0.12 + inclusions.y * 0.10 -\n",
        "    weatherMask * 0.18 +\n"
        "    gaea.rockMap * 0.18 * uGaeaRockDetail +\n"
        "    gaea.strata * 0.10 * uGaeaStrata +\n"
        "    gaea.microErosion * 0.15 * uGaeaMicroErosion +\n"
        "    inclusions.x * 0.12 + inclusions.y * 0.10 -\n",
        "renderer gaea roughness correlation",
    )
    renderer = replace_once(
        renderer,
        "  if (uDebugMode == 7) {\n"
        "    outColor = vec4(clamp(vec3(inclusions.x, inclusions.y, inclusions.z + inclusions.w), 0.0, 1.0), 1.0);\n"
        "    return;\n"
        "  }\n\n"
        "  vec3 V = normalize(uCamera - vWorldPos);\n",
        "  if (uDebugMode == 7) {\n"
        "    outColor = vec4(clamp(vec3(inclusions.x, inclusions.y, inclusions.z + inclusions.w), 0.0, 1.0), 1.0);\n"
        "    return;\n"
        "  }\n"
        "  if (uDebugMode == 8) {\n"
        "    outColor = vec4(clamp(vec3(gaea.rugged, gaea.strata, max(gaea.rockMap, gaea.microErosion)), 0.0, 1.0), 1.0);\n"
        "    return;\n"
        "  }\n\n"
        "  vec3 V = normalize(uCamera - vWorldPos);\n",
        "renderer gaea debug channel",
    )
    renderer = replace_once(
        renderer,
        "  float ao = clamp(1.0 - cavity * (0.42 + uPoreDepth * 0.08) - smoothstep(0.82, 1.0, 1.0 - ridge) * 0.10, 0.40, 1.0);\n",
        "  float ao = clamp(\n"
        "    1.0 -\n"
        "    cavity * (0.42 + uPoreDepth * 0.08) -\n"
        "    smoothstep(0.82, 1.0, 1.0 - ridge) * 0.10 -\n"
        "    gaea.cavity * uGaeaRockDetail * 0.10 -\n"
        "    gaea.microErosion * uGaeaMicroErosion * 0.06,\n"
        "    0.36, 1.0\n"
        "  );\n",
        "renderer gaea ao correlation",
    )
    renderer = replace_once(
        renderer,
        "      detailSeed: u('uDetailSeed'),\n      family: u('uFamily'),\n",
        "      detailSeed: u('uDetailSeed'),\n"
        "      gaeaRockDetail: u('uGaeaRockDetail'),\n"
        "      gaeaStrata: u('uGaeaStrata'),\n"
        "      gaeaMicroErosion: u('uGaeaMicroErosion'),\n"
        "      gaeaColorClarity: u('uGaeaColorClarity'),\n"
        "      gaeaColorGamut: u('uGaeaColorGamut'),\n"
        "      gaeaMaskSharpness: u('uGaeaMaskSharpness'),\n"
        "      gaeaRuggedScale: u('uGaeaRuggedScale'),\n"
        "      gaeaStrataFrequency: u('uGaeaStrataFrequency'),\n"
        "      gaeaSurfaceScale: u('uGaeaSurfaceScale'),\n"
        "      family: u('uFamily'),\n",
        "renderer gaea locations",
    )
    renderer = renderer.replace(
        "this.debugMode = clamp(Number(mode) || 0, 0, 7);",
        "this.debugMode = clamp(Number(mode) || 0, 0, 8);",
    )
    renderer = replace_once(
        renderer,
        "    const p = profile.paletteDNA || {};\n    const seeds = mesh.seedDNA || {};\n",
        "    const p = profile.paletteDNA || {};\n"
        "    const g = profile.gaeaDNA || {};\n"
        "    const seeds = mesh.seedDNA || {};\n",
        "renderer gaea profile dna",
    )
    renderer = replace_once(
        renderer,
        "    gl.uniform1f(l.detailSeed, seeds.detail ?? seeds.master ?? 37);\n"
        "    gl.uniform1i(l.family, profile.family === 'STONE' ? 2 : profile.family === 'ADOBE' ? 1 : 0);\n",
        "    gl.uniform1f(l.detailSeed, seeds.detail ?? seeds.master ?? 37);\n"
        "    gl.uniform1f(l.gaeaRockDetail, controls.rockDetail ?? 0.68);\n"
        "    gl.uniform1f(l.gaeaStrata, controls.strata ?? 0.28);\n"
        "    gl.uniform1f(l.gaeaMicroErosion, controls.microErosion ?? 0.64);\n"
        "    gl.uniform1f(l.gaeaColorClarity, controls.colorClarity ?? 0.92);\n"
        "    gl.uniform1f(l.gaeaColorGamut, controls.colorGamut ?? 1.08);\n"
        "    gl.uniform1f(l.gaeaMaskSharpness, controls.maskSharpness ?? 0.92);\n"
        "    gl.uniform1f(l.gaeaRuggedScale, g.ruggedScale ?? 6.2);\n"
        "    gl.uniform1f(l.gaeaStrataFrequency, g.strataFrequency ?? 5.4);\n"
        "    gl.uniform1f(l.gaeaSurfaceScale, g.surfaceScale ?? 34.0);\n"
        "    gl.uniform1i(l.family, profile.family === 'STONE' ? 2 : profile.family === 'ADOBE' ? 1 : 0);\n",
        "renderer gaea uniform values",
    )
    path.write_text(renderer, encoding="utf-8")


def patch_app() -> None:
    path = ROOT / "brick-mother-app-v2.js"
    app = path.read_text(encoding="utf-8")
    app = replace_once(
        app,
        "const CONTROL_KEYS = ['colorRichness', 'damage', 'poreDepth', 'waterStain', 'weathering', 'inclusion', 'shapeVariation'];",
        "const CONTROL_KEYS = ['colorRichness', 'damage', 'poreDepth', 'waterStain', 'weathering', 'inclusion', 'shapeVariation', 'rockDetail', 'strata', 'microErosion', 'colorClarity', 'colorGamut', 'maskSharpness'];",
        "app gaea control keys",
    )
    app = app.replace("2.0.0-alpha.1", "2.1.0-alpha.1")
    app = app.replace(
        "形体、破损、孔洞、色彩、水痕、风化、夹杂和微细节八类独立种子共同复合",
        "八类独立种子进入 Gaea 蒸馏图谱，并由 Rugged、Stratify、MicroErosion、RockMap、CLUT 与 Splat 复合",
    )
    app = app.replace(
        "正在复合八类种子、深孔几何和多层材料事件场…",
        "正在复合八类种子、Gaea 场图、深孔几何和多层材料事件场…",
    )
    app = app.replace(
        "V2 复合材质 DNA 首轮生成完成。可单独检查水痕风化和土坯夹杂通道。",
        "Gaea 蒸馏材料图谱生成完成。可检查岩层、侵蚀、综合色彩、水痕和土坯夹杂通道。",
    )
    app = replace_once(
        app,
        "    document.documentElement.dataset.deepPores = String(totalDeepPores);\n",
        "    document.documentElement.dataset.deepPores = String(totalDeepPores);\n"
        "    document.documentElement.dataset.gaeaKernel = window.BrickMotherGaeaV1?.version || 'missing';\n"
        "    document.documentElement.dataset.debugModes = '9';\n",
        "app gaea datasets",
    )
    app = replace_once(
        app,
        "      correlatedChannels: ['base-color', 'aggregate-color', 'water-stain', 'weathering', 'cavity', 'roughness', 'micro-normal', 'organic-inclusion'],\n"
        "      debugModes: 8,\n",
        "      correlatedChannels: ['base-color', 'aggregate-color', 'water-stain', 'weathering', 'cavity', 'roughness', 'micro-normal', 'organic-inclusion', 'rugged', 'strata', 'micro-erosion', 'rock-map', 'separation-mask'],\n"
        "      gaeaKernel: window.BrickMotherGaeaV1?.version || 'missing',\n"
        "      gaeaOperatorFamilies: Object.keys(window.BrickMotherGaeaV1?.operatorFamilies || {}),\n"
        "      gaeaGraphRecipes: Object.keys(window.BrickMotherGaeaV1?.graphRecipes || {}),\n"
        "      gaeaDistilledIndependentImplementation: true,\n"
        "      debugModes: 9,\n",
        "app gaea qa fields",
    )
    path.write_text(app, encoding="utf-8")


def patch_profiles() -> None:
    path = ROOT / "data" / "brick-material-profiles-v2.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data["schemaVersion"] = "2.1.0-alpha.1"
    data["pipelineId"] = "brick-mother-gaea-distilled-composite-material-dna-v2.1"
    research = data.setdefault("researchBasis", {})
    research["gaeaOfficialDocumentation"] = [
        "https://docs.quadspinner.com/Reference/",
        "https://docs.quadspinner.com/Guide/Using-Gaea/Modify-Shapes.html",
        "https://docs.quadspinner.com/Reference/Adjustments/Combine.html",
        "https://docs.quadspinner.com/Reference/LookDev/Rugged.html",
        "https://docs.quadspinner.com/Guide/Using-Gaea/LookDev.html",
        "https://docs.quadspinner.com/Reference/Erosion/MicroErosion.html",
        "https://docs.quadspinner.com/Reference/Erosion/Stratify.html",
        "https://docs.quadspinner.com/Reference/Data/RockMap.html",
        "https://docs.quadspinner.com/Reference/Color/CLUTer.html",
        "https://docs.quadspinner.com/Reference/Color/Synth.html",
        "https://docs.quadspinner.com/Reference/Color/Splat.html",
        "https://docs.quadspinner.com/Reference/Color/ColorFX.html",
    ]
    research["gaeaDistillationPolicy"] = (
        "Documented node roles and graph strategies distilled into an independent field implementation."
    )
    data["rendererContract"]["gaeaFieldGraph"] = (
        "Rugged, stratify, micro-erosion, rock-map, flow, separation-mask, CLUT5 and normalized Splat fields share geometry, color, roughness, normal and AO correlations."
    )

    family_dna = {
        "FIRED_CLAY": {
            "ruggedScale": 6.2,
            "strataFrequency": 5.2,
            "surfaceScale": 36.0,
            "ruggedDepth": 0.0095,
            "strataDepth": 0.0032,
            "microErosionDepth": 0.0042,
            "warpStrength": 0.22,
            "strataTilt": 0.17,
            "geometryStrength": 1.0,
        },
        "ADOBE": {
            "ruggedScale": 4.8,
            "strataFrequency": 3.4,
            "surfaceScale": 29.0,
            "ruggedDepth": 0.0075,
            "strataDepth": 0.0022,
            "microErosionDepth": 0.0054,
            "warpStrength": 0.27,
            "strataTilt": 0.11,
            "geometryStrength": 0.92,
        },
        "STONE": {
            "ruggedScale": 7.6,
            "strataFrequency": 8.4,
            "surfaceScale": 43.0,
            "ruggedDepth": 0.023,
            "strataDepth": 0.014,
            "microErosionDepth": 0.0085,
            "warpStrength": 0.31,
            "strataTilt": 0.23,
            "geometryStrength": 1.12,
        },
    }
    family_controls = {
        "FIRED_CLAY": {
            "rockDetail": 0.66,
            "strata": 0.26,
            "microErosion": 0.68,
            "colorClarity": 1.08,
            "colorGamut": 1.22,
            "maskSharpness": 1.12,
        },
        "ADOBE": {
            "rockDetail": 0.46,
            "strata": 0.15,
            "microErosion": 0.76,
            "colorClarity": 0.90,
            "colorGamut": 1.04,
            "maskSharpness": 0.82,
        },
        "STONE": {
            "rockDetail": 1.18,
            "strata": 1.08,
            "microErosion": 0.92,
            "colorClarity": 1.02,
            "colorGamut": 1.16,
            "maskSharpness": 1.06,
        },
    }

    for profile in data["profiles"]:
        family = profile["family"]
        profile["gaeaDNA"] = dict(family_dna[family])
        profile.setdefault("compositeDefaults", {}).update(family_controls[family])
        palette = profile.get("paletteDNA", {})
        if profile["id"] == "historical-fired":
            profile["compositeDefaults"]["colorRichness"] = 1.52
            palette.update(
                {
                    "darkSRGB": [0.105, 0.052, 0.022],
                    "warmSRGB": [0.68, 0.36, 0.12],
                    "oxideSRGB": [0.82, 0.235, 0.045],
                    "mineralSRGB": [0.86, 0.67, 0.38],
                    "bioSRGB": [0.16, 0.24, 0.09],
                    "wetSRGB": [0.07, 0.052, 0.038],
                }
            )
        elif profile["id"] == "old-pbr-fired":
            profile["compositeDefaults"]["colorRichness"] = 1.50
            profile["compositeDefaults"]["colorGamut"] = 1.30
            palette.update(
                {
                    "darkSRGB": [0.13, 0.095, 0.052],
                    "warmSRGB": [0.72, 0.50, 0.22],
                    "oxideSRGB": [0.82, 0.29, 0.075],
                    "mineralSRGB": [0.88, 0.79, 0.59],
                    "bioSRGB": [0.18, 0.29, 0.12],
                    "wetSRGB": [0.09, 0.073, 0.055],
                }
            )
        elif family == "ADOBE":
            profile["compositeDefaults"]["inclusion"] = max(
                float(profile["compositeDefaults"].get("inclusion", 0.8)), 1.05
            )
            palette.update(
                {
                    "strawSRGB": [0.68, 0.47, 0.17],
                    "huskSRGB": [0.82, 0.64, 0.29],
                    "seedSRGB": [0.31, 0.15, 0.045],
                    "wetSRGB": [0.14, 0.095, 0.065],
                }
            )
        elif family == "STONE":
            profile["compositeDefaults"]["poreDepth"] = max(
                float(profile["compositeDefaults"].get("poreDepth", 0.9)), 1.08
            )
            palette.update(
                {
                    "darkSRGB": [0.095, 0.085, 0.074],
                    "warmSRGB": [0.46, 0.34, 0.23],
                    "oxideSRGB": [0.64, 0.24, 0.075],
                    "mineralSRGB": [0.78, 0.72, 0.61],
                    "bioSRGB": [0.15, 0.23, 0.12],
                    "wetSRGB": [0.065, 0.072, 0.075],
                }
            )
        profile["paletteDNA"] = palette

    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def patch_version_and_contract() -> None:
    path = ROOT / "VERSION.json"
    version = json.loads(path.read_text(encoding="utf-8"))
    version["version"] = "2.1.0-alpha.1"
    version["status"] = "gaea-distilled-visual-calibration-alpha"
    version["engineLineage"]["materialGeometryEngine"] = "2.1.0-alpha.1"
    version["engineLineage"]["gaeaKernel"] = "1.0.0"
    version["engineLineage"]["releaseMeaning"] = (
        "Gaea-documented graph strategies distilled into independent rugged, strata, micro-erosion, rock-map, flow, CLUT and Splat fields for richer color and sharper correlated detail."
    )
    version["capabilities"]["adjustableCompositeControls"] = 13
    version["capabilities"]["debugChannels"] = 9
    version["capabilities"]["gaeaKernel"] = "1.0.0"
    version["capabilities"]["gaeaOperatorFamilies"] = 7
    version["capabilities"]["gaeaIndependentImplementation"] = True
    version["approval"]["visualStatus"] = "pending-user-review-gaea-distilled-alpha"
    version["approval"]["jrbColorReferenceApproved"] = False
    version["approval"]["stoneDetailApproved"] = False
    version["approval"]["productionStatus"] = False
    path.write_text(json.dumps(version, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    path = ROOT / "qa" / "gaea-distillation-contract-v1.json"
    contract = json.loads(path.read_text(encoding="utf-8"))
    contract["implementationTarget"] = "2.1.0-alpha.1"
    contract["gaeaKernel"] = "1.0.0"
    contract["expectedControls"] = [
        "rockDetail",
        "strata",
        "microErosion",
        "colorClarity",
        "colorGamut",
        "maskSharpness",
    ]
    contract["expectedDebugChannels"] = 9
    path.write_text(json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    version_path = ROOT / "VERSION.json"
    current = json.loads(version_path.read_text(encoding="utf-8"))
    if current.get("version") == "2.1.0-alpha.1":
        raise RuntimeError("Gaea distillation V2.1 is already applied; refusing a duplicate patch")
    patch_html()
    patch_geometry()
    patch_renderer()
    patch_app()
    patch_profiles()
    patch_version_and_contract()
    print("Brick Mother Gaea distillation V2.1 patch applied")


if __name__ == "__main__":
    main()
