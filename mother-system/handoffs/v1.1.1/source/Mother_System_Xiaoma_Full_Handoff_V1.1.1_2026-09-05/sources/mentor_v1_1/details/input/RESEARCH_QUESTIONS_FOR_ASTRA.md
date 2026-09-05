# Research Questions for Astra

This is a mentor-level research task.

Please study the entire package before answering.

Do not give a shallow list of tips.

## A. Architecture

1. What is the strongest architecture for a long-lived multi-Mother learning ecosystem?
2. Which parts of our current conceptual structure are sound?
3. Which parts are confused, overgeneralized, or likely to fail?
4. What should be separated that we currently mix together?
5. What should be unified that we currently keep separate?
6. How should the coordinator, specialist Mothers, public technical memory, evidence memory, and periodic mentor relate?

## B. Learning method

7. Design a reusable learning loop for a Mother entering a new domain.
8. How should observation, hypothesis, evidence, generation, comparison, and correction be sequenced?
9. How can an agent learn structure from visual references without blindly copying meshes or pixels?
10. How can the system improve visual judgment?
11. How can it distinguish a true structural feature from surface appearance?
12. How can it avoid getting trapped in a wrong optimization loop?

## C. Shape understanding

13. Propose a rigorous shape-distillation representation that works across:
- rocks,
- terrain,
- buildings,
- aircraft,
- machines,
- animals,
- plants,
- human bodies.

14. Which geometric primitives, fields, constraints, graphs, descriptors, and residual representations should be used?
15. How should multiple scales be represented?
16. How can sparse views be converted into testable 3D hypotheses?

## D. Materials

17. Propose a causal material representation that includes:
- substrate,
- fabrication,
- scale,
- wear,
- damage,
- moisture,
- dirt,
- oxidation,
- biological growth,
- age,
- environment response.

18. How should material knowledge be shared across Mothers without making all materials generic?

## E. Physics and relationships

19. How should the system represent object-to-object and object-to-environment relationships?
20. Is a field-based representation appropriate for ecology, weather, human activity, coastlines, material aging, and movement?
21. Where should graph relations be used instead?
22. How should local and global constraints interact?

## F. Memory

23. Design a memory system that compresses knowledge while preserving recoverable detail.
24. How should canon, raw evidence, decisions, hypotheses, rejected routes, and current state be separated?
25. How can retrieval be made reliable enough that agents stop repeating known mistakes?
26. How should regression tests work for non-code visual knowledge?

## G. Geographic and historical evidence

27. How should we combine:
- DEM,
- SAR,
- optical satellite imagery,
- aerial imagery,
- historical maps,
- OSM,
- geology,
- climate,
- local oral history,
- photographs,
- archives,
- museum evidence,
- human expert knowledge?

28. How should conflicting evidence be represented?
29. How can historical reconstruction preserve uncertainty honestly?

## H. Compression

30. Investigate our geographic-data question:
Why can a distilled DEM/world dataset remain hundreds of MB?
31. Separate irreducible spatial information from redundant representation.
32. Propose ways to encode a terrain/world as:
- generative rules,
- basis functions,
- multi-resolution residuals,
- vector structure,
- semantic fields,
- procedural seeds,
- sparse corrections.

33. What types of information can be losslessly reconstructed from compact representation, and which cannot?

## I. Public knowledge commons

34. Design a contribution model where local people can add regional knowledge without destroying quality.
35. How should provenance, confidence, conflict, expert review, and versioning work?
36. How can disappearing traditional knowledge be preserved?
37. How can public contribution feed a historical game/world without turning into misinformation?

## J. Resource navigation

38. Build us a complete resource map.

For each major capability, identify:
- best books,
- best academic fields,
- best research groups,
- best open-source projects,
- best professional communities,
- best software references,
- best datasets,
- best standards,
- best benchmark methods,
- experts or expert categories we should seek.

Capabilities include:
- procedural modeling
- terrain
- erosion
- materials
- lighting
- atmosphere
- ocean/coast
- weather
- plants
- ecology
- architecture
- historical reconstruction
- mechanical systems
- aircraft
- animation
- animal movement
- human movement
- perception
- computer vision
- shape analysis
- spatial reasoning
- 3D reconstruction
- simulation
- world streaming
- WebGPU
- real-time rendering
- GIS
- remote sensing
- archival research
- knowledge representation
- memory systems
- provenance systems
- collaborative knowledge systems

We want the map now so that later, when we are already on the road, we know where to go without consulting the mentor for every small issue.

## K. Critique

39. Identify our 20 most dangerous hidden assumptions.
40. Identify the 20 most important capabilities we currently lack.
41. Identify concepts that sound attractive but should be rejected.
42. Identify where existing mature systems already solved something we are unnecessarily reinventing.
43. Identify where our approach may genuinely differ from current mainstream pipelines.

## L. Roadmap

44. Propose:
- 1-week architecture repair plan
- 1-month learning-system plan
- 3-month Mother-system plan
- 12-month open-world knowledge plan

45. Define measurable milestones.
46. Define stop conditions when a Mother is trapped in a bad loop.
47. Define when a specialist Mother is mature enough to merge with adjacent Mothers.
