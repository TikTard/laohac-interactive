import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { LaoHac, Dog, Villager, DogDancer, Chicken, Beast } from "./rig.js";
import { dogCollar } from "./ranks.js";

// ------------------------------------------------------------------ asset loading
const loader = new GLTFLoader();
const cache = {};
export function load(name) {
  return (cache[name] ||= loader.loadAsync(`/models/${name}.glb`).then((g) => {
    g.scene.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
    return g.scene;
  }));
}
async function inst(name) { return (await load(name)).clone(true); }
async function part(file, nodeName) {
  const n = (await load(file)).getObjectByName(nodeName).clone(true);
  n.position.set(0, 0, 0);
  return n;
}

const V = (x, z) => new THREE.Vector3(x, 0, z);

// ------------------------------------------------------------------ layout (Y up, Lão faces +Z towards camera)
export const SPOTS = {
  lao: V(0, 0),
  dog: V(-0.72, 0.12),
  junction: V(0, -2.2),
  gate: V(0, -13),
  left: V(-9, -2.2),
  right: V(9, -2.2),
  donor: V(0.95, 0.45),
  donor2: V(1.25, -0.35),
  donorDog: V(-1.1, 0.8),
};
const LANE_Z = -2.2;

function isDirt(x, z) {
  if (Math.abs(z - LANE_Z) < 1.3) return true;
  if (Math.abs(x) < 1.4 && z < LANE_Z && z > -14) return true;
  if ((x / 3.2) ** 2 + ((z - 0.3) / 2.4) ** 2 < 1) return true;
  return false;
}

function groundTexture() {
  const S = 1024, W = 64;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d");
  const px = (x) => ((x + W / 2) / W) * S;
  g.fillStyle = "#86a04f";
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = ["#7a9446", "#93ad59", "#6f8a3f", "#9db863"][i % 4];
    g.globalAlpha = 0.5;
    g.beginPath();
    g.arc(Math.random() * S, Math.random() * S, 1 + Math.random() * 4, 0, 7);
    g.fill();
  }
  g.globalAlpha = 1;
  const dirt = document.createElement("canvas");
  dirt.width = dirt.height = S;
  const d = dirt.getContext("2d");
  d.fillStyle = "#b8956a";
  d.fillRect(0, px(LANE_Z - 1.25), S, (2.5 / W) * S);
  d.fillRect(px(-1.35), px(-15), (2.7 / W) * S, px(LANE_Z) - px(-15));
  d.beginPath();
  d.ellipse(px(0), px(0.3), (3.2 / W) * S, (2.4 / W) * S, 0, 0, 7);
  d.fill();
  d.beginPath();
  d.ellipse(px(0), px(-14), (3.5 / W) * S, (1.6 / W) * S, 0, 0, 7);
  d.fill();
  g.filter = "blur(5px)";
  g.drawImage(dirt, 0, 0);
  g.filter = "none";
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const wx = (x / S) * W - W / 2, wz = (y / S) * W - W / 2;
    if (!isDirt(wx, wz)) continue;
    g.fillStyle = ["#a7835a", "#c4a479", "#9c7a52"][i % 3];
    g.globalAlpha = 0.6;
    g.beginPath();
    g.arc(x, y, 0.8 + Math.random() * 2.2, 0, 7);
    g.fill();
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function skyTexture() {
  const c = document.createElement("canvas");
  c.width = 4; c.height = 256;
  const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, "#8fb8d8");
  gr.addColorStop(0.45, "#e9d6b0");
  gr.addColorStop(1, "#f4c48a");
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function plaqueTexture(text) {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 268;
  const g = c.getContext("2d");
  g.fillStyle = "#efe2bd";
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "#8c3d14";
  g.lineWidth = 14;
  g.strokeRect(18, 18, c.width - 36, c.height - 36);
  g.fillStyle = "#7a1f12";
  let size = 140;
  g.font = `700 ${size}px "Noto Serif", serif`;
  while (g.measureText(text).width > c.width - 110 && size > 40) {
    size -= 6;
    g.font = `700 ${size}px "Noto Serif", serif`;
  }
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, c.width / 2, c.height / 2 + 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false; // glTF UV convention
  return t;
}

