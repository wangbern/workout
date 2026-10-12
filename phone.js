import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS3DRenderer, CSS3DObject } from "three/addons/renderers/CSS3DRenderer.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// Phone face in index.html is this size, in CSS pixels. CSS3D treats
// one world unit as one pixel, so the mesh uses the same numbers.
const FACE_W = 520;
const FACE_H = 1040;
const DEPTH = 176;
const BTN_T = 24;
const BTN_D = 40;
const LEFT_H = 168;
const RIGHT_H = 210;
const LEFT_Y = -220;
const RIGHT_Y = -180;
const SIDE_STICK = 12;
const BTN_Z = 32;

const view = document.getElementById("view");
const faceEl = document.getElementById("phone-face");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const camDir = new THREE.Vector3();
const toDir = new THREE.Vector3(0, 0, 1);
const sideDir = new THREE.Vector3(1, 0.12, 0).normalize();

let renderer;
let cssRenderer;
let camera;
let controls;
let homeDist = 2200;
let anim = null;
let faceShown = null;
let posed = false;
let phone;
let plastic;
let sideMat;
let backMat;
let shellBody;
let shellBack;
let leftBtn;
let rightBtn;
let stickerGroup;
const stickerTex = {};
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const SHELLS = {
  teal: ["#3ecfc8", "#1f8f8a", "#2aada6"],
  pink: ["#f7c6d8", "#d489a6", "#e8a9c2"],
  hot: ["#ff4f93", "#c2185b", "#e2367c"],
  green: ["#b6e38a", "#6eaa4e", "#8ec86a"],
  purple: ["#d4c4f2", "#9a7ec8", "#b89ae0"],
  yellow: ["#ffe58a", "#d4b04a", "#f0cc62"],
  blue: ["#7ec4f2", "#4f96c2", "#5ea6d4"],
  orange: ["#ff9f0a", "#c46a00", "#e07d12"],
  grey: ["#d8d4ce", "#8e8c88", "#b7b4ae"],
};

function frontDistance() {
  const vFov = camera.fov * Math.PI / 180;
  const aspect = camera.aspect || 1;
  const pad = 1.16;
  const distH = (FACE_H * pad * 0.5) / Math.tan(vFov / 2);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const distW = (FACE_W * pad * 0.5) / Math.tan(hFov / 2);
  return Math.max(distH, distW);
}

function makeShadow() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext("2d");
  const grd = g.createRadialGradient(128, 128, 28, 128, 128, 122);
  grd.addColorStop(0, "rgba(60, 100, 140, 0.38)");
  grd.addColorStop(1, "rgba(60, 100, 140, 0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(820, 820), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -FACE_H / 2 - 48;
  return mesh;
}

function buildPhone(scene) {
  phone = new THREE.Group();
  plastic = new THREE.MeshPhysicalMaterial({
    color: 0x7ec4f2,
    roughness: 0.24,
    metalness: 0.08,
    clearcoat: 0.9,
    clearcoatRoughness: 0.18,
  });
  sideMat = new THREE.MeshPhysicalMaterial({
    color: 0x4f96c2,
    roughness: 0.55,
    metalness: 0.04,
    clearcoat: 0.25,
    clearcoatRoughness: 0.45,
  });
  backMat = new THREE.MeshPhysicalMaterial({
    color: 0x5ea6d4,
    roughness: 0.42,
    metalness: 0.08,
    clearcoat: 0.45,
    clearcoatRoughness: 0.28,
  });
  shellBody = new THREE.Mesh(
    new RoundedBoxGeometry(FACE_W, FACE_H, DEPTH, 6, 78),
    plastic
  );
  phone.add(shellBody);
  shellBack = new THREE.Mesh(
    new RoundedBoxGeometry(FACE_W * 0.72, FACE_H * 0.72, 12, 4, 36),
    backMat
  );
  shellBack.position.set(0, -10, -DEPTH / 2 - 2);
  phone.add(shellBack);

  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(16, 16, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0x14202c, metalness: 0.7, roughness: 0.22 })
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.set(FACE_W * 0.28, 430, -DEPTH / 2 - 8);
  phone.add(lens);
  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(9, 18, 14),
    new THREE.MeshStandardMaterial({ color: 0x9fd8ff, metalness: 0.85, roughness: 0.08 })
  );
  glass.position.set(FACE_W * 0.28, 430, -DEPTH / 2 - 12);
  phone.add(glass);

  const btnX = FACE_W / 2 + SIDE_STICK - BTN_T / 2;
  leftBtn = new THREE.Mesh(
    new RoundedBoxGeometry(BTN_T, LEFT_H, BTN_D, 2, 5),
    sideMat
  );
  leftBtn.position.set(-btnX, LEFT_Y, BTN_Z);
  phone.add(leftBtn);

  rightBtn = new THREE.Mesh(
    new RoundedBoxGeometry(BTN_T, RIGHT_H, BTN_D, 2, 5),
    sideMat
  );
  rightBtn.position.set(btnX, RIGHT_Y, BTN_Z);
  phone.add(rightBtn);

  stickerGroup = new THREE.Group();
  phone.add(stickerGroup);

  scene.add(phone);
  scene.add(makeShadow());
}

