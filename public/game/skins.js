import * as THREE from "three";
import { skinById } from "./skincatalog.js";

/**
 * Meme costumes (see skincatalog.js), built from simple shapes on the villager's Head / Body nodes so they move
 * with every walk / dance animation. Head node: origin at the neck, the face is around y 0.07–0.44, front = +Z.
 * Body node: origin at the hips, neck at y ≈ 0.44.
 */
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.65, ...o });
const sph = (r, m, w = 16, h = 12) => new THREE.Mesh(new THREE.SphereGeometry(r, w, h), m);
const cone = (r, h, m, s = 12) => new THREE.Mesh(new THREE.ConeGeometry(r, h, s), m);
const box = (x, y, z, m) => new THREE.Mesh(new THREE.BoxGeometry(x, y, z), m);
const cyl = (rt, rb, h, m, s = 16, open = false) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s, 1, open), m);
const at = (o, x, y, z, rx = 0, ry = 0, rz = 0) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };

/** A hood over the head, open at the front so the face shows. */
function hood(color, gap = 1.9, r = 0.255) {
  const m = mat(color, { side: THREE.DoubleSide });
  const g = new THREE.SphereGeometry(r, 24, 16, Math.PI / 2 + gap / 2, Math.PI * 2 - gap, 0, Math.PI * 0.78);
  return at(new THREE.Mesh(g, m), 0, 0.25, -0.01);
}
const eyeball = (x, y, z, r = 0.06) => {
  const g = new THREE.Group();
  g.add(sph(r, mat("#ffffff")));
  g.add(at(sph(r * 0.5, mat("#111111")), 0, 0, r * 0.65));
  return at(g, x, y, z);
};
function cape(color) {
  return at(new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.66), mat(color, { side: THREE.DoubleSide })), 0, 0.1, -0.21, 0.14);
}

