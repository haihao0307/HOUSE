# Brick Mother R2.9 — edge-only Yohei correction

This iteration restarts from the accepted R2.4 macro body. The body dimensions, planar faces, material and overall silhouette are locked. The uploaded scan is used only to observe local edge/corner residuals.

The 12 brick edges are treated as independent local domains. For each edge, scan points are reduced to a one-dimensional residual profile after removing the low-frequency face trend, then represented by a multi-scale sine/cosine basis. The field is multiplied by a narrow two-face edge kernel, so it cannot move the face interior. Eight corner observations are handled with a three-face corner kernel; only excess erosion relative to the scan's median corner condition is transferred.

No scan color is used. No scan dimensions replace the R2.4 dimensions. No hand-placed chip spheres are used. No whole-face bulge field is used. B material remains frozen at microscope on, strength=1, scale=1, height=1, roughness contribution=0.