function shellTargets() {
  return [shellBody, shellBack, leftBtn, rightBtn];
}

function setShellColor(id) {
  const row = SHELLS[id] || SHELLS.blue;
  plastic.color.set(row[0]);
  sideMat.color.set(row[1]);
  backMat.color.set(row[2]);
}

function lcdBox() {
  const lcd = document.querySelector(".lcd");
  if (!lcd) return null;
  let x = 0;
  let y = 0;
  let node = lcd;
  while (node && node !== faceEl) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent;
  }
  return { x: x, y: y, w: lcd.offsetWidth, h: lcd.offsetHeight };
}

function overlapsScreen(fx, fy) {
  const box = lcdBox();
  if (!box) return false;
  const sticker = { x: fx - 36, y: fy - 39, w: 72, h: 78 };
  return sticker.x < box.x + box.w && sticker.x + sticker.w > box.x &&
    sticker.y < box.y + box.h && sticker.y + sticker.h > box.y;
}

function localHit(clientX, clientY, targets) {
  const rect = renderer.domElement.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(targets, false);
  return hits.length ? hits[0] : null;
}

function hitTest(clientX, clientY) {
  const hit = localHit(clientX, clientY, shellTargets());
  if (!hit) return null;
  const localPoint = phone.worldToLocal(hit.point.clone());
  const worldNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  const inv = new THREE.Matrix4().copy(phone.matrixWorld).invert();
  const localNormal = worldNormal.clone().transformDirection(inv);
  if (localNormal.z > 0.55) {
    const fx = localPoint.x + FACE_W / 2;
    const fy = FACE_H / 2 - localPoint.y;
    if (overlapsScreen(fx, fy)) return null;
    if (fx < 24 || fy < 24 || fx > FACE_W - 24 || fy > FACE_H - 24) return null;
    return { kind: "face", x: fx, y: fy, z: 0, nx: 0, ny: 0, nz: 1 };
  }
  return {
    kind: "mesh",
    x: localPoint.x,
    y: localPoint.y,
    z: localPoint.z,
    nx: localNormal.x,
    ny: localNormal.y,
    nz: localNormal.z,
  };
}

function stickerTexture(dayId) {
  if (stickerTex[dayId]) return stickerTex[dayId];
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 176;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  stickerTex[dayId] = tex;
  const svg = window.MonsterArt.stickerSvg(dayId);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  img.onload = function () {
    const g = canvas.getContext("2d");
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.imageSmoothingEnabled = false;
    g.drawImage(img, 8, 8, canvas.width - 16, canvas.height - 16);
    tex.needsUpdate = true;
    URL.revokeObjectURL(url);
  };
  img.src = url;
  return tex;
}

