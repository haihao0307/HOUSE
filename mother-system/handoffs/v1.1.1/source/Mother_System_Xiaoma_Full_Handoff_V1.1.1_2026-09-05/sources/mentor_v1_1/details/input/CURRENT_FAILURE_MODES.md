# Current Failure Modes

## 1. Visual blindness

Symptoms:
- generated work remains visually wrong even after many iterations,
- agent cannot reliably compare reference and output,
- small but essential errors persist,
- aesthetic judgment is weak,
- proportions drift,
- contact and support relationships are missed,
- lighting can hide geometry errors.

Affected examples:
- Landscape
- Weather detail
- Tiles
- Aircraft
- character body and motion
- materials

Research need:
a stronger observation, visual decomposition, and evidence-driven comparison system.

## 2. Wrong-loop convergence

Symptoms:
- agent starts from a wrong assumption,
- every later iteration optimizes the wrong target,
- user repeats corrections,
- progress plateaus,
- agent gives the impression of work but the main visual does not improve.

Need:
pre-execution alignment + falsifiable checkpoints.

## 3. Memory regression

Symptoms:
- fixed errors return,
- old routes reappear,
- agent forgets canonical assets,
- user must restate constraints.

Need:
canon retrieval + regression gate.

## 4. Hallucinated world model

Symptoms:
- agent invents unsupported construction details,
- agent makes visually plausible but physically impossible geometry,
- agent substitutes generic knowledge for local evidence,
- agent treats guesses as facts.

Need:
fact / inference / hypothesis separation.

## 5. Weak shape distillation

Symptoms:
- external reference is seen as a picture rather than a structural object,
- silhouette may be copied while thickness/support/joint logic is missed,
- copied local detail cannot generalize.

Need:
multi-view structural observation and parameter extraction.

## 6. Weak material causality

Symptoms:
- surface looks like a generic texture,
- dirt/weathering is decorative,
- age is random noise,
- moisture and wear are not connected to environment.

Need:
material state model tied to time and environment.

## 7. Tool-framework contamination

Risk:
mature software frameworks can become mistaken for the world model.

Need:
extract knowledge, not UI or product architecture.

## 8. Data bloat

Problem:
distilled geographic data sometimes remains hundreds of megabytes.

Open research question:
which parts are irreducible factual fields, which parts are redundant representation, and which parts can be regenerated from compact rules plus residuals?

## 9. Too much conversation, too little accumulation

Need:
short problem-answer cycles,
then thought,
then experiments,
then knowledge update.

No endless conversational drift.
