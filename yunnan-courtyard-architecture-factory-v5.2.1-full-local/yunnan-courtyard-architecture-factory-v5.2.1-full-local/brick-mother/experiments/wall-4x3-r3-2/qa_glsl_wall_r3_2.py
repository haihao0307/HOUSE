#!/usr/bin/env python3
"""Capture R3.2's real runtime shaders and default uniform uploads, then
compile, link and draw them unchanged with Mesa surfaceless EGL.

This complements the static and Node-VM audits.  In particular, it does not
accept a manifest claim as proof that the generated GLSL is valid: the page's
own JavaScript must assemble the shaders and issue a draw before this harness
replays that draw on a real OpenGL ES 3 implementation.
"""

from __future__ import annotations

import argparse
import ctypes
import hashlib
import importlib.util
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
DEFAULT_HTML = HERE.parents[1] / "Brick_Mother_Wall_4x3_R3_2.html"
R31_GL_HELPER = HERE.parent / "bond-study-r3-1" / "qa_glsl_r3_1.py"


def _load_r31_helper() -> Any:
    spec = importlib.util.spec_from_file_location("brick_r31_gl_helper", R31_GL_HELPER)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load EGL helper: {R31_GL_HELPER}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


GL = _load_r31_helper()


NODE_HARNESS = r"""
'use strict';
const fs = require('fs');
const payload = JSON.parse(fs.readFileSync(0, 'utf8'));
const noop = () => undefined;
const captures = {shaders: {}, programs: {}, uniforms: {}, draws: [], state: {}, consoleErrors: []};
let nextId = 1;
let currentProgram = null;
const classList = () => {
  const values = new Set();
  return {
    add: (...xs) => xs.forEach(x => values.add(x)),
    remove: (...xs) => xs.forEach(x => values.delete(x)),
    toggle: (x, force) => {
      const enabled = force === undefined ? !values.has(x) : Boolean(force);
      if (enabled) values.add(x); else values.delete(x);
      return enabled;
    },
    contains: x => values.has(x),
  };
};
function element(id, extra = {}) {
  const listeners = new Map();
  return Object.assign({
    id, value: '', textContent: '', hidden: false, disabled: false,
    width: 0, height: 0, dataset: {}, style: {}, classList: classList(),
    onclick: null,
    setAttribute: noop, getAttribute: () => null, setPointerCapture: noop,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    dispatch(type) {
      const event = {target: this, currentTarget: this, preventDefault: noop,
        pointerId: 1, clientX: 0, clientY: 0, deltaY: 0};
      for (const fn of listeners.get(type) || []) fn(event);
    },
  }, extra);
}
const elements = new Map();
for (const item of payload.elements) {
  elements.set(item.id, element(item.id, {
    value: item.value || '', hidden: Boolean(item.hidden), disabled: Boolean(item.disabled),
  }));
}
for (const [id, source] of Object.entries(payload.scriptBlocks)) {
  if (!elements.has(id)) elements.set(id, element(id));
  elements.get(id).textContent = source;
}
const stage = element('stage', {
  getBoundingClientRect: () => ({x: 0, y: 0, width: 960, height: 620}),
});
const controls = payload.controls.map(item => element(
  `${item.attribute}-${item.value}`,
  {dataset: {[item.attribute.slice(5)]: item.value}},
));
const clone = value => ArrayBuffer.isView(value) ? Array.from(value) :
  Array.isArray(value) ? value.map(clone) : value;
const glBase = {
  VERTEX_SHADER: 0x8b31, FRAGMENT_SHADER: 0x8b30,
  COMPILE_STATUS: 0x8b81, LINK_STATUS: 0x8b82, TRIANGLES: 4,
  COLOR_BUFFER_BIT: 0x4000, DEPTH_BUFFER_BIT: 0x0100,
  DEPTH_TEST: 0x0b71, LEQUAL: 0x0203, CULL_FACE: 0x0b44,
  createShader(type) {
    const shader = {id: nextId++, type};
    captures.shaders[shader.id] = {type, source: ''};
    return shader;
  },
  shaderSource(shader, source) { captures.shaders[shader.id].source = String(source); },
  compileShader: noop, getShaderParameter: () => true, getShaderInfoLog: () => '',
  createProgram() {
    const program = {id: nextId++};
    captures.programs[program.id] = {shaderIds: []};
    captures.uniforms[program.id] = {};
    return program;
  },
  attachShader(program, shader) { captures.programs[program.id].shaderIds.push(shader.id); },
  linkProgram: noop, getProgramParameter: () => true, getProgramInfoLog: () => '',
  createVertexArray: () => ({id: nextId++}), bindVertexArray: noop,
  useProgram(program) { currentProgram = program.id; },
  getUniformLocation(program, name) { return {programId: program.id, name}; },
  uniform1f(l, x) { captures.uniforms[l.programId][l.name] = {kind: '1f', value: Number(x)}; },
  uniform1i(l, x) { captures.uniforms[l.programId][l.name] = {kind: '1i', value: Number(x)}; },
  uniform2f(l, x, y) { captures.uniforms[l.programId][l.name] = {kind: '2f', value: [Number(x), Number(y)]}; },
  uniform3f(l, x, y, z) { captures.uniforms[l.programId][l.name] = {kind: '3f', value: [Number(x), Number(y), Number(z)]}; },
  uniform4f(l, x, y, z, w) { captures.uniforms[l.programId][l.name] = {kind: '4f', value: [Number(x), Number(y), Number(z), Number(w)]}; },
  uniform1fv(l, v) { captures.uniforms[l.programId][l.name] = {kind: '1fv', value: clone(v)}; },
  uniform2fv(l, v) { captures.uniforms[l.programId][l.name] = {kind: '2fv', value: clone(v)}; },
  uniform3fv(l, v) { captures.uniforms[l.programId][l.name] = {kind: '3fv', value: clone(v)}; },
  uniform4fv(l, v) { captures.uniforms[l.programId][l.name] = {kind: '4fv', value: clone(v)}; },
  uniformMatrix3fv(l, transpose, v) { captures.uniforms[l.programId][l.name] = {kind: 'm3', transpose: Boolean(transpose), value: clone(v)}; },
  uniformMatrix4fv(l, transpose, v) { captures.uniforms[l.programId][l.name] = {kind: 'm4', transpose: Boolean(transpose), value: clone(v)}; },
  viewport(x, y, w, h) { captures.viewport = [x, y, w, h]; },
  clearColor(r, g, b, a) { captures.state.clearColor = [r, g, b, a]; },
  clearDepth(value) { captures.state.clearDepth = value; },
  clear(mask) { captures.state.clearMask = mask; },
  enable(cap) { (captures.state.enabled ||= []).push(cap); },
  disable(cap) { (captures.state.disabled ||= []).push(cap); },
  depthFunc(func) { captures.state.depthFunc = func; },
  drawArrays(mode, first, count) {
    captures.draws.push({kind: 'arrays', programId: currentProgram, mode, first, count,
      uniforms: JSON.parse(JSON.stringify(captures.uniforms[currentProgram] || {}))});
  },
  drawArraysInstanced(mode, first, count, instanceCount) {
    captures.draws.push({kind: 'arrays-instanced', programId: currentProgram, mode, first, count,
      instanceCount, uniforms: JSON.parse(JSON.stringify(captures.uniforms[currentProgram] || {}))});
  },
};
const gl = new Proxy(glBase, {get: (target, key) => key in target ? target[key] : noop});
if (!elements.has('c')) elements.set('c', element('c'));
elements.get('c').getContext = kind => kind === 'webgl2' ? gl : null;
const document = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, element(id));
    return elements.get(id);
  },
  querySelector(selector) { return selector === '.stage' ? stage : null; },
  querySelectorAll(selector) {
    const match = selector.match(/^\[data-([a-z0-9_-]+)\]$/i);
    return match ? controls.filter(c => Object.hasOwn(c.dataset, match[1])) : [];
  },
};
let frames = 0;
const sandboxWindow = {
  addEventListener: noop,
};
globalThis.document = document;
globalThis.window = Object.assign(globalThis, sandboxWindow);
globalThis.ResizeObserver = class { constructor(fn) { this.fn = fn; } observe() {} disconnect() {} };
globalThis.requestAnimationFrame = callback => {
  if (frames >= 24) return frames;
  frames += 1;
  callback(frames * 16.6667);
  return frames;
};
globalThis.cancelAnimationFrame = noop;
globalThis.devicePixelRatio = 1;
globalThis.HTMLCanvasElement = function HTMLCanvasElement() {};
const originalError = console.error;
console.error = (...xs) => { captures.consoleErrors.push(xs.map(String).join(' ')); };
try {
  eval(payload.mainScript);
} finally {
  console.error = originalError;
}
if (payload.requestedView && payload.requestedView !== 'iso') {
  const viewControl = controls.find(control => control.dataset.view === payload.requestedView);
  if (!viewControl || typeof viewControl.onclick !== 'function') {
    throw new Error(`requested view ${payload.requestedView} is unavailable`);
  }
  viewControl.onclick({target: viewControl, currentTarget: viewControl});
}
captures.requestedView = payload.requestedView || 'iso';
captures.ready = elements.get('c').dataset.ready || null;
captures.error = elements.get('error') ? {
  hidden: elements.get('error').hidden,
  text: elements.get('error').textContent,
} : null;
captures.status = elements.get('status') ? elements.get('status').textContent : null;
process.stdout.write(JSON.stringify(captures));
"""


