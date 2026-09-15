#!/usr/bin/env python3
"""Compile and smoke-render the *runtime-generated* R3.1 shaders with Mesa EGL.

The page assembles its fragment shader in JavaScript from the inert edge-band
JSON.  A text-only grep therefore cannot prove that the final shader compiles.
This audit executes the page script inside a deliberately tiny DOM/WebGL stub,
captures the exact strings passed to ``gl.shaderSource``, then compiles, links
and draws them unchanged in a real surfaceless OpenGL ES 3 context.

No network access or Python/OpenGL packages are required.  The only external
runtime dependency is Node.js, which is used solely to execute the page's own
shader assembly code.  EGL and GL entry points are loaded with ``ctypes``.
"""

from __future__ import annotations

import argparse
import base64
import ctypes
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
DEFAULT_HTML = HERE.parents[1] / "Brick_Mother_Bond_Study_R3_1.html"


NODE_HARNESS = r"""
'use strict';
const fs = require('fs');
const payload = JSON.parse(fs.readFileSync(0, 'utf8'));
const sources = Object.create(null);
const noop = () => undefined;
const classList = {toggle: noop, add: noop, remove: noop, contains: () => false};
function element(extra = {}) {
  return Object.assign({
    textContent: '', hidden: false, disabled: false, value: '', dataset: {},
    classList, style: {}, addEventListener: noop, setAttribute: noop,
    setPointerCapture: noop, getBoundingClientRect: () => ({width: 640, height: 480})
  }, extra);
}
const glBase = {
  VERTEX_SHADER: 0x8b31, FRAGMENT_SHADER: 0x8b30,
  COMPILE_STATUS: 0x8b81, LINK_STATUS: 0x8b82, TRIANGLES: 4,
  createShader: type => ({type}),
  shaderSource: (shader, source) => { sources[shader.type] = source; },
  compileShader: noop, getShaderParameter: () => true, getShaderInfoLog: () => '',
  createProgram: () => ({}), attachShader: noop, linkProgram: noop,
  getProgramParameter: () => true, getProgramInfoLog: () => '',
  createVertexArray: () => ({}), bindVertexArray: noop, useProgram: noop,
  getUniformLocation: () => ({}), uniform4fv: noop, uniform1fv: noop,
  uniform1i: noop, uniform2f: noop, uniform3fv: noop, uniform1f: noop,
  viewport: noop, drawArrays: noop
};
const gl = new Proxy(glBase, {get: (target, key) => key in target ? target[key] : noop});
const elements = new Map();
function byId(id) {
  if (id === 'brick-bond-manifest') return element({textContent: payload.manifest});
  if (id === 'edge-band-data') return element({textContent: payload.edgeBands});
  if (!elements.has(id)) elements.set(id, element());
  return elements.get(id);
}
const canvas = byId('c');
canvas.getContext = () => gl;
const stage = element();
globalThis.document = {
  getElementById: byId,
  querySelector: selector => selector === '.stage' ? stage : element(),
  querySelectorAll: () => []
};
globalThis.window = {addEventListener: noop};
globalThis.ResizeObserver = class { constructor(callback) { this.callback = callback; } observe() {} };
globalThis.requestAnimationFrame = () => 0;
globalThis.devicePixelRatio = 1;
eval(payload.mainScript);
if (!sources[gl.VERTEX_SHADER] || !sources[gl.FRAGMENT_SHADER]) {
  throw new Error('page script did not submit both shader stages');
}
process.stdout.write(JSON.stringify({
  vertex: sources[gl.VERTEX_SHADER],
  fragment: sources[gl.FRAGMENT_SHADER]
}));
"""


def extract_script(html: str, script_id: str) -> str:
    pattern = re.compile(
        rf"<script\b(?=[^>]*\bid=[\"']{re.escape(script_id)}[\"'])[^>]*>(.*?)</script\s*>",
        re.IGNORECASE | re.DOTALL,
    )
    match = pattern.search(html)
    if not match:
        raise RuntimeError(f"missing script element #{script_id}")
    return match.group(1).strip()


