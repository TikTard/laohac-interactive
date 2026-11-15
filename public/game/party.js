import * as THREE from "three";
import * as ui from "./ui.js";

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const BALL = V3(0, 2.75, -1.6); // disco ball hangs above and just behind Lão
// moving heads on the left / right / back of the "dance floor"
const HEADS = [V3(-4.4, 5.4, -0.6), V3(4.4, 5.4, -0.6), V3(-2.4, 6, -4.4), V3(2.4, 6, -4.4)]; // beside / behind the crowd, never between camera and stage

/**
 * DJ bar mode while Cậu Vàng dances: the sky goes dark, coloured moving-head spotlights sweep the village,
 * a mirror ball spins and throws rainbow dots everywhere. Anyone who interacts during the party gets a beam
 * on their villager plus a shout-out tag. Everything is created once and only shown / hidden afterwards.
 * No real THREE lights: adding / removing lights makes three.js recompile every material (a ~0.5–1 s freeze
 * with a big crowd), so the beams, floor pools and the glowing ball are all unlit additive meshes.
 */
export class Party {
  constructor(world, brain) {
    this.w = world;
    this.b = brain;
    this.s = world.scene;
    this.on = false;
    this.k = 0; // 0 = day, 1 = full party night
    this.built = false;
    this.focusQ = [];
    this.lastFocus = 0;
    world.tickers.add((dt) => this.tick(dt));
  }

