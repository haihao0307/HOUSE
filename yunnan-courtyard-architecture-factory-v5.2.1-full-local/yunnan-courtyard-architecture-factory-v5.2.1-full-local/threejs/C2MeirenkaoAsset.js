import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const C2_MEIRENKAO_ASSETS = {
  editable: 'YN_TUANJIE_001_EDITABLE.glb',
};

const ASSET_ID = 'YN_C2_Meirenkao';
const SAMPLE_ID = 'YN_TUANJIE_001';

function joinUrl(baseUrl, filename) {
  return `${baseUrl.replace(/\/$/, '')}/${filename}`;
}

/**
 * Load the editable Tuánjié Township GLB master as a Three.js reference layer.
 * The compatibility function name is retained for existing integrations.
 */
export async function loadC2Meirenkao({
  scene = null,
  baseUrl = '/assets/models',
  variant = 'editable',
  onProgress,
} = {}) {
  if (!C2_MEIRENKAO_ASSETS[variant]) {
    throw new Error(`Unknown C2 Meirenkao variant: ${variant}`);
  }

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(
    joinUrl(baseUrl, C2_MEIRENKAO_ASSETS[variant]),
    onProgress,
  );

  const root = gltf.scene;
  root.name = ASSET_ID;
  root.userData = {
    ...root.userData,
    assetId: ASSET_ID,
    sampleId: SAMPLE_ID,
    regionSeriesId: 'YN_TUANJIE_REFERENCE_SERIES',
    locality: '云南·团结乡',
    localityAuthority: 'userConfirmed',
    assetRole: '3GIS_reference_whole_compound_scan',
    variant,
    units: 'meters',
    originRule: 'XY bounding-box center at minimum Z',
    physicalScaleStatus: 'unverifiedNoSurveyControl',
    boundsMeaning: 'display-only; not measured building dimensions',
    semanticStatus: 'spatial structural groups only; not BIM semantics',
  };

  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = true;
  });

  if (scene) scene.add(root);

  const bounds = new THREE.Box3().setFromObject(root);
  const dimensions = bounds.getSize(new THREE.Vector3());
  return {
    ...gltf,
    root,
    bounds,
    dimensions,
    dimensionsMeters: dimensions.toArray(),
  };
}

export function disposeC2Meirenkao(root) {
  root?.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry?.dispose();
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) material?.dispose?.();
  });
  root?.parent?.remove(root);
}
