import * as THREE from "three";
import * as ui from "./ui.js";
import * as sfx from "./audio.js";
import { CHARS, SPOTS, VARIANTS } from "./world.js";
import { sleep, spoken as spokenName } from "./brain.js";
import { BigEvents } from "./bigevents.js";
import { quay } from "./quay.js";

const V = (x, z) => new THREE.Vector3(x, 0, z);
const GATE = V(0, -12.5);
const ENTER = V(0, -8.5); // just inside the gate, so the cast reaches Lão quickly
const HURRY = 1.6;

/**
 * Story episodes, started by the server ({t:"episode"} messages):
 *  Challenges are won with likes / comments / follows (never gifts) and nothing bad happens if they are missed.
 *  quan   — quan huyện asks to buy Cậu Vàng; the village cheers to keep him
 *  tax    — lý trưởng decides whether the village holds a festival; the village cheers
 *  binhtu — Binh Tư hangs around Cậu Vàng; likes / "đuổi" comments chase him away
 *  ongiao — ông Giáo introduces the village and how to play
 *  kids   — village kids run through, chickens scatter
 *  kidsHug  — kids pick Cậu Vàng up, spin him around and put him back
 *  kidsBall — kids play ball, Cậu Vàng fetches
 *  herd     — Cậu Vàng herds the chickens around the yard
 *  fight    — two viewers (as villagers) play tug-of-war at the festival; Lão makes them shake hands
 *  rain     — a rain shower (everyone hurries), Cậu Vàng shakes off, then a rainbow
 *  kite     — a kid flies a kite across the village
 *  butterflies — Cậu Vàng chases butterflies
 */
export class Story {
  constructor(world, brain) {
    this.w = world;
    this.b = brain;
    this.cur = null; // running challenge {ep, result:Promise, resolve, cast:[]}
    this.big = new BigEvents(world, brain, this); // tug-of-war, boat race, sky lanterns, pot-breaking
    this.scene = false;
    // watchdog: an episode whose end never arrives is closed 20 s after its time ran out
    setInterval(() => { if (this.cur && !this.cur.done && performance.now() > this.cur.deadline) this.forceEnd(this.cur); }, 5000);
  }
  get busy() { return !!this.cur || this.scene; }

  // ---------------------------------------------------------------- server messages
  onMessage(msg) {
    const ep = msg.ep;
    if (msg.phase === "start") {
      const scenes = { ongiao: () => this.ongiao(), kids: () => this.kids(), kidsHug: () => this.kidsHug(),
        kidsBall: () => this.kidsBall(), herd: () => this.herd(), fight: () => this.fight(),
        rain: () => this.rain(), kite: () => this.kite(), butterflies: () => this.butterflies(),
        niu: () => this.big.niu(), poem: () => this.poem(), scuffle: () => this.scuffle(ep), dogFlip: () => this.dogFlip(),
        dogChase: () => this.dogChase(), quay: () => (this.canMoveDog() ? quay(this) : null) };
      if (scenes[ep.type]) return this.run(scenes[ep.type], ep.id);
      if (this.cur) {
        // a stale episode the server forgot (restart / lost end message): close it, then play the new one
        if (performance.now() > this.cur.deadline || this.cur.done) {
          this.forceEnd(this.cur);
          const retry = (n) => (this.cur && n > 0 ? setTimeout(() => retry(n - 1), 500) : this.cur || this.onMessage(msg));
          retry(40);
        }
        return;
      }
      this.b.voice.clearLow(2);
      let resolve;
      const result = new Promise((r) => (resolve = r));
      this.cur = { ep, result, resolve, done: false, cast: [], deadline: performance.now() + (ep.remainingMs ?? (ep.seconds || 60) * 1000) + 20000 };
      const play = { quan: () => this.quan(), tax: () => this.tax(), binhtu: () => this.binhtu(), quiz: () => this.quiz(),
        tug: () => this.big.play(this.cur), boat: () => this.big.play(this.cur), lantern: () => this.big.play(this.cur) }[ep.type];
      if (play) play().catch((e) => console.error(e)).finally(() => this.cleanup());
    } else if (msg.phase === "announce") {
      // the live got lively enough for a big group event
      ui.banner("⚡ Làng đông vui quá!", "Sự kiện lớn: " + (ep.label || ""), 3500);
      this.b.say("bigAnnounce", "", { event: ep.label || "" }, 3);
    } else if (msg.phase === "wrong" && this.cur?.ep.id === ep.id) {
      this.quizWrong(msg.who, msg.close || 0);
    } else if (msg.phase === "progress" && this.cur?.ep.id === ep.id) {
      this.cur.deadline = performance.now() + (ep.remainingMs ?? 0) + 20000;
      const hintBefore = this.cur.ep.hint;
      this.cur.ep = ep;
      if (ep.quiz) {
        ui.updateQuiz(ep);
        if (ep.hint !== hintBefore && this.b.cooldown("quiz-hint", 8)) this.b.sayAs("giao", "quizHint", {}, 2);
      } else if (ep.big) this.big.update(ep); else ui.updateChallenge(ep);
    } else if (msg.phase === "end" && this.cur?.ep.id === ep.id) {
      this.cur.ep = ep;
      this.cur.done = true;
      if (ep.quiz) ui.endQuiz(ep, ep.winnerUser || null); // stop the board + timer the moment someone is right
      else if (ep.big) this.big.update(ep); else ui.updateChallenge(ep);
      this.b.voice.clearLow(3);
      this.cur.resolve({ success: msg.success, cancelled: msg.cancelled });
    }
  }
  /** Reconnect / page reload in the middle of a challenge. */
  resume(ep) {
    if (ep && !this.cur) this.onMessage({ phase: "start", ep });
  }
  /** After a reconnect: if the server no longer runs our episode (it restarted), close ours and follow the server. */
  sync(ep) {
    const c = this.cur;
    if (c && !c.done && (!ep || ep.id !== c.ep.id)) this.forceEnd(c);
    if (ep && !this.cur) setTimeout(() => this.resume(ep), 1500);
  }
  forceEnd(c) {
    if (!c || c.done) return;
    c.done = true;
    c.resolve({ success: false, cancelled: true });
  }
  onEvent(ev) {
    this.big.onEvent(ev); // chat commands for the pot-breaking game
    // a scuffle in the village: viewers type "can" to break it up
    const sc = this.scuffleCan;
    if (sc && ev.type === "chat" && /(^|\s)(can|can ra|thôi|dừng|hòa)(\s|!|$)/i.test(String(ev.text || "").toLowerCase())) {
      if (!sc.names.includes(ev.user.name)) { sc.names.push(ev.user.name); sc.count++; }
      ui.label("can-count", `🙏 Can ra: ${Math.min(sc.count, sc.need)}/${sc.need}`, "bubble small", (p) => p.copy(sc.P).add({ x: 0, y: 2.1, z: 0 }), 4000);
    }
    // small reactions while a challenge is running
    const c = this.cur;
    if (!c || c.done) return;
    if ((ev.type === "like" || ev.type === "chat") && c.cast[0] && (c.ep.type === "quan" || c.ep.type === "tax") && this.b.cooldown("ep-react", 8)) {
      this.b.sayText(c.ep.type === "quan" ? "quan" : "ly", ["Hừm...", "Ái chà, làng này rôm rả gớm!", "Được đấy, cổ vũ tiếp xem nào!"][(Math.random() * 3) | 0], 1);
    }
  }

  async run(fn, id) {
    // the server never overlaps episodes; still wait (up to 25 s) if this screen is behind
    for (let i = 0; i < 50 && (this.scene || this.cur); i++) await sleep(500);
    if (this.scene || this.cur) return this.b.send({ t: "sceneDone", id });
    this.scene = true;
    try { await fn(); } catch (e) { console.error(e); } finally {
      this.scene = false;
      this.b.send({ t: "sceneDone", id });
    }
  }

