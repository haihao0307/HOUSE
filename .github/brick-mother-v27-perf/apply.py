from pathlib import Path

root = Path('yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/brick-mother')
geometry_path = root / 'brick-mother-geometry-v2.js'
geometry = geometry_path.read_text(encoding='utf-8')
old_jitter = "  const sizeJitter = (noise3(p.x * 5.7, p.y * 5.7, p.z * 5.7, seeds.detail + event.typeCode * 173) - 0.5) * 0.055 * minD * event.strength;"
if old_jitter not in geometry:
    raise RuntimeError('event jitter anchor missing')
geometry = geometry.replace(old_jitter, '  const sizeJitter = 0;', 1)
old_target = '  const target = Math.round((benchmark ? 62 : 52) * quality);'
if old_target not in geometry:
    raise RuntimeError('benchmark target anchor missing')
geometry = geometry.replace(old_target, '  const target = Math.round(52 * quality);', 1)
old_return = '  return events.slice(0, 20);'
quota_lines = [
    "  const limits = profile.family === 'STONE'",
    "    ? { macroPlateLoss: 1, cavityCluster: 2, fractureBranch: 1, edgeSpall: 1, shearBand: 1, beddingLayer: 4, undercutShelf: 2, mineralSeam: 2 }",
    "    : profile.family === 'ADOBE'",
    "      ? { macroPlateLoss: 1, cavityCluster: 1, fractureBranch: 1, edgeSpall: 1, compactionFlake: 4, fiberBundle: 3, fiberPulloutChannel: 2, undercutShelf: 1 }",
    "      : { macroPlateLoss: 2, cavityCluster: 3, fractureBranch: 2, edgeSpall: 2, shearBand: 1, delaminationPlate: 2, undercutShelf: 1, mineralSeam: 1 };",
    "  const used = {};",
    "  return events.filter((event) => {",
    "    const limit = limits[event.type] || 0;",
    "    const count = used[event.type] || 0;",
    "    used[event.type] = count + 1;",
    "    return count < limit;",
    "  }).slice(0, 14);",
]
quota_return = '\n'.join(quota_lines)
if old_return not in geometry:
    raise RuntimeError('formation event return anchor missing')
geometry = geometry.replace(old_return, quota_return, 1)
geometry_path.write_text(geometry, encoding='utf-8')

app_path = root / 'brick-mother-app-v2.js'
app = app_path.read_text(encoding='utf-8')
old_quality = '      const quality = state.soloMode ? 1.18 : (state.benchmarkMode ? 0.78 : 1.04);'
new_quality = '      const quality = state.evidenceMode ? 0.78 : (state.soloMode ? 1.00 : (state.benchmarkMode ? 0.72 : 1.04));'
if old_quality not in app:
    raise RuntimeError('quality anchor missing')
app_path.write_text(app.replace(old_quality, new_quality, 1), encoding='utf-8')
print('V2.7 performance patch applied.')
