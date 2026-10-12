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

// The title sticker. It is drawn on a canvas so it can sit on the back.
// TITLE_W / TITLE_H match the svg in app.js; the canvas is a little taller
// so the bottom line's edge and shadow are not cut off.
const TITLE_ID = "title";
const TITLE_W = 400;
const TITLE_H = 80;
const TITLE_VIEW_W = 420;
const TITLE_VIEW_H = 84;
const TITLE_PAD_Y = 5;
const TITLE_SCALE = 3;
const TITLE_TILT = 6 * Math.PI / 180;
const TITLE_FONT = '26px "Slackside One", "ZCOOL KuaiLe", "Arial Black", sans-serif';
const TITLE_HOME = { kind: "mesh", x: 0, y: -10, z: -DEPTH / 2 - 8, nx: 0, ny: 0, nz: -1 };
const TITLE_RIM = "#2a2f5a";
// Same sparkles as TITLE_SPARKS in app.js: x, y, size, twinkle phase, color.
const SPARKS = [
  [88, 16, 12, 0, "rgba(255, 150, 196, 0.78)"], [214, 5, 9, 0.45, "rgba(140, 205, 255, 0.78)"], [334, 20, 13, 0.2, "rgba(255, 178, 122, 0.78)"],
  [128, 66, 9, 0.7, "rgba(255, 178, 122, 0.78)"], [296, 68, 10, 0.55, "rgba(255, 150, 196, 0.78)"], [362, 50, 8, 0.85, "rgba(140, 205, 255, 0.78)"],
];
const HOLO_BRIGHT = [
  [0, "#ff3d9a"], [0.16, "#ff8a1f"], [0.32, "#f5c400"], [0.48, "#22c96b"],
  [0.64, "#12b5e8"], [0.8, "#5b6bff"], [0.9, "#b44dff"], [1, "#ff3d9a"],
];
const HOLO = [
  [0, "#ff9ec7"], [0.16, "#ffbd94"], [0.32, "#ffe082"], [0.48, "#9fe6b0"],
  [0.64, "#93d8f5"], [0.8, "#a5b1ff"], [0.9, "#d2a6ff"], [1, "#ff9ec7"],
];

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
const stickerArt = {};
const STICKER_PAD = 8;
let sheenAt = 0;
const sheenNormal = new THREE.Vector3();
const sheenView = new THREE.Vector3();
const sheenSpot = new THREE.Vector3();
let titleCanvas;
let titleEdge;
let titleTex;
let titleLines = ["", ""];
let titleShown = false;
let titleBright = false;
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
    // The bezel is nudged down with a transform, which offsetTop leaves out.
    const shift = getComputedStyle(node).transform;
    if (shift && shift !== "none") {
      const m = new DOMMatrixReadOnly(shift);
      x += m.m41;
      y += m.m42;
    }
    node = node.offsetParent;
  }
  return { x: x, y: y, w: lcd.offsetWidth, h: lcd.offsetHeight };
}

