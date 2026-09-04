# Brick Mother Recovery Execution Plan V1

## Objective

Restore the V2.7.5 workbench as the only default entry, preserve every useful visual result, rebuild the PBR candidate through verified material events, and stop repeated visual regressions.

The public deliverable remains a directly openable interactive HTML workbench. Static image generation is outside this production route.

## Source contract

The PBR implementation is governed by *The PBR Guide*, third edition, 2018. The project uses the following source-supported rules:

1. Physically plausible shading uses a reciprocal, energy-conserving BRDF. The guide describes Substance PBR shaders using Disney principled reflectance with GGX microfacet distribution.
2. Common masonry materials are dielectrics. Their metalness is zero and common dielectric F0 normally lies between 0.02 and 0.05 in linear space, with 0.04 as the usual metal/roughness default.
3. Base Color is visible color data interpreted as sRGB. Roughness, Metallic and Height are data interpreted linearly. Lighting computations occur in linear space.
4. Dielectric Base Color excludes baked illumination and ambient occlusion. Dark values stay above the guide's tolerant 30 sRGB or stricter 50 sRGB threshold, and bright values remain below 240 sRGB.
5. Roughness represents sub-texel surface irregularity. Important surface condition and Normal details should also be represented in Roughness where physically appropriate.
6. AO is supplied independently and modulates ambient diffuse lighting only. It must not suppress the direct specular contribution.
7. Real-time Height emphasizes overall form and silhouette with reduced high-frequency content. Normal carries high-frequency surface detail.
8. PBR validation must inspect channel values and final appearance under more than one lighting condition.

The guide does not define the manufacturing, geology or weathering of Yunnan bricks and building stone. Those rules require independent material evidence and must be marked as project evidence, project inference or unresolved hypothesis.

## Recovery sequence

### R0. Restore entry hierarchy

Tasks:

1. Keep `brick-mother-standalone-v2.7.5.html` byte-identical and use it as the unique default entry.
2. Keep `index.html` as a modular development entry.
3. Reclassify V1.2 through V1.4 as rejected visual experiments.
4. Make all candidate pages opt-in and visibly marked as unapproved.
5. Add same-camera comparison only after a new candidate passes internal review.

Exit gate:

The default public link opens V2.7.5. No experimental runtime loads until selected.

### R1. Measure V2.7.5 startup without changing its appearance

Measure separately:

1. HTML response and DOM content loaded.
2. stylesheet and script completion for the modular entry.
3. WebGL context creation.
4. shader compilation and linking.
5. first canvas paint.
6. first retained hero specimen.
7. complete three-family batch.
8. first usable interaction.
9. idle render count.

Optimization order:

1. preserve the existing rendered result,
2. display one hero specimen before secondary specimens,
3. move secondary geometry generation off the main thread where feasible,
4. precompile the retained shader set,
5. update shadows only after geometry, camera or lighting changes,
6. stop continuous rendering while idle,
7. cap device pixel ratio by measured device capability.

Exit gate:

Performance changes must produce the same seed, same camera, same lighting and same final pixels within the documented tolerance.

### R2. Build material truth records

Create separate records for:

1. fired clay brick,
2. adobe,
3. dressed ashlar,
4. roughly squared stone,
5. coursed or uncoursed rubble,
6. flagstone,
7. construction cobble.

Each record separates:

1. parent material or lithology,
2. manufacturing or quarrying process,
3. construction morphology,
4. building placement,
5. fresh damage,
6. weathering and moisture,
7. PBR channel response,
8. evidence status.

Exit gate:

Every default rule has a source or an explicit project-inference label. Unknown values remain adjustable hypotheses.

### R3. Grey-form approval before material work

Initial grey-form set:

1. one fired brick,
2. one layered rubble stone,
3. one flagstone,
4. one construction cobble.

Required views:

1. front three-quarter,
2. rear three-quarter,
3. top,
4. underside and bearing contact,
5. raking side view,
6. masonry placement view,
7. close-up of fracture or bedding.