/** Each costume: head / body parts, clothes colours, which original head pieces to hide, or hide everything. */
const BUILD = {
  ech: () => ({ shirt: "#3f9b3a", pants: "#2b5e27", hideHat: true,
    head: [hood("#4caf3f"), eyeball(-0.1, 0.48, 0.07), eyeball(0.1, 0.48, 0.07)] }),
  meo: () => {
    const ear = (x) => at(cone(0.07, 0.14, mat("#f08a2c"), 4), x, 0.47, 0.02, 0, 0, x * -2);
    const tail = at(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 16, Math.PI * 1.1), mat("#f08a2c")), 0, 0.05, -0.28, 0, Math.PI / 2, 0);
    return { shirt: "#f08a2c", pants: "#fff3e0", hideHat: true, head: [hood("#f59a3c"), ear(-0.12), ear(0.12)], body: [tail] };
  },
  ga: () => ({ shirt: "#f4f1ea", pants: "#f2c230", hideHat: true,
    head: [hood("#faf7f0"), at(sph(0.05, mat("#d8302a")), 0, 0.52, 0.02), at(sph(0.06, mat("#d8302a")), 0, 0.54, -0.07), at(sph(0.045, mat("#d8302a")), 0, 0.5, -0.15),
      at(cone(0.045, 0.1, mat("#f2a620"), 8), 0, 0.46, 0.22, Math.PI / 2)] }),
  camap: () => {
    const fin = at(cone(0.09, 0.22, mat("#5b7a99"), 3), 0, 0.55, -0.05);
    fin.scale.set(0.35, 1, 1.2);
    const teeth = [];
    for (let i = 0; i < 9; i++) { const a = -0.9 + i * 0.225; teeth.push(at(cone(0.022, 0.05, mat("#ffffff"), 4), Math.sin(a) * 0.2, 0.43 - Math.abs(a) * 0.05, 0.13 + Math.cos(a) * 0.05, Math.PI)); }
    return { shirt: "#5b7a99", pants: "#dfe8ef", hideHat: true, head: [hood("#6b8bab"), fin, ...teeth] };
  },
  capy: () => ({ shirt: "#8d6a45", pants: "#6e5236", hideHat: true,
    head: [hood("#9b7650"), at(sph(0.045, mat("#7a5a3a")), -0.15, 0.45, 0), at(sph(0.045, mat("#7a5a3a")), 0.15, 0.45, 0),
      at(sph(0.08, mat("#ff9d1c")), 0, 0.56, 0), at(cone(0.03, 0.06, mat("#3d8b2f"), 5), 0.02, 0.65, 0, 0, 0, -0.5)] }),
  heo: () => ({ shirt: "#f4a6b8", pants: "#e88aa0", hideHat: true,
    head: [hood("#f6b3c3"), at(cone(0.06, 0.1, mat("#f08aa2"), 4), -0.13, 0.48, 0, 0, 0, 0.5), at(cone(0.06, 0.1, mat("#f08aa2"), 4), 0.13, 0.48, 0, 0, 0, -0.5),
      at(cyl(0.05, 0.05, 0.05, mat("#f08aa2")), 0, 0.47, 0.17, Math.PI / 2)] }),
  ngau: () => {
    const black = mat("#0b0b0b", { roughness: 0.2, metalness: 0.4 });
    const glasses = new THREE.Group();
    glasses.add(at(box(0.11, 0.06, 0.02, black), -0.075, 0, 0), at(box(0.11, 0.06, 0.02, black), 0.075, 0, 0), at(box(0.32, 0.02, 0.02, black), 0, 0.025, 0));
    glasses.add(at(box(0.02, 0.02, 0.2, black), -0.155, 0.025, -0.1), at(box(0.02, 0.02, 0.2, black), 0.155, 0.025, -0.1));
    at(glasses, 0, 0.27, 0.2);
    const gold = mat("#e8c041", { metalness: 0.9, roughness: 0.25, emissive: "#5a4210", emissiveIntensity: 0.3 });
    const chain = at(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.016, 8, 24), gold), 0, 0.38, 0.06, Math.PI / 2 - 0.5);
    const cap = new THREE.Group();
    cap.add(at(sph(0.21, mat("#d23b30"), 16, 8), 0, 0, 0), at(cyl(0.14, 0.14, 0.015, mat("#d23b30")), 0, -0.02, -0.17));
    cap.children[0].scale.y = 0.5;
    at(cap, 0, 0.4, 0);
    return { shirt: "#151515", pants: "#2a2a2a", hideHat: true, head: [glasses, cap], body: [chain] };
  },
  chuoi: () => {
    const tip = at(cone(0.06, 0.24, mat("#f5d33a"), 10), 0.03, 0.6, -0.02, 0, 0, -0.35);
    const stem = at(cyl(0.025, 0.03, 0.06, mat("#5a4220")), 0.08, 0.73, -0.02, 0, 0, -0.5);
    return { shirt: "#f5d33a", pants: "#f0c419", hideHat: true, head: [hood("#f7da45", 1.7, 0.27), tip, stem] };
  },
  dua: () => {
    const leaves = [];
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; leaves.push(at(cone(0.04, 0.26, mat("#3d8b2f"), 4), Math.cos(a) * 0.05, 0.6, Math.sin(a) * 0.05, Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45)); }
    return { shirt: "#d8a433", pants: "#7a5a1e", hideHat: true, head: [hood("#d9a536"), ...leaves] };
  },
  ma: () => {
    const white = mat("#f7f7f2", { side: THREE.DoubleSide, roughness: 0.9 });
    const sheet = at(cyl(0.2, 0.46, 1.1, white, 20, true), 0, 0.0, 0);
    const top = at(sph(0.24, white), 0, 0.27, 0);
    const eye = (x) => at(sph(0.035, mat("#111111")), x, 0.3, 0.22);
    const mouth = at(sph(0.04, mat("#111111")), 0, 0.18, 0.225);
    mouth.scale.set(0.8, 1.3, 0.4);
    return { hideAll: true, body: [sheet], head: [top, eye(-0.07), eye(0.07), mouth] };
  },
  he: () => {
    const afro = [], cols = ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa"];
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; afro.push(at(sph(0.09, mat(cols[i % 6])), Math.cos(a) * 0.19, 0.38 + (i % 2) * 0.08, Math.sin(a) * 0.15 - 0.04)); }
    afro.push(at(sph(0.11, mat(cols[2])), 0, 0.5, -0.03));
    return { shirt: "#8e24aa", pants: "#fdd835", hideHat: true, hideHair: true, head: [...afro, at(sph(0.045, mat("#e53935", { roughness: 0.3 })), 0, 0.24, 0.21)] };
  },
  ninja: () => ({ shirt: "#1b1b1f", pants: "#1b1b1f", hideHat: true,
    head: [hood("#202024", 1.2, 0.255), at(new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.025, 6, 24), mat("#c62828")), 0, 0.37, 0, Math.PI / 2 + 0.1),
      at(box(0.04, 0.16, 0.01, mat("#c62828")), 0.03, 0.3, -0.25, 0.3, 0, 0.4)] }),
  sieunhan: () => {
    const mask = at(box(0.3, 0.06, 0.03, mat("#1e4fb8")), 0, 0.27, 0.19);
    const bolt = at(cone(0.06, 0.12, mat("#fdd835"), 3), 0, 0.3, 0.2, Math.PI / 2);
    return { shirt: "#1e4fb8", pants: "#c62828", hideHat: true, head: [mask], body: [cape("#d32f2f"), bolt] };
  },
  phihanh: () => {
    const glass = at(sph(0.29, mat("#bfe6ff", { transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.1, depthWrite: false })), 0, 0.26, 0);
    const ring = at(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 24), mat("#eeeeee")), 0, 0.04, 0, Math.PI / 2);
    const pack = at(box(0.3, 0.38, 0.14, mat("#e0e0e0")), 0, 0.2, -0.25);
    const flag = at(box(0.06, 0.04, 0.01, mat("#d32f2f")), -0.15, 0.32, 0.2);
    return { shirt: "#f2f2f2", pants: "#e6e6e6", hideHat: true, head: [glass, ring], body: [pack, flag] };
  },
  caoboi: () => {
    const brown = mat("#7b4a26");
    const hat = new THREE.Group();
    hat.add(at(cyl(0.34, 0.34, 0.02, brown, 24), 0, 0, 0), at(cyl(0.15, 0.18, 0.18, brown, 16), 0, 0.09, 0), at(cyl(0.183, 0.183, 0.035, mat("#2b1b10"), 16), 0, 0.03, 0));
    at(hat, 0, 0.44, 0, -0.08);
    const stache = at(box(0.14, 0.03, 0.03, mat("#3b2412")), 0, 0.19, 0.2);
    return { shirt: "#b23a2e", pants: "#2f4f7f", hideHat: true, head: [hat, stache] };
  },
};