def extract_main_script(html: str) -> str:
    scripts = re.findall(r"<script\b([^>]*)>(.*?)</script\s*>", html, re.IGNORECASE | re.DOTALL)
    candidates = [body for attrs, body in scripts if "application/json" not in attrs.lower()]
    matches = [body for body in candidates if "const gl=canvas.getContext('webgl2'" in body]
    if len(matches) != 1:
        raise RuntimeError(f"expected exactly one WebGL page script, found {len(matches)}")
    return matches[0]


def capture_runtime_shaders(html_path: Path) -> tuple[str, str, dict[str, Any]]:
    html = html_path.read_text(encoding="utf-8")
    payload = {
        "manifest": extract_script(html, "brick-bond-manifest"),
        "edgeBands": extract_script(html, "edge-band-data"),
        "mainScript": extract_main_script(html),
    }
    node = shutil.which("node")
    if not node:
        raise RuntimeError("Node.js is unavailable; runtime shader assembly was not executed")
    run = subprocess.run(
        [node, "-e", NODE_HARNESS],
        input=json.dumps(payload, ensure_ascii=False),
        text=True,
        capture_output=True,
        timeout=30,
        check=False,
    )
    if run.returncode != 0:
        detail = run.stderr.strip() or run.stdout.strip() or f"exit {run.returncode}"
        raise RuntimeError(f"page shader assembly failed in Node.js: {detail}")
    try:
        result = json.loads(run.stdout)
        return str(result["vertex"]), str(result["fragment"]), json.loads(payload["manifest"])
    except (json.JSONDecodeError, KeyError) as exc:
        raise RuntimeError("Node.js shader capture returned malformed output") from exc


# EGL constants used by the small surfaceless context below.
EGL_FALSE = 0
EGL_NONE = 0x3038
EGL_SURFACE_TYPE = 0x3033
EGL_PBUFFER_BIT = 0x0001
EGL_RENDERABLE_TYPE = 0x3040
EGL_OPENGL_ES3_BIT_KHR = 0x0040
EGL_RED_SIZE = 0x3024
EGL_GREEN_SIZE = 0x3023
EGL_BLUE_SIZE = 0x3022
EGL_ALPHA_SIZE = 0x3021
EGL_WIDTH = 0x3057
EGL_HEIGHT = 0x3056
EGL_CONTEXT_CLIENT_VERSION = 0x3098
EGL_OPENGL_ES_API = 0x30A0
EGL_PLATFORM_SURFACELESS_MESA = 0x31DD
EGL_VENDOR = 0x3053
EGL_VERSION = 0x3054
EGL_EXTENSIONS = 0x3055

# GL constants.
GL_VENDOR = 0x1F00
GL_RENDERER = 0x1F01
GL_VERSION = 0x1F02
GL_SHADING_LANGUAGE_VERSION = 0x8B8C
GL_VERTEX_SHADER = 0x8B31
GL_FRAGMENT_SHADER = 0x8B30
GL_COMPILE_STATUS = 0x8B81
GL_LINK_STATUS = 0x8B82
GL_INFO_LOG_LENGTH = 0x8B84
GL_TRIANGLES = 0x0004
GL_RGBA = 0x1908
GL_UNSIGNED_BYTE = 0x1401
GL_NO_ERROR = 0


def _decode(raw: bytes | None) -> str:
    return raw.decode("utf-8", "replace") if raw else ""


