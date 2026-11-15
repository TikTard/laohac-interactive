import * as THREE from "three";

/** 0 -> 1 -> 1 -> 0 envelope over p in [0,1] */
export function bell(p, a = 0.2, b = 0.2) {
  const s = (x) => x * x * (3 - 2 * x);
  if (p < a) return s(p / a);
  if (p > 1 - b) return s((1 - p) / b);
  return 1;
}
export const lerpAngle = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

/**
 * Layered procedural animation over named pivot nodes exported from Blender.
 * Every frame: offsets = idle pose + all running actions, applied on top of the rest pose.
 */
export class Rig {
  constructor(root, names) {
    this.root = root;
    this.n = {};
    for (const k of names) {
      const o = root.getObjectByName(k);
      if (!o) continue;
      o.userData.rest = { rot: o.rotation.clone(), pos: o.position.clone(), scl: o.scale.clone() };
      this.n[k] = o;
    }
    this.actions = [];
    this.time = 0;
  }
  play(dur, fn) {
    return new Promise((res) => this.actions.push({ t: 0, dur, fn, res }));
  }
  pose(_add, _t, _dt) {}
  update(dt) {
    this.time += dt;
    const off = new Map();
    const add = (node, prop, axis, v) => {
      const k = node + "|" + prop + "|" + axis;
      off.set(k, (off.get(k) || 0) + v);
    };
    this.pose(add, this.time, dt);
    this.actions = this.actions.filter((a) => {
      a.t += dt;
      const p = Math.min(a.t / a.dur, 1);
      a.fn(p, add, a.t);
      if (p >= 1) { a.res(); return false; }
      return true;
    });
    for (const [name, o] of Object.entries(this.n)) {
      const r = o.userData.rest;
      o.rotation.set(
        r.rot.x + (off.get(name + "|rot|x") || 0),
        r.rot.y + (off.get(name + "|rot|y") || 0),
        r.rot.z + (off.get(name + "|rot|z") || 0));
      o.position.set(
        r.pos.x + (off.get(name + "|pos|x") || 0),
        r.pos.y + (off.get(name + "|pos|y") || 0),
        r.pos.z + (off.get(name + "|pos|z") || 0));
    }
  }
  worldPos(name, out = new THREE.Vector3()) {
    return (this.n[name] || this.root).getWorldPosition(out);
  }
}