function overlapsScreen(fx, fy, w, h) {
  const box = lcdBox();
  if (!box) return false;
  const sw = w || 72;
  const sh = h || 78;
  const sticker = { x: fx - sw / 2, y: fy - sh / 2, w: sw, h: sh };
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

function shellHit(clientX, clientY) {
  const hit = localHit(clientX, clientY, shellTargets());
  if (!hit) return null;
  const localPoint = phone.worldToLocal(hit.point.clone());
  const worldNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  const inv = new THREE.Matrix4().copy(phone.matrixWorld).invert();
  const localNormal = worldNormal.clone().transformDirection(inv);
  return { point: localPoint, normal: localNormal };
}

function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

// The title is wide, so it only lies flat on the front or the back, and it
// slides in from the edges instead of hanging off them. It may lap over the
// rim of the screen, as it always has, but its middle stays off the screen.
function hitTitle(clientX, clientY, rot) {
  const hit = shellHit(clientX, clientY);
  if (!hit) return null;
  // Turned, the title needs more room up and down and less side to side.
  const turn = (rot || 0) * Math.PI / 180;
  const cos = Math.abs(Math.cos(turn));
  const sin = Math.abs(Math.sin(turn));
  const padX = 170 * cos + 44 * sin;
  const padY = 170 * sin + 44 * cos;
  if (hit.normal.z > 0.55) {
    const fx = clamp(hit.point.x + FACE_W / 2, padX, FACE_W - padX);
    const fy = clamp(FACE_H / 2 - hit.point.y, padY, FACE_H - padY);
    if (overlapsScreen(fx, fy, 240, 2)) return null;
    return { kind: "face", x: fx, y: fy, z: 0, nx: 0, ny: 0, nz: 1 };
  }
  if (hit.normal.z < -0.55) {
    return {
      kind: "mesh",
      x: clamp(hit.point.x, padX - FACE_W / 2, FACE_W / 2 - padX),
      y: clamp(hit.point.y, padY - FACE_H / 2, FACE_H / 2 - padY),
      z: TITLE_HOME.z,
      nx: 0,
      ny: 0,
      nz: -1,
    };
  }
  return null;
}

function hitTest(clientX, clientY) {
  const hit = shellHit(clientX, clientY);
  if (!hit) return null;
  const localPoint = hit.point;
  const localNormal = hit.normal;
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
  // The monster is drawn once on its own canvas. The glint is painted over a
  // copy of it, so the SVG is never drawn again.
  const base = document.createElement("canvas");
  base.width = canvas.width;
  base.height = canvas.height;
  const art = { tex: tex, base: base, g: canvas.getContext("2d"), ready: false, lit: false };
  stickerArt[dayId] = art;
  const svg = window.MonsterArt.stickerSvg(dayId);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  img.onload = function () {
    const g = base.getContext("2d");
    g.clearRect(0, 0, base.width, base.height);
    g.imageSmoothingEnabled = false;
    g.drawImage(img, STICKER_PAD, STICKER_PAD, base.width - 2 * STICKER_PAD, base.height - 2 * STICKER_PAD);
    art.g.clearRect(0, 0, canvas.width, canvas.height);
    art.g.drawImage(base, 0, 0);
    art.ready = true;
    tex.needsUpdate = true;
    URL.revokeObjectURL(url);
  };
  img.src = url;
  return tex;
}

// The white glint from .sticker-sheen-band in styles.css, for stickers on
// the shell. It is painted about 30 times a second, only on stickers that
// face the camera, and not at all while the band is off the sticker.
function paintSheens(now) {
  if (now - sheenAt < 32) return;
  sheenAt = now;
  const w = 160 - 2 * STICKER_PAD;
  const h = 176 - 2 * STICKER_PAD;
  const bandW = 0.45 * w;
  const bandH = 1.4 * h;
  const left = STICKER_PAD + w * (-0.6 + 1.71 * ((now % 2600) / 2600));
  const top = STICKER_PAD - 0.2 * h;
  const on = left + bandW > STICKER_PAD && left < STICKER_PAD + w;
  let grad = null;
  stickerGroup.children.forEach(function (mesh) {
    const art = stickerArt[mesh.userData.dayId];
    // A matte sticker gets no glint, only a clean repaint if it had one.
    const shine = on && !mesh.userData.matte;
    if (!art || !art.ready || (!shine && !art.lit)) return;
    mesh.getWorldDirection(sheenNormal);
    sheenView.copy(camera.position).sub(mesh.getWorldPosition(sheenSpot));
    if (sheenNormal.dot(sheenView) <= 0) return;
    const g = art.g;
    g.globalCompositeOperation = "copy";
    g.drawImage(art.base, 0, 0);
    if (shine) {
      if (!grad) {
        // linear-gradient(115deg, ...) across the band's box.
        const dx = Math.sin(115 * Math.PI / 180);
        const dy = -Math.cos(115 * Math.PI / 180);
        const half = (bandW * dx + bandH * dy) / 2;
        const cx = left + bandW / 2;
        const cy = top + bandH / 2;
        grad = g.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
        grad.addColorStop(0, "rgba(255, 255, 255, 0)");
        grad.addColorStop(0.36, "rgba(255, 255, 255, 0.15)");
        grad.addColorStop(0.5, "rgba(255, 255, 255, 0.9)");
        grad.addColorStop(0.62, "rgba(186, 230, 255, 0.55)");
        grad.addColorStop(1, "rgba(186, 230, 255, 0)");
      }
      // source-atop keeps the glint inside the monster's own shape.
      g.globalCompositeOperation = "source-atop";
      g.fillStyle = grad;
      g.fillRect(left, top, bandW, bandH);
    }
    g.globalCompositeOperation = "source-over";
    art.lit = shine;
    art.tex.needsUpdate = true;
  });
}

function holoFill(g, now) {
  const p = reduceMotion ? 0 : (now % 3200) / 3200;
  const spans = 6;
  const x0 = (p - 1) * 150;
  const y0 = 8 + (p - 1) * 20;
  const grad = g.createLinearGradient(x0, y0, x0 + 150 * spans, y0 + 20 * spans);
  for (let k = 0; k < spans; k++) {
    (titleBright ? HOLO_BRIGHT : HOLO).forEach(function (stop) {
      grad.addColorStop((k + stop[0]) / spans, stop[1]);
    });
  }
  return grad;
}

function titleInk(g) {
  g.setTransform(TITLE_SCALE, 0, 0, TITLE_SCALE, 0, TITLE_PAD_Y * TITLE_SCALE);
  g.font = TITLE_FONT;
  g.textAlign = "center";
  g.lineJoin = "round";
}

function eachTitleLine(draw) {
  const two = !!titleLines[1];
  draw(titleLines[0], two ? 32 : 48);
  if (two) draw(titleLines[1], 60);
}

// The dark rim, the white edge and the shadow only change with the words,
// so they are kept on their own canvas and the moving fill is drawn over them.
function paintTitleEdge() {
  const g = titleEdge.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, titleEdge.width, titleEdge.height);
  titleInk(g);
  g.strokeStyle = TITLE_RIM;
  g.lineWidth = 9.5;
  g.shadowColor = "rgba(20, 55, 100, 0.32)";
  g.shadowOffsetX = 2 * TITLE_SCALE;
  g.shadowOffsetY = 4 * TITLE_SCALE;
  g.shadowBlur = 2 * TITLE_SCALE;
  eachTitleLine(function (text, y) { g.strokeText(text, TITLE_VIEW_W / 2, y); });
  g.shadowColor = "transparent";
  g.fillStyle = "#fff";
  g.strokeStyle = "#fff";
  g.lineWidth = 7;
  eachTitleLine(function (text, y) {
    g.strokeText(text, TITLE_VIEW_W / 2, y);
    g.fillText(text, TITLE_VIEW_W / 2, y);
  });
}

