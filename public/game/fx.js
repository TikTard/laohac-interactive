import * as THREE from "three";
import * as sfx from "./audio.js";

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);

/**
 * Visual effects that live in the 3D scene: donor spotlight, firecrackers, fireworks,
 * rain + rainbow, butterflies. Everything is pooled / short-lived to stay cheap on busy lives.
 */
export class Fx {
  constructor(world) {
    this.w = world;
    this.s = world.scene;
    this.active = 0; // running particle systems (capped)
    this.hemi = null;
    this.sun = null;
    this.s.traverse((o) => {
      if (o.isHemisphereLight) this.hemi = o;
      if (o.isDirectionalLight) this.sun = o;
    });
    this.base = { hemi: this.hemi?.intensity ?? 1.4, sun: this.sun?.intensity ?? 2.6, fog: this.s.fog?.color.clone() };
    this.dim = 0; // 0 = normal light, 1 = dark (rain / spotlight)
    this.dimTarget = 0;
    this.spot = null;
    this.raining = null;
    world.tickers.add((dt) => this.tick(dt));
  }

  tick(dt) {
    this.dim += (this.dimTarget - this.dim) * Math.min(1, dt * 1.5);
    const n = this.night || 0; // DJ party: lights down (set by party.js)
    if (this.hemi) this.hemi.intensity = this.base.hemi * (1 - 0.45 * this.dim) * (1 - 0.8 * n);
    if (this.sun) this.sun.intensity = this.base.sun * (1 - 0.6 * this.dim) * (1 - 0.92 * n);
  }

