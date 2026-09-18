# 02 — Geometry Event Library

## Chips

Irregular cutters near corners and edges. Use asymmetrical radii and event-specific noise. They must affect silhouette when large enough.

## Pits

Shallow ellipsoid subtraction. Pits are not deep pores and should not all become circular black marks.

## Pore clusters

Small cavities share a low-frequency parent mask. They should form families rather than uniform salt-and-pepper noise.

## Deep pores

A deep pore has four identities:

1. mouth ellipsoid;
2. bore capsule or tunnel;
3. rim-chip family;
4. optional collapsed roof/mouth.

The bore, mouth and rim must be separately inspectable.

## Collapsed pores

Broad, asymmetric subtraction around selected large pores. The collapse probability is tied to pore scale and variety, not applied uniformly.

## Cracks

Warped narrow slits or capsule chains. Crack identity is controlled by its own seed. Material response should include dampness and AO but geometry identity remains independent of color.

## Erosion bites

Large, low-count cutters that remove edge/body volume and produce the broad eroded masses visible in the reference.

## Inclusion voids

Loss cavities from fibres, hulls or grains. They preserve an organic-event identity so the rim can receive a different material response.

## Boolean rule

For signed distance fields:

```text
dResult = max(dBase, -dEvent)
```

Receivers using meshes or voxels must preserve equivalent subtraction semantics.