function setStickers(list) {
  while (stickerGroup.children.length) {
    const mesh = stickerGroup.children[0];
    stickerGroup.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
  (list || []).forEach(function (place) {
    if (place.kind !== "mesh") return;
    const mat = new THREE.MeshBasicMaterial({
      map: stickerTexture(place.dayId),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(86, 94), mat);
    const n = new THREE.Vector3(place.nx || 0, place.ny || 0, place.nz || 1);
    if (n.lengthSq() < 1e-6) n.set(0, 0, 1);
    n.normalize();
    mesh.position.set(place.x, place.y, place.z).add(n.clone().multiplyScalar(8));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    mesh.userData.dayId = place.dayId;
    mesh.renderOrder = 3;
    stickerGroup.add(mesh);
  });
}

function pickSticker(clientX, clientY) {
  const hit = localHit(clientX, clientY, stickerGroup.children);
  if (!hit || !hit.object.userData) return "";
  return hit.object.userData.dayId || "";
}

function ease(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function recenter() {
  const from = camera.position.clone().sub(controls.target);
  const fromLen = from.length() || homeDist;
  const fromDir = from.multiplyScalar(1 / fromLen);
  anim = {
    t0: performance.now(),
    dur: reduceMotion ? 1 : 700,
    fromDir: fromDir.clone(),
    fromLen: fromLen,
    toLen: homeDist,
    fromTarget: controls.target.clone(),
    toTarget: new THREE.Vector3(0, 0, 0),
    opposite: fromDir.dot(toDir) < -0.9,
  };
  controls.enabled = false;
  controls._sphericalDelta.set(0, 0, 0);
  controls._panOffset.set(0, 0, 0);
  camera.up.set(0, 1, 0);
}

function stepAnim(now) {
  const t = Math.min(1, (now - anim.t0) / anim.dur);
  const e = ease(t);
  let dir;
  if (anim.opposite) {
    if (e < 0.5) dir = anim.fromDir.clone().lerp(sideDir, e * 2);
    else dir = sideDir.clone().lerp(toDir, (e - 0.5) * 2);
  } else {
    dir = anim.fromDir.clone().lerp(toDir, e);
  }
  if (dir.lengthSq() < 1e-8) dir = sideDir.clone();
  else dir.normalize();
  const len = anim.fromLen + (anim.toLen - anim.fromLen) * e;
  const target = anim.fromTarget.clone().lerp(anim.toTarget, e);
  camera.position.copy(target).add(dir.multiplyScalar(len));
  controls.target.copy(target);
  camera.up.set(0, 1, 0);
  camera.lookAt(target);
  if (t >= 1) {
    camera.position.set(0, 0, anim.toLen);
    controls.target.set(0, 0, 0);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    anim = null;
    controls._sphericalDelta.set(0, 0, 0);
    controls._panOffset.set(0, 0, 0);
    controls.enabled = true;
    controls.update();
  }
}

function updateFacing() {
  camDir.copy(camera.position).sub(controls.target);
  const len = camDir.length() || 1;
  const z = camDir.z / len;
  const key = z > 0.22 ? "f" : "-";
  if (key === faceShown) return;
  faceShown = key;
  const front = z > 0.22 ? "visible" : "hidden";
  faceEl.style.visibility = front;
}

function resize() {
  const w = view.clientWidth || window.innerWidth;
  const h = Math.max(1, view.clientHeight || window.innerHeight);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  cssRenderer.setSize(w, h);
  homeDist = frontDistance();
  controls.minDistance = Math.max(780, homeDist * 0.55);
  controls.maxDistance = homeDist * 2.4;
  if (!posed) {
    const yaw = 0.42;
    camera.position.set(Math.sin(yaw) * homeDist, homeDist * 0.035, Math.cos(yaw) * homeDist);
    controls.target.set(0, 0, 0);
    camera.lookAt(0, 0, 0);
    controls.update();
    posed = true;
  }
}

function bindGestures() {
  const dom = cssRenderer.domElement;
  dom.style.touchAction = "none";
  let lastTap = 0;
  let lastX = 0;
  let lastY = 0;
  let downX = 0;
  let downY = 0;
  let moved = false;

  dom.addEventListener("pointerdown", function (event) {
    downX = event.clientX;
    downY = event.clientY;
    moved = false;
  });
  dom.addEventListener("pointermove", function (event) {
    if (Math.hypot(event.clientX - downX, event.clientY - downY) > 14) moved = true;
  });
  dom.addEventListener("pointerup", function (event) {
    if (event.target.closest && event.target.closest("button")) return;
    if (moved || Math.hypot(event.clientX - downX, event.clientY - downY) > 16) return;
    const now = performance.now();
    const near = Math.hypot(event.clientX - lastX, event.clientY - lastY) < 40;
    if (now - lastTap < 340 && near) {
      lastTap = 0;
      recenter();
    } else {
      lastTap = now;
      lastX = event.clientX;
      lastY = event.clientY;
    }
  });

  faceEl.addEventListener("pointerdown", function (event) {
    if (event.target.closest && event.target.closest("button")) event.stopPropagation();
  });
}

function frame() {
  requestAnimationFrame(frame);
  if (anim) stepAnim(performance.now());
  else controls.update();
  updateFacing();
  renderer.render(scene, camera);
  cssRenderer.render(cssScene, camera);
}

const scene = new THREE.Scene();
const cssScene = new THREE.Scene();

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.inset = "0";
  renderer.domElement.style.zIndex = "0";
  view.appendChild(renderer.domElement);

  cssRenderer = new CSS3DRenderer();
  cssRenderer.domElement.className = "css3d";
  cssRenderer.domElement.style.position = "absolute";
  cssRenderer.domElement.style.inset = "0";
  cssRenderer.domElement.style.zIndex = "1";
  view.appendChild(cssRenderer.domElement);

  camera = new THREE.PerspectiveCamera(32, 1, 8, 30000);
  controls = new OrbitControls(camera, cssRenderer.domElement);
  controls.enableDamping = !reduceMotion;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 0.75;
  controls.panSpeed = 0.55;
  controls.enablePan = true;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

  scene.add(new THREE.AmbientLight(0xffffff, 0.72));
  const hemi = new THREE.HemisphereLight(0xfff6ee, 0x6e9cbc, 0.85);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(280, 640, 860);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd7ecff, 1.1);
  fill.position.set(-520, 180, 420);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.35);
  rim.position.set(-180, 360, -780);
  scene.add(rim);

  buildPhone(scene);

  const cssObject = new CSS3DObject(faceEl);
  cssObject.position.set(0, 0, DEPTH / 2 + 2);
  cssScene.add(cssObject);
  faceEl.style.pointerEvents = "none";

  bindGestures();
  resize();
  window.addEventListener("resize", resize);
  document.body.classList.add("has-3d");
  window.PhoneShell = {
    swatches: SHELLS,
    order: ["teal", "pink", "hot", "green", "purple", "yellow", "blue", "orange", "grey"],
    setColor: setShellColor,
    hitTest: hitTest,
    setStickers: setStickers,
    pickSticker: pickSticker,
    setDragging: function (on) {
      if (controls && !anim) controls.enabled = !on;
    },
  };
  window.dispatchEvent(new Event("phone-ready"));
  frame();
}

try {
  init();
} catch (err) {
  console.error(err);
  document.body.classList.add("no-3d");
}
