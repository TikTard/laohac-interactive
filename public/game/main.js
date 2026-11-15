import * as THREE from "three";
import { World } from "./world.js";
import { Brain } from "./brain.js";
import { Story } from "./story.js";
import { Voice, unlock, unlocked, bark as barkSfx, setMuted } from "./audio.js";
import * as ui from "./ui.js";

let config = null;
const getConfig = () => config;

// ------------------------------------------------------------------ renderer / camera
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120);
const LOOK = new THREE.Vector3(0, 0.75, -1.9);
const camBase = { pos: new THREE.Vector3(), fov: 56 };
/** Camera moves: wide(seconds) pulls back to show the whole village (festival), then eases back. */
export const camFx = {
  amount: 0, target: 0, until: 0,
  wide(seconds = 16) { this.target = 1; this.until = performance.now() + seconds * 1000; },
  // spotlight on a donor: the camera glides closer and follows them
  f: 0, fTarget: 0, fUntil: 0, fRank: -1, fGet: null, fDist: 3.2,
  // a fixed shot for big events (river race, tug-of-war…): wins over the donor spotlight and the wide shot
  s: 0, sTarget: 0, sPos: new THREE.Vector3(), sLook: new THREE.Vector3(),
  shot(pos, look) { this.sPos.copy(pos); this.sLook.copy(look); this.sTarget = 1; },
  clearShot() { this.sTarget = 0; },
  focus(getPos, seconds = 4, rank = 0) {
    if (this.sTarget) return false;
    const now = performance.now();
    const held = now - (this.fStart || 0);
    if (this.fTarget && now < this.fUntil && rank < this.fRank && held < 1500) return false; // give the current one 1.5 s
    this.fGet = getPos; this.fRank = rank; this.fTarget = 1; this.fStart = now;
    this.fUntil = performance.now() + seconds * 1000;
    this.fDist = Math.max(3.4, 4.5 - rank * 0.2);
    return true;
  },
};
const _fp = new THREE.Vector3(), _fcam = new THREE.Vector3();
const _look = new THREE.Vector3();

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // portrait (TikTok 9:16) is the main framing; landscape pulls back a little less
  const portrait = camera.aspect < 1;
  // phone / TikTok (portrait): pulled back and a bit higher so more villagers fit in frame
  camera.fov = portrait ? 56 : 40;
  camera.position.set(0, portrait ? 2.35 : 2.2, portrait ? 6.3 : 6.0);
  camBase.pos.copy(camera.position);
  camBase.fov = camera.fov;
  camera.lookAt(LOOK);
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

// ------------------------------------------------------------------ sound gate (browsers block audio until a click; OBS does not)
const gate = document.getElementById("soundGate");
async function tryUnlock() {
  await unlock();
  gate.hidden = unlocked() || !isAudio;
}
gate.addEventListener("click", tryUnlock);
addEventListener("pointerdown", tryUnlock);
setTimeout(() => { tryUnlock(); setTimeout(() => (gate.hidden = unlocked() || !isAudio), 600); }, 300);

// ------------------------------------------------------------------ boot
const world = new World(scene);
const voice = new Voice(() => config?.tts || { provider: "browser" });
let brain = null;
let story = null;
let isAudio = true; // false on secondary screens (muted, never drive the story)
const send = (m) => isAudio && ws?.readyState === 1 && ws.send(JSON.stringify(m));

async function boot() {
  const first = await connect();
  config = first.config;
  ui.setTitle(config.game.title);
  ui.setGuide(config);
  ui.setState(first.state);
  await world.build(config);
  brain = new Brain(world, voice, getConfig, send);
  brain.camFx = camFx;
  story = new Story(world, brain);
  brain.story = story;
  story.resume(first.episode);
  brain.checkLikeMilestone(first.state.totals.likes);
  setTimeout(() => brain.landlord.set(first.state.landlord), 4000); // after the crowd walked in
  ui.loaded();
  setTimeout(() => voice.say("Chào bà con! Lão với cậu Vàng ngồi ở cổng làng đây. Gõ Vàng ơi để cậu Vàng chào bà con nhé!", 1), 1500);
}

