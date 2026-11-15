import * as THREE from "three";
import * as ui from "./ui.js";
import * as sfx from "./audio.js";
import { bell } from "./rig.js";
import { sleep, spoken } from "./brain.js";

/**
 * "Quẩy trẩy hội" — the village dance party.
 * The camera pulls far back; viewers (their villagers, costumes and all) line up in rows facing the camera and
 * dance hip-hop moves on the beat. Lão Hạc and Cậu Vàng are the DJs (sunglasses, a DJ desk with spinning records).
 * A rhythm bar runs at the bottom like a dance game: arrows light up each bar, the cursor sweeps over the
 * "beat" mark, and the village scores PERFECT / GREAT / COOL — purely for show (simulated, nobody is judged).
 */
const BPM = 100;
const BEAT = 60 / BPM; // seconds
const ROW = 8; // dancers per row
const MAX_DANCERS = 40;
const SECONDS = 42;
const V = (x, z) => new THREE.Vector3(x, 0, z);

// ---------------------------------------------------------------- dance moves (one bar = 4 beats)
// add(node, prop, axis, value); b = beats since the move began (0..4)
const MOVES = [
  // pump both fists in the air, knees bounce
  (add, b, e, v) => { const k = Math.abs(Math.sin(b * Math.PI)); bounce(add, k * 0.1 * e); armUp(add, v, (1.8 + k * 0.9) * e, (1.8 + (1 - k) * 0.9) * e); add("Head", "rot", "x", -0.15 * k * e); },
  // robot: arms bent forward, sharp turns on each beat
  (add, b, e, v) => { const s = Math.floor(b) % 2 ? 1 : -1; add("Body", "rot", "y", s * 0.45 * e); add("Head", "rot", "y", -s * 0.3 * e);
    if (v.swingL) add("ArmL", "rot", "x", -1.45 * e); if (v.swingR) add("ArmR", "rot", "x", -1.45 * e); },
  // side step with hip sway, clapping above the head
  (add, b, e, v) => { const k = Math.sin(b * Math.PI); add("Body", "rot", "z", k * 0.2 * e); add("Head", "rot", "z", -k * 0.2 * e);
    add("LegL", "rot", "z", Math.max(0, k) * 0.45 * e); add("LegR", "rot", "z", Math.min(0, k) * 0.45 * e);
    const clap = Math.abs(Math.cos(b * Math.PI)); armUp(add, v, (2.6 - clap * 0.35) * e, (2.6 - clap * 0.35) * e); },
  // squat bounce: drop low on every beat, arms swing like a hip-hop crew
  (add, b, e, v) => { const k = Math.abs(Math.sin(b * Math.PI)); bounce(add, -k * 0.13 * e); add("LegL", "rot", "x", -k * 0.6 * e); add("LegR", "rot", "x", -k * 0.6 * e);
    add("Body", "rot", "x", k * 0.25 * e); if (v.swingL) add("ArmL", "rot", "x", Math.sin(b * Math.PI) * 1.1 * e); if (v.swingR) add("ArmR", "rot", "x", -Math.sin(b * Math.PI) * 1.1 * e); },
  // disco: point to the sky and down, hips swing
  (add, b, e, v) => { const s = Math.floor(b) % 2; add("Body", "rot", "z", (s ? 0.18 : -0.18) * e); armUp(add, v, s ? 2.5 * e : 0.3 * e, s ? 0.3 * e : 2.5 * e); add("Head", "rot", "z", (s ? -0.2 : 0.2) * e); },
  // the wave: arms ripple left to right, body follows
  (add, b, e, v, i) => { const ph = b * Math.PI - i * 0.5; const k = Math.sin(ph); armUp(add, v, (1.6 + k * 0.8) * e, (1.6 - k * 0.8) * e); add("Body", "rot", "z", k * 0.15 * e); bounce(add, Math.abs(k) * 0.05 * e); },
  // running man
  (add, b, e, v) => { const k = Math.sin(b * Math.PI); add("LegL", "rot", "x", k * 0.75 * e); add("LegR", "rot", "x", -k * 0.75 * e); bounce(add, Math.abs(k) * 0.06 * e);
    if (v.swingL) add("ArmL", "rot", "x", -k * 1.0 * e); if (v.swingR) add("ArmR", "rot", "x", k * 1.0 * e); },
];
const MOVE_NAMES = ["Giơ tay quẩy", "Robot", "Lắc hông vỗ tay", "Nhún hiphop", "Disco chỉ trời", "Làn sóng", "Chạy tại chỗ"];
function bounce(add, y) { for (const n of ["Body", "LegL", "LegR"]) add(n, "pos", "y", y); }
function armUp(add, v, l, r) { if (v.swingL) add("ArmL", "rot", "z", -l); if (v.swingR) add("ArmR", "rot", "z", r); }

