import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

const stage = document.querySelector('.hero-stage');
const pin = document.querySelector('.hero-pin');
const canvas = document.getElementById('hero-gl');
if (!stage || !pin || !canvas) throw new Error('hero: missing markup');

const CFG = window.HERO3D_CFG = Object.assign({
  anchorU: 0.255, anchorV: 0.62,       // prism exit in the background image (u from left, v from top)
  bgDist: 10, fov: 30,
  plates: 8,
  endU: 0.915, endV: 0.60,             // where the last plate ends up (image space)
  startZ: 0.3, endZ: 5.2,              // depth travel toward camera
  hStart: 0.085, hEnd: 0.50,           // plate height as fraction of view height
  rotY: -0.62,
  compact: 0.035,
  revealStart: 0.16, revealEnd: 0.40,
  parallax: 0.18,
  scrollPerSecond: 520,                // px of scroll that equals 1s of video → calm scroll = real time
  pushIn: 0.7, driftX: 0.35,           // camera travel over the hero (world units)
  video: { desktop: 'assets/hero-env-2560.mp4', mobile: 'assets/hero-env-1440.mp4', duration: 6 },
  images: ['living', 'coat', 'solar', 'crowd', 'kitchen', 'sneaker']
}, window.HERO3D_CFG || {});

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = window.innerWidth < 900;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CFG.fov, 1, 0.1, 100);
camera.position.set(0, 0, CFG.bgDist);
const camBase = camera.position.clone();

// ---------- background: still first, scrubbed video once it can seek ----------
const loader = new THREE.TextureLoader();
const stillTex = loader.load(mobile ? 'assets/hero-bg-1920.jpg' : 'assets/hero-bg.jpg', () => { fit(); dirty = true; });
stillTex.colorSpace = THREE.SRGBColorSpace; stillTex.minFilter = THREE.LinearFilter; stillTex.generateMipmaps = false;
const bgMat = new THREE.MeshBasicMaterial({ map: stillTex });
const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bgMat);
scene.add(bg);

const video = document.createElement('video');
video.muted = true; video.playsInline = true; video.preload = 'auto'; video.crossOrigin = 'anonymous';
video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
let videoTex = null, videoReady = false, DUR = CFG.video.duration;
if (!reduce) {
  video.src = mobile ? CFG.video.mobile : CFG.video.desktop;
  video.addEventListener('loadedmetadata', () => { DUR = video.duration || DUR; sizePin(); });
  video.addEventListener('canplaythrough', () => {
    if (videoReady) return; videoReady = true;
    videoTex = new THREE.VideoTexture(video); videoTex.colorSpace = THREE.SRGBColorSpace; videoTex.minFilter = THREE.LinearFilter; videoTex.generateMipmaps = false;
    videoTex.repeat.copy(stillTex.repeat); videoTex.offset.copy(stillTex.offset);
    bgMat.map = videoTex; bgMat.needsUpdate = true; dirty = true;
  }, { once: true });
  video.addEventListener('seeked', () => { if (videoTex) videoTex.needsUpdate = true; dirty = true; });
  video.load();
}

const IMG_ASPECT = 16 / 9;
let viewW = 1, viewH = 1, anchor = new THREE.Vector3(), endPt = new THREE.Vector3();

function imgToWorld(u, v, z) {
  const rep = stillTex.repeat, off = stillTex.offset;
  const uv = (u - off.x) / rep.x, vv = ((1 - v) - off.y) / rep.y;
  const k = (CFG.bgDist - z) / CFG.bgDist;
  return new THREE.Vector3((uv - 0.5) * viewW * k, (vv - 0.5) * viewH * k, z);
}

function sizePin() {
  if (reduce) { pin.style.height = ''; return; }
  pin.style.height = Math.round(window.innerHeight + CFG.scrollPerSecond * DUR) + 'px';
}

function fit() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  viewH = 2 * CFG.bgDist * Math.tan(THREE.MathUtils.degToRad(CFG.fov / 2));
  viewW = viewH * camera.aspect;
  bg.scale.set(viewW * 1.08, viewH * 1.08, 1);   // slight overscan so the camera drift never shows an edge
  const r = camera.aspect / IMG_ASPECT;
  const setCover = t => { if (r >= 1) { t.repeat.set(1, 1 / r); t.offset.set(0, (1 - 1 / r) * 0.55); } else { t.repeat.set(r, 1); t.offset.set((1 - r) * (mobile ? 0.12 : 0.5), 0); } t.needsUpdate = true; };
  setCover(stillTex); if (videoTex) setCover(videoTex);
  anchor = imgToWorld(CFG.anchorU, CFG.anchorV, CFG.startZ);
  const visRight = stillTex.offset.x + stillTex.repeat.x;
  CFG._portrait = r < 1;
  const endU = CFG._portrait ? visRight - 0.035 : CFG.endU;
  endPt = imgToWorld(endU, CFG._portrait ? CFG.endV + 0.06 : CFG.endV, CFG._portrait ? 6.2 : CFG.endZ);
  CFG._hEnd = CFG._portrait ? 0.26 : CFG.hEnd;
  sizePin();
  layout();
}