// ------------------------------------------------------------------ server link
let ws = null;
function connect() {
  return new Promise((resolve) => {
    let resolved = false;
    const open = () => {
      ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws?role=game`);
      ws.onopen = () => ui.setConn(true);
      ws.onclose = () => { ui.setConn(false); setTimeout(open, 2000); };
      ws.onmessage = (m) => {
        const msg = JSON.parse(m.data);
        if (msg.t === "hello" || msg.t === "build") checkBuild(msg.build);
        if (msg.t === "hello" && !resolved) { resolved = true; resolve(msg); return; }
        if (msg.t === "build") return;
        if (msg.t === "audio") { onAudio(msg); return; }
        onMessage(msg);
      };
    };
    open();
  });
}

/** The game code changed on the server: reload this screen (once the current scene is over, at most 60 s later). */
let myBuild = null, reloadAt = 0;
function checkBuild(b) {
  if (!b) return;
  if (myBuild === null) { myBuild = b; return; }
  if (b === myBuild || reloadAt) return;
  reloadAt = performance.now() + 60000;
  const tryReload = () => (!story?.busy || performance.now() > reloadAt ? location.reload() : setTimeout(tryReload, 2000));
  setTimeout(tryReload, 500);
}

function onAudio(msg) {
  isAudio = msg.on;
  setMuted(!msg.on);
  document.getElementById("muteTag").hidden = msg.on;
  if (!msg.on) gate.hidden = true;
}

function onMessage(msg) {
  if (!brain) return;
  switch (msg.t) {
    case "hello":
    case "config":
      if (msg.config) {
        config = msg.config;
        ui.setTitle(config.game.title);
        ui.setGuide(config);
        world.setPlaque(config.game.plaque);
      }
      if (msg.state) ui.setState(msg.state);
      if (msg.t === "hello") story?.sync(msg.episode ?? null); // reconnected (server restarted?): drop what it forgot
      break;
    case "state":
      ui.setState(msg.state);
      brain.landlord.set(msg.state.landlord);
      brain.checkLikeMilestone(msg.state.totals.likes);
      break;
    case "event":
      brain.handle(msg.ev);
      break;
    case "bigMeter":
      ui.bigMeter(msg.m);
      break;
    case "episode":
      story.onMessage(msg);
      break;
    case "say":
      voice.say(msg.text, 3);
      break;
    case "action":
      if (msg.action === "bark") brain.bark(3, "Gâu gâu gâu!", true);
      if (msg.action === "thank") { world.lao.thank(2); world.dog.happy(); }
      if (msg.action === "cheer") { brain.villagersCheer(); ui.confetti(); world.lao.rejoice(); }
      if (msg.action === "villager") brain.spawnAmbient();
      if (msg.action === "dance") brain.dance();
      if (msg.action === "festival") brain.festival([], 15);
      if (msg.action === "sleep") { brain.lastEventAt = 0; }
      break;
  }
}

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (brain) {
    world.update(dt);
    brain.update(dt);
  }
  // gentle camera breathing + festival wide shot
  const t = clock.elapsedTime;
  if (camFx.until && performance.now() > camFx.until) { camFx.target = 0; camFx.until = 0; }
  camFx.amount += (camFx.target - camFx.amount) * Math.min(1, dt * 0.9);
  const a = camFx.amount * camFx.amount * (3 - 2 * camFx.amount); // smoothstep
  const crowdN = brain?.crowd?.members.size || 0;
  camFx.crowdTarget = (crowdN >= 10 ? Math.min(1, (crowdN - 8) / 8) : 0) + Math.min(1.6, Math.max(0, (crowdN - 20) / 60)); // big crowds: further back
  camFx.c = (camFx.c || 0) + ((camFx.crowdTarget || 0) - (camFx.c || 0)) * Math.min(1, dt * 0.35); // slow, no jumps
  const cc = camFx.c * (1 - a);
  camera.position.set(
    camBase.pos.x + Math.sin(t * 0.1) * 0.12 + Math.sin(t * 0.35) * 1.2 * a,
    camBase.pos.y + 2.2 * a + 2.1 * cc,
    camBase.pos.z + 4.2 * a + 0.5 * cc);
  const fov = camBase.fov + 6 * a + 3 * cc;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  _look.copy(LOOK).add({ x: 0, y: 0.1 * a - 0.35 * cc, z: -1.8 * a - 1.7 * cc });
  // donor spotlight (the festival wide shot wins if both happen)
  if (camFx.fTarget && performance.now() > camFx.fUntil) { camFx.fTarget = 0; camFx.fRank = -1; }
  camFx.f += (camFx.fTarget - camFx.f) * Math.min(1, dt * 3.2); // quick glide in / out
  const fp = camFx.fGet?.(_fp);
  if (fp && camFx.f > 0.001) {
    const k = camFx.f * camFx.f * (3 - 2 * camFx.f) * (1 - a);
    // frame the donor together with Lão and Cậu Vàng (they sit at x≈0, z≈0)
    _fcam.set(fp.x * 0.35, fp.y + 1.8, fp.z * 0.5 + camFx.fDist);
    camera.position.lerp(_fcam, k);
    _look.lerp(_fp.set(fp.x * 0.3 - 0.05, 0.7, fp.z * 0.5 - 0.3), k);
    document.body.classList.toggle('spot-on', k > 0.4);
  } else document.body.classList.remove('spot-on');
  camFx.s += (camFx.sTarget - camFx.s) * Math.min(1, dt * (camFx.sTarget ? 2.2 : 3));
  if (camFx.s > 0.001) {
    const k = camFx.s * camFx.s * (3 - 2 * camFx.s);
    camera.position.lerp(camFx.sPos, k);
    _look.lerp(camFx.sLook, k);
  }
  camera.lookAt(_look);
  renderer.render(scene, camera);
  ui.updateLabels(camera, innerWidth, innerHeight);
  requestAnimationFrame(frame);
}
boot().catch((e) => {
  console.error(e);
  document.getElementById("loading").textContent = "Lỗi tải game: " + e.message;
});
frame();

// handy for testing from the console
window.__game = { world, voice, get brain() { return brain; }, barkSfx };
