"""Harden the private V2.7.5 performance candidate after the base patch.

This pass adds one explicit renderer state API so interaction and auto-rotation
use the same invalidation path. The frozen V2.7.5 source remains untouched.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

CANDIDATE = Path(sys.argv[1])
MANIFEST = CANDIDATE.with_suffix(".json")
OLD_VERSION = "2.7.5-perf.1"
NEW_VERSION = "2.7.5-perf.2"

text = CANDIDATE.read_text()


def change(old: str, new: str, expected_count: int = 1) -> None:
    global text
    count = text.count(old)
    if count != expected_count:
        raise RuntimeError(f"Refinement contract mismatch. Expected {expected_count}, found {count}: {old[:120]!r}")
    text = text.replace(old, new)


change(
    """  invalidate() {
    this.needsDraw = true;
    if (this.framePending || document.hidden) return;
    this.framePending = true;
    requestAnimationFrame((t) => this.loop(t));
  }

  locations() {""",
    """  invalidate() {
    this.needsDraw = true;
    if (this.framePending || document.hidden) return;
    this.framePending = true;
    requestAnimationFrame((t) => this.loop(t));
  }

  setAutoRotate(enabled) {
    this.autoRotate = Boolean(enabled);
    this.needsDraw = true;
    if (!document.hidden && !this.framePending) {
      this.framePending = true;
      requestAnimationFrame((t) => this.loop(t));
    }
    document.documentElement.dataset.autoRotate = this.autoRotate ? 'true' : 'false';
    return this.autoRotate;
  }

  diagnostics() {
    return {
      autoRotate: this.autoRotate,
      framePending: this.framePending,
      needsDraw: this.needsDraw,
      renderCount: this.renderCount,
      documentHidden: document.hidden
    };
  }

  locations() {""",
)

change(
    """    state.renderer.autoRotate = !state.renderer.autoRotate;
    state.renderer.invalidate();
    event.currentTarget.classList.toggle('on', state.renderer.autoRotate);
    event.currentTarget.textContent = state.renderer.autoRotate ? '停止旋转' : '自动旋转';
  });""",
    """    state.renderer.setAutoRotate(!state.renderer.autoRotate);
    event.currentTarget.classList.toggle('on', state.renderer.autoRotate);
    event.currentTarget.textContent = state.renderer.autoRotate ? '停止旋转' : '自动旋转';
  });""",
)

change(
    """      sourceComparisonNoDimming: true
    };
    const qaNode = document.getElementById('brickMotherQA') || document.createElement('script');""",
    """      sourceComparisonNoDimming: true
    };
    window.__BRICK_MOTHER_PERFORMANCE__ = {
      version: '2.7.5-perf.2',
      diagnostics: () => state.renderer.diagnostics(),
      setAutoRotate: (enabled) => state.renderer.setAutoRotate(enabled),
      toggleViaButton: () => {
        document.querySelector('#autoRotate').click();
        return state.renderer.diagnostics();
      }
    };
    const qaNode = document.getElementById('brickMotherQA') || document.createElement('script');""",
)

version_count = text.count(OLD_VERSION)
if version_count < 2:
    raise RuntimeError(f"Expected at least two candidate version stamps, found {version_count}")
text = text.replace(OLD_VERSION, NEW_VERSION)
if OLD_VERSION in text:
    raise RuntimeError("Old candidate version remains after refinement")

CANDIDATE.write_text(text)
data = CANDIDATE.read_bytes()
manifest = json.loads(MANIFEST.read_text())
manifest["schemaVersion"] = "1.1.0"
manifest["candidateRuntime"] = NEW_VERSION
manifest["candidateBytes"] = len(data)
manifest["candidateSha256"] = hashlib.sha256(data).hexdigest()
manifest["singleHypothesis"] = "Replace unconditional RAF rendering with explicit invalidation while preserving identical material, geometry, camera and lighting output."
manifest["rendererStateAPI"] = True
manifest["visualApproved"] = False
manifest["productionApproved"] = False
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

print(json.dumps(manifest, ensure_ascii=False, indent=2))