// ---------- plate shader (frosted glass → image reveal by light sweep) ----------
const vert = /* glsl */`
  varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`;
const frag = /* glsl */`
  precision highp float;
  uniform sampler2D uMap; uniform float uReveal; uniform float uTime; uniform float uHasMap;
  varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
  void main(){
    vec2 uv = vUv;
    float n = noise(uv*90.0)*0.5 + noise(uv*23.0)*0.5;
    vec3 frost = mix(vec3(0.40,0.47,0.56), vec3(0.72,0.80,0.90), n*0.55 + (1.0-uv.x)*0.35);
    float fres = pow(1.0 - max(dot(vN, vV), 0.0), 2.5);
    frost += fres*0.25;
    float line = uReveal*1.25 - 0.12;
    float m = smoothstep(line-0.16, line, uv.x);
    vec3 img = pow(texture2D(uMap, uv).rgb, vec3(0.95));
    vec3 col = mix(img, frost, uHasMap > 0.5 ? m : 1.0);
    float band = exp(-abs(uv.x - line)*14.0) * (uHasMap > 0.5 ? 1.0 : 0.0) * smoothstep(0.0,0.05,uReveal) * (1.0-smoothstep(0.95,1.0,uReveal));
    col += vec3(0.45,0.75,1.0)*band*0.9;
    float sheen = pow(max(dot(normalize(vN+vec3(0.3,0.2,0.0)), vV),0.0), 30.0)*0.18;
    col += sheen + fres*vec3(0.25,0.35,0.5)*0.35;
    float alpha = mix(0.97, 0.7, m);
    gl_FragColor = vec4(col, alpha);
  }`;

const group = new THREE.Group(); scene.add(group);
const plates = [];
const texCache = {};
function tex(name) {
  if (!texCache[name]) { const t = loader.load('assets/plates/' + name + '.jpg', () => { dirty = true; }); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); texCache[name] = t; }
  return texCache[name];
}
const edgeMat = new THREE.LineBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.55 });
const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0xbfd8f2, transparent: true, opacity: 0.28, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide, depthWrite: false });

for (let i = 0; i < CFG.plates; i++) {
  const g = new THREE.Group();
  const hasImg = i >= CFG.plates - CFG.images.length;
  const imgName = hasImg ? CFG.images[i - (CFG.plates - CFG.images.length)] : null;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(9 / 16, 1), new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, transparent: true,
    uniforms: { uMap: { value: imgName ? tex(imgName) : null }, uReveal: { value: 0 }, uTime: { value: 0 }, uHasMap: { value: imgName ? 1 : 0 } }
  }));
  face.position.z = 0.012;
  const body = new THREE.Mesh(new THREE.BoxGeometry(9 / 16, 1, 0.022), bodyMat);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), edgeMat.clone());
  g.add(body, edges, face);
  group.add(g);
  plates.push({ g, face, edges, i, t: 0 });
}
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(120,180,255,0.55)'); gr.addColorStop(1, 'rgba(120,180,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
plates.forEach(p => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.0 })); s.scale.set(0.9, 0.35, 1); p.glow = s; scene.add(s); });