  // ------------------------------------------------------------------ spotlight on a donor
  /** A warm stage light that follows `obj` for `seconds`; the rest of the village dims a little. */
  spotlight(obj, seconds = 5) {
    this.clearSpot();
    const light = new THREE.SpotLight("#ffe2a8", 60, 9, 0.32, 0.6, 1.2);
    light.castShadow = false;
    const target = new THREE.Object3D();
    this.s.add(light, target);
    light.target = target;
    // glowing circle on the ground
    const ring = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 32),
      new THREE.MeshBasicMaterial({ color: "#ffe9b0", transparent: true, opacity: 0.35, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    this.s.add(ring);
    this.dimTarget = Math.max(this.dimTarget, 0.55);
    let t = 0;
    const follow = (dt) => {
      t += dt;
      const p = obj.position;
      light.position.set(p.x + 0.4, 5.5, p.z + 1.6);
      target.position.set(p.x, 0.8, p.z);
      ring.position.set(p.x, 0.02, p.z);
      ring.material.opacity = 0.3 + Math.sin(t * 4) * 0.08;
      if (t > seconds) this.clearSpot();
    };
    this.spot = { light, target, ring, follow };
    this.w.tickers.add(follow);
  }
  clearSpot() {
    if (!this.spot) return;
    const { light, target, ring, follow } = this.spot;
    this.w.tickers.delete(follow);
    this.s.remove(light, target, ring);
    ring.geometry.dispose();
    ring.material.dispose();
    this.spot = null;
    if (!this.raining) this.dimTarget = 0;
  }

  // ------------------------------------------------------------------ particles
  burst(pos, { n = 60, colors = ["#ffd54a", "#ff6b5a", "#7ee0ff"], speed = 3, gravity = 2.5, life = 1.6, size = 0.12 } = {}) {
    if (this.active > 14) return; // hard cap on busy lives
    this.active++;
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3), c = new Float32Array(n * 3), vel = [];
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      p.set([pos.x, pos.y, pos.z], i * 3);
      const dir = V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.6, 1));
      vel.push(dir);
      col.set(colors[i % colors.length]);
      c.set([col.r, col.g, col.b], i * 3);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(p, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(c, 3));
    const mat = new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(geo, mat);
    this.s.add(pts);
    let t = 0;
    const step = (dt) => {
      t += dt;
      const a = geo.attributes.position.array;
      for (let i = 0; i < n; i++) {
        const v = vel[i];
        v.y -= gravity * dt;
        v.multiplyScalar(1 - dt * 0.8);
        a[i * 3] += v.x * dt; a[i * 3 + 1] += v.y * dt; a[i * 3 + 2] += v.z * dt;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = Math.max(0, 1 - t / life);
      if (t >= life) {
        this.w.tickers.delete(step);
        this.s.remove(pts);
        geo.dispose(); mat.dispose();
        this.active--;
      }
    };
    this.w.tickers.add(step);
  }

  /** Pháo: a string of red firecrackers popping on the ground near `pos`. */
  firecrackers(pos, count = 10) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const at = V3(pos.x + rand(-0.6, 0.6), 0.15, pos.z + rand(-0.4, 0.4));
        this.burst(at, { n: 18, colors: ["#ff3b2f", "#ffd54a", "#ffffff"], speed: 1.6, gravity: 3, life: 0.6, size: 0.07 });
        sfx.pop();
      }, i * 110 + Math.random() * 60);
    }
  }

  /** Pháo hoa: bursts in the sky above the village gate. */
  fireworks(count = 5) {
    const palettes = [["#ffd54a", "#ff9f43"], ["#ff6b8a", "#ffd1dc"], ["#7ee0ff", "#ffffff"], ["#9bff7a", "#ffe066"], ["#c08bff", "#ffd54a"]];
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const at = V3(rand(-3.5, 3.5), rand(4.5, 7.5), rand(-9, -5));
        this.burst(at, { n: 80, colors: palettes[i % palettes.length], speed: rand(2.5, 3.6), gravity: 1.2, life: 2.0, size: 0.16 });
        sfx.boom();
      }, i * 450 + Math.random() * 200);
    }
  }

  // ------------------------------------------------------------------ weather
  /** Mưa rào: rain streaks, darker sky; then a rainbow over the village. */
  rain(seconds = 14) {
    if (this.raining) return Promise.resolve();
    const N = 900;
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(N * 6);
    const reset = (i, top) => {
      const x = rand(-8, 8), z = rand(-12, 4), y = top ? rand(6, 10) : rand(0, 10);
      p.set([x, y, z, x + 0.03, y - 0.35, z], i * 6);
    };
    for (let i = 0; i < N; i++) reset(i, false);
    geo.setAttribute("position", new THREE.BufferAttribute(p, 3));
    const mat = new THREE.LineBasicMaterial({ color: "#cfe3ff", transparent: true, opacity: 0.55 });
    const lines = new THREE.LineSegments(geo, mat);
    this.s.add(lines);
    this.dimTarget = 1;
    const stopNoise = sfx.rainNoise(seconds);
    let t = 0;
    return new Promise((res) => {
      const step = (dt) => {
        t += dt;
        const a = geo.attributes.position.array;
        for (let i = 0; i < N; i++) {
          a[i * 6 + 1] -= 14 * dt; a[i * 6 + 4] -= 14 * dt;
          if (a[i * 6 + 4] < 0) reset(i, true);
        }
        geo.attributes.position.needsUpdate = true;
        mat.opacity = 0.55 * Math.min(1, t / 1.5, Math.max(0, (seconds - t) / 1.5));
        if (t >= seconds) {
          this.w.tickers.delete(step);
          this.s.remove(lines);
          geo.dispose(); mat.dispose();
          stopNoise();
          this.raining = null;
          this.dimTarget = this.spot ? 0.55 : 0;
          this.rainbow(10);
          res();
        }
      };
      this.raining = step;
      this.w.tickers.add(step);
    });
  }

  rainbow(seconds = 10) {
    const colors = ["#ff4d4d", "#ff9f40", "#ffe14d", "#6dd36d", "#4da6ff", "#6b5bff", "#b05bff"];
    const group = new THREE.Group();
    colors.forEach((c, i) => {
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(5.6 - i * 0.16, 0.085, 6, 64, Math.PI),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false }));
      group.add(m);
    });
    group.position.set(0.5, -0.3, -11.5); // arcs over the village gate
    this.s.add(group);
    let t = 0;
    const step = (dt) => {
      t += dt;
      const o = 0.55 * Math.min(1, t / 2, Math.max(0, (seconds - t) / 2));
      group.children.forEach((m) => (m.material.opacity = o));
      if (t >= seconds) {
        this.w.tickers.delete(step);
        this.s.remove(group);
        group.children.forEach((m) => { m.geometry.dispose(); m.material.dispose(); });
      }
    };
    this.w.tickers.add(step);
  }

  // ------------------------------------------------------------------ butterflies
  /** Returns an array of butterflies ({obj}) that flutter around the yard for `seconds`. */
  butterflies(n = 4, seconds = 16) {
    const list = [];
    const colors = ["#ffd54a", "#ff8fb1", "#8fd3ff", "#ffffff"];
    for (let i = 0; i < n; i++) {
      const obj = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide });
      const wingL = new THREE.Mesh(new THREE.CircleGeometry(0.07, 8), mat);
      const wingR = wingL.clone();
      wingL.position.x = -0.06; wingR.position.x = 0.06;
      obj.add(wingL, wingR);
      const seed = Math.random() * 10, cx = rand(-1.8, 1.8), cz = rand(-0.6, 1.8);
      obj.position.set(cx, 0.8, cz);
      this.s.add(obj);
      list.push({ obj, wingL, wingR, seed, cx, cz });
    }
    let t = 0;
    const step = (dt) => {
      t += dt;
      for (const b of list) {
        const k = t * 0.7 + b.seed;
        b.obj.position.set(b.cx + Math.sin(k) * 1.2, 0.7 + Math.sin(k * 3.1) * 0.25, b.cz + Math.cos(k * 0.8) * 0.9);
        const flap = Math.sin(t * 22 + b.seed) * 1.1;
        b.wingL.rotation.y = flap; b.wingR.rotation.y = -flap;
        b.obj.rotation.y = k;
      }
      if (t >= seconds) {
        this.w.tickers.delete(step);
        for (const b of list) { this.s.remove(b.obj); b.wingL.geometry.dispose(); b.wingL.material.dispose(); }
      }
    };
    this.w.tickers.add(step);
    return list;
  }
}