// A white glint that sweeps over the rainbow, as #holo-sheen does on the front.
function sheenFill(g, now) {
  const x = -120 + 580 * ((now % 2600) / 2600);
  const grad = g.createLinearGradient(x, 0, x + 80, 30);
  grad.addColorStop(0, "rgba(255, 255, 255, 0)");
  grad.addColorStop(0.5, "rgba(255, 255, 255, 0.95)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0)");
  return grad;
}

function paintSparks(g, now) {
  g.strokeStyle = "rgba(255, 255, 255, 0.7)";
  g.lineWidth = 0.8;
  SPARKS.forEach(function (s) {
    g.fillStyle = s[4];
    // Eased like the CSS twinkle: dim and small, then full, then back.
    const wave = reduceMotion ? 1 : 0.5 - 0.5 * Math.cos(2 * Math.PI * (now / 1800 + s[3]));
    const r = s[2] * (0.25 + 0.75 * wave);
    g.globalAlpha = 0.1 + 0.9 * wave;
    g.beginPath();
    g.moveTo(s[0], s[1] - r);
    g.quadraticCurveTo(s[0], s[1], s[0] + r, s[1]);
    g.quadraticCurveTo(s[0], s[1], s[0], s[1] + r);
    g.quadraticCurveTo(s[0], s[1], s[0] - r, s[1]);
    g.quadraticCurveTo(s[0], s[1], s[0], s[1] - r);
    g.closePath();
    g.fill();
    g.stroke();
  });
  g.globalAlpha = 1;
}