/** Put costume `id` on villager v ("" / unknown = plain villager again). */
export function applySkin(v, id) {
  if (!v?.root) return;
  if ((v.skinId || "") === (id || "")) return;
  removeSkin(v);
  const make = BUILD[id];
  if (!make || !skinById(id)) return;
  const s = make();
  const head = v.root.getObjectByName("Head"), body = v.root.getObjectByName("Body");
  const parts = [];
  const changed = [];
  v.root.traverse((o) => {
    if (!o.isMesh || o.userData.skinPart) return;
    const n = o.material?.name || "";
    const inHead = head && isInside(o, head);
    if (s.hideAll || (inHead && ((s.hideHat && (n === "Hat" || n === "Cloth")) || (s.hideHair && (n === "Hair" || n === "Scalp"))))) {
      changed.push([o, "visible", o.visible]); o.visible = false; return;
    }
    if ((s.shirt && n === "Shirt") || (s.pants && n === "Pants")) {
      changed.push([o, "material", o.material]);
      o.material = o.material.clone();
      o.material.color.set(n === "Shirt" ? s.shirt : s.pants);
    }
  });
  const add = (parent, list) => { for (const p of list || []) { if (!parent) continue; p.traverse((o) => { o.userData.skinPart = true; if (o.isMesh) o.castShadow = true; }); parent.add(p); parts.push(p); } };
  add(head, s.head);
  add(body, s.body);
  v.skin = { parts, changed };
  v.skinId = id;
}

export function removeSkin(v) {
  const s = v?.skin;
  if (!s) return;
  for (const p of s.parts) { p.parent?.remove(p); p.traverse((o) => { o.geometry?.dispose(); if (o.isMesh) o.material?.dispose?.(); }); }
  for (const [o, k, val] of s.changed.reverse()) { if (k === "material") o.material.dispose?.(); o[k] = val; }
  v.skin = null;
  v.skinId = "";
}

function isInside(o, parent) {
  for (let p = o.parent; p; p = p.parent) if (p === parent) return true;
  return false;
}