/** The finish move at the end of each 4-bar phrase: a jump and a full spin, arms out. */
function finish(v) {
  const y0 = v.root.rotation.y;
  return v.play(BEAT * 2, (p, add) => {
    const e = bell(p, 0.1, 0.2);
    v.root.rotation.y = y0 + p * Math.PI * 2;
    bounce(add, Math.sin(p * Math.PI) * 0.25);
    armUp(add, v, 1.5 * e, 1.5 * e);
    if (p >= 1) v.root.rotation.y = y0;
  });
}

// ---------------------------------------------------------------- DJ props
const darkGlass = () => new THREE.MeshStandardMaterial({ color: "#060606", roughness: 0.15, metalness: 0.6 });
/** Sunglasses fitted over the Eye meshes of a rig's head. */
function sunglasses(rig, size = 1) {
  const head = rig.root.getObjectByName("Head");
  if (!head) return null;
  head.updateMatrixWorld(true);
  const inv = head.matrixWorld.clone().invert();
  const box = new THREE.Box3();
  head.traverse((o) => { if (o.isMesh && o.material?.name === "Eye") box.union(new THREE.Box3().setFromObject(o)); });
  let c, w;
  if (box.isEmpty()) { c = new THREE.Vector3(0, 0.25, 0.2); w = 0.2; }
  else {
    const local = box.clone().applyMatrix4(inv);
    c = local.getCenter(new THREE.Vector3());
    const sz = local.getSize(new THREE.Vector3());
    w = Math.max(0.12, Math.max(sz.x, sz.z));
  }
  const g = new THREE.Group(), m = darkGlass();
  const lens = (x) => { const l = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55 * size, w * 0.32 * size, 0.015), m); l.position.x = x; return l; };
  g.add(lens(-w * 0.32 * size), lens(w * 0.32 * size));
  const bar = new THREE.Mesh(new THREE.BoxGeometry(w * 1.25 * size, 0.012, 0.012), m); bar.position.y = w * 0.12 * size; g.add(bar);
  g.position.copy(c).add({ x: 0, y: 0, z: 0.03 });
  head.add(g);
  return g;
}
function djDesk() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: "#2b2b33", roughness: 0.5, metalness: 0.3 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 0.42), wood); top.position.y = 0.21; g.add(top);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.3), new THREE.MeshBasicMaterial({ color: "#ff3fa4" }));
  front.position.set(0, 0.22, 0.212); g.add(front);
  const discs = [];
  for (const x of [-0.42, 0.42]) {
    const d = new THREE.Group();
    d.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 24), new THREE.MeshStandardMaterial({ color: "#111", roughness: 0.3 })));
    const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.022, 16), new THREE.MeshStandardMaterial({ color: x < 0 ? "#ffd54a" : "#4fc3f7" }));
    lab.position.x = 0.03; d.add(lab);
    d.position.set(x, 0.44, 0); g.add(d); discs.push(d);
  }
  const lights = [];
  for (let i = 0; i < 6; i++) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: "#00e5ff" }));
    l.position.set(-0.15 + i * 0.06, 0.43, 0.15); g.add(l); lights.push(l);
  }
  return { g, discs, lights, front };
}

// ---------------------------------------------------------------- rhythm bar (HTML overlay)
const ARROWS = ["←", "↑", "→", "↓", "↖", "↗"];
function css() {
  if (document.getElementById("quay-css")) return;
  const s = document.createElement("style");
  s.id = "quay-css";
  s.textContent = `
  #quay{position:fixed;left:50%;bottom:7%;transform:translateX(-50%);width:min(92vw,560px);z-index:40;pointer-events:none;font-family:inherit}
  #quay .arrows{display:flex;justify-content:center;gap:6px;margin-bottom:8px;min-height:44px}
  #quay .ar{width:40px;height:40px;border-radius:10px;display:grid;place-items:center;font-size:24px;font-weight:900;color:#fff;
    background:linear-gradient(#5a3ff0,#2a1a8a);border:2px solid #b9a8ff;box-shadow:0 0 10px #7c5cff;transition:transform .12s,opacity .2s}
  #quay .ar.hit{background:linear-gradient(#ffd54a,#ff8f00);border-color:#fff3b0;box-shadow:0 0 16px #ffc400;transform:scale(1.12)}
  #quay .bar{position:relative;height:18px;border-radius:9px;background:rgba(10,8,30,.75);border:2px solid #9c7bff;overflow:hidden;box-shadow:0 0 14px #6a40ff}
  #quay .zone{position:absolute;top:0;bottom:0;left:76%;width:9%;background:linear-gradient(90deg,transparent,#ff3fa4,transparent)}
  #quay .cur{position:absolute;top:-2px;bottom:-2px;width:6px;border-radius:3px;background:#fff;box-shadow:0 0 10px #fff}
  #quay .meta{display:flex;justify-content:space-between;color:#fff;font-weight:800;font-size:13px;margin-top:5px;text-shadow:0 1px 3px #000}
  #quay .judge{position:absolute;left:50%;top:-74px;transform:translateX(-50%);font-size:34px;font-weight:900;font-style:italic;letter-spacing:1px;
    color:#fff;-webkit-text-stroke:1.5px #6a1b9a;text-shadow:0 0 14px #ff3fa4;opacity:0;transition:opacity .15s}
  #quay .judge.on{opacity:1;animation:qpop .45s}
  @keyframes qpop{0%{transform:translateX(-50%) scale(1.8)}100%{transform:translateX(-50%) scale(1)}}`;
  document.head.appendChild(s);
}
function overlay() {
  css();
  document.getElementById("quay")?.remove();
  const el = document.createElement("div");
  el.id = "quay";
  el.innerHTML = `<div class="judge"></div><div class="arrows"></div><div class="bar"><div class="zone"></div><div class="cur"></div></div>
    <div class="meta"><span class="move">🎧 DJ Lão & DJ Vàng</span><span class="combo"></span><span>♪ ${BPM} BPM</span></div>`;
  document.body.appendChild(el);
  return el;
}

