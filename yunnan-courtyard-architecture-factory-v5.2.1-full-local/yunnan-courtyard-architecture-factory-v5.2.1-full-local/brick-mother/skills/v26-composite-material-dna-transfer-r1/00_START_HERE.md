# Brick Mother V2.6 Composite Material DNA Transfer Pack R1

Date: 2026-09-18

## 0. Boundary first

This is a **Brick Mother knowledge-transfer package**. Brick Mother owns only the extraction, explanation, parameterization and packaging of its own V2.6 method.

Brick Mother must not:

- modify Landscape Mother, DEM, hydrology, karst or other Mother production code;
- create or publish a Landscape candidate;
- decide where caves, fractures, collapse or weathering occur in another domain;
- copy brick scale, brick-red palette or brick damage density into terrain;
- describe a receiving Mother as implemented merely because this package exists.

The receiving Mother owns unit mapping, domain truth, placement constraints, implementation, performance, browser delivery and visual acceptance.

The previously opened Landscape implementation PR #80 was a boundary error. It has been closed, is unmerged, and is not authorized for adoption.

---

## 1. Fixed source and user-selected target

Repository: `haihao0307/HOUSE`

Source commit:

```text
cfdda86c60076a0418fe1922075ddaa34cb8019c3
```

Source file:

```text
brick-mother/brick-mother-standalone-v2.6.html
```

Source Git blob SHA-1:

```text
f64c65d87dc418bf1a923a4cf332b449efbe0eb9
```

The user-selected screenshot is the V2.6 `old-pbr-fired` **深孔破碎子代 / deep-pore broken child**. The external ZIP includes the screenshot with SHA-256:

```text
5666c722378289ce76d25943a14e91dcb870ae19da76ac202015a46eea9c62c6
```

The visual strength in that reference does not come from one texture or one wave. It comes from four coupled layers:

1. rounded-box SDF plus 3D domain warp changes the real outline;
2. chips, pits, pore clusters, deep pores, rim chips, collapsed pores, cracks, erosion bites and inclusion voids remove real volume;
3. fBm, ridged fBm, turbulence, Worley and micro-erosion build continuous surface structure;
4. the same event fields drive color, roughness, normal, AO, wetness, weathering and mineral zones.

---

## 2. Coordinate and scale contract

Normalize local position by the shortest object dimension:

```text
p = localPosition / min(objectDimensions)
```

All V2.6 values are ratios first. A receiving Mother must declare:

```text
unitScale
maximumPhysicalAmplitude
minimumResolvedFeatureSize
```

No Brick value may be interpreted as metres without this mapping.

---

## 3. Domain warp and base form

Generate three low-frequency, phase-shifted fBm components and warp the 3D domain before evaluating the base SDF:

```text
wx = fBm(p.y, p.z, p.x)
wy = fBm(p.x, p.z, p.y)
wz = fBm(p.x, p.y, p.z)
q  = p + vec3(wx, wy, wz) * warpStrength
D0 = baseSDF(q)
```

Brick V2.6 uses a rounded-box base SDF. A receiver may replace that base SDF, but must preserve:

- continuous/recoverable base form;
- warp before discrete damage events;
- the ability to disable all events and recover the base form;
- stable event identity independent of camera position.

---

## 4. Continuous form fields

The continuous geometry layer combines:

- `rugged`: ridged fBm, for ridges, protrusions and coarse relief;
- `strata`: tilted/broken band field;
- `microErosion`: high-frequency ridged field gated by turbulence;
- `domainWarp`: destroys regular procedural patterning.

Reference relation:

```text
D1 = D0
   + (rugged - bias) * ruggedDepth
   + (strata - bias) * strataDepth
   - microErosion * microErosionDepth
```

This is not yet the strong part of the screenshot. The strong part comes from discrete negative geometry.

---

## 5. Discrete negative-geometry event library

These events must enter SDF, volume or true mesh geometry; dark color alone is not sufficient.

| Event | Geometry role | Material correlation |
|---|---|---|
| `chips` | irregular edge/corner subtraction | fresh break color, roughness, AO |
| `pits` | shallow ellipsoid subtraction | cavity, roughness, normal |
| `poreClusters` | clustered small cavities | cavity, AO, dark color |
| `deepPores` | capsule bore plus mouth ellipsoid | deep AO, wetness, dark wall, rim normal |
| `poreRimChips` | multiple irregular cutters around mouth | fresh break color, roughness |
| `collapsedPores` | broad asymmetric collapsed mouth/roof | cavity, AO, weathering |
| `cracks` | warped narrow slit/capsule chain | wetness, AO, dark color |
| `erosionBites` | broad edge/body subtraction | weathering, fresh break, roughness |
| `inclusionVoids` | cavity left by lost fibre/grain | organic rim color, AO, roughness |

Signed-distance subtraction convention:

```text
d = max(d, -eventSdf)
```

Deep pores must separately represent mouth, bore, rim damage and optional collapse. Uniform black circles fail this contract.

