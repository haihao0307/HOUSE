"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  Box,
  Droplets,
  MousePointer2,
  RefreshCcw,
  RotateCcw,
  Sparkles,
  TimerReset,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type MaterialKey = "adobe" | "fired" | "stone";
type FilterKey = "all" | MaterialKey;

type Settings = {
  age: number;
  humidity: number;
  variation: number;
  masterSeed: number;
  filter: FilterKey;
};

type BrickInfo = {
  id: string;
  material: MaterialKey;
  materialLabel: string;
  childLabel: string;
  seed: number;
  size: string;
  rule: string;
  persistentBytes: number;
};

const MATERIAL_LABEL: Record<MaterialKey, string> = {
  adobe: "土坯",
  fired: "烧结砖",
  stone: "石块",
};

const MATERIAL_RULE: Record<MaterialKey, string> = {
  adobe: "稻草允许 · 雨蚀圆化 · 纤维脱落孔",
  fired: "稻草锁零 · 窑变色域 · 脆性崩角",
  stone: "稻草锁零 · 矿物颗粒 · 层理解理",
};

const PALETTES: Record<MaterialKey, string[]> = {
  adobe: ["#a86e3b", "#c18449", "#865438"],
  fired: ["#a94125", "#c15a2d", "#60434a"],
  stone: ["#65716e", "#787267", "#4f6268"],
};

const MATERIAL_ACCENT: Record<MaterialKey, string> = {
  adobe: "#d6a66d",
  fired: "#cf6642",
  stone: "#83999b",
};

function fract(value: number) {
  return value - Math.floor(value);
}

function smooth(value: number) {
  return value * value * (3 - 2 * value);
}

function hash3(x: number, y: number, z: number, seed: number) {
  return (
    fract(
      Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 0.173) *
        43758.5453123,
    ) *
      2 -
    1
  );
}

function noise3(x: number, y: number, z: number, seed: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const fz = smooth(z - z0);
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;

  const n000 = hash3(x0, y0, z0, seed);
  const n100 = hash3(x0 + 1, y0, z0, seed);
  const n010 = hash3(x0, y0 + 1, z0, seed);
  const n110 = hash3(x0 + 1, y0 + 1, z0, seed);
  const n001 = hash3(x0, y0, z0 + 1, seed);
  const n101 = hash3(x0 + 1, y0, z0 + 1, seed);
  const n011 = hash3(x0, y0 + 1, z0 + 1, seed);
  const n111 = hash3(x0 + 1, y0 + 1, z0 + 1, seed);

  const nx00 = mix(n000, n100, fx);
  const nx10 = mix(n010, n110, fx);
  const nx01 = mix(n001, n101, fx);
  const nx11 = mix(n011, n111, fx);
  return mix(mix(nx00, nx10, fy), mix(nx01, nx11, fy), fz);
}

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function childSeed(masterSeed: number, materialIndex: number, childIndex: number) {
  let value = masterSeed ^ ((materialIndex + 1) * 0x9e3779b1);
  value ^= (childIndex + 11) * 0x85ebca6b;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      materials.forEach((material) => material.dispose());
    }
  });
  while (root.children.length) root.remove(root.children[0]);
}