// ======================================================================= LÃO HẠC
export class LaoHac extends Rig {
  constructor(root) {
    super(root, ["Upper", "Head", "Beard", "ArmL", "ArmR", "Bowl"]);
    this.speaking = false;
    this.sad = 0;
    this.sadTarget = 0;
    this.yaw = 0;
    this.lookAt = null; // THREE.Vector3 or null (= camera / forward)
  }
  pose(add, t, dt) {
    this.sad += (this.sadTarget - this.sad) * Math.min(1, dt * 1.5);
    let yawT = 0;
    if (this.lookAt) {
      const p = this.root.position;
      yawT = THREE.MathUtils.clamp(Math.atan2(this.lookAt.x - p.x, this.lookAt.z - p.z), -0.75, 0.75);
    } else yawT = Math.sin(t * 0.23) * 0.15;
    this.yaw += (yawT - this.yaw) * Math.min(1, dt * 2.5);
    add("Upper", "rot", "x", Math.sin(t * 1.3) * 0.015 + this.sad * 0.1);
    add("Head", "rot", "x", this.sad * 0.22 + Math.sin(t * 0.7) * 0.02);
    add("Head", "rot", "y", this.yaw);
    add("Head", "rot", "z", Math.sin(t * 0.45) * 0.04);
    if (this.speaking) {
      add("Beard", "rot", "x", Math.abs(Math.sin(t * 12.5)) * 0.16);
      add("Head", "rot", "x", Math.sin(t * 5.5) * 0.035);
      add("ArmR", "rot", "x", (Math.sin(t * 1.7) * 0.5 - 0.5) * 0.25);
    }
  }
  /** Vái tạ ơn: hands together, bow `times` times. */
  thank(times = 2, dur = 2.4) {
    return this.play(dur, (p, add) => {
      const e = bell(p, 0.15, 0.2);
      add("ArmL", "rot", "x", -1.15 * e);
      add("ArmR", "rot", "x", -1.15 * e);
      add("ArmL", "rot", "z", 0.42 * e);
      add("ArmR", "rot", "z", -0.42 * e);
      const bow = e * (0.5 - 0.5 * Math.cos(Math.PI * 2 * times * p));
      add("Upper", "rot", "x", 0.32 * bow);
      add("Head", "rot", "x", 0.2 * bow);
    });
  }
  nod() {
    return this.play(0.9, (p, add) => add("Head", "rot", "x", Math.sin(p * Math.PI * 2) * 0.18 * bell(p)));
  }
  /** Hold the bowl up towards passers-by. */
  beg(dur = 3) {
    return this.play(dur, (p, add) => {
      const e = bell(p, 0.2, 0.25);
      add("ArmR", "rot", "x", -0.9 * e);
      add("ArmR", "rot", "z", 0.15 * e);
      add("Upper", "rot", "x", 0.08 * e);
    });
  }
  /** Overjoyed: arms up and shaking. */
  rejoice(dur = 2.5) {
    return this.play(dur, (p, add, t) => {
      const e = bell(p, 0.15, 0.25);
      add("ArmL", "rot", "x", -2.2 * e);
      add("ArmR", "rot", "x", -2.2 * e);
      add("ArmL", "rot", "z", (-0.3 + Math.sin(t * 14) * 0.15) * e);
      add("ArmR", "rot", "z", (0.3 - Math.sin(t * 14) * 0.15) * e);
      add("Upper", "rot", "x", -0.15 * e);
    });
  }
}

// ======================================================================= CẬU VÀNG
export class Dog extends Rig {
  constructor(root) {
    super(root, ["Body", "Head", "Jaw", "Tail"]);
    this.wag = 0.3;
    this.yaw = 0;
    this.lookAt = null;
    this.tilt = 0;
    this.nextTilt = 3;
    this.sleep = 0;
    this.sleepTarget = 0;
  }
  pose(add, t, dt) {
    this.wag += (0.3 - this.wag) * Math.min(1, dt * 0.35);
    const speed = 5 + this.wag * 9;
    add("Tail", "rot", "y", Math.sin(t * speed) * 0.55 * Math.min(1.4, this.wag));
    add("Tail", "rot", "x", -0.15 * Math.min(1, this.wag));
    add("Body", "pos", "y", Math.sin(t * 2.2) * 0.003);
    let yawT = 0;
    if (this.lookAt) {
      const p = this.root.getWorldPosition(new THREE.Vector3());
      const dir = Math.atan2(this.lookAt.x - p.x, this.lookAt.z - p.z) - this.root.rotation.y;
      yawT = THREE.MathUtils.clamp(Math.atan2(Math.sin(dir), Math.cos(dir)), -0.9, 0.9);
    }
    this.yaw += (yawT - this.yaw) * Math.min(1, dt * 3);
    add("Head", "rot", "y", this.yaw);
    this.nextTilt -= dt;
    if (this.nextTilt < 0) { this.nextTilt = 3 + Math.random() * 5; this.tiltT = (Math.random() - 0.5) * 0.6; }
    this.tilt += ((this.tiltT || 0) - this.tilt) * Math.min(1, dt * 3);
    add("Head", "rot", "z", this.tilt * (1 - this.sleep));
    this.sleep += (this.sleepTarget - this.sleep) * Math.min(1, dt * 1.2);
    if (this.sleep > 0.01) {
      add("Head", "rot", "x", 0.55 * this.sleep + Math.sin(t * 1.2) * 0.03 * this.sleep);
      add("Head", "rot", "y", -this.yaw * this.sleep);
      add("Body", "pos", "y", -0.01 * this.sleep);
      this.wag = Math.min(this.wag, 0.3 + (1 - this.sleep) * 2);
    }
  }
  bark(n = 2) {
    return this.play(n * 0.3 + 0.1, (p, add) => {
      const q = (p * (n * 0.3 + 0.1)) / 0.3;
      const k = Math.floor(q);
      const open = k < n ? Math.sin((q - k) * Math.PI) : 0;
      add("Jaw", "rot", "x", 0.5 * open);
      add("Head", "rot", "x", -0.22 * open);
      add("Body", "pos", "y", 0.012 * open);
    });
  }
  happy(dur = 2) {
    this.wag = 1.8;
    return this.play(dur, (p, add) => {
      add("Body", "pos", "y", Math.abs(Math.sin(p * Math.PI * 4)) * 0.04 * bell(p));
    });
  }
  eat(dur = 3) {
    this.wag = 1.4;
    return this.play(dur, (p, add, t) => {
      const e = bell(p, 0.15, 0.15);
      add("Head", "rot", "x", (0.55 + Math.sin(t * 11) * 0.12) * e);
      add("Jaw", "rot", "x", Math.max(0, Math.sin(t * 11)) * 0.3 * e);
    });
  }
}