// ------------------------------------------------------------------ villagers
export const VARIANTS = [
  { file: "villager_man_nonla", speed: 1.15 },
  { file: "villager_woman_ganh", speed: 1.0, swingR: false },
  { file: "villager_old_woman", speed: 0.7 },
  { file: "villager_child", speed: 1.5, scale: 0.7, head: 1.15 },
  { file: "villager_young_man", speed: 1.25 },
  { file: "villager_girl", speed: 1.05, swingL: false },
  // funny / ragged villagers: tóc moi, one braid, torn clothes
  { file: "villager_cu_moi", speed: 1.3 },
  { file: "villager_chang_bim", speed: 1.15 },
  { file: "villager_ong_rach", speed: 0.75 },
  { file: "villager_co_bim", speed: 1.1, noTint: true },
];
/** Villagers who walk with an animal (see Brain.spawnProcession). */
export const HERDERS = {
  buffalo: { file: "villager_dat_trau", speed: 0.85, swingR: false },
  pig: { file: "villager_om_heo", speed: 0.95, swingL: false, swingR: false },
  duck: { file: "villager_chan_vit", speed: 0.9, swingR: false, scale: 0.75, head: 1.1 },
};
export const ANIMALS = ["buffalo", "pig_pink", "pig_spot", "duck_white", "duck_brown"];
/** Story characters (built in blender/characters.py) */
export const CHARS = {
  quan: { file: "villager_quan_huyen", speed: 0.85 },
  linhGiao: { file: "villager_linh_giao", speed: 1.1, swingR: false },
  linhLong: { file: "villager_linh_long", speed: 0.85, swingR: false },
  ly: { file: "villager_ly_truong", speed: 1.0, swingL: false },
  binh: { file: "villager_binh_tu", speed: 0.6 },
  giao: { file: "villager_ong_giao", speed: 1.0, swingL: false },
  child: VARIANTS[3],
};
const SHIRTS = ["#6b4a33", "#4a3a2c", "#3f6e8c", "#8c3b2e", "#5c6b4a", "#7a5636", "#2f3f5c", "#e8e1cf", "#9a7b4f"];

export class World {
  constructor(scene) {
    this.scene = scene;
    this.villagers = [];
    this.beasts = [];
    this.bowlItems = [];
    this.matItems = [];
    this.matSlot = 0;
  }

  async build(config) {
    const s = this.scene;
    s.background = skyTexture();
    s.fog = new THREE.Fog("#ead8b4", 22, 55);

    const hemi = new THREE.HemisphereLight("#fff2d8", "#6b5a3a", 1.4);
    s.add(hemi);
    const sun = new THREE.DirectionalLight("#ffd9a3", 2.6);
    sun.position.set(-9, 14, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 50 });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    s.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(64, 64),
      new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    s.add(ground);

    const place = async (name, x, z, ry = 0, sc = 1) => {
      const o = await inst(name);
      o.position.set(x, 0, z);
      o.rotation.y = ry;
      o.scale.setScalar(sc);
      s.add(o);
      return o;
    };