class EglGlesContext:
    """Minimal EGL/GLES loader, deliberately independent of development headers."""

    def __init__(self, width: int, height: int) -> None:
        os.environ.setdefault("EGL_PLATFORM", "surfaceless")
        os.environ.setdefault("LIBGL_ALWAYS_SOFTWARE", "true")
        self.width = width
        self.height = height
        try:
            self.egl = ctypes.CDLL("libEGL.so.1")
        except OSError as exc:
            raise RuntimeError("libEGL.so.1 is unavailable") from exc

        self.egl.eglGetError.restype = ctypes.c_uint
        self.egl.eglGetProcAddress.restype = ctypes.c_void_p
        self.egl.eglGetProcAddress.argtypes = [ctypes.c_char_p]
        self.egl.eglInitialize.restype = ctypes.c_uint
        self.egl.eglInitialize.argtypes = [
            ctypes.c_void_p,
            ctypes.POINTER(ctypes.c_int),
            ctypes.POINTER(ctypes.c_int),
        ]
        self.egl.eglBindAPI.restype = ctypes.c_uint
        self.egl.eglBindAPI.argtypes = [ctypes.c_uint]
        self.egl.eglChooseConfig.restype = ctypes.c_uint
        self.egl.eglChooseConfig.argtypes = [
            ctypes.c_void_p,
            ctypes.POINTER(ctypes.c_int),
            ctypes.POINTER(ctypes.c_void_p),
            ctypes.c_int,
            ctypes.POINTER(ctypes.c_int),
        ]
        self.egl.eglCreatePbufferSurface.restype = ctypes.c_void_p
        self.egl.eglCreatePbufferSurface.argtypes = [
            ctypes.c_void_p,
            ctypes.c_void_p,
            ctypes.POINTER(ctypes.c_int),
        ]
        self.egl.eglCreateContext.restype = ctypes.c_void_p
        self.egl.eglCreateContext.argtypes = [
            ctypes.c_void_p,
            ctypes.c_void_p,
            ctypes.c_void_p,
            ctypes.POINTER(ctypes.c_int),
        ]
        self.egl.eglMakeCurrent.restype = ctypes.c_uint
        self.egl.eglMakeCurrent.argtypes = [
            ctypes.c_void_p,
            ctypes.c_void_p,
            ctypes.c_void_p,
            ctypes.c_void_p,
        ]
        self.egl.eglQueryString.restype = ctypes.c_char_p
        self.egl.eglQueryString.argtypes = [ctypes.c_void_p, ctypes.c_int]
        self.egl.eglDestroyContext.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
        self.egl.eglDestroySurface.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
        self.egl.eglTerminate.argtypes = [ctypes.c_void_p]

        get_platform = getattr(self.egl, "eglGetPlatformDisplay", None)
        if get_platform is not None:
            get_platform.restype = ctypes.c_void_p
            get_platform.argtypes = [ctypes.c_uint, ctypes.c_void_p, ctypes.POINTER(ctypes.c_int)]
        else:
            address = self.egl.eglGetProcAddress(b"eglGetPlatformDisplayEXT")
            if not address:
                raise RuntimeError("surfaceless eglGetPlatformDisplay is unavailable")
            get_platform = ctypes.CFUNCTYPE(
                ctypes.c_void_p, ctypes.c_uint, ctypes.c_void_p, ctypes.POINTER(ctypes.c_int)
            )(address)

        self.display = get_platform(EGL_PLATFORM_SURFACELESS_MESA, None, None)
        if not self.display:
            self._raise_egl("eglGetPlatformDisplay")
        major, minor = ctypes.c_int(), ctypes.c_int()
        if not self.egl.eglInitialize(self.display, ctypes.byref(major), ctypes.byref(minor)):
            self._raise_egl("eglInitialize")
        self.egl_version = f"{major.value}.{minor.value}"

        if not self.egl.eglBindAPI(EGL_OPENGL_ES_API):
            self._raise_egl("eglBindAPI(OpenGL ES)")

        config_attrs = (ctypes.c_int * 13)(
            EGL_SURFACE_TYPE,
            EGL_PBUFFER_BIT,
            EGL_RENDERABLE_TYPE,
            EGL_OPENGL_ES3_BIT_KHR,
            EGL_RED_SIZE,
            8,
            EGL_GREEN_SIZE,
            8,
            EGL_BLUE_SIZE,
            8,
            EGL_ALPHA_SIZE,
            8,
            EGL_NONE,
        )
        config = ctypes.c_void_p()
        count = ctypes.c_int()
        if not self.egl.eglChooseConfig(
            self.display, config_attrs, ctypes.byref(config), 1, ctypes.byref(count)
        ) or count.value < 1:
            self._raise_egl("eglChooseConfig(OpenGL ES 3)")
        self.config = config

        pbuffer_attrs = (ctypes.c_int * 5)(
            EGL_WIDTH,
            width,
            EGL_HEIGHT,
            height,
            EGL_NONE,
        )
        self.surface = self.egl.eglCreatePbufferSurface(self.display, config, pbuffer_attrs)
        if not self.surface:
            self._raise_egl("eglCreatePbufferSurface")

        context_attrs = (ctypes.c_int * 3)(EGL_CONTEXT_CLIENT_VERSION, 3, EGL_NONE)
        self.context = self.egl.eglCreateContext(self.display, config, None, context_attrs)
        if not self.context:
            self._raise_egl("eglCreateContext(OpenGL ES 3)")
        if not self.egl.eglMakeCurrent(
            self.display, self.surface, self.surface, self.context
        ):
            self._raise_egl("eglMakeCurrent")

        self._loaded: dict[str, Any] = {}
        self.glGetString = self.proc("glGetString", ctypes.c_char_p, [ctypes.c_uint])
        self.identity = {
            "egl": self.egl_version,
            "eglVendor": _decode(self.egl.eglQueryString(self.display, EGL_VENDOR)),
            "eglReportedVersion": _decode(self.egl.eglQueryString(self.display, EGL_VERSION)),
            "glVendor": _decode(self.glGetString(GL_VENDOR)),
            "glRenderer": _decode(self.glGetString(GL_RENDERER)),
            "glVersion": _decode(self.glGetString(GL_VERSION)),
            "glslVersion": _decode(self.glGetString(GL_SHADING_LANGUAGE_VERSION)),
        }

    def _raise_egl(self, operation: str) -> None:
        code = int(self.egl.eglGetError())
        raise RuntimeError(f"{operation} failed (EGL error 0x{code:04x})")

    def proc(self, name: str, restype: Any, argtypes: list[Any]) -> Any:
        if name in self._loaded:
            return self._loaded[name]
        address = self.egl.eglGetProcAddress(name.encode("ascii"))
        if not address:
            raise RuntimeError(f"required GL entry point {name} is unavailable")
        function = ctypes.CFUNCTYPE(restype, *argtypes)(address)
        self._loaded[name] = function
        return function

    def close(self) -> None:
        if getattr(self, "display", None):
            self.egl.eglMakeCurrent(self.display, None, None, None)
            if getattr(self, "context", None):
                self.egl.eglDestroyContext(self.display, self.context)
            if getattr(self, "surface", None):
                self.egl.eglDestroySurface(self.display, self.surface)
            self.egl.eglTerminate(self.display)
            self.display = None

    def __enter__(self) -> "EglGlesContext":
        return self

    def __exit__(self, exc_type: Any, exc: Any, traceback: Any) -> None:
        self.close()


