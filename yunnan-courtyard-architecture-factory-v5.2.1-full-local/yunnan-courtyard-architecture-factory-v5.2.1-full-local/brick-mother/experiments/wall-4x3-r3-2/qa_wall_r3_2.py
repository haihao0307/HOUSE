#!/usr/bin/env python3
"""Independent static QA for Brick Mother 4 m x 3 m wall R3.2.

The audit reads inert JSON facts embedded in the HTML and recomputes the
important identities and counts.  It deliberately does not trust pass/fail
labels published by the workbench itself.  In particular, the accepted
R2.14.8.1 edge-learning brick is checked down to all 336 residual values.

This is a deterministic source/contract audit, not human visual approval.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterable, Iterator, Mapping, Sequence


HERE = Path(__file__).resolve().parent
DEFAULT_HTML = HERE.parents[1] / "Brick_Mother_Wall_4x3_R3_2.html"

FIXED_SOURCE_COMMIT = "7362f830bcac83a0883e7855fa5d41ee30e52718"
FIXED_SOURCE_BLOB = "19315c0094234f68aad6a1fadc32aeea1725aab6"
FIXED_DIMENSIONS_M = (0.24, 0.06115, 0.11077)  # length, height, width
FIXED_MODEL_SCALE = 0.1153846154
FIXED_RESIDUAL_COUNT = 336
FIXED_RESIDUAL_SHA256 = "ff364ea7025e7a4ae234ffc1bff97b4a6ed181ed350924c5724b0a42635a827d"
FIXED_MATERIAL_ID = "R2.1-B"
FIXED_MATERIAL_VECTOR = (1.0, 1.0, 1.0, 0.0)

WALL_DIMENSIONS_M = (4.0, 3.0, 0.48923)  # width, height, thickness
COURSE_COUNT = 43
BED_JOINT_M = 0.008822619
BRICK_TOTAL = 1420

SOIL_COUNT = 1
SOIL_NOMINAL_SETBACK_M = 0.010
SOIL_AMPLITUDE_M = 0.0025
SOIL_MINIMUM_SETBACK_M = 0.005

EPS = 1e-9
DIM_TOL = 2e-6
MODEL_SCALE_TOL = 5e-10
JOINT_TOL = 5e-9

FORBIDDEN_R3_TOKENS = (
    "brickLocalMesh",
    "roundedPoint",
    "addPanelSurface",
    "addPlaster",
)


class JsonScriptParser(HTMLParser):
    """Collect every named application/json script and the canvas count."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.scripts: dict[str, str] = {}
        self.canvas_count = 0
        self._active_id: str | None = None
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_map = {key.lower(): (value or "") for key, value in attrs}
        lower_tag = tag.lower()
        if lower_tag == "canvas":
            self.canvas_count += 1
        if (
            lower_tag == "script"
            and attrs_map.get("type", "").lower() == "application/json"
            and attrs_map.get("id")
        ):
            self._active_id = attrs_map["id"]
            self._parts = []

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "script" and self._active_id is not None:
            self.scripts[self._active_id] = "".join(self._parts).strip()
            self._active_id = None
            self._parts = []

    def handle_data(self, data: str) -> None:
        if self._active_id is not None:
            self._parts.append(data)


def add_check(report: dict[str, Any], name: str, passed: bool, evidence: Any) -> None:
    report["checks"][name] = {"passed": bool(passed), "evidence": evidence}


def close_numbers(actual: Iterable[float], expected: Iterable[float], tol: float) -> bool:
    a = tuple(actual)
    b = tuple(expected)
    return len(a) == len(b) and all(math.isfinite(x) and abs(x - y) <= tol for x, y in zip(a, b))


def number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def normalized_key(key: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(key).lower())


def walk(value: Any, path: tuple[str, ...] = ()) -> Iterator[tuple[tuple[str, ...], Any]]:
    yield path, value
    if isinstance(value, Mapping):
        for key, child in value.items():
            yield from walk(child, path + (str(key),))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from walk(child, path + (str(index),))


def mapping_value(mapping: Mapping[str, Any], *keys: str) -> Any:
    wanted = {normalized_key(key) for key in keys}
    for key, value in mapping.items():
        if normalized_key(key) in wanted:
            return value
    return None


def recursive_named_values(root: Any, *keys: str) -> list[tuple[str, Any]]:
    wanted = {normalized_key(key) for key in keys}
    found: list[tuple[str, Any]] = []
    for path, value in walk(root):
        if path and normalized_key(path[-1]) in wanted:
            found.append((".".join(path), value))
    return found


def select_manifest(objects: Mapping[str, Any]) -> tuple[str | None, dict[str, Any] | None]:
    preferred = (
        "brick-wall-r3-2-manifest",
        "brick-wall-manifest",
        "wall-4x3-manifest",
        "brick-bond-manifest",
    )
    for script_id in preferred:
        candidate = objects.get(script_id)
        if isinstance(candidate, dict) and (
            isinstance(candidate.get("canonicalKernel"), dict)
            or isinstance(candidate.get("freeze"), dict)
        ):
            return script_id, candidate
    for script_id, candidate in objects.items():
        if (
            isinstance(candidate, dict)
            and (
                isinstance(candidate.get("canonicalKernel"), dict)
                or isinstance(candidate.get("freeze"), dict)
            )
            and isinstance(candidate.get("wall"), dict)
            and isinstance(candidate.get("soil"), dict)
        ):
            return script_id, candidate
    return None, None


def vector(value: Any, length: int) -> tuple[float, ...] | None:
    if not isinstance(value, (list, tuple)) or len(value) != length:
        return None
    converted = tuple(number(item) for item in value)
    if any(item is None for item in converted):
        return None
    return converted  # type: ignore[return-value]


def wall_dimensions(wall: Mapping[str, Any]) -> tuple[float, float, float] | None:
    raw = mapping_value(wall, "dimensionsM", "wallDimensionsM", "envelopeM", "sizeM")
    direct = vector(raw, 3)
    if direct is not None:
        return direct
    if isinstance(raw, Mapping):
        width = number(mapping_value(raw, "width", "widthM", "length", "lengthM", "x"))
        height = number(mapping_value(raw, "height", "heightM", "y"))
        thickness = number(mapping_value(raw, "thickness", "thicknessM", "depth", "depthM", "z"))
        if None not in (width, height, thickness):
            return (width, height, thickness)  # type: ignore[return-value]
    width = number(mapping_value(wall, "widthM", "wallWidthM", "lengthM"))
    height = number(mapping_value(wall, "heightM", "wallHeightM"))
    thickness = number(mapping_value(wall, "thicknessM", "wallThicknessM", "depthM"))
    if None not in (width, height, thickness):
        return (width, height, thickness)  # type: ignore[return-value]
    return None


def extract_bed_joint(wall: Mapping[str, Any]) -> float | None:
    raw = mapping_value(wall, "bedJointM", "bedGapM", "bedJoint", "bedGap")
    result = number(raw)
    if result is not None:
        return result
    joint = mapping_value(wall, "jointM", "jointsM", "joint")
    if isinstance(joint, Mapping):
        return number(mapping_value(joint, "bed", "bedM", "horizontal", "horizontalM"))
    return None


def extract_course_count(wall: Mapping[str, Any]) -> int | None:
    raw = mapping_value(wall, "courseCount", "coursesCount", "numberOfCourses")
    if isinstance(raw, int) and not isinstance(raw, bool):
        return raw
    courses = mapping_value(wall, "courses", "courseRecipe", "courseRecipes")
    if isinstance(courses, list) and len(courses) == COURSE_COUNT:
        return len(courses)
    return None


def get_int(mapping: Mapping[str, Any], *keys: str) -> int | None:
    raw = mapping_value(mapping, *keys)
    if isinstance(raw, int) and not isinstance(raw, bool):
        return raw
    parsed = number(raw)
    if parsed is not None and abs(parsed - round(parsed)) <= EPS:
        return int(round(parsed))
    return None