// ---------------------------------------------------------------- the scene
export async function quay(story) {
  const b = story.b, w = story.w, cam = b.camFx;
  b.wake();
  b.voice.clearLow(1);
  // dancers: viewers in the crowd (most recently active first); the rest dance where they stand
  const members = story.pickViewers(MAX_DANCERS);
  for (const m of members) m.busy = true;
  const dancers = members.map((m) => m.v);
  const n = dancers.length;
  // the formation: rows of 8 in front of Lão, facing the camera, front rows filled first
  const slots = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / ROW), inRow = Math.min(ROW, n - r * ROW), c = i % ROW;
    // two blocks, left and right, with an aisle in the middle so the camera always sees the DJs
    const half = Math.ceil(inRow / 2), side = c < half ? -1 : 1, k = side < 0 ? half - 1 - c : c - half;
    slots.push(V(side * (0.62 + k * 0.62) + (r % 2 ? 0.15 : 0), 1.9 + r * 0.7));
  }
  ui.banner("🎧 Quẩy trẩy hội! 🕺", "DJ Lão & DJ Vàng lên nhạc — cả làng vào hàng!", 4000);
  b.sayText("lao", n ? "Bà con ơi! Hôm nay lão với cậu Vàng làm DJ, cả làng ra đây quẩy nào!" : "Lão với cậu Vàng lên nhạc đây! Bà con vào làng quẩy với lão nào!", 3);
  ui.feed(`🎧 <b>Quẩy trẩy hội</b>: ${n} người vào hàng nhảy!`);
  // DJ set-up: desk in front of Lão, sunglasses on both
  const desk = djDesk();
  desk.g.position.set(0.05, 0, 0.62);
  w.scene.add(desk.g);
  const glassesLao = sunglasses(w.lao, 1.1);
  const glassesDog = sunglasses(w.dog, 1.15);
  // camera: far back and high, sees the DJs and every row
  const depth = Math.max(1, Math.ceil(n / ROW));
  cam?.shot(new THREE.Vector3(0, 6.2 + depth * 0.55, 9.6 + depth * 0.7), new THREE.Vector3(0, 0.3, 1.2 + depth * 0.3));
  // walk into place
  await Promise.all(dancers.map((v, i) => { v.speed = Math.max(v.speed, 2.2); return v.walk([slots[i]]); }));
  for (const v of dancers) if (!v.dead) { v.face(v.root.position.x * 0.25, 12); v.root.rotation.y = Math.atan2(-v.root.position.x * 0.05, 1); }
  // music + bar
  const stopBeat = sfx.hiphopBeat(SECONDS, BPM);
  const el = overlay();
  const $ = (s) => el.querySelector(s);
  const start = performance.now();
  let lastBar = -1, combo = 0, alive = true;
  // per-frame: cursor, desk lights, DJs nodding, discs spinning, the crowd behind bouncing
  const tick = (dt) => {
    const t = (performance.now() - start) / 1000;
    const beats = t / BEAT;
    const inBar = (beats % 4) / 4;
    $(".cur").style.left = `calc(${(inBar * 100).toFixed(2)}% - 3px)`;
    for (const d of desk.discs) d.rotation.y += dt * 6;
    desk.lights.forEach((l, i) => l.material.color.setHSL(((beats * 0.25 + i / 6) % 1), 1, 0.55));
    desk.front.material.color.setHSL((beats * 0.05) % 1, 0.9, 0.55);
  };
  w.tickers.add(tick);
  const djNod = () => {
    w.lao.play(BEAT * 4, (p, add, tt) => { const k = Math.abs(Math.sin((tt / BEAT) * Math.PI)); add("Head", "rot", "x", 0.22 * k); add("Upper", "rot", "z", Math.sin((tt / BEAT) * Math.PI) * 0.06);
      add("ArmR", "rot", "x", -0.6 - k * 0.3); add("ArmL", "rot", "x", -0.5); });
    w.dog.play(BEAT * 4, (p, add, tt) => { const k = Math.abs(Math.sin((tt / BEAT) * Math.PI)); add("Head", "rot", "x", 0.3 * k); add("Body", "pos", "y", 0.02 * k); });
    w.dog.wag = 1.8;
  };
  const others = () => [...b.crowd.members.values()].filter((m) => !m.busy && m.v && !m.v.dead).map((m) => m.v);
  const judges = ["PERFECT!", "GREAT!", "PERFECT!", "COOL!", "PERFECT x2!", "GREAT!"];
  let phrase = 0;
  try {
    while (alive && performance.now() - start < SECONDS * 1000) {
      const t = (performance.now() - start) / 1000;
      const bar = Math.floor(t / BEAT / 4);
      if (bar !== lastBar) {
        lastBar = bar;
        const last = bar % 4 === 3; // every 4th bar: the finish move
        // new arrows for this bar (more each phrase)
        const k = Math.min(8, 3 + Math.floor(bar / 2));
        $(".arrows").innerHTML = Array.from({ length: k }, () => `<div class="ar">${ARROWS[(Math.random() * ARROWS.length) | 0]}</div>`).join("");
        // light them up one by one during the first 3 beats ("the village presses the keys")
        [...el.querySelectorAll(".ar")].forEach((a, i) => setTimeout(() => a.classList.add("hit"), ((i + 1) / (k + 1)) * BEAT * 3 * 1000));
        // judge on the beat mark
        setTimeout(() => {
          const j = $(".judge");
          combo++;
          j.textContent = last ? "PERFECT FINISH!" : judges[(Math.random() * judges.length) | 0];
          j.classList.remove("on"); void j.offsetWidth; j.classList.add("on");
          $(".combo").textContent = `🔥 Combo x${combo}`;
          setTimeout(() => j.classList.remove("on"), 700);
          if (last) { ui.confetti(60); b.fx.burst(new THREE.Vector3(0, 1.6, 1.8), { n: 40, colors: ["#ff3fa4", "#ffd54a", "#4fc3f7"], speed: 3, gravity: 1.5, life: 1.2, size: 0.12 }); }
        }, BEAT * 3.05 * 1000);
        // everyone dances this bar's move (rows offset a little so it ripples)
        const mi = last ? -1 : (phrase + Math.floor(bar / 2)) % MOVES.length;
        if (mi >= 0) $(".move").textContent = "🕺 " + MOVE_NAMES[mi];
        dancers.forEach((v, i) => {
          if (v.dead) return;
          v.actions = v.actions.filter((a) => (a.res(), false));
          if (last) return finish(v);
          const mv = MOVES[mi];
          v.play(BEAT * 4, (p, add, tt) => mv(add, tt / BEAT, bell(p, 0.04, 0.04), v, i % ROW));
        });
        for (const v of others()) if (!v.actions.length) Math.random() < 0.7 ? v.dance(BEAT * 4) : v.wave(BEAT * 4);
        djNod();
        if (last) phrase++;
        if (bar === 2) b.sayText("lao", "Lên nhạc! Cậu Vàng, quẩy lên con!", 2);
        if (bar === 7 && members[0]) b.sayText("lao", `${spoken(members[0].user.name)} nhảy đẹp quá! Cả làng vỗ tay nào!`, 2);
      }
      await sleep(50);
    }
  } finally {
    stopBeat?.();
    w.tickers.delete(tick);
    el.remove();
    ui.banner("🏆 Cả làng quẩy xuất sắc!", `Combo x${combo} — cảm ơn bà con!`, 3500);
    b.sayText("lao", "Ha ha! Lâu lắm rồi lão mới vui thế này! Cảm ơn bà con đã quẩy với lão và cậu Vàng!", 2);
    cam?.clearShot();
    await sleep(1500);
    w.scene.remove(desk.g);
    desk.g.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
    glassesLao?.parent?.remove(glassesLao);
    glassesDog?.parent?.remove(glassesDog);
    for (const m of members) {
      if (b.crowd.get(m.user.id) === m && !m.v.dead) b.crowd.returnToSpot(m);
      else m.busy = false;
    }
  }
}
