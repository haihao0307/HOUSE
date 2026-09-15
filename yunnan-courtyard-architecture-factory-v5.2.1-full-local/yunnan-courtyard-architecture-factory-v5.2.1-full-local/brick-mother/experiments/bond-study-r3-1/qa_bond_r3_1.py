#!/usr/bin/env python3
"""Independent geometry QA for Brick Mother bond study R3.1.

The page must embed raw placement facts in an inert JSON script rather than
publishing pre-computed pass/fail claims::

    <script type="application/json" id="brick-bond-manifest">...</script>

This audit treats those facts as inputs and recomputes plan overlap, joints,
course elevations, course closure, support and cross-course joint staggering.
It also rejects the failed R3 mesh and wall-core/plaster code paths.

This is a deterministic structural test, not human visual approval.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
from collections import Counter, defaultdict, deque
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterable


HERE = Path(__file__).resolve().parent
DEFAULT_HTML = HERE.parents[1] / "Brick_Mother_Bond_Study_R3_1.html"

FIXED_SOURCE_COMMIT = "7362f830bcac83a0883e7855fa5d41ee30e52718"
FIXED_SOURCE_BLOB = "19315c0094234f68aad6a1fadc32aeea1725aab6"
FIXED_PARENT_COMMIT = "d8b11f7b200d07e0f1c0afca36b6c5a307398281"
FIXED_DIMENSIONS_M = (0.24, 0.06115, 0.11077)  # length, height, width
FIXED_MATERIAL_ID = "R2.1-B"
FIXED_MATERIAL_VECTOR = (1.0, 1.0, 1.0, 0.0)
FIXED_RESIDUAL_COUNT = 336

REQUIRED_SHADER_DECLARATIONS = (
    "sdRoundBox",
    "surfaceDelta",
    "contourShapeLong",
)
FORBIDDEN_R3_TOKENS = (
    "brickLocalMesh",
    "roundedPoint",
    "addPanelSurface",
    "addPlaster",
)
REQUIRED_VIEWS = {"iso", "front", "end", "top"}

EPS = 1e-7
DIM_TOL = 2e-5
LEVEL_TOL = 8e-4


class PageParser(HTMLParser):
    """Collect manifest text and machine-visible controls."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._in_manifest = False
        self._manifest_parts: list[str] = []
        self.views: list[str] = []
        self.modes: list[str] = []
        self.canvas_count = 0

    @property
    def manifest_text(self) -> str:
        return "".join(self._manifest_parts).strip()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_map = {key.lower(): (value or "") for key, value in attrs}
        tag = tag.lower()
        if tag == "script" and attrs_map.get("id") == "brick-bond-manifest":
            self._in_manifest = True
        if "data-view" in attrs_map:
            self.views.append(attrs_map["data-view"])
        if "data-mode" in attrs_map:
            self.modes.append(attrs_map["data-mode"])
        if tag == "canvas":
            self.canvas_count += 1

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "script" and self._in_manifest:
            self._in_manifest = False

    def handle_data(self, data: str) -> None:
        if self._in_manifest:
            self._manifest_parts.append(data)


@dataclass(frozen=True)
class Rect:
    xmin: float
    xmax: float
    zmin: float
    zmax: float

    @property
    def area(self) -> float:
        return max(0.0, self.xmax - self.xmin) * max(0.0, self.zmax - self.zmin)


@dataclass(frozen=True)
class Brick:
    id: str
    course: int
    center: tuple[float, float, float]
    yaw_quarter: int
    kernel_id: str
    build_step: int
    dims: tuple[float, float, float]
    stock: str
    cut: dict[str, Any] | None
    kernel_center: tuple[float, float, float]

    @property
    def rect(self) -> Rect:
        length, _, width = self.dims
        x_size, z_size = (length, width) if self.yaw_quarter % 2 == 0 else (width, length)
        x, _, z = self.center
        return Rect(x - x_size / 2, x + x_size / 2, z - z_size / 2, z + z_size / 2)

    @property
    def ymin(self) -> float:
        return self.center[1] - self.dims[1] / 2

    @property
    def ymax(self) -> float:
        return self.center[1] + self.dims[1] / 2


def add_check(report: dict[str, Any], name: str, passed: bool, evidence: Any) -> None:
    report["checks"][name] = {"passed": bool(passed), "evidence": evidence}


def close_tuple(actual: Iterable[float], expected: Iterable[float], tol: float) -> bool:
    actual_tuple = tuple(actual)
    expected_tuple = tuple(expected)
    return len(actual_tuple) == len(expected_tuple) and all(
        abs(a - b) <= tol for a, b in zip(actual_tuple, expected_tuple)
    )