def count_from_course_rows(rows: Sequence[Any]) -> tuple[int | None, list[int]]:
    counts: list[int] = []
    for row in rows:
        if isinstance(row, Mapping):
            count = get_int(row, "brickCount", "bricks", "pieceCount", "count", "total")
        elif isinstance(row, int) and not isinstance(row, bool):
            count = row
        else:
            count = None
        if count is None or count < 1:
            return None, counts
        counts.append(count)
    return sum(counts), counts


def recompute_recipe_total(wall: Mapping[str, Any]) -> tuple[int | None, dict[str, Any]]:
    placements = mapping_value(wall, "placements", "brickPlacements")
    if isinstance(placements, list) and len(placements) > 100:
        return len(placements), {"method": "placements", "rows": len(placements)}

    for key in ("courseBrickCounts", "bricksPerCourse", "courseCounts"):
        rows = mapping_value(wall, key)
        if isinstance(rows, list) and len(rows) == COURSE_COUNT:
            total, counts = count_from_course_rows(rows)
            return total, {"method": key, "courseCounts": counts}

    courses = mapping_value(wall, "courses")
    if isinstance(courses, list) and len(courses) == COURSE_COUNT:
        total, counts = count_from_course_rows(courses)
        if total is not None:
            return total, {"method": "courses", "courseCounts": counts}

    recipe = mapping_value(wall, "recipe", "bondRecipe", "courseRecipe", "courseRecipes")
    course_types = mapping_value(wall, "courseTypes", "courseTypeCounts", "patternCounts")
    if isinstance(recipe, Mapping) and isinstance(course_types, Mapping):
        products: list[dict[str, Any]] = []
        for name, repeats_raw in course_types.items():
            repeats = number(repeats_raw)
            recipe_entry = recipe.get(name)
            per_course = (
                get_int(recipe_entry, "courseBrickCount", "bricksPerCourse", "brickCount", "pieceCount")
                if isinstance(recipe_entry, Mapping)
                else None
            )
            if (
                repeats is None
                or abs(repeats - round(repeats)) > EPS
                or repeats <= 0
                or per_course is None
                or per_course <= 0
            ):
                products = []
                break
            products.append(
                {
                    "type": str(name),
                    "courses": int(round(repeats)),
                    "bricksPerCourse": per_course,
                }
            )
        if products and sum(item["courses"] for item in products) == COURSE_COUNT:
            total = sum(item["courses"] * item["bricksPerCourse"] for item in products)
            return total, {"method": "courseTypes-times-bondRecipe", "patterns": products}

    entries: list[Any]
    if isinstance(recipe, list):
        entries = recipe
    elif isinstance(recipe, Mapping):
        nested = mapping_value(recipe, "courses", "patterns", "entries", "courseTypes")
        if isinstance(nested, list):
            entries = nested
        elif isinstance(nested, Mapping):
            entries = list(nested.values())
        else:
            entries = [value for value in recipe.values() if isinstance(value, Mapping)]
    else:
        entries = []

    products: list[dict[str, int]] = []
    for entry in entries:
        if not isinstance(entry, Mapping):
            continue
        repeats = get_int(entry, "repeat", "repeats", "courseCount", "courses", "occurrences")
        per_course = get_int(entry, "bricksPerCourse", "brickCount", "pieceCount", "count")
        if repeats is not None and per_course is not None and repeats > 0 and per_course > 0:
            products.append({"courses": repeats, "bricksPerCourse": per_course})
    if products and sum(item["courses"] for item in products) == COURSE_COUNT:
        total = sum(item["courses"] * item["bricksPerCourse"] for item in products)
        return total, {"method": "pattern-products", "patterns": products}
    return None, {"method": "no independently summable recipe", "recipe": recipe}


def end_margins(entry: Mapping[str, Any], wall: Mapping[str, Any], course_type: str) -> tuple[float, float, bool]:
    raw = mapping_value(entry, "endMarginsM", "endMarginM", "courseEndMarginsM")
    if raw is None:
        wall_margins = mapping_value(wall, "endMarginsM", "courseEndMarginsM")
        if isinstance(wall_margins, Mapping):
            raw = wall_margins.get(course_type)
    pair = vector(raw, 2)
    if pair is not None:
        return pair[0], pair[1], True
    scalar = number(raw)
    if scalar is not None:
        return scalar, scalar, True
    if isinstance(raw, Mapping):
        left = number(mapping_value(raw, "left", "start", "min", "first"))
        right = number(mapping_value(raw, "right", "end", "max", "last"))
        if left is not None and right is not None:
            return left, right, True
    return 0.0, 0.0, False


def executable_source(text: str) -> str:
    return re.sub(
        r"<script\b[^>]*\btype\s*=\s*['\"]application/json['\"][^>]*>[\s\S]*?</script\s*>",
        "",
        text,
        flags=re.I,
    )


def recompute_course_widths(wall: Mapping[str, Any], text: str) -> tuple[bool, dict[str, Any]]:
    recipe = mapping_value(wall, "bondRecipe", "recipe", "courseRecipe")
    if not isinstance(recipe, Mapping):
        return False, {"reason": "missing bond recipe"}
    entry_a = recipe.get("A")
    entry_b = recipe.get("B")
    if not isinstance(entry_a, Mapping) or not isinstance(entry_b, Mapping):
        return False, {"reason": "missing A/B recipe entries", "recipeKeys": list(recipe)}

    wall_joint = number(mapping_value(wall, "headJointM", "headGapM"))
    joint_a = number(mapping_value(entry_a, "headJointM", "jointM", "headGapM"))
    joint_b = number(mapping_value(entry_b, "headJointM", "jointM", "headGapM"))
    if joint_a is None:
        joint_a = wall_joint
    if joint_b is None:
        joint_b = wall_joint
    if joint_a is None or joint_b is None:
        return False, {"reason": "missing A/B head-joint values"}

    left_a, right_a, explicit_a = end_margins(entry_a, wall, "A")
    left_b, right_b, explicit_b = end_margins(entry_b, wall, "B")
    length, _, width = FIXED_DIMENSIONS_M
    brick_span_a = 2 * width + 15 * length
    brick_span_b = 16 * length
    joint_span_a = 16 * joint_a
    joint_span_b = 15 * joint_b
    total_a = brick_span_a + joint_span_a + left_a + right_a
    total_b = brick_span_b + joint_span_b + left_b + right_b

    nonzero_margins = any(abs(value) > EPS for value in (left_a, right_a, left_b, right_b))
    source = executable_source(text)
    margin_source_used = not nonzero_margins or bool(
        re.search(r"\b(?:endMarginsM|endMarginM|courseEndMarginsM)\b", source)
    )
    nonnegative_margins = all(value >= -EPS for value in (left_a, right_a, left_b, right_b))
    passed = (
        abs(total_a - WALL_DIMENSIONS_M[0]) <= DIM_TOL
        and abs(total_b - WALL_DIMENSIONS_M[0]) <= DIM_TOL
        and nonnegative_margins
        and (not nonzero_margins or (explicit_a and explicit_b))
        and margin_source_used
    )
    return passed, {
        "A": {
            "brickSpanM": brick_span_a,
            "jointM": joint_a,
            "jointCount": 16,
            "jointSpanM": joint_span_a,
            "endMarginsM": [left_a, right_a],
            "marginsExplicit": explicit_a,
            "recomputedWidthM": total_a,
        },
        "B": {
            "brickSpanM": brick_span_b,
            "jointM": joint_b,
            "jointCount": 15,
            "jointSpanM": joint_span_b,
            "endMarginsM": [left_b, right_b],
            "marginsExplicit": explicit_b,
            "recomputedWidthM": total_b,
        },
        "expectedWidthM": WALL_DIMENSIONS_M[0],
        "rendererUsesEndMarginField": margin_source_used,
    }