// ======================================================================= VILLAGER
/** Global walking speed multiplier (config game.walkSpeed). */
export const motion = { walk: 1.35 };
export class Villager extends Rig {
  constructor(root, opts = {}) {
    super(root, ["Body", "Head", "ArmL", "ArmR", "LegL", "LegR"]);
    this.speed = opts.speed || 1.1;
    this.swingR = opts.swingR !== false;
    this.swingL = opts.swingL !== false;
    this.path = [];
    this.moving = false;
    this.phase = Math.random() * 6;
    this.yawTarget = root.rotation.y;
    this.arrive = null;
    this.label = opts.label || "";
    this.labelClass = opts.labelClass || "tag";
    this.id = opts.id || Math.random().toString(36).slice(2);
    this.userId = opts.userId || null;
    this.dead = false;
  }
  walk(points) {
    this.path = points.map((p) => p.clone());
    this.moving = true;
    return new Promise((res) => (this.arrive = res));
  }
  face(x, z) {
    const p = this.root.position;
    this.yawTarget = Math.atan2(x - p.x, z - p.z);
  }
  tick(dt) {
    if (this.moving && this.path.length) {
      const p = this.root.position;
      const tgt = this.path[0];
      const dx = tgt.x - p.x, dz = tgt.z - p.z;
      const d = Math.hypot(dx, dz);
      const step = this.speed * motion.walk * dt;
      if (d <= step) {
        p.x = tgt.x; p.z = tgt.z;
        this.path.shift();
        if (!this.path.length) {
          this.moving = false;
          const r = this.arrive; this.arrive = null; r && r();
        }
      } else {
        p.x += (dx / d) * step; p.z += (dz / d) * step;
        this.yawTarget = Math.atan2(dx, dz);
      }
      this.phase += dt * this.speed * motion.walk * 5.2;
    }
    this.root.rotation.y = lerpAngle(this.root.rotation.y, this.yawTarget, Math.min(1, dt * 7));
    this.update(dt);
  }
  pose(add, t) {
    if (this.moving) {
      const s = Math.sin(this.phase);
      const amp = this.sneak ? 0.3 : this.speed > 2.4 ? 0.85 : 0.55;
      add("LegL", "rot", "x", s * amp);
      add("LegR", "rot", "x", -s * amp);
      if (this.sneak) add("Body", "rot", "x", 0.18);
      if (this.swingL) add("ArmL", "rot", "x", -s * 0.45);
      if (this.swingR) add("ArmR", "rot", "x", s * 0.45);
      add("Body", "pos", "y", Math.abs(Math.cos(this.phase)) * 0.035 - 0.015);
      add("Body", "rot", "z", s * 0.03);
    } else {
      add("Body", "rot", "x", Math.sin(t * 1.4) * 0.01);
    }
    if (this.talking) {
      add("Head", "rot", "x", Math.sin(t * 6) * 0.07);
      add("Head", "rot", "z", Math.sin(t * 2.3) * 0.05);
      if (this.swingL) add("ArmL", "rot", "x", -0.35 - Math.sin(t * 3.1) * 0.25);
    }
  }
  give(dur = 1.5) {
    return this.play(dur, (p, add) => {
      const e = bell(p, 0.3, 0.3);
      add("Body", "rot", "x", 0.45 * e);
      add("Head", "rot", "x", 0.2 * e);
      add("ArmR", "rot", "x", -1.1 * e);
      if (this.swingL) add("ArmL", "rot", "x", -0.6 * e);
    });
  }
  point(dur = 2) {
    return this.play(dur, (p, add, t) => {
      const e = bell(p, 0.15, 0.2);
      add("ArmR", "rot", "x", (-1.45 + Math.sin(t * 9) * 0.12) * e);
      add("Body", "rot", "x", -0.06 * e);
    });
  }
  akimbo(dur = 3) {
    return this.play(dur, (p, add) => {
      const e = bell(p, 0.15, 0.15);
      add("ArmL", "rot", "z", -0.7 * e);
      add("ArmR", "rot", "z", this.swingR ? 0.7 * e : 0);
      add("ArmL", "rot", "x", 0.3 * e);
      add("Body", "rot", "x", -0.08 * e);
    });
  }
  jump(h = 0.25) {
    return this.play(0.55, (p, add) => {
      const y = Math.sin(p * Math.PI) * h;
      for (const n of ["Body", "LegL", "LegR"]) add(n, "pos", "y", y);
      add("ArmL", "rot", "z", -1.2 * Math.sin(p * Math.PI));
      add("ArmR", "rot", "z", 1.2 * Math.sin(p * Math.PI));
    });
  }
  bow() {
    return this.play(1.2, (p, add) => {
      const e = bell(p, 0.3, 0.35);
      add("Body", "rot", "x", 0.4 * e);
      add("Head", "rot", "x", 0.2 * e);
    });
  }
  nod() {
    return this.play(0.8, (p, add) => add("Head", "rot", "x", Math.sin(p * Math.PI * 2) * 0.22 * bell(p)));
  }
  /** Happy little dance: hop, arms up in turns, wiggle. */
  dance(dur = 2.6) {
    return this.play(dur, (p, add, t) => {
      const e = bell(p, 0.1, 0.15);
      const hop = Math.abs(Math.sin(t * 9)) * 0.12 * e;
      for (const n of ["Body", "LegL", "LegR"]) add(n, "pos", "y", hop);
      add("Body", "rot", "y", Math.sin(t * 4.5) * 0.6 * e);
      add("Body", "rot", "z", Math.sin(t * 9) * 0.12 * e);
      add("Head", "rot", "z", -Math.sin(t * 9) * 0.15 * e);
      if (this.swingL) add("ArmL", "rot", "z", (-1.6 - Math.max(0, Math.sin(t * 9)) * 0.9) * e);
      if (this.swingR) add("ArmR", "rot", "z", (1.6 + Math.max(0, -Math.sin(t * 9)) * 0.9) * e);
      add("LegL", "rot", "x", -Math.max(0, Math.sin(t * 9)) * 0.5 * e);
      add("LegR", "rot", "x", -Math.max(0, -Math.sin(t * 9)) * 0.5 * e);
    });
  }
  wave(dur = 2.4) {
    if (!this.swingR) return this.bow();
    return this.play(dur, (p, add, t) => {
      const e = bell(p, 0.15, 0.2);
      add("ArmR", "rot", "z", 2.4 * e);
      add("ArmR", "rot", "x", (-0.2 + Math.sin(t * 12) * 0.25) * e);
    });
  }
}

