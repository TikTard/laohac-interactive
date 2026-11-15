import { motion, bell, lerpAngle } from "./rig.js";
import * as THREE from "three";
import * as ui from "./ui.js";
import * as sfx from "./audio.js";
import { SPOTS, HERDERS } from "./world.js";
import { Crowd } from "./crowd.js";
import { Landlord } from "./landlord.js";
import { Fx } from "./fx.js";
import { Party } from "./party.js";
import { skinById } from "./skincatalog.js";

export const strip = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d");
/** Name safe for the voice: letters/numbers only, short. */
export const spoken = (name) => (String(name || "").replace(/[^\p{L}\p{N}\s.'-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 22) || "bạn");
export const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const V3 = (x, z) => new THREE.Vector3(x, 0, z);
/** Short shout-out tag per event type while the DJ party is on. */
const DJ_SHOUT = { chat: () => "💬", like: () => "❤️", follow: () => "➕ follow", share: () => "🔁 chia sẻ", subscribe: () => "⭐", gift: () => "🎁" };

// ---- word filter: viewer names and chat are shown in bubbles and may be read aloud
let blockedSrc = null, blocked = new Set(), blockedPhrases = [];
function loadBlocked(list) {
  if (list === blockedSrc) return;
  blockedSrc = list;
  const words = (list || []).map((w) => String(w).toLowerCase().normalize("NFC").trim()).filter(Boolean);
  blocked = new Set(words.filter((w) => !w.includes(" ")));
  blockedPhrases = words.filter((w) => w.includes(" "));
}
/**
 * Replace blocked words with ***. Whole words, exact spelling (accents matter, so "lớn", "các", "buổi"
 * are never caught by mistake), case-insensitive.
 */
// rude / sexual emoji are removed from names and chat before anything is shown or read
const BAD_EMOJI = /[\u{1F595}\u{1F346}\u{1F351}\u{1F4A6}\u{1F51E}\u{1F92C}\u{1F4A9}]\u{FE0F}?(\u{1F3FB}|\u{1F3FC}|\u{1F3FD}|\u{1F3FE}|\u{1F3FF})?/gu;
export function censor(text, list) {
  loadBlocked(list);
  let out = String(text || "").normalize("NFC").replace(BAD_EMOJI, "");
  if (!blocked.size && !blockedPhrases.length) return out;
  out = out.replace(/[\p{L}\p{N}]+/gu, (w) => (blocked.has(w.toLowerCase()) ? "***" : w));
  const low = out.toLowerCase();
  for (const p of blockedPhrases) if (low.includes(p)) out = out.replace(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "***");
  return out;
}

const SPEAKER_NAMES = { quan: "Quan huyện", ly: "Lý trưởng", linh: "Lính lệ", binh: "Binh Tư", giao: "Ông Giáo", kid: "Thằng Cu" };

/**
 * Game director: turns live events into village life — villagers walking up with gifts,
 * Lão Hạc thanking (AI voice), Cậu Vàng barking / sleeping / dancing, named passers-by, chickens.
 * Story episodes (quan huyện, thuế, Binh Tư, ông Giáo) live in story.js and use these helpers.
 */
export class Brain {
  constructor(world, voice, getConfig, send) {
    ui.setNameFilter((n) => censor(n, this.cfg?.()?.game?.blockedWords));
    this.w = world;
    this.voice = voice;
    this.cfg = getConfig;
    this.send = send;
    this.mood = { lao: 60, dog: 60 }; // "vui" bars: any interaction raises them
    this.lastPick = {};
    this.cool = {};
    this.donorsActive = 0;
    this.donorQueue = [];
    this.thanksBuf = [];
    this.thanksTimer = null;
    this.likesSeen = null;
    this.byUser = new Map(); // userId -> villager (named passer-by)
    this.joinQueue = [];
    this.lastJoinSpawn = 0;
    this.ambientTimer = 1;
    this.lastGiftAt = performance.now();
    this.lastEventAt = performance.now();
    this.recentDiamonds = []; // [time, diamonds]
    this.recentLikes = []; // [time, likes]
    this.dancing = false;
    this.ambientAct = 18; // seconds until the next little ambient action (rooster, Vàng rolls over…)
    this.story = null; // set by main.js
    this.speakers = { lao: (v) => this.w.lao.worldPos("Head", v).add({ x: 0, y: 0.42, z: 0 }) };
    this.crowd = new Crowd(world, this); // viewers standing behind Lão
    this.landlord = new Landlord(world, this); // top giver of the live: own place + servants
    this.fx = new Fx(world); // spotlight, firecrackers, fireworks, rain…
    this.party = new Party(world, this); // DJ lights + mirror ball while Cậu Vàng dances

    voice.onStart = (item) => {
      const who = item.who || "lao";
      if (who === "lao") this.w.lao.speaking = true;
      const sp = this.speakers[who];
      const vil = sp?.villager;
      if (vil) vil.talking = true;
      const cls = who === "lao" ? "bubble" : who === "giao" ? "bubble giao" : "bubble npc";
      const label = typeof sp === "function" ? SPEAKER_NAMES[who] : sp?.name || SPEAKER_NAMES[who];
      const name = label ? `<span class="who">${ui.esc(label)}</span>` : "";
      // camera away from Lão (river race): his words go to the commentary box
      if (this.commentator && who === "lao") ui.commentary(item.display);
      else ui.label("say", name + ui.esc(item.display), cls, (v) => (typeof sp === "function" ? sp(v) : sp?.pos(v)) || this.speakers.lao(v));
    };
    voice.onEnd = (item) => {
      this.w.lao.speaking = false;
      const vil = this.speakers[item.who]?.villager;
      if (vil) vil.talking = false;
      ui.unlabel("say");
      if (this.commentator) ui.commentary(null);
    };
  }

  // ---------------------------------------------------------------- lines & speech
  /** A line from config.lines[kind] shown as a speech bubble over `who` (no voice). */
  bubbleLine(who, kind, vars = {}, ms = 2800) {
    const tpl = this.template(kind);
    if (!tpl) return;
    const text = fill(tpl, { ...vars, name: vars.name || "bạn" });
    const sp = this.speakers[who];
    const pos = (v) => (typeof sp === "function" ? sp(v) : sp?.pos(v)) || this.speakers.lao(v);
    const name = who === "lao" ? "" : (SPEAKER_NAMES[who] ? `<b class="who">${SPEAKER_NAMES[who]}</b>` : "");
    ui.label("bub-" + who, name + ui.esc(text), "bubble small", pos, ms);
  }

  template(kind) {
    const list = this.cfg().lines[kind] || [];
    if (!list.length) return "";
    let i = (Math.random() * list.length) | 0;
    if (list.length > 1 && i === this.lastPick[kind]) i = (i + 1) % list.length;
    this.lastPick[kind] = i;
    return list[i];
  }
  line(kind, vars = {}) {
    return fill(this.template(kind), vars);
  }
  /** Lão says a line: the voice gets a clean name, the subtitle shows the real one. */
  say(kind, name, vars = {}, priority = 1) {
    return this.sayAs("lao", kind, { ...vars, name }, priority);
  }
  /** Any speaker says a line from config.lines[kind]. Returns a promise that resolves when spoken. */
  sayAs(who, kind, vars = {}, priority = 3) {
    const tpl = this.template(kind);
    if (!tpl) return Promise.resolve();
    const name = vars.name;
    return this.voice.say(fill(tpl, { ...vars, name: spoken(name) }), priority, fill(tpl, { ...vars, name: name || "bạn" }), who);
  }
  sayText(who, text, priority = 3) {
    return this.voice.say(text, priority, text, who);
  }
  registerSpeaker(who, villager, name = null) {
    this.speakers[who] = { villager, name, pos: (v) => (villager.dead ? null : v.copy(villager.root.position).add({ x: 0, y: villager.height + 0.35, z: 0 })) };
  }
  cooldown(key, sec) {
    const now = performance.now();
    if ((this.cool[key] || 0) > now) return false;
    this.cool[key] = now + sec * 1000;
    return true;
  }
  wake() {
    this.lastEventAt = performance.now();
    this.lonelySad = false;
    if (this.w.dog.sleepTarget) {
      this.w.dog.sleepTarget = 0;
      ui.unlabel("dog-zzz");
    }
  }

  // ---------------------------------------------------------------- dog
  bark(n = 2, text = "Gâu gâu!", excited = false) {
    if (this.dancing) return;
    this.wake();
    this.w.dog.bark(n);
    sfx.bark(n, excited);
    ui.label("dog-say", ui.esc(text), "bubble dog", (v) => this.w.dog.worldPos("Head", v).add({ x: 0, y: 0.38, z: 0 }), 1600);
  }

  async dance() {
    if (this.dancing) return;
    this.dancing = true;
    this.wake();
    const secs = this.cfg().game.danceSeconds || 14;
    const d = this.w.dancer, dog = this.w.dog;
    d.root.position.copy(dog.root.position);
    dog.root.visible = false;
    d.root.visible = true;
    d.dancing = true;
    d.t0 = d.time;
    this.party.start();
    sfx.scratch();
    const stop = sfx.hiphopBeat(secs, d.bpm);
    ui.banner("🕺 Cậu Vàng quẩy hiphop! 🎶", "Làng mình đông vui quá!", 4000);
    ui.label("dog-say", "Yo yo! 🎤🐶", "bubble dog", (v) => d.worldPos("Head", v).add({ x: 0, y: 0.35, z: 0 }), 2500);
    this.say("dance", "", {}, 2);
    this.w.lao.rejoice(3);
    for (const c of this.w.chickens) c.scare(d.root.position);
    this.villagersCheer();
    const ends = performance.now() + secs * 1000;
    while (performance.now() < ends - 1500) {
      await sleep(3000);
      if (Math.random() < 0.6) ui.label("dog-say", ["Gâu gâu! 🎵", "Yeah! 🔥", "Quẩy lên! 🙌", "Gâu yo! 😎"][(Math.random() * 4) | 0], "bubble dog",
        (v) => d.worldPos("Head", v).add({ x: 0, y: 0.35, z: 0 }), 1500);
      ui.hearts(3, 0.2, 0.7);
    }
    await sleep(Math.max(0, ends - performance.now()));
    stop();
    this.party.stop();
    d.dancing = false;
    d.root.visible = false;
    dog.root.visible = true;
    this.dancing = false;
    this.ambientAct = 18; // seconds until the next little ambient action (rooster, Vàng rolls over…)
    dog.happy(1.5);
  }

  /** Gà trống gáy · Vàng lăn ra nằm ngửa · Vàng ngáp — small things that keep the village alive. */
  /** Find the hand end of one of Lão's arms (in that arm's local space), once. */
  laoHand(side) {
    this.hands ||= {};
    if (this.hands[side]) return this.hands[side];
    const arm = this.w.lao.root.getObjectByName(side);
    if (!arm) return null;
    const box = new THREE.Box3().setFromObject(arm);
    const tip = new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y + 0.03, (box.min.z + box.max.z) / 2);
    arm.worldToLocal(tip);
    return (this.hands[side] = { arm, tip });
  }
  /** Lão sips hot tea (bát nước chè), steam rising. */
  laoTea() {
    const h = this.laoHand("ArmR");
    if (!h) return;
    if (!this.teaCup) {
      const g = new THREE.Group();
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.032, 0.045, 14), new THREE.MeshStandardMaterial({ color: "#efe6d2", roughness: 0.4 }));
      const tea = new THREE.Mesh(new THREE.CircleGeometry(0.04, 14), new THREE.MeshStandardMaterial({ color: "#8a6a22", roughness: 0.3 }));
      tea.rotation.x = -Math.PI / 2; tea.position.y = 0.021;
      g.add(cup, tea);
      g.position.copy(h.tip);
      const s = 1 / (h.arm.getWorldScale(new THREE.Vector3()).x || 1);
      g.scale.setScalar(s);
      h.arm.add(g);
      this.teaCup = g;
    }
    const cup = this.teaCup;
    cup.visible = true;
    const lao = this.w.lao;
    lao.play(3.2, (p, add) => {
      const e = Math.sin(Math.min(1, p * 1.25) * Math.PI);
      add("ArmR", "rot", "x", -1.5 * e);
      add("ArmR", "rot", "z", -0.45 * e);
      add("Head", "rot", "x", -0.12 * e);
    }).then(() => { cup.visible = false; });
    setTimeout(() => {
      const wp = cup.getWorldPosition(new THREE.Vector3()).add({ x: 0, y: 0.06, z: 0 });
      this.fx.burst(wp, { n: 12, colors: ["#ffffff", "#e8e8e8"], speed: 0.35, gravity: -0.5, life: 1.5, size: 0.05 });
      ui.label("lao-tea", "☕ Khà… chè ngon!", "bubble small", (v) => this.speakers.lao(v), 1800);
    }, 1300);
  }
  /** Lão fans himself with a quạt mo. */
  laoFan() {
    const h = this.laoHand("ArmL");
    if (!h) return;
    if (!this.laoFanMesh) {
      const fan = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16, 0, Math.PI), new THREE.MeshStandardMaterial({ color: "#d9c48a", side: THREE.DoubleSide, roughness: 0.8 }));
      fan.rotation.set(0, Math.PI / 2, Math.PI);
      fan.position.copy(h.tip).add({ x: 0, y: -0.05, z: 0 });
      fan.scale.setScalar(1 / (h.arm.getWorldScale(new THREE.Vector3()).x || 1));
      h.arm.add(fan);
      this.laoFanMesh = fan;
    }
    const fan = this.laoFanMesh;
    fan.visible = true;
    ui.label("lao-tea", "😌 Mát quá…", "bubble small", (v) => this.speakers.lao(v), 1800);
    this.w.lao.play(3, (p, add, t) => {
      const e = Math.sin(Math.min(1, p * 1.15) * Math.PI);
      add("ArmL", "rot", "x", -1.1 * e);
      add("ArmL", "rot", "z", (0.35 + Math.sin(t * 10) * 0.25) * e);
    }).then(() => { fan.visible = false; });
  }

  ambientAction() {
    const dog = this.w.dog, d = dog.root;
    // Lão's little habits: a sip of hot tea, or fanning himself
    if (Math.random() < 0.35 && !this.w.lao.actions.length) { Math.random() < 0.6 ? this.laoTea() : this.laoFan(); return; }
    const r = Math.random();
    if (r < 0.4) {
      const rooster = this.w.chickens.find((c) => c.rooster) || this.w.chickens[0];
      if (!rooster) return;
      sfx.crow();
      ui.label("crow", "Ò ó o o! 🐓", "bubble dog", (v) => v.copy(rooster.root.position).add({ x: 0, y: 0.7, z: 0 }), 2000);
      dog.lookAt = rooster.root.position;
      setTimeout(() => { if (dog.lookAt === rooster.root.position) dog.lookAt = null; }, 2500);
      if (Math.random() < 0.4 && this.voice.idleFor > 3) this.say("roosterLao", "", {}, 0);
    } else if (r < 0.75 && !dog.sleepTarget && d.position.distanceTo(this.w.dogHome) < 0.05) {
      // roll over onto his back for a moment
      ui.label("dog-say", "😆", "bubble dog", (v) => dog.worldPos("Head", v).add({ x: 0, y: 0.3, z: 0 }), 2200);
      dog.wag = 2;
      let t = 0;
      const roll = (dt) => {
        t += dt;
        const k = t < 0.5 ? t / 0.5 : t < 2.3 ? 1 : Math.max(0, 1 - (t - 2.3) / 0.5);
        d.rotation.z = 1.45 * k * k * (3 - 2 * k);
        d.position.y = 0.06 * k + Math.abs(Math.sin(t * 9)) * 0.02 * (k === 1 ? 1 : 0);
        if (t > 2.8) { d.rotation.z = 0; d.position.y = 0; this.w.tickers.delete(roll); }
      };
      this.w.tickers.add(roll);
    } else {
      ui.label("dog-say", "🥱 Ngáp…", "bubble dog", (v) => dog.worldPos("Head", v).add({ x: 0, y: 0.32, z: 0 }), 1800);
      dog.play(1.6, (p, add) => {
        const e = Math.sin(p * Math.PI);
        add("Head", "rot", "x", -0.35 * e);
        add("Jaw", "rot", "x", 0.6 * e);
      });
    }
  }

  /** Cậu Vàng dances when the village is lively: lots of likes OR gifts in the last minute. */
  /**
   * Village festival (hội làng): camera pulls back, the whole village dances —
   * the crowd, passers-by, the given cast, Lão (arms up) and Cậu Vàng (hip-hop).
   */
  async festival(cast = [], seconds = 15) {
    this.camFx?.wide(seconds + 1.5);
    // Cậu Vàng's hip-hop also starts the beat; bypass the usual cooldown
    this.cool.dance = 0;
    if (!this.dancing) this.dance();
    ui.banner("🏮 Hội làng mở rồi! 🎉", "Cả làng cùng nhảy nào!", 4500);
    ui.confetti(100);
    sfx.fanfare();
    const dancers = () => [
      ...[...this.crowd.members.values()].filter((m) => !m.busy && m.v && !m.v.dead).map((m) => m.v),
      ...this.w.villagers.filter((v) => v.ambient && !v.dead),
      ...cast.filter((v) => v && !v.dead),
    ];
    for (const v of dancers()) { v.moving = false; v.face(0, 0.5); }
    const end = performance.now() + seconds * 1000;
    let round = 0;
    while (performance.now() < end) {
      for (const v of dancers()) {
        if (v.actions.length) continue;
        Math.random() < 0.75 ? v.dance(2.6) : v.wave(2.4);
      }
      if (round % 2 === 0) this.w.lao.rejoice(2.6);
      if (round % 3 === 1) ui.hearts(4, 0.2 + Math.random() * 0.6, 0.75);
      if (round === 3) ui.confetti(80);
      round++;
      await sleep(2700);
    }
    // passers-by carry on with their walk
    for (const v of this.w.villagers) if (v.ambient && !v.dead && v.path.length) v.moving = true;
  }

  checkDance(diamonds, likes, big = false) {
    const now = performance.now();
    const g = this.cfg().game;
    if (diamonds) this.recentDiamonds.push([now, diamonds]);
    if (likes) this.recentLikes.push([now, likes]);
    this.recentDiamonds = this.recentDiamonds.filter(([t]) => now - t < 60000);
    this.recentLikes = this.recentLikes.filter(([t]) => now - t < 60000);
    const dsum = this.recentDiamonds.reduce((a, [, d]) => a + d, 0);
    const lsum = this.recentLikes.reduce((a, [, d]) => a + d, 0);
    const byGifts = dsum >= (g.danceDiamonds || 300);
    const byLikes = (g.danceLikes || 0) > 0 && lsum >= g.danceLikes;
    if ((big || byGifts || byLikes) && this.cooldown("dance", 40)) {
      this.recentDiamonds = [];
      this.recentLikes = [];
      setTimeout(() => this.dance(), big ? 2500 : 800);
    }
  }
  cheer(amount) {
    this.mood.lao = Math.min(100, this.mood.lao + amount);
    this.mood.dog = Math.min(100, this.mood.dog + amount);
  }

  // ---------------------------------------------------------------- events
  handle(ev) {
    const g = this.cfg().game;
    ev = { ...ev, user: { ...ev.user, name: censor(ev.user?.name, g.blockedWords) } };
    if (ev.text) ev.text = censor(ev.text, g.blockedWords);
    // points muted for spamming: only points / XP are blocked (server side) — their chat is still shown
    // and still answered (reactions have their own cooldowns), so a viewer never feels the game stopped working
    // admin "seeding" gifts are labelled as tests on stream, so viewers are never misled
    if (ev.type === "gift" && ev.source === "simulator" && !g.showSeedOnStream) {
      ev.test = true;
      ev.user.name = ev.user.name + " 🧪";
    }
    this.wake();
    {
      const did = { join: "👋 vừa ghé làng", chat: "💬 " + String(ev.text || "").slice(0, 26), like: `❤️ thả ${ev.count || 1} tim`,
        follow: "➕ vừa follow", share: "🔁 chia sẻ live", subscribe: "⭐ thành hội viên", gift: "🎁 mừng hội làng",
        levelup: `🎉 lên ${ev.title || "cấp mới"}` }[ev.type];
      if (did) ui.friend(ev.user, did);
    }
    this.crowd.touch(ev.user, ev.type); // joining / any interaction keeps the viewer in the crowd (chatters first)
    if (ev.user?.name && ev.type !== "gift") {
      this.recentNames = (this.recentNames || []).filter((n) => n !== ev.user.name);
      this.recentNames.push(ev.user.name);
      if (this.recentNames.length > 30) this.recentNames.shift();
    }
    this.story?.onEvent(ev);
    if (this.party.on && ev.user?.name && DJ_SHOUT[ev.type]) {
      // DJ party: a beam swings onto whoever interacts, and Lão gives them a shout-out (voice at most every 6 s)
      const what = DJ_SHOUT[ev.type](ev);
      this.party.focus(ev.user, what);
      if (this.cooldown("dj-shout", 6) && this.voice.idleFor > 1) {
        const t = ["Đèn chiếu vào {n} nào!", "{n} quẩy lên!", "Hú hú, {n} ơi!", "Cảm ơn {n}, quẩy tiếp nào!"][(Math.random() * 4) | 0];
        this.voice.say(t.replace("{n}", spoken(ev.user.name)), 1, t.replace("{n}", ev.user.name), "lao");
      }
    }
    switch (ev.type) {
      case "gift": return this.onGift(ev);
      case "like": return this.onLike(ev);
      case "chat": return this.onChat(ev);
      case "follow": return this.onFollow(ev);
      case "share": return this.onShare(ev);
      case "join": return this.onJoin(ev);
      case "subscribe": return this.onSubscribe(ev);
      case "levelup": return this.onLevelUp(ev);
      case "spam": return this.onSpam(ev);
    }
  }

  onGift(ev) {
    const tier = ev.tier || { item: "Coin", label: "Xu may mắn" };
    const tiers = [...this.cfg().tiers].sort((a, b) => a.min - b.min);
    const rank = Math.max(0, tiers.findIndex((t) => t.min === tier.min));
    const name = ev.user.name;
    ui.feed(`${ev.test ? "🧪 <i>thử nghiệm</i> · " : ""}<b>${ui.esc(name)}</b> tặng ${ui.esc(ev.gift)} x${ev.count} → ${ui.esc(tier.label)}`, ev.user.avatar, name);
    let item = tier.item;
    let forDog = false;
    if ((item === "Coin" || item === "Khoai") && Math.random() < 0.3) { item = "Xuong"; forDog = true; }
    this.cheer(5 + rank * 3);
    this.lastGiftAt = performance.now();
    this.checkDance(ev.diamonds, 0, !!tier.big);

    const celebrate = tier.big && this.cooldown("big-celebrate", 5);
    if (celebrate) {
      ui.banner(`${name} mừng hội làng!`, `${ev.gift} x${ev.count} — ${tier.label}`);
      ui.confetti();
      sfx.fanfare();
    }
    if (ev.levelUp) setTimeout(() => this.levelUp(ev.levelUp), tier.big ? 3000 : 1500);

    const job = { ev, tier, item, forDog, rank };
    if (this.donorsActive < 3) this.runDonor(job);
    else if (this.donorQueue.length < 6) this.donorQueue.push(job);
    else this.quickGift(job); // very busy: item drops straight into the bowl
  }

  async quickGift({ ev, tier, item, forDog }) {
    const to = forDog ? this.w.dogTarget() : item === "Coin" || item === "Khoai" ? this.w.bowlTarget() : this.w.matTarget();
    const from = to.clone().add({ x: (Math.random() - 0.5) * 1.5, y: 2.5, z: 0.5 });
    const it = await this.w.throwItem(item, from, to, 0.6);
    this.landItem(it, item, forDog);
    this.queueThanks(ev, tier, forDog);
  }

  async runDonor(job) {
    this.donorsActive++;
    const { ev, tier, item, forDog } = job;
    try {
      const spot = forDog ? SPOTS.donorDog.clone() : this.donorSpotFree();
      const side = spot.x >= 0 ? 1 : -1;
      const label = `${ev.user.name} · ${ev.gift} x${ev.count}`;
      const member = this.crowd.get(ev.user.id);
      const fromCrowd = !!(member && !member.busy && member.v && !member.v.dead);
      let v;
      if (fromCrowd) {
        member.busy = true;
        v = member.v;
        v.speed = Math.max(v.speed, 2.2);
        v.label = label;
        v.labelClass = "tag donor";
      } else {
        // this donor walks in now and joins the crowd afterwards; don't also spawn them from the waiting list
        this.crowd.pending = this.crowd.pending.filter((u) => u.id !== ev.user.id);
        const start = new THREE.Vector3(side * 6, 0, -2.2 + (Math.random() - 0.5) * 0.6);
        v = await this.w.spawnVillager({ at: start, speedMul: 2.0, label, labelClass: "tag donor" });
      }
      this.tagVillager(v);
      for (const c of this.w.chickens) if (c.root.position.distanceTo(spot) < 1.2) c.scare(spot);
      const aside = new THREE.Vector3(side * 1.65, 0, fromCrowd ? -0.6 : -1.1);
      await v.walk([aside, spot]);
      if (v.dead) return;
      const rank = job.rank || 0;
      if (rank >= 1) {
        const secs = [0, 2.2, 2.8, 3.4, 4.2, 3.5][Math.min(rank, 5)]; // short: the next donor gets the camera soon
        this.camFx?.focus((out) => (v.dead ? null : out.copy(v.root.position)), secs, rank);
      }
      const target = forDog ? this.w.dog.root.position : SPOTS.lao;
      v.face(target.x, target.z + 0.3);
      this.w.lao.lookAt = v.root.position;
      this.w.dog.lookAt = v.root.position;
      await sleep(250);
      v.give(1.5);
      await sleep(550);
      const hand = v.root.position.clone().add({ x: Math.sin(v.root.rotation.y) * 0.3, y: 0.85 * (v.height / 1.75), z: Math.cos(v.root.rotation.y) * 0.3 });
      const to = forDog ? this.w.dogTarget() : item === "Coin" || item === "Khoai" ? this.w.bowlTarget() : this.w.matTarget();
      const it = await this.w.throwItem(item, hand, to);
      this.landItem(it, item, forDog);
      this.queueThanks(ev, tier, forDog);
      await sleep(700);
      // the bigger the gift, the bigger the show
      await this.donorShow(v, rank, ev, side);
      this.w.lao.lookAt = null;
      this.w.dog.lookAt = null;
      await v.walk([aside]);
      // then (back) into the crowd behind Lão
      if (fromCrowd) this.crowd.returnToSpot(member);
      else this.crowd.enter(ev.user, v);
    } finally {
      this.donorsActive--;
      const next = this.donorQueue.shift();
      if (next) this.runDonor(next);
    }
  }

  /**
   * What a donor does after giving, by gift tier (diamonds of the gift, see config tiers):
   * 0 bow · 1 dance · 2 dance + firecrackers + neighbours cheer · 3 spotlight + firecrackers + Lão & crowd cheer
   * 4 spotlight + fireworks + Cậu Vàng dances with them · 5 fireworks + the whole village festival
   */
  async donorShow(v, rank, ev, side) {
    const fx = this.fx, pos = v.root.position;
    const faceCam = () => v.face(0.4 * side, 6);
    const neighboursCheer = (r = 2.2) => {
      for (const m of this.crowd.members.values()) {
        if (m.busy || !m.v || m.v.dead || m.v.root.position.distanceTo(pos) > r) continue;
        m.v.face(pos.x, pos.z);
        m.v.wave(2.2);
      }
    };
    switch (Math.min(rank, 5)) {
      case 0:
        v.bow();
        await sleep(1300);
        faceCam();
        v.dance(1.8);
        await sleep(1900);
        return;
      case 1:
        v.bow();
        await sleep(1100);
        faceCam();
        v.dance(2.6);
        ui.hearts(3, 0.5, 0.7);
        await sleep(2700);
        return;
      case 2:
        faceCam();
        v.dance(3.2);
        fx.firecrackers(pos, 8);
        neighboursCheer();
        this.w.dog.happy(2);
        this.bark(2, "Gâu gâu! 🧨", true);
        await sleep(3300);
        return;
      case 3:
        fx.spotlight(v.root, 3.6);
        faceCam();
        v.dance(3.4);
        fx.firecrackers(pos, 14);
        this.w.lao.rejoice(2.6);
        this.crowd.cheer();
        ui.hearts(6, 0.5, 0.7);
        await sleep(3500);
        v.jump(0.3);
        await sleep(700);
        return;
      case 4:
        fx.spotlight(v.root, 4.4);
        fx.fireworks(4);
        faceCam();
        v.dance(5.4);
        this.cool.dance = 0; // Cậu Vàng gets up and dances with them
        if (!this.dancing) this.dance();
        this.crowd.cheer();
        this.w.lao.rejoice(3);
        await sleep(5600);
        return;
      default: // 5: mâm cỗ — the whole village holds a festival for them
        fx.spotlight(v.root, 3.6);
        fx.fireworks(8);
        faceCam();
        v.dance(3);
        ui.banner(`🎆 ${ev.user.name} mở hội cho cả làng!`, `${ev.gift} x${ev.count}`, 4000);
        await sleep(3000);
        if (!this.bigActive) await this.festival([v], 12); // never hijack a running group event
        return;
    }
  }

  donorSpotFree() {
    const taken = (s) => this.w.villagers.some((v) => !v.ambient && v.path.length && v.path[v.path.length - 1].distanceTo(s) < 0.3
      || (!v.ambient && v.root.position.distanceTo(s) < 0.4));
    const s = !taken(SPOTS.donor) ? SPOTS.donor : !taken(SPOTS.donor2) ? SPOTS.donor2 : SPOTS.donorDog;
    return s.clone().add({ x: (Math.random() - 0.5) * 0.1, y: 0, z: (Math.random() - 0.5) * 0.1 });
  }

  landItem(it, item, forDog) {
    if (item === "Coin") sfx.ting(); else sfx.thud();
    if (forDog && !this.dancing) {
      this.w.dog.lookAt = it.position;
      this.w.dog.eat(3).then(() => { this.w.scene.remove(it); this.w.dog.lookAt = null; });
      this.bark(1, "Gâu! 🦴", true);
    } else if (forDog) {
      setTimeout(() => this.w.scene.remove(it), 3000);
    } else if (item === "Coin" || item === "Khoai") {
      this.w.keepInBowl(it);
    } else {
      this.w.keepOnMat(it);
    }
  }

  queueThanks(ev, tier, forDog) {
    if (tier.big && this.cooldown("big-thanks", 5)) {
      this.w.lao.rejoice(2.6);
      this.bark(4, "Gâu gâu gâu! 🎉", true);
      this.w.dog.happy(2.5);
      this.say("bigGift", ev.user.name, { gift: ev.gift, count: ev.count, item: tier.label }, 3);
      this.villagersCheer();
      return;
    }
    this.thanksBuf.push({ ev, tier, forDog });
    clearTimeout(this.thanksTimer);
    this.thanksTimer = setTimeout(() => this.flushThanks(), 900);
  }

  flushThanks() {
    const buf = this.thanksBuf.splice(0);
    if (!buf.length) return;
    this.w.lao.thank(2);
    this.w.dog.happy(1.5);
    const names = [...new Set(buf.map((b) => b.ev.user.name))];
    if (names.length === 1) {
      const b = buf[buf.length - 1];
      const kind = b.forDog ? "dogGift" : "gift";
      this.say(kind, names[0], { gift: b.ev.gift, count: b.ev.count, item: b.tier.label.toLowerCase() }, 2);
      if (!b.forDog && Math.random() < 0.5) setTimeout(() => this.bark(2), 600);
    } else {
      const shown = names.slice(0, 4);
      const list = (arr) => (arr.length > 1 ? arr.slice(0, -1).join(", ") + " và " + arr[arr.length - 1] : arr[0]);
      const more = names.length > 4 ? ` và ${names.length - 4} người nữa` : "";
      const text = `Lão cảm ơn ${list(shown.map(spoken))}${more}! Làng mình vui quá!`;
      this.voice.say(text, 2, `Lão cảm ơn ${list(shown)}${more}! Làng mình vui quá!`);
      setTimeout(() => this.bark(3, "Gâu gâu gâu!", true), 500);
    }
  }

  levelUp(goalName) {
    ui.banner("🏆 " + goalName + "!", "Hoàn thành mục tiêu hội làng — cảm ơn cả làng!", 6000);
    ui.confetti(140);
    sfx.fanfare();
    this.w.lao.rejoice(3);
    this.w.dog.happy(3);
    this.bark(4, "Gâu gâu! 🎉", true);
    this.villagersCheer();
    this.voice.say(this.line("levelUp", { goal: goalName.toLowerCase() }), 3);
  }

  villagersCheer() {
    this.crowd.cheer();
    for (const v of this.w.villagers) {
      if (!v.ambient) continue;
      const wasMoving = v.moving;
      v.moving = false;
      v.face(0, 0);
      v.wave(2.6).then(() => { if (!v.dead && v.path.length) v.moving = wasMoving || true; });
    }
  }

  onLike(ev) {
    ui.hearts(Math.min(6, Math.ceil(ev.count / 5)));
    this.cheer(Math.min(6, ev.count * 0.5));
    this.checkDance(0, ev.count);
    const d = this.w.dog;
    d.wag = Math.min(2, d.wag + 0.15 * Math.min(ev.count, 10));
    if (this.cooldown("like-bark", 8) && Math.random() < 0.5) this.bark(1, "Gâu! ❤️");
  }

  checkLikeMilestone(total) {
    const m = this.cfg().game.likeMilestone || 0;
    if (!m) return;
    if (this.likesSeen === null) { this.likesSeen = total; return; }
    if (Math.floor(total / m) > Math.floor(this.likesSeen / m)) {
      this.say("like", "", {}, 1);
      this.w.dog.happy(2);
      this.bark(3, `Gâu gâu! ${Math.floor(total / m) * m} ❤️`, true);
    }
    this.likesSeen = total;
  }

  /**
   * "Vàng ơi": the caller's villager runs up to Cậu Vàng, picks him up for a cuddle, puts him back and returns
   * to their place. One cuddle at a time; skipped while a story / dance needs Vàng.
   */
  async hugDog(user) {
    const dog = this.w.dog, d = dog.root, home = this.w.dogHome;
    const dogFree = () => !this.dancing && !this.story?.busy && d.visible;
    if (this.dogHeld || !dogFree() || d.position.distanceTo(home) > 0.05) return;
    const m = this.crowd.get(user.id);
    if (!m || m.busy || m.landlord || !m.v || m.v.dead) return;
    if (!this.cooldown("dog-hug", 10)) return;
    const v = m.v;
    this.dogHeld = true;
    m.busy = true;
    const speed = v.speed;
    let hold = null, pick = null;
    try {
      // run round Lão's left side to the front-left of Vàng (Lão sits at the origin, the crowd stands behind him)
      v.speed = Math.max(speed, 2.6);
      const stand = V3(home.x - 0.42, home.z + 0.38);
      const path = v.root.position.z < -0.2 ? [V3(-1.75, -0.35), stand] : [stand];
      dog.lookAt = v.root.position;
      dog.wag = 1.6;
      await v.walk(path);
      v.speed = speed;
      if (v.dead || !dogFree()) return;
      v.face(d.position.x, d.position.z);
      await sleep(250);
      if (v.dead || !dogFree()) return;

      // pick up: Vàng rests across the chest, both arms wrapped round him, gentle rocking
      d.rotation.z = 0;
      dog.lookAt = null;
      hold = (dt) => {
        if (v.dead) return;
        const r = v.root, yaw = r.rotation.y;
        const rock = Math.sin(performance.now() / 260);
        d.position.set(r.position.x + Math.sin(yaw) * 0.26, v.height * 0.4 + rock * 0.015, r.position.z + Math.cos(yaw) * 0.26);
        d.rotation.y = yaw + Math.PI / 2 + rock * 0.12;
      };
      const lift = new THREE.Vector3();
      const from = d.position.clone(), fromYaw = d.rotation.y;
      let t = 0;
      pick = (dt) => { // 0.35 s lift from the ground into the arms
        t += dt;
        const k = Math.min(1, t / 0.35);
        hold(dt);
        lift.copy(d.position);
        d.position.lerpVectors(from, lift, k * k * (3 - 2 * k));
        d.rotation.y = lerpAngle(fromYaw, d.rotation.y, k);
        if (k >= 1) { this.w.tickers.delete(pick); this.w.tickers.add(hold); }
      };
      this.w.tickers.add(pick);
      setTimeout(() => { if (!v.dead) v.face(v.root.position.x + 0.4, 6); }, 450); // turn to the camera with Vàng in arms
      const cuddle = v.play(4.4, (p, add, tt) => {
        const e = bell(p, 0.1, 0.12);
        add("ArmL", "rot", "x", -1.25 * e);
        add("ArmR", "rot", "x", -1.25 * e);
        add("ArmL", "rot", "z", -0.45 * e);
        add("ArmR", "rot", "z", 0.45 * e);
        add("Body", "rot", "z", Math.sin(tt * 3.2) * 0.07 * e);
        add("Body", "rot", "x", -0.05 * e);
        add("Head", "rot", "x", 0.18 * e);
      });
      dog.happy(4);
      sfx.bark(1, true);
      ui.label("dog-say", "🥰", "bubble dog", (o) => dog.worldPos("Head", o).add({ x: 0, y: 0.32, z: 0 }), 2200);
      ui.label("c-" + v.id, ui.esc(["Thương Vàng quá! 🥰", "Lại đây bế cái nào!", "Ngoan quá Vàng ơi!", "Nặng ghê ta! 😆"][(Math.random() * 4) | 0]),
        "bubble small", (o) => (v.dead ? null : o.copy(v.root.position).add({ x: 0, y: v.height + 0.35, z: 0 })), 2400);
      ui.hearts(3, 0.25, 0.6);
      this.w.lao.lookAt = d.position;
      // stop early if a story / dance starts and needs Vàng
      const ends = performance.now() + 4000;
      while (performance.now() < ends && dogFree() && !v.dead) await sleep(150);
      await Promise.race([cuddle, sleep(400)]);
    } finally {
      // put Vàng back down at home
      this.w.tickers.delete(hold);
      this.w.tickers.delete(pick);
      d.position.copy(home);
      d.rotation.set(0, 0.35, 0);
      if (this.w.lao.lookAt === d.position) this.w.lao.lookAt = null;
      dog.lookAt = null;
      this.dogHeld = false;
      v.speed = speed;
      if (this.crowd.get(user.id) === m && !v.dead) this.crowd.returnToSpot(m);
      else m.busy = false;
    }
  }

  onChat(ev) {
    const g = this.cfg().game;
    // remember who chatted recently (Ông Giáo's shout-outs)
    this.chatters ||= new Map();
    this.chatters.set(ev.user.id, { user: ev.user, at: performance.now() });
    if (this.chatters.size > 80) this.chatters.delete(this.chatters.keys().next().value);
    this.cheer(3);
    if (ev.skinChange) return this.onSkinChange(ev);
    const t = strip(ev.text);
    this.crowd.say(ev.user, ev.text); // their villager behind Lão says it too
    if (g.barkKeywords.some((k) => t.includes(strip(k))) && this.cooldown("bark", 2.2)) {
      this.w.dog.lookAt = null;
      this.w.dog.happy(1.2);
      this.bark(3, `Gâu gâu! Chào ${ev.user.name}!`.slice(0, 40), true);
      // spoken answer too (per viewer every 8 s, and not more than one every 5 s so the voice queue never floods)
      if (this.cooldown("dog-say-" + ev.user.id, 8) && this.cooldown("dog-say", 5)) this.say("chatDog", ev.user.name, {}, 1);
      this.hugDog(ev.user);
      return;
    }
    if (g.callKeywords.some((k) => t.includes(strip(k)))) {
      // instant visible answer for everyone who calls; Lão answers out loud (same limits as above), else a bubble
      this.w.lao.nod();
      this.w.lao.lookAt = this.crowd.get(ev.user.id)?.v?.root.position || null;
      if (this.cooldown("call-" + ev.user.id, 8)) {
        if (this.cooldown("call-say", 5)) this.say("chatCall", ev.user.name, {}, 1);
        else this.bubbleLine("lao", "chatCall", { name: ev.user.name });
      }
      return;
    }
    if (false && this.cfg().tts.readChat && ev.text.length > 1 && this.cooldown("read", 3)) {
      this.voice.say(`${spoken(ev.user.name)} nói: ${ev.text}`, 0, `${ev.user.name}: ${ev.text}`);
    }
  }

  /** A viewer changed costume by chat ("đổi ếch", "#mèo", "đổi" = random): a puff of smoke and a little show. */
  async onSkinChange(ev) {
    const sk = skinById(ev.user.skin);
    const label = sk ? `${sk.emoji} ${sk.name}` : "👕 Dân Làng";
    ui.feed(`✨ <b>${ui.esc(ev.user.name)}</b> hóa thành ${ui.esc(label)}!`, ev.user.avatar, ev.user.name);
    // wait (a little) for a newcomer to walk into the village
    let m = this.crowd.get(ev.user.id);
    for (let i = 0; i < 16 && !m?.v; i++) { await sleep(500); m = this.crowd.get(ev.user.id); }
    if (!m?.v || m.v.dead) return;
    const v = m.v, p = v.root.position.clone();
    this.fx.burst(p.clone().add({ x: 0, y: 0.9, z: 0 }), { n: 26, colors: ["#ffffff", "#e9dcc3", "#ffd54a"], speed: 1.6, gravity: 0.3, life: 0.9, size: 0.16 });
    sfx.ting?.();
    ui.label("skin-" + v.id, "✨ " + ui.esc(label), "bubble small", (o) => (v.dead ? null : o.copy(v.root.position).add({ x: 0, y: v.height + 0.4, z: 0 })), 2400);
    if (!m.busy) { v.face(0, 0.3); v.jump?.(0.3); setTimeout(() => !v.dead && !m.busy && v.dance?.(2), 400); }
    if (this.cooldown("skin-say", 12)) this.sayText("lao", `Ơ kìa, ${spoken(ev.user.name)} hóa thành ${sk ? sk.name : "dân làng"} rồi! Ha ha!`, 1);
  }

  onFollow(ev) {
    this.cheer(10);
    ui.feed(`<b>${ui.esc(ev.user.name)}</b> đã theo dõi Lão ➕`, ev.user.avatar, ev.user.name);
    this.w.lao.nod();
    this.bark(1);
    if (this.cooldown("follow", 2)) this.say("follow", ev.user.name, {}, 1);
  }
  onShare(ev) {
    this.cheer(10);
    ui.feed(`<b>${ui.esc(ev.user.name)}</b> đã chia sẻ 🔁`, ev.user.avatar, ev.user.name);
    this.w.lao.nod();
    if (this.cooldown("share", 3)) this.say("share", ev.user.name, {}, 1);
  }
  onSubscribe(ev) {
    ui.feed(`<b>${ui.esc(ev.user.name)}</b> đăng ký hội viên ⭐`, ev.user.avatar, ev.user.name);
    this.w.lao.thank(1);
    this.say("subscribe", ev.user.name, {}, 2);
  }
  /** A viewer reached a new level: spotlight on their villager (bringing them in if needed). */
  async onLevelUp(ev) {
    if (!ev.user?.id) return;
    let m = this.crowd.get(ev.user.id);
    if (m) { m.user.level = ev.level; m.user.title = ev.title; }
    if (!m) {
      this.crowd.join(ev.user);
      // wait (up to ~12 s) for them to walk in
      for (let i = 0; i < 24 && !(m = this.crowd.get(ev.user.id))?.v; i++) await sleep(500);
      if (!m?.v) return;
    }
    for (let i = 0; i < 30 && m.busy; i++) await sleep(500); // donating / walking in: celebrate right after
    if (this.crowd.get(ev.user.id) !== m) return;
    m.user.level = ev.level; m.user.title = ev.title;
    if (ev.quiet) {
      ui.feed(`⭐ <b>${ui.esc(ev.user.name)}</b> được thưởng, lên cấp ${ev.level} · ${ui.esc(ev.title)}`, ev.user.avatar, ev.user.name);
      this.crowd.quietLevelUp(m);
      return;
    }
    ui.feed(`🎉 <b>${ui.esc(ev.user.name)}</b> lên cấp ${ev.level} · ${ui.esc(ev.title)}`, ev.user.avatar, ev.user.name);
    this.crowd.celebrate(m);
  }

  /** Anti-spam (server decided): a friendly warning, or points muted for a few minutes. */
  onSpam(ev) {
    const m = this.crowd.get(ev.user?.id);
    const mute = ev.action === "mute";
    ui.feed(mute ? `🚫 <b>${ui.esc(ev.user.name)}</b> tạm khóa điểm ${ev.minutes || 5} phút vì spam` : `⚠️ <b>${ui.esc(ev.user.name)}</b>: chat chậm thôi, spam không được tính điểm`, ev.user.avatar, ev.user.name);
    if (m?.v && !m.v.dead) {
      m.spamTag = mute ? "🚫 " : "⚠️ ";
      m.spamUntil = performance.now() + (mute ? (ev.minutes || 5) * 60000 : 20000);
      if (!m.busy) this.crowd.setLabel(m);
      clearTimeout(m.spamTimer);
      m.spamTimer = setTimeout(() => { m.spamTag = ""; if (!m.busy && m.v && !m.v.dead) this.crowd.setLabel(m); }, m.spamUntil - performance.now());
      if (!m.busy) { m.v.face(0, 0); m.v.play(1.4, (p, add) => { const k = Math.sin(p * Math.PI); add("Head", "rot", "x", 0.4 * k); }); }
    }
    if (this.cooldown(mute ? "spam-mute" : "spam-warn", mute ? 6 : 10)) {
      this.w.lao.lookAt = m?.v?.root.position || null;
      if (mute) this.say("spamMute", ev.user.name, { minutes: ev.minutes || 5 }, 1);
      else this.bubbleLine("lao", "spamWarn", { name: ev.user.name });
    }
  }

  /** Everyone who joins the live joins the crowd behind Lão (see crowd.js; handle() already added them). */
  onJoin(ev) {
    this.cheer(1);
    if (this.cfg().game.thankJoins && this.cooldown("join-say", 8)) this.say("join", ev.user.name, {}, 0);
  }

  // ---------------------------------------------------------------- ambient life
  async spawnAmbient(extra = {}) {
    const lane = (Math.random() - 0.5) * 1.2;
    const { start, points } = this.w.crossingPath(lane);
    const v = await this.w.spawnVillager({ at: start, ambient: true, speedMul: extra.userId ? 0.85 : 1, ...extra });
    if (extra.userId) this.byUser.set(extra.userId, v);
    if (v.label) this.tagVillager(v);
    v.root.rotation.y = Math.atan2(points[0].x - start.x, points[0].z - start.z);
    // some stop by Lão for a moment (named viewers more often)
    if (Math.random() < (extra.userId ? 0.45 : 0.2)) {
      const look = new THREE.Vector3(-1.6 + Math.random() * 3.2, 0, -1.3 + Math.random() * 0.3);
      await v.walk([points[0], look]);
      if (v.dead) return this.despawn(v);
      v.face(0, 0);
      this.w.lao.lookAt = v.root.position;
      if (extra.userId && this.cfg().game.greetPassers && this.cooldown("greet", 20) && this.voice.idleFor > 2) {
        this.say("passerGreet", extra.label, {}, 0);
        v.wave(2.4);
      } else if (Math.random() < 0.5) this.w.lao.nod();
      await sleep(2500 + Math.random() * 2000);
      if (this.w.lao.lookAt === v.root.position) this.w.lao.lookAt = null;
      await v.walk(points.slice(1));
    } else {
      await v.walk(points);
    }
    this.despawn(v);
  }
  /** The buffalo stops in the middle of the yard, gets up on its hind legs and dances hip-hop; everyone is stunned. */
  async buffaloDance(herder, buf) {
    if (!buf || buf.dead) return;
    const secs = 7.5;
    const pos = buf.root.position;
    // the buffalo walks off on its own to the open spot beside Lão (a fake "leader" standing there, facing the camera)
    const side = herder.root.position.x >= 0 ? 1 : -1;
    const show = new THREE.Vector3(side * 1.2, 0, 1.5);
    const real = { leader: buf.leader, dx: buf.dx, dz: buf.dz };
    herder.face(show.x, show.z);
    buf.leader = { root: { position: show, rotation: { y: Math.atan2(-show.x * 0.3, 6) } }, speed: 0.9, dead: false };
    buf.dx = 0; buf.dz = 0;
    for (let t = 0; t < 60 && !buf.dead && buf.root.position.distanceTo(show) > 0.08; t++) await sleep(100);
    await sleep(500); // turn round to the audience
    if (buf.dead) return;
    const dance = buf.hiphop(secs); // freezes the buffalo where it is
    sfx.scratch();
    const stop = sfx.hiphopBeat(secs + 0.6, 104);
    ui.banner("🐃 Trâu nhảy hiphop?! 😱", "Cả làng sững sờ!", 3200);
    await sleep(500);
    // the herder can't believe it either
    ui.label("c-" + herder.id, "Ơ… trâu nhà tôi?! 😳", "bubble small",
      (o) => (herder.dead ? null : o.copy(herder.root.position).add({ x: 0, y: herder.height + 0.35, z: 0 })), 2600);
    herder.face(pos.x, pos.z);
    herder.akimbo(2.4);
    // the whole crowd turns round, jumps back, points and gasps
    const wow = ["Trời ơi! 😱", "Trâu biết nhảy kìa!", "Ảo thật đấy!", "Ối giời ơi!", "Quẩy ghê chưa! 🔥", "Tôi có hoa mắt không?", "Đỉnh quá trâu ơi!"];
    let i = 0;
    for (const m of this.crowd.members.values()) {
      if (m.busy || !m.v || m.v.dead) continue;
      const v = m.v;
      setTimeout(() => {
        if (v.dead || m.busy) return;
        v.face(pos.x, pos.z);
        Math.random() < 0.5 ? v.jump(0.22) : v.point(2.2);
        if (i++ < 6) ui.label("c-" + v.id, wow[(Math.random() * wow.length) | 0], "bubble small",
          (o) => (v.dead ? null : o.copy(v.root.position).add({ x: 0, y: v.height + 0.35, z: 0 })), 2400);
      }, 300 + Math.random() * 900);
    }
    this.w.lao.lookAt = pos;
    this.w.dog.lookAt = pos;
    setTimeout(() => this.bark(2, "Gâu?! 😳", true), 600);
    if (this.voice.idleFor > 0.5) this.sayText("lao", "Ối giời ơi! Trâu nhà ai mà biết nhảy hiphop thế kia!", 2);
    for (const c of this.w.chickens) c.scare(pos);
    // halfway: the crowd can't help it, they dance along
    setTimeout(() => {
      for (const m of this.crowd.members.values()) if (!m.busy && m.v && !m.v.dead && Math.random() < 0.6) m.v.dance(2.6);
      ui.hearts(4, 0.4, 0.7);
    }, secs * 500);
    await dance;
    stop?.();
    Object.assign(buf, real); // back on the rope
    if (this.w.lao.lookAt === pos) this.w.lao.lookAt = null;
    if (this.w.dog.lookAt === pos) this.w.dog.lookAt = null;
    for (const m of this.crowd.members.values()) if (!m.busy && m.v && !m.v.dead) m.v.face(0, 0.3);
  }

  /** A villager walking a buffalo on a rope, carrying a pig (piglet trotting behind) or herding ducks. */
  async spawnProcession(kind) {
    kind ||= ["buffalo", "pig", "duck"][(Math.random() * 3) | 0];
    const lane = (Math.random() - 0.5) * 0.8;
    const { start, points } = this.w.crossingPath(lane);
    const v = await this.w.spawnVillager({ at: start, ambient: true, variant: HERDERS[kind], noTint: kind !== "duck" });
    v.herd = kind;
    v.root.rotation.y = Math.atan2(points[0].x - start.x, points[0].z - start.z);
    const beasts = [];
    let rope = null;
    if (kind === "buffalo") {
      const b = await this.w.spawnBeast("buffalo", v, { kind: "buffalo", dz: -1.75, dx: 0.15, speed: 0.9 });
      beasts.push(b);
      // the rope from his hand to the buffalo's nose ring
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
      rope = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#b89a64" }));
      rope.frustumCulled = false;
      this.w.scene.add(rope);
    } else if (kind === "pig") {
      beasts.push(await this.w.spawnBeast(Math.random() < 0.5 ? "pig_pink" : "pig_spot", v, { kind: "pig", dz: -0.9, dx: -0.3, speed: 1.4, scale: 0.65 }));
    } else {
      const n = 4 + ((Math.random() * 4) | 0);
      for (let i = 0; i < n; i++) {
        beasts.push(await this.w.spawnBeast(Math.random() < 0.6 ? "duck_white" : "duck_brown", v, {
          kind: "duck", dz: 0.8 + (i % 3) * 0.35 + Math.random() * 0.15, dx: ((i % 3) - 1) * 0.3 + (Math.random() - 0.5) * 0.15, speed: 1.1,
        }));
      }
    }
    const hand = new THREE.Vector3(), nose = new THREE.Vector3(), mid = new THREE.Vector3();
    const ropeTick = () => {
      if (!rope || v.dead || !beasts[0]) return;
      v.root.localToWorld(hand.set(0.23 * (v.root.scale.x || 1), 0.84, 0.36));
      beasts[0].root.localToWorld(nose.set(0, 0.78, 1.36));
      mid.copy(hand).lerp(nose, 0.5); mid.y -= 0.25;
      rope.geometry.attributes.position.setXYZ(0, hand.x, hand.y, hand.z);
      rope.geometry.attributes.position.setXYZ(1, mid.x, mid.y, mid.z);
      rope.geometry.attributes.position.setXYZ(2, nose.x, nose.y, nose.z);
      rope.geometry.attributes.position.needsUpdate = true;
    };
    if (rope) this.w.tickers.add(ropeTick);
    // the dog has opinions about buffaloes and ducks
    setTimeout(() => {
      if (v.dead || this.bigActive || !this.cooldown("herd-bark", 12)) return;
      if (kind === "buffalo") this.bark(2, "Gâu! Trâu to quá! 🐃");
      else if (kind === "duck") this.bark(2, "Gâu gâu! Cạc cạc? 🦆");
      else this.bark(1, "Gâu? Ụt ịt! 🐷");
    }, 3500);
    const g = this.cfg().game;
    if (kind === "buffalo" && Math.random() < (g.buffaloDanceChance ?? 0.35) && this.cooldown("buffalo-dance", 90)) {
      // detour round the side of the crowd into the open front yard beside Lão, where everyone can see
      const s = points[1].x >= 0 ? 1 : -1;
      await v.walk([points[0], new THREE.Vector3(s * 2.9, 0, -1.2), new THREE.Vector3(s * 2.8, 0, 1.9)]);
      if (!v.dead && !this.dancing && !this.story?.busy && !this.bigActive) await this.buffaloDance(v, beasts[0]);
      await v.walk([new THREE.Vector3(s * 3.2, 0, 1.6), points[1]]);
    } else await v.walk(points);
    if (rope) { this.w.tickers.delete(ropeTick); this.w.scene.remove(rope); rope.geometry.dispose(); }
    for (const b of beasts) this.w.removeBeast(b);
    this.despawn(v);
  }

  despawn(v) {
    if (v.userId) this.byUser.delete(v.userId);
    ui.unlabel("v-" + v.id);
    if (!v.dead) this.w.remove(v);
  }

  tagVillager(v) {
    ui.label("v-" + v.id, ui.esc(v.label), v.labelClass, (p) => (v.dead ? null : p.copy(v.root.position).add({ x: 0, y: v.height + 0.12, z: 0 })));
  }

  update(dt) {
    const g = this.cfg().game;
    const now = performance.now();
    // "vui" bars drift down slowly; never below 20 and never used to pressure anyone
    motion.walk = g.walkSpeed ?? 1.35;
    const decay = (g.moodDecayPerMinute ?? 4) / 60 * dt;
    this.mood.lao = Math.max(20, this.mood.lao - decay);
    this.mood.dog = Math.max(20, this.mood.dog - decay);
    this.w.lao.sadTarget = this.laoSad || this.lonelySad ? 1 : 0;
    ui.setMood(this.mood.lao, this.mood.dog);

    // ambient villagers + named viewers
    this.ambientTimer -= dt;
    const ambient = this.w.villagers.filter((v) => v.ambient && !v.userId).length;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = 2 + Math.random() * 4;
      if (ambient < (g.ambientVillagers ?? 6)) {
        // now and then someone walks through with a buffalo, a pig or ducks
        const herds = this.w.villagers.filter((v) => v.herd).length;
        if (g.animals !== false && herds < 1 && !this.bigActive && Math.random() < (g.animalChance ?? 0.22)) this.spawnProcession();
        else this.spawnAmbient();
      }
    }
    this.crowd.update(dt);

    // dog notices passers-by and chickens
    for (const v of this.w.villagers) {
      if (v.barkedAt || !v.ambient) continue;
      if (v.root.position.distanceTo(this.w.dog.root.position) < 2.6) {
        v.barkedAt = true;
        if (Math.random() < 0.35 && this.cooldown("passer-bark", 7) && !this.w.dog.sleepTarget) {
          this.w.dog.lookAt = v.root.position;
          this.bark(Math.random() < 0.5 ? 1 : 2);
          setTimeout(() => { if (this.w.dog.lookAt === v.root.position) this.w.dog.lookAt = null; }, 2500);
        }
      }
      for (const c of this.w.chickens) if (!c.flee && c.root.position.distanceTo(v.root.position) < 0.6) c.scare(v.root.position);
    }
    for (const c of this.w.chickens) {
      if (c.root.position.distanceTo(this.w.dog.root.position) < 0.8 && !c.flee && !this.w.dog.sleepTarget && this.cooldown("chicken-bark", 12)) {
        this.w.dog.lookAt = c.root.position;
        this.bark(2, "Gâu! 🐔");
        c.scare(this.w.dog.root.position);
        setTimeout(() => (this.w.dog.lookAt = null), 2000);
      }
    }

    // little ambient actions now and then
    this.ambientAct -= dt;
    if (this.ambientAct <= 0) {
      this.ambientAct = 25 + Math.random() * 30;
      if (!this.story?.busy && !this.dancing) this.ambientAction();
    }

    // Cậu Vàng naps when nothing happens
    const quiet = (now - this.lastEventAt) / 1000;
    if (!this.dancing && quiet > (g.dogNapSeconds || 80) && !this.w.dog.sleepTarget && !this.story?.busy) {
      this.w.dog.sleepTarget = 1;
    }
    if (this.w.dog.sleepTarget && this.cooldown("zzz", 4)) {
      ui.label("dog-zzz", "💤 Khò khò…", "bubble dog", (v) => this.w.dog.worldPos("Head", v).add({ x: 0.1, y: 0.32, z: 0 }), 2500);
    }

    // idle chatter: storytelling and invitations to chat / like (never asks for gifts)
    if (this.voice.idleFor > (g.idleLineSeconds || 45) && !this.story?.busy) {
      this.voice.lastEnd = performance.now();
      const lonely = quiet > (g.lamentSeconds || 60) && Math.random() < 0.7; // nobody around for a while
      const low = this.mood.lao < 35 && Math.random() < 0.5;
      const kind = lonely ? "lament" : low ? "lowMood" : Math.random() < 0.5 ? "funny" : "idle";
      this.voice.say(this.line(kind), 0);
      if (lonely) {
        // a long sigh: head down, shoulders drop, then looks at Cậu Vàng
        this.w.lao.play(4, (p, add) => { const k = Math.sin(p * Math.PI); add("Head", "rot", "x", 0.35 * k); add("Upper", "rot", "x", 0.12 * k); });
        this.lonelySad = true; // his sad sitting pose until someone shows up (wake() lifts it)
        this.w.lao.lookAt = this.w.dog.root.position;
        setTimeout(() => { if (this.w.lao.lookAt === this.w.dog.root.position) this.w.lao.lookAt = null; }, 5000);
      } else if (Math.random() < 0.5) this.w.lao.nod();
    }
  }
}
