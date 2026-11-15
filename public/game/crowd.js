import * as THREE from "three";
import * as ui from "./ui.js";
import { VARIANTS } from "./world.js";
import { decorate, rankLabel, rankClass } from "./ranks.js";
import { applySkin } from "./skins.js";
import { skinById } from "./skincatalog.js";
import { LANDLORD_POS } from "./landlord.js";
// no shoulder poles / big baskets in the crowd: they would hide the village
const CROWD_VARIANTS = VARIANTS.filter((v) => v.swingR !== false && v.swingL !== false);

const V = (x, z) => new THREE.Vector3(x, 0, z);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Places behind Lão Hạc where viewers stand and watch (front rows first). Lão sits at (0, 0) facing the camera.
const SPOTS = [
  V(-1.6, -0.45), V(1.75, -0.7), // VIP ("chiếu trên"): level 5+
  V(-1.25, -1.0), V(1.25, -1.0), V(-0.7, -1.3), V(0.7, -1.3), V(-1.8, -1.35), V(1.8, -1.35),
  V(0, -1.55), V(-1.3, -1.75), V(1.3, -1.75), V(-0.55, -1.95), V(0.55, -1.95), V(-2.15, -1.9),
  V(2.15, -1.9), V(0, -2.35), V(-1.6, -2.4), V(1.6, -2.4), V(-0.9, -2.6), V(0.9, -2.6),
];
// big lives (up to 200 viewers): more rows further back, a little wider each row, staggered,
// keeping a corridor in the middle (x ≈ 0) so story characters can still walk from the gate to Lão
export const MAX_CROWD = 200;
for (let r = 0; SPOTS.length < MAX_CROWD; r++) {
  const z = -3.0 - r * 0.45;
  const half = Math.min(7, 2.6 + r * 0.4);
  const off = r % 2 ? 0.3 : 0;
  for (let x = 0.75 + off; x <= half && SPOTS.length < MAX_CROWD; x += 0.6) {
    SPOTS.push(V(-x, z + (Math.random() - 0.5) * 0.1));
    if (SPOTS.length < MAX_CROWD) SPOTS.push(V(x, z + (Math.random() - 0.5) * 0.1));
  }
}
/** Which places a level may take, best first. Higher levels stand closer to Lão. */
function spotOrder(level) {
  const all = SPOTS.map((_, i) => i);
  if (level >= 5) return all;                                   // VIP first, then everything
  const front = [2, 3, 4, 5], vip = [0, 1];
  if (level >= 3) return [...front, ...all.filter((i) => i > 5)]; // front row first, never VIP
  return [...all.filter((i) => i > 5), ...front];                 // newcomers fill the back rows first
}
const PRIO = { join: 0, like: 1, levelup: 1, follow: 2, share: 2, subscribe: 3, chat: 3, gift: 4 };
const MIN_STAY_MS = 45000; // a viewer keeps their place at least this long, so the crowd doesn't churn on busy lives
const CHATTER = [
  "Kìa, cậu Vàng kìa!", "Lão Hạc đấy!", "Con chó khôn ghê!", "Ê, nhìn kìa!", "Hôm nay đông vui nhỉ!",
  "Vàng vẫy đuôi kìa!", "Hay quá!", "Ha ha!", "Lão kể chuyện hay ghê!", "Đẹp cổng làng nhỉ!",
];

/**
 * The live audience standing behind Lão Hạc: everyone who joins / interacts gets a villager with their name.
 * They point, chat with neighbours and comment; when they gift they step forward, give and dance, then go back.
 * TikTok sends no "viewer left" event, so a viewer leaves after crowdStaySeconds without any interaction.
 */
export class Crowd {
  constructor(world, brain) {
    this.w = world;
    this.b = brain;
    this.members = new Map(); // userId -> { user, v, spot, lastSeen, busy }
    this.pending = [];
    this.lastSpawn = 0;
    this.nextGossip = 2;
  }

  get(id) { return this.members.get(id); }