def as_vec3(value: Any, field: str) -> tuple[float, float, float]:
    if not isinstance(value, list) or len(value) != 3:
        raise ValueError(f"{field} must be a three-number array")
    result = tuple(float(component) for component in value)
    if not all(math.isfinite(component) for component in result):
        raise ValueError(f"{field} contains a non-finite number")
    return result  # type: ignore[return-value]


def parse_bricks(manifest: dict[str, Any]) -> list[Brick]:
    kernel = manifest["canonicalKernel"]
    kernel_id = str(kernel["id"])
    fixed_dims = as_vec3(kernel["dimensionsM"], "canonicalKernel.dimensionsM")
    raw_placements = manifest["wall"]["placements"]
    if not isinstance(raw_placements, list):
        raise ValueError("wall.placements must be an array")

    bricks: list[Brick] = []
    for index, raw in enumerate(raw_placements):
        if not isinstance(raw, dict):
            raise ValueError(f"wall.placements[{index}] must be an object")
        yaw = raw.get("yawQuarter")
        if isinstance(yaw, bool) or not isinstance(yaw, int):
            raise ValueError(f"{raw.get('id', index)} yawQuarter must be an integer")
        if yaw % 4 not in (0, 3):
            raise ValueError(f"{raw.get('id', index)} must use only the approved 0/-90 degree plan rotations")
        for tilt_key in ("pitch", "roll", "pitchQuarter", "rollQuarter"):
            if abs(float(raw.get(tilt_key, 0))) > EPS:
                raise ValueError(f"{raw.get('id', index)} tilts or flips the frozen mother brick")
        stock = str(raw.get("stock", ""))
        inferred_dims = (
            [fixed_dims[0] * 0.5, fixed_dims[1], fixed_dims[2]]
            if stock == "half"
            else list(fixed_dims)
        )
        dims = as_vec3(raw.get("dimensionsM", inferred_dims), f"{raw.get('id', index)}.dimensionsM")
        scale = raw.get("scale", 1)
        if isinstance(scale, list):
            if not close_tuple((float(v) for v in scale), (1, 1, 1), EPS):
                raise ValueError(f"{raw.get('id', index)} changes canonical kernel scale")
        elif abs(float(scale) - 1.0) > EPS:
            raise ValueError(f"{raw.get('id', index)} changes canonical kernel scale")
        cut = raw.get("cut")
        physical_center = as_vec3(raw["center"], f"{raw.get('id', index)}.center")
        kernel_center = as_vec3(
            raw.get("kernelCenter", raw["center"]), f"{raw.get('id', index)}.kernelCenter"
        )
        if stock == "full":
            if cut not in (None, False):
                raise ValueError(f"{raw.get('id', index)} full stock unexpectedly declares a cut")
            if not close_tuple(dims, fixed_dims, DIM_TOL):
                raise ValueError(f"{raw.get('id', index)} changes full canonical dimensions")
        elif stock == "half":
            valid_cut = (
                isinstance(cut, dict)
                and cut.get("axis") == "length"
                and abs(float(cut.get("fraction", 0)) - 0.5) <= EPS
                and cut.get("keep") == "positive"
            )
            expected_half = (fixed_dims[0] * 0.5, fixed_dims[1], fixed_dims[2])
            if not valid_cut or not close_tuple(dims, expected_half, DIM_TOL):
                raise ValueError(
                    f"{raw.get('id', index)} half stock must be a positive 1/2 length cut of the canonical kernel"
                )
            expected_center = list(kernel_center)
            if yaw % 4 == 0:
                expected_center[0] += fixed_dims[0] * 0.25
            else:  # approved -90° maps positive local length toward positive world Z
                expected_center[2] += fixed_dims[0] * 0.25
            if not close_tuple(physical_center, expected_center, DIM_TOL):
                raise ValueError(
                    f"{raw.get('id', index)} physical center does not match its kernelCenter/cut direction"
                )
        else:
            raise ValueError(f"{raw.get('id', index)} stock must be full or half")
        bricks.append(
            Brick(
                id=str(raw["id"]),
                course=int(raw["course"]),
                center=physical_center,
                yaw_quarter=yaw % 4,
                kernel_id=str(raw["kernelId"]),
                build_step=int(raw["buildStep"]),
                dims=dims,
                stock=stock,
                cut=cut if isinstance(cut, dict) else None,
                kernel_center=kernel_center,
            )
        )
    return bricks


def rect_intersection_area(a: Rect, b: Rect) -> float:
    return max(0.0, min(a.xmax, b.xmax) - max(a.xmin, b.xmin)) * max(
        0.0, min(a.zmax, b.zmax) - max(a.zmin, b.zmin)
    )