function createPores(
  kind: MaterialKey,
  length: number,
  height: number,
  depth: number,
  seed: number,
  age01: number,
  variation01: number,
) {
  const random = seededRandom(seed ^ 0xa24baed4);
  const baseCount = kind === "adobe" ? 13 : kind === "fired" ? 9 : 7;
  const count = Math.round(baseCount + age01 * 7 + variation01 * 5);
  const geometry = new THREE.SphereGeometry(1, 7, 5);
  const material = new THREE.MeshStandardMaterial({
    color:
      kind === "adobe" ? "#4a3020" : kind === "fired" ? "#48251d" : "#293333",
    roughness: 1,
    metalness: 0,
  });
  const pores = new THREE.InstancedMesh(geometry, material, count);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  for (let index = 0; index < count; index += 1) {
    const radius =
      (kind === "adobe" ? 0.018 : kind === "fired" ? 0.012 : 0.016) +
      random() * (0.025 + age01 * 0.018);
    const face = random();
    if (face < 0.62) {
      position.set(
        (random() - 0.5) * length * 0.82,
        (random() - 0.5) * height * 0.72,
        depth / 2 + 0.002,
      );
      scale.set(radius, radius * (0.55 + random() * 0.5), 0.012);
    } else if (face < 0.84) {
      position.set(
        (random() - 0.5) * length * 0.78,
        height / 2 + 0.002,
        (random() - 0.5) * depth * 0.62,
      );
      scale.set(radius, 0.012, radius * (0.6 + random() * 0.45));
    } else {
      position.set(
        length / 2 + 0.002,
        (random() - 0.5) * height * 0.7,
        (random() - 0.5) * depth * 0.58,
      );
      scale.set(0.012, radius, radius * (0.55 + random() * 0.5));
    }
    quaternion.setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      (random() - 0.5) * Math.PI,
    );
    matrix.compose(position, quaternion, scale);
    pores.setMatrixAt(index, matrix);
  }
  pores.instanceMatrix.needsUpdate = true;
  pores.castShadow = true;
  return pores;
}

function createStraw(
  length: number,
  height: number,
  depth: number,
  seed: number,
  age01: number,
) {
  const group = new THREE.Group();
  const random = seededRandom(seed ^ 0x27d4eb2f);
  const count = Math.round(4 + age01 * 7);
  const material = new THREE.MeshStandardMaterial({
    color: "#d7b47a",
    roughness: 0.96,
    metalness: 0,
  });

  for (let index = 0; index < count; index += 1) {
    const strawLength = 0.12 + random() * 0.24;
    const geometry = new THREE.CylinderGeometry(
      0.009,
      0.012,
      strawLength,
      5,
      1,
    );
    const straw = new THREE.Mesh(geometry, material);
    const angle = (random() - 0.5) * Math.PI * 1.15;
    const direction = new THREE.Vector3(
      Math.sin(angle),
      Math.cos(angle),
      0,
    ).normalize();
    straw.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    straw.position.set(
      (random() - 0.5) * length * 0.76,
      (random() - 0.5) * height * 0.66,
      depth / 2 + 0.009,
    );
    straw.castShadow = true;
    group.add(straw);
  }
  return group;
}