def recompute_orientation_counts(wall: Mapping[str, Any]) -> tuple[bool, dict[str, Any]]:
    recipe = mapping_value(wall, "bondRecipe", "recipe", "courseRecipe")
    course_types = mapping_value(wall, "courseTypes", "courseTypeCounts")
    if not isinstance(recipe, Mapping) or not isinstance(course_types, Mapping):
        return False, {"reason": "missing bondRecipe/courseTypes"}
    entry_a = recipe.get("A")
    entry_b = recipe.get("B")
    if not isinstance(entry_a, Mapping) or not isinstance(entry_b, Mapping):
        return False, {"reason": "missing A/B recipe"}
    a_courses = get_int(course_types, "A")
    b_courses = get_int(course_types, "B")
    a_faces = get_int(entry_a, "faceCount")
    b_faces = get_int(entry_b, "faceCount")
    a_pieces = get_int(entry_a, "piecesPerFace")
    b_pieces = get_int(entry_b, "piecesPerFace")
    if None in (a_courses, b_courses, a_faces, b_faces, a_pieces, b_pieces):
        return False, {"reason": "non-numeric recipe multiplicities"}

    pattern_a = mapping_value(entry_a, "pattern")
    pattern_b = mapping_value(entry_b, "pattern")
    pattern_a_text = " ".join(str(item) for item in pattern_a) if isinstance(pattern_a, list) else str(pattern_a)
    pattern_b_text = " ".join(str(item) for item in pattern_b) if isinstance(pattern_b, list) else str(pattern_b)
    a_header_per_face = pattern_a_text.lower().count("header")
    a_stretcher_match = re.search(r"(\d+)\s+full\s+stretchers?", pattern_a_text, re.I)
    b_stretcher_match = re.search(r"(\d+)\s+full\s+stretchers?", pattern_b_text, re.I)
    a_stretcher_per_face = int(a_stretcher_match.group(1)) if a_stretcher_match else None
    b_stretcher_per_face = int(b_stretcher_match.group(1)) if b_stretcher_match else None
    if a_stretcher_per_face is None or b_stretcher_per_face is None:
        return False, {"reason": "A/B pattern does not expose numeric header/stretcher recipe"}

    header_count = int(a_courses) * int(a_faces) * a_header_per_face
    stretcher_count = (
        int(a_courses) * int(a_faces) * a_stretcher_per_face
        + int(b_courses) * int(b_faces) * b_stretcher_per_face
    )
    total = header_count + stretcher_count
    passed = (
        a_header_per_face == 2
        and a_stretcher_per_face == int(a_pieces) - 2
        and b_stretcher_per_face == int(b_pieces)
        and header_count == 88
        and stretcher_count == 1332
        and total == BRICK_TOTAL
    )
    return passed, {
        "headerBricksYawMinus90": header_count,
        "stretcherBricksYaw0": stretcher_count,
        "total": total,
        "expected": {"header": 88, "stretcher": 1332, "total": BRICK_TOTAL},
    }


def declared_brick_total(manifest: Mapping[str, Any], wall: Mapping[str, Any]) -> int | None:
    for container in (wall, mapping_value(wall, "objectCounts"), manifest.get("objectCounts")):
        if not isinstance(container, Mapping):
            continue
        value = get_int(
            container,
            "brickCount",
            "totalBrickCount",
            "generatedBrickCount",
            "fullBrickCount",
            "bricks",
            "brick",
        )
        if value is not None:
            return value
    recipe = mapping_value(wall, "recipe", "bondRecipe")
    if isinstance(recipe, Mapping):
        return get_int(recipe, "totalBrickCount", "brickTotal", "totalBricks", "total")
    return None


def source_brick_transform_facts(text: str) -> tuple[bool, dict[str, Any]]:
    decode_name, decode_body = balanced_function_body(text, r"decodeWall")
    world_name, world_body = balanced_function_body(text, r"rotateToWorld")
    local_name, local_body = balanced_function_body(text, r"rotateToLocal")
    bodies = [body for body in (decode_body, world_body, local_body) if body]
    joined = "\n".join(bodies)
    forbidden = sorted(
        {
            token.lower()
            for token in re.findall(r"\b[A-Za-z_]\w*\b", joined)
            if "pitch" in token.lower() or "roll" in token.lower() or "scale" in token.lower()
        }
    )
    only_xz_rotation = bool(
        re.search(r"vec3\s*\(\s*-?\s*p\.z\s*,\s*p\.y\s*,\s*-?\s*p\.x\s*\)", joined)
    ) and not bool(re.search(r"\.[xy]y\s*=|\.[yz]y\s*=", joined))
    yaw_values = {
        float(value)
        for value in re.findall(r"\byaw\s*=\s*(-?(?:\d+(?:\.\d*)?|\.\d+))", decode_body or "")
    }
    yaw_only = bool(decode_body) and yaw_values == {0.0, -1.0}
    passed = bool(decode_body and world_body and local_body) and not forbidden and only_xz_rotation and yaw_only
    return passed, {
        "functions": [decode_name, world_name, local_name],
        "forbiddenTiltOrScaleIdentifiers": forbidden,
        "yawQuarterValues": sorted(yaw_values),
        "preservesYAndRotatesOnlyXZ": only_xz_rotation,
    }


def transform_facts(wall: Mapping[str, Any], text: str) -> tuple[bool, dict[str, Any]]:
    placements = mapping_value(wall, "placements", "brickPlacements")
    bad: list[dict[str, Any]] = []
    checked = 0
    if isinstance(placements, list) and placements:
        for index, item in enumerate(placements):
            if not isinstance(item, Mapping):
                bad.append({"index": index, "reason": "not an object"})
                continue
            checked += 1
            scale = mapping_value(item, "scale")
            scale_ok = (
                scale is None
                or (number(scale) is not None and abs(float(scale) - 1.0) <= EPS)
                or (vector(scale, 3) is not None and close_numbers(vector(scale, 3) or (), (1, 1, 1), EPS))
            )
            pitch = number(mapping_value(item, "pitch", "pitchRad", "pitchDeg", "pitchQuarter"))
            roll = number(mapping_value(item, "roll", "rollRad", "rollDeg", "rollQuarter"))
            yaw_quarter = number(mapping_value(item, "yawQuarter"))
            yaw_deg = number(mapping_value(item, "yawDeg", "yawDegrees"))
            yaw_rad = number(mapping_value(item, "yaw", "yawRad"))
            if yaw_quarter is not None:
                yaw_ok = any(abs(yaw_quarter - value) <= EPS for value in (0.0, -1.0))
            elif yaw_deg is not None:
                yaw_ok = any(abs(yaw_deg - value) <= EPS for value in (0.0, -90.0))
            elif yaw_rad is not None:
                yaw_ok = any(abs(yaw_rad - value) <= EPS for value in (0.0, -math.pi / 2))
            else:
                yaw_ok = False
            if not scale_ok or (pitch is not None and abs(pitch) > EPS) or (roll is not None and abs(roll) > EPS) or not yaw_ok:
                bad.append(
                    {
                        "index": index,
                        "id": item.get("id"),
                        "scale": scale,
                        "pitch": pitch,
                        "roll": roll,
                        "yawQuarter": yaw_quarter,
                        "yawDeg": yaw_deg,
                        "yawRad": yaw_rad,
                    }
                )
        source_ok, source_evidence = source_brick_transform_facts(text)
        return checked > 0 and not bad and source_ok, {
            "method": "placements",
            "checked": checked,
            "bad": bad[:30],
            "source": source_evidence,
        }

    direct_scale = mapping_value(wall, "allowedScale", "brickScale")
    direct_yaw = mapping_value(wall, "allowedYawDeg", "allowedYawDegrees")
    if direct_scale is not None or direct_yaw is not None:
        scale_vec = vector(direct_scale, 3)
        yaw_vec = vector(direct_yaw, 2)
        pitch_values = recursive_named_values(wall, "allowedPitchDeg", "brickPitch", "pitchQuarter")
        roll_values = recursive_named_values(wall, "allowedRollDeg", "brickRoll", "rollQuarter")
        pitch_roll_zero = all(
            number(value) is not None and abs(float(value)) <= EPS
            for _, value in pitch_values + roll_values
        )
        passed = (
            scale_vec is not None
            and close_numbers(scale_vec, (1, 1, 1), EPS)
            and yaw_vec is not None
            and any(close_numbers(yaw_vec, expected, EPS) for expected in ((0, -90), (-90, 0)))
            and pitch_roll_zero
        )
        source_ok, source_evidence = source_brick_transform_facts(text)
        return passed and source_ok, {
            "method": "allowed transform values",
            "scale": direct_scale,
            "yawDeg": direct_yaw,
            "pitchDeclarations": pitch_values,
            "rollDeclarations": roll_values,
            "pitchRollNonzeroAbsent": pitch_roll_zero,
            "source": source_evidence,
        }

    contract = mapping_value(wall, "brickTransformContract", "transformContract", "placementContract")
    if not isinstance(contract, Mapping):
        return False, {"method": "missing placements and transform contract"}
    scale = mapping_value(contract, "scale", "brickScale")
    scale_vec = vector(scale, 3)
    scale_ok = (number(scale) is not None and abs(float(scale) - 1.0) <= EPS) or (
        scale_vec is not None and close_numbers(scale_vec, (1, 1, 1), EPS)
    )
    pitch = number(mapping_value(contract, "pitch", "pitchRad", "pitchDeg"))
    roll = number(mapping_value(contract, "roll", "rollRad", "rollDeg"))
    allowed = mapping_value(contract, "allowedYawQuarter", "yawQuarter", "allowedYaw", "yawOnly")
    if isinstance(allowed, (list, tuple)):
        allowed_values = tuple(number(item) for item in allowed)
        yaw_ok = (
            all(item is not None for item in allowed_values)
            and len(allowed_values) == 2
            and any(close_numbers(allowed_values, expected, EPS) for expected in ((0, -1), (-1, 0)))
        )
    else:
        yaw_ok = False
    passed = scale_ok and pitch is not None and abs(pitch) <= EPS and roll is not None and abs(roll) <= EPS and yaw_ok
    source_ok, source_evidence = source_brick_transform_facts(text)
    return passed and source_ok, {"method": "contract", "contract": contract, "source": source_evidence}