def interval_union_length(intervals: Iterable[tuple[float, float]]) -> float:
    ordered = sorted((lo, hi) for lo, hi in intervals if hi - lo > EPS)
    if not ordered:
        return 0.0
    total = 0.0
    lo, hi = ordered[0]
    for next_lo, next_hi in ordered[1:]:
        if next_lo <= hi + EPS:
            hi = max(hi, next_hi)
        else:
            total += hi - lo
            lo, hi = next_lo, next_hi
    return total + hi - lo


def rect_union_area(rects: Iterable[Rect]) -> float:
    rect_list = list(rects)
    xs = sorted({coordinate for rect in rect_list for coordinate in (rect.xmin, rect.xmax)})
    area = 0.0
    for left, right in zip(xs, xs[1:]):
        if right - left <= EPS:
            continue
        z_intervals = [
            (rect.zmin, rect.zmax)
            for rect in rect_list
            if rect.xmin < right - EPS and rect.xmax > left + EPS
        ]
        area += (right - left) * interval_union_length(z_intervals)
    return area


def clipped_union_area(target: Rect, rects: Iterable[Rect]) -> float:
    clipped = []
    for rect in rects:
        candidate = Rect(
            max(target.xmin, rect.xmin),
            min(target.xmax, rect.xmax),
            max(target.zmin, rect.zmin),
            min(target.zmax, rect.zmax),
        )
        if candidate.area > EPS:
            clipped.append(candidate)
    return rect_union_area(clipped)


def gap_between(a0: float, a1: float, b0: float, b1: float) -> float:
    if a1 < b0:
        return b0 - a1
    if b1 < a0:
        return a0 - b1
    return 0.0


def intervals_overlap(a0: float, a1: float, b0: float, b1: float) -> float:
    return max(0.0, min(a1, b1) - max(a0, b0))


def connected_course(bricks: list[Brick], max_joint: float) -> tuple[bool, list[str]]:
    neighbors: dict[str, set[str]] = defaultdict(set)
    for index, first in enumerate(bricks):
        for second in bricks[index + 1 :]:
            a, b = first.rect, second.rect
            x_gap = gap_between(a.xmin, a.xmax, b.xmin, b.xmax)
            z_gap = gap_between(a.zmin, a.zmax, b.zmin, b.zmax)
            x_overlap = intervals_overlap(a.xmin, a.xmax, b.xmin, b.xmax)
            z_overlap = intervals_overlap(a.zmin, a.zmax, b.zmin, b.zmax)
            touches = (
                x_gap <= max_joint + LEVEL_TOL and z_overlap > EPS
            ) or (
                z_gap <= max_joint + LEVEL_TOL and x_overlap > EPS
            )
            if touches:
                neighbors[first.id].add(second.id)
                neighbors[second.id].add(first.id)
    if not bricks:
        return False, []
    seen = {bricks[0].id}
    queue = deque(seen)
    while queue:
        current = queue.popleft()
        for candidate in neighbors[current]:
            if candidate not in seen:
                seen.add(candidate)
                queue.append(candidate)
    missing = sorted(brick.id for brick in bricks if brick.id not in seen)
    return not missing, missing


def face_joints(bricks: list[Brick], side: str, face_tol: float, max_joint: float) -> list[float]:
    if side not in {"front", "back"}:
        raise ValueError(side)
    face = min(brick.rect.zmin for brick in bricks) if side == "front" else max(
        brick.rect.zmax for brick in bricks
    )
    selected = [
        brick
        for brick in bricks
        if abs((brick.rect.zmin if side == "front" else brick.rect.zmax) - face) <= face_tol
    ]
    selected.sort(key=lambda brick: brick.rect.xmin)
    joints = []
    for left, right in zip(selected, selected[1:]):
        gap = right.rect.xmin - left.rect.xmax
        if -LEVEL_TOL <= gap <= max_joint + LEVEL_TOL:
            joints.append((left.rect.xmax + right.rect.xmin) / 2)
    return joints