  /** Any interaction keeps a viewer in the crowd (and brings them in if they are not there yet). */
  touch(user, kind = "join") {
    if (!user?.id || user.id === "unknown") return null;
    const score = PRIO[kind] ?? 1;
    const m = this.members.get(user.id);
    if (m) {
      m.lastSeen = performance.now();
      m.prio = Math.max(m.prio || 0, score);
      if (score > 0) m.lastActive = performance.now();
      let relabel = (user.name && user.name !== m.user.name) || (user.level && user.level !== m.user.level);
      if (typeof user.skin === "string" && user.skin !== (m.user.skin || "")) { // meme costume changed (chat "đổi …")
        m.user.skin = user.skin;
        if (m.v && !m.v.dead) applySkin(m.v, user.skin);
        relabel = true;
      }
      if (user.name) m.user.name = user.name;
      if (user.level && user.level >= (m.user.level || 1)) { m.user.level = user.level; m.user.title = user.title; }
      if (relabel && m.v && (!m.busy || user.skin !== undefined)) { this.setLabel(m); if ((m.v.decor?.level || 1) !== (m.user.level || 1)) decorate(m.v, m.user.level, this.w); }
      return m;
    }
    this.join(user, score);
    return null;
  }

  join(user, score = 0) {
    if (!user?.id || user.id === "unknown" || this.members.has(user.id)) return;
    const p = this.pending.find((u) => u.id === user.id);
    if (p) {
      p.at = performance.now();
      p.score = Math.max(p.score || 0, score);
      if (user.level) { p.level = user.level; p.title = user.title; }
      if (typeof user.skin === "string") p.skin = user.skin;
      return;
    }
    this.pending.push({ ...user, at: performance.now(), score });
    if (this.pending.length > 250) {
      // too many waiting: forget the least interesting (lowest priority, oldest) first
      this.pending.sort((a, b) => (a.score - b.score) || (a.at - b.at));
      this.pending.splice(0, this.pending.length - 250);
    }
  }

  /** Who should make room for a newcomer with priority `score` (null = nobody). */
  victimFor(score) {
    const now = performance.now();
    const list = [...this.members.values()].filter((m) => {
      if (m.busy || m.landlord || !m.v || m.v.dead || m.chatUntil > now) return false;
      const age = now - m.joinedAt, prio = m.prio || 0, quiet = now - (m.lastActive || m.joinedAt);
      if (prio < score && age > (prio === 0 ? 8000 : 20000)) return true; // lower priority (e.g. only opened the live)
      if (prio <= score && age > MIN_STAY_MS && quiet > 60000) return true; // same priority but quiet for a minute
      // very busy live (everyone chatting): after 90 s on stage, make room so more viewers get a turn
      // (high levels, the landlord, people talking / giving right now keep their place)
      return score >= 3 && prio <= score && age > 90000 && (m.user.level || 1) < 3 && this.pending.length >= 3;
    });
    list.sort((a, b) => ((a.prio || 0) - (b.prio || 0)) || ((a.lastActive || a.joinedAt) - (b.lastActive || b.joinedAt)));
    return list[0] || null;
  }