// ---------- layout along the path ----------
const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
let scroll = 0, scrollTarget = 0;
function layout() {
  const N = CFG.plates, s = ease(scroll);
  for (const p of plates) {
    const spread = p.i / (N - 1);
    const t = THREE.MathUtils.lerp(0.02 + p.i * CFG.compact, spread, s);
    p.t = t;
    const pos = new THREE.Vector3().lerpVectors(anchor, endPt, t);
    pos.y += CFG._portrait ? -t * t * viewH * 0.05 : Math.sin(t * Math.PI) * viewH * 0.02;
    const hFrac = THREE.MathUtils.lerp(CFG.hStart, CFG._hEnd || CFG.hEnd, t);
    const k = (CFG.bgDist - pos.z) / CFG.bgDist;
    const h = hFrac * viewH * k;
    p.g.position.copy(pos);
    p.g.scale.set(h, h, 1);
    p.g.rotation.y = (CFG._portrait ? -0.85 : CFG.rotY) + (1 - t) * 0.15;
    const reveal = THREE.MathUtils.smoothstep(t, CFG.revealStart, CFG.revealEnd);
    p.face.material.uniforms.uReveal.value = reveal;
    p.edges.material.opacity = 0.25 + 0.55 * (1 - Math.abs(reveal - 0.5) * 2) * (p.face.material.uniforms.uHasMap.value);
    p.glow.position.set(pos.x, pos.y - h * 0.5 - 0.02, pos.z);
    p.glow.scale.set(h * 1.1, h * 0.28, 1);
    p.glow.material.opacity = 0.15 + 0.35 * reveal;
  }
}

// ---------- scroll + mouse ----------
function progress() { const r = pin.getBoundingClientRect(); const total = pin.offsetHeight - window.innerHeight; return total <= 0 ? 0 : Math.max(0, Math.min(1, -r.top / total)); }
const copy = pin.querySelector('.hero-copy'), header = document.querySelector('header.site'), hint = pin.querySelector('.hero-hint');
let mouse = { x: 0, y: 0 }, mouseT = { x: 0, y: 0 };
window.addEventListener('pointermove', e => { mouseT.x = (e.clientX / window.innerWidth - 0.5) * 2; mouseT.y = (e.clientY / window.innerHeight - 0.5) * 2; }, { passive: true });
function onScroll() {
  scrollTarget = progress();
  const r = pin.getBoundingClientRect(); if (header) header.classList.toggle('on-dark', r.bottom > 72);
  if (copy) { const p = scrollTarget; copy.style.opacity = String(Math.max(0, 1 - p * 2.2)); copy.style.transform = 'translateY(' + (-p * 60) + 'px)'; copy.style.pointerEvents = p > 0.4 ? 'none' : ''; }
  if (hint) hint.style.opacity = String(Math.max(0, 1 - scrollTarget * 5));
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', () => { fit(); onScroll(); });

// ---------- frame loop ----------
let t0 = performance.now(), dirty = true, lastSeek = -1;
function loop(now) {
  requestAnimationFrame(loop);
  const el = Math.max(0, (now - t0) / 1000); t0 = now;
  const fs = 1 - Math.exp(-el * 12), fm = 1 - Math.exp(-el * 5);
  const ds = scrollTarget - scroll; if (Math.abs(ds) > 0.0004) { scroll += ds * fs; dirty = true; } else if (scroll !== scrollTarget) { scroll = scrollTarget; dirty = true; }
  const mx = mouseT.x - mouse.x, my = mouseT.y - mouse.y; if (Math.abs(mx) > 0.001 || Math.abs(my) > 0.001) { mouse.x += mx * fm; mouse.y += my * fm; dirty = true; }
  if (pin.getBoundingClientRect().bottom <= 0) return;
  // scrub the environment: scroll → video time (all-intra encode makes every seek instant)
  if (videoReady && video.readyState >= 2) {
    const t = Math.min(DUR - 0.02, scroll * DUR);
    if (Math.abs(t - lastSeek) > 1 / 60 && !video.seeking) { video.currentTime = t; lastSeek = t; }
  }
  if (!dirty) return;
  // camera: slow push-in + lateral drift over the scroll, plus mouse parallax
  const s = ease(scroll);
  camera.position.set(camBase.x + CFG.driftX * s + mouse.x * CFG.parallax, camBase.y - mouse.y * CFG.parallax * 0.6, camBase.z - CFG.pushIn * s);
  camera.lookAt(CFG.driftX * s * 0.4, 0, 0);
  group.rotation.y = mouse.x * 0.02;
  layout();
  renderer.render(scene, camera);
  dirty = false;
}
scene.add(new THREE.AmbientLight(0x88a6c8, 0.9));
const key = new THREE.PointLight(0x6fb6ff, 2.2, 12); key.position.set(-2.5, 0.2, 2.5); scene.add(key);

window.__heroState = () => ({ scroll, scrollTarget, videoReady, videoTime: video.currentTime, dur: DUR, pinH: pin.offsetHeight, anchor: anchor.toArray(), endPt: endPt.toArray(), viewW, viewH });
fit(); onScroll();
if (reduce) { scroll = scrollTarget = 1; }
requestAnimationFrame(loop);
canvas.classList.add('ready');
