import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const PART_COUNT = 9;
const base = new URL('.', import.meta.url);
const urls = Array.from({ length: PART_COUNT }, (_, index) => new URL(`wall-system-v30-part-${String(index + 1).padStart(2, '0')}.txt?v=3.0.0`, base));

try {
  const responses = await Promise.all(urls.map((url) => fetch(url, { cache: 'no-store' })));
  const failed = responses.find((response) => !response.ok);
  if (failed) throw new Error(`程序模块读取失败：HTTP ${failed.status}`);
  const source = (await Promise.all(responses.map((response) => response.text()))).join('');
  const execute = new Function('THREE', 'OrbitControls', `${source}\n//# sourceURL=wall-system-v30-runtime.js`);
  execute(THREE, OrbitControls);
} catch (error) {
  console.error(error);
  const box = document.getElementById('canvasError');
  if (box) { box.textContent = `完整墙体启动失败：${error.message || error}`; box.hidden = false; }
  const state = document.getElementById('runtimeState');
  if (state) { state.textContent = '运行失败'; state.classList.add('error'); }
}