  build() {
    if (this.built) return;
    this.built = true;
    const s = this.s;
    this.root = new THREE.Group();
    this.root.visible = false;
    s.add(this.root);

    // night dome: a dark sphere around everything, faded in (the sky texture stays untouched)
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(48, 24, 16),
      new THREE.MeshBasicMaterial({ color: "#0b0820", side: THREE.BackSide, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.dome.renderOrder = -1;
    this.root.add(this.dome);
    this.fogDay = s.fog?.color.clone();
    this.fogNight = new THREE.Color("#140f2a");

    // mirror ball on a string
    const ballGeo = new THREE.IcosahedronGeometry(0.32, 2);
    this.ball = new THREE.Mesh(ballGeo, new THREE.MeshStandardMaterial({ color: "#d8dde6", metalness: 1, roughness: 0.18, flatShading: true,
      emissive: "#222233", emissiveIntensity: 0.6 }));
    this.ball.position.copy(BALL);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 3), new THREE.MeshBasicMaterial({ color: "#222" }));
    string.position.copy(BALL).add({ x: 0, y: 1.8, z: 0 });
    this.root.add(this.ball, string);

    // rainbow reflections: dots on a big sphere around the ball, spun with it (additive, cheap)
    const N = 260, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const d = 3.5 + Math.random() * 5;
      // mostly downwards (onto the ground and the crowd), some up into the trees / gate
      const y = -Math.abs(u) * (Math.random() < 0.8 ? 1 : -1);
      pos.set([r * Math.cos(a) * d, y * d * 0.9, r * Math.sin(a) * d], i * 3);
      c.setHSL(i / N, 1, 0.6);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const dc = document.createElement("canvas");
    dc.width = dc.height = 32;
    const dx = dc.getContext("2d"), grd = dx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.45, "rgba(255,255,255,0.7)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    dx.fillStyle = grd; dx.fillRect(0, 0, 32, 32);
    this.dots = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.16, map: new THREE.CanvasTexture(dc), alphaTest: 0.01, vertexColors: true, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.dots.position.copy(BALL);
    this.root.add(this.dots);

    // moving heads: a visible beam cone + a pool of light on the ground each (aim / colour kept on a plain object)
    this.heads = HEADS.map((p, i) => {
      const light = { color: new THREE.Color("#ffffff"), angle: 0.28 };
      const target = new THREE.Object3D();
      const len = 1;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.62, len, 24, 1, true),
        new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
          depthWrite: false, side: THREE.DoubleSide, fog: false }));
      cone.geometry.translate(0, -len / 2, 0); // apex at the lamp
      const pool = new THREE.Mesh(new THREE.CircleGeometry(0.7, 28),
        new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2;
      this.root.add(cone, pool);
      return { light, target, cone, pool, at: p, phase: i * 1.7, hue: i / HEADS.length, follow: null, until: 0 };
    });
  }

  /** Lights down, party on. */
  start() {
    this.build();
    this.on = true;
    this.root.visible = true;
    this.focusQ = [];
    ui.banner("🪩 DJ Vàng lên sóng! 🎧", "Bình luận, thả tim để được chiếu đèn!", 3500);
  }
  stop() {
    this.on = false;
    for (const h of this.heads || []) { h.follow = null; this.untag(h); }
  }

  /**
   * Someone interacted: point a beam at their villager for a few seconds and tag them.
   * Busy parties: one new focus every 0.7 s, the newest people first.
   */
  focus(user, what = "") {
    if (!this.on || !user?.id) return;
    const v = this.b.crowd.get(user.id)?.v || this.b.byUser.get(user.id);
    if (!v || v.dead) return;
    this.focusQ = this.focusQ.filter((q) => q.user.id !== user.id);
    this.focusQ.push({ user, v, what });
    if (this.focusQ.length > 8) this.focusQ.shift();
  }

  tag(h, name, what) {
    const v = h.follow;
    h.tagKey = "dj-" + v.id;
    ui.label(h.tagKey, `🎤 ${ui.esc(name)}${what ? " · " + ui.esc(what) : ""}`, "tag lv6",
      (o) => (v.dead ? null : o.copy(v.root.position).add({ x: 0, y: v.height + 0.75, z: 0 })), 3200);
  }
  untag(h) { if (h.tagKey) ui.unlabel(h.tagKey); h.tagKey = null; }

  tick(dt) {
    if (!this.built) return;
    const kT = this.on ? 1 : 0;
    this.k += (kT - this.k) * Math.min(1, dt * (this.on ? 1.8 : 1.2));
    if (!this.on && this.k < 0.01) {
      if (this.root.visible) { this.k = 0; this.apply(0); this.root.visible = false; }
      return;
    }
    this.apply(this.k);
    const t = performance.now() / 1000;

    // ball + reflections
    this.ball.rotation.y += dt * 0.9;
    this.dots.rotation.y += dt * 0.35;
    this.dots.material.opacity = 0.95 * this.k;
    this.ball.material.emissive.setHSL((t * 0.25) % 1, 0.8, 0.35 * this.k);

    // next shout-out: the free (or longest-running) beam swings onto them
    const now = performance.now();
    if (this.on && this.focusQ.length && now - this.lastFocus > 700) {
      const q = this.focusQ.pop();
      if (!q.v.dead) {
        const h = this.heads.find((x) => !x.follow) || this.heads.reduce((a, x) => (x.until < a.until ? x : a));
        if (h.follow) this.untag(h);
        h.follow = q.v;
        h.until = now + 3200;
        this.tag(h, q.user.name, q.what);
        this.b.fx.burst(q.v.root.position.clone().add({ x: 0, y: q.v.height + 0.3, z: 0 }),
          { n: 24, colors: ["#ff4fd8", "#4fd8ff", "#ffe14f", "#7dff6a"], speed: 1.8, gravity: 1.5, life: 1.1, size: 0.08 });
        this.lastFocus = now;
      }
    }

    for (const h of this.heads) {
      if (h.follow && (h.follow.dead || now > h.until)) { this.untag(h); h.follow = null; }
      let x, z, col;
      if (h.follow) {
        const p = h.follow.root.position;
        x = p.x; z = p.z;
        col = "#fff3c4"; // warm white = "you're on stage"
      } else {
        const ph = t * 0.7 + h.phase; // lazy figure-of-eight sweeps across the yard
        x = Math.sin(ph) * 3.2;
        z = -1.2 + Math.sin(ph * 1.6) * 2.2;
        col = null;
      }
      // smooth swing towards the aim point
      const tg = h.target.position;
      const ease = Math.min(1, dt * (h.follow ? 6 : 3));
      tg.x += (x - tg.x) * ease; tg.z += (z - tg.z) * ease; tg.y = 0;
      if (col) h.light.color.set(col); else h.light.color.setHSL((h.hue + t * 0.12) % 1, 1, 0.55);
      h.light.angle = h.follow ? 0.2 : 0.28;
      // beam cone from the lamp to the ground
      const dir = tg.clone().sub(h.at);
      const len = dir.length();
      h.cone.position.copy(h.at);
      h.cone.quaternion.setFromUnitVectors(V3(0, -1, 0), dir.normalize());
      const w = Math.tan(h.light.angle) * len / 0.62;
      h.cone.scale.set(w, len, w);
      h.cone.material.color.copy(h.light.color);
      h.cone.material.opacity = (h.follow ? 0.13 : 0.06) * this.k;
      h.pool.position.set(tg.x, 0.025, tg.z);
      h.pool.scale.setScalar(Math.tan(h.light.angle) * len / 0.7);
      h.pool.material.color.copy(h.light.color);
      h.pool.material.opacity = (h.follow ? 0.32 : 0.16) * this.k;
    }
  }

  /** Night amount 0..1: darker sun / sky light, dark dome and fog. */
  apply(k) {
    this.b.fx.night = k;
    this.dome.material.opacity = 0.93 * k;
    if (this.s.fog && this.fogDay) this.s.fog.color.copy(this.fogDay).lerp(this.fogNight, k);
  }
}