  // ---------------------------------------------------------------- helpers
  async spawn(key, at, opts = {}) {
    const v = await this.w.spawnVillager({ variant: CHARS[key], at: at.clone(), noTint: true, ...opts });
    if (opts.label) this.b.tagVillager(v);
    this.cur?.cast.push(v);
    return v;
  }
  leave(v, to = GATE, speedMul = 1) {
    if (!v || v.dead) return Promise.resolve();
    v.speed *= speedMul;
    return v.walk([SPOTS.junction.clone().add({ x: v.root.position.x * 0.3, y: 0, z: 0 }), to]).then(() => {
      ui.unlabel("v-" + v.id);
      this.w.remove(v);
    });
  }
  async cleanup() {
    const c = this.cur;
    this.cur = null;
    if (!c) return;
    this.w.lao.lookAt = null;
    this.w.dog.lookAt = null;
    if (this.w.dog.root.position.distanceTo(this.w.dogHome) > 0.05) await this.dogHome();
    await Promise.race([c.leaving || Promise.resolve(), sleep(15000)]);
    for (const v of c.cast) if (!v.dead) { ui.unlabel("v-" + v.id); this.w.remove(v); }
    for (const p of c.props || []) this.w.scene.remove(p);
  }
  /** An intro line, skipped if the challenge is already decided. */
  intro(fn) {
    const c = this.cur;
    if (!c || c.done) return Promise.resolve();
    return Promise.race([fn(), c.result]);
  }
  /** Taunts / pleas every few seconds until the server decides the challenge. */
  async whileRunning(lines) {
    const c = this.cur;
    let i = 0;
    while (!c.done) {
      const r = await Promise.race([c.result, sleep(8000)]);
      if (r || c.done) break;
      const [who, kind] = lines[i++ % lines.length];
      const vars = { left: ui.challengeLeft(), progress: c.ep.progress, target: c.ep.target };
      if (who === "dog") { this.b.bark(3, "Gâu gâu! Grừ…", true); continue; }
      if (who === "dogsad") {
        sfx.whine();
        ui.label("dog-say", "Ư ử… 🥺", "bubble dog", (v) => this.w.dog.worldPos("Head", v).add({ x: 0, y: 0.38, z: 0 }), 2000);
        continue;
      }
      await this.b.sayAs(who, kind, vars, 2);
    }
    return c.result;
  }
  walkDog(to, dur) {
    const dog = this.w.dog.root;
    const from = dog.position.clone();
    return new Promise((res) => {
      let t = 0;
      const step = (dt) => {
        t += dt;
        const p = Math.min(1, t / dur);
        dog.position.lerpVectors(from, to, p);
        dog.position.y = Math.abs(Math.sin(t * 14)) * 0.06;
        dog.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
        if (p >= 1) { dog.position.y = 0; this.w.tickers.delete(step); res(); }
      };
      this.w.tickers.add(step);
    });
  }
  async dogHome() {
    await this.walkDog(this.w.dogHome.clone(), 1.2);
    this.w.dog.root.rotation.y = 0.35;
  }

  // ================================================================ QUAN HUYỆN hỏi mua Cậu Vàng — cả làng cổ vũ để giữ Vàng
  async quan() {
    const c = this.cur, ep = c.ep, b = this.b;
    ui.showChallenge(ep, "🎩 Quan huyện hỏi mua Cậu Vàng!", `Thả tim, bình luận cổ vũ cho làng (${ep.target} điểm)`);
    b.voice.clearLow(1);
    const quan = await this.spawn("quan", ENTER, { label: "Quan huyện", labelClass: "tag npc", speedMul: HURRY });
    const long = await this.spawn("linhLong", ENTER.clone().add({ x: -0.3, y: 0, z: -0.6 }), { speedMul: HURRY });
    const giao = await this.spawn("linhGiao", ENTER.clone().add({ x: 0.6, y: 0, z: -0.3 }), { label: "Lính", labelClass: "tag npc", speedMul: HURRY });
    b.registerSpeaker("quan", quan);
    b.registerSpeaker("linh", giao);
    const QP = V(-1.4, 0.75), LP = V(-1.6, 0.1), GP = V(1.2, 0.3);
    for (const ch of this.w.chickens) ch.scare(V(0, -1));
    await Promise.all([
      quan.walk([V(-0.2, -2.0), QP]),
      long.walk([V(-0.5, -2.4), LP]),
      giao.walk([V(0.4, -2.2), GP]),
    ]);
    quan.face(0, 0.2); long.face(-0.4, 1.2); giao.face(0, 0.2);
    this.w.lao.lookAt = quan.root.position;
    this.w.dog.lookAt = quan.root.position;
    quan.point(2.5);
    b.bark(2, "Gâu! Gâu!");
    await this.intro(() => b.sayAs("quan", "quanArrive"));
    this.w.lao.thank(1);
    await this.intro(() => b.sayAs("lao", "laoRefuseQuan"));
    quan.akimbo(3);
    await this.intro(() => b.sayAs("quan", "quanDemand", { target: ep.target, seconds: ui.challengeLeft() }));
    const r = await this.whileRunning([["quan", "quanTaunt"], ["lao", "quanCheer"], ["dog"], ["quan", "quanTaunt"]]);
    if (r.cancelled) { ui.endChallenge(false, "Quan đã về"); this.allLeave(); return; }
    if (r.success) {
      ui.endChallenge(true, "✅ Cả làng giữ được Cậu Vàng!");
      ui.confetti();
      sfx.fanfare();
      quan.akimbo(2);
      await b.sayAs("quan", "quanLose");
      this.w.lao.rejoice(2.5);
      this.w.dog.happy(2.5);
      b.bark(3, "Gâu gâu! 🎉", true);
      this.allLeave();
      await b.sayAs("lao", "laoQuanWin");
      return;
    }
    // not enough cheers: nothing bad happens — the mandarin just goes home (no pressure on viewers)
    ui.endChallenge(false, "Quan về phủ · hẹn dịp khác");
    await b.sayAs("quan", "quanFail");
    this.allLeave(1.2);
    this.w.dog.happy?.(1.2);
    await b.sayAs("lao", "laoQuanFail");
  }

  /**
   * Not enough cheers: `taker` leads Cậu Vàng away, Lão is heartbroken; at the village gate
   * Cậu Vàng struggles free and runs back home. (Challenges never count gifts.)
   */
  async dogTakenAway(taker, takerWho) {
    const b = this.b, lao = this.w.lao, dog = this.w.dog, d = dog.root;
    b.wake();
    // the taker walks up and grabs the rope
    taker.speed = Math.max(taker.speed, 1.6);
    await taker.walk([d.position.clone().add({ x: 0.45, y: 0, z: 0.3 })]);
    taker.face(d.position.x, d.position.z);
    taker.give(1);
    dog.lookAt = taker.root.position;
    b.bark(3, "Gâu! Gâu! 😟", true);
    await sleep(800);

    // led away on a rope: Cậu Vàng follows behind, looking back at Lão
    const follow = (dt) => {
      const k = taker.root;
      const behind = k.position.clone().add({ x: -Math.sin(k.rotation.y) * 0.6, y: 0, z: -Math.cos(k.rotation.y) * 0.6 });
      d.position.lerp(behind, Math.min(1, dt * 5));
      d.position.y = Math.abs(Math.sin(performance.now() / 110)) * 0.03;
      d.rotation.y = Math.atan2(k.position.x - d.position.x, k.position.z - d.position.z);
    };
    this.w.tickers.add(follow);
    dog.lookAt = lao.worldPos("Head", new THREE.Vector3());
    b.laoSad = true;
    lao.lookAt = d.position;
    lao.beg(4.5); // reaches out after Cậu Vàng
    sfx.whine();
    ui.label("dog-say", "Ư ử… 🥺", "bubble dog", (v) => dog.worldPos("Head", v).add({ x: 0, y: 0.38, z: 0 }), 2500);
    b.sayAs("lao", "laoSadDogTaken", {}, 3);
    taker.speed = 1.0;
    await taker.walk([V(0.3, -2.2), V(0, -7.8)]);
    this.w.tickers.delete(follow);

    // at the gate: Cậu Vàng struggles free
    taker.face(d.position.x, d.position.z);
    const shake = (dt) => {
      d.rotation.y += Math.sin(performance.now() / 45) * 0.35;
      d.position.y = Math.abs(Math.sin(performance.now() / 70)) * 0.08;
    };
    this.w.tickers.add(shake);
    b.bark(4, "GRỪ! GÂU GÂU! 💢", true);
    await sleep(700);
    taker.jump(0.35);
    sfx.thud();
    b.sayAs(takerWho, "takerOuch", {}, 3);
    await sleep(900);
    this.w.tickers.delete(shake);
    d.position.y = 0;

    // runs all the way back to Lão
    ui.label("dog-say", "Gâu gâu! 🏃", "bubble dog", (v) => dog.worldPos("Head", v).add({ x: 0, y: 0.38, z: 0 }), 1600);
    await this.dogRun(V(0.2, -2.3), 4.0);
    await this.dogRun(this.w.dogHome, 3.6);
    d.rotation.y = 0.35;
    b.laoSad = false;
    dog.lookAt = null;
    lao.lookAt = null;
    lao.rejoice(2.6);
    dog.happy(2.6);
    b.bark(2, "Gâu! 💛", true);
    ui.hearts(5, 0.3, 0.7);
    await b.sayAs("lao", "laoDogBack", {}, 3);
  }

  /** Send the whole cast home in the background (the episode is over for the stage). */
  allLeave(speedMul = 1) {
    const c = this.cur;
    c.leaving = Promise.all(c.cast.map((v, i) => this.leave(v, i % 2 ? V(-9, -2.2) : GATE, speedMul)));
  }