def object_counts(manifest: Mapping[str, Any], wall: Mapping[str, Any]) -> Mapping[str, Any] | None:
    for candidate in (manifest.get("objectCounts"), wall.get("objectCounts")):
        if isinstance(candidate, Mapping):
            return candidate
    return None


def layer_numbers(value: Any) -> list[int] | None:
    if isinstance(value, int) and not isinstance(value, bool):
        return list(range(1, value + 1))
    if isinstance(value, list):
        result: list[int] = []
        for item in value:
            if isinstance(item, Mapping):
                raw = mapping_value(item, "layer", "index", "id", "number")
            else:
                raw = item
            parsed = number(raw)
            if parsed is None or abs(parsed - round(parsed)) > EPS:
                return None
            result.append(int(round(parsed)))
        return result
    if isinstance(value, Mapping):
        first = get_int(value, "first", "start", "min")
        last = get_int(value, "last", "end", "max")
        count = get_int(value, "count", "layers")
        if first is not None and last is not None and last >= first:
            result = list(range(first, last + 1))
            return result if count in (None, len(result)) else None
        if count is not None:
            return list(range(1, count + 1))
    return None


def soil_layer_contract(soil: Mapping[str, Any]) -> tuple[list[int] | None, list[int] | None, dict[str, Any]]:
    microscope = mapping_value(soil, "microscope", "microscopeContract", "multiScale")
    source = microscope if isinstance(microscope, Mapping) else soil
    geometry_raw = mapping_value(source, "geometryLayers", "shapeLayers", "geometryLayerRange")
    material_raw = mapping_value(source, "materialLayers", "shadingLayers", "materialLayerRange")
    geometry = layer_numbers(geometry_raw)
    material = layer_numbers(material_raw)
    return geometry, material, {"geometry": geometry_raw, "material": material_raw}


def soil_height_contract(
    soil: Mapping[str, Any], bed_joint: float | None, text: str
) -> tuple[bool, dict[str, Any]]:
    """Verify soil follows the currently built courses, never the final wall."""

    contract = mapping_value(
        soil,
        "heightContract",
        "activeCourseHeightContract",
        "courseHeightContract",
        "buildHeightContract",
    )
    if bed_joint is None:
        return False, {"reason": "missing bed-joint value", "contract": contract}

    tracks = (
        mapping_value(
            contract,
            "tracksActiveCourse",
            "followActiveCourse",
            "courseBuildLinked",
        )
        if isinstance(contract, Mapping)
        else None
    )
    top_setback = number(
        mapping_value(contract, "topSetbackM", "soilTopSetbackM", "setbackBelowBrickTopM")
        if isinstance(contract, Mapping)
        else None
    )
    if top_setback is None:
        top_setback = number(mapping_value(soil, "nominalTopSetbackM", "topSetbackM"))
    raw_samples = (
        mapping_value(contract, "samples", "activeCourseSamples", "checkpoints")
        if isinstance(contract, Mapping)
        else None
    )
    samples: list[Mapping[str, Any]] = []
    if isinstance(raw_samples, list):
        samples = [sample for sample in raw_samples if isinstance(sample, Mapping)]
    elif isinstance(raw_samples, Mapping):
        for key, sample in raw_samples.items():
            if isinstance(sample, Mapping):
                samples.append({"activeCourse": key, **sample})
            else:
                samples.append({"activeCourse": key, "soilTopM": sample})

    wanted = (1, 22, 43)
    audited: list[dict[str, Any]] = []
    bad: list[dict[str, Any]] = []
    by_course: dict[int, Mapping[str, Any]] = {}
    for sample in samples:
        course = get_int(sample, "activeCourse", "course", "courseCount", "visibleCourses")
        if course is not None:
            by_course[course] = sample

    for course in wanted:
        sample = by_course.get(course)
        expected_brick_top = course * FIXED_DIMENSIONS_M[1] + (course - 1) * bed_joint
        expected_soil_top = (
            expected_brick_top - top_setback if top_setback is not None else float("nan")
        )
        declared_brick_top = (
            number(mapping_value(sample, "brickTopM", "activeBrickTopM", "courseTopM"))
            if sample is not None
            else None
        )
        declared_soil_top = (
            number(mapping_value(sample, "soilTopM", "effectiveSoilTopM", "topM", "heightM"))
            if sample is not None
            else None
        )
        row = {
            "activeCourse": course,
            "expectedBrickTopM": expected_brick_top,
            "declaredBrickTopM": declared_brick_top,
            "expectedSoilTopM": expected_soil_top,
            "declaredSoilTopM": declared_soil_top,
        }
        audited.append(row)
        if sample is not None and (
            declared_soil_top is None
            or top_setback is None
            or abs(declared_soil_top - expected_soil_top) > DIM_TOL
            or (declared_brick_top is not None and abs(declared_brick_top - expected_brick_top) > DIM_TOL)
            or declared_soil_top >= expected_brick_top - EPS
        ):
            bad.append(row)

    executable = executable_source(text)
    active_height_formula = bool(
        re.search(
            r"function\s+activeBrickHeight\s*\(\s*\w+\s*\)\s*\{\s*return\s+\w+\s*\*\s*BRICK_H\s*\+\s*\(\s*\w+\s*-\s*1\s*\)\s*\*\s*BED\s*;?\s*\}",
            executable,
        )
    )
    active_course_uploaded = bool(
        re.search(r"activeH\s*=\s*activeBrickHeight\s*\(\s*activeCourse\s*\)", executable)
        and (
            re.search(r"uniform1f\s*\([^;]*uActiveHeight[^;]*activeH\s*\)", executable)
            or re.search(
                r"uniform1f\s*\([^;]*uSoilTop[^;]*activeH\s*-\s*0?\.01(?:0)?\s*\)",
                executable,
            )
        )
    )
    shader_top_follows_uniform = bool(
        re.search(r"top\s*=\s*uActiveHeight\s*-\s*0?\.01(?:0)?\b", executable)
        or re.search(r"top\s*=\s*uSoilTop\s*\+", executable)
    )
    built_courses_uploaded = bool(
        re.search(r"uniform1i\s*\([^;]*uBuiltCourses[^;]*activeCourse\s*\)", executable)
    )
    source_tracks = (
        active_height_formula
        and active_course_uploaded
        and shader_top_follows_uniform
        and built_courses_uploaded
    )
    if tracks is None:
        tracks = source_tracks

    soil_tops = [
        row["declaredSoilTopM"]
        if row["declaredSoilTopM"] is not None
        else row["expectedSoilTopM"]
        for row in audited
    ]
    strictly_grows = all(
        isinstance(value, (int, float)) and math.isfinite(float(value))
        for value in soil_tops
    ) and all(float(a) < float(b) for a, b in zip(soil_tops, soil_tops[1:]))
    low_course_not_full_height = bool(soil_tops) and number(soil_tops[0]) is not None and float(soil_tops[0]) < 0.1
    passed = (
        tracks is True
        and top_setback is not None
        and abs(top_setback - SOIL_NOMINAL_SETBACK_M) <= DIM_TOL
        and not bad
        and source_tracks
        and strictly_grows
        and low_course_not_full_height
    )
    return passed, {
        "tracksActiveCourse": tracks,
        "topSetbackM": top_setback,
        "samples": audited,
        "bad": bad,
        "strictlyGrows": strictly_grows,
        "lowCourseNotFullHeight": low_course_not_full_height,
        "source": {
            "activeHeightFormula": active_height_formula,
            "activeCourseUploadedToSoil": active_course_uploaded,
            "soilShaderUsesUploadedCourseTop": shader_top_follows_uniform,
            "activeCourseUploadedToBrickDecoder": built_courses_uploaded,
        },
    }