// ======================================================================= CẬU VÀNG DANCING (standing model)
export class DogDancer extends Rig {
  constructor(root) {
    super(root, ["Body", "Head", "Jaw", "ArmL", "ArmR", "LegL", "LegR", "Tail"]);
    this.bpm = 94;
    this.dancing = false;
    this.t0 = 0;
  }
  pose(add, t) {
    if (!this.dancing) return;
    const b = ((t - this.t0) * this.bpm) / 60; // beats
    const bar = Math.floor(b / 4) % 4;
    const ph = b * Math.PI;
    const bounce = Math.abs(Math.sin(ph));
    for (const n of ["Body"]) add(n, "pos", "y", bounce * 0.05);
    add("Head", "rot", "x", Math.sin(ph * 2) * 0.18);
    add("Tail", "rot", "y", Math.sin(t * 16) * 0.7);
    add("Jaw", "rot", "x", 0.25 + Math.abs(Math.sin(ph)) * 0.15);
    add("LegL", "rot", "x", Math.max(0, Math.sin(ph)) * -0.5);
    add("LegR", "rot", "x", Math.max(0, -Math.sin(ph)) * -0.5);
    if (bar === 0) { // pump arms up, alternating
      add("ArmL", "rot", "x", -2.6 * Math.max(0, Math.sin(ph)));
      add("ArmR", "rot", "x", -2.6 * Math.max(0, -Math.sin(ph)));
      add("Body", "rot", "z", Math.sin(ph) * 0.12);
    } else if (bar === 1) { // side-to-side wave
      add("ArmL", "rot", "z", -1.4 - Math.sin(ph * 2) * 0.4);
      add("ArmR", "rot", "z", 1.4 - Math.sin(ph * 2) * 0.4);
      add("Body", "rot", "z", Math.sin(ph) * 0.25);
      add("Head", "rot", "z", -Math.sin(ph) * 0.25);
    } else if (bar === 2) { // dab
      const d = Math.sin(ph / 2) > 0 ? 1 : -1;
      add("ArmL", "rot", "z", d > 0 ? -2.2 : -0.6);
      add("ArmR", "rot", "z", d > 0 ? 0.6 : 2.2);
      add("ArmL", "rot", "x", d > 0 ? -0.4 : -1.4);
      add("ArmR", "rot", "x", d > 0 ? -1.4 : -0.4);
      add("Head", "rot", "y", d * 0.5);
      add("Head", "rot", "x", 0.3);
    } else { // spin with hands up
      const spin = ((b % 4) / 4) * Math.PI * 2;
      add("Body", "rot", "y", spin);
      add("Head", "rot", "y", 0);
      add("ArmL", "rot", "z", -2.5);
      add("ArmR", "rot", "z", 2.5);
    }
  }
}