  // ================================================================ LÝ TRƯỞNG xét mở hội làng — cả làng rôm rả thì mở hội
  async tax() {
    const c = this.cur, ep = c.ep, b = this.b;
    ui.showChallenge(ep, "🏮 Lý trưởng xét mở hội làng!", `Thả tim, bình luận cho làng rôm rả (${ep.target} điểm) là mở hội`);
    b.voice.clearLow(1);
    const ly = await this.spawn("ly", V(5, -2.2), { label: "Lý trưởng", labelClass: "tag npc", speedMul: HURRY });
    const linh = await this.spawn("linhGiao", V(5.6, -2.0), { label: "Lính", labelClass: "tag npc", speedMul: HURRY });
    b.registerSpeaker("ly", ly);
    b.registerSpeaker("linh", linh);
    const LYP = V(1.05, 0.85), LP = V(1.45, 0.05);
    await Promise.all([ly.walk([V(1.8, -1.4), LYP]), linh.walk([V(2.3, -1.6), LP])]);
    ly.face(0, 0.2); linh.face(0, 0.2);
    this.w.lao.lookAt = ly.root.position;
    this.w.dog.lookAt = ly.root.position;
    b.bark(2, "Gâu! Gâu!");
    ly.point(2.5);
    await this.intro(() => b.sayAs("ly", "taxDemand", { target: ep.target }));
    this.w.lao.nod();
    await this.intro(() => b.sayAs("lao", "laoAskVillage"));
    const r = await this.whileRunning([["ly", "taxTaunt"], ["lao", "laoAskVillage"], ["dog"], ["ly", "taxTaunt"]]);
    if (r.cancelled) { ui.endChallenge(false, "Lý trưởng đã về"); this.allLeave(); return; }
    if (r.success) {
      ui.endChallenge(true, "🎉 Làng mở hội!");
      ly.bow();
      await b.sayAs("ly", "taxPaid");
      b.sayAs("lao", "laoTaxPaid", {}, 3);
      await b.festival([ly, linh], 15);
      this.allLeave();
      return;
    }
    // not enough: the festival simply waits for another day
    ui.endChallenge(false, "Hẹn dịp khác mở hội");
    await b.sayAs("ly", "taxFail");
    this.allLeave(1.2);
    await b.sayAs("lao", "laoTaxFail");
  }

  // ================================================================ BINH TƯ lảng vảng quanh Cậu Vàng
  async binhtu() {
    const c = this.cur, ep = c.ep, b = this.b;
    ui.showChallenge(ep, "🚨 Binh Tư lảng vảng quanh Cậu Vàng!", `Thả tim, bình luận “đuổi” để cả làng hô vui (${ep.target} điểm)`);
    b.voice.clearLow(1);
    const binh = await this.spawn("binh", V(-4.5, -0.2), { label: "Binh Tư", labelClass: "tag npc" });
    b.registerSpeaker("binh", binh);
    binh.sneak = true;
    const path = [V(-2.8, 0.6), V(-1.6, 0.75), this.w.dog.root.position.clone().add({ x: -0.4, y: 0, z: 0.15 })];
    const len = path.reduce((a, p, i) => a + p.distanceTo(i ? path[i - 1] : binh.root.position), 0);
    binh.speed = len / Math.max(10, ui.challengeLeft() * 0.85);
    binh.walk(path);
    this.w.dog.lookAt = binh.root.position;
    await sleep(1500);
    this.w.lao.lookAt = binh.root.position;
    b.sayAs("lao", "laoSpotThief", {}, 3);
    await sleep(3500);
    b.sayAs("binh", "binhTuSneak", {}, 3);
    const r = await this.whileRunning([["dog"], ["lao", "laoSpotThief"], ["binh", "binhTuSneak"], ["dog"]]);
    binh.moving = false;
    if (r.cancelled) { ui.endChallenge(false, "Binh Tư đã đi"); c.leaving = this.leave(binh, V(-9, -2.2)); return; }
    if (r.success) {
      ui.endChallenge(true, "✅ Cả làng hô một tiếng, Binh Tư chạy mất!");
      binh.jump(0.3);
      b.bark(4, "Gâu gâu gâu!!", true);
      for (const v of this.w.villagers) if (v.ambient) { v.face(binh.root.position.x, binh.root.position.z); v.wave(2); }
      await b.sayAs("binh", "binhTuFlee");
      binh.sneak = false;
      c.leaving = this.leave(binh, V(-9, -2.2), 5);
      await b.sayAs("lao", "laoThiefGone");
      return;
    }
    // not enough: Cậu Vàng barks, Binh Tư gets scared and slinks off anyway (no dog taken)
    ui.endChallenge(false, "Binh Tư bỏ đi");
    binh.sneak = false;
    this.w.dog.lookAt = binh.root.position;
    b.bark(3, "Gâu gâu gâu!", true);
    await b.sayAs("binh", "binhTuFlee");
    c.leaving = this.leave(binh, V(-9, -2.2), 3);
  }

  // ================================================================ ÔNG GIÁO giới thiệu làng, hướng dẫn cách chơi
  // ================================================================ ÔNG GIÁO ĐỌC THƠ + khen vài người đang chat
  async poem() {
    const b = this.b;
    const poems = (b.cfg().poems || []).filter(Boolean);
    if (!poems.length) return;
    const giao = await this.w.spawnVillager({ variant: CHARS.giao, at: V(5, -2.2), noTint: true, speedMul: HURRY, label: "📜 Ông Giáo", labelClass: "tag giao" });
    b.tagVillager(giao);
    b.registerSpeaker("giao", giao);
    await giao.walk([V(1.9, -1.3), V(1.05, 0.75)]);
    giao.face(0.3, 6);
    this.w.lao.lookAt = giao.root.position;
    const lines = poems[(Math.random() * poems.length) | 0].split("|").map((l) => l.trim()).filter(Boolean);
    ui.poem(lines);
    await b.sayAs("giao", "giaoPoemIntro", {}, 2);
    for (let i = 0; i < lines.length; i++) {
      ui.poemLine(i);
      if (i % 2 === 0) giao.point?.(1.2);
      await b.sayText("giao", lines[i], 2);
    }
    this.w.lao.nod();
    await sleep(800);
    ui.poem(null);
    // shout-outs: a few viewers who chatted in the last 3 minutes and stand in the village
    const now = performance.now();
    const picks = [...(b.chatters?.values() || [])]
      .filter((x) => now - x.at < 180000 && b.crowd.get(x.user.id)?.v && !b.crowd.get(x.user.id).v.dead)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    for (const x of picks) {
      const m = b.crowd.get(x.user.id);
      if (!m?.v || m.v.dead) continue;
      const v = m.v;
      giao.face(v.root.position.x, v.root.position.z);
      giao.point?.(1.4);
      b.fx.spotlight(v.root, 2.6);
      if (!m.busy) { v.face(giao.root.position.x, giao.root.position.z); v.wave?.(2); }
      ui.label("shout-" + v.id, "⭐ Ông Giáo khen", "bubble small", (p) => (v.dead ? null : p.copy(v.root.position).add({ x: 0, y: v.height + 0.75, z: 0 })), 2600);
      ui.feed(`⭐ Ông Giáo khen <b>${ui.esc(x.user.name)}</b>`, x.user.avatar, x.user.name);
      await b.sayAs("giao", "giaoShout", { name: x.user.name }, 2);
    }
    this.w.lao.lookAt = null;
    await giao.walk([V(1.9, -1.3), V(9, -2.2)]);
    ui.unlabel("v-" + giao.id);
    this.w.remove(giao);
  }