def soil_end_setback_contract(
    soil: Mapping[str, Any], wall: Mapping[str, Any], text: str
) -> tuple[bool, dict[str, Any]]:
    """Recompute the end setback from the actual X term of soilSdf."""

    declared = number(mapping_value(soil, "nominalEndSetbackM", "endSetbackM"))
    maximum_amplitude = number(
        mapping_value(soil, "maxAmplitudeM", "maximumAmplitudeM", "geometryMaxAmplitudeM")
    )
    dimensions = wall_dimensions(wall)
    wall_half_width = dimensions[0] * 0.5 if dimensions is not None else None
    name, body = balanced_function_body(text, r"soilSdf")
    expression_match = re.search(
        r"\bfloat\s+dx\s*=\s*(abs\s*\(\s*p\.x\s*\)\s*-\s*[^;]+);",
        body or "",
        re.I,
    )
    expression = expression_match.group(1).strip() if expression_match else None
    half_width: float | None = None
    if expression is not None:
        literal = re.match(
            r"abs\s*\(\s*p\.x\s*\)\s*-\s*\(?\s*([0-9]+(?:\.[0-9]*)?|\.[0-9]+)",
            expression,
            re.I,
        )
        if literal:
            half_width = number(literal.group(1))
        else:
            identifier = re.match(
                r"abs\s*\(\s*p\.x\s*\)\s*-\s*\(?\s*([A-Za-z_]\w*)",
                expression,
                re.I,
            )
            if identifier:
                constant = re.search(
                    rf"\b{re.escape(identifier.group(1))}\s*=\s*([0-9]+(?:\.[0-9]*)?|\.[0-9]+)",
                    executable_source(text),
                )
                if constant:
                    half_width = number(constant.group(1))

    shape_affects_end = bool(
        expression
        and re.search(r"\buSoilShape\b|\bsoilMicroscope\w*\s*\(", expression, re.I)
    )
    actual_nominal = (
        wall_half_width - half_width
        if wall_half_width is not None and half_width is not None
        else None
    )
    actual_minimum = (
        actual_nominal - maximum_amplitude
        if actual_nominal is not None and shape_affects_end and maximum_amplitude is not None
        else actual_nominal
    )
    passed = (
        name is not None
        and expression is not None
        and declared is not None
        and abs(declared - SOIL_NOMINAL_SETBACK_M) <= DIM_TOL
        and actual_nominal is not None
        and abs(actual_nominal - declared) <= DIM_TOL
        and actual_minimum is not None
        and actual_minimum >= SOIL_MINIMUM_SETBACK_M - DIM_TOL
        and (not shape_affects_end or maximum_amplitude is not None)
    )
    return passed, {
        "function": name,
        "soilSdfXExpression": expression,
        "wallHalfWidthM": wall_half_width,
        "soilHalfWidthM": half_width,
        "declaredNominalEndSetbackM": declared,
        "recomputedNominalEndSetbackM": actual_nominal,
        "shapeAffectsEnd": shape_affects_end,
        "maxShapeAmplitudeM": maximum_amplitude,
        "recomputedMinimumEndSetbackM": actual_minimum,
        "minimumAllowedM": SOIL_MINIMUM_SETBACK_M,
    }


def color_geometry_contract(soil: Mapping[str, Any]) -> tuple[bool, dict[str, Any]]:
    evidence: dict[str, Any] = {}
    negative_keys = {
        "colorcontrolsaffectgeometry",
        "coloraffectsgeometry",
        "soilcolorcontrolsaffectgeometry",
        "colortogeometry",
    }
    positive_keys = {
        "geometryindependentofcolor",
        "geometryisolatedfromcolor",
        "colorgeometryisolated",
    }
    explicit = False
    for path, value in walk(soil):
        if not path:
            continue
        key = normalized_key(path[-1])
        joined = ".".join(path)
        if key in negative_keys:
            evidence[joined] = value
            explicit = explicit or value is False
        elif key in positive_keys:
            evidence[joined] = value
            explicit = explicit or value is True
        elif key in {"colorcontrolsrole", "colorrole"}:
            evidence[joined] = value
            explicit = explicit or str(value).lower().replace("_", "-") in {
                "material-only",
                "shading-only",
                "albedo-only",
            }
    geometry_layers = mapping_value(soil, "geometryLayers")
    material_layers = mapping_value(soil, "materialLayers")
    geometry_affects = (
        mapping_value(geometry_layers, "affects") if isinstance(geometry_layers, Mapping) else None
    )
    material_affects = (
        mapping_value(material_layers, "affects") if isinstance(material_layers, Mapping) else None
    )
    material_targets = {
        normalized_key(item)
        for item in material_affects
    } if isinstance(material_affects, list) else set()
    disjoint_layers = (
        geometry_affects is not None
        and bool(material_targets)
        and material_targets <= {"basecolor", "roughness"}
        and not any(
            token in normalized_key(geometry_affects)
            for token in ("color", "albedo", "roughness", "palette", "tint", "hue")
        )
    )
    if disjoint_layers:
        evidence["geometryLayers.affects"] = geometry_affects
        evidence["materialLayers.affects"] = material_affects
        explicit = True
    return explicit, evidence


def balanced_function_body(text: str, name_pattern: str) -> tuple[str | None, str | None]:
    match = re.search(
        rf"(?:float|vec[234]|void|function)\s+({name_pattern})\s*\([^)]*\)\s*\{{",
        text,
        re.I,
    )
    if not match:
        return None, None
    start = match.end() - 1
    depth = 0
    for index in range(start, len(text)):
        if text[index] == "{":
            depth += 1
        elif text[index] == "}":
            depth -= 1
            if depth == 0:
                return match.group(1), text[start + 1 : index]
    return match.group(1), None


def source_geometry_color_isolation(text: str) -> tuple[bool, dict[str, Any]]:
    executable = executable_source(text)
    candidates = sorted(
        set(
            re.findall(
                r"(?:float|vec[234])\s+"
                r"(soil\w*(?:sdf|distance|geometry|shape|top)\w*|"
                r"(?:sdf|distance|geometry|shape)\w*soil\w*)\s*\(",
                executable,
                re.I,
            )
        )
    )
    inspected: dict[str, list[str]] = {}
    missing_body: list[str] = []
    for candidate in candidates:
        name, body = balanced_function_body(executable, re.escape(candidate))
        if not name or body is None:
            missing_body.append(candidate)
            continue
        banned = sorted(
            {
                token.lower()
                for token in re.findall(r"\b[A-Za-z_]\w*\b", body)
                if any(
                    part in token.lower()
                    for part in ("color", "albedo", "tint", "hue", "saturat", "palette")
                )
            }
        )
        inspected[name] = banned
    has_distance = any("sdf" in name.lower() or "distance" in name.lower() for name in inspected)
    has_geometry_field = any("geometry" in name.lower() or "shape" in name.lower() for name in inspected)
    passed = (
        has_distance
        and has_geometry_field
        and not missing_body
        and all(not banned for banned in inspected.values())
    )
    return passed, {
        "functions": inspected,
        "missingBodies": missing_body,
        "hasDistanceFunction": has_distance,
        "hasGeometryFieldFunction": has_geometry_field,
    }


