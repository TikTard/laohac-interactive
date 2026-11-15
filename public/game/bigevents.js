import * as THREE from "three";
import * as ui from "./ui.js";
import * as sfx from "./audio.js";
import { CHARS, load } from "./world.js";
import { sleep, spoken } from "./brain.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TEAM_EMOJI = { tug: ["🔴", "🔵"], boat: ["🔴", "🟡", "🟢", "🟣"], lantern: ["🏮"] };
const RIVER_X = 70; // the river stage is built away from the village; the camera cuts there for the race

/**
 * Big group events: tug-of-war (2 sides), boat race (4 boats), sky lanterns (everyone together),
 * blindfold pot-breaking (steered by chat). Lão keeps commenting live the whole time.
 */
export class BigEvents {
  constructor(world, brain, story) {
    this.w = world;
    this.b = brain;
    this.story = story;
    this.ep = null;
    this.niuCtl = null;
    this.river = null;
  }

  // ---------------------------------------------------------------- shared
  teamOf(ep, name) {
    // the server sends recent joins; keep a name -> team map for labels
    return this.names?.get(name);
  }
  update(ep) {
    this.ep = ep;
    ui.updateTeams(ep);
    for (const j of ep.joins || []) {
      this.names.set(j.name, j.team);
      const t = ep.teams[j.team];
      // crowd villager wears the team emoji in their tag
      for (const m of this.b.crowd.members.values()) {
        if (m.user.name !== j.name || !m.v) continue;
        m.teamTag = TEAM_EMOJI[ep.type]?.[j.team] || "";
        m.v.label = m.teamTag + " " + m.user.name;
        this.b.tagVillager(m.v);
      }
      if (this.b.cooldown("team-join", 6)) this.lao("teamJoin", { name: spoken(j.name), team: t.name }, 1);
    }
  }
  onEvent(ev) {
    if (this.niuCtl && ev.type === "chat") this.niuCtl(ev);
  }
  /** Lão speaks; while the camera is away (river) his words go to the commentary box. */
  lao(kind, vars = {}, prio = 2) {
    return this.b.sayAs("lao", kind, vars, prio);
  }
  leader(ep) {
    const teams = ep.teams || [];
    let best = 0;
    teams.forEach((t, i) => { if (t.score > teams[best].score) best = i; });
    return teams[best];
  }
  /** Live commentary every few seconds until the server decides. */
  async commentate(c, kind) {
    let n = 0;
    while (!c.done) {
      const r = await Promise.race([c.result, sleep(7500)]);
      if (r || c.done) break;
      const ep = this.ep || c.ep;
      const lead = this.leader(ep);
      if (!lead || lead.score === 0) { this.lao(kind + "Call", {}, 1); continue; }
      this.lao(kind + "Lead", { team: lead.name, top: spoken((lead.top || [])[0] || "") }, 1);
      if (++n % 3 === 0) this.lao(kind + "Call", {}, 1);
    }
    return c.result;
  }
  /** Shout-out for the winning team: names on the honour board, winners step up front and dance, Lão reads their names. */
  async shoutout(ep) {
    const winners = ep?.winners || [];
    if (!winners.length) return;
    const b = this.b;
    const lantern = ep.type === "lantern";
    const team = lantern ? { name: "Cả làng", color: "#ffb347" } : ep.teams?.[ep.winner];
    if (!team) return;
    const emoji = lantern ? "🏮" : (TEAM_EMOJI[ep.type]?.[ep.winner] || "🏆");
    b.camFx?.clearShot();
    await sleep(600);
    ui.honor(`🏆 Bảng vàng · ${team.name}`, winners.map((w) => w.name), team.color, ep.winnersCount || winners.length, ep.winXp || 0);
    // winners who stand in the crowd come to the front row
    const ms = winners.map((w) => b.crowd.get(w.id)).filter((m) => m?.v && !m.v.dead).slice(0, 8);
    const n = ms.length;
    ms.forEach((m, i) => {
      m.busy = true;
      m.v.label = emoji + " " + m.user.name; m.v.labelClass = "tag lv5"; b.tagVillager(m.v);
      // an arc on both sides of Lão, keeping the middle free so he stays in view
      const side = i % 2 ? 1 : -1, k = (i >> 1);
      const x = side * (0.95 + k * 0.5);
      m.v.walk([V(x, 0, 1.05 + k * 0.12)]).then(() => { if (!m.v.dead) { m.v.face(x * 0.3, 8); m.v.dance(5.5); } });
    });
    if (n) b.camFx?.shot(V(0, 2.8, 7.6), V(0, 0.8, 0.9));
    ui.confetti(80);
    sfx.fanfare();
    b.fx.fireworks(3);
    // quick spotlight on the 3 best, one after another
    ms.slice(0, 3).forEach((m, i) => setTimeout(() => !m.v.dead && b.fx.spotlight(m.v.root, 1.8), 1500 + i * 1700));
    const spokenNames = winners.slice(0, 4).map((w) => spoken(w.name)).join(", ");
    const more = (ep.winnersCount || winners.length) - Math.min(4, winners.length);
    this.w.lao.rejoice(2.4);
    b.bark(2, "Gâu gâu! 🏆", true);
    await this.lao("bigShout", { team: team.name, names: spokenNames + (more > 0 ? ` và ${more} bạn nữa` : "") }, 3);
    await sleep(2500);
    b.camFx?.clearShot();
    ui.honor(null);
    this.restoreCrowd(ms);
  }

