import * as THREE from "three";

/**
 * Viewer level looks (cumulative). Pieces are attached to the villager's Body / Head nodes,
 * so they move with the walk / dance animations. Body node: origin at the hips, +Y up, +Z front.
 *  2 Dân làng    red neckerchief
 *  3 Trưởng xóm  + gold sash
 *  4 Hương sư    + blue cape
 *  5 Chánh hội   + red cape with gold trim, glowing ring under the feet
 *  6 Tiên chỉ    + floating golden crown, sparkles
 */
export const LEVEL_ICONS = ["", "🌾", "🏡", "🎖️", "📜", "🏮", "👑"];

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...opts });
const GOLD = () => mat("#e8c041", { metalness: 0.8, roughness: 0.3, emissive: "#5a4210", emissiveIntensity: 0.4 });

export function rankLabel(level, title, name) {
  if (!level || level < 2) return "👋 " + name;
  return `${LEVEL_ICONS[Math.min(level, 6)] || "⭐"} ${title} · ${name}`;
}
export function rankClass(level) {
  return "tag lv" + Math.min(Math.max(level || 1, 1), 6);
}

/** Replace the villager's level decoration with the one for `level`. */
export function decorate(v, level, world) {
  undecorate(v, world);
  if (!level || level < 2) return;
  const body = v.root.getObjectByName("Body");
  const head = v.root.getObjectByName("Head");
  if (!body) return;
  const parts = [];
  const add = (parent, mesh) => { parent.add(mesh); parts.push(mesh); return mesh; };

  // 2: red neckerchief with a knot in front
  const scarf = add(body, new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.028, 8, 20), mat(level >= 5 ? "#b8322a" : "#c8402f")));
  scarf.position.set(0, 0.43, 0); scarf.rotation.x = Math.PI / 2;
  const knot = add(body, new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), scarf.material));
  knot.position.set(0, 0.36, 0.13); knot.rotation.x = Math.PI;

  // 3: gold sash across the chest
  if (level >= 3) {
    const sash = add(body, new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.022, 6, 28), GOLD()));
    sash.position.set(0, 0.22, 0); sash.rotation.set(Math.PI / 2, 0.55, 0);
  }
  // 4 / 5: cape (blue, then red with gold trim)
  if (level >= 4) {
    const cape = add(body, new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.62), mat(level >= 5 ? "#9b1c1c" : "#2f4f8f", { side: THREE.DoubleSide })));
    cape.position.set(0, 0.12, -0.2); cape.rotation.x = 0.12;
    if (level >= 5) {
      const trim = add(body, new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.05), GOLD()));
      trim.position.set(0, -0.19, -0.235); trim.rotation.x = 0.12;
      trim.material.side = THREE.DoubleSide;
    }
  }
  const tickers = [];
  // 5: glowing ring under the feet
  if (level >= 5) {
    const ring = add(v.root, new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 32),
      new THREE.MeshBasicMaterial({ color: level >= 6 ? "#ffe27a" : "#ffb347", transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02;
    tickers.push((t) => { ring.material.opacity = 0.4 + Math.sin(t * 3) * 0.15; ring.rotation.z = t * 0.6; });
  }
  // 6: floating crown + sparkles
  if (level >= 6 && head) {
    const crown = new THREE.Group();
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.07, 16, 1, true), GOLD());
    band.material.side = THREE.DoubleSide;
    crown.add(band);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 4), band.material);
      spike.position.set(Math.cos(a) * 0.12, 0.065, Math.sin(a) * 0.12);
      crown.add(spike);
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 4), mat(i % 2 ? "#d23b30" : "#3b8bd2", { emissive: i % 2 ? "#5a0f0a" : "#0f2a5a" }));
      gem.position.set(Math.cos(a) * 0.125, 0, Math.sin(a) * 0.125);
      crown.add(gem);
    }
    add(head, crown);
    crown.position.set(0, 0.62, 0);
    const n = 24;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const sparkles = add(v.root, new THREE.Points(geo, new THREE.PointsMaterial({ color: "#fff1a8", size: 0.06, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })));
    const seeds = Array.from({ length: n }, () => [Math.random() * 6.28, 0.25 + Math.random() * 0.2, Math.random() * 1.8]);
    tickers.push((t) => {
      crown.position.y = 0.62 + Math.sin(t * 2) * 0.03;
      crown.rotation.y = t * 0.8;
      const a = geo.attributes.position.array;
      seeds.forEach(([ph, r, h], i) => {
        const k = t * 0.9 + ph;
        a[i * 3] = Math.cos(k) * r; a[i * 3 + 1] = (h + t * 0.4) % 1.9; a[i * 3 + 2] = Math.sin(k) * r;
      });
      geo.attributes.position.needsUpdate = true;
    });
  }
  for (const p of parts) p.traverse?.((o) => { if (o.isMesh) o.castShadow = true; });
  let t = 0;
  const tick = (dt) => {
    if (v.dead) return undecorate(v, world);
    t += dt;
    for (const f of tickers) f(t);
  };
  if (tickers.length) world.tickers.add(tick);
  v.decor = { parts, tick, level };
}

export function undecorate(v, world) {
  const d = v.decor;
  if (!d) return;
  world.tickers.delete(d.tick);
  for (const p of d.parts) {
    p.parent?.remove(p);
    p.traverse?.((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
  }
  v.decor = null;
}

/** Điểm nhấn for Cậu Vàng: red collar with a little golden bell. */
export function dogCollar(dogRoot) {
  const body = dogRoot.getObjectByName("Body");
  if (!body) return;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.014, 8, 24), mat("#c8302a"));
  collar.position.set(0, 0.335, 0.035);
  collar.rotation.x = Math.PI / 2 - 0.45;
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), GOLD());
  bell.position.set(0, 0.29, 0.1);
  body.add(collar, bell);
}
