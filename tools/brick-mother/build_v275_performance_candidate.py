"""Build an additive V2.7.5 performance candidate from the frozen core.

Only scheduling and invalidation are changed. The canonical source remains
byte-identical and the candidate is never promoted by this builder.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

SOURCE = Path(sys.argv[1])
OUTPUT = Path(sys.argv[2])
EXPECTED_BLOB = "7b10389cb9367f7423619262820883cc94b07a61"
CANDIDATE_VERSION = "2.7.5-perf.1"

source_bytes = SOURCE.read_bytes()
source_blob = hashlib.sha1(b"blob " + str(len(source_bytes)).encode() + b"\0" + source_bytes).hexdigest()
if source_blob != EXPECTED_BLOB:
    raise RuntimeError(f"Frozen V2.7.5 blob mismatch: {source_blob}")

text = source_bytes.decode("utf-8")


def change(old: str, new: str, expected_count: int = 1) -> None:
    global text
    count = text.count(old)
    if count != expected_count:
        raise RuntimeError(f"Patch contract mismatch. Expected {expected_count}, found {count}: {old[:100]!r}")
    text = text.replace(old, new)


change(
    """    this.drag = false;
    this.pan = false;
    this.lastTime = 0;
    this.bind();
    this.createGround();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    requestAnimationFrame((t) => this.loop(t));
  }

  locations() {""",
    """    this.drag = false;
    this.pan = false;
    this.lastTime = 0;
    this.needsDraw = true;
    this.framePending = false;
    this.renderCount = 0;
    this.bind();
    this.createGround();
    this.resizeObserver = new ResizeObserver(() => { this.resize(); this.invalidate(); });
    this.resizeObserver.observe(canvas);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.invalidate(); });
    this.resize();
    this.invalidate();
  }

  invalidate() {
    this.needsDraw = true;
    if (this.framePending || document.hidden) return;
    this.framePending = true;
    requestAnimationFrame((t) => this.loop(t));
  }

  locations() {""",
)

change(
    """    c.addEventListener('pointerdown', (e) => {
      this.drag = true;
      this.pan = e.button === 2 || e.shiftKey;
      this.px = e.clientX;
      this.py = e.clientY;
      c.setPointerCapture(e.pointerId);
    });""",
    """    c.addEventListener('pointerdown', (e) => {
      this.drag = true;
      this.pan = e.button === 2 || e.shiftKey;
      this.px = e.clientX;
      this.py = e.clientY;
      c.setPointerCapture(e.pointerId);
      this.invalidate();
    });""",
)

change(
    """      } else {
        this.camera.yaw += dx * 0.007;
        this.camera.pitch = clamp(this.camera.pitch + dy * 0.006, -1.15, 1.05);
      }
    });
    const stop = () => { this.drag = false; };""",
    """      } else {
        this.camera.yaw += dx * 0.007;
        this.camera.pitch = clamp(this.camera.pitch + dy * 0.006, -1.15, 1.05);
      }
      this.invalidate();
    });
    const stop = () => { this.drag = false; this.invalidate(); };""",
)

change(
    """      e.preventDefault();
      this.camera.distance = clamp(this.camera.distance * Math.exp(e.deltaY * 0.001), 3.1, 27);
    }, { passive: false });""",
    """      e.preventDefault();
      this.camera.distance = clamp(this.camera.distance * Math.exp(e.deltaY * 0.001), 3.1, 27);
      this.invalidate();
    }, { passive: false });""",
)

change(
    """    this.staticDrawn = false;
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  setDebugMode(mode) {
    this.debugMode = clamp(Number(mode) || 0, 0, 10);
  }""",
    """    this.staticDrawn = false;
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.invalidate();
  }

  setDebugMode(mode) {
    this.debugMode = clamp(Number(mode) || 0, 0, 10);
    this.invalidate();
  }""",
)

change(
    """    this.camera = benchmark
      ? { yaw: 0.22, pitch: 0.07, distance: this.meshes.length > 1 ? 13.2 : 4.95, target: vec3(0, 0, 0) }
      : { yaw: 0.76, pitch: 0.27, distance: 13.5, target: vec3(0, 0.7, 0) };
  }""",
    """    this.camera = benchmark
      ? { yaw: 0.22, pitch: 0.07, distance: this.meshes.length > 1 ? 13.2 : 4.95, target: vec3(0, 0, 0) }
      : { yaw: 0.76, pitch: 0.27, distance: 13.5, target: vec3(0, 0.7, 0) };
    this.invalidate();
  }""",
)

change(
    """    this.camera.yaw = benchmark ? 0.22 + m.yaw * 0.10 : 0.82 + m.yaw * 0.25;
    this.camera.pitch = benchmark ? 0.07 : 0.20;
  }""",
    """    this.camera.yaw = benchmark ? 0.22 + m.yaw * 0.10 : 0.82 + m.yaw * 0.25;
    this.camera.pitch = benchmark ? 0.07 : 0.20;
    this.invalidate();
  }""",
)

change(
    """  loop(t) {
    if (this.staticEvidence) {
      const canvasReady =
        document.documentElement.dataset.brickMotherReady === 'true' &&
        this.canvas.clientWidth >= 640 && this.canvas.clientHeight >= 400 &&
        this.canvas.width >= 640 && this.canvas.height >= 400;
      if (this.meshes.length && !this.staticDrawn && canvasReady) {
        this.draw();
        // Headless SwiftShader may return the screenshot before the single
        // evidence draw has completed on the GPU.  Fence only this frozen
        // path so interactive previews keep their normal asynchronous RAF.
        this.gl.finish();
        this.staticDrawn = true;
      } else if (!this.staticDrawn) {
        // Wait for both the async build and the evidence CSS/ResizeObserver
        // layout before freezing the one deterministic frame.
        requestAnimationFrame((n) => this.loop(n));
      }
      return;
    }
    const dt = Math.min(0.05, (t - this.lastTime) / 1000 || 0);
    this.lastTime = t;
    if (this.autoRotate && !this.drag) this.camera.yaw += dt * 0.16;
    this.draw();
    requestAnimationFrame((n) => this.loop(n));
  }

  capture() {
    return this.canvas.toDataURL('image/png');
  }""",
    """  loop(t) {
    this.framePending = false;
    if (document.hidden) {
      this.needsDraw = true;
      return;
    }
    if (this.staticEvidence) {
      const canvasReady =
        document.documentElement.dataset.brickMotherReady === 'true' &&
        this.canvas.clientWidth >= 640 && this.canvas.clientHeight >= 400 &&
        this.canvas.width >= 640 && this.canvas.height >= 400;
      if (this.meshes.length && !this.staticDrawn && canvasReady) {
        this.draw();
        this.gl.finish();
        this.staticDrawn = true;
        this.renderCount += 1;
        document.documentElement.dataset.renderCount = String(this.renderCount);
      } else if (!this.staticDrawn) {
        this.invalidate();
      }
      return;
    }
    const dt = Math.min(0.05, (t - this.lastTime) / 1000 || 0);
    this.lastTime = t;
    if (this.autoRotate && !this.drag) {
      this.camera.yaw += dt * 0.16;
      this.needsDraw = true;
    }
    if (this.needsDraw) {
      this.needsDraw = false;
      this.draw();
      this.renderCount += 1;
      document.documentElement.dataset.renderCount = String(this.renderCount);
    }
    if (this.autoRotate || this.drag || this.needsDraw) this.invalidate();
  }

  capture() {
    if (this.needsDraw) {
      this.needsDraw = false;
      this.draw();
      this.renderCount += 1;
      document.documentElement.dataset.renderCount = String(this.renderCount);
    }
    this.gl.finish();
    return this.canvas.toDataURL('image/png');
  }""",
)

change(
    """    state.renderer.autoRotate = !state.renderer.autoRotate;
    event.currentTarget.classList.toggle('on', state.renderer.autoRotate);
    event.currentTarget.textContent = state.renderer.autoRotate ? '停止旋转' : '自动旋转';
  });""",
    """    state.renderer.autoRotate = !state.renderer.autoRotate;
    state.renderer.invalidate();
    event.currentTarget.classList.toggle('on', state.renderer.autoRotate);
    event.currentTarget.textContent = state.renderer.autoRotate ? '停止旋转' : '自动旋转';
  });""",
)

text = text.replace(
    "document.documentElement.dataset.brickMotherVersion = '2.7.5-alpha.1';",
    "document.documentElement.dataset.brickMotherVersion = '2.7.5-perf.1';\n    document.documentElement.dataset.performanceCandidate = 'on-demand-render';",
)
text = text.replace("version: '2.7.5-alpha.1',", "version: '2.7.5-perf.1',")
if "version: '2.7.5-alpha.1'" in text:
    raise RuntimeError("Candidate runtime identity replacement was incomplete")

OUTPUT.write_text(text)
output_bytes = OUTPUT.read_bytes()
manifest = {
    "schemaVersion": "1.0.0",
    "sourceFile": SOURCE.name,
    "sourceBlob": EXPECTED_BLOB,
    "candidateFile": OUTPUT.name,
    "candidateRuntime": CANDIDATE_VERSION,
    "candidateBytes": len(output_bytes),
    "candidateSha256": hashlib.sha256(output_bytes).hexdigest(),
    "singleHypothesis": "Replace unconditional RAF rendering with explicit invalidation while retaining identical material, geometry, camera and lighting code.",
    "visualApproved": False,
    "productionApproved": False,
}
manifest_path = OUTPUT.with_suffix(".json")
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(manifest, ensure_ascii=False, indent=2))
