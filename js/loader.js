// GLB loading: default model on startup, plus file picker / drag & drop.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MODEL_URLS } from './config.js';
import { setupModel } from './model.js';
import { $ } from './utils.js';

const loader = new GLTFLoader();

function showLoader(text) { $('loader').classList.remove('hidden'); $('loaderText').textContent = text; }
function hideLoader() { $('loader').classList.add('hidden'); }
function loaderFail(msg) {
  $('loaderSpin').classList.add('hidden');
  $('loaderText').textContent = msg;
  $('loaderHelp').classList.remove('hidden');
}

function loadUrl(url) {
  return new Promise((resolve, reject) => loader.load(url, resolve, (e) => {
    if (e.total) $('loaderText').textContent = `3D 모델을 불러오는 중… ${Math.round((e.loaded / e.total) * 100)}%`;
  }, reject));
}

export async function loadDefault() {
  for (const url of MODEL_URLS) {
    try {
      const gltf = await loadUrl(url);
      setupModel(gltf);
      hideLoader();
      return;
    } catch (err) {
      console.warn(`[model] ${url} 로드 실패`, err);
    }
  }
  loaderFail('character_2048.glb를 불러오지 못했습니다.');
}

// Resolves true when the model was replaced.
export async function loadFile(file) {
  if (!file) return false;
  showLoader(`${file.name} 불러오는 중…`);
  $('loaderSpin').classList.remove('hidden');
  $('loaderHelp').classList.add('hidden');
  const url = URL.createObjectURL(file);
  try {
    setupModel(await loadUrl(url));
    hideLoader();
    return true;
  } catch (err) {
    console.error(err);
    loaderFail('모델을 불러오지 못했습니다: ' + (err.message || err));
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}
