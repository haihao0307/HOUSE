#!/usr/bin/env python3
"""Small regression test for the weighted RGB percentile contract."""

from pathlib import Path
import runpy

import numpy as np


HERE = Path(__file__).resolve().parent
module = runpy.run_path(str(HERE / "analyze_effective_regions.py"))
weighted_percentile = module["weighted_percentile"]
rgb_summary = module["rgb_summary"]

values = np.array([0.0, 10.0, 20.0])
weights = np.array([1.0, 1.0, 8.0])
assert weighted_percentile(values, weights, 50) == 20.0
assert weighted_percentile(values, weights, 5) == 0.0
assert weighted_percentile(values, weights, 95) == 20.0

summary = rgb_summary(np.column_stack([values, values, values]), weights)
assert summary["p50"] == [20.0, 20.0, 20.0]
assert summary["unweightedPercentiles"]["p50"] == [10.0, 10.0, 10.0]
assert summary["percentileMethod"].startswith("discrete weighted percentile")
print("weighted percentile regression: passed")