function paintTitle(now) {
  const g = titleCanvas.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, titleCanvas.width, titleCanvas.height);
  g.drawImage(titleEdge, 0, 0);
  titleInk(g);
  g.fillStyle = holoFill(g, now);
  eachTitleLine(function (text, y) { g.fillText(text, TITLE_VIEW_W / 2, y); });
  if (!reduceMotion) {
    g.fillStyle = sheenFill(g, now);
    eachTitleLine(function (text, y) { g.fillText(text, TITLE_VIEW_W / 2, y); });
  }
  paintSparks(g, now);
  titleTex.needsUpdate = true;
}

function buildTitle() {
  titleCanvas = document.createElement("canvas");
  titleCanvas.width = TITLE_VIEW_W * TITLE_SCALE;
  titleCanvas.height = TITLE_VIEW_H * TITLE_SCALE;
  titleEdge = document.createElement("canvas");
  titleEdge.width = titleCanvas.width;
  titleEdge.height = titleCanvas.height;
  titleTex = new THREE.CanvasTexture(titleCanvas);
  titleTex.colorSpace = THREE.SRGBColorSpace;
  titleTex.anisotropy = 4;
}

function setTitle(line1, line2, bright) {
  titleLines = [line1 || "", line2 || ""];
  titleBright = !!bright;
  const paint = function () {
    paintTitleEdge();
    paintTitle(performance.now());
  };
  paint();
  // The first paint can land before the sticker font has loaded.
  if (document.fonts && document.fonts.load) {
    document.fonts.load(TITLE_FONT, titleLines.join("")).then(paint, function () {});
  }
}

function setStickers(list) {
  while (stickerGroup.children.length) {
    const mesh = stickerGroup.children[0];
    stickerGroup.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
  titleShown = false;
  (list || []).forEach(function (place) {
    if (place.kind !== "mesh") return;
    const isTitle = place.dayId === TITLE_ID;
    const mat = new THREE.MeshBasicMaterial({
      map: isTitle ? titleTex : stickerTexture(place.dayId),
      // Tone mapping washes the rainbow out to pastel.
      toneMapped: !isTitle,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const mesh = new THREE.Mesh(
      isTitle ? new THREE.PlaneGeometry(TITLE_W, TITLE_H) : new THREE.PlaneGeometry(86, 94),
      mat
    );
    const n = new THREE.Vector3(place.nx || 0, place.ny || 0, place.nz || 1);
    if (n.lengthSq() < 1e-6) n.set(0, 0, 1);
    n.normalize();
    mesh.position.set(place.x, place.y, place.z).add(n.clone().multiplyScalar(8));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    // Seen from outside the shell, a turn to the right is clockwise.
    mesh.rotateZ((isTitle ? TITLE_TILT : 0) - (place.rot || 0) * Math.PI / 180);
    if (isTitle) titleShown = true;
    mesh.userData.dayId = place.dayId;
    mesh.userData.matte = !!place.matte;
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
  const now = performance.now();
  if (anim) stepAnim(now);
  else controls.update();
  updateFacing();
  if (titleShown && !reduceMotion) paintTitle(now);
  if (!reduceMotion) paintSheens(now);
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
  buildTitle();

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
    hitTitle: hitTitle,
    titleHome: TITLE_HOME,
    setTitle: setTitle,
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