    const jobs = [];
    // village gate + plaque text
    jobs.push(place("gate", 0, -13).then((g) => {
      this.gate = g;
      this.setPlaque(config.game.plaque);
    }));
    // lũy tre làng: bamboo hedge behind the village, gap at the gate
    for (let i = 0; i < 14; i++) {
      const x = -24 + i * 3.6 + (Math.random() - 0.5);
      if (Math.abs(x) < 3.6) continue;
      jobs.push(place(i % 2 ? "bamboo_a" : "bamboo_b", x, -14 + (Math.random() - 0.5) * 1.5, Math.random() * 6, 0.9 + Math.random() * 0.35));
    }
    for (const [x, z, n] of [[-4.6, -12.2, "bamboo_a"], [4.8, -12.6, "bamboo_b"], [-11, -6, "bamboo_a"], [11.5, -7, "bamboo_a"],
      [-6.8, 1.5, "bamboo_b"], [7.2, 0.8, "bamboo_a"], [-13, 2, "bamboo_a"], [13, -1, "bamboo_b"]]) {
      jobs.push(place(n, x, z, Math.random() * 6, 0.9 + Math.random() * 0.3));
    }
    jobs.push(place("banyan", -3.6, -4.6, 0.4, 1.0));
    jobs.push(place("house_thatch", -6.6, -7.6, 0.45));
    jobs.push(place("house_tile", 7.4, -8.2, -0.5));
    jobs.push(place("house_thatch", 9.6, -3.4, -1.25, 0.95));
    jobs.push(place("house_tile", -10.2, -2.8, 1.3, 0.95));
    jobs.push(place("well", 3.6, -5.2, 0.3));
    jobs.push(place("haystack", -5.4, -4.4, 0, 0.9));
    jobs.push(place("haystack", 11.5, -9.5, 0, 1.1));
    for (const [x, z, r] of [[-4.2, -3.75, 0], [-7.4, -3.75, 0], [4.4, -3.75, 0], [7.6, -3.75, 0], [-4.2, -0.65, 0], [4.6, -0.65, 0],
      [-2.0, -9.5, Math.PI / 2], [2.0, -9.5, Math.PI / 2]]) {
      jobs.push(place("fence", x, z, r));
    }
    // scatter grass, flowers, rocks
    const props = await load("props");
    const scatter = (nodeName, n, minR = 2.5) => {
      const src = props.getObjectByName(nodeName);
      for (let i = 0; i < n; i++) {
        const x = (Math.random() - 0.5) * 30, z = -15 + Math.random() * 17.5; // keep clear of the camera
        if (isDirt(x, z) || Math.hypot(x, z) < minR) { i--; continue; }
        const o = src.clone(true);
        o.position.set(x, 0, z);
        o.rotation.y = Math.random() * 6;
        o.scale.setScalar(0.7 + Math.random() * 0.8);
        s.add(o);
      }
    };
    scatter("GrassTuft", 140);
    scatter("Flowers", 30);
    scatter("Rock", 14);
    const chum = props.getObjectByName("Chum").clone(true);
    chum.position.set(2.45, 0, 0.35); // out of the crowd area behind Lão
    s.add(chum);
    const thung = props.getObjectByName("Thung").clone(true);
    thung.position.set(-2.4, 0, 0.45);
    thung.scale.setScalar(0.8);
    s.add(thung);