  // ================================================================ DÂN LÀNG ẨU ĐẢ (hoạt hình, không phải người xem)
  async scuffle(ep = null) {
    const b = this.b;
    const pool = VARIANTS.filter((v) => v.swingR !== false && v.swingL !== false && !v.scale);
    const pick = () => pool[(Math.random() * pool.length) | 0];
    const P = V(1.1, 1.6); // in front, right of Lão: well inside the portrait frame
    // two viewers picked by the admin: use their own villagers (bring them into the village if needed)
    let A = null, B = null, named = null;
    if (ep?.cast?.length === 2) {
      const ms = [];
      for (const u of ep.cast) {
        let m = b.crowd.get(u.id);
        if (!m) { b.crowd.join({ id: u.id, name: u.name }, 4); for (let i = 0; i < 16 && !(m = b.crowd.get(u.id))?.v; i++) await sleep(500); }
        for (let i = 0; i < 12 && m?.busy; i++) await sleep(500);
        if (m?.v && !m.v.dead) ms.push(m);
      }
      if (ms.length === 2) { named = ms; ms.forEach((m) => (m.busy = true)); A = ms[0].v; B = ms[1].v; }
    }
    // otherwise: two viewers who are in the room (their villagers in the crowd), most recently active first
    if (!A) {
      const ms = this.pickViewers(2);
      if (ms.length === 2) { named = ms; ms.forEach((m) => (m.busy = true)); A = ms[0].v; B = ms[1].v; }
    }
    if (!A) { // fewer than two viewers in the village: two cartoon villagers instead
      A = await this.w.spawnVillager({ variant: pick(), at: V(6.5, 1.4), speedMul: 2 });
      B = await this.w.spawnVillager({ variant: pick(), at: V(-0.4, 3.6), speedMul: 2 });
    }
    const say = (v, text, ms = 2200) => ui.label("sc-" + v.id, ui.esc(text), "bubble small", (p) => (v.dead ? null : p.copy(v.root.position).add({ x: 0, y: v.height + 0.35, z: 0 })), ms);
    await Promise.all([A.walk([V(P.x + 0.33, P.z)]), B.walk([V(P.x - 0.33, P.z + 0.05)])]);
    A.face(B.root.position.x, B.root.position.z);
    B.face(A.root.position.x, A.root.position.z);
    sfx.thud();
    const fights = [
      ["Ê! Đi đứng kiểu gì thế!", "Ông đâm vào tôi trước chứ!"],
      ["Gà nhà ông lại bới vườn nhà tôi!", "Thế cây nhãn nhà ông chìa sang sân tôi thì sao!"],
      ["Ai cho ông giẫm vào luống rau của tôi!", "Rau gì mà mọc ra giữa đường thế!"],
    ];
    const [la, lb] = fights[(Math.random() * fights.length) | 0];
    say(A, la, 1500); A.point?.(1.0);
    await sleep(900);
    say(B, lb, 1500); B.akimbo?.(1.0);
    await sleep(900);
    ui.banner("💢 Hàng xóm cãi nhau!", "Gõ “can” vào bình luận để can ra", 3000);
    this.w.lao.lookAt = P;
    if (named) b.sayText("lao", `Ối, ${spokenName(named[0].user.name)} với ${spokenName(named[1].user.name)} đấu vui kìa! Bà con gõ can nào!`, 2);
    else b.say("scuffleStart", "", {}, 2);
    // the cartoon dust cloud: the two vanish into it, stars and "Bốp!" fly out
    A.root.visible = false; B.root.visible = false;
    ui.unlabel("sc-" + A.id); ui.unlabel("sc-" + B.id);
    const cloud = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: "#e9dcc3", roughness: 1 });
    const puffs = [];
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.22 + Math.random() * 0.14, 10, 8), mat);
      s.userData.a = Math.random() * 6; s.userData.r = 0.18 + Math.random() * 0.22; s.userData.y = 0.3 + Math.random() * 0.7;
      cloud.add(s); puffs.push(s);
    }
    cloud.position.copy(P);
    cloud.scale.setScalar(0.72);
    this.w.scene.add(cloud);
    let t = 0;
    const spin = (dt) => {
      t += dt;
      for (const s of puffs) {
        s.userData.a += dt * 6;
        s.position.set(Math.cos(s.userData.a) * s.userData.r, s.userData.y + Math.sin(t * 9 + s.userData.a) * 0.08, Math.sin(s.userData.a) * s.userData.r);
        s.scale.setScalar(1 + Math.sin(t * 11 + s.userData.a) * 0.15);
      }
    };
    this.w.tickers.add(spin);
    const POWS = ["Bốp!", "Bụp!", "Á à!", "Ui da!", "Huỵch!", "Này thì…!"];
    const pow = setInterval(() => {
      ui.label("pow", POWS[(Math.random() * POWS.length) | 0], "bubble dog", (p) => p.copy(P).add({ x: (Math.random() - 0.5) * 0.8, y: 1.3 + Math.random() * 0.4, z: 0 }), 650);
      b.fx.burst(P.clone().add({ x: 0, y: 0.9, z: 0 }), { n: 10, colors: ["#ffd54a", "#ffffff"], speed: 2.2, gravity: 2, life: 0.7, size: 0.09 });
      sfx.thud();
    }, 500);
    b.bark(3, "Gâu gâu gâu! 😵", true);
    // viewers break it up by typing "can"
    const need = 3;
    this.scuffleCan = { count: 0, names: [], need, P };
    const until = performance.now() + 7000;
    while (performance.now() < until && this.scuffleCan.count < need) await sleep(300);
    const helpers = this.scuffleCan.names;
    this.scuffleCan = null;
    clearInterval(pow);
    ui.unlabel("pow"); ui.unlabel("can-count");
    // the cloud clears: both stand up, hats askew, and make up
    this.w.tickers.delete(spin);
    this.w.scene.remove(cloud);
    A.root.visible = true; B.root.visible = true;
    A.root.rotation.z = 0.12; B.root.rotation.z = -0.12;
    b.fx.burst(P.clone().add({ x: 0, y: 0.8, z: 0 }), { n: 30, colors: ["#e9dcc3", "#d8c9a3"], speed: 1.6, gravity: 0.4, life: 1.2, size: 0.14 });
    await sleep(300);
    A.root.rotation.z = 0; B.root.rotation.z = 0;
    if (helpers.length) {
      ui.feed(`🙏 Cảm ơn ${helpers.slice(0, 4).map((n) => "<b>" + ui.esc(n) + "</b>").join(", ")} đã can ra!`);
    }
    say(A, "Thôi, hàng xóm với nhau cả…", 1600);
    await sleep(600);
    say(B, "Ừ, bắt tay làm lành!", 2000);
    A.nod?.(); B.nod?.();
    b.fx.burst(P.clone().add({ x: 0, y: 1.6, z: 0 }), { n: 18, colors: ["#ff6b8a", "#ffd54a"], speed: 1.4, gravity: -0.4, life: 1.4, size: 0.12 });
    this.w.lao.rejoice(1.8);
    b.say("scuffleEnd", "", {}, 2);
    await sleep(1200);
    this.w.lao.lookAt = null;
    if (named) {
      // back to their places in the crowd, friends again
      for (const m of named) if (b.crowd.get(m.user.id) === m) b.crowd.returnToSpot(m); else m.busy = false;
      return;
    }
    await Promise.all([A.walk([V(6.5, 1.4)]), B.walk([V(-0.4, 3.6)])]);
    this.w.remove(A); this.w.remove(B);
  }

  // ================================================================ ÔNG GIÁO ĐỐ CHỮ
  async quiz() {
    const c = this.cur, b = this.b;
    const giao = await this.spawn("giao", V(5, -2.2), { speedMul: HURRY, label: "📜 Ông Giáo", labelClass: "tag giao" });
    b.registerSpeaker("giao", giao);
    c.giao = giao;
    ui.showQuiz(c.ep);
    const mode = c.ep.mode || "scramble";
    if (mode === "riddle") ui.banner("🤔 Ông Giáo đố vui!", "Nghĩ nhanh · gõ đáp án vào bình luận", 3500);
    else if (mode === "math") ui.banner("🧮 Toán nhanh!", "Tính nhẩm · gõ kết quả vào bình luận", 3500);
    else ui.banner("📜 Ông Giáo đố chữ!", "Xếp lại các chữ · gõ đáp án vào bình luận", 3500);
    sfx.ting?.();
    const spot = V(1.05, 0.75);
    // someone may answer while Ông Giáo is still walking in / talking: stop right there
    await Promise.race([giao.walk([V(1.9, -1.3), spot]), c.result]);
    giao.face(0.3, 6);
    this.w.lao.lookAt = giao.root.position;
    if (!c.done) {
      giao.point(1.6);
      await Promise.race([b.sayAs("giao", mode === "riddle" ? "quizStartRiddle" : mode === "math" ? "quizStartMath" : "quizStart", {}, 3), c.result]);
      // read the riddle / the sum out loud
      if (!c.done && c.ep.question) {
        const spokenQ = mode === "math"
          ? c.ep.question.replace(/×/g, " nhân ").replace(/−/g, " trừ ").replace(/\+/g, " cộng ").replace(/= \?/, " bằng mấy?")
          : c.ep.question;
        await Promise.race([b.sayText("giao", spokenQ, 3), c.result]);
      }
    }
    const r = await c.result;
    const ep = c.ep;
    if (r.cancelled) { ui.endQuiz(ep, null); c.leaving = this.leave(giao); return; }
    const w = ep.winnerUser;
    if (w) {
      // shout-out: the winner steps forward, spotlight, honour board
      ui.endQuiz(ep, w);
      const m = b.crowd.get(w.id);
      const secs = Math.max(1, Math.round((w.ms || 0) / 1000));
      ui.banner(`🎓 ${w.name} giải đúng!`, `Đáp án: ${ep.answer} · ${secs} giây`, 4500);
      ui.honor(mode === "math" ? "🧮 Thần đồng tính nhẩm" : mode === "riddle" ? "🎓 Trạng nguyên đố vui" : "🎓 Trạng nguyên đố chữ", [w.name], "#3f8fd2", 1, ep.winXp || 0);
      ui.confetti(60);
      sfx.fanfare();
      if (m?.v && !m.v.dead) {
        m.busy = true;
        const v = m.v;
        await Promise.race([v.walk([V(-0.95, 1.05)]), sleep(4000)]);
        v.face(0.3, 6);
        b.camFx?.focus((out) => (v.dead ? null : out.copy(v.root.position)), 3.4, 4);
        b.fx.spotlight(v.root, 3.4);
        b.fx.firecrackers(v.root.position, 8);
        v.dance(3.2);
        giao.face(v.root.position.x, v.root.position.z);
        this.w.lao.lookAt = v.root.position;
      } else b.fx.fireworks(2);
      this.w.lao.rejoice(2.2);
      b.bark(2, "Gâu gâu! 🎓", true);
      await b.sayAs("giao", "quizWin", { name: w.name, answer: ep.answer }, 3);
      await sleep(1200);
      ui.honor(null);
      if (m && b.crowd.get(w.id) === m) b.crowd.returnToSpot(m);
    } else {
      ui.endQuiz(ep, null);
      giao.akimbo(2.5);
      await b.sayAs("giao", "quizNobody", { answer: ep.answer }, 3);
    }
    this.w.lao.lookAt = null;
    c.leaving = this.leave(giao);
  }
  /** A wrong try: Ông Giáo scolds (kindly, by name); the one who guessed hangs their head. */
  quizWrong(who, close) {
    const c = this.cur, b = this.b;
    if (!c?.giao || c.giao.dead || c.done || !who) return;
    ui.quizWrong(who.name);
    if (!b.cooldown("quiz-wrong", 3.5)) return;
    const near = close >= 0.5;
    c.giao.face(0.3, 6);
    if (near) c.giao.point(1.4); else c.giao.akimbo(1.8);
    b.bubbleLine("giao", near ? "quizClose" : "quizWrong", { name: who.name });
    const m = b.crowd.get(who.id);
    if (m?.v && !m.busy && !m.v.dead) {
      m.v.face(c.giao.root.position.x, c.giao.root.position.z);
      m.v.play(1.6, (p, add) => { const k = Math.sin(p * Math.PI); add("Head", "rot", "x", 0.45 * k); add("Body", "rot", "x", 0.12 * k); });
    }
  }

  async ongiao() {
    const b = this.b;
    const giao = await this.w.spawnVillager({ variant: CHARS.giao, at: V(5, -2.2), noTint: true, speedMul: HURRY, label: "Ông Giáo", labelClass: "tag giao" });
    b.tagVillager(giao);
    b.registerSpeaker("giao", giao);
    const spot = V(1.0, 0.7);
    await giao.walk([V(1.9, -1.3), spot]);
    giao.face(0, 0.2);
    this.w.lao.lookAt = giao.root.position;
    this.w.lao.nod();
    await sleep(300);
    // talk to the viewers (camera)
    giao.face(0.3, 6);
    giao.bow();
    ui.banner("📜 Ông Giáo kể chuyện", "Hàng xóm của Lão Hạc · cách chơi trong làng", 3500);
    await b.sayAs("giao", "ongGiaoAppeal", {}, 3);
    // a short chat with Lão, then a sweet potato for the bowl
    giao.face(0, 0.2);
    const convo = b.template("ongGiaoChat");
    for (const part of convo.split("|")) {
      const m = part.match(/^\s*([GL])\s*:\s*(.*)$/);
      if (!m) continue;
      if (m[1] === "L") this.w.lao.nod();
      await b.sayText(m[1] === "G" ? "giao" : "lao", m[2].trim(), 3);
    }
    giao.give(1.4);
    await sleep(500);
    const hand = giao.root.position.clone().add({ x: -0.25, y: 0.85, z: 0 });
    const it = await this.w.throwItem("Khoai", hand, this.w.bowlTarget());
    sfx.thud();
    this.w.keepInBowl(it);
    b.cheer(10);
    this.w.lao.thank(2);
    await sleep(1500);
    this.w.lao.lookAt = null;
    await giao.walk([V(1.9, -1.3), V(9, -2.2)]);
    ui.unlabel("v-" + giao.id);
    this.w.remove(giao);
  }

  /** Tween any object along an arc. */
  arc(obj, to, dur, height = 0.5, spins = 0) {
    const from = obj.position.clone();
    const rx = obj.rotation.x;
    return new Promise((res) => {
      let t = 0;
      const step = (dt) => {
        t += dt;
        const p = Math.min(1, t / dur);
        obj.position.lerpVectors(from, to, p);
        obj.position.y = from.y + (to.y - from.y) * p + Math.sin(p * Math.PI) * height;
        if (spins) obj.rotation.x = rx + p * spins * Math.PI * 2;
        if (p >= 1) { obj.rotation.x = rx; this.w.tickers.delete(step); res(); }
      };
      this.w.tickers.add(step);
    });
  }
  dogRun(to, speed = 2.4) {
    const d = this.w.dog.root.position.distanceTo(to);
    return this.walkDog(to.clone(), Math.max(0.4, d / speed));
  }
  canMoveDog() {
    return !this.b.dancing && !this.cur;
  }
  async kidPair(fromX, speed = 2.4) {
    const k1 = await this.w.spawnVillager({ variant: CHARS.child, at: V(fromX, -1.6), label: "Thằng Cu", labelClass: "tag" });
    const k2 = await this.w.spawnVillager({ variant: CHARS.child, at: V(fromX * 1.12, -1.3) });
    this.b.tagVillager(k1);
    k1.speed = speed; k2.speed = speed * 0.92;
    this.b.registerSpeaker("kid", k1);
    return [k1, k2];
  }
  /** Up to n idle viewers standing in the crowd (people in the room), the most recently active first, a bit shuffled. */
  pickViewers(n) {
    const idle = [...this.b.crowd.members.values()].filter((m) => !m.busy && m.v && !m.v.dead);
    idle.sort((a, b) => (b.lastActive || 0) + Math.random() * 20000 - (a.lastActive || 0) - Math.random() * 20000);
    return idle.slice(0, n);
  }
  bye(...kids) {
    for (const k of kids) { ui.unlabel("v-" + k.id); if (!k.dead) this.w.remove(k); }
  }

  // ================================================================ trẻ con bế Cậu Vàng
  async kidsHug() {
    if (!this.canMoveDog()) return;
    const b = this.b, dog = this.w.dog.root;
    b.wake();
    const sx = Math.random() < 0.5 ? -5 : 5;
    const [k1, k2] = await this.kidPair(sx);
    const dp = dog.position.clone();
    await Promise.all([
      k1.walk([V(sx * 0.35, -1.5), dp.clone().add({ x: -0.3, y: 0, z: 0.4 })]),
      k2.walk([V(sx * 0.4, -1.2), dp.clone().add({ x: -0.75, y: 0, z: 0.85 })]),
    ]);
    if (!this.canMoveDog()) return this.bye(k1, k2);
    k1.face(dp.x, dp.z); k2.face(dp.x, dp.z);
    this.w.dog.lookAt = k1.root.position;
    b.sayAs("kid", "hugKid", {}, 2);
    k1.give(0.9);
    await sleep(500);
    // pick him up and spin around
    let t = 0;
    const base = k1.root.rotation.y;
    const carry = (dt) => {
      t += dt;
      k1.yawTarget = base + Math.max(0, t - 0.4) * 3.2;
      const k = k1.root;
      dog.position.set(k.position.x + Math.sin(k.rotation.y) * 0.22, 0.42 + Math.abs(Math.sin(t * 6)) * 0.05, k.position.z + Math.cos(k.rotation.y) * 0.22);
      dog.rotation.y = k.rotation.y + Math.PI;
    };
    this.w.tickers.add(carry);
    this.w.dog.happy(3.5);
    b.bark(2, "Gâu! 🥰", true);
    ui.hearts(4, 0.25, 0.75);
    k2.jump(0.2);
    this.w.lao.lookAt = k1.root.position;
    b.sayAs("lao", "hugLao", {}, 1);
    await sleep(1600);
    k2.jump(0.2);
    await sleep(1600);
    this.w.tickers.delete(carry);
    k1.yawTarget = Math.atan2(dp.x - k1.root.position.x, dp.z - k1.root.position.z);
    k1.give(0.8);
    await this.walkDog(this.w.dogHome.clone(), 0.6);
    dog.rotation.y = 0.35;
    b.bark(1, "Gâu! 💛");
    this.w.lao.lookAt = null;
    this.w.dog.lookAt = null;
    await Promise.all([k1.walk([V(-sx * 1.4, -1.6)]), k2.walk([V(-sx * 1.5, -1.3)])]);
    this.bye(k1, k2);
  }

  // ================================================================ trẻ con chơi bóng với Cậu Vàng
  // ================================================================ VÀNG NHÀO LỘN ĐỚP BÓNG (trẻ con sút bóng lên cao)
  async dogFlip() {
    if (!this.canMoveDog()) return;
    const b = this.b, dogRig = this.w.dog, dog = dogRig.root;
    b.wake();
    const [k1, k2] = await this.kidPair(-5, 2.6);
    const P1 = V(-1.6, 1.5), P2 = V(-1.0, 1.9);
    await Promise.all([k1.walk([V(-2.4, -1.2), P1]), k2.walk([V(-2.0, -1.5), P2])]);
    if (!this.canMoveDog()) return this.bye(k1, k2);
    const spot = V(0.55, 1.35); // Cậu Vàng's jump spot, in front of Lão
    k1.face(spot.x, spot.z); k2.face(spot.x, spot.z);
    dogRig.lookAt = k1.root.position;
    await this.dogRun(spot, 3);
    dog.rotation.y = Math.atan2(k1.root.position.x - spot.x, k1.root.position.z - spot.z);
    b.sayAs("kid", "ballKid", {}, 2);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 10), new THREE.MeshStandardMaterial({ color: "#2f7fd2", roughness: 0.6 }));
    ball.castShadow = true;
    ball.position.copy(k1.root.position).add({ x: 0.15, y: 0.08, z: 0.1 });
    this.w.scene.add(ball);
    // the kick: leg swings, the ball flies high over Cậu Vàng
    await sleep(500);
    k1.play(0.5, (p, add) => add("LegR", "rot", "x", -1.1 * Math.sin(p * Math.PI)));
    sfx.thud();
    const apex = spot.clone().add({ x: 0, y: 1.3, z: 0 });
    const fly = this.arc(ball, apex, 0.85, 0.9);
    b.bark(1, "Gâu! 👀", true);
    // Vàng leaps, does a full flip in the air and snaps the ball at the top
    await sleep(320);
    const T = 1.15;
    let t = 0, caught = false;
    await new Promise((res) => {
      const flip = (dt) => {
        t += dt;
        const p = Math.min(1, t / T);
        dog.position.y = Math.sin(p * Math.PI) * 1.0;
        dog.rotation.x = -p * Math.PI * 2;
        if (!caught && p > 0.45) { caught = true; ball.userData.held = true; }
        if (caught) ball.position.copy(dog.position).add({ x: Math.sin(dog.rotation.y) * 0.2, y: 0.32, z: Math.cos(dog.rotation.y) * 0.2 });
        if (p >= 1) { dog.position.y = 0; dog.rotation.x = 0; this.w.tickers.delete(flip); res(); }
      };
      this.w.tickers.add(flip);
    });
    await fly.catch?.(() => {});
    b.fx.burst(dog.position.clone().add({ x: 0, y: 0.4, z: 0 }), { n: 40, colors: ["#ffd54a", "#ffffff", "#7ee0ff"], speed: 2.4, gravity: 2, life: 1.2, size: 0.1 });
    sfx.fanfare?.();
    ui.banner("🤸 Cậu Vàng nhào lộn!", "Bay một vòng đớp bóng trên không", 3000);
    dogRig.happy(1.5);
    k1.jump(0.3); k2.jump(0.3);
    setTimeout(() => k2.wave?.(2), 300);
    b.crowd.cheer?.();
    this.w.lao.rejoice(2);
    b.sayText("lao", ["Ối giời! Cậu Vàng nhà lão làm xiếc à!", "Bay một vòng luôn! Giỏi quá Vàng ơi!", "Ha ha, đớp gọn chưa kìa bà con!"][(Math.random() * 3) | 0], 2);
    // bring the ball back to the kids, then home
    const carry = () => ball.position.copy(dog.position).add({ x: Math.sin(dog.rotation.y) * 0.25, y: 0.3, z: Math.cos(dog.rotation.y) * 0.25 });
    this.w.tickers.add(carry);
    await this.dogRun(k1.root.position.clone().add({ x: 0.35, y: 0, z: 0 }), 2.6);
    this.w.tickers.delete(carry);
    ball.position.copy(k1.root.position).add({ x: 0.15, y: 0.55, z: 0 });
    await sleep(600);
    this.w.scene.remove(ball);
    await this.dogRun(this.w.dogHome, 2.4);
    dog.rotation.y = 0.35;
    dogRig.lookAt = null;
    this.bye(k1, k2);
  }

  // ================================================================ CẬU VÀNG DÍ (đùa) MỘT NGƯỜI XEM
  /** Vàng picks a viewer from the crowd, chases them round the yard and playfully nips their trousers. */
  async dogChase() {
    if (!this.canMoveDog()) return;
    const b = this.b, dogRig = this.w.dog, dog = dogRig.root;
    const [m] = this.pickViewers(1);
    if (!m) return; // nobody in the village yet
    m.busy = true;
    const v = m.v, name = m.user.name;
    const oldSpeed = v.speed;
    const tag = (text, ms = 1400) => ui.label("dc-" + v.id, ui.esc(text), "bubble small", (p) => (v.dead ? null : p.copy(v.root.position).add({ x: 0, y: v.height + 0.35, z: 0 })), ms);
    b.wake();
    // Vàng spots them: ears up, a growl-bark
    dogRig.lookAt = v.root.position;
    b.bark(2, `Gâu! 👀 ${name}`.slice(0, 40), true);
    ui.banner("🐕 Cậu Vàng dí người!", `${name} chạy mau!`, 3000);
    ui.feed(`🐕 Cậu Vàng đang dí <b>${ui.esc(name)}</b>!`, m.user.avatar, name);
    await sleep(700);
    if (!this.canMoveDog() || v.dead) { m.busy = false; dogRig.lookAt = null; return; }
    tag("Ối giời ơi! Cứu với!", 1800);
    v.jump?.(0.3);
    b.sayText("lao", `Ơ kìa Vàng! ${spokenName(name)} trêu gì mà nó dí thế kia!`, 2);
    // the chase: a loop round the yard in front of Lão; Vàng keeps hopping after them, barking
    v.speed = 2.9;
    const loop = [V(1.7, 1.0), V(0.6, 2.4), V(-1.5, 1.9), V(-2.2, 0.5), V(-0.6, -0.2), V(1.3, 0.3), V(0.9, 1.6)];
    const start = v.root.position.clone();
    const run = v.walk([V(start.x * 0.6, 0.2), ...loop]);
    let running = true;
    run.then(() => (running = false));
    const behind = new THREE.Vector3();
    let n = 0;
    const until = performance.now() + 11000;
    while (running && performance.now() < until && !v.dead) {
      behind.copy(v.root.position);
      const away = behind.clone().sub(dog.position).setY(0);
      const d = away.length();
      if (d > 0.45) behind.sub(away.multiplyScalar(0.4 / d)); // stop just behind them
      await this.walkDog(behind.clone().setY(0), Math.max(0.22, Math.min(0.45, d / 4.2)));
      if (++n % 4 === 0) { sfx.bark(1, true); if (n % 8 === 0) tag(["Á á á!", "Vàng ơi tha cho tôi!", "Chạy đi đâu cho thoát!"][(n / 8) % 3 | 0]); }
    }
    // caught: a playful nip on the trousers
    if (!v.dead) {
      await this.walkDog(v.root.position.clone().add({ x: 0, y: 0, z: 0.25 }).setY(0), 0.25);
      dog.rotation.y = Math.atan2(v.root.position.x - dog.position.x, v.root.position.z - dog.position.z);
      v.face(dog.position.x, dog.position.z);
      dogRig.bark(2);
      sfx.thud();
      ui.label("pow", "Ngoạm! 🩳", "bubble dog", (p) => p.copy(v.root.position).add({ x: 0, y: 0.7, z: 0 }), 1200);
      b.fx.burst(v.root.position.clone().add({ x: 0, y: 0.5, z: 0 }), { n: 16, colors: ["#ffd54a", "#ffffff"], speed: 2, gravity: 2, life: 0.7, size: 0.09 });
      v.jump?.(0.45);
      await sleep(350);
      tag("Ui da! Rách quần tôi rồi!", 2000);
      // Vàng tugs the trousers a few times
      for (let i = 0; i < 3; i++) {
        dog.position.x -= Math.sin(dog.rotation.y) * 0.08; dog.position.z -= Math.cos(dog.rotation.y) * 0.08;
        await sleep(180);
        dog.position.x += Math.sin(dog.rotation.y) * 0.08; dog.position.z += Math.cos(dog.rotation.y) * 0.08;
        await sleep(180);
      }
      this.w.lao.lookAt = v.root.position;
      await b.sayText("lao", `Vàng! Nhả ra ngay! Thôi thôi, nó đùa đấy, ${spokenName(name)} đừng giận lão nhé!`, 2);
      dogRig.happy(1.5);
      tag("Hú hồn! Con chó tinh nghịch quá!", 2200);
      b.crowd.cheer?.();
    }
    v.speed = oldSpeed;
    this.w.lao.lookAt = null;
    dogRig.lookAt = null;
    await this.dogRun(this.w.dogHome, 2.6);
    dog.rotation.y = 0.35;
    ui.unlabel("dc-" + v.id);
    if (b.crowd.get(m.user.id) === m && !v.dead) await b.crowd.returnToSpot(m);
    else m.busy = false;
  }

  async kidsBall() {
    if (!this.canMoveDog()) return;
    const b = this.b, dog = this.w.dog.root;
    b.wake();
    const [k1, k2] = await this.kidPair(-5, 2.6);
    const P1 = V(-1.9, 0.9), P2 = V(1.6, 1.3);
    await Promise.all([k1.walk([V(-2.4, -1.2), P1]), k2.walk([V(-1.6, -1.6), V(1.8, -0.8), P2])]);
    if (!this.canMoveDog()) return this.bye(k1, k2);
    k1.face(P2.x, P2.z); k2.face(P1.x, P1.z);
    this.w.dog.lookAt = k1.root.position;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 10), new THREE.MeshStandardMaterial({ color: "#d9452f", roughness: 0.6 }));
    ball.castShadow = true;
    ball.position.copy(k1.root.position).add({ x: 0.2, y: 0.55, z: 0 });
    this.w.scene.add(ball);
    b.sayAs("kid", "ballKid", {}, 2);
    // a few throws: Cậu Vàng runs after the ball and brings it back
    const throws = [V(0.3, 1.9), V(1.0, 0.9), V(-0.9, 1.7)];
    for (let i = 0; i < throws.length; i++) {
      if (!this.canMoveDog()) break;
      const thrower = i % 2 ? k2 : k1;
      thrower.give(0.6);
      await sleep(250);
      const land = throws[i].clone();
      land.y = 0.07;
      const fly = this.arc(ball, land, 0.9, 1.1);
      for (const ch of this.w.chickens) if (ch.root.position.distanceTo(land) < 1.3) ch.scare(land);
      b.bark(1, i === 0 ? "Gâu! ⚽" : "Gâu gâu!", true);
      await this.dogRun(land.clone().add({ x: 0, y: -0.07, z: -0.15 }), 3.2);
      await fly;
      this.w.dog.happy(1);
      // carry it back to the next kid
      const next = i % 2 ? k1 : k2;
      const back = next.root.position.clone().add({ x: (dog.position.x > next.root.position.x ? 0.35 : -0.35), y: 0, z: 0 });
      const carry = () => ball.position.copy(dog.position).add({ x: Math.sin(dog.rotation.y) * 0.25, y: 0.3, z: Math.cos(dog.rotation.y) * 0.25 });
      this.w.tickers.add(carry);
      await this.dogRun(back, 2.6);
      this.w.tickers.delete(carry);
      ball.position.copy(next.root.position).add({ x: 0.15, y: 0.55, z: 0 });
      next.jump(0.2);
      if (i === 0) b.say("ballLao", "", {}, 1);
      await sleep(400);
    }
    this.w.scene.remove(ball);
    await this.dogRun(this.w.dogHome, 2.4);
    dog.rotation.y = 0.35;
    this.w.dog.lookAt = null;
    this.w.dog.happy(2);
    await Promise.all([k1.walk([V(-2.4, -1.4), V(-7, -2)]), k2.walk([V(1.8, -1.2), V(7, -2)])]);
    this.bye(k1, k2);
  }

  // ================================================================ Cậu Vàng lùa gà
  async herd() {
    if (!this.canMoveDog() || !this.w.chickens.length) return;
    const b = this.b, dog = this.w.dog.root;
    b.wake();
    b.say("herdLao", "", {}, 1);
    this.w.lao.lookAt = dog.position;
    const hens = [...this.w.chickens].sort(() => Math.random() - 0.5).slice(0, 4);
    for (const h of hens) {
      if (!this.canMoveDog()) break;
      const p = h.root.position;
      const to = V(p.x - Math.sign(p.x || 1) * 0.35, p.z + 0.2);
      await this.dogRun(to, 2.8);
      h.scare(dog.position);
      for (const o of this.w.chickens) if (o !== h && o.root.position.distanceTo(dog.position) < 1.6) o.scare(dog.position);
      b.bark(1, ["Gâu! 🐔", "Gâu gâu!", "Về chuồng! 🐓"][(Math.random() * 3) | 0]);
      await sleep(350);
    }
    // a lap around the yard
    for (const p of [V(1.8, 1.6), V(2.2, -0.6), V(-2.2, -0.8), V(-2.0, 1.4)]) {
      if (!this.canMoveDog()) break;
      await this.dogRun(p, 3.0);
      for (const o of this.w.chickens) if (o.root.position.distanceTo(dog.position) < 1.4) o.scare(dog.position);
    }
    await this.dogRun(this.w.dogHome, 2.4);
    dog.rotation.y = 0.35;
    this.w.dog.happy(2);
    this.w.lao.lookAt = null;
    this.w.lao.nod();
  }

  // ================================================================ thi kéo co (two viewers, friendly contest)
  async fight() {
    if (this.cur) return;
    const b = this.b;
    const pool = [...new Set(b.recentNames || [])].sort(() => Math.random() - 0.5);
    const nameA = pool[0] || "Anh Mục";
    const nameB = pool[1] || (nameA === "Anh Xiên" ? "Anh Mục" : "Anh Xiên");
    const A = await this.w.spawnVillager({ at: V(-6, -1.4), speedMul: 2.2, label: "🪢 " + nameA, labelClass: "tag npc" });
    const B = await this.w.spawnVillager({ at: V(6, -1.4), speedMul: 2.2, label: "🪢 " + nameB, labelClass: "tag npc" });
    b.tagVillager(A); b.tagVillager(B);
    b.registerSpeaker("f1", A, nameA);
    b.registerSpeaker("f2", B, nameB);
    ui.feed(`🪢 <b>${ui.esc(nameA)}</b> thi kéo co với <b>${ui.esc(nameB)}</b>!`);
    const mid = V(0.9, -1.25);
    const PA = mid.clone().add({ x: -0.75, y: 0, z: 0 }), PB = mid.clone().add({ x: 0.75, y: 0, z: 0 });
    await Promise.all([A.walk([V(-1.5, -1.6), PA]), B.walk([V(2.6, -1.6), PB])]);
    A.face(PB.x, PB.z); B.face(PA.x, PA.z);
    this.w.lao.lookAt = mid;
    this.w.dog.lookAt = A.root.position;
    A.point(2.2);
    await b.sayAs("f1", "fightStart", { other: spokenName(nameB) }, 3);
    B.akimbo(2.5);
    await b.sayAs("f2", "fightReply", {}, 3);
    ui.banner(`🪢 Kéo co: ${nameA} vs ${nameB}`, "Hội làng thi kéo co!", 3000);
    b.sayAs("lao", "fightLao", {}, 2);
    // the rope + a red ribbon in the middle
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 6), new THREE.MeshStandardMaterial({ color: "#b89a5a", roughness: 1 }));
    const ribbon = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: "#d23b30" }));
    this.w.scene.add(rope, ribbon);
    const handA = new THREE.Vector3(), handB = new THREE.Vector3();
    let shift = 0, t = 0;
    const pullPose = (v, dir) => v.play(7.5, (p, add, tt) => {
      add("Body", "rot", "x", -0.35 + Math.sin(tt * 9) * 0.04);
      add("ArmL", "rot", "x", -1.3); add("ArmR", "rot", "x", -1.3);
      add("LegL", "rot", "x", 0.35 + Math.sin(tt * 7) * 0.08); add("LegR", "rot", "x", -0.25);
    });
    pullPose(A); pullPose(B);
    const ropeStep = (dt) => {
      t += dt;
      shift = Math.sin(t * 1.3) * 0.18 + Math.sin(t * 3.7) * 0.05;
      A.root.position.x = PA.x + shift; B.root.position.x = PB.x + shift;
      handA.copy(A.root.position).add({ x: 0.28, y: 0.95, z: 0 });
      handB.copy(B.root.position).add({ x: -0.28, y: 0.95, z: 0 });
      rope.position.lerpVectors(handA, handB, 0.5);
      rope.scale.y = handA.distanceTo(handB);
      rope.rotation.set(0, 0, Math.PI / 2);
      ribbon.position.copy(rope.position).add({ x: 0, y: -0.04, z: 0 });
    };
    this.w.tickers.add(ropeStep);
    const cheers = ["Cố lên!", "Kéo đi!", "Hò dô ta!", "Cố lên " + nameA + "!", "Cố lên " + nameB + "!"];
    for (let i = 0; i < 6; i++) {
      const idle = [...this.b.crowd.members.values()].filter((m) => !m.busy && m.v && !m.v.dead);
      const m = idle[(Math.random() * idle.length) | 0];
      if (m) {
        m.v.face(mid.x, mid.z);
        m.v.wave(1.6);
        ui.label("c-" + m.v.id, ui.esc(cheers[i % cheers.length]), "bubble small", (p) => (m.v.dead ? null : p.copy(m.v.root.position).add({ x: 0, y: m.v.height + 0.35, z: 0 })), 1400);
      }
      if (i % 2 === 0) b.bark(1, "Gâu! 💪");
      await sleep(1100);
    }
    // the winner gives a big pull; the loser stumbles forward and sits down
    this.w.tickers.delete(ropeStep);
    this.w.scene.remove(rope, ribbon);
    rope.geometry.dispose(); ribbon.geometry.dispose();
    const aWins = Math.random() < 0.5;
    const W = aWins ? A : B, L = aWins ? B : A;
    const winner = aWins ? nameA : nameB, loser = aWins ? nameB : nameA;
    sfx.thud();
    L.play(3.5, (p, add) => {
      const e = Math.min(1, p * 5);
      add("Body", "rot", "x", 0.5 * e);
      add("Body", "pos", "y", -0.3 * e);
      add("LegL", "rot", "x", -1.3 * e);
      add("LegR", "rot", "x", -1.3 * e);
    });
    W.jump(0.3);
    W.wave(2.4);
    ui.confetti(60);
    ui.banner(`🏆 ${winner} thắng kéo co!`, `${loser} ngồi phịch xuống đất 😆`, 3000);
    await b.sayAs("lao", "fightWin", { winner: spokenName(winner), loser: spokenName(loser) }, 3);
    await sleep(600);
    W.face(L.root.position.x, L.root.position.z);
    L.face(W.root.position.x, W.root.position.z);
    A.bow(); B.bow();
    this.w.lao.nod();
    await b.sayAs("lao", "fightMakeUp", {}, 2);
    this.w.lao.lookAt = null;
    this.w.dog.lookAt = null;
    A.speed = B.speed = 1.3;
    await Promise.all([A.walk([V(-1.5, -2.0), V(-8, -2.2)]), B.walk([V(2.6, -2.0), V(8, -2.2)])]);
    this.bye(A, B);
  }

  // ================================================================ mưa rào, rồi cầu vồng
  async rain() {
    const b = this.b, fx = b.fx;
    b.wake();
    const secs = 14;
    const raining = fx.rain(secs);
    ui.banner("🌧️ Mưa rào!", "Cả làng chạy mưa", 2500);
    b.say("rainLao", "", {}, 1);
    // passers-by hurry; the crowd covers their heads
    for (const v of this.w.villagers) if (v.ambient && !v.dead) v.speed *= 2.2;
    for (const m of b.crowd.members.values()) if (!m.busy && m.v && !m.v.dead) m.v.play(secs, (p, add) => { add("ArmL", "rot", "x", -2.6); add("ArmR", "rot", "x", -2.6); add("Body", "rot", "x", 0.12); });
    for (const c of this.w.chickens) c.scare(V(0, 0));
    this.w.dog.sleepTarget = 0;
    await sleep(4000);
    b.bark(1, "Ư ử… 🌧️");
    await raining;
    // Cậu Vàng shakes off the water
    const d = this.w.dog.root;
    await new Promise((res) => {
      let t = 0;
      const shake = (dt) => { t += dt; d.rotation.z = Math.sin(t * 40) * 0.25 * (1 - t / 1.2); if (t > 1.2) { d.rotation.z = 0; this.w.tickers.delete(shake); res(); } };
      this.w.tickers.add(shake);
    });
    ui.label("dog-say", "Rũ rũ! 💦", "bubble dog", (v) => this.w.dog.worldPos("Head", v).add({ x: 0, y: 0.38, z: 0 }), 1500);
    for (const v of this.w.villagers) if (v.ambient && !v.dead) v.speed /= 2.2;
    ui.banner("🌈 Cầu vồng!", "Mưa tạnh rồi", 2500);
    await b.say("rainbowLao", "", {}, 1);
  }

  // ================================================================ trẻ con thả diều
  async kite() {
    const b = this.b;
    const fromLeft = Math.random() < 0.5;
    const sx = fromLeft ? -6 : 6;
    const kid = await this.w.spawnVillager({ variant: CHARS.child, at: V(sx, -1.0), label: "Thằng Cu", labelClass: "tag" });
    b.tagVillager(kid);
    b.registerSpeaker("kid", kid);
    kid.speed = 0.9;
    // the kite: a red/yellow diamond with a tail, on a string
    const kiteMat = new THREE.MeshStandardMaterial({ color: "#e24a3b", side: THREE.DoubleSide, roughness: 0.8 });
    const shape = new THREE.Shape([new THREE.Vector2(0, 0.35), new THREE.Vector2(0.25, 0), new THREE.Vector2(0, -0.45), new THREE.Vector2(-0.25, 0)]);
    const kite = new THREE.Mesh(new THREE.ShapeGeometry(shape), kiteMat);
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.9), new THREE.MeshStandardMaterial({ color: "#ffd54a", side: THREE.DoubleSide }));
    tail.position.y = -0.85;
    kite.add(tail);
    const stringGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const string = new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: "#f5f0e0" }));
    this.w.scene.add(kite, string);
    let t = 0;
    const fly = (dt) => {
      t += dt;
      const k = kid.root.position;
      const rise = Math.min(1, t / 3);
      // flies over the middle of the village (the side panels would hide it near the edges)
      kite.position.set(k.x * 0.25 - 0.2 + Math.sin(t * 0.9) * 0.6, 1.2 + rise * 2.3 + Math.sin(t * 1.7) * 0.2, -3.2);
      kite.rotation.set(0.2, 0, Math.sin(t * 1.3) * 0.3);
      tail.rotation.z = Math.sin(t * 5) * 0.4;
      const a = stringGeo.attributes.position.array;
      a[0] = k.x; a[1] = k.y + 1.0; a[2] = k.z;
      a[3] = kite.position.x; a[4] = kite.position.y - 0.1; a[5] = kite.position.z;
      stringGeo.attributes.position.needsUpdate = true;
    };
    this.w.tickers.add(fly);
    kid.play(16, (p, add) => add("ArmR", "rot", "x", -2.2));
    const walk = kid.walk([V(sx * 0.25, -1.1), V(-sx * 0.25, -1.3), V(-sx * 1.3, -1.6)]);
    await sleep(3500);
    this.w.dog.lookAt = kite.position;
    b.sayAs("kid", "kiteKid", {}, 2);
    await sleep(2500);
    b.say("kiteLao", "", {}, 1);
    this.w.lao.lookAt = kite.position;
    await walk;
    this.w.tickers.delete(fly);
    this.w.scene.remove(kite, string);
    kite.geometry.dispose(); tail.geometry.dispose(); stringGeo.dispose();
    this.w.dog.lookAt = null;
    this.w.lao.lookAt = null;
    this.bye(kid);
  }

  // ================================================================ Cậu Vàng đuổi bướm
  async butterflies() {
    if (!this.canMoveDog()) return;
    const b = this.b, d = this.w.dog.root;
    b.wake();
    const list = b.fx.butterflies(4, 15);
    b.say("butterflyLao", "", {}, 1);
    await sleep(1200);
    for (let i = 0; i < 5; i++) {
      if (!this.canMoveDog()) break;
      const bf = list[i % list.length].obj.position;
      await this.dogRun(new THREE.Vector3(bf.x, 0, bf.z), 2.8);
      this.w.dog.lookAt = bf;
      this.w.dog.happy(0.8);
      b.bark(1, ["Gâu! 🦋", "Gâu gâu!", "Hụt rồi! 😅"][i % 3], true);
      await sleep(700);
    }
    this.w.dog.lookAt = null;
    await this.dogRun(this.w.dogHome, 2.4);
    d.rotation.y = 0.35;
    this.w.dog.happy(1.5);
  }

  // ================================================================ trẻ con chạy đuổi nhau
  async kids() {
    const b = this.b;
    const fromLeft = Math.random() < 0.5;
    const sx = fromLeft ? -7 : 7;
    const lane = -0.9 + Math.random() * 0.5;
    const k1 = await this.w.spawnVillager({ variant: CHARS.child, at: V(sx, lane) });
    const k2 = await this.w.spawnVillager({ variant: CHARS.child, at: V(sx * 1.15, lane + 0.3) });
    k1.speed = 3.0; k2.speed = 2.8;
    const end = V(-sx * 1.3, lane);
    const run = Promise.all([k1.walk([V(-sx * 0.2, lane - 0.6), end]), k2.walk([V(-sx * 0.25, lane - 0.3), end])]);
    const scare = setInterval(() => {
      for (const ch of this.w.chickens) for (const k of [k1, k2]) if (ch.root.position.distanceTo(k.root.position) < 1.5) ch.scare(k.root.position);
    }, 200);
    await sleep(1200);
    this.w.dog.lookAt = k1.root.position;
    this.w.dog.happy(2);
    b.bark(2, "Gâu gâu! 😄");
    if (Math.random() < 0.6 && b.voice.idleFor > 1) b.say("kidsLao", "", {}, 0);
    await run;
    clearInterval(scare);
    this.w.dog.lookAt = null;
    this.w.remove(k1);
    this.w.remove(k2);
  }
}