def view_projection_contract(manifest: Mapping[str, Any], text: str) -> dict[str, tuple[bool, Any]]:
    """Inspect executable camera paths instead of trusting button labels."""

    executable = executable_source(text)
    projection_name, projection_body = balanced_function_body(executable, r"projectionForView")
    reset_name, reset_body = balanced_function_body(executable, r"resetCamera")
    draw_name, draw_body = balanced_function_body(executable, r"draw")

    declared_views = manifest.get("views")
    declared_set = set(declared_views) if isinstance(declared_views, list) else set()
    orthographic_views = {"front", "back", "end", "top"}
    projection = projection_body or ""
    iso_uses_perspective = bool(
        re.search(
            r"if\s*\([^)]*(?:!\s*currentView|currentView\s*={2,3}\s*['\"]iso['\"])[^)]*\)"
            r"\s*return\s+perspective\s*\(",
            projection,
        )
    )
    inspections_use_ortho = bool(
        re.search(r"return\s+orthographic\s*\(", projection)
        and orthographic_views.issubset(declared_set)
    )
    projection_ok = (
        projection_name == "projectionForView"
        and iso_uses_perspective
        and inspections_use_ortho
        and projection.count("perspective(") == 1
        and projection.count("orthographic(") == 1
    )

    reset = reset_body or ""
    horizontal_patterns = {
        "front": r"\bfront\s*:\s*\[\s*Math\.PI\s*,\s*0(?:\.0*)?\s*,",
        "back": r"\bback\s*:\s*\[\s*0(?:\.0*)?\s*,\s*0(?:\.0*)?\s*,",
        "end": r"\bend\s*:\s*\[\s*-\s*Math\.PI\s*/\s*2\s*,\s*0(?:\.0*)?\s*,",
    }
    horizontal_counts = {
        view: len(re.findall(pattern, reset)) for view, pattern in horizontal_patterns.items()
    }
    horizontal_ok = reset_name == "resetCamera" and all(
        count >= 2 for count in horizontal_counts.values()
    )
    top_pitch_count = len(
        re.findall(
            r"\btop\s*:\s*\[\s*(?:Math\.PI|0(?:\.0*)?)\s*,\s*Math\.PI\s*/\s*2\s*,",
            reset,
        )
    )
    approximate_top_pitch = re.findall(
        r"\btop\s*:\s*\[[^,]+,\s*(?:1\.5\d*|1\.4\d*)\s*,",
        reset,
    )
    top_pitch_exact = top_pitch_count >= 2 and not approximate_top_pitch

    draw = draw_body or ""
    explicit_top_up = bool(
        re.search(
            r"\bup\s*=\s*currentView\s*={2,3}\s*['\"]top['\"]\s*\?\s*"
            r"\[\s*0\s*,\s*0\s*,\s*-\s*1\s*\]\s*:\s*"
            r"\[\s*0\s*,\s*1\s*,\s*0\s*\]",
            draw,
        )
    )
    look_at_receives_up = bool(
        re.search(r"lookAt\s*\(\s*eye\s*,\s*target\s*,\s*up\s*\)", draw)
    )
    top_up_ok = draw_name == "draw" and explicit_top_up and look_at_receives_up

    return {
        "projection_paths": (
            projection_ok,
            {
                "function": projection_name,
                "declaredViews": sorted(declared_set),
                "isoCallsPerspective": iso_uses_perspective,
                "frontBackEndTopCallOrthographic": inspections_use_ortho,
                "perspectiveCallCount": projection.count("perspective("),
                "orthographicCallCount": projection.count("orthographic("),
            },
        ),
        "orthographic_axes": (
            horizontal_ok and top_pitch_exact,
            {
                "function": reset_name,
                "zeroPitchPresetCounts": horizontal_counts,
                "exactPiOverTwoTopPresetCount": top_pitch_count,
                "approximateTopPitchMatches": approximate_top_pitch,
            },
        ),
        "top_up_vector": (
            top_up_ok,
            {
                "function": draw_name,
                "topUsesUpVector001Negative": explicit_top_up,
                "lookAtReceivesExplicitUp": look_at_receives_up,
            },
        ),
    }


def ray_projection_contract(text: str) -> tuple[bool, dict[str, Any]]:
    """Require parallel ortho rays and camera-origin perspective rays in both materials."""

    executable = executable_source(text)
    uniform_contracts = len(
        re.findall(
            r"uniform\s+vec3\s+uViewDir\s*;\s*uniform\s+int\s+uOrtho\s*;",
            executable,
        )
    )
    ortho_origins = len(
        re.findall(
            r"uOrtho\s*==\s*1\s*\?\s*vBoxPoint\s*-\s*(?:worldRd|rd)\s*\*\s*8(?:\.0*)?\s*:\s*uCamera",
            executable,
        )
    )
    split_directions = len(
        re.findall(
            r"uOrtho\s*==\s*1\s*\?\s*normalize\s*\(\s*uViewDir\s*\)\s*:\s*"
            r"normalize\s*\(\s*vBoxPoint\s*-\s*uCamera\s*\)",
            executable,
        )
    )
    all_camera_point_rays = len(
        re.findall(r"normalize\s*\(\s*vBoxPoint\s*-\s*uCamera\s*\)", executable)
    )
    upload_name, upload_body = balanced_function_body(executable, r"uploadCommon")
    upload = upload_body or ""
    uploads_fixed_direction = bool(
        re.search(r"uniform3fv\s*\([^;]*uViewDir[^;]*viewDir\s*\)", upload)
    )
    ortho_flag_matches_non_iso = bool(
        re.search(
            r"uniform1i\s*\([^;]*uOrtho[^;]*currentView\s*&&\s*currentView\s*!={1,2}\s*['\"]iso['\"]\s*\?\s*1\s*:\s*0\s*\)",
            upload,
        )
    )
    draw_name, draw_body = balanced_function_body(executable, r"draw")
    draw = draw_body or ""
    normalized_view_direction = bool(
        re.search(
            r"viewDir\s*=\s*\[\s*\(\s*target\[0\]\s*-\s*eye\[0\]\s*\)\s*/\s*vl\s*,"
            r"\s*\(\s*target\[1\]\s*-\s*eye\[1\]\s*\)\s*/\s*vl\s*,"
            r"\s*\(\s*target\[2\]\s*-\s*eye\[2\]\s*\)\s*/\s*vl\s*\]",
            draw,
        )
    )
    brick_receives_view_dir = bool(
        re.search(r"uploadCommon\s*\(\s*brickProgram\.p[^;]*viewDir\s*\)", draw)
    )
    soil_receives_view_dir = bool(
        re.search(r"uploadCommon\s*\(\s*soilProgram\.p[^;]*viewDir\s*\)", draw)
    )

    passed = (
        uniform_contracts == 2
        and ortho_origins == 2
        and split_directions == 2
        and all_camera_point_rays == split_directions
        and upload_name == "uploadCommon"
        and uploads_fixed_direction
        and ortho_flag_matches_non_iso
        and draw_name == "draw"
        and normalized_view_direction
        and brick_receives_view_dir
        and soil_receives_view_dir
    )
    return passed, {
        "brickAndSoilUniformContracts": uniform_contracts,
        "orthographicOriginsMoveWithRasterPoint": ortho_origins,
        "orthoParallelAndIsoPerspectiveDirectionBranches": split_directions,
        "allPointToCameraRayExpressionsAreGuarded": all_camera_point_rays == split_directions,
        "uploadFunction": upload_name,
        "uploadsFixedViewDirection": uploads_fixed_direction,
        "setsOrthoOnlyForNonIsoViews": ortho_flag_matches_non_iso,
        "drawFunction": draw_name,
        "viewDirectionIsNormalizedTargetMinusEye": normalized_view_direction,
        "brickReceivesViewDirection": brick_receives_view_dir,
        "soilReceivesViewDirection": soil_receives_view_dir,
    }