Shape rejection criteria:

1. generic rounded box,
2. uniform ellipsoid cobble,
3. flagstone produced by simple vertical scaling,
4. excessive soft deformation,
5. unstable bearing surface,
6. evenly distributed chips,
7. identical edge grammar across all families.

Exit gate:

No color texture or weathering pass starts until the selected grey form is accepted internally.

### R4. Shared event graph for one fired brick

The first material candidate contains a single fired brick. It retains the strongest V2.7.5 geometry, color grouping, cavity and damage behavior.

Material events:

1. clay body,
2. temper and mineral inclusion,
3. forming and cutting,
4. firing gradient,
5. vitrified local patch,
6. pore and blowout cavity,
7. edge spall,
8. shallow delamination,
9. fresh fracture,
10. ash or reduced firing mark,
11. powdering,
12. deposit,
13. absorbed moisture,
14. surface water film.

Each event produces spatially correlated outputs for Base Color, Roughness, Height, Normal, AO, porosity and moisture retention. Independent decorative noise is forbidden.

Frequency rules:

1. macro fields define firing zones, broad warping and major loss,
2. meso fields define pores, fractures, inclusions and powdering,
3. micro fields define clay grain and microfacet Roughness,
4. micro detail remains localized and cannot cover every surface uniformly.

Exit gate:

The brick reads consistently under daylight, neutral, raking, overcast and outdoor lighting. The same event remains aligned across all diagnostic channels.

### R5. Rebuild construction stone one family at a time

Order:

1. layered rubble,
2. flagstone,
3. construction cobble,
4. dressed ashlar,
5. roughly squared stone,
6. irregular rubble.

Stone coordinates:

1. lithology or parent rock,
2. processing morphology,
3. building placement.

Construction cobble grammar:

1. asymmetric parent rock,
2. a dominant transport axis,
3. non-uniform water rounding,
4. retained fracture memory,
5. localized impact scars,
6. stable bearing contact,
7. mortar embed depth,
8. realistic construction scale.

Flagstone grammar:

1. dominant bedding plane,
2. continuous but varying thickness,
3. layer-parallel splitting,
4. local delamination,
5. sharp and weathered edge coexistence,
6. stable stacking or paving contact.

Exit gate:

Each family has a distinct silhouette, distinct material response and a credible building-use demonstration.

### R6. Lock two lighting stages

Validation stage:

1. neutral light-grey cyclorama,
2. fixed white balance and exposure,
3. broad daylight key,
4. restrained fill,
5. optional raking light,
6. matte neutral plinth,
7. no decorative reflections.

Product stage:

1. warm-light neutral daylight environment,
2. matte timber board with restrained grain,
3. broad key and soft fill,
4. controlled rear edge light,
5. natural ground bounce,
6. minimal label and scale reference.

Exit gate:

The material remains credible in the validation stage before it enters the product stage. Lighting cannot be tuned separately to hide a weak material.

### R7. Comparison and promotion

Comparison controls:

1. same seed,
2. same geometry scale,
3. same camera transform,
4. same lighting,
5. same exposure,
6. same view occupancy,
7. same diagnostic channel.

Promotion requires:

1. runtime checks pass,
2. grey-form gate passes,
3. event-channel correlation passes,
4. PBR value validation passes,
5. daylight and raking-light review pass,
6. no regression against V2.7.5 strengths,
7. explicit user visual approval.

## Immediate execution batch

The current batch is limited to these tasks:

1. freeze and register V2.7.5,
2. mark V1.4 as rejected and non-default,
3. instrument V2.7.5 startup,
4. create material truth records for fired brick, layered rubble, flagstone and construction cobble,
5. build grey forms only,
6. keep all public approvals false.

## Permanent delivery rule

Every user-facing delivery includes one directly openable HTML link. The link opens the retained V2.7.5 core unless a newer candidate has explicit user approval. The message must state the exact runtime and approval state.