def extract_page_payload(html: str) -> dict[str, Any]:
    scripts: list[tuple[str | None, str | None, str]] = []
    for attrs, body in re.findall(r"<script\b([^>]*)>(.*?)</script\s*>", html, re.I | re.S):
        id_match = re.search(r"\bid\s*=\s*['\"]([^'\"]+)['\"]", attrs, re.I)
        type_match = re.search(r"\btype\s*=\s*['\"]([^'\"]+)['\"]", attrs, re.I)
        scripts.append((
            id_match.group(1) if id_match else None,
            type_match.group(1).lower() if type_match else None,
            body,
        ))
    executable = [body for _id, kind, body in scripts if not kind or "javascript" in kind]
    if len(executable) != 1:
        raise RuntimeError(f"expected one executable inline script, found {len(executable)}")
    blocks = {script_id: body for script_id, _kind, body in scripts if script_id}
    elements: list[dict[str, Any]] = []
    for match in re.finditer(r"<([a-z][\w:-]*)\b([^>]*)>", html, re.I | re.S):
        attrs = match.group(2)
        id_match = re.search(r"\bid\s*=\s*['\"]([^'\"]+)['\"]", attrs, re.I)
        if not id_match:
            continue
        value_match = re.search(r"\bvalue\s*=\s*['\"]([^'\"]*)['\"]", attrs, re.I)
        elements.append({
            "id": id_match.group(1),
            "value": value_match.group(1) if value_match else "",
            "hidden": bool(re.search(r"(?:^|\s)hidden(?:\s|=|$)", attrs, re.I)),
            "disabled": bool(re.search(r"(?:^|\s)disabled(?:\s|=|$)", attrs, re.I)),
        })
    controls = [
        {"attribute": f"data-{name}", "value": value}
        for name, value in re.findall(r"\bdata-([a-z0-9_-]+)\s*=\s*['\"]([^'\"]+)['\"]", html, re.I)
    ]
    return {"mainScript": executable[0], "scriptBlocks": blocks, "elements": elements, "controls": controls}