---

## 6. Exact reference preset: deep-pore broken child

Profile:

```text
old-pbr-fired / 完整 PBR 老砖
```

Child:

```text
index = 2
label = 深孔破碎子代
damageLevel = 0.58
childSeedOffset = 2647
```

The third child adds these shifts to the profile defaults:

```text
damage        +0.16
poreDepth     +0.25
poreDensity   +0.18
poreVariety   +0.22
waterStain    +0.02
weathering    +0.08
colorRichness +0.10
```

Its visual identity depends on:

- multiple pore size classes;
- separate bore, mouth, rim and collapse events;
- large erosion bites together with micro pores;
- correlated cavity color, AO, roughness and normal;
- strong low-frequency material patches, not only high-frequency noise.

Full numeric values are in `REFERENCE_PRESET.json`.

---

## 7. Independent deterministic seeds

Seed layers:

```text
master, shape, damage, pore, color, water, weather, inclusion, detail
```

Child seed formula:

```text
seed[key] = base + profileBias + childOffset * prime[key]
```

Primes:

```text
master 1
shape 3
damage 5
pore 7
color 11
water 13
weather 17
inclusion 19
detail 23
```

Isolation requirements:

- changing `color` must not change geometry;
- changing `pore` changes pore events but not the base form;
- changing `water` changes wet/runoff fields but not pores;
- same full seed DNA and controls must reproduce the same events.

---

## 8. Surface-field stack

Required families:

- gradient/value fBm: broad material patches;
- ridged fBm: ridges, erosion edges and hard relief;
- turbulence: breakup and weathering irregularity;
- Worley/cellular: pore clusters, plate boundaries and separation masks;
- domain warp: removes visibly regular procedural patterns.

Minimum output fields:

```text
rugged
strata
microErosion
rockMap
flow
protrusion
cavity
separation
```

Shape, pore and material coordinates may share a parent domain but need separate phase/seed offsets so that channels correlate without becoming identical.

---

## 9. Event-driven material correlation

For fired-clay reference, the important regions are:

- `redRegion`: bright fired red;
- `deepRedRegion`: deeper firing zone;
- `carbonRegion`: reduction/char zone;
- `ashRegion`: ash-grey zone;
- `oxideEvent`: iron-oxide event;
- `mineralBloom`: pale mineral deposit;
- `waterMask`: gravity runoff and lower dampness.

The same event identity must feed multiple channels:

```text
BaseColor <- event masks + palette
Roughness <- cavity + weathering + wetness + grain
Height    <- rugged + microErosion + rim breakup
Normal    <- height gradient and event orientation
AO        <- cavity + deep pore + crack
Wetness   <- flow + low position + cavity
Mineral   <- exposure + flow + event patch
```

A color-only implementation is not equivalent.

---

## 10. Diagnostic channels

Any receiving implementation should expose at least:

```text
Final
Color
Cavity
Roughness
Normal/Height
Noise/Fields
Water
Inclusion
Strata
```

This is necessary to detect fake geometry, channel mismatch and regular noise artifacts.

---

## 11. Performance layering

- Use true negative geometry for low-count, high-value events.
- Use mesh/SDF/precomputed displacement for medium-scale fields.
- Use shader normal/roughness or bounded displacement for micro detail.
- At distance, preserve low-frequency event/color identity but skip invisible bore-wall sampling.
- Near camera, enable bore walls, mouth breakup and micro erosion.
- Event density must be controlled by object size, screen contribution and budget.

---

## 12. Receiver responsibilities

A receiver such as Landscape Mother must independently:

1. map normalized values to its physical scale;
2. constrain events with its own evidence and domain rules;
3. decide whether a feature needs heightfield, mesh, voxel or SDF representation;
4. use volumetric geometry for real caves/voids/overhangs;
5. prove protected truth receives exact zero geometry delta;
6. perform its own browser, mobile, performance, visual and production QA.

For Landscape specifically, slope, curvature, drainage, lithology, exposure and protected DEM masks are receiver-owned inputs. This package does not place any karst feature.

---

## 13. Failure gates

Fail the transfer if any of the following occurs:

- all holes have one radius or one circular mouth;
- a hole is only a black decal;
- large erosion does not change silhouette or section;
- high-frequency noise covers the whole object like sandpaper;
- color is independent of cavity, water and weathering;
- changing the color seed changes geometry;
- disabling events cannot recover the base form;
- Brick palette, scale or event density is copied directly into another domain;
- a single-value height depression is described as a volumetric cave;
- receiving-Mother implementation is claimed complete before it exists.

---

## 14. Package files

- `REFERENCE_PRESET.json`
- `TRANSFER_CONTRACT.json`
- `src/v26_transfer_kernel.mjs`
- `src/v26_transfer_kernel.test.mjs`
- `PACKAGE_RECEIPT.json`

The external ZIP additionally contains the user-selected reference image and the expanded Markdown documents.

`visualAcceptance=false`

`productionReady=false`