def normalized_residuals(edge_data: Any) -> tuple[str | None, int, dict[str, Any]]:
    if not isinstance(edge_data, Mapping):
        return None, 0, {"error": "edge-band-data is not an object"}
    normalized: dict[str, list[float]] = {}
    errors: list[str] = []
    count = 0
    for key in sorted(edge_data):
        values = edge_data[key]
        if not isinstance(values, list):
            errors.append(f"{key}: not an array")
            continue
        row: list[float] = []
        for index, raw in enumerate(values):
            parsed = number(raw)
            if parsed is None:
                errors.append(f"{key}[{index}]: not finite numeric")
                continue
            row.append(parsed)
            count += 1
        normalized[str(key)] = row
    if errors:
        return None, count, {"errors": errors}

    # The frozen source stores coefficients to eight decimal places.  This
    # decimal form avoids Python/ECMAScript differences for small exponents
    # while still hashing the parsed values rather than arbitrary whitespace.
    def decimal(value: float) -> str:
        encoded = f"{value:.8f}".rstrip("0").rstrip(".")
        return "0" if encoded in {"", "-0"} else encoded

    payload = "{" + ",".join(
        json.dumps(key, ensure_ascii=False)
        + ":["
        + ",".join(decimal(value) for value in normalized[key])
        + "]"
        for key in sorted(normalized)
    ) + "}"
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    lengths = {key: len(values) for key, values in normalized.items()}
    return digest, count, {"keys": list(normalized), "lengths": lengths, "normalizedBytes": len(payload)}


def audit_manifest(manifest: dict[str, Any], edge_data: Any, text: str, report: dict[str, Any]) -> None:
    kernel = manifest.get("canonicalKernel", manifest.get("freeze"))
    if not isinstance(kernel, Mapping):
        add_check(report, "canonical_kernel_manifest_present", False, kernel)
        return
    add_check(report, "canonical_kernel_manifest_present", True, kernel.get("id"))

    source = str(kernel.get("source", ""))
    add_check(
        report,
        "frozen_r2_14_8_1_source_commit_and_blob",
        kernel.get("sourceCommit") == FIXED_SOURCE_COMMIT
        and kernel.get("sourceBlob") == FIXED_SOURCE_BLOB
        and ("R2_14_8_1" in source or "R2.14.8.1" in source),
        {
            "source": source,
            "sourceCommit": kernel.get("sourceCommit"),
            "sourceBlob": kernel.get("sourceBlob"),
            "expectedCommit": FIXED_SOURCE_COMMIT,
            "expectedBlob": FIXED_SOURCE_BLOB,
        },
    )
    dims = vector(kernel.get("dimensionsM"), 3)
    add_check(
        report,
        "canonical_dimensions_unchanged",
        dims is not None and close_numbers(dims, FIXED_DIMENSIONS_M, DIM_TOL),
        {"actual": dims, "expected": FIXED_DIMENSIONS_M},
    )

    scale_matches = [number(value) for _, value in recursive_named_values(manifest, "modelScale")]
    source_matches = [number(value) for value in re.findall(r"\bMODEL_SCALE\s*=\s*([0-9.eE+-]+)", text)]
    scales = [value for value in scale_matches + source_matches if value is not None]
    add_check(
        report,
        "canonical_model_scale_unchanged",
        bool(scales) and all(abs(value - FIXED_MODEL_SCALE) <= MODEL_SCALE_TOL for value in scales),
        {"actual": scales, "expected": FIXED_MODEL_SCALE},
    )

    digest, coefficient_count, coefficient_evidence = normalized_residuals(edge_data)
    declared_count = kernel.get("residualCoefficientCount")
    add_check(
        report,
        "all_336_frozen_residual_coefficients_present",
        declared_count == FIXED_RESIDUAL_COUNT and coefficient_count == FIXED_RESIDUAL_COUNT,
        {"declared": declared_count, "actual": coefficient_count, **coefficient_evidence},
    )
    add_check(
        report,
        "frozen_residual_values_normalized_sha256",
        digest == FIXED_RESIDUAL_SHA256,
        {"actual": digest, "expected": FIXED_RESIDUAL_SHA256},
    )

    material = kernel.get("material")
    material_vector = material.get("publicVector") if isinstance(material, Mapping) else None
    vector4 = vector(material_vector, 4)
    add_check(
        report,
        "frozen_r2_1_b_material_vector",
        isinstance(material, Mapping)
        and material.get("id") == FIXED_MATERIAL_ID
        and vector4 is not None
        and close_numbers(vector4, FIXED_MATERIAL_VECTOR, EPS),
        {
            "actual": material,
            "expected": {"id": FIXED_MATERIAL_ID, "publicVector": FIXED_MATERIAL_VECTOR},
        },
    )

    wall = manifest.get("wall")
    if not isinstance(wall, Mapping):
        add_check(report, "wall_manifest_present", False, wall)
        return
    add_check(report, "wall_manifest_present", True, wall.get("id", wall.get("type")))

    actual_wall_dimensions = wall_dimensions(wall)
    add_check(
        report,
        "wall_is_4m_by_3m_by_0_48923m",
        actual_wall_dimensions is not None
        and close_numbers(actual_wall_dimensions, WALL_DIMENSIONS_M, DIM_TOL),
        {"actual": actual_wall_dimensions, "expected": WALL_DIMENSIONS_M},
    )

    actual_course_count = extract_course_count(wall)
    add_check(
        report,
        "wall_has_exactly_43_courses",
        actual_course_count == COURSE_COUNT,
        {"actual": actual_course_count, "expected": COURSE_COUNT},
    )
    bed_joint = extract_bed_joint(wall)
    total_height = (
        COURSE_COUNT * FIXED_DIMENSIONS_M[1] + (COURSE_COUNT - 1) * bed_joint
        if bed_joint is not None
        else None
    )
    add_check(
        report,
        "bed_joint_closes_43_courses_to_3m",
        bed_joint is not None
        and abs(bed_joint - BED_JOINT_M) <= JOINT_TOL
        and total_height is not None
        and abs(total_height - WALL_DIMENSIONS_M[1]) <= DIM_TOL,
        {
            "actualBedJointM": bed_joint,
            "expectedBedJointM": BED_JOINT_M,
            "recomputedHeightM": total_height,
        },
    )

    declared_total = declared_brick_total(manifest, wall)
    recomputed_total, recipe_evidence = recompute_recipe_total(wall)
    add_check(
        report,
        "wall_recipe_recomputes_exactly_1420_bricks",
        declared_total == BRICK_TOTAL and recomputed_total == BRICK_TOTAL,
        {
            "declared": declared_total,
            "recomputed": recomputed_total,
            "expected": BRICK_TOTAL,
            "recipe": recipe_evidence,
        },
    )

    orientation_ok, orientation_evidence = recompute_orientation_counts(wall)
    add_check(
        report,
        "recipe_recomputes_88_headers_and_1332_stretchers",
        orientation_ok,
        orientation_evidence,
    )

    widths_ok, widths_evidence = recompute_course_widths(wall, text)
    add_check(
        report,
        "course_width_recomputes_exactly_4m",
        widths_ok,
        widths_evidence,
    )

    center_thickness_joint = number(
        mapping_value(
            wall,
            "centerTieGapM",
            "centerThicknessJointM",
            "thicknessJointM",
            "centerJointM",
        )
    )
    recomputed_thickness = (
        2 * FIXED_DIMENSIONS_M[0] + center_thickness_joint
        if center_thickness_joint is not None
        else None
    )
    add_check(
        report,
        "two_header_depths_and_center_joint_recompute_wall_thickness",
        recomputed_thickness is not None
        and abs(recomputed_thickness - WALL_DIMENSIONS_M[2]) <= DIM_TOL,
        {
            "twoHeaderLengthsM": 2 * FIXED_DIMENSIONS_M[0],
            "centerJointM": center_thickness_joint,
            "recomputedThicknessM": recomputed_thickness,
            "expectedThicknessM": WALL_DIMENSIONS_M[2],
        },
    )

    transforms_ok, transforms_evidence = transform_facts(wall, text)
    add_check(
        report,
        "brick_transforms_are_unit_scale_zero_tilt_and_yaw_0_or_minus_90_only",
        transforms_ok,
        transforms_evidence,
    )

    counts = object_counts(manifest, wall)
    brick_count = get_int(counts, "brick", "bricks") if isinstance(counts, Mapping) else None
    soil_count = get_int(counts, "soil", "soilCore", "core") if isinstance(counts, Mapping) else None
    plaster_count = get_int(counts, "plaster") if isinstance(counts, Mapping) else None
    mortar_count = get_int(counts, "mortar") if isinstance(counts, Mapping) else None
    add_check(
        report,
        "scene_has_1420_bricks_one_soil_and_no_plaster_or_mortar",
        brick_count == BRICK_TOTAL
        and soil_count == SOIL_COUNT
        and plaster_count == 0
        and mortar_count == 0,
        {
            "actual": counts,
            "expected": {"brick": BRICK_TOTAL, "soil": 1, "plaster": 0, "mortar": 0},
        },
    )
    add_check(
        report,
        "construction_object_total_is_1421_without_double_counting_subtotals",
        brick_count == BRICK_TOTAL
        and soil_count == SOIL_COUNT
        and plaster_count == 0
        and mortar_count == 0
        and brick_count + soil_count + plaster_count + mortar_count == 1421,
        {
            "brick": brick_count,
            "soil": soil_count,
            "plaster": plaster_count,
            "mortar": mortar_count,
            "recomputedConstructionObjects": (
                brick_count + soil_count + plaster_count + mortar_count
                if None not in (brick_count, soil_count, plaster_count, mortar_count)
                else None
            ),
        },
    )

    view_checks = view_projection_contract(manifest, text)
    projection_ok, projection_evidence = view_checks["projection_paths"]
    add_check(
        report,
        "iso_uses_perspective_and_inspection_views_use_orthographic",
        projection_ok,
        projection_evidence,
    )
    axes_ok, axes_evidence = view_checks["orthographic_axes"]
    add_check(
        report,
        "front_back_end_are_level_and_top_is_exactly_vertical",
        axes_ok,
        axes_evidence,
    )
    top_up_ok, top_up_evidence = view_checks["top_up_vector"]
    add_check(
        report,
        "top_lookat_uses_explicit_non_degenerate_up_vector",
        top_up_ok,
        top_up_evidence,
    )

    rays_ok, rays_evidence = ray_projection_contract(text)
    add_check(
        report,
        "brick_and_soil_use_parallel_rays_for_orthographic_and_camera_rays_for_iso",
        rays_ok,
        rays_evidence,
    )

    soil = manifest.get("soil")
    if not isinstance(soil, Mapping):
        add_check(report, "soil_manifest_present", False, soil)
        return
    add_check(report, "soil_manifest_present", True, soil.get("id", soil.get("type")))
    nominal = number(
        mapping_value(
            soil,
            "nominalFrontBackSetbackM",
            "nominalSetbackM",
            "setbackM",
            "surfaceSetbackM",
        )
    )
    amplitude = number(
        mapping_value(
            soil,
            "defaultAmplitudeM",
            "amplitudeM",
            "geometryAmplitudeM",
            "surfaceAmplitudeM",
        )
    )
    minimum = number(
        mapping_value(
            soil,
            "minimumGuaranteedSetbackM",
            "minimumSetbackM",
            "minSetbackM",
            "minimumClearanceM",
        )
    )
    derived_minimum = nominal - amplitude if nominal is not None and amplitude is not None else None
    add_check(
        report,
        "soil_surface_setback_and_amplitude_contract",
        nominal is not None
        and abs(nominal - SOIL_NOMINAL_SETBACK_M) <= DIM_TOL
        and amplitude is not None
        and abs(amplitude - SOIL_AMPLITUDE_M) <= DIM_TOL
        and minimum is not None
        and minimum >= SOIL_MINIMUM_SETBACK_M - DIM_TOL
        and derived_minimum is not None
        and derived_minimum >= SOIL_MINIMUM_SETBACK_M - DIM_TOL,
        {
            "nominalSetbackM": nominal,
            "amplitudeM": amplitude,
            "declaredMinimumSetbackM": minimum,
            "nominalMinusAmplitudeM": derived_minimum,
            "minimumAllowedM": SOIL_MINIMUM_SETBACK_M,
        },
    )

    end_setback_ok, end_setback_evidence = soil_end_setback_contract(soil, wall, text)
    add_check(
        report,
        "soil_sdf_end_setback_recomputes_to_10mm_with_minimum_5mm",
        end_setback_ok,
        end_setback_evidence,
    )

    height_ok, height_evidence = soil_height_contract(soil, bed_joint, text)
    add_check(
        report,
        "soil_top_tracks_active_course_1_22_43_with_10mm_retreat",
        height_ok,
        height_evidence,
    )

    geometry_layers, material_layers, layer_evidence = soil_layer_contract(soil)
    add_check(
        report,
        "soil_microscope_geometry_layers_are_1_through_5",
        geometry_layers == list(range(1, 6)),
        {"actual": geometry_layers, "declared": layer_evidence["geometry"]},
    )
    add_check(
        report,
        "soil_microscope_material_layers_are_1_through_17",
        material_layers == list(range(1, 18)),
        {"actual": material_layers, "declared": layer_evidence["material"]},
    )

    contract_ok, contract_evidence = color_geometry_contract(soil)
    source_ok, source_evidence = source_geometry_color_isolation(text)
    add_check(
        report,
        "soil_color_controls_cannot_change_geometry",
        contract_ok and source_ok,
        {"manifestContract": contract_evidence, "sourceAudit": source_evidence},
    )