def capture_runtime(html_path: Path, requested_view: str = "iso") -> dict[str, Any]:
    node = shutil.which("node")
    if not node:
        raise RuntimeError("Node.js is unavailable")
    payload = extract_page_payload(html_path.read_text(encoding="utf-8"))
    payload["requestedView"] = requested_view
    run = subprocess.run(
        [node, "-e", NODE_HARNESS],
        input=json.dumps(payload, ensure_ascii=False),
        text=True,
        capture_output=True,
        timeout=45,
        check=False,
    )
    if run.returncode != 0:
        raise RuntimeError(run.stderr.strip() or run.stdout.strip() or f"Node exit {run.returncode}")
    try:
        capture = json.loads(run.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError("runtime capture returned malformed JSON") from exc
    stages = list(capture.get("shaders", {}).values())
    if not any(item.get("type") == GL.GL_VERTEX_SHADER for item in stages) or not any(
        item.get("type") == GL.GL_FRAGMENT_SHADER for item in stages
    ):
        raise RuntimeError("page did not submit both shader stages")
    if not capture.get("draws"):
        raise RuntimeError("page JavaScript did not issue a default draw")
    if capture.get("consoleErrors"):
        raise RuntimeError("page logged runtime errors: " + "; ".join(capture["consoleErrors"]))
    if capture.get("error") and capture["error"].get("hidden") is False:
        raise RuntimeError("page displayed an error: " + str(capture["error"].get("text")))
    return capture


def compile_and_replay(
    capture: dict[str, Any], width: int, height: int, png_path: Path | None
) -> dict[str, Any]:
    with GL.EglGlesContext(width, height) as context:
        create_shader = context.proc("glCreateShader", ctypes.c_uint, [ctypes.c_uint])
        shader_source = context.proc("glShaderSource", None, [ctypes.c_uint, ctypes.c_int, ctypes.POINTER(ctypes.c_char_p), ctypes.POINTER(ctypes.c_int)])
        compile_shader = context.proc("glCompileShader", None, [ctypes.c_uint])
        get_shader_iv = context.proc("glGetShaderiv", None, [ctypes.c_uint, ctypes.c_uint, ctypes.POINTER(ctypes.c_int)])
        get_shader_log = context.proc("glGetShaderInfoLog", None, [ctypes.c_uint, ctypes.c_int, ctypes.POINTER(ctypes.c_int), ctypes.c_char_p])
        create_program = context.proc("glCreateProgram", ctypes.c_uint, [])
        attach_shader = context.proc("glAttachShader", None, [ctypes.c_uint, ctypes.c_uint])
        link_program = context.proc("glLinkProgram", None, [ctypes.c_uint])
        get_program_iv = context.proc("glGetProgramiv", None, [ctypes.c_uint, ctypes.c_uint, ctypes.POINTER(ctypes.c_int)])
        get_program_log = context.proc("glGetProgramInfoLog", None, [ctypes.c_uint, ctypes.c_int, ctypes.POINTER(ctypes.c_int), ctypes.c_char_p])
        use_program = context.proc("glUseProgram", None, [ctypes.c_uint])
        delete_shader = context.proc("glDeleteShader", None, [ctypes.c_uint])
        delete_program = context.proc("glDeleteProgram", None, [ctypes.c_uint])
        get_uniform = context.proc("glGetUniformLocation", ctypes.c_int, [ctypes.c_uint, ctypes.c_char_p])
        gen_vaos = context.proc("glGenVertexArrays", None, [ctypes.c_int, ctypes.POINTER(ctypes.c_uint)])
        bind_vao = context.proc("glBindVertexArray", None, [ctypes.c_uint])
        viewport = context.proc("glViewport", None, [ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int])
        draw_arrays = context.proc("glDrawArrays", None, [ctypes.c_uint, ctypes.c_int, ctypes.c_int])
        draw_arrays_instanced = context.proc(
            "glDrawArraysInstanced",
            None,
            [ctypes.c_uint, ctypes.c_int, ctypes.c_int, ctypes.c_int],
        )
        enable = context.proc("glEnable", None, [ctypes.c_uint])
        disable = context.proc("glDisable", None, [ctypes.c_uint])
        depth_func = context.proc("glDepthFunc", None, [ctypes.c_uint])
        clear_color = context.proc(
            "glClearColor",
            None,
            [ctypes.c_float, ctypes.c_float, ctypes.c_float, ctypes.c_float],
        )
        clear_depth = context.proc("glClearDepthf", None, [ctypes.c_float])
        clear = context.proc("glClear", None, [ctypes.c_uint])
        finish = context.proc("glFinish", None, [])
        read_pixels = context.proc("glReadPixels", None, [ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_uint, ctypes.c_uint, ctypes.c_void_p])
        get_error = context.proc("glGetError", ctypes.c_uint, [])

        def compile_one(stage: int, source: str, label: str) -> tuple[int, float]:
            shader = int(create_shader(stage))
            encoded = source.encode("utf-8")
            pointer = ctypes.c_char_p(encoded)
            length = ctypes.c_int(len(encoded))
            shader_source(shader, 1, ctypes.byref(pointer), ctypes.byref(length))
            started = time.monotonic()
            compile_shader(shader)
            duration = round(time.monotonic() - started, 4)
            okay = ctypes.c_int()
            get_shader_iv(shader, GL.GL_COMPILE_STATUS, ctypes.byref(okay))
            if not okay.value:
                log_length = ctypes.c_int()
                get_shader_iv(shader, GL.GL_INFO_LOG_LENGTH, ctypes.byref(log_length))
                buffer = ctypes.create_string_buffer(max(1, log_length.value))
                written = ctypes.c_int()
                get_shader_log(shader, len(buffer), ctypes.byref(written), buffer)
                raise RuntimeError(f"{label} shader compilation failed:\n{GL._decode(buffer.value)}")
            return shader, duration

        real_programs: dict[str, int] = {}
        real_shaders: list[int] = []
        program_audit: dict[str, Any] = {}
        for captured_program_id, captured_program in capture["programs"].items():
            stages: dict[int, str] = {}
            for shader_id in captured_program["shaderIds"]:
                shader = capture["shaders"][str(shader_id)]
                stages[int(shader["type"])] = str(shader["source"])
            if set(stages) != {GL.GL_VERTEX_SHADER, GL.GL_FRAGMENT_SHADER}:
                raise RuntimeError(f"captured program {captured_program_id} does not have exactly VS+FS")
            vs, vs_time = compile_one(GL.GL_VERTEX_SHADER, stages[GL.GL_VERTEX_SHADER], f"program-{captured_program_id}-vertex")
            fs, fs_time = compile_one(GL.GL_FRAGMENT_SHADER, stages[GL.GL_FRAGMENT_SHADER], f"program-{captured_program_id}-fragment")
            real_shaders.extend((vs, fs))
            program = int(create_program())
            attach_shader(program, vs)
            attach_shader(program, fs)
            started = time.monotonic()
            link_program(program)
            link_time = round(time.monotonic() - started, 4)
            linked = ctypes.c_int()
            get_program_iv(program, GL.GL_LINK_STATUS, ctypes.byref(linked))
            if not linked.value:
                log_length = ctypes.c_int()
                get_program_iv(program, GL.GL_INFO_LOG_LENGTH, ctypes.byref(log_length))
                buffer = ctypes.create_string_buffer(max(1, log_length.value))
                written = ctypes.c_int()
                get_program_log(program, len(buffer), ctypes.byref(written), buffer)
                raise RuntimeError(f"program {captured_program_id} link failed:\n" + GL._decode(buffer.value))
            real_programs[str(captured_program_id)] = program
            combined = stages[GL.GL_VERTEX_SHADER] + "\n" + stages[GL.GL_FRAGMENT_SHADER]
            role = "brick" if "surfaceDelta" in combined else "soil" if "soilSdf" in combined else "floor"
            program_audit[str(captured_program_id)] = {
                "role": role,
                "compileSeconds": {"vertex": vs_time, "fragment": fs_time},
                "linkSeconds": link_time,
                "vertexBytes": len(stages[GL.GL_VERTEX_SHADER].encode("utf-8")),
                "fragmentBytes": len(stages[GL.GL_FRAGMENT_SHADER].encode("utf-8")),
                "vertexSha256": hashlib.sha256(stages[GL.GL_VERTEX_SHADER].encode("utf-8")).hexdigest(),
                "fragmentSha256": hashlib.sha256(stages[GL.GL_FRAGMENT_SHADER].encode("utf-8")).hexdigest(),
            }

        roles = [item["role"] for item in program_audit.values()]
        if sorted(roles) != ["brick", "floor", "soil"]:
            raise RuntimeError(f"expected independent brick/soil/floor programs, found {roles}")
        vao = ctypes.c_uint()
        gen_vaos(1, ctypes.byref(vao))
        bind_vao(vao.value)
        viewport(0, 0, width, height)
        state = capture.get("state", {})
        clear_rgba = state.get("clearColor", [0.04, 0.047, 0.042, 1.0])
        clear_color(*map(float, clear_rgba))
        clear_depth(float(state.get("clearDepth", 1.0)))
        for capability in state.get("enabled", [0x0B71]):
            enable(int(capability))
        for capability in state.get("disabled", [0x0B44]):
            disable(int(capability))
        depth_func(int(state.get("depthFunc", 0x0203)))
        clear(int(state.get("clearMask", 0x4000 | 0x0100)))

        uniform_calls = {
            "1f": context.proc("glUniform1f", None, [ctypes.c_int, ctypes.c_float]),
            "1i": context.proc("glUniform1i", None, [ctypes.c_int, ctypes.c_int]),
            "2f": context.proc("glUniform2f", None, [ctypes.c_int, ctypes.c_float, ctypes.c_float]),
            "3f": context.proc("glUniform3f", None, [ctypes.c_int, ctypes.c_float, ctypes.c_float, ctypes.c_float]),
            "4f": context.proc("glUniform4f", None, [ctypes.c_int, ctypes.c_float, ctypes.c_float, ctypes.c_float, ctypes.c_float]),
            "1fv": context.proc("glUniform1fv", None, [ctypes.c_int, ctypes.c_int, ctypes.POINTER(ctypes.c_float)]),
            "2fv": context.proc("glUniform2fv", None, [ctypes.c_int, ctypes.c_int, ctypes.POINTER(ctypes.c_float)]),
            "3fv": context.proc("glUniform3fv", None, [ctypes.c_int, ctypes.c_int, ctypes.POINTER(ctypes.c_float)]),
            "4fv": context.proc("glUniform4fv", None, [ctypes.c_int, ctypes.c_int, ctypes.POINTER(ctypes.c_float)]),
            "m3": context.proc("glUniformMatrix3fv", None, [ctypes.c_int, ctypes.c_int, ctypes.c_uint, ctypes.POINTER(ctypes.c_float)]),
            "m4": context.proc("glUniformMatrix4fv", None, [ctypes.c_int, ctypes.c_int, ctypes.c_uint, ctypes.POINTER(ctypes.c_float)]),
        }
        uploaded: list[dict[str, Any]] = []

        def upload_snapshot(program: int, snapshot: dict[str, Any], captured_program_id: str) -> None:
            for name, item in snapshot.items():
                location = int(get_uniform(program, name.encode("utf-8")))
                if location < 0:
                    uploaded.append({"programId": captured_program_id, "name": name, "kind": item["kind"], "optimizedOut": True})
                    continue
                kind = item["kind"]
                value = item["value"]
                if name in {"uRes", "uResolution", "resolution"}:
                    kind, value = "2f", [float(width), float(height)]
                if kind in {"1f", "1i"}:
                    uniform_calls[kind](location, value)
                elif kind in {"2f", "3f", "4f"}:
                    uniform_calls[kind](location, *value)
                elif kind in {"1fv", "2fv", "3fv", "4fv"}:
                    width_per_item = int(kind[0])
                    array = (ctypes.c_float * len(value))(*map(float, value))
                    uniform_calls[kind](location, len(value) // width_per_item, array)
                elif kind in {"m3", "m4"}:
                    width_per_matrix = 9 if kind == "m3" else 16
                    array = (ctypes.c_float * len(value))(*map(float, value))
                    uniform_calls[kind](location, len(value) // width_per_matrix, 0, array)
                else:
                    raise RuntimeError(f"unsupported captured uniform kind {kind} for {name}")
                uploaded.append({"programId": captured_program_id, "name": name, "kind": kind, "count": len(value) if isinstance(value, list) else 1})

        errors: list[str] = []
        while True:
            code = int(get_error())
            if code == GL.GL_NO_ERROR:
                break
            errors.append(f"0x{code:04x}")
        if errors:
            raise RuntimeError("uniform replay generated GL errors: " + ", ".join(errors))

        replayed_draws: list[dict[str, Any]] = []
        started = time.monotonic()
        for captured_draw in capture["draws"]:
            captured_program_id = str(captured_draw["programId"])
            program = real_programs[captured_program_id]
            use_program(program)
            upload_snapshot(program, captured_draw["uniforms"], captured_program_id)
            if captured_draw["kind"] == "arrays-instanced":
                draw_arrays_instanced(
                    int(captured_draw["mode"]),
                    int(captured_draw["first"]),
                    int(captured_draw["count"]),
                    int(captured_draw["instanceCount"]),
                )
            elif captured_draw["kind"] == "arrays":
                draw_arrays(int(captured_draw["mode"]), int(captured_draw["first"]), int(captured_draw["count"]))
            else:
                raise RuntimeError(f"unsupported draw kind {captured_draw['kind']}")
            replayed_draws.append({
                "kind": captured_draw["kind"],
                "programRole": program_audit[captured_program_id]["role"],
                "vertexCount": int(captured_draw["count"]),
                "instanceCount": int(captured_draw.get("instanceCount", 1)),
            })
        finish()
        render_time = round(time.monotonic() - started, 4)
        error = int(get_error())
        if error != GL.GL_NO_ERROR:
            raise RuntimeError(f"draw failed with GL error 0x{error:04x}")
        pixels = (ctypes.c_ubyte * (width * height * 4))()
        read_pixels(0, 0, width, height, GL.GL_RGBA, GL.GL_UNSIGNED_BYTE, pixels)
        raw = bytes(pixels)
        if int(get_error()) != GL.GL_NO_ERROR:
            raise RuntimeError("glReadPixels failed")
        if png_path is not None:
            try:
                from PIL import Image
            except ImportError as exc:
                raise RuntimeError("--png requires Pillow") from exc
            png_path.parent.mkdir(parents=True, exist_ok=True)
            image = Image.frombytes("RGBA", (width, height), raw)
            image.transpose(Image.Transpose.FLIP_TOP_BOTTOM).save(png_path, optimize=True)
        rgb = [raw[index:index + 3] for index in range(0, len(raw), 4)]
        unique_rgb = len(set(rgb))
        channel_min = [min(pixel[channel] for pixel in rgb) for channel in range(3)]
        channel_max = [max(pixel[channel] for pixel in rgb) for channel in range(3)]
        earth_like = sum(1 for red, green, blue in rgb if red > 32 and red > green * 1.04 and green >= blue * .75)
        alpha = set(raw[3::4])
        passed = (
            unique_rgb >= 24
            and max(high - low for low, high in zip(channel_min, channel_max)) >= 16
            and earth_like >= max(4, width * height // 400)
            and alpha == {255}
        )
        if not passed:
            raise RuntimeError(
                f"pixel smoke failed: uniqueRGB={unique_rgb}, ranges={list(zip(channel_min, channel_max))}, "
                f"earthLike={earth_like}, alpha={sorted(alpha)}"
            )
        for program in real_programs.values():
            delete_program(program)
        for shader in real_shaders:
            delete_shader(shader)

        return {
            "context": context.identity,
            "programs": program_audit,
            "renderSeconds": render_time,
            "drawReplay": replayed_draws,
            "uniformReplay": uploaded,
            "render": {
                "scene": f"wall-brick-plus-soil-{capture.get('requestedView', 'iso')}",
                "size": [width, height],
                "rgbaSha256": hashlib.sha256(raw).hexdigest(),
                "uniqueRGB": unique_rgb,
                "channelMin": channel_min,
                "channelMax": channel_max,
                "earthLikePixels": earth_like,
                "opaque": alpha == {255},
                "png": str(png_path) if png_path else None,
            },
        }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("html", nargs="?", type=Path, default=DEFAULT_HTML)
    parser.add_argument("--width", type=int, default=160)
    parser.add_argument("--height", type=int, default=120)
    parser.add_argument("--view", choices=("iso", "front", "back", "end", "top"), default="iso")
    parser.add_argument("--png", type=Path)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    if not (16 <= args.width <= 1024 and 16 <= args.height <= 1024):
        parser.error("render dimensions must be between 16 and 1024")
    html_path = args.html.resolve()
    report: dict[str, Any] = {
        "schemaVersion": "brick-mother-wall-real-gpu-qa-r3.2",
        "passed": False,
        "html": str(html_path),
        "realGpuCompilation": True,
        "humanVisualApproval": False,
    }
    try:
        html_bytes = html_path.read_bytes()
        report["artifact"] = {"bytes": len(html_bytes), "sha256": hashlib.sha256(html_bytes).hexdigest()}
        capture = capture_runtime(html_path, args.view)
        captured_programs: list[dict[str, Any]] = []
        role_sources: dict[str, str] = {}
        for program_id, program in capture["programs"].items():
            stages = [capture["shaders"][str(shader_id)] for shader_id in program["shaderIds"]]
            vertex = next(str(stage["source"]) for stage in stages if stage["type"] == GL.GL_VERTEX_SHADER)
            fragment = next(str(stage["source"]) for stage in stages if stage["type"] == GL.GL_FRAGMENT_SHADER)
            combined = vertex + "\n" + fragment
            role = "brick" if "surfaceDelta" in combined else "soil" if "soilSdf" in combined else "floor"
            role_sources[role] = combined
            captured_programs.append({
                "programId": program_id,
                "role": role,
                "vertexBytes": len(vertex.encode("utf-8")),
                "fragmentBytes": len(fragment.encode("utf-8")),
                "vertexSha256": hashlib.sha256(vertex.encode("utf-8")).hexdigest(),
                "fragmentSha256": hashlib.sha256(fragment.encode("utf-8")).hexdigest(),
                "versionLines": [vertex.splitlines()[0], fragment.splitlines()[0]],
            })
        report["runtimeCapture"] = {
            "drawCount": len(capture["draws"]),
            "requestedView": capture.get("requestedView"),
            "ready": capture.get("ready"),
            "status": capture.get("status"),
            "programs": captured_programs,
            "draws": capture["draws"],
        }
        if sorted(role_sources) != ["brick", "floor", "soil"]:
            raise RuntimeError(f"captured programs do not separate brick, soil and floor: {sorted(role_sources)}")
        required_by_role = {
            "brick": ["gl_InstanceID", "sdRoundBox", "surfaceDelta", "microscope", "processMaterial", "gl_FragDepth"],
            "soil": ["soilSdf", "soilMicroscopeGeometry", "soilMicroscopeMaterial", "gl_FragDepth"],
        }
        missing = {
            role: [token for token in tokens if token not in role_sources[role]]
            for role, tokens in required_by_role.items()
        }
        missing = {role: tokens for role, tokens in missing.items() if tokens}
        if missing:
            raise RuntimeError(f"captured runtime shaders are missing required paths: {missing}")
        draws = capture["draws"]
        roles_by_id = {str(item["programId"]): item["role"] for item in captured_programs}
        draw_contract = [
            (draw["kind"], roles_by_id[str(draw["programId"])], int(draw["count"]), int(draw.get("instanceCount", 1)))
            for draw in draws
        ]
        expected_draw_contract = [
            ("arrays", "floor", 6, 1),
            ("arrays", "soil", 36, 1),
            ("arrays-instanced", "brick", 36, 1420),
        ]
        repeated_default_frames = (
            len(draw_contract) >= 3
            and len(draw_contract) % 3 == 0
            and all(
                draw_contract[index:index + 3] == expected_draw_contract
                for index in range(0, len(draw_contract), 3)
            )
        )
        if not repeated_default_frames:
            raise RuntimeError(f"default draw contract is not floor + one soil + 1420 exact bricks: {draw_contract}")
        # A synchronous requestAnimationFrame stub can expose both initialization
        # schedules as identical frames.  Replay one complete final frame.
        capture["draws"] = draws[-3:]
        report.update(compile_and_replay(capture, args.width, args.height, args.png.resolve() if args.png else None))
        report["passed"] = True
    except Exception as exc:
        report["error"] = str(exc)
    serialized = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        args.out.write_text(serialized, encoding="utf-8")
    if args.json:
        print(serialized, end="")
    elif report["passed"]:
        print("PASS: captured, compiled, linked and replayed R3.2's default wall draw")
        print(f"  GL: {report['context']['glVersion']} · {report['context']['glRenderer']}")
        print(f"  GLSL: {report['context']['glslVersion']}")
        print(f"  draw: {report['render']['size'][0]}×{report['render']['size'][1]} · {report['render']['uniqueRGB']} RGB values")
    else:
        print("FAIL: " + report.get("error", "unknown error"), file=sys.stderr)
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