def compile_and_render(
    vertex: str,
    fragment: str,
    width: int,
    height: int,
    scene: str,
    manifest: dict[str, Any],
    png_path: Path | None,
) -> dict[str, Any]:
    with EglGlesContext(width, height) as context:
        glCreateShader = context.proc("glCreateShader", ctypes.c_uint, [ctypes.c_uint])
        glShaderSource = context.proc(
            "glShaderSource",
            None,
            [ctypes.c_uint, ctypes.c_int, ctypes.POINTER(ctypes.c_char_p), ctypes.POINTER(ctypes.c_int)],
        )
        glCompileShader = context.proc("glCompileShader", None, [ctypes.c_uint])
        glGetShaderiv = context.proc(
            "glGetShaderiv", None, [ctypes.c_uint, ctypes.c_uint, ctypes.POINTER(ctypes.c_int)]
        )
        glGetShaderInfoLog = context.proc(
            "glGetShaderInfoLog",
            None,
            [ctypes.c_uint, ctypes.c_int, ctypes.POINTER(ctypes.c_int), ctypes.c_char_p],
        )
        glDeleteShader = context.proc("glDeleteShader", None, [ctypes.c_uint])
        glCreateProgram = context.proc("glCreateProgram", ctypes.c_uint, [])
        glAttachShader = context.proc("glAttachShader", None, [ctypes.c_uint, ctypes.c_uint])
        glLinkProgram = context.proc("glLinkProgram", None, [ctypes.c_uint])
        glGetProgramiv = context.proc(
            "glGetProgramiv", None, [ctypes.c_uint, ctypes.c_uint, ctypes.POINTER(ctypes.c_int)]
        )
        glGetProgramInfoLog = context.proc(
            "glGetProgramInfoLog",
            None,
            [ctypes.c_uint, ctypes.c_int, ctypes.POINTER(ctypes.c_int), ctypes.c_char_p],
        )
        glDeleteProgram = context.proc("glDeleteProgram", None, [ctypes.c_uint])
        glUseProgram = context.proc("glUseProgram", None, [ctypes.c_uint])
        glGenVertexArrays = context.proc(
            "glGenVertexArrays", None, [ctypes.c_int, ctypes.POINTER(ctypes.c_uint)]
        )
        glBindVertexArray = context.proc("glBindVertexArray", None, [ctypes.c_uint])
        glDeleteVertexArrays = context.proc(
            "glDeleteVertexArrays", None, [ctypes.c_int, ctypes.POINTER(ctypes.c_uint)]
        )
        glGetUniformLocation = context.proc(
            "glGetUniformLocation", ctypes.c_int, [ctypes.c_uint, ctypes.c_char_p]
        )
        glUniform2f = context.proc(
            "glUniform2f", None, [ctypes.c_int, ctypes.c_float, ctypes.c_float]
        )
        glUniform3fv = context.proc(
            "glUniform3fv", None, [ctypes.c_int, ctypes.c_int, ctypes.POINTER(ctypes.c_float)]
        )
        glUniform4fv = context.proc(
            "glUniform4fv", None, [ctypes.c_int, ctypes.c_int, ctypes.POINTER(ctypes.c_float)]
        )
        glUniform1fv = context.proc(
            "glUniform1fv", None, [ctypes.c_int, ctypes.c_int, ctypes.POINTER(ctypes.c_float)]
        )
        glUniform1i = context.proc("glUniform1i", None, [ctypes.c_int, ctypes.c_int])
        glUniform1f = context.proc("glUniform1f", None, [ctypes.c_int, ctypes.c_float])
        glViewport = context.proc(
            "glViewport", None, [ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int]
        )
        glDrawArrays = context.proc(
            "glDrawArrays", None, [ctypes.c_uint, ctypes.c_int, ctypes.c_int]
        )
        glFinish = context.proc("glFinish", None, [])
        glReadPixels = context.proc(
            "glReadPixels",
            None,
            [
                ctypes.c_int,
                ctypes.c_int,
                ctypes.c_int,
                ctypes.c_int,
                ctypes.c_uint,
                ctypes.c_uint,
                ctypes.c_void_p,
            ],
        )
        glGetError = context.proc("glGetError", ctypes.c_uint, [])

        compile_times: dict[str, float] = {}

        def compile_stage(stage: int, source: str, label: str) -> int:
            shader = int(glCreateShader(stage))
            if not shader:
                raise RuntimeError(f"glCreateShader({label}) returned 0")
            encoded = source.encode("utf-8")
            source_pointer = ctypes.c_char_p(encoded)
            length = ctypes.c_int(len(encoded))
            glShaderSource(shader, 1, ctypes.byref(source_pointer), ctypes.byref(length))
            started = time.monotonic()
            glCompileShader(shader)
            compile_times[label] = round(time.monotonic() - started, 4)
            passed = ctypes.c_int()
            glGetShaderiv(shader, GL_COMPILE_STATUS, ctypes.byref(passed))
            if not passed.value:
                log_length = ctypes.c_int()
                glGetShaderiv(shader, GL_INFO_LOG_LENGTH, ctypes.byref(log_length))
                buffer = ctypes.create_string_buffer(max(1, log_length.value))
                written = ctypes.c_int()
                glGetShaderInfoLog(shader, len(buffer), ctypes.byref(written), buffer)
                raise RuntimeError(f"{label} shader compilation failed:\n{_decode(buffer.value)}")
            return shader

        vertex_shader = compile_stage(GL_VERTEX_SHADER, vertex, "vertex")
        fragment_shader = compile_stage(GL_FRAGMENT_SHADER, fragment, "fragment")
        program = int(glCreateProgram())
        glAttachShader(program, vertex_shader)
        glAttachShader(program, fragment_shader)
        link_started = time.monotonic()
        glLinkProgram(program)
        link_time = round(time.monotonic() - link_started, 4)
        linked = ctypes.c_int()
        glGetProgramiv(program, GL_LINK_STATUS, ctypes.byref(linked))
        if not linked.value:
            log_length = ctypes.c_int()
            glGetProgramiv(program, GL_INFO_LOG_LENGTH, ctypes.byref(log_length))
            buffer = ctypes.create_string_buffer(max(1, log_length.value))
            written = ctypes.c_int()
            glGetProgramInfoLog(program, len(buffer), ctypes.byref(written), buffer)
            raise RuntimeError(f"program link failed:\n{_decode(buffer.value)}")

        glUseProgram(program)
        vao = ctypes.c_uint()
        glGenVertexArrays(1, ctypes.byref(vao))
        glBindVertexArray(vao.value)
        glViewport(0, 0, width, height)

        def uniform(name: str) -> int:
            location = int(glGetUniformLocation(program, name.encode("ascii")))
            if location < 0:
                raise RuntimeError(f"required uniform {name} was optimized out or not found")
            return location

        glUniform2f(uniform("uRes"), float(width), float(height))
        poses = (ctypes.c_float * (32 * 4))()
        cuts = (ctypes.c_float * 32)()
        if scene == "mother":
            scene_placements = [
                {"kernelCenter": [0.0, 0.030575, 0.0], "yawQuarter": 0, "cutPlane": None}
            ]
            target_values = (0.0, 0.025, 0.0)
            angle_values = (-0.60, 0.30)
            distance_value = 0.54
        else:
            scene_placements = list(manifest["wall"]["placements"])
            target_values = (0.244615, 0.135, 0.244615)
            angle_values = (-2.36, 0.40)
            distance_value = 1.02
        if len(scene_placements) > 32:
            raise RuntimeError(f"scene contains {len(scene_placements)} bricks; shader maximum is 32")
        for index, placement in enumerate(scene_placements):
            center = (
                placement["kernelCenter"]
                if "kernelCenter" in placement
                else placement["center"]
            )
            poses[index * 4 : index * 4 + 4] = (
                float(center[0]),
                float(center[1]),
                float(center[2]),
                float(placement["yawQuarter"]),
            )
            keep = (placement.get("cutPlane") or {}).get("keep")
            cuts[index] = (
                1.0
                if keep == "local-x-positive"
                else -1.0
                if keep == "local-x-negative"
                else 0.0
            )
        glUniform4fv(uniform("uBrickPose[0]"), 32, poses)
        glUniform1fv(uniform("uBrickCut[0]"), 32, cuts)
        glUniform1i(uniform("uBrickCount"), len(scene_placements))
        target = (ctypes.c_float * 3)(*target_values)
        glUniform3fv(uniform("uTarget"), 1, target)
        glUniform2f(uniform("uAngles"), *angle_values)
        glUniform1f(uniform("uDistance"), distance_value)

        stale_errors: list[str] = []
        while True:
            error = int(glGetError())
            if error == GL_NO_ERROR:
                break
            stale_errors.append(f"0x{error:04x}")
        if stale_errors:
            raise RuntimeError(f"GL errors occurred during setup: {', '.join(stale_errors)}")

        render_started = time.monotonic()
        glDrawArrays(GL_TRIANGLES, 0, 3)
        glFinish()
        render_time = round(time.monotonic() - render_started, 4)
        error = int(glGetError())
        if error != GL_NO_ERROR:
            raise RuntimeError(f"GL draw failed with error 0x{error:04x}")

        pixels = (ctypes.c_ubyte * (width * height * 4))()
        glReadPixels(0, 0, width, height, GL_RGBA, GL_UNSIGNED_BYTE, pixels)
        error = int(glGetError())
        if error != GL_NO_ERROR:
            raise RuntimeError(f"glReadPixels failed with error 0x{error:04x}")
        raw = bytes(pixels)
        if png_path is not None:
            try:
                from PIL import Image
            except ImportError as exc:
                raise RuntimeError("--png requires Pillow, but Pillow is unavailable") from exc
            png_path.parent.mkdir(parents=True, exist_ok=True)
            image = Image.frombytes("RGBA", (width, height), raw)
            image = image.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
            image.save(png_path, format="PNG", optimize=True)
        rgb = [raw[index : index + 3] for index in range(0, len(raw), 4)]
        unique_rgb = len(set(rgb))
        channel_min = [min(pixel[channel] for pixel in rgb) for channel in range(3)]
        channel_max = [max(pixel[channel] for pixel in rgb) for channel in range(3)]
        brick_like = sum(
            1
            for red, green, blue in rgb
            if red > 45 and red > green * 1.18 and red > blue * 1.10
        )
        alpha_values = set(raw[3::4])
        smoke_passed = (
            unique_rgb >= 24
            and max(high - low for low, high in zip(channel_min, channel_max)) >= 16
            and brick_like >= max(4, width * height // 200)
            and alpha_values == {255}
        )

        glDeleteVertexArrays(1, ctypes.byref(vao))
        glDeleteProgram(program)
        glDeleteShader(vertex_shader)
        glDeleteShader(fragment_shader)

        if not smoke_passed:
            raise RuntimeError(
                "real draw completed but the pixel smoke test did not find a non-uniform red brick "
                f"(uniqueRGB={unique_rgb}, ranges={list(zip(channel_min, channel_max))}, "
                f"brickLikePixels={brick_like}, alpha={sorted(alpha_values)})"
            )

        return {
            "context": context.identity,
            "compileSeconds": compile_times,
            "linkSeconds": link_time,
            "renderSeconds": render_time,
            "render": {
                "scene": scene,
                "size": [width, height],
                "rgbaSha256": hashlib.sha256(raw).hexdigest(),
                "uniqueRGB": unique_rgb,
                "channelMin": channel_min,
                "channelMax": channel_max,
                "brickLikePixels": brick_like,
                "opaque": alpha_values == {255},
                "png": str(png_path) if png_path is not None else None,
            },
        }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("html", nargs="?", type=Path, default=DEFAULT_HTML)
    parser.add_argument("--width", type=int, default=96)
    parser.add_argument("--height", type=int, default=72)
    parser.add_argument("--scene", choices=("mother", "wall"), default="wall")
    parser.add_argument("--png", type=Path, help="optionally save the real EGL draw as a PNG")
    parser.add_argument("--json", action="store_true", help="print a machine-readable report")
    parser.add_argument("--out", type=Path, help="write the machine-readable report to this path")
    args = parser.parse_args()
    if args.width < 16 or args.height < 16 or args.width > 1024 or args.height > 1024:
        parser.error("render dimensions must be between 16 and 1024 pixels")

    html_path = args.html.resolve()
    report: dict[str, Any] = {
        "passed": False,
        "html": str(html_path),
        "shaderSource": {},
    }
    try:
        vertex, fragment, manifest = capture_runtime_shaders(html_path)
        report["shaderSource"] = {
            "vertexBytes": len(vertex.encode("utf-8")),
            "fragmentBytes": len(fragment.encode("utf-8")),
            "vertexSha256": hashlib.sha256(vertex.encode("utf-8")).hexdigest(),
            "fragmentSha256": hashlib.sha256(fragment.encode("utf-8")).hexdigest(),
            "versionLines": [vertex.splitlines()[0], fragment.splitlines()[0]],
        }
        report.update(
            compile_and_render(
                vertex,
                fragment,
                args.width,
                args.height,
                args.scene,
                manifest,
                args.png.resolve() if args.png is not None else None,
            )
        )
        report["passed"] = True
    except Exception as exc:  # The report must preserve concrete blocker evidence.
        report["error"] = str(exc)

    serialized = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        args.out.write_text(serialized, encoding="utf-8")
    if args.json:
        print(serialized, end="")
    elif report["passed"]:
        context = report["context"]
        render = report["render"]
        print("PASS: captured, compiled, linked and drew the page's exact runtime shaders")
        print(f"  GL: {context['glVersion']} · {context['glRenderer']}")
        print(f"  GLSL: {context['glslVersion']}")
        print(
            "  shader SHA-256: "
            f"VS {report['shaderSource']['vertexSha256'][:16]} · "
            f"FS {report['shaderSource']['fragmentSha256'][:16]}"
        )
        print(
            f"  draw: {render['size'][0]}×{render['size'][1]} · "
            f"{render['uniqueRGB']} RGB values · {render['brickLikePixels']} brick-like pixels · "
            f"RGBA {render['rgbaSha256'][:16]}"
        )
    else:
        print(f"FAIL: {report.get('error', 'unknown error')}", file=sys.stderr)
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