def audit_page(html_path: Path) -> dict[str, Any]:
    report: dict[str, Any] = {
        "schemaVersion": "brick-mother-wall-independent-static-qa-r3.2",
        "artifact": {"path": str(html_path), "bytes": None, "sha256": None},
        "checks": {},
        "passed": False,
        "humanVisualApproval": False,
        "productionApproved": False,
        "note": "Independent source/contract audit; visual acceptance remains with the user.",
    }
    if not html_path.is_file():
        add_check(report, "html_exists", False, str(html_path))
        return report

    raw = html_path.read_bytes()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        add_check(report, "html_is_utf8", False, str(exc))
        return report
    report["artifact"].update({"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()})
    add_check(report, "html_exists", True, str(html_path))
    add_check(report, "html_is_utf8", True, "utf-8")

    parser = JsonScriptParser()
    parser.feed(text)
    add_check(report, "one_real_webgl_canvas", parser.canvas_count == 1, parser.canvas_count)

    forbidden = {token: text.count(token) for token in FORBIDDEN_R3_TOKENS if token in text}
    add_check(report, "failed_r3_mesh_panel_and_plaster_paths_absent", not forbidden, forbidden)

    objects: dict[str, Any] = {}
    json_errors: dict[str, str] = {}
    for script_id, payload in parser.scripts.items():
        try:
            objects[script_id] = json.loads(payload)
        except json.JSONDecodeError as exc:
            json_errors[script_id] = str(exc)
    add_check(
        report,
        "embedded_json_scripts_parse",
        bool(objects) and not json_errors,
        {"parsed": sorted(objects), "errors": json_errors},
    )

    manifest_id, manifest = select_manifest(objects)
    add_check(
        report,
        "independent_wall_manifest_present",
        manifest is not None,
        {"selected": manifest_id, "available": sorted(objects)},
    )
    edge_data = objects.get("edge-band-data")
    add_check(report, "edge_band_data_present", edge_data is not None, "edge-band-data")
    if manifest is not None:
        audit_manifest(manifest, edge_data, text, report)

    report["passed"] = bool(report["checks"]) and all(
        bool(item["passed"]) for item in report["checks"].values()
    )
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html", type=Path, default=DEFAULT_HTML)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    report = audit_page(args.html.resolve())
    serialized = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(serialized, encoding="utf-8")
    sys.stdout.write(serialized)
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