def audit_geometry(manifest: dict[str, Any], report: dict[str, Any]) -> None:
    kernel = manifest.get("canonicalKernel", {})
    material = kernel.get("material", {})
    fixed_identity = {
        "sourceCommit": kernel.get("sourceCommit"),
        "sourceBlob": kernel.get("sourceBlob"),
        "parentCommit": kernel.get("parentCommit"),
        "inheritedShapeCommit": kernel.get("inheritedShapeCommit"),
        "source": kernel.get("source"),
        "residualCoefficientCount": kernel.get("residualCoefficientCount"),
        "dimensionsM": kernel.get("dimensionsM"),
        "material": material,
    }
    source_label = str(kernel.get("source", ""))
    add_check(
        report,
        "canonical_frozen_source_identity",
        kernel.get("sourceCommit") == FIXED_SOURCE_COMMIT
        and kernel.get("sourceBlob") == FIXED_SOURCE_BLOB
        and kernel.get("inheritedShapeCommit", kernel.get("parentCommit")) == FIXED_PARENT_COMMIT
        and (
            "R2.14.8.1" in source_label
            or "Brick_Shape_Edge_Lab_R2_14_8_1.html" in source_label
        )
        and ("边角学习" in source_label or "edge" in source_label.lower()),
        fixed_identity,
    )
    add_check(
        report,
        "canonical_dimensions_unchanged",
        isinstance(kernel.get("dimensionsM"), list)
        and close_tuple((float(v) for v in kernel["dimensionsM"]), FIXED_DIMENSIONS_M, DIM_TOL),
        {"actual": kernel.get("dimensionsM"), "expected": FIXED_DIMENSIONS_M},
    )
    add_check(
        report,
        "canonical_residual_count_336",
        kernel.get("residualCoefficientCount") == FIXED_RESIDUAL_COUNT,
        kernel.get("residualCoefficientCount"),
    )
    material_vector = material.get("publicVector") if isinstance(material, dict) else None
    add_check(
        report,
        "frozen_r2_1_b_material",
        isinstance(material, dict)
        and material.get("id") == FIXED_MATERIAL_ID
        and isinstance(material_vector, list)
        and close_tuple((float(v) for v in material_vector), FIXED_MATERIAL_VECTOR, EPS),
        {"actual": material, "expected": {"id": FIXED_MATERIAL_ID, "publicVector": FIXED_MATERIAL_VECTOR}},
    )

    try:
        bricks = parse_bricks(manifest)
    except (KeyError, TypeError, ValueError) as exc:
        add_check(report, "placement_manifest_parses", False, str(exc))
        return
    add_check(report, "placement_manifest_parses", True, {"brickCount": len(bricks)})

    ids = [brick.id for brick in bricks]
    add_check(
        report,
        "unique_brick_ids",
        len(ids) == len(set(ids)) and all(ids),
        [item for item, count in Counter(ids).items() if count > 1],
    )
    canonical_id = str(kernel.get("id", ""))
    wrong_kernel = [brick.id for brick in bricks if brick.kernel_id != canonical_id]
    add_check(
        report,
        "every_placement_references_only_canonical_kernel",
        bool(canonical_id) and not wrong_kernel,
        {"canonicalKernelId": canonical_id, "wrongKernel": wrong_kernel},
    )

    stock_counts = Counter(brick.stock for brick in bricks)
    cut_errors = [
        brick.id
        for brick in bricks
        if brick.stock == "half"
        and not (
            brick.cut
            and brick.cut.get("axis") == "length"
            and abs(float(brick.cut.get("fraction", 0)) - 0.5) <= EPS
            and brick.cut.get("keep") == "positive"
        )
    ]
    add_check(
        report,
        "twelve_full_and_four_true_half_canonical_cuts",
        len(bricks) == 16 and stock_counts == {"full": 12, "half": 4} and not cut_errors,
        {"counts": dict(stock_counts), "badCuts": cut_errors},
    )
    object_counts = manifest.get("wall", {}).get("objectCounts", manifest.get("objectCounts", {}))
    add_check(
        report,
        "brick_only_scene_has_no_core_plaster_or_mortar_objects",
        object_counts == {"brick": 16, "core": 0, "plaster": 0, "mortar": 0},
        object_counts,
    )

    courses: dict[int, list[Brick]] = defaultdict(list)
    for brick in bricks:
        courses[brick.course].append(brick)
    course_ids = sorted(courses)
    add_check(
        report,
        "four_or_more_bottom_up_courses",
        len(course_ids) == 4
        and course_ids == list(range(course_ids[0], course_ids[0] + len(course_ids)))
        and all(len(courses[course]) == 4 for course in course_ids),
        {"courses": course_ids, "counts": {str(key): len(value) for key, value in courses.items()}},
    )

    expected_step = {course: rank + 1 for rank, course in enumerate(course_ids)}
    bad_build_steps = [
        {"id": brick.id, "course": brick.course, "buildStep": brick.build_step, "expected": expected_step[brick.course]}
        for brick in bricks
        if brick.build_step != expected_step[brick.course]
    ]
    add_check(
        report,
        "placements_enter_strictly_bottom_up",
        not bad_build_steps,
        bad_build_steps,
    )

    same_level_errors = []
    level_rows = []
    for course in course_ids:
        row = courses[course]
        bottoms = [brick.ymin for brick in row]
        tops = [brick.ymax for brick in row]
        if max(bottoms) - min(bottoms) > LEVEL_TOL or max(tops) - min(tops) > LEVEL_TOL:
            same_level_errors.append(course)
        level_rows.append(
            {"course": course, "bottom": sum(bottoms) / len(bottoms), "top": sum(tops) / len(tops)}
        )
    expected_centers = (0.030575, 0.100955, 0.171335, 0.241715)
    centers_exact = len(level_rows) == 4 and all(
        abs((row["bottom"] + row["top"]) / 2 - expected_centers[index]) <= LEVEL_TOL
        for index, row in enumerate(level_rows)
    )
    add_check(report, "each_course_is_level_at_approved_height", not same_level_errors and centers_exact, level_rows)

    wall = manifest.get("wall", {})
    joint = wall.get("jointM", {})
    try:
        if isinstance(joint, (int, float)) and not isinstance(joint, bool):
            head_joint = float(joint)
            bed_joint = float(wall["bedGapM"])
            min_joint = max(0.002, min(head_joint, bed_joint) - 0.001)
            max_joint = min(0.03, max(head_joint, bed_joint) + 0.001)
        else:
            head_joint = float(joint["head"])
            bed_joint = float(joint["bed"])
            min_joint = float(joint["min"])
            max_joint = float(joint["max"])
        joint_policy_valid = (
            0.002 <= min_joint <= head_joint <= max_joint <= 0.03
            and min_joint <= bed_joint <= max_joint
            and abs(head_joint - 0.00923) <= DIM_TOL
            and abs(bed_joint - 0.00923) <= DIM_TOL
        )
    except (KeyError, TypeError, ValueError):
        head_joint = bed_joint = min_joint = max_joint = float("nan")
        joint_policy_valid = False
    add_check(
        report,
        "physical_joint_policy",
        joint_policy_valid,
        {"declared": joint, "head": head_joint, "bed": bed_joint, "min": min_joint, "max": max_joint},
    )
    if not joint_policy_valid or not course_ids:
        return

    bed_rows = []
    bad_beds = []
    for lower_id, upper_id in zip(course_ids, course_ids[1:]):
        lower_top = max(brick.ymax for brick in courses[lower_id])
        upper_bottom = min(brick.ymin for brick in courses[upper_id])
        gap = upper_bottom - lower_top
        row = {"lower": lower_id, "upper": upper_id, "gapM": gap}
        bed_rows.append(row)
        if not (min_joint - LEVEL_TOL <= gap <= max_joint + LEVEL_TOL):
            bad_beds.append(row)
    add_check(report, "bed_joints_from_real_coordinates", not bad_beds, bed_rows)

    collisions = []
    for index, first in enumerate(bricks):
        for second in bricks[index + 1 :]:
            x_overlap = intervals_overlap(first.rect.xmin, first.rect.xmax, second.rect.xmin, second.rect.xmax)
            y_overlap = intervals_overlap(first.ymin, first.ymax, second.ymin, second.ymax)
            z_overlap = intervals_overlap(first.rect.zmin, first.rect.zmax, second.rect.zmin, second.rect.zmax)
            if x_overlap > LEVEL_TOL and y_overlap > LEVEL_TOL and z_overlap > LEVEL_TOL:
                collisions.append(
                    {"a": first.id, "b": second.id, "overlapM": [x_overlap, y_overlap, z_overlap]}
                )
    add_check(report, "no_brick_volume_overlap", not collisions, collisions[:30])

    review = manifest.get("wall", {}).get("reviewEnvelopeM", {})
    try:
        review_origin = tuple(float(value) for value in review["origin"])
        review_x = float(review["x"])
        review_z = float(review["z"])
        review_thickness = float(review["thickness"])
        review_valid = (
            len(review_origin) == 2
            and abs(review_x - 0.48923) <= DIM_TOL
            and abs(review_z - 0.48923) <= DIM_TOL
            and abs(review_thickness - FIXED_DIMENSIONS_M[2]) <= DIM_TOL
        )
    except (KeyError, TypeError, ValueError):
        review_origin = (float("nan"), float("nan"))
        review_x = review_z = review_thickness = float("nan")
        review_valid = False
    add_check(
        report,
        "approved_l_corner_review_envelope",
        review_valid,
        {
            "actual": review,
            "expected": {"x": 0.48923, "z": 0.48923, "thickness": FIXED_DIMENSIONS_M[2]},
        },
    )
    if not review_valid:
        return

    # The approved review piece is an L, not a filled rectangular wall.  Its
    # footprint is the union of two perpendicular legs of equal outer length.
    ox, oz = review_origin
    l_area = 2 * review_x * review_thickness - review_thickness**2
    course_reports = []
    disconnected = []
    low_coverage = []
    outside_l = []
    envelopes = []
    for course in course_ids:
        row = courses[course]
        xmin = min(brick.rect.xmin for brick in row)
        xmax = max(brick.rect.xmax for brick in row)
        zmin = min(brick.rect.zmin for brick in row)
        zmax = max(brick.rect.zmax for brick in row)
        union_area = rect_union_area(brick.rect for brick in row)
        coverage = union_area / l_area if l_area > EPS else 0.0
        connected, missing = connected_course(row, max_joint)
        if not connected:
            disconnected.append({"course": course, "isolated": missing})
        # The gaps are mortar.  The brick union must fill nearly all of the
        # approved two-leg footprint without inventing a rectangular core.
        if coverage < 0.92 or coverage > 1.001:
            low_coverage.append({"course": course, "coverage": coverage})
        for brick in row:
            rect = brick.rect
            in_x_leg = (
                rect.xmin >= ox - LEVEL_TOL
                and rect.xmax <= ox + review_x + LEVEL_TOL
                and rect.zmin >= oz - LEVEL_TOL
                and rect.zmax <= oz + review_thickness + LEVEL_TOL
            )
            in_z_leg = (
                rect.xmin >= ox - LEVEL_TOL
                and rect.xmax <= ox + review_thickness + LEVEL_TOL
                and rect.zmin >= oz - LEVEL_TOL
                and rect.zmax <= oz + review_z + LEVEL_TOL
            )
            if not (in_x_leg or in_z_leg):
                outside_l.append({"course": course, "id": brick.id, "rect": vars(rect)})
        envelope = {"course": course, "xmin": xmin, "xmax": xmax, "zmin": zmin, "zmax": zmax}
        envelopes.append(envelope)
        course_reports.append({**envelope, "coverage": coverage, "connected": connected})
    add_check(report, "each_course_is_physically_connected", not disconnected, course_reports)
    add_check(
        report,
        "courses_fill_only_the_two_approved_l_legs",
        not low_coverage and not outside_l,
        {"courses": course_reports, "outside": outside_l, "expectedLAreaM2": l_area},
    )

    envelope_tolerance = LEVEL_TOL
    closes = all(
        abs(row["xmin"] - ox) <= envelope_tolerance
        and abs(row["xmax"] - (ox + review_x)) <= envelope_tolerance
        and abs(row["zmin"] - oz) <= envelope_tolerance
        and abs(row["zmax"] - (oz + review_z)) <= envelope_tolerance
        for row in envelopes
    )
    add_check(
        report,
        "all_courses_close_exactly_to_l_review_envelope",
        closes,
        {"toleranceM": envelope_tolerance, "courses": envelopes},
    )

    adjacency_gaps = []
    bad_adjacency_gaps = []
    for course in course_ids:
        row = courses[course]
        for index, first in enumerate(row):
            for second in row[index + 1 :]:
                a, b = first.rect, second.rect
                x_gap = gap_between(a.xmin, a.xmax, b.xmin, b.xmax)
                z_gap = gap_between(a.zmin, a.zmax, b.zmin, b.zmax)
                x_overlap = intervals_overlap(a.xmin, a.xmax, b.xmin, b.xmax)
                z_overlap = intervals_overlap(a.zmin, a.zmax, b.zmin, b.zmax)
                gap = None
                axis = None
                if z_overlap > LEVEL_TOL and EPS < x_gap <= max_joint + LEVEL_TOL:
                    gap, axis = x_gap, "x"
                elif x_overlap > LEVEL_TOL and EPS < z_gap <= max_joint + LEVEL_TOL:
                    gap, axis = z_gap, "z"
                if gap is not None:
                    item = {"course": course, "a": first.id, "b": second.id, "axis": axis, "gapM": gap}
                    adjacency_gaps.append(item)
                    if abs(gap - head_joint) > LEVEL_TOL:
                        bad_adjacency_gaps.append(item)
    add_check(
        report,
        "all_head_joints_equal_g_from_real_coordinates",
        len(adjacency_gaps) >= len(bricks) - len(course_ids) and not bad_adjacency_gaps,
        {"count": len(adjacency_gaps), "bad": bad_adjacency_gaps, "sample": adjacency_gaps[:20]},
    )

    # Match coordinates to the two approved mirror courses.  This is stricter
    # than trusting labels like "A/B" and is not confused by each course's 2:2
    # orientation split.
    length, _, width = FIXED_DIMENSIONS_M
    half = length / 2
    template_a = [
        ("full", 0, length / 2, width / 2),
        ("full", 0, length + head_joint + length / 2, width / 2),
        ("full", 1, width / 2, width + head_joint + length / 2),
        ("half", 1, width / 2, width + head_joint + length + head_joint + half / 2),
    ]
    template_b = [
        ("full", 1, width / 2, length / 2),
        ("full", 1, width / 2, length + head_joint + length / 2),
        ("full", 0, width + head_joint + length / 2, width / 2),
        ("half", 0, width + head_joint + length + head_joint + half / 2, width / 2),
    ]

    def matches_template(row: list[Brick], template: list[tuple[str, int, float, float]]) -> bool:
        unmatched = list(template)
        for brick in row:
            bx = brick.center[0] - ox
            bz = brick.center[2] - oz
            for index, (stock, yaw_parity, tx, tz) in enumerate(unmatched):
                if (
                    brick.stock == stock
                    and brick.yaw_quarter % 2 == yaw_parity
                    and abs(bx - tx) <= LEVEL_TOL
                    and abs(bz - tz) <= LEVEL_TOL
                ):
                    unmatched.pop(index)
                    break
            else:
                return False
        return not unmatched

    template_rows = []
    template_sequence = []
    for course in course_ids:
        is_a = matches_template(courses[course], template_a)
        is_b = matches_template(courses[course], template_b)
        label = "A" if is_a and not is_b else "B" if is_b and not is_a else None
        template_sequence.append(label)
        corner_candidates = [
            brick
            for brick in courses[course]
            if abs(brick.rect.xmin - ox) <= LEVEL_TOL and abs(brick.rect.zmin - oz) <= LEVEL_TOL
        ]
        template_rows.append(
            {
                "course": course,
                "template": label,
                "cornerYawQuarter": corner_candidates[0].yaw_quarter if len(corner_candidates) == 1 else None,
            }
        )
    mirror_alternation = all(
        label in {"A", "B"}
        and (index == 0 or label != template_sequence[index - 1])
        for index, label in enumerate(template_sequence)
    )
    add_check(
        report,
        "courses_match_exact_a_b_mirror_corner_templates",
        mirror_alternation,
        template_rows,
    )

    support_rows = []
    unsupported = []
    for lower_id, upper_id in zip(course_ids, course_ids[1:]):
        lower_rects = [brick.rect for brick in courses[lower_id]]
        for upper in courses[upper_id]:
            supported = clipped_union_area(upper.rect, lower_rects)
            ratio = supported / upper.rect.area if upper.rect.area > EPS else 0.0
            item = {"id": upper.id, "course": upper_id, "supportRatio": ratio}
            support_rows.append(item)
            if ratio < 0.45:
                unsupported.append(item)
    add_check(
        report,
        "every_upper_brick_has_real_plan_support",
        not unsupported,
        {"minimum": min((item["supportRatio"] for item in support_rows), default=0.0), "bad": unsupported},
    )

    def outer_leg_joints(row: list[Brick], leg: str) -> list[float]:
        if leg == "JX":
            selected = [brick for brick in row if abs(brick.rect.zmin - oz) <= LEVEL_TOL]
            selected.sort(key=lambda brick: brick.rect.xmin)
            spans = [(brick.rect.xmin, brick.rect.xmax) for brick in selected]
        elif leg == "JZ":
            selected = [brick for brick in row if abs(brick.rect.xmin - ox) <= LEVEL_TOL]
            selected.sort(key=lambda brick: brick.rect.zmin)
            spans = [(brick.rect.zmin, brick.rect.zmax) for brick in selected]
        else:
            raise ValueError(leg)
        joints = []
        for left, right in zip(spans, spans[1:]):
            gap = right[0] - left[1]
            if abs(gap - head_joint) <= LEVEL_TOL:
                joints.append((left[1] + right[0]) / 2)
        return joints

    joint_offsets = []
    stacked = []
    min_stagger = max(0.020, head_joint * 1.5)
    for lower_id, upper_id in zip(course_ids, course_ids[1:]):
        for face in ("JX", "JZ"):
            lower_joints = outer_leg_joints(courses[lower_id], face)
            upper_joints = outer_leg_joints(courses[upper_id], face)
            for upper_joint in upper_joints:
                if not lower_joints:
                    continue
                offset = min(abs(upper_joint - lower_joint) for lower_joint in lower_joints)
                item = {
                    "lower": lower_id,
                    "upper": upper_id,
                    "face": face,
                    "upperJointCoordinate": upper_joint,
                    "nearestOffsetM": offset,
                }
                joint_offsets.append(item)
                if offset < min_stagger - LEVEL_TOL:
                    stacked.append(item)
    add_check(
        report,
        "real_jx_jz_face_joints_do_not_stack",
        bool(joint_offsets) and not stacked,
        {"minimumRequiredM": min_stagger, "bad": stacked, "sample": joint_offsets[:24]},
    )


