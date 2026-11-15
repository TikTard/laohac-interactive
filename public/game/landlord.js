import * as THREE from "three";
import * as ui from "./ui.js";
import * as sfx from "./audio.js";
import { CHARS, VARIANTS } from "./world.js";
import { sleep, spoken } from "./brain.js";
import { decorate } from "./ranks.js";

const V = (x, z) => new THREE.Vector3(x, 0, z);
/** The landlord's own place: a red mat and a bench, beside Lão (left), in front of the crowd. */
export const LANDLORD_POS = V(-1.6, 0.85);

/**
 * "Địa chủ của làng": the viewer who gave the most this live (seeding never counts).
 * While they are in the crowd they stand on their own mat; a servant holds a parasol over them
 * and another fans them, both following wherever they go. Purely cosmetic — nothing is asked from anyone.
 */
export class Landlord {
  constructor(world, brain) {
    this.w = world;
    this.b = brain;
    this.cur = null; // {id, name, avatar} from the server
    this.m = null; // crowd member who holds the title right now
    this.servants = [];
    this.welcomed = new Set(); // announced once per live; a short "welcome back" after that
    this.dais = null;
    this.busy = false;
    setInterval(() => this.check(), 700);
    this.follow = this.follow.bind(this);
    this.w.tickers.add(this.follow);
  }

  /** From the server state: who holds the title (or null). */
  set(user) {
    if (!this.b.cfg().landlord || this.b.cfg().landlord.enabled === false) user = null;
    if ((user?.id || null) === (this.cur?.id || null)) { if (user) this.cur = user; return; }
    this.cur = user || null;
    this.check();
  }

  check() {
    if (this.busy) return;
    const crowd = this.b.crowd;
    const m = this.cur ? crowd.get(this.cur.id) : null;
    // title moved on, or the holder left the live
    if (this.m && (this.m !== m || !this.m.v || this.m.v.dead || crowd.get(this.m.user.id) !== this.m)) this.demote();
    if (m && !this.m && m.v && !m.v.dead && !m.busy) this.establish(m);
  }

  async establish(m) {
    this.busy = true;
    try {
      this.m = m;
      m.landlord = true;
      m.busy = true;
      this.showDais(true);
      crowdLabel(this.b.crowd, m);
      decorate(m.v, Math.max(5, m.user.level || 1), this.w); // red cape, gold trim: dressed like a landlord
      await Promise.race([m.v.walk([V(LANDLORD_POS.x + 0.4, -0.6), LANDLORD_POS]), sleep(8000)]);
      if (this.m !== m || m.v.dead) return;
      m.v.face(0.3, 6);
      await this.spawnServants(m);
      const first = !this.welcomed.has(m.user.id);
      this.welcomed.add(m.user.id);
      if (first && !this.b.bigActive) {
        ui.banner("🏯 Địa chủ của làng", m.user.name + " · có lính hầu che lọng, quạt mát", 4000);
        this.b.camFx?.focus((out) => (m.v.dead ? null : out.copy(m.v.root.position)), 3, 3);
        this.b.fx.spotlight(m.v.root, 3);
        sfx.fanfare();
        m.v.bow?.();
        this.b.say("landlordNew", m.user.name, {}, 2);
      } else if (!this.b.bigActive && this.b.cooldown("landlord-back", 30)) {
        this.b.say("landlordBack", m.user.name, {}, 1);
      }
      m.lastSeen = performance.now();
      m.busy = false;
    } finally {
      this.busy = false;
    }
  }

  demote() {
    const m = this.m;
    this.m = null;
    this.dismissServants();
    this.showDais(false);
    if (!m) return;
    m.landlord = false;
    const crowd = this.b.crowd;
    if (crowd.get(m.user.id) === m && m.v && !m.v.dead) {
      decorate(m.v, m.user.level || 1, this.w);
      m.spot = crowd.freeSpot(m.user.level || 1);
      crowd.setLabel(m);
      if (!m.busy) { m.busy = true; crowd.returnToSpot(m); }
    }
  }