// ======================================================================= CHICKEN
export class Chicken extends Rig {
  constructor(root, area) {
    super(root, ["Body", "Head"]);
    this.area = area; // {minX,maxX,minZ,maxZ, avoid:[{x,z,r}]}
    this.target = null;
    this.speed = 0.45;
    this.wait = Math.random() * 3;
    this.peck = 0;
    this.flee = 0;
  }
  pickTarget() {
    const a = this.area;
    for (let i = 0; i < 20; i++) {
      const x = a.minX + Math.random() * (a.maxX - a.minX);
      const z = a.minZ + Math.random() * (a.maxZ - a.minZ);
      if (!a.avoid.some((o) => Math.hypot(x - o.x, z - o.z) < o.r)) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(a.minX, 0, a.minZ);
  }
  scare(from) {
    const p = this.root.position;
    const dx = p.x - from.x, dz = p.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    const a = this.area;
    this.target = new THREE.Vector3(
      THREE.MathUtils.clamp(p.x + (dx / d) * 2.5, a.minX, a.maxX), 0,
      THREE.MathUtils.clamp(p.z + (dz / d) * 2.5, a.minZ, a.maxZ));
    this.flee = 1.5;
  }
  tick(dt) {
    const p = this.root.position;
    this.flee = Math.max(0, this.flee - dt);
    if (!this.target) {
      this.wait -= dt;
      if (this.wait <= 0) { this.target = this.pickTarget(); }
    } else {
      const dx = this.target.x - p.x, dz = this.target.z - p.z;
      const d = Math.hypot(dx, dz);
      const sp = this.flee > 0 ? 2.2 : this.speed;
      if (d < sp * dt + 0.01) { this.target = null; this.wait = 1 + Math.random() * 4; }
      else {
        p.x += (dx / d) * sp * dt; p.z += (dz / d) * sp * dt;
        this.root.rotation.y = lerpAngle(this.root.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 10));
      }
    }
    this.update(dt);
  }
  pose(add, t) {
    if (this.target) {
      add("Body", "pos", "y", Math.abs(Math.sin(t * (this.flee > 0 ? 30 : 14))) * 0.025);
      add("Head", "rot", "x", Math.sin(t * 14) * 0.15);
    } else {
      // peck the ground now and then
      const k = (Math.sin(t * 2.3 + this.root.id) + 1) / 2;
      add("Head", "rot", "x", k > 0.6 ? Math.abs(Math.sin(t * 16)) * 1.0 : 0);
    }
  }
}

