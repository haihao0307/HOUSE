# Public Technical Knowledge Map

## Principle

Named software is a source, not the architecture.

For every source:
1. study the mature ideas,
2. identify the problem it solves,
3. extract causal and structural relations,
4. remove product-specific naming,
5. remove human-interface baggage,
6. preserve the generalizable method,
7. map the method to Mothers,
8. keep the original source only for traceability.

## 1. Houdini / SideFX

Priority: very high

What to extract:
- procedural networks
- attributes
- data flow
- geometry processing
- simulation
- fields
- volumes
- heightfields
- dependency graphs
- digital asset encapsulation
- reusable procedural tools
- procedural task scheduling
- cross-application interchange
- animation relationships
- rigging abstractions
- terrain erosion relationships
- caching and dirty/clean dependency logic

What not to preserve as core:
- UI layout
- keyboard shortcuts
- product-specific node names
- licensing details
- implementation baggage

High-value conceptual lessons:
- actions form reusable recipes,
- attributes travel through a dependency graph,
- state changes should propagate only where needed,
- procedural assets expose meaningful high-level controls,
- simulations should be separable from presentation,
- task graphs can avoid recomputing unaffected work.

## 2. Gaea / QuadSpinner

Priority: very high for terrain

What to extract:
- landform decomposition
- large form before micro detail
- erosion
- sediment
- masks
- scale
- river / drainage relation
- terrain layering
- terrain synthesis and art direction

Goal:
turn terrain from arbitrary noise into a causally organized landform model.

## 3. Adobe Substance 3D Designer

Priority: very high for materials

What to extract:
- non-destructive material graphs
- height / roughness / color / normal separation
- procedural pattern generation
- multi-scale texture structure
- wear
- dirt
- age
- masks
- material response to environment
- reusable material functions

Goal:
make materials generative and temporally responsive.

## 4. Unreal Engine

Priority: high

Role:
world stage, real-time presentation, lighting, atmosphere, scene organization.

What to extract:
- lighting relationships
- indirect light concepts
- shadow quality logic
- reflection logic
- atmosphere
- fog
- sky
- post-processing
- large-world streaming principles
- scene organization
- procedural spatial relationships
- biome relationships
- hierarchical generation
- runtime quality vs performance decisions
- cinematic and interactive presentation

Important:
product framework is not the goal.

The useful knowledge is the relational logic.

## 5. Unreal procedural content ideas

Priority: high for relationship modeling

What to extract:
- parent-child ecological relation
- spatial filtering
- density
- hierarchical scale
- local context
- rules conditioned by surrounding world state
- recursive placement
- distribution based on fields and attributes

Translate to:
environmental relationship fields and causal ecology.

## 6. Blender

Priority: medium to high as an open long-term public reference

What to extract:
- general mesh representation
- curve systems
- modifiers
- geometry nodes
- rigging
- constraints
- animation
- Python API
- data model
- interchange
- modeling patterns

Use:
broad open reference and implementation comparison.

Do not let Blender define the system architecture.

## 7. INSYDIUM / X-Particles

Priority: high for particles and multi-body behavior

What to extract:
- fields
- forces
- particle state
- collisions
- fluids
- cloth-like behavior
- foam
- spray
- flow maps
- group behavior
- solver selection
- local individual rule → emergent global pattern

Translate to:
field-driven dynamic world behavior.

## 8. Three.js

Priority: high for lightweight web runtime

What to extract:
- scene graph
- lightweight real-time rendering
- camera
- hierarchical transforms
- animation mixing
- skeletal animation concepts
- morph targets
- browser rendering
- post-processing
- WebGPU pathway
- portable interactive visualization

Potential long-term role:
compact execution and visualization layer for distilled world knowledge.

## 9. Meshy / Tripo

Priority: very low

Status:
external phenomenon record only.

Do not absorb into formal production data flow.

Reason:
they demonstrate fast rough 3D-form estimation, but their resulting geometry, UVs, materials, and semantic understanding are not trusted enough to enter the knowledge pipeline.

Keep only the note:
fast text/image/multiview → rough 3D form is an existing external capability.

Do not invest effort unless a future research question specifically requires it.