  /**
   * A viewer typed in the live chat: their villager says it (bubble + talking), pointing when it is about Vàng / Lão.
   * Someone not on screen yet says it as soon as they arrive.
   */
  say(user, text) {
    text = String(text || "").trim();
    if (!text || !user?.id) return;
    const m = this.members.get(user.id);
    if (!m || !m.v || m.v.dead) {
      const p = this.pending.find((u) => u.id === user.id);
      if (p) { p.chat = text; p.chatAt = performance.now(); }
      if (m) { m.chat = text; m.chatAt = performance.now(); }
      setTimeout(() => {
        const mm = this.members.get(user.id);
        if (mm?.v && !mm.v.dead) return; // arrived: the bubble shows over their head
        ui.feed(`💬 <b>${ui.esc(user.name)}</b>: ${ui.esc(text.slice(0, 80))}`, user.avatar, user.name);
      }, 2500);
      return;
    }
    const v = m.v;
    const now = performance.now();
    const ms = Math.min(7000, 2600 + text.length * 70);
    m.chatUntil = now + ms;
    ui.label("c-" + v.id, ui.esc(text.slice(0, 80)), "bubble small", (p) => (v.dead ? null : p.copy(v.root.position).add({ x: 0, y: v.height + 0.35, z: 0 })), ms);
    if (m.busy) return; // walking up to give: just the bubble
    const t = text.toLowerCase();
    v.face(0, 0.3);
    v.talking = true;
    clearTimeout(m.talkTimer);
    m.talkTimer = setTimeout(() => { v.talking = false; }, Math.min(ms, 3500));
    if (/v[aà]ng|ch[oó]|g[aâ]u/.test(t)) {
      const d = this.w.dog.root.position;
      v.face(d.x, d.z);
      v.point(1.6);
    } else if (/l[aã]o|[oô]ng|c[uụ]/.test(t)) {
      v.point(1.6);
    } else if (/haha|hihi|:\)|😂|🤣|vui|hay/.test(t)) {
      v.jump(0.15);
    }
  }

  setLabel(m) {
    const sk = m.user.skin ? skinById(m.user.skin) : null;
    m.v.label = (m.spamTag || "") + (sk ? sk.emoji + " " : "") + (m.landlord ? "🏯 Địa chủ · " + m.user.name : rankLabel(m.user.level, m.user.title, m.user.name));
    m.v.labelClass = m.landlord ? "tag lv6 landlord" : rankClass(m.user.level);
    this.b.tagVillager(m.v);
  }

  freeSpot(level = 1) {
    const used = new Set([...this.members.values()].map((m) => m.spot));
    return spotOrder(level).find((i) => !used.has(i)) ?? -1;
  }

  /** Move to a better place if one is free for the member's (new) level. */
  spotPos(m) { return m.landlord ? LANDLORD_POS : SPOTS[m.spot] || SPOTS[SPOTS.length - 1]; }

  async moveUp(m) {
    if (m.landlord) return;
    const order = spotOrder(m.user.level || 1);
    const used = new Set([...this.members.values()].filter((o) => o !== m).map((o) => o.spot));
    const best = order.find((i) => !used.has(i));
    if (best === undefined || order.indexOf(best) >= order.indexOf(m.spot)) return;
    m.spot = best;
    await m.v.walk([SPOTS[best]]);
    if (!m.v.dead) m.v.face(0, 0.3);
  }

  /** Level up: spotlight + camera on them, new outfit, cheers, then a better place. */
  /** Level-up without the spotlight (many winners at once): new look + a few firecrackers. */
  quietLevelUp(m) {
    const v = m.v;
    if (!v || v.dead) return;
    decorate(v, m.user.level, this.w);
    this.setLabel(m);
    this.b.fx.firecrackers(v.root.position, 4);
    v.jump(0.3);
  }

  async celebrate(m) {
    const b = this.b, v = m.v;
    if (!v || v.dead) return;
    m.busy = true;
    const pos = v.root.position;
    b.camFx?.focus((out) => (v.dead ? null : out.copy(v.root.position)), 3.2, 3);
    b.fx.spotlight(v.root, 3.4);
    b.fx.firecrackers(pos, 10);
    decorate(v, m.user.level, this.w);
    this.setLabel(m);
    v.face(0.3, 6);
    v.dance(3);
    ui.banner(`🎉 ${m.user.name} lên cấp ${m.user.level}!`, `Danh hiệu mới: ${m.user.title}`, 4000);
    ui.hearts(5, 0.5, 0.7);
    b.w.lao.lookAt = pos;
    b.say("levelUpLao", m.user.name, { title: m.user.title }, 2);
    for (const o of this.members.values()) {
      if (o === m || o.busy || !o.v || o.v.dead) continue;
      o.v.face(pos.x, pos.z);
      if (o.v.root.position.distanceTo(pos) < 2) o.v.wave(2.2);
    }
    await sleep(3400);
    if (b.w.lao.lookAt === pos) b.w.lao.lookAt = null;
    if (this.members.get(m.user.id) === m) await this.moveUp(m);
    m.lastSeen = performance.now();
    m.busy = false;
  }

  max() {
    return Math.max(0, Math.min(SPOTS.length, Number(this.b.cfg().game.maxNamedVillagers ?? 12) || 0));
  }

  /** Make room: the viewer who has been quiet the longest walks away (but nobody before MIN_STAY). */
  evictOne(score = 4) {
    const v = this.victimFor(score);
    if (v) this.leave(v);
    return !!v;
  }

  /** Bring a viewer into the crowd. `villager` = reuse someone already on screen (e.g. a donor who just gave). */
  async enter(user, villager = null) {
    if (this.members.has(user.id)) {
      if (villager && this.members.get(user.id).v !== villager) this.walkOff(villager);
      return this.members.get(user.id);
    }
    if ((this.members.size >= this.max() || this.freeSpot(user.level || 1) < 0) && !this.evictOne(user.score ?? 4)) {
      if (villager) this.walkOff(villager);
      return null;
    }
    const level = user.level || 1;
    const spot = this.freeSpot(level);
    if (spot < 0) { if (villager) this.walkOff(villager); return null; }
    const m = { user: { id: user.id, name: user.name, avatar: user.avatar, level, title: user.title || "", skin: user.skin || "" }, spot, lastSeen: performance.now(), joinedAt: performance.now(), busy: true,
      prio: user.score || 0, lastActive: (user.score || 0) > 0 ? performance.now() : 0 };
    this.members.set(user.id, m);
    const side = SPOTS[spot].x >= 0 ? 1 : -1;
    const v = villager || (await this.w.spawnVillager({ at: V(side * (6 + Math.random()), -2.2 + (Math.random() - 0.5) * 0.4), speedMul: 1.4, variant: CROWD_VARIANTS[(Math.random() * CROWD_VARIANTS.length) | 0] }));
    if (!this.members.has(user.id)) { this.walkOff(v); return null; } // left while spawning
    m.v = v;
    v.userId = user.id;
    v.crowd = true;
    v.ambient = false;
    this.b.byUser.set(user.id, v);
    this.setLabel(m);
    decorate(v, level, this.w);
    if (m.user.skin) applySkin(v, m.user.skin);
    {
      const early = m.chat || user.chat;
      const earlyAt = m.chat ? m.chatAt : user.chatAt;
      if (early && performance.now() - earlyAt < 45000) { m.chat = null; user.chat = null; this.say(m.user, early); }
    }
    const target = SPOTS[spot];
    await v.walk(villager ? [target] : [V(target.x * 0.8 + side * 0.6, -2.3), target]);
    if (v.dead || this.members.get(user.id) !== m) return null;
    v.face(0, 0.3);
    m.busy = false;
    const b = this.b;
    // they typed something while walking in: say it now
    const late = this.pending.find((u) => u.id === user.id) || user;
    const chat = m.chat || late.chat;
    const chatAt = m.chat ? m.chatAt : late.chatAt;
    if (chat && performance.now() - chatAt < 45000) { m.chat = null; this.say(m.user, chat); return m; }
    if (!villager && b.cfg().game.greetPassers && !b.story?.busy && b.voice.idleFor > 2 && b.cooldown("greet", 20)) {
      b.w.lao.lookAt = v.root.position;
      b.say("passerGreet", user.name, {}, 0);
      v.wave(2.4);
      setTimeout(() => { if (b.w.lao.lookAt === v.root.position) b.w.lao.lookAt = null; }, 3000);
    }
    return m;
  }

  /** Viewer leaves the crowd and walks off along the village road. */
  leave(m) {
    if (this.members.get(m.user.id) === m) this.members.delete(m.user.id);
    if (this.b.byUser.get(m.user.id) === m.v) this.b.byUser.delete(m.user.id);
    m.busy = true;
    if (m.v) this.walkOff(m.v);
  }

  walkOff(v) {
    if (!v || v.dead) return;
    v.crowd = false;
    const side = v.root.position.x >= 0 ? 1 : -1;
    v.speed = Math.max(v.speed, 1.1);
    v.walk([V(v.root.position.x, -2.3), V(side * 9, -2.2)]).then(() => {
      ui.unlabel("v-" + v.id);
      ui.unlabel("c-" + v.id);
      if (!v.dead) this.w.remove(v);
    });
  }

  /** A crowd member gifts: step forward (handled by brain.runDonor), then come back to the same place. */
  async returnToSpot(m) {
    if (this.members.get(m.user.id) !== m || m.v.dead) return;
    this.setLabel(m);
    await m.v.walk([this.spotPos(m)]);
    if (this.members.get(m.user.id) !== m) return;
    m.v.face(0, 0.3);
    m.lastSeen = performance.now();
    m.busy = false;
  }

  /** Everyone in the crowd cheers (level up, big gift, dance). */
  cheer() {
    for (const m of this.members.values()) {
      if (m.busy || !m.v || m.v.dead) continue;
      m.v.face(0, 0.3);
      Math.random() < 0.5 ? m.v.wave(2.4) : m.v.dance(2.4);
    }
  }

  update(dt) {
    const now = performance.now();
    const stay = (this.b.cfg().game.crowdStaySeconds ?? 300) * 1000;

    // bring pending viewers in one by one (newest activity first when the crowd is full)
    if (this.pending.length && now - this.lastSpawn > (this.pending.length > 20 ? 250 : 900)) { // big lives: let people in faster
      this.pending = this.pending.filter((u) => now - u.at < stay);
      // best candidate: highest priority (chat > follow > like > just joined), then the most recent
      let bi = -1;
      this.pending.forEach((u, i) => { const b = this.pending[bi]; if (!b || u.score > b.score || (u.score === b.score && u.at > b.at)) bi = i; });
      const u = this.pending[bi];
      if (u) {
        // full = no place this viewer may take (VIP places are only for high levels)
        const full = this.members.size >= this.max() || this.freeSpot(u.level || 1) < 0;
        const victim = full ? this.victimFor(u.score || 0) : null;
        if (!full || victim) {
          if (victim) this.leave(victim);
          this.pending.splice(bi, 1);
          this.lastSpawn = now;
          this.enter(u);
        }
      }
    }

    // quiet for too long -> walk away (TikTok does not tell us when a viewer leaves)
    for (const m of this.members.values()) {
      if (!m.busy && now - m.lastSeen > stay) this.leave(m);
    }

    // gossip: point at Lão / the dog, turn to a neighbour and chat
    this.nextGossip -= dt;
    if (this.nextGossip > 0) return;
    this.nextGossip = 1.2 + Math.random() * 2.2;
    const idle = [...this.members.values()].filter((m) => !m.busy && m.v && !m.v.dead && !m.v.moving && !m.v.actions.length && !(m.chatUntil > now));
    if (!idle.length) return;
    const m = idle[(Math.random() * idle.length) | 0];
    const v = m.v;
    const r = Math.random();
    if (r < 0.35) {
      const dog = this.w.dog.root.position;
      Math.random() < 0.5 ? v.face(0, 0.3) : v.face(dog.x, dog.z);
      v.point(1.6);
    } else if (r < 0.8 && idle.length > 1) {
      const other = idle.filter((o) => o !== m).sort((a, b) => a.v.root.position.distanceTo(v.root.position) - b.v.root.position.distanceTo(v.root.position))[0];
      v.face(other.v.root.position.x, other.v.root.position.z);
      other.v.face(v.root.position.x, v.root.position.z);
      v.talking = true;
      setTimeout(() => { v.talking = false; if (!m.busy) v.face(0, 0.3); }, 2200);
      setTimeout(() => { if (!other.busy && !other.v.dead) { other.v.nod?.(); other.v.face(0, 0.3); } }, 2400);
      if (this.b.cooldown("gossip-bubble", 4)) {
        ui.label("c-" + v.id, ui.esc(CHATTER[(Math.random() * CHATTER.length) | 0]), "bubble small",
          (p) => (v.dead ? null : p.copy(v.root.position).add({ x: 0, y: v.height + 0.35, z: 0 })), 2200);
      }
    } else {
      v.face(0, 0.3);
      v.nod?.();
    }
  }
}

export { sleep };