  restoreCrowd(list) {
    for (const m of list) {
      m.teamTag = "";
      if (this.b.crowd.members.get(m.user.id) === m) this.b.crowd.returnToSpot(m);
    }
  }
  resetTags() {
    for (const m of this.b.crowd.members.values()) if (m.teamTag) { m.teamTag = ""; if (!m.busy) this.b.crowd.setLabel(m); }
  }

  async play(c) {
    this.ep = c.ep;
    this.names = new Map();
    this.b.bigActive = true;
    try {
      if (c.ep.type === "tug") await this.tug(c);
      else if (c.ep.type === "boat") await this.boat(c);
      else if (c.ep.type === "lantern") await this.lantern(c);
      await this.shoutout(this.ep);
    } finally {
      this.b.bigActive = false;
      this.b.commentator = false;
      ui.commentary(null);
      this.b.camFx?.clearShot();
      this.resetTags();
    }
  }

  // ================================================================ KÉO CO hai phe
  async tug(c) {
    const b = this.b, ep = c.ep;
    const [A, B] = ep.teams; // A = Xóm Đông (right), B = Xóm Tây (left)
    ui.showTeams(ep, "🪢 Kéo co Xóm Đông – Xóm Tây", "Gõ “Đông” hoặc 1 · “Tây” hoặc 2 · tim & bình luận là sức kéo");
    b.camFx?.shot(V(0, 3.1, 5.4), V(0, 0.5, -1.1));
    this.lao("tugCall", {}, 3);
    const Z = -1.15;
    // rope + ribbon
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 6), new THREE.MeshStandardMaterial({ color: "#b89a5a", roughness: 1 }));
    rope.rotation.z = Math.PI / 2;
    const ribbon = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: "#d23b30" }));
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 0.9), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
    line.position.set(0, 0.015, Z);
    this.w.scene.add(rope, ribbon, line);
    // pullers: crowd members by team (filled with villagers when a side is short)
    const pullers = [[], []]; // [team] -> {v, m, slot}
    const fillers = [];
    const taken = new Set();
    const assign = async () => {
      for (const mm of b.crowd.members.values()) {
        if (taken.has(mm) || mm.busy || !mm.v || mm.v.dead) continue;
        const team = this.names.get(mm.user.name);
        if (team === undefined || pullers[team].length >= 4) continue;
        taken.add(mm);
        mm.busy = true;
        pullers[team].push({ v: mm.v, m: mm, slot: pullers[team].length });
      }
      for (const team of [0, 1]) {
        while (pullers[team].length < 2) {
          const v = await this.w.spawnVillager({ at: V(team === 0 ? 6 : -6, 0, -2.2), speedMul: 2 });
          fillers.push(v);
          pullers[team].push({ v, slot: pullers[team].length });
        }
      }
    };
    await assign();
    let offset = 0;
    const slotPos = (team, slot) => V((team === 0 ? 1 : -1) * (0.55 + slot * 0.5) + offset, 0, Z);
    const walkIn = (p, team) => p.v.walk([slotPos(team, p.slot)]).then(() => { p.ready = true; p.v.face(0, Z); });
    pullers.forEach((list, team) => list.forEach((p) => walkIn(p, team)));
    const pulling = new Set();
    const pullPose = (p) => {
      if (pulling.has(p)) return;
      pulling.add(p);
      p.v.play(999, (_, add, t) => {
        add("Body", "rot", "x", -0.35 + Math.sin(t * 8 + p.slot) * 0.05);
        add("ArmL", "rot", "x", -1.35); add("ArmR", "rot", "x", -1.35);
        add("LegL", "rot", "x", 0.3); add("LegR", "rot", "x", -0.2);
      });
    };
    const step = (dt) => {
      const e = this.ep || ep;
      const diff = Math.max(-1, Math.min(1, (e.teams[0].score - e.teams[1].score) / (e.target || 1)));
      offset += (diff * 1.0 - offset) * Math.min(1, dt * 2) + Math.sin(performance.now() / 160) * 0.002;
      for (const [team, list] of pullers.entries()) for (const p of list) {
        if (!p.ready) continue;
        pullPose(p);
        const target = slotPos(team, p.slot);
        p.v.root.position.x += (target.x - p.v.root.position.x) * Math.min(1, dt * 6);
      }
      rope.position.set(offset, 0.9, Z);
      rope.scale.y = 4.6;
      ribbon.position.set(offset, 0.86, Z);
    };
    this.w.tickers.add(step);
    // new viewers who pick a side join the rope
    const joiner = setInterval(async () => {
      const before = pullers[0].length + pullers[1].length;
      await assign();
      pullers.forEach((list, team) => list.forEach((p) => { if (!p.ready && !p.v.moving) walkIn(p, team); }));
      if (pullers[0].length + pullers[1].length > before) b.bark(1, "Gâu! 💪");
    }, 2500);
    const r = await this.commentate(c, "tug");
    clearInterval(joiner);
    this.w.tickers.delete(step);
    // result
    const e = this.ep || ep;
    const win = r.cancelled ? -1 : e.winner ?? (e.teams[0].score > e.teams[1].score ? 0 : e.teams[1].score > e.teams[0].score ? 1 : -1);
    for (const list of pullers) for (const p of list) { p.v.actions = []; }
    if (win >= 0) {
      const t = e.teams[win];
      ui.endTeams(`🏆 ${t.name} thắng!`);
      ui.banner(`🏆 ${t.name} thắng kéo co!`, (t.top || []).length ? "Kéo khỏe nhất: " + t.top.join(", ") : "", 4500);
      ui.confetti(100);
      sfx.fanfare();
      this.b.fx.fireworks(4);
      for (const p of pullers[win]) { p.v.jump(0.3); setTimeout(() => !p.v.dead && p.v.wave(2.2), 500); }
      for (const p of pullers[1 - win]) p.v.play(2.5, (q, add) => { const k = Math.sin(Math.min(1, q * 3) * Math.PI / 2); add("Body", "rot", "x", 0.5 * k); add("Body", "pos", "y", -0.25 * k); add("LegL", "rot", "x", -1.2 * k); add("LegR", "rot", "x", -1.2 * k); });
      this.w.lao.rejoice(2.6);
      this.b.bark(3, "Gâu gâu! 🎉", true);
      await this.lao("tugWin", { team: t.name, top: spoken((t.top || [])[0] || "") }, 3);
    } else {
      ui.endTeams(r.cancelled ? "Đã dừng" : "Hòa!");
      await this.b.sayText("lao", "Hòa rồi! Hai xóm khỏe ngang nhau, bắt tay làm lành nào!", 3);
    }
    this.w.scene.remove(rope, ribbon, line);
    rope.geometry.dispose(); ribbon.geometry.dispose(); line.geometry.dispose();
    this.b.camFx?.clearShot();
    await sleep(1500);
    this.restoreCrowd(pullers.flat().filter((p) => p.m).map((p) => p.m));
    for (const v of fillers) v.walk([V(v.root.position.x > 0 ? 8 : -8, 0, -2.2)]).then(() => this.w.remove(v));
  }

  // ================================================================ ĐUA THUYỀN (river stage)
  async buildRiver() {
    if (this.river) return this.river;
    const g = new THREE.Group();
    g.position.x = RIVER_X;
    // water with moving ripples
    const c = document.createElement("canvas");
    c.width = 64; c.height = 256;
    const x = c.getContext("2d");
    x.fillStyle = "#3f86a8"; x.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 70; i++) {
      x.strokeStyle = i % 2 ? "rgba(255,255,255,0.18)" : "rgba(20,60,90,0.25)";
      x.beginPath();
      const yy = Math.random() * 256;
      x.moveTo(Math.random() * 64, yy); x.lineTo(Math.random() * 64, yy + 2); x.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 10);
    tex.colorSpace = THREE.SRGBColorSpace;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 30), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25, metalness: 0.1 }));
    water.rotation.x = -Math.PI / 2; water.position.set(0, 0.02, -6);
    g.add(water);
    for (const s of [-1, 1]) {
      const bank = new THREE.Mesh(new THREE.BoxGeometry(6, 0.25, 30), new THREE.MeshStandardMaterial({ color: "#7d9a4a", roughness: 1 }));
      bank.position.set(s * 5.2, 0.1, -6);
      g.add(bank);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 30), new THREE.MeshStandardMaterial({ color: "#a58560", roughness: 1 }));
      edge.position.set(s * 2.25, 0.12, -6);
      g.add(edge);
    }
    // lane buoys
    for (const lx of [-1.1, 0, 1.1]) for (let z = -18; z < 3; z += 1.5) {
      const buoy = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: z % 3 ? "#ffffff" : "#d23b30" }));
      buoy.position.set(lx, 0.05, z);
      g.add(buoy);
    }
    // finish arch
    const archMat = new THREE.MeshStandardMaterial({ color: "#8c3d14" });
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.4, 8), archMat); p.position.set(s * 2.3, 2.2, 1.6); g.add(p); }
    const bc = document.createElement("canvas"); bc.width = 512; bc.height = 96;
    const bx = bc.getContext("2d"); bx.fillStyle = "#c8302a"; bx.fillRect(0, 0, 512, 96);
    bx.fillStyle = "#ffe08a"; bx.font = '700 64px "Noto Serif", serif'; bx.textAlign = "center"; bx.textBaseline = "middle"; bx.fillText("VỀ ĐÍCH", 256, 52);
    const btex = new THREE.CanvasTexture(bc); btex.colorSpace = THREE.SRGBColorSpace;
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.6), new THREE.MeshBasicMaterial({ map: btex, side: THREE.DoubleSide }));
    banner.position.set(0, 4.15, 1.6); // high up so it never hides the boats
    g.add(banner);
    // bamboo along the banks
    const bamboo = await load("bamboo_a");
    for (let i = 0; i < 8; i++) {
      const bb = bamboo.clone(true);
      bb.position.set((i % 2 ? 1 : -1) * (3.4 + Math.random() * 1.5), 0, -16 + i * 2.6);
      bb.scale.setScalar(0.8 + Math.random() * 0.3);
      bb.rotation.y = Math.random() * 6;
      g.add(bb);
    }
    this.w.scene.add(g);
    this.river = { g, tex };
    this.w.tickers.add((dt) => { tex.offset.y -= dt * 0.08; });
    return this.river;
  }

  makeBoat(color) {
    const boat = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 1.5), hullMat);
    hull.position.y = 0.08;
    boat.add(hull);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 8), new THREE.MeshStandardMaterial({ color: "#e8c041", metalness: 0.4 }));
    head.rotation.x = Math.PI / 2; head.position.set(0, 0.2, 0.92);
    boat.add(head);
    const rowers = [];
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.3, 8), new THREE.MeshStandardMaterial({ color: i === 1 ? "#f3ead5" : "#6b4a33" }));
      body.position.y = 0.32;
      const hd = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: "#d9a27a" }));
      hd.position.y = 0.53;
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.08, 12), new THREE.MeshStandardMaterial({ color: "#e6d3a0" }));
      hat.position.y = 0.6;
      const oar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.05), new THREE.MeshStandardMaterial({ color: "#7a5a36" }));
      oar.position.set(0.2, 0.3, 0);
      r.add(body, hd, hat, oar);
      r.position.z = -0.45 + i * 0.45;
      boat.add(r);
      rowers.push({ r, oar });
    }
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 4), new THREE.MeshStandardMaterial({ color: "#5b3a22" }));
    flagPole.position.set(0, 0.45, -0.68);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.18), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide }));
    flag.position.set(0.14, 0.66, -0.68);
    boat.add(flagPole, flag);
    return { boat, rowers, flag };
  }

  async boat(c) {
    const b = this.b, ep = c.ep;
    ui.showTeams(ep, "🚣 Đua thuyền", "Gõ Đỏ / Vàng / Xanh / Tím (hoặc 1–4) để lên thuyền · tim & bình luận là chèo");
    const river = await this.buildRiver();
    const lanes = [-1.65, -0.55, 0.55, 1.65];
    const START = -17, FINISH = 1.6;
    const boats = ep.teams.map((t, i) => {
      const bt = this.makeBoat(t.color);
      bt.boat.position.set(lanes[i], 0, START);
      river.g.add(bt.boat);
      bt.z = START;
      bt.key = "boat-" + i;
      ui.label(bt.key, ui.esc(TEAM_EMOJI.boat[i] + " " + t.name), "tag", (v) => v.copy(bt.boat.position).add({ x: RIVER_X, y: 1.0, z: 0 }));
      return bt;
    });
    // cut to the river; Lão keeps commenting from the commentary box
    b.commentator = true;
    b.camFx?.shot(V(RIVER_X, 4.4, 7.4), V(RIVER_X, 0, -5.5));
    ui.banner("🚣 Đua thuyền trên sông!", "Bà con chọn thuyền và chèo nào!", 3500);
    this.lao("boatCall", {}, 3);
    let t = 0;
    const step = (dt) => {
      t += dt;
      const e = this.ep || ep;
      boats.forEach((bt, i) => {
        const target = START + Math.min(1, e.teams[i].score / (e.target || 1)) * (FINISH - START);
        bt.z += (target - bt.z) * Math.min(1, dt * 1.6);
        bt.boat.position.set(lanes[i], Math.sin(t * 3 + i) * 0.02, bt.z);
        bt.boat.rotation.z = Math.sin(t * 2.5 + i) * 0.03;
        const pace = 6 + Math.min(10, (e.teams[i].score / (e.target || 1)) * 10);
        bt.rowers.forEach((r, k) => { r.oar.rotation.y = Math.sin(t * pace + k * 0.6) * 0.6; r.r.rotation.x = Math.sin(t * pace + k * 0.6) * 0.15; });
        bt.flag.rotation.y = Math.sin(t * 6 + i) * 0.3;
        ui.label(bt.key, ui.esc(TEAM_EMOJI.boat[i] + " " + e.teams[i].name + ((e.teams[i].top || [])[0] ? " · " + e.teams[i].top[0] : "")), "tag", (v) => v.copy(bt.boat.position).add({ x: RIVER_X, y: 1.0, z: 0 }));
      });
    };
    this.w.tickers.add(step);
    const r = await this.commentate(c, "boat");
    const e = this.ep || ep;
    const win = r.cancelled ? -1 : e.winner ?? -1;
    if (win >= 0) {
      const tm = e.teams[win];
      // the winner surges over the line
      const bt = boats[win];
      for (let i = 0; i < 30; i++) { bt.z += (FINISH + 0.4 - bt.z) * 0.15; await sleep(30); }
      ui.endTeams(`🏆 ${tm.name} về nhất!`);
      ui.banner(`🏆 ${tm.name} về nhất!`, (tm.top || []).length ? "Chèo khỏe nhất: " + tm.top.join(", ") : "", 4500);
      ui.confetti(100);
      sfx.fanfare();
      for (let i = 0; i < 6; i++) setTimeout(() => this.b.fx.burst(V(RIVER_X + (Math.random() - 0.5) * 4, 4 + Math.random() * 2, -3 - Math.random() * 4), { n: 70, colors: [tm.color, "#ffffff", "#ffd54a"], speed: 3, gravity: 1.2, life: 1.8, size: 0.15 }), i * 350);
      await this.lao("boatWin", { team: tm.name, top: spoken((tm.top || [])[0] || "") }, 3);
    } else {
      ui.endTeams(r.cancelled ? "Đã dừng" : "Hòa!");
      await this.b.sayText("lao", "Các thuyền về cùng lúc! Hòa cả làng!", 3);
    }
    await sleep(1500);
    this.w.tickers.delete(step);
    for (const bt of boats) { ui.unlabel(bt.key); river.g.remove(bt.boat); }
    b.commentator = false;
    ui.commentary(null);
    b.camFx?.clearShot();
    this.w.lao.rejoice(2);
  }

  // ================================================================ THẢ ĐÈN TRỜI (everyone together)
  async lantern(c) {
    const b = this.b, ep = c.ep;
    ui.showTeams(ep, "🏮 Thả đèn trời", "Cả làng cùng thả tim, bình luận — mỗi chút lửa là một chiếc đèn bay lên");
    b.camFx?.shot(V(0, 1.6, 6.4), V(0, 3.2, -4));
    this.lao("lanternCall", {}, 3);
    const lanterns = [];
    let released = 0;
    const spawnLantern = (name) => {
      if (lanterns.length > 45) return;
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.09, 0.28, 10, 1, true),
        new THREE.MeshStandardMaterial({ color: "#ffb347", emissive: "#ff8a1a", emissiveIntensity: 1.4, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
      const glow = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, -0.05, 0]), 3)),
        new THREE.PointsMaterial({ color: "#ffd27a", size: 0.6, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      g.add(body, glow);
      g.position.set((Math.random() - 0.5) * 4, 1.2, -1.5 - Math.random() * 1.5);
      this.w.scene.add(g);
      const l = { g, vy: 0.45 + Math.random() * 0.25, sway: Math.random() * 6, key: name && released < 10 ? "lan-" + released : null };
      if (l.key) ui.label(l.key, ui.esc("🏮 " + name), "tag lv5", (v) => v.copy(g.position).add({ x: 0, y: 0.35, z: 0 }), 5000);
      lanterns.push(l);
      released++;
    };
    const step = (dt) => {
      for (const l of [...lanterns]) {
        l.sway += dt;
        l.g.position.y += l.vy * dt;
        l.g.position.x += Math.sin(l.sway * 0.8) * 0.004;
        l.g.position.z -= dt * 0.15;
        if (l.g.position.y > 13) {
          this.w.scene.remove(l.g);
          l.g.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
          lanterns.splice(lanterns.indexOf(l), 1);
        }
      }
    };
    this.w.tickers.add(step);
    // one lantern per 15 points, carrying the name of someone who helped
    let lastProgress = 0;
    const feeder = setInterval(() => {
      const e = this.ep || ep;
      const tops = e.teams[0].top || [];
      while (e.progress - lastProgress >= 15) {
        lastProgress += 15;
        spawnLantern(tops[(Math.random() * tops.length) | 0]);
      }
    }, 400);
    const r = await this.commentate(c, "lantern");
    clearInterval(feeder);
    if (r.success) {
      ui.endTeams("🏮 Đèn trời bay đầy trời!");
      for (let i = 0; i < 25; i++) setTimeout(() => spawnLantern(), i * 120);
      this.b.fx.fireworks(6);
      ui.banner("🏮 Đèn trời bay đầy trời!", "Chúc cả làng bình an, may mắn!", 4500);
      this.b.crowd.cheer();
      await this.lao("lanternWin", {}, 3);
    } else {
      ui.endTeams(r.cancelled ? "Đã dừng" : "Đèn trời đã bay lên!");
      await this.lao("lanternPart", {}, 3);
    }
    await sleep(6000);
    b.camFx?.clearShot();
    await sleep(6000);
    this.w.tickers.delete(step);
    for (const l of lanterns) this.w.scene.remove(l.g);
  }

  // ================================================================ BỊT MẮT ĐẬP NIÊU (chat steers the player)
  async niu() {
    const b = this.b;
    const secs = b.cfg().bigEvents?.niu?.seconds || 70;
    b.bigActive = true;
    // the player: a viewer from the crowd if possible
    const idle = [...b.crowd.members.values()].filter((m) => !m.busy && m.v && !m.v.dead);
    const m = idle[(Math.random() * idle.length) | 0];
    let v, name;
    if (m) { m.busy = true; v = m.v; name = m.user.name; }
    else { v = await this.w.spawnVillager({ variant: CHARS.child, at: V(-5, 0, -1.8), speedMul: 1.6 }); name = "Thằng Cu"; }
    const start = V(-1.3, 0, 2.3);
    const pot = V((Math.random() - 0.2) * 2.2, 0, 0.95 + Math.random() * 0.9);
    // the pot hanging from a little bamboo frame
    const frame = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: "#a99a5a" });
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 6), poleMat); p.position.set(s * 0.45, 0.85, 0); frame.add(p); }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.95, 6), poleMat); bar.rotation.z = Math.PI / 2; bar.position.y = 1.68; frame.add(bar);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.4, 4), new THREE.MeshStandardMaterial({ color: "#d8c9a3" })); rope.position.y = 1.48; frame.add(rope);
    const niu = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), new THREE.MeshStandardMaterial({ color: "#8a5532", roughness: 0.8 }));
    niu.scale.set(1, 0.85, 1); niu.position.y = 1.2; frame.add(niu);
    frame.position.copy(pot);
    this.w.scene.add(frame);
    // blindfold + stick
    const head = v.root.getObjectByName("Head"), armR = v.root.getObjectByName("ArmR");
    const blind = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 6, 20), new THREE.MeshStandardMaterial({ color: "#1b1b1b" }));
    blind.position.y = 0.27; blind.rotation.x = Math.PI / 2;
    head?.add(blind);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 6), new THREE.MeshStandardMaterial({ color: "#7a5a36" }));
    stick.position.set(0, -0.6, 0.25); stick.rotation.x = 0.6;
    armR?.add(stick);
    await v.walk([V(start.x, 0, 1.6), start]);
    v.face(0, -5);
    v.label = "🙈 " + name; v.labelClass = "tag lv4"; b.tagVillager(v);
    b.camFx?.shot(V(0.3, 4.3, 8.4), V(0.3, 0.4, 1.4));
    ui.banner("🙈 Bịt mắt đập niêu!", "Gõ: trái · phải · lên · xuống · đập", 3500);
    ui.showTeams({ type: "niu", teams: [], seconds: secs }, "🙈 Bịt mắt đập niêu", `Chỉ đường cho ${name}: gõ trái / phải / lên / xuống / đập`);
    this.lao("niuCall", { name: spoken(name) }, 3);
    const STEP = 0.3;
    const queue = [];
    let busy = false, done = false, hits = 0;
    const dist = () => Math.hypot(v.root.position.x - pot.x, v.root.position.z - pot.z);
    const cmd = (w) => {
      if (/^(trai|left|t)$/.test(w)) return "L";
      if (/^(phai|right|p)$/.test(w)) return "R";
      if (/^(len|tien|up|toi)$/.test(w)) return "U";
      if (/^(xuong|lui|down|ve)$/.test(w)) return "D";
      if (/^(dap|danh|hit|go)$/.test(w)) return "H";
      return null;
    };
    const strip = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d");
    this.niuCtl = (ev) => {
      const c = strip(ev.text).split(/[^a-z]+/).map(cmd).find(Boolean);
      if (!c || queue.length > 4) return;
      queue.push({ c, who: ev.user.name });
    };
    const run = async () => {
      if (busy || done || !queue.length) return;
      busy = true;
      const { c, who } = queue.shift();
      ui.label("niu-cmd", ui.esc(`${who}: ${{ L: "⬅️ trái", R: "➡️ phải", U: "⬆️ lên", D: "⬇️ xuống", H: "🔨 đập!" }[c]}`), "bubble small", (p) => p.copy(v.root.position).add({ x: 0, y: v.height + 0.4, z: 0 }), 1200);
      if (c === "H") {
        v.give(0.7);
        await sleep(350);
        if (dist() < 0.42) {
          done = true;
          sfx.thud();
          this.b.fx.burst(V(pot.x, 1.2, pot.z), { n: 60, colors: ["#8a5532", "#ffd54a", "#ff6b8a", "#7ee0ff"], speed: 2.5, gravity: 3, life: 1.4, size: 0.1 });
          frame.remove(niu);
        } else {
          hits++;
          // the stick lands on Lão or Cậu Vàng instead of the pot: a little comedy
          const p = v.root.position;
          const dLao = Math.hypot(p.x - this.w.lao.root.position.x, p.z - this.w.lao.root.position.z);
          const dDog = Math.hypot(p.x - this.w.dog.root.position.x, p.z - this.w.dog.root.position.z);
          if (dDog < 0.6 && !this.dogRunning) { sfx.thud(); this.niuHitDog(v); }
          else if (dLao < 0.65 && !this.laoFallen) { sfx.thud(); this.niuHitLao(v, who); }
          else { sfx.pop(); ui.label("niu-miss", "Hụt! 😅", "bubble dog", (o) => o.copy(v.root.position).add({ x: 0.3, y: v.height + 0.2, z: 0 }), 900); }
        }
      } else {
        const d = { L: [-STEP, 0], R: [STEP, 0], U: [0, -STEP], D: [0, STEP] }[c];
        const to = v.root.position.clone().add({ x: d[0], y: 0, z: d[1] });
        to.x = Math.max(-2.2, Math.min(2.2, to.x)); to.z = Math.max(-0.2, Math.min(2.8, to.z)); // can wander right up to Lão and Cậu Vàng
        await v.walk([to]);
        v.face(0, -5);
      }
      busy = false;
    };
    const loop = setInterval(run, 250);
    const end = performance.now() + secs * 1000;
    let lastHint = performance.now();
    while (!done && performance.now() < end) {
      await sleep(400);
      if (performance.now() - lastHint > 9000) {
        lastHint = performance.now();
        this.b.sayText("lao", dist() < 0.8 ? "Gần lắm rồi! Gần lắm rồi bà con ơi!" : this.b.line("niuHint"), 1);
      }
    }
    clearInterval(loop);
    this.niuCtl = null;
    ui.unlabel("niu-cmd");
    if (done) {
      ui.endTeams("🎉 Vỡ niêu rồi!");
      ui.confetti(90);
      sfx.fanfare();
      v.dance(2.6);
      this.b.crowd.cheer();
      await this.lao("niuWin", { name: spoken(name) }, 3);
    } else {
      ui.endTeams("⌛ Hết giờ!");
      await this.lao("niuFail", {}, 3);
    }
    while (this.laoFallen || this.dogRunning) await sleep(300); // let the comedy finish
    head?.remove(blind); armR?.remove(stick);
    blind.geometry.dispose(); stick.geometry.dispose();
    await sleep(1200);
    this.w.scene.remove(frame);
    b.camFx?.clearShot();
    b.bigActive = false;
    if (m) { this.b.crowd.setLabel(m); this.b.crowd.returnToSpot(m); }
    else { await v.walk([V(-5, 0, -1.8)]); this.w.remove(v); }
  }

  /** Đập trúng Lão Hạc: he topples over backwards and "ăn vạ" (makes a big fuss) on the ground, then gets up. */
  async niuHitLao(v, who) {
    this.laoFallen = true;
    const lao = this.w.lao, root = lao.root, b = this.b;
    const x0 = root.rotation.x, y0 = root.position.y;
    ui.label("niu-miss", "Bốp! Trúng Lão! 😱", "bubble dog", (o) => o.copy(root.position).add({ x: 0, y: 1.5, z: 0 }), 1400);
    b.fx.burst(lao.worldPos("Head", new THREE.Vector3()), { n: 14, colors: ["#ffd54a", "#ffffff"], speed: 1.6, gravity: 1, life: 0.8, size: 0.08 });
    // topple backwards
    await lao.play(0.55, (p, add) => { root.rotation.x = x0 - 1.25 * p * p; root.position.y = y0 + Math.sin(p * Math.PI) * 0.08; add("ArmL", "rot", "z", -1.6 * p); add("ArmR", "rot", "z", 1.6 * p); });
    sfx.thud();
    const lines = [
      "Ối giời ơi! Bà con làng nước ơi! Nó đập lão rồi!",
      "Ái chà chà, gãy lưng lão rồi! Đền đi, đền cho lão một bát cháo!",
      "Ối ối! Lão nằm đây không dậy nữa đâu! Ai đỡ lão dậy thì lão mới dậy!",
    ];
    ui.label("lao-vạ", "😭 Ăn vạ!", "bubble dog", (o) => o.copy(root.position).add({ x: 0, y: 0.9, z: 0 }), 4200);
    const wail = b.sayText("lao", lines[(Math.random() * lines.length) | 0], 3);
    // lying on his back, kicking and flailing
    await lao.play(3.6, (p, add, t) => {
      root.rotation.x = x0 - 1.25 + Math.sin(t * 9) * 0.04;
      add("ArmL", "rot", "z", -1.6 + Math.sin(t * 11) * 0.7);
      add("ArmR", "rot", "z", 1.6 - Math.sin(t * 11 + 1) * 0.7);
      add("Head", "rot", "y", Math.sin(t * 6) * 0.5);
    });
    await wail;
    if (who) ui.feed(`😂 <b>${ui.esc(who)}</b> chỉ đường thế nào mà đập trúng Lão!`);
    // gets back up, grumbling
    await lao.play(0.9, (p) => { root.rotation.x = x0 - 1.25 * (1 - p) * (1 - p); });
    root.rotation.x = x0; root.position.y = y0;
    b.sayText("lao", "Hừ… thôi được rồi, lão tha cho đấy! Đập cái niêu kia kìa!", 2);
    v.bow?.();
    this.laoFallen = false;
  }

  /** Đập trúng Cậu Vàng: a yelp, he bolts round the yard, then comes back sulking to Lão. */
  async niuHitDog(v) {
    this.dogRunning = true;
    const st = this.story, dog = this.w.dog, b = this.b;
    sfx.whine?.();
    ui.label("dog-say", "Ẳng ẳng! 😵", "bubble dog", (o) => dog.worldPos("Head", o).add({ x: 0, y: 0.38, z: 0 }), 1500);
    dog.lookAt = null;
    b.sayText("lao", "Ối! Cậu Vàng của lão! Vàng ơi chạy đi đâu đấy!", 3);
    const loop = [new THREE.Vector3(-2.4, 0, 1.2), new THREE.Vector3(-2.9, 0, -0.6), new THREE.Vector3(-1.2, 0, -1.6), new THREE.Vector3(1.6, 0, -1.2), new THREE.Vector3(2.6, 0, 0.6)];
    for (const [i, p] of loop.entries()) {
      await st.dogRun(p, 4.2);
      if (i % 2 === 0) { sfx.bark(1, true); ui.label("dog-say", ["Ẳng!", "Ư ử…", "Gâu! 😤"][i % 3], "bubble dog", (o) => dog.worldPos("Head", o).add({ x: 0, y: 0.38, z: 0 }), 900); }
    }
    // hides behind Lão, then sulks back to his place
    await st.dogRun(new THREE.Vector3(0.3, 0, -0.55), 3.5);
    ui.label("dog-say", "Ư ử… 🥺", "bubble dog", (o) => dog.worldPos("Head", o).add({ x: 0, y: 0.38, z: 0 }), 2000);
    await sleep(1200);
    await st.dogHome();
    b.sayText("lao", "Thôi, không sao, không sao. Lão xoa đầu cậu Vàng đây.", 2);
    dog.happy(1.2);
    this.dogRunning = false;
  }
}
