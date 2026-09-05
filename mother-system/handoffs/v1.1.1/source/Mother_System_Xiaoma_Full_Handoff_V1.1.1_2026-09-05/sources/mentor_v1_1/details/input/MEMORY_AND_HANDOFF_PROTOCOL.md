# Memory and Handoff Protocol

## Problem

Current Mothers often:
- forget previous corrections,
- repeat old mistakes,
- regress to earlier versions,
- hallucinate missing context,
- start implementing before aligning on the goal,
- overwrite correct work with new incorrect assumptions.

This is a system failure, not just a single-model failure.

## Required memory layers

### 1. Raw discussion archive
Preserve original detail.

### 2. Canon
Stable agreements that should not be re-litigated without evidence.

### 3. Decision records
Why a decision was made.
What alternatives were rejected.
What would justify changing it.

### 4. Current world map
What is known now.
What is unresolved.
What is blocked.
What is next.

### 5. Professional Mother memory
Domain-specific knowledge.

### 6. Public technical memory
Cross-domain reusable methods.

### 7. Evidence index
Where the original evidence can be recovered.

## Knowledge states

Every stored item should have one of these states:

- VERIFIED
- ACCEPTED_CANON
- WORKING_HYPOTHESIS
- UNRESOLVED
- REJECTED
- SUPERSEDED
- EXPERIMENTAL

## Before execution

Every Mother should confirm:

1. What is the actual target?
2. What does the user care about most?
3. What previous constraints apply?
4. What evidence do I have?
5. What am I assuming?
6. What could invalidate this approach?
7. What visual or physical test will tell me if I am wrong?

## After execution

Store:
- what changed,
- why,
- evidence,
- result,
- failure,
- whether visual acceptance occurred,
- next action.

## Regression protection

A new iteration must not silently reintroduce a previously rejected error.

Before major modification:
- load relevant canon,
- load known failure list,
- compare against last accepted state,
- check for regressions.

## Meeting memory

Every 12-hour meeting produces:
- shared discoveries,
- reusable methods,
- cross-Mother warnings,
- unresolved questions,
- changes to canon,
- mentor questions accumulated for future batch consultation.
