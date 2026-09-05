# World Learning Model

## 1. The system should learn reality, not labels

A recurring failure mode in current AI systems is overreliance on labels and probabilistic guessing.

The desired system should increasingly reason in terms of:
- physical identity,
- causal constraints,
- geometry,
- material,
- state,
- relationship,
- time,
- location.

For example, once sufficient evidence establishes that an observed physical object is water in a given state, the system should reason from the properties and constraints of water. It should not casually blend mutually exclusive identities just because multiple labels were statistically plausible earlier.

Uncertainty still exists at the observation stage. Once identity is resolved, downstream reasoning should respect the resolved state.

## 2. Observation has multiple stages

A robust observation pipeline should separate:

1. Raw evidence
2. Candidate interpretations
3. Measurements
4. Structural hypotheses
5. Identity hypothesis
6. Confidence
7. Contradictions
8. Verification
9. Resolved object model

This prevents early guesses from silently becoming facts.

## 3. Shape distillation

When observing an external object, the system should seek a compact structural description:

- global bounding shape
- principal axes
- scale
- symmetry
- major masses
- voids
- silhouette
- curvature transitions
- planar regions
- cylindrical regions
- spherical regions
- taper
- repetition
- joints
- support relationships
- thickness
- contact relationships
- deformation
- weathering
- fracture
- manufacturing traces
- biological growth traces

The result should be a generative description, not a copied mesh.

## 4. Material distillation

Material understanding should separate:
- substrate,
- manufacturing process,
- grain / pore / fiber structure,
- surface damage,
- edge wear,
- moisture response,
- oxidation,
- dirt accumulation,
- biological growth,
- age,
- lighting response,
- scale-dependent variation.

A material should become a causal model that can change with environment and time.

## 5. Relationship fields

Objects modify local conditions.

Examples:
- trees change shade, humidity, leaf litter, root competition,
- rivers change moisture, erosion, deposition, vegetation,
- roads change human movement, drainage, disturbance,
- buildings alter wind, shade, runoff, use intensity,
- slopes alter solar exposure, soil depth, drainage,
- ocean proximity alters humidity, salt exposure, vegetation.

Therefore, the world should not be generated as isolated objects placed by lookup rules.

Each object may emit or modify fields:
- light
- moisture
- heat
- salinity
- wind
- disturbance
- accessibility
- fertility
- erosion
- human activity
- animal activity
- visibility
- sound
- hazard

Other objects respond to these fields.

## 6. Multi-scale reasoning

Reality must be represented at multiple scales.

Example:
- continent
- region
- watershed
- valley
- settlement
- block
- building
- room
- wall
- brick
- grain

The correct rule at one scale may be meaningless at another.

A Mother must always identify the scale of the current problem before selecting a method.

## 7. Time evolution

Objects are not static.

Every domain should support temporal evolution:
- weathering
- erosion
- growth
- decay
- repair
- replacement
- migration
- construction
- destruction
- seasonal change
- human modification
- climate influence

The world should be reconstructable for different time slices from preserved knowledge.

## 8. Hypothesis discipline

Before acting, a Mother should internally distinguish:

FACT:
supported directly by evidence.

INFERENCE:
derived from evidence and known rules.

HYPOTHESIS:
plausible but unverified.

UNKNOWN:
no defensible conclusion yet.

CONSTRAINT:
must remain true if the model is correct.

This distinction should be preserved in memory and handoff files.
