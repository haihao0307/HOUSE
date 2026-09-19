# 01 — Method Architecture

The selected V2.6 appearance is a coupled stack, not one texture and not one noise function.

```text
Base SDF
→ 3D domain warp
→ continuous rugged / strata / micro-erosion displacement
→ discrete negative-geometry events
→ mesh or SDF extraction
→ shared event fields
→ color / roughness / height / normal / AO / wetness / mineral response
```

## Scale bands

- Macro: silhouette warp, large erosion bites, broad collapse.
- Meso: deep pores, clusters, cracks, strata and runoff.
- Micro: pits, grain, micro-erosion, roughness and normal residual.

## Why it is stronger than Microscope alone

Microscope is strongest as a continuous multi-scale residual. V2.6 adds topology-relevant volume loss: bores, mouths, rim chips, collapse, cracks and broad bites. The strong reference image comes from combining both continuous fields and discrete cutters.

## Base recovery

The transfer must expose a strict bypass in which all transfer geometry is disabled. The receiving base form must then be recovered exactly, subject only to its own unchanged implementation.