function createBrick(
  kind: MaterialKey,
  childIndex: number,
  seed: number,
  settings: Settings,
) {
  const random = seededRandom(seed);
  const age01 = Math.min(settings.age / 150, 1);
  const humidity01 = settings.humidity / 100;
  const variation01 = settings.variation / 100;

  const length = 2.35 + (random() - 0.5) * 0.22 * variation01;
  const height =
    (kind === "stone" ? 0.82 : kind === "adobe" ? 0.76 : 0.7) +
    (random() - 0.5) * 0.11 * variation01;
  const depth = 1.03 + (random() - 0.5) * 0.16 * variation01;
  const radius =
    kind === "adobe"
      ? 0.105 + age01 * 0.105
      : kind === "fired"
        ? 0.055 + age01 * 0.045
        : 0.075 + age01 * 0.055;

  const geometry = new RoundedBoxGeometry(
    length,
    height,
    depth,
    10,
    Math.min(radius, height * 0.28),
  );
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  const normals = geometry.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(positions.count * 3);
  const baseColor = new THREE.Color(PALETTES[kind][childIndex]);
  const vertexColor = new THREE.Color();

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const nx = normals.getX(index);
    const ny = normals.getY(index);
    const nz = normals.getZ(index);
    const broadNoise = noise3(x * 1.55, y * 3.2, z * 2.1, seed);
    const fineNoise = noise3(x * 5.8, y * 7.4, z * 6.1, seed + 31);
    let displacement = 0;
    let hueShift = broadNoise * 0.012 * variation01;
    let saturationShift = fineNoise * 0.035 * variation01;
    let lightShift = broadNoise * 0.055 * variation01;

    if (kind === "adobe") {
      const erosion = 0.018 + age01 * 0.05;
      displacement = broadNoise * erosion + fineNoise * 0.009;
      const wash = Math.max(
        0,
        noise3(x * 1.1, y * 2.2, z * 1.4, seed + 71),
      );
      displacement -= wash * age01 * 0.02;
      lightShift += wash * age01 * 0.025;
    } else if (kind === "fired") {
      displacement = broadNoise * 0.014 + fineNoise * 0.005;
      const chip = Math.max(
        0,
        noise3(x * 3.8, y * 4.7, z * 4.2, seed + 91) -
          (0.57 - age01 * 0.09),
      );
      displacement -= chip * (0.045 + age01 * 0.05);
      const reduction = Math.max(
        0,
        noise3(x * 0.72, y * 1.25, z * 0.8, seed + 113) - 0.1,
      );
      hueShift += reduction * 0.018;
      saturationShift -= reduction * 0.19;
      lightShift -= reduction * 0.2;
    } else {
      const strata = Math.sin(y * 18 + broadNoise * 2.7 + childIndex * 0.8);
      const angular =
        Math.sign(fineNoise) * Math.pow(Math.abs(fineNoise), 0.7);
      displacement = broadNoise * 0.026 + angular * 0.016;
      displacement -= Math.max(0, strata - 0.74) * age01 * 0.045;
      hueShift += strata * 0.007;
      saturationShift -= 0.025 + fineNoise * 0.025;
      lightShift += strata * 0.035 * variation01;
    }

    positions.setXYZ(
      index,
      x + nx * displacement,
      y + ny * displacement,
      z + nz * displacement,
    );

    const lowerFace = 1 - (y / height + 0.5);
    const moistureDarkening =
      humidity01 * (0.035 + age01 * 0.065) * (0.45 + lowerFace * 0.55);
    vertexColor.copy(baseColor);
    vertexColor.offsetHSL(
      hueShift,
      saturationShift,
      lightShift - moistureDarkening,
    );
    colors[index * 3] = vertexColor.r;
    colors[index * 3 + 1] = vertexColor.g;
    colors[index * 3 + 2] = vertexColor.b;
  }

  positions.needsUpdate = true;
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: kind === "fired" ? 0.84 : kind === "stone" ? 0.91 : 0.96,
    metalness: 0,
  });
  const brick = new THREE.Mesh(geometry, material);
  brick.castShadow = true;
  brick.receiveShadow = true;

  const group = new THREE.Group();
  group.add(brick);
  group.add(
    createPores(
      kind,
      length,
      height,
      depth,
      seed,
      age01,
      variation01,
    ),
  );
  if (kind === "adobe") {
    group.add(createStraw(length, height, depth, seed, age01));
  }

  const info: BrickInfo = {
    id: `${kind}-${childIndex}`,
    material: kind,
    materialLabel: MATERIAL_LABEL[kind],
    childLabel: `孩子 ${String(childIndex + 1).padStart(2, "0")}`,
    seed,
    size: `${Math.round(length * 100)} × ${Math.round(depth * 100)} × ${Math.round(height * 100)} mm`,
    rule: MATERIAL_RULE[kind],
    persistentBytes: 0,
  };
  brick.userData.brickInfo = info;

  return { group, brick, info, height };
}

function ControlRow({
  icon,
  label,
  value,
  unit,
  min,
  max,
  step = 1,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="control-row">
      <div className="control-heading">
        <span className="control-label">
          {icon}
          {label}
        </span>
        <output className="control-value">
          {value}
          {unit}
        </output>
      </div>
      <Slider
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(values) => onChange(values[0] ?? value)}
        className="brick-slider"
      />
    </div>
  );
}