    // the stars
    const laoRoot = await inst("lao_hac");
    laoRoot.position.copy(SPOTS.lao);
    s.add(laoRoot);
    this.lao = new LaoHac(laoRoot);
    {
      // the story model has a begging bowl; on stream it is a festive tray, gifts are "for the village festival"
      const bowl = laoRoot.getObjectByName("Bowl");
      if (bowl) {
        bowl.traverse((o) => { if (o.isMesh) o.visible = false; });
        const tray = new THREE.Group();
        const red = new THREE.MeshStandardMaterial({ color: "#a8231c", roughness: 0.45 });
        const gold = new THREE.MeshStandardMaterial({ color: "#e8c041", metalness: 0.7, roughness: 0.3 });
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.035, 24), red);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 28), gold);
        rim.rotation.x = Math.PI / 2; rim.position.y = 0.018;
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.05, 16), red);
        foot.position.y = -0.04;
        tray.add(top, rim, foot);
        const s = 1 / (bowl.getWorldScale(new THREE.Vector3()).x || 1);
        tray.scale.setScalar(s);
        bowl.add(tray);
      }
    }

    const dogRoot = await inst("cau_vang");
    dogRoot.position.copy(SPOTS.dog);
    dogRoot.rotation.y = 0.35;
    dogRoot.scale.setScalar(1.25);
    s.add(dogRoot);
    dogCollar(dogRoot);
    this.dog = new Dog(dogRoot);
    this.dogHome = dogRoot.position.clone();

    const danceRoot = await inst("cau_vang_dance");
    danceRoot.position.copy(SPOTS.dog);
    danceRoot.rotation.y = 0.2;
    danceRoot.scale.setScalar(1.35);
    danceRoot.visible = false;
    s.add(danceRoot);
    this.dancer = new DogDancer(danceRoot);

    this.chickens = [];
    const area = { minX: -3.4, maxX: 3.4, minZ: -1.4, maxZ: 2.4, avoid: [{ x: 0, z: 0.25, r: 1.05 }, { x: -0.72, z: 0.12, r: 0.5 }] };
    for (let i = 0; i < (config.game.chickens ?? 5); i++) {
      const c = await inst(i % 3 === 0 ? "chicken_rooster" : "chicken_hen");
      const ch = new Chicken(c, area);
      ch.rooster = i % 3 === 0;
      c.position.copy(ch.pickTarget());
      c.rotation.y = Math.random() * 6;
      c.scale.setScalar(0.95 + Math.random() * 0.2);
      s.add(c);
      this.chickens.push(ch);
    }

    await Promise.all(jobs);
    await Promise.all([...VARIANTS, ...Object.values(CHARS), ...Object.values(HERDERS)].map((v) => load(v.file)));
    await Promise.all(ANIMALS.map((a) => load(a).catch(() => null)));
    await load("items");
  }

  setPlaque(text) {
    const p = this.gate?.getObjectByName("Plaque");
    if (!p) return;
    const apply = () => p.traverse((o) => {
      if (o.isMesh) o.material = new THREE.MeshStandardMaterial({ map: plaqueTexture(text || "CỔNG LÀNG"), roughness: 0.8 });
    });
    apply();
    document.fonts?.load('700 100px "Noto Serif"', text).then(apply, () => {});
  }

  // ---------------------------------------------------------------- villagers
  async spawnVillager(opts = {}) {
    const v = opts.variant ?? VARIANTS[(Math.random() * VARIANTS.length) | 0];
    const root = await inst(v.file);
    root.traverse((o) => {
      if (o.isMesh && !opts.noTint && !v.noTint && o.material?.name === "Shirt" && v.file !== "villager_woman_ganh" && Math.random() < 0.6) {
        o.material = o.material.clone();
        o.material.color.set(SHIRTS[(Math.random() * SHIRTS.length) | 0]);
      }
    });
    if (v.scale) root.scale.setScalar(v.scale);
    if (v.head) root.getObjectByName("Head")?.scale.setScalar(v.head);
    root.position.copy(opts.at || SPOTS.left);
    this.scene.add(root);
    const vil = new Villager(root, { speed: (opts.speedMul || 1) * v.speed * (0.9 + Math.random() * 0.2), swingR: v.swingR, swingL: v.swingL, ...opts });
    vil.height = 1.75 * (v.scale || 1);
    vil.ambient = !!opts.ambient;
    this.villagers.push(vil);
    return vil;
  }

  /** An animal walking with `leader` (offset dx / dz in the leader's frame). */
  async spawnBeast(file, leader, opts = {}) {
    const root = await inst(file);
    if (opts.scale) root.scale.setScalar(opts.scale);
    const lp = leader.root.position, yaw = leader.root.rotation.y;
    const dz = opts.dz ?? -1.2, dx = opts.dx || 0;
    root.position.set(lp.x + Math.sin(yaw) * dz + Math.cos(yaw) * dx, 0, lp.z + Math.cos(yaw) * dz - Math.sin(yaw) * dx);
    root.rotation.y = yaw;
    this.scene.add(root);
    const b = new Beast(root, { leader, ...opts });
    this.beasts.push(b);
    return b;
  }
  removeBeast(b) {
    b.dead = true;
    this.scene.remove(b.root);
    this.beasts = this.beasts.filter((x) => x !== b);
  }

  remove(vil) {
    vil.dead = true;
    this.scene.remove(vil.root);
    this.villagers = this.villagers.filter((x) => x !== vil);
  }

  /** A path that goes from one edge of the village to another, through the junction. */
  crossingPath(lane = 0) {
    const ends = ["left", "right", "gate"];
    const a = ends[(Math.random() * 3) | 0];
    let b = ends[(Math.random() * 3) | 0];
    if (b === a) b = a === "left" ? "right" : "left";
    const off = (p) => p.clone().add(V(0, lane));
    const j = off(SPOTS.junction).add(V((Math.random() - 0.5) * 0.6, 0));
    return { start: off(SPOTS[a]), points: [j, off(SPOTS[b])] };
  }

  // ---------------------------------------------------------------- gift items
  async throwItem(itemName, from, to, dur = 0.75) {
    const it = await part("items", itemName);
    it.scale.setScalar(itemName === "Gao" ? 1.3 : 1.6);
    it.position.copy(from);
    this.scene.add(it);
    const start = from.clone();
    const spin = (Math.random() - 0.5) * 8;
    await new Promise((res) => {
      let t = 0;
      const step = (dt) => {
        t += dt;
        const p = Math.min(1, t / dur);
        it.position.lerpVectors(start, to, p);
        it.position.y += Math.sin(p * Math.PI) * 0.55;
        it.rotation.y = spin * p;
        if (p >= 1) { this.tickers.delete(step); res(); }
      };
      this.tickers.add(step);
    });
    return it;
  }

  bowlTarget() {
    const p = this.lao.worldPos("Bowl").clone();
    p.x += (Math.random() - 0.5) * 0.08;
    p.z += (Math.random() - 0.5) * 0.08;
    p.y += 0.07 + Math.min(this.bowlItems.length, 6) * 0.012;
    return p;
  }

  keepInBowl(it) {
    this.bowlItems.push(it);
    while (this.bowlItems.length > 7) this.scene.remove(this.bowlItems.shift());
  }

  matTarget() {
    const slots = [V(0.42, 0.62), V(-0.38, 0.66), V(0.62, 0.32), V(0.25, 0.85), V(-0.15, 0.9), V(0.75, 0.6)];
    const p = slots[this.matSlot % slots.length].clone();
    p.y = 0.02;
    return p;
  }
  keepOnMat(it) {
    const idx = this.matSlot % 6;
    if (this.matItems[idx]) this.scene.remove(this.matItems[idx]);
    this.matItems[idx] = it;
    this.matSlot++;
  }

  /** Remove (and return world positions of) everything lying in the bowl / on the mat. */
  takeItems() {
    const out = [];
    for (const it of [...this.bowlItems, ...this.matItems]) {
      if (!it || !it.parent) continue;
      out.push(it);
    }
    this.bowlItems = [];
    this.matItems = [];
    return out;
  }

  dogTarget() {
    const d = this.dog.root;
    return new THREE.Vector3(d.position.x + Math.sin(d.rotation.y) * 0.35, 0.02, d.position.z + Math.cos(d.rotation.y) * 0.35);
  }

  tickers = new Set();
  update(dt) {
    for (const f of [...this.tickers]) f(dt);
    this.lao.update(dt);
    this.dog.update(dt);
    this.dancer.update(dt);
    for (const c of this.chickens) c.tick(dt);
    for (const v of [...this.villagers]) v.tick(dt);
    for (const b of this.beasts) b.tick(dt);
  }
}