  async spawnServants(m) {
    this.dismissServants();
    const p = m.v.root.position;
    // parasol bearer (lính lọng) behind, fan bearer at the side
    const parasol = await this.w.spawnVillager({ variant: CHARS.linhLong, at: V(p.x - 3.5, p.z - 1.2), noTint: true, speedMul: 1.6 });
    const fanVar = VARIANTS.find((v) => v.file === "villager_young_man") || VARIANTS[0];
    const fanner = await this.w.spawnVillager({ variant: { ...fanVar, swingR: false }, at: V(p.x - 3.2, p.z + 0.4), noTint: true, speedMul: 1.6 });
    // a big palm-leaf fan in the right hand, waving the whole time
    const fan = new THREE.Mesh(new THREE.CircleGeometry(0.32, 18, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: "#d9b24a", side: THREE.DoubleSide, roughness: 0.7 }));
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 6), new THREE.MeshStandardMaterial({ color: "#7a5a36" }));
    handle.position.y = -0.17;
    const fanG = new THREE.Group();
    fanG.add(fan, handle);
    fanG.position.set(0, -0.62, 0.05);
    fanG.rotation.set(0, Math.PI / 2, 0);
    fanner.root.getObjectByName("ArmR")?.add(fanG);
    fanner.play(3600, (q, add, t) => {
      add("ArmR", "rot", "x", -1.25 + Math.sin(t * 7) * 0.4);
      add("ArmR", "rot", "z", Math.sin(t * 7) * 0.25);
    });
    parasol.servant = fanner.servant = true;
    this.servants = [
      { v: parasol, dx: -0.12, dz: -0.5 }, // right behind: the parasol reaches over the landlord's head
      { v: fanner, dx: 0.6, dz: -0.1, faceLord: true },
    ];
  }

  dismissServants() {
    for (const s of this.servants) {
      const v = s.v;
      if (v.dead) continue;
      v.actions = [];
      v.walk([V(v.root.position.x - 2, -2.2), V(-9, -2.2)]).then(() => this.w.remove(v));
    }
    this.servants = [];
  }

  /** Every frame: servants keep their place around the landlord, wherever they go. */
  follow() {
    const m = this.m;
    if (!m?.v || m.v.dead || !this.servants.length) return;
    const lp = m.v.root.position;
    // offsets in the screen's frame (+z = towards the camera), so the parasol always stays behind / above
    // the landlord and the fan at their side, however they turn while chatting
    for (const s of this.servants) {
      const v = s.v;
      if (v.dead) continue;
      const tx = lp.x + s.dx, tz = lp.z + s.dz;
      const d = Math.hypot(tx - v.root.position.x, tz - v.root.position.z);
      if (d > 0.3 && (!v.moving || !v.path.length || v.path[0].distanceTo(new THREE.Vector3(tx, 0, tz)) > 0.4)) {
        v.walk([new THREE.Vector3(tx, 0, tz)]);
      } else if (!v.moving) {
        if (s.faceLord) v.face(lp.x, lp.z);
        else v.yawTarget = 0; // parasol bearer faces the camera: the parasol leans over the landlord
      }
    }
    // standing on the mat: the landlord turns back to the viewers now and then
    if (!m.busy && !m.v.moving && lp.distanceTo(LANDLORD_POS) < 0.3 && (this.faceT = (this.faceT || 0) + 1) % 240 === 0) m.v.face(0.2, 6);
  }

  showDais(on) {
    if (on && !this.dais) {
      const g = new THREE.Group();
      const mat = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.03, 28), new THREE.MeshStandardMaterial({ color: "#a8231c", roughness: 0.9 }));
      mat.position.y = 0.015;
      const trim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.025, 6, 32), new THREE.MeshStandardMaterial({ color: "#e8c041", metalness: 0.6, roughness: 0.35 }));
      trim.rotation.x = Math.PI / 2; trim.position.y = 0.03;
      const wood = new THREE.MeshStandardMaterial({ color: "#6b4224", roughness: 0.8 });
      const bench = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.05, 0.3), wood);
      bench.position.set(0, 0.38, -0.42);
      g.add(mat, trim, bench);
      for (const x of [-0.32, 0.32]) for (const z of [-0.54, -0.3]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.38, 0.04), wood);
        leg.position.set(x, 0.19, z); g.add(leg);
      }
      g.position.copy(LANDLORD_POS);
      this.w.scene.add(g);
      this.dais = g;
    }
    if (this.dais) this.dais.visible = !!on;
  }
}

function crowdLabel(crowd, m) { crowd.setLabel(m); }
export { spoken };