// ======================================================================= ANIMALS (buffalo, pig, duck)
/**
 * An animal that walks along with a villager: keeps an offset in the leader's frame
 * (dz > 0 = in front, dz < 0 = behind). Legs (LegFL/FR/BL/BR) swing; ducks waddle instead.
 */
export class Beast extends Rig {
  constructor(root, opts = {}) {
    super(root, ["Body", "Head", "Tail", "LegFL", "LegFR", "LegBL", "LegBR"]);
    this.leader = opts.leader || null;
    this.dx = opts.dx || 0;
    this.dz = opts.dz ?? -1.2;
    this.speed = opts.speed || 1.2;
    this.kind = opts.kind || "buffalo";
    this.stride = opts.stride || (this.kind === "buffalo" ? 3.2 : this.kind === "duck" ? 9 : 7);
    this.moving = false;
    this.phase = Math.random() * 6;
    this.yawTarget = root.rotation.y;
    this.dead = false;
    this.stand = 0; // 0 = on four legs, 1 = up on the hind legs (buffalo hip-hop)
    this.standT = 0;
    this.base = null;
  }
  /** Stand up on the hind legs and dance for `seconds`, then back down on all fours. */
  async hiphop(seconds = 7) {
    this.standT = 1;
    this.dancing = true;
    await new Promise((r) => setTimeout(r, seconds * 1000));
    this.dancing = false;
    this.standT = 0;
    await new Promise((r) => setTimeout(r, 900));
  }
  /** Pitch the whole animal up round its hind feet (local z = -0.55 for the buffalo model). */
  standTick(dt) {
    const r = this.root;
    this.stand += (this.standT - this.stand) * Math.min(1, dt * 3.2);
    if (!this.standT && this.stand < 0.002) {
      r.position.copy(this.base); r.rotation.x = 0; this.base = null; this.stand = 0;
      return;
    }
    r.rotation.order = "YXZ";
    const th = -1.2 * this.stand, hz = -0.55 * (r.scale.z || 1);
    const oz = -hz * Math.cos(th) + hz; // P - Rx·P for the hind-foot pivot P = (0, 0, hz)
    const oy = hz * Math.sin(th);
    const hop = this.dancing ? Math.abs(Math.sin(this.time * 8.4)) * 0.07 * this.stand : 0;
    const yaw = r.rotation.y;
    r.position.set(this.base.x + Math.sin(yaw) * oz, oy + hop, this.base.z + Math.cos(yaw) * oz);
    r.rotation.x = th;
  }
  tick(dt) {
    const L = this.leader;
    if (this.standT || this.base) {
      this.base ||= this.root.position.clone();
      this.moving = false;
      this.standTick(dt);
      this.root.rotation.y = lerpAngle(this.root.rotation.y, this.yawTarget, Math.min(1, dt * 5));
      this.update(dt);
      return;
    }
    if (L && !L.dead) {
      const yaw = L.root.rotation.y;
      const lp = L.root.position;
      const tx = lp.x + Math.sin(yaw) * this.dz + Math.cos(yaw) * this.dx;
      const tz = lp.z + Math.cos(yaw) * this.dz - Math.sin(yaw) * this.dx;
      const p = this.root.position;
      const ddx = tx - p.x, ddz = tz - p.z;
      const d = Math.hypot(ddx, ddz);
      const sp = Math.max(this.speed, (L.speed || 1) * motion.walk) * (d > 0.6 ? 1.5 : 1);
      if (d > 0.06) {
        const step = Math.min(d, sp * dt);
        p.x += (ddx / d) * step; p.z += (ddz / d) * step;
        if (d > 0.15) this.yawTarget = Math.atan2(ddx, ddz);
        this.moving = true;
        this.phase += dt * this.stride * Math.min(1.4, sp / 1.2);
      } else {
        this.moving = false;
        this.yawTarget = yaw;
      }
    } else this.moving = false;
    this.root.rotation.y = lerpAngle(this.root.rotation.y, this.yawTarget, Math.min(1, dt * 5));
    this.update(dt);
  }
  pose(add, t) {
    const s = Math.sin(this.phase);
    if (this.kind === "duck") {
      if (this.moving) {
        add("Body", "rot", "z", s * 0.22);                       // waddle
        add("Body", "pos", "y", Math.abs(s) * 0.015);
        add("Head", "rot", "x", Math.cos(this.phase) * 0.15);
      } else {
        add("Head", "rot", "x", 0.4 + Math.sin(t * 7) * 0.3);   // pecking
      }
      return;
    }
    const amp = this.kind === "buffalo" ? 0.38 : 0.6;
    if (this.stand > 0.01) {
      // up on the hind legs: front legs pump like arms, hips wiggle, head bobs to the beat
      const k = this.stand, b = t * 8.4;
      const d = this.dancing ? 1 : 0;
      add("LegFL", "rot", "x", (-0.9 + Math.sin(b) * 0.7 * d) * k);
      add("LegFR", "rot", "x", (-0.9 - Math.sin(b) * 0.7 * d) * k);
      add("LegFL", "rot", "z", Math.max(0, Math.sin(b / 2)) * 0.6 * d * k);
      add("LegFR", "rot", "z", -Math.max(0, -Math.sin(b / 2)) * 0.6 * d * k);
      add("LegBL", "rot", "x", (0.9 + Math.sin(b) * 0.15 * d) * k);
      add("LegBR", "rot", "x", (0.9 - Math.sin(b) * 0.15 * d) * k);
      add("Body", "rot", "y", Math.sin(t * 4.2) * 0.35 * d * k);
      add("Head", "rot", "x", (0.9 + Math.sin(b) * 0.18 * d) * k); // keep looking at the audience
      add("Head", "rot", "z", Math.sin(t * 4.2) * 0.2 * d * k);
      add("Tail", "rot", "z", Math.sin(t * 14) * 0.6 * d);
      return;
    }
    if (this.moving) {
      add("LegFL", "rot", "x", s * amp); add("LegBR", "rot", "x", s * amp);
      add("LegFR", "rot", "x", -s * amp); add("LegBL", "rot", "x", -s * amp);
      add("Body", "pos", "y", Math.abs(Math.cos(this.phase)) * (this.kind === "buffalo" ? 0.025 : 0.02));
      add("Head", "rot", "x", Math.sin(this.phase * 2) * 0.05);
    } else {
      add("Head", "rot", "x", 0.25 + Math.sin(t * 0.8) * 0.1);   // grazing / sniffing
    }
    add("Tail", "rot", "z", Math.sin(t * (this.kind === "buffalo" ? 2.2 : 5)) * 0.35);
    add("Tail", "rot", "x", 0.1);
  }
}
