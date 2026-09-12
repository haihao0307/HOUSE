# Brick Mother R2.1 — central microscope pole repair

Scope: repair the radial pinching artifact identified by the user. Preserve the accepted R2 material direction, original process masks, colors, pores, parameter presets, geometry, camera and light. Edge/shape reference is still pending and this version does not redesign the brick. R2 remains frozen.

The original atan(q.x,q.y) is undefined on the axis crossing the front/back face centers. Regularize its cosine-equivalent coordinate with a localized positive angular radius, and use acos instead of the discontinuous atan branch. The existing dyadic 17-layer cosine cell and footprint gating remain. No independent noise source or baked texture is added. The repair radius is tied to object coordinates across the scale slider. Both comparison panels receive the fix; the reference preset is labelled as the repaired baseline.

Local Chrome/WebGL2 regression: 29 checks passed, no console/page errors. Front and rear close-up captures inspected. Additional CPU continuity checks pass for both poles at scale 0.25, 1 and 4, without relying on screen gating. Source comparisons verify processMaterial and geometry map unchanged. These are technical checks, not an assertion of final user acceptance or real-world measurement accuracy.

Files LOCAL_QA.json and POLE_CONTINUITY.json record these tests. The continuation workspace retains scripts and screenshots. Fixed public verification is recorded after publishing; the first publish commit is the immutable preview target.

User feedback: R2 material appearance is basically accepted except the central artifact. Full object approval and production approval are not asserted. Await the user's specific edge reference after this repair. Carry the two adjacent Mother rules into subsequent handoffs and issue future changes at separate immutable HTTPS URLs.