def audit_page(html_path: Path) -> dict[str, Any]:
    report: dict[str, Any] = {
        "schemaVersion": "brick-mother-bond-independent-qa-r3.1",
        "artifact": {"path": str(html_path), "bytes": None, "sha256": None},
        "checks": {},
        "passed": False,
        "humanVisualApproval": False,
        "note": "Independent source/coordinate audit; this does not claim visual approval.",
    }
    if not html_path.is_file():
        add_check(report, "html_exists", False, str(html_path))
        return report

    raw = html_path.read_bytes()
    text = raw.decode("utf-8")
    report["artifact"].update({"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()})
    add_check(report, "html_exists", True, str(html_path))

    parser = PageParser()
    parser.feed(text)
    add_check(report, "one_real_webgl_canvas", parser.canvas_count == 1, parser.canvas_count)

    forbidden = {token: text.count(token) for token in FORBIDDEN_R3_TOKENS if token in text}
    add_check(report, "failed_r3_mesh_core_plaster_paths_absent", not forbidden, forbidden)

    shader_declared = {
        name: bool(re.search(rf"(?:float|function)\s+{re.escape(name)}\s*\(", text))
        for name in REQUIRED_SHADER_DECLARATIONS
    }
    long_clamp = bool(re.search(r"-\s*\.0022", text)) and bool(re.search(r"\.00045", text))
    add_check(
        report,
        "actual_shader_contains_canonical_sdf_edge_path",
        all(shader_declared.values()) and long_clamp,
        {"declarations": shader_declared, "longEdgeClampConstants": long_clamp},
    )
    half_pose_uses_kernel_center = bool(
        re.search(r"p\s*\.\s*kernelCenter\s*(?:\|\||\?\?)\s*p\s*\.\s*center", text)
    )
    positive_cut_declared = "local-x-positive" in text and "cutStock" in text
    negative_quarter_rotation = bool(re.search(r"pose\s*\.\s*w\s*<\s*-\s*\.5", text))
    add_check(
        report,
        "renderer_uses_kernel_center_and_real_cut_plane_for_half_bricks",
        half_pose_uses_kernel_center and positive_cut_declared and negative_quarter_rotation,
        {
            "kernelCenterUploaded": half_pose_uses_kernel_center,
            "positiveCut": positive_cut_declared,
            "negativeQuarterRotation": negative_quarter_rotation,
        },
    )

    found_views = set(parser.views)
    add_check(
        report,
        "four_physical_view_controls",
        REQUIRED_VIEWS.issubset(found_views)
        and any(token in text for token in ("setView", "resetCamera")),
        {
            "found": sorted(found_views),
            "required": sorted(REQUIRED_VIEWS),
            "viewHandler": "setView" in text or "resetCamera" in text,
        },
    )
    found_modes = set(parser.modes)
    has_mother = any(value in found_modes for value in ("mother", "single-brick", "canonical"))
    has_wall = any(value in found_modes for value in ("wall", "bond", "brick-wall"))
    add_check(
        report,
        "fixed_mother_and_bond_study_modes_only",
        has_mother and has_wall and len(found_modes) == 2,
        sorted(found_modes),
    )

    if not parser.manifest_text:
        add_check(report, "inert_placement_manifest_present", False, "#brick-bond-manifest missing or empty")
    else:
        try:
            manifest = json.loads(parser.manifest_text)
        except json.JSONDecodeError as exc:
            add_check(report, "inert_placement_manifest_present", False, str(exc))
        else:
            add_check(
                report,
                "inert_placement_manifest_present",
                isinstance(manifest, dict),
                manifest.get("schemaVersion") if isinstance(manifest, dict) else type(manifest).__name__,
            )
            ui = manifest.get("ui", {}) if isinstance(manifest, dict) else {}
            ui_views = set(ui.get("views", [])) if isinstance(ui, dict) else set()
            has_build_api = any(
                token in text
                for token in (
                    "setBuildStep",
                    "setVisibleCourses",
                    "setCourseCount",
                    "visiblePlacements",
                )
            ) and "courseBuild" in text and "buildStep<=activeCourse" in text.replace(" ", "")
            add_check(
                report,
                "course_build_control_is_real",
                bool(ui.get("courseBuildControl"))
                and REQUIRED_VIEWS.issubset(ui_views)
                and has_build_api,
                {"ui": ui, "buildApiDeclared": has_build_api},
            )
            if isinstance(manifest, dict):
                audit_geometry(manifest, report)

    report["passed"] = bool(report["checks"]) and all(
        item["passed"] for item in report["checks"].values()
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
        args.out.write_text(serialized, encoding="utf-8")
    sys.stdout.write(serialized)
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