export function BrickMotherNest() {
  const mountRef = useRef<HTMLDivElement>(null);
  const rebuildRef = useRef<((settings: Settings) => void) | null>(null);
  const resetCameraRef = useRef<(() => void) | null>(null);
  const selectedIdRef = useRef("adobe-0");
  const currentSettingsRef = useRef<Settings>({
    age: 70,
    humidity: 58,
    variation: 62,
    masterSeed: 230813,
    filter: "all",
  });

  const [age, setAge] = useState(70);
  const [humidity, setHumidity] = useState(58);
  const [variation, setVariation] = useState(62);
  const [masterSeed, setMasterSeed] = useState(230813);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selected, setSelected] = useState<BrickInfo | null>(null);
  const [rendererStatus, setRendererStatus] = useState<
    "loading" | "ready" | "unsupported"
  >("loading");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      window.setTimeout(() => setRendererStatus("unsupported"), 0);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute(
      "aria-label",
      "九块程序化三维砖，可拖动旋转、滚轮缩放并点击选择",
    );
    renderer.domElement.setAttribute("role", "img");
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#13120f");
    scene.fog = new THREE.Fog("#13120f", 12, 23);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    const initialCamera = new THREE.Vector3(8.7, 7.2, 11.4);
    camera.position.copy(initialCamera);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.minDistance = 6.3;
    controls.maxDistance = 19;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.target.set(0, 0.35, 0);
    controls.update();

    resetCameraRef.current = () => {
      camera.position.copy(initialCamera);
      controls.target.set(0, 0.35, 0);
      controls.update();
    };

    const hemisphere = new THREE.HemisphereLight("#f2d8b2", "#182128", 2.2);
    scene.add(hemisphere);

    const keyLight = new THREE.DirectionalLight("#ffe7c6", 4.2);
    keyLight.position.set(6, 10, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 30;
    keyLight.shadow.camera.left = -9;
    keyLight.shadow.camera.right = 9;
    keyLight.shadow.camera.top = 9;
    keyLight.shadow.camera.bottom = -9;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight("#9fb9c6", 2.0);
    rimLight.position.set(-8, 5, -7);
    scene.add(rimLight);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 12),
      new THREE.MeshStandardMaterial({
        color: "#1a1814",
        roughness: 1,
        metalness: 0,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(14, 14, "#665a45", "#2e2a23");
    grid.position.y = 0.006;
    const gridMaterial = grid.material as THREE.Material;
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.36;
    scene.add(grid);

    const nest = new THREE.Group();
    scene.add(nest);
    let clickTargets: THREE.Object3D[] = [];
    let selectionRings = new Map<string, THREE.Mesh>();

    const showSelection = (id: string) => {
      selectedIdRef.current = id;
      selectionRings.forEach((ring, ringId) => {
        ring.visible = ringId === id;
      });
    };

    rebuildRef.current = (settings) => {
      disposeObject(nest);
      clickTargets = [];
      selectionRings = new Map();
      const allKinds: MaterialKey[] = ["adobe", "fired", "stone"];
      const visibleKinds =
        settings.filter === "all" ? allKinds : [settings.filter];
      const rowPositions =
        visibleKinds.length === 3 ? [2.75, 0, -2.75] : [0];
      const infos = new Map<string, BrickInfo>();

      visibleKinds.forEach((kind, visibleIndex) => {
        const materialIndex = allKinds.indexOf(kind);
        const rowZ = rowPositions[visibleIndex];
        const mat = new THREE.Mesh(
          new THREE.PlaneGeometry(11.1, 2.05),
          new THREE.MeshBasicMaterial({
            color: MATERIAL_ACCENT[kind],
            transparent: true,
            opacity: 0.055,
            depthWrite: false,
          }),
        );
        mat.rotation.x = -Math.PI / 2;
        mat.position.set(0, 0.011, rowZ);
        nest.add(mat);

        for (let childIndex = 0; childIndex < 3; childIndex += 1) {
          const seed = childSeed(
            settings.masterSeed,
            materialIndex,
            childIndex,
          );
          const result = createBrick(kind, childIndex, seed, settings);
          result.group.position.set(
            (childIndex - 1) * 3.32,
            result.height / 2 + 0.055,
            rowZ,
          );
          result.group.rotation.y =
            (childIndex - 1) * 0.045 +
            (seededRandom(seed ^ 0x165667b1)() - 0.5) * 0.025;
          nest.add(result.group);
          clickTargets.push(result.brick);
          infos.set(result.info.id, result.info);

          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.55, 0.66, 48),
            new THREE.MeshBasicMaterial({
              color: MATERIAL_ACCENT[kind],
              transparent: true,
              opacity: 0.8,
              side: THREE.DoubleSide,
              depthWrite: false,
            }),
          );
          ring.rotation.x = -Math.PI / 2;
          ring.scale.set(1.8, 0.82, 1);
          ring.position.set(
            result.group.position.x,
            0.027,
            result.group.position.z,
          );
          ring.visible = false;
          nest.add(ring);
          selectionRings.set(result.info.id, ring);
        }
      });

      const nextInfo =
        infos.get(selectedIdRef.current) ?? infos.values().next().value ?? null;
      if (nextInfo) {
        showSelection(nextInfo.id);
        setSelected(nextInfo);
      }
    };

    rebuildRef.current(currentSettingsRef.current);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;

    const onPointerDown = (event: PointerEvent) => {
      downX = event.clientX;
      downY = event.clientY;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 7) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(clickTargets, false)[0];
      const info = hit?.object.userData.brickInfo as BrickInfo | undefined;
      if (info) {
        showSelection(info.id);
        setSelected(info);
      }
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    let animationFrame = 0;
    let hasAnnouncedReady = false;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      if (!hasAnnouncedReady) {
        hasAnnouncedReady = true;
        setRendererStatus("ready");
      }
      animationFrame = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      disposeObject(nest);
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
      rebuildRef.current = null;
      resetCameraRef.current = null;
    };
  }, []);

  useEffect(() => {
    const settings: Settings = {
      age,
      humidity,
      variation,
      masterSeed,
      filter,
    };
    currentSettingsRef.current = settings;
    rebuildRef.current?.(settings);
  }, [age, humidity, variation, masterSeed, filter]);

  const regenerate = () => {
    setMasterSeed(
      (value) => ((value * 1664525 + 1013904223) >>> 0) % 999999,
    );
  };

  return (
    <main className="nest-shell">
      <header className="nest-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            BM
          </div>
          <div>
            <p className="eyebrow">PROCEDURAL MATERIAL FAMILY</p>
            <h1>Brick Mother 砖块母体窝</h1>
          </div>
        </div>
        <div className="header-stats" aria-label="母体状态">
          <span>
            <b>9</b> 三维孩子
          </span>
          <span>
            <b>0</b> 贴图
          </span>
          <span>
            <b>0</b> 模型下载
          </span>
        </div>
      </header>

      <section className="workspace" aria-label="Brick Mother 三维工作区">
        <div className="viewport-card">
          <div ref={mountRef} className="three-viewport" />

          {rendererStatus === "loading" && (
            <div className="render-message">
              <Sparkles className="size-5" />
              母体正在生成九个孩子
            </div>
          )}
          {rendererStatus === "unsupported" && (
            <div className="render-message error">
              当前浏览器未能启动三维画布，请开启硬件加速后刷新。
            </div>
          )}

          <div className="viewport-topline">
            <span className="live-dot" />
            浏览器现场生成
            <span className="viewport-separator" />
            Mother seed {String(masterSeed).padStart(6, "0")}
          </div>

          <div className="viewport-help">
            <span>
              <MousePointer2 className="size-3.5" /> 拖动旋转
            </span>
            <span>滚轮缩放</span>
            <span>点击选砖</span>
          </div>

          <div className="material-legend" aria-label="三种材料">
            {(["adobe", "fired", "stone"] as MaterialKey[]).map((kind) => (
              <span key={kind}>
                <i style={{ background: MATERIAL_ACCENT[kind] }} />
                {MATERIAL_LABEL[kind]} × 3
              </span>
            ))}
          </div>
        </div>

        <aside className="control-panel" aria-label="母体控制台">
          <section className="panel-section material-filter">
            <div className="section-title-row">
              <div>
                <p className="panel-kicker">MATERIAL FAMILY</p>
                <h2>查看孩子</h2>
              </div>
              <span className="family-count">
                {filter === "all" ? "3 × 3" : "1 × 3"}
              </span>
            </div>
            <Tabs
              value={filter}
              onValueChange={(value) => setFilter(value as FilterKey)}
            >
              <TabsList className="material-tabs">
                <TabsTrigger value="all">全体</TabsTrigger>
                <TabsTrigger value="adobe">土坯</TabsTrigger>
                <TabsTrigger value="fired">烧结</TabsTrigger>
                <TabsTrigger value="stone">石块</TabsTrigger>
              </TabsList>
            </Tabs>
          </section>

          <section className="panel-section parameter-section">
            <div className="section-title-row">
              <div>
                <p className="panel-kicker">SHARED CONDITIONS</p>
                <h2>共同环境</h2>
              </div>
              <span className="region-chip">云南区域先验</span>
            </div>

            <ControlRow
              icon={<TimerReset className="size-4" />}
              label="年代"
              value={age}
              unit=" 年"
              min={0}
              max={160}
              onChange={setAge}
            />
            <ControlRow
              icon={<Droplets className="size-4" />}
              label="环境湿度"
              value={humidity}
              unit="%"
              min={0}
              max={100}
              onChange={setHumidity}
            />
            <ControlRow
              icon={<Sparkles className="size-4" />}
              label="批次差异"
              value={variation}
              unit="%"
              min={0}
              max={100}
              onChange={setVariation}
            />
          </section>

          <section className="panel-section selected-card">
            <div className="section-title-row">
              <div>
                <p className="panel-kicker">SELECTED CHILD</p>
                <h2>当前孩子</h2>
              </div>
              <Box className="size-5 text-[#d8b782]" />
            </div>

            {selected ? (
              <div className="selected-content">
                <div className="selected-name">
                  <span
                    className="selected-swatch"
                    style={{ background: MATERIAL_ACCENT[selected.material] }}
                  />
                  <strong>{selected.materialLabel}</strong>
                  <span>{selected.childLabel}</span>
                </div>
                <dl className="selected-data">
                  <div>
                    <dt>尺寸</dt>
                    <dd>{selected.size}</dd>
                  </div>
                  <div>
                    <dt>种子</dt>
                    <dd>{selected.seed}</dd>
                  </div>
                  <div>
                    <dt>持久数据</dt>
                    <dd>{selected.persistentBytes} B</dd>
                  </div>
                </dl>
                <p className="material-rule">{selected.rule}</p>
              </div>
            ) : (
              <p className="empty-selection">点击任意一块砖查看身份。</p>
            )}
          </section>

          <div className="panel-actions">
            <Button onClick={regenerate} className="primary-action">
              <RefreshCcw />
              再生一窝
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="恢复初始视角"
              onClick={() => resetCameraRef.current?.()}
              className="reset-action"
            >
              <RotateCcw />
            </Button>
          </div>
        </aside>
      </section>

      <footer className="nest-footer">
        <span>Brick Mother V0.1</span>
        <span>共享形体母核 · 三种材料规则 · 稀疏差量</span>
        <span>当前目标：母体压缩后小于 100 KB</span>
      </footer>
    </main>
  );
}
