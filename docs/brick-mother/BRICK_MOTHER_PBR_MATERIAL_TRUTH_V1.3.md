# Brick Mother PBR Material Truth V1.3

## Purpose

This document defines the material truth contract for the Brick Mother interactive HTML studio. It separates principles supported by *The PBR Guide*, third edition, from Brick Mother implementation choices used for fired clay, adobe and masonry stone.

The delivery target is a directly openable real-time three-dimensional HTML workbench. Static concept images are excluded from the production route.

## Source-derived PBR rules

The following rules come from *The PBR Guide*, third edition, 2018.

### Light transport and microfacets

1. Surface roughness represents sub-texel surface irregularity and changes the distribution of reflected light. A rough surface produces a broader and visually dimmer highlight while conserving the same total reflected energy. See pages 22 and 25 through 27.
2. The material shader uses a physically plausible BRDF. The Substance shaders described in the guide use a Disney principled model with the GGX microfacet distribution. See pages 28 and 29.
3. Energy conservation is enforced by the shader. Reflected and scattered energy cannot exceed incoming energy. See page 30.
4. Fresnel response is angle dependent. Common dielectrics have F0 values around 0.02 to 0.05 in linear space, with 0.04 as the common metal/roughness workflow default. See pages 31, 32, 48 and 49.

### Color spaces and channel semantics

1. Visible color data such as Base Color is interpreted as sRGB. Attribute data such as Roughness, Metallic and Height is interpreted as linear. Lighting calculations occur in linear space. See pages 38 through 40.
2. Dielectric Base Color should contain reflected diffuse color without baked lighting or ambient occlusion. The guide gives a tolerant dark limit near 30 sRGB, a stricter limit near 50 sRGB and a bright limit near 240 sRGB. See pages 51 through 53.
3. Fired clay, adobe and common masonry stone are treated as dielectrics. Their Metallic value is fixed to zero in this workbench.
4. AO is an independent channel. It modulates the ambient diffuse contribution and does not darken the specular contribution. See page 74.
5. Height carries broad, low-frequency form and silhouette displacement in a real-time shader. Normal carries high-frequency surface detail. See pages 75 through 78.
6. PBR validation must inspect illegal albedo and reflectance ranges rather than relying only on the final beauty view. See pages 82 through 85.

## Brick Mother implementation choices

The following decisions are project-specific engineering and art-direction choices. They are not numerical claims from the guide.

### Material families

The runtime keeps six isolated material families:

1. Fired clay brick
2. Adobe
3. Dressed ashlar
4. Semi-regular rubble
5. Flagstone
6. Cobble

Each family has its own palette, porosity, hardness, roughness range, pore grammar, fracture grammar and weathering response. Global controls act only as documented deltas or multipliers.

### Scale hierarchy

Material construction follows three separated frequency bands:

1. Macro scale defines silhouette, bearing planes, broad warping, major chips and large color zones.
2. Meso scale defines pores, fracture shelves, bedding, tool marks, inclusions, erosion pockets and localized weathering.
3. Micro scale defines grains, powder, fine scratches and microfacet roughness variation.

High-frequency noise cannot drive Base Color uniformly over the whole object. This rule prevents pepper noise, repeated dots and the former chocolate-like surface response.

### Event-driven channels

A shared event field drives related channels together. Examples include:

1. A cavity event lowers Height, changes Normal, retains moisture, raises local AO and changes Roughness.
2. A fresh fracture event exposes a lighter or differently saturated Base Color, creates a sharper Normal response and changes Roughness according to the family.
3. A deposit event alters Base Color and Roughness while remaining independent from baked lighting.
4. A contact event affects retained moisture, dirt and AO near the bearing surface.

The same event must remain spatially correlated across Base Color, Roughness, Normal, Height, AO and weathering state.

### Wetness model

Wetness is represented as a layered response:

1. Absorbed moisture darkens porous dielectrics and changes their roughness moderately.
2. A thin surface water film uses a separate clearcoat-like lobe with water-level F0 near 0.02.
3. Wetness does not globally replace the dry roughness field with a polished surface.
4. Runoff, cavity and contact signals determine where moisture accumulates.

### Presentation lighting

The default studio is a bright daylight material stage with:

1. A large warm-neutral key light that reveals overall form.
2. A broad cool-neutral fill that keeps shadow detail readable.
3. A restrained rim light for silhouette separation.
4. A light neutral cyclorama and matte plinth.
5. Neutral, raking, overcast and outdoor validation modes.

The beauty view must remain readable without a black background. Diagnostic views must remain available for Base Color, Roughness, Normal, Height, AO, wetness, runoff, cavity, fracture, slope, contact, deposit, salt and biological attachment.

## Runtime and delivery requirements

1. `studio.html` and `studio-v1.3.html` are directly openable public HTML entries.
2. The studio is self-contained for rendering code and embeds its geometry worker.
3. The first visible specimen is generated progressively. A preview mesh appears before all four specimens finish.
4. Rendering stops when the view is idle and resumes after interaction or simulation changes.
5. Controls hide automatically for an immersive presentation and return through a tap or side buttons.
6. Desktop and mobile layouts must pass real-browser interaction checks.
7. The preserved V2.7.5 core blob remains `7b10389cb9367f7423619262820883cc94b07a61`.
8. `humanVisualApproved` and `productionApproved` remain `false` until explicit user approval.

## Rejection criteria

The candidate fails internal review when any of the following is visible:

1. Uniform high-frequency speckle covering all surfaces.
2. Brown, glossy and smooth response that reads as chocolate, wax or plastic.
3. Repeated mechanical grooves or equally spaced layer bands without a material cause.
4. Black presentation background that hides roughness and shape information.
5. AO baked into Base Color or applied to the direct specular lobe.
6. Height dominated by high-frequency noise.
7. Normal dominated by broad silhouette-scale distortion.
8. Identical material grammar shared across all six families.
9. A loading curtain replacing the previous specimen during parameter adjustment.
10. A public link published before real-browser runtime and interaction checks pass.
