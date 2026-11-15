/**
 * Story episodes driven by the server so every game screen and the admin see the same thing.
 *  - challenge episodes (quan / tax / binhtu): the village cheers (likes, comments, follows) to reach a target.
 *    Gifts never count and nothing bad happens if the target is missed (TikTok LIVE gifting policy).
 *  - scene episodes (ongiao, kids, kidsHug, kidsBall, herd, fight): short scenes the game plays on its own
 *
 * There is ONE stage: nothing starts while a challenge or a scene is still playing.
 * The game reports when a scene is done ({t:"sceneDone"}); each scene also has a time limit as a fallback.
 * Requests that arrive while the stage is busy (admin button, Lão's threats) wait in a queue.
 *
 * Big group events (BIG): viewers join teams by typing a team word / number (or get the smallest team
 * when they just like); likes / comments / follows score for their team. They start from the admin,
 * or by themselves when the live is lively enough (bigEvents.threshold points within bigEvents.windowSeconds).
 * "niu" (blindfold pot-breaking, steered by chat) is a big scene played by the game itself.
 */
const CHALLENGES = {
  quan: { label: "Quan huyện hỏi mua Cậu Vàng", unit: "điểm" },
  tax: { label: "Lý trưởng xét mở hội làng", unit: "điểm" },
  binhtu: { label: "Binh Tư lảng vảng quanh Cậu Vàng", unit: "điểm" },
};
// longest a scene may hold the stage if the game never reports it finished (ms)
const SCENE_MAX = { poem: 60000, scuffle: 45000, dogFlip: 35000, dogChase: 40000, quay: 70000, ongiao: 75000, kids: 15000, kidsHug: 30000, kidsBall: 35000, herd: 30000, fight: 60000, rain: 45000, kite: 40000, butterflies: 35000 };
const LIFE = ["kids", "kidsHug", "kidsBall", "herd", "fight", "rain", "kite", "butterflies", "poem", "scuffle", "dogFlip", "dogChase", "quay"];
const BIG = {
  tug: {
    label: "Kéo co Xóm Đông – Xóm Tây",
    teams: [
      { name: "Xóm Đông", color: "#d23b30", keys: ["đông", "dong", "1"] },
      { name: "Xóm Tây", color: "#2f6fd2", keys: ["tây", "tay", "2"] },
    ],
  },
  boat: {
    label: "Đua thuyền",
    teams: [
      { name: "Thuyền Đỏ", color: "#d23b30", keys: ["đỏ", "do", "1"] },
      { name: "Thuyền Vàng", color: "#e8b830", keys: ["vàng", "vang", "2"] },
      { name: "Thuyền Xanh", color: "#2f8f4f", keys: ["xanh", "3"] },
      { name: "Thuyền Tím", color: "#7a3fc0", keys: ["tím", "tim", "4"] },
    ],
  },
  lantern: { label: "Thả đèn trời", teams: [{ name: "Cả làng", color: "#ffb347", keys: [] }] },
};
const BIG_SCENES = { niu: 100000 };
// Ông Giáo's word puzzle: letters of a word / phrase shuffled; first viewer to type it in the chat wins.
// The answer never leaves the server until the puzzle ends (so nobody can read it from the page).
const QUIZ = "quiz";
const letterCount = (w) => strip(w).replace(/[^a-z0-9]/g, "").length;
function shuffleTiles(answer) {
  const letters = [...answer.normalize("NFC").toUpperCase()].filter((c) => /[\p{L}\p{N}]/u.test(c));
  let out = letters.slice();
  for (let k = 0; k < 8; k++) {
    for (let i = out.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [out[i], out[j]] = [out[j], out[i]]; }
    if (out.join("") !== letters.join("")) break;
  }
  return out;
}
/** Letters only, no accents / spaces / emoji: "Bánh Giầy!! 😍" -> "banhgiay". */
const squash = (s) => strip(s).replace(/[^a-z0-9]/g, "");
function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
/**
 * Generous on purpose (it is a party game on a live): right if the chat line is the answer,
 * contains it ("là bánh giầy nha"), or is one typo away (two for long answers).
 */
function isRightAnswer(guess, accepts) {
  return accepts.some((t) => {
    if (guess === t) return true;
    if (t.length >= 5 && guess.includes(t) && guess.length <= t.length + 14) return true;
    const slack = t.length >= 12 ? 2 : t.length >= 6 ? 1 : 0;
    return slack > 0 && editDistance(guess, t) <= slack;
  });
}

/** "LÃO HẠC" -> "L _ _  _ _ C" style mask; `shown` = indexes (in letters) that are revealed. */
function maskOf(answer, shown) {
  let i = 0;
  return [...answer.normalize("NFC").toUpperCase()].map((c) => {
    if (c === " ") return " ";
    if (!/[\p{L}\p{N}]/u.test(c)) return c;
    return shown.has(i++) ? c : "_";
  }).join("");
}
const SCENES = ["ongiao", ...LIFE, ...Object.keys(BIG_SCENES)];
Object.assign(SCENE_MAX, BIG_SCENES);
const words = (t) => strip(t).split(/[^a-z0-9]+/).filter(Boolean);
const GAP = 3000; // breathing room between two episodes
const AFTER_CHALLENGE = 12000; // the cast walks away / Lão finishes his line
const strip = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d");

export class Episodes {
  constructor({ getConfig, broadcast, onWin }) {
    this.cfg = getConfig;
    this.bc = broadcast;
    this.onWin = onWin || (() => {});
    this.active = null; // running challenge
    this.scene = null; // running scene {id, type}
    this.stageFreeAt = 0;
    this.queue = []; // [{type, by}]
    this.seq = 0;
    const now = Date.now();
    const e = this.cfg().episodes;
    this.next = {
      challenge: now + Math.min(40000, e.everyMinutes * 60000 * 0.5),
      ongiao: now + 20000,
      kids: now + 12000,
    };
    this.lastProgressSent = 0;
    this.engagement = []; // [time, points] for the "lively enough" trigger
    this.nextBig = now + 60000;
    setInterval(() => this.tick(), 1000);
  }

  isChallenge(type) { return type in CHALLENGES || type in BIG; }
  isKnown(type) { return type in CHALLENGES || type in BIG || type === QUIZ || SCENES.includes(type); }
  busy(now = Date.now()) { return !!this.active || now < this.stageFreeAt; }

  /** Start now if the stage is free; otherwise queue it (admin / game) or skip it (auto). */
  start(type, by = "auto", extra = null) {
    if (!this.isKnown(type)) return { error: "Không có tình tiết " + type };
    if (this.busy()) {
      if (by === "auto") return { error: "Đang bận" };
      if (this.queue.some((q) => q.type === type) || this.active?.type === type || this.scene?.type === type) {
        return { queued: true, position: this.queue.findIndex((q) => q.type === type) + 1 };
      }
      if (this.queue.length >= 5) return { error: "Hàng chờ đã đầy (5 tình tiết)" };
      this.queue.push({ type, by, extra });
      return { queued: true, position: this.queue.length };
    }
    return this.begin(type, by, extra);
  }

  begin(type, by, extra = null) {
    const now = Date.now();
    const e = this.cfg().episodes;
    if (type === QUIZ) {
      const q = this.cfg().quiz || {};
      const modes = q.modes || { scramble: true, riddle: true, math: true };
      const riddles = (q.riddles || []).filter((r) => r && r.q && r.a);
      const kinds = ["scramble", "riddle", "math"].filter((k) => modes[k] !== false && (k !== "riddle" || riddles.length));
      const kind = kinds[(Math.random() * kinds.length) | 0] || "scramble";
      if (kind === "math") return this.beginMath(q, by, now);
      if (kind === "riddle") return this.beginRiddle(q, riddles, by, now);
      const min = q.minLetters ?? 6, max = q.maxLetters ?? 20;
      const pool = (q.words || []).map((w) => String(w).trim()).filter((w) => { const n = letterCount(w); return n >= min && n <= max; });
      if (!pool.length) return { error: "Chưa có từ nào 6–20 chữ cái trong bộ đố chữ" };
      this.quizRecent ||= [];
      const fresh = pool.filter((w) => !this.quizRecent.includes(w));
      const entry = (fresh.length ? fresh : pool)[(Math.random() * (fresh.length || pool.length)) | 0];
      this.quizRecent = [...this.quizRecent, entry].slice(-Math.min(15, Math.floor(pool.length / 2)));
      // "Bánh giầy | Bánh dầy": the first one is shown, every spelling is accepted
      const alts = entry.split("|").map((w) => w.trim()).filter(Boolean);
      const answer = alts[0];
      const seconds = Math.max(20, Number(q.seconds) || 60);
      this.active = {
        id: ++this.seq, type: QUIZ, by, quiz: true, mode: "scramble", label: "Ông Giáo đố chữ", unit: "chữ",
        accept: alts.map(squash).filter(Boolean),
        answer, tiles: shuffleTiles(answer), letters: letterCount(answer), shown: new Set(), hint: "",
        words: answer.trim().split(/\s+/).length, wrong: 0, lastWrong: {},
        seconds, progress: 0, target: 1, startedAt: now, endsAt: now + seconds * 1000,
      };
      this.active.hint = maskOf(answer, this.active.shown);
      this.bc({ t: "episode", phase: "start", ep: this.pub() });
      return { ok: true, ep: this.pub() };
    }
    if (type in BIG) {
      const b = this.cfg().bigEvents || {};
      const c = b[type] || {};
      const seconds = Math.max(20, Number(c.seconds) || 75);
      this.active = {
        id: ++this.seq, type, by, big: true,
        label: BIG[type].label, unit: "điểm",
        target: Math.max(1, Number(c.target) || 200),
        teams: BIG[type].teams.map((t) => ({ name: t.name, color: t.color, keys: t.keys, score: 0, members: 0, top: {} })),
        members: {}, // userId -> team index
        names: {}, contrib: {}, // userId -> name / points (for the winners' shout-out)
        joins: [], // recent [{name, team}] since the last broadcast
        seconds, progress: 0, startedAt: now, endsAt: now + seconds * 1000,
      };
      this.nextBig = now + (b.cooldownMinutes ?? 5) * 60000;
      this.bc({ t: "episode", phase: "start", ep: this.pub() });
      return { ok: true, ep: this.pub() };
    }
    if (this.isChallenge(type)) {
      const c = e[type] || {};
      const seconds = Math.max(15, Number(c.seconds) || 60);
      this.active = {
        id: ++this.seq, type, by,
        label: CHALLENGES[type].label, unit: CHALLENGES[type].unit,
        target: Math.max(1, Number(c.target) || 100),
        seconds, progress: 0, startedAt: now, endsAt: now + seconds * 1000,
      };
      this.bc({ t: "episode", phase: "start", ep: this.pub() });
      return { ok: true, ep: this.pub() };
    }
    this.scene = { id: ++this.seq, type, by, ...(extra || {}) };
    this.stageFreeAt = now + (SCENE_MAX[type] || 30000);
    this.bc({ t: "episode", phase: "start", ep: { ...this.scene } });
    return { ok: true };
  }

  /** Câu đố vui: a question, the answer is typed in the chat (any accepted spelling). */
  beginRiddle(q, riddles, by, now) {
    this.riddleRecent ||= [];
    const fresh = riddles.filter((r) => !this.riddleRecent.includes(r.q));
    const r = (fresh.length ? fresh : riddles)[(Math.random() * (fresh.length || riddles.length)) | 0];
    this.riddleRecent = [...this.riddleRecent, r.q].slice(-Math.min(12, Math.floor(riddles.length / 2)));
    const alts = String(r.a).split("|").map((w) => w.trim()).filter(Boolean);
    const answer = alts[0];
    const seconds = Math.max(20, Number(q.riddleSeconds) || Number(q.seconds) || 45);
    this.active = {
      id: ++this.seq, type: QUIZ, by, quiz: true, mode: "riddle", label: "Ông Giáo đố vui", unit: "chữ",
      question: r.q, accept: alts.map(squash).filter(Boolean), answer, tiles: [],
      letters: letterCount(answer), shown: new Set(), hint: "", words: answer.trim().split(/\s+/).length, wrong: 0, lastWrong: {},
      seconds, progress: 0, target: 1, startedAt: now, endsAt: now + seconds * 1000,
    };
    this.active.hint = maskOf(answer, this.active.shown);
    this.bc({ t: "episode", phase: "start", ep: this.pub() });
    return { ok: true, ep: this.pub() };
  }
  /** Toán nhanh: a small sum, the first right number in the chat wins. */
  beginMath(q, by, now) {
    const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const kind = rnd(1, 4);
    let question, value;
    if (kind === 1) { const a = rnd(12, 89), b = rnd(11, 59); question = `${a} + ${b}`; value = a + b; }
    else if (kind === 2) { const a = rnd(40, 99), b = rnd(11, 39); question = `${a} − ${b}`; value = a - b; }
    else if (kind === 3) { const a = rnd(3, 12), b = rnd(3, 12); question = `${a} × ${b}`; value = a * b; }
    else { const a = rnd(2, 20), b = rnd(2, 9), c = rnd(2, 9); question = `${a} + ${b} × ${c}`; value = a + b * c; }
    const seconds = Math.max(10, Number(q.mathSeconds) || 25);
    this.active = {
      id: ++this.seq, type: QUIZ, by, quiz: true, mode: "math", label: "Ông Giáo đố toán nhanh", unit: "số",
      question: question + " = ?", accept: [String(value)], answer: String(value), tiles: [],
      letters: String(value).length, shown: new Set(), hint: "", words: 1, wrong: 0, lastWrong: {},
      seconds, progress: 0, target: 1, startedAt: now, endsAt: now + seconds * 1000,
    };
    this.bc({ t: "episode", phase: "start", ep: this.pub() });
    return { ok: true, ep: this.pub() };
  }

  /** The game finished playing a scene. */
  sceneDone(id) {
    if (!this.scene || this.scene.id !== id) return;
    this.scene = null;
    this.stageFreeAt = Math.min(this.stageFreeAt, Date.now() + GAP);
  }

  pub() {
    const a = this.active;
    if (!a) return null;
    const out = { ...a, remainingMs: Math.max(0, a.endsAt - Date.now()) };
    if (a.quiz) { delete out.answer; delete out.accept; delete out.shown; delete out.lastWrong; }
    if (a.big) {
      delete out.members; delete out.names; delete out.contrib;
      out.teams = a.teams.map((t) => ({
        name: t.name, color: t.color, score: t.score, members: t.members,
        top: Object.entries(t.top).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([n]) => n),
      }));
      out.joins = a.joins;
    }
    return out;
  }

  /** Winner of a big event (index of the team), or -1 for a draw. */
  leader(a) {
    let best = -1, top = -1, tie = false;
    a.teams.forEach((t, i) => { if (t.score > top) { top = t.score; best = i; tie = false; } else if (t.score === top) tie = true; });
    return tie ? -1 : best;
  }

  end(success, cancelled = false) {
    const a = this.active;
    if (!a) return;
    const ep = { ...this.pub(), remainingMs: 0 };
    this.active = null;
    if (a.quiz) {
      ep.answer = a.answer; // revealed only now
      if (a.winnerUser) {
        ep.winnerUser = a.winnerUser;
        ep.winXp = this.cfg().quiz?.winXp ?? 20;
        if (ep.winXp > 0) this.onWin([{ id: a.winnerUser.id, name: a.winnerUser.name }], ep.winXp, a.label);
      }
    }
    if (a.big && a.type !== "lantern") ep.winner = cancelled ? -1 : this.leader(a);
    if (a.big && !cancelled) {
      // the winners: everyone in the winning team (lantern: everyone who helped, if it succeeded)
      const team = a.type === "lantern" ? (success ? 0 : -1) : ep.winner;
      if (team >= 0) {
        const list = Object.entries(a.members).filter(([, t]) => t === team)
          .map(([id]) => ({ id, name: a.names[id] || "", score: a.contrib[id] || 0 }))
          .sort((x, y) => y.score - x.score);
        ep.winners = list.slice(0, 40);
        ep.winnersCount = list.length;
        const xp = Math.round((this.cfg().bigEvents?.winXp ?? 30) * (a.type === "lantern" ? 0.5 : 1));
        ep.winXp = xp;
        if (xp > 0 && list.length) this.onWin(list, xp, a.label);
      }
    }
    this.bc({ t: "episode", phase: "end", ep, success, cancelled });
    const now = Date.now();
    const e = this.cfg().episodes;
    this.next.challenge = now + e.everyMinutes * 60000 * (0.8 + Math.random() * 0.4);
    this.stageFreeAt = Math.max(this.stageFreeAt, now + AFTER_CHALLENGE);
    this.next.ongiao = Math.max(this.next.ongiao, now + 25000);
  }

  stop() {
    this.queue = [];
    if (this.active) this.end(false, true);
    else if (this.scene) { this.scene = null; this.stageFreeAt = Date.now() + GAP; }
  }

  /** Count a live event towards the active challenge: likes 1, comments 5 (Binh Tư keywords 10), follow/share 10. Gifts: 0. */
  onEvent(ev) {
    // engagement meter for the "lively enough" trigger (likes 1, comments 3, follow/share 10)
    // (spam that does not score never counts; muted spammers count for nothing at all)
    const fp = this.cfg().episodes?.followPoints ?? 0;
    const pts = ev.noScore ? 0 : ev.type === "like" ? ev.count : ev.type === "chat" ? 3 : 0;
    if (pts) this.engagement.push([Date.now(), pts]);
    const a = this.active;
    if (!a || ev.muted) return;
    if (a.quiz) return this.onQuiz(a, ev);
    if (a.big) return this.onBigEvent(a, ev);
    if (ev.noScore) return;
    let add = 0;
    if (ev.type === "like") add = ev.count;
    if (ev.type === "follow" || ev.type === "share") add = fp;
    if (ev.type === "chat") {
      const kw = a.type === "binhtu" ? this.cfg().episodes.binhtu.keywords || [] : [];
      add = kw.some((k) => strip(ev.text).includes(strip(k))) ? 10 : 5;
    }
    if (!add) return;
    a.progress += add;
    if (a.progress >= a.target) return this.end(true);
    const now = Date.now();
    if (now - this.lastProgressSent > 300) {
      this.lastProgressSent = now;
      this.bc({ t: "episode", phase: "progress", ep: this.pub() });
    }
  }

  /** A chat line during the word puzzle: right answer -> winner; a wrong try -> Ông Giáo scolds (by name). */
  onQuiz(a, ev) {
    if (ev.type !== "chat" || !ev.user?.id || a.winnerUser) return;
    if (a.mode === "math") {
      const nums = String(ev.text || "").match(/\d+/g);
      if (!nums) return;
      if (nums.includes(a.answer)) {
        a.winnerUser = { id: ev.user.id, name: ev.user.name, avatar: ev.user.avatar || "", ms: Date.now() - a.startedAt };
        return this.end(true);
      }
      const now = Date.now();
      if (now - (a.lastWrong[ev.user.id] || 0) < 3000) return;
      a.lastWrong[ev.user.id] = now;
      a.wrong++;
      const off = Math.abs(Number(nums[0]) - Number(a.answer));
      this.bc({ t: "episode", phase: "wrong", ep: { id: a.id, type: a.type }, who: { id: ev.user.id, name: ev.user.name }, close: off <= 2 ? 0.9 : 0 });
      return;
    }
    const guess = squash(ev.text);
    const target = a.accept?.[0] || squash(a.answer);
    if (!guess) return;
    if (isRightAnswer(guess, a.accept || [target])) {
      a.winnerUser = { id: ev.user.id, name: ev.user.name, avatar: ev.user.avatar || "", ms: Date.now() - a.startedAt };
      return this.end(true);
    }
    // looks like a try (similar length), not normal chatting
    if (guess.length >= 4 && guess.length >= target.length * 0.75 && guess.length <= target.length * 1.35) {
      const now = Date.now();
      if (now - (a.lastWrong[ev.user.id] || 0) < 3000) return;
      a.lastWrong[ev.user.id] = now;
      a.wrong++;
      // how close: letters in the right place
      let same = 0;
      for (let i = 0; i < Math.min(guess.length, target.length); i++) if (guess[i] === target[i]) same++;
      this.bc({ t: "episode", phase: "wrong", ep: { id: a.id, type: a.type }, who: { id: ev.user.id, name: ev.user.name }, close: same / target.length });
    }
  }

  onBigEvent(a, ev) {
    const id = ev.user?.id;
    if (!id) return;
    const b = this.cfg().bigEvents || {};
    let team = a.members[id];
    a.names[id] = ev.user.name;
    // choosing / switching team: a team word or number in the chat
    if (ev.type === "chat" && a.teams.length > 1) {
      const w = words(ev.text);
      const pick = a.teams.findIndex((t) => t.keys.some((k) => w.includes(strip(k))));
      if (pick >= 0 && pick !== team) {
        if (team !== undefined) a.teams[team].members--;
        team = a.members[id] = pick;
        a.teams[pick].members++;
        a.joins.push({ name: ev.user.name, team: pick });
      }
    }
    if (ev.noScore) return; // spam: may still pick a team, but scores nothing
    let add = 0;
    if (ev.type === "like") add = ev.count;
    if (ev.type === "chat") add = 3;
    if (ev.type === "follow" || ev.type === "share") add = this.cfg().episodes?.followPoints ?? 0;
    if (ev.type === "gift" && b.giftsCount) add = Math.round(ev.diamonds * (b.giftPoints ?? 1));
    if (!add && ev.type !== "join") return;
    if (team === undefined) {
      // just liked / joined: put them in the smallest team
      team = a.teams.reduce((m, t, i) => (t.members < a.teams[m].members ? i : m), 0);
      a.members[id] = team;
      a.teams[team].members++;
      a.joins.push({ name: ev.user.name, team });
    }
    if (add) {
      const t = a.teams[team];
      t.score += add;
      t.top[ev.user.name] = (t.top[ev.user.name] || 0) + add;
      a.contrib[id] = (a.contrib[id] || 0) + add;
      a.progress = a.teams.reduce((s, x) => s + x.score, 0);
      // finish lines
      if (a.type === "boat" && t.score >= a.target) return this.end(true);
      if (a.type === "lantern" && a.progress >= a.target) return this.end(true);
      if (a.type === "tug" && Math.abs(a.teams[0].score - a.teams[1].score) >= a.target) return this.end(true);
    }
    const now = Date.now();
    if (now - this.lastProgressSent > 300) {
      this.lastProgressSent = now;
      this.bc({ t: "episode", phase: "progress", ep: this.pub() });
      a.joins = [];
    }
  }

  tick() {
    const now = Date.now();
    const e = this.cfg().episodes;
    // "sự kiện lớn" milestone meter for the stream (every 2 s)
    if (now - (this.lastMeter || 0) > 2000) { this.lastMeter = now; this.bc({ t: "bigMeter", m: this.meter(now) }); }
    // word puzzle hints: more letters show up as time goes by
    if (this.active?.quiz && this.active.mode !== "math" && !this.active.winnerUser) {
      const a = this.active;
      const frac = (now - a.startedAt) / (a.endsAt - a.startedAt);
      const want = frac > 0.75 ? Math.ceil(a.letters * 0.5) : frac > 0.45 ? Math.ceil(a.letters * 0.25) : frac > 0.2 ? 1 : 0;
      if (a.shown.size < want) {
        if (!a.shown.size) a.shown.add(0); // first letter first
        while (a.shown.size < want) a.shown.add((Math.random() * a.letters) | 0);
        a.hint = maskOf(a.answer, a.shown);
        this.bc({ t: "episode", phase: "progress", ep: this.pub() });
      }
    }
    if (this.active && now >= this.active.endsAt) {
      const a = this.active;
      // time's up: in races / tug the leader wins; the lanterns count as a success if half the target was reached
      return this.end(a.big ? (a.type === "lantern" ? a.progress >= a.target / 2 : this.leader(a) >= 0) : false);
    }
    // the live is lively enough -> a big group event
    const b = this.cfg().bigEvents || {};
    const win = (b.windowSeconds ?? 120) * 1000;
    while (this.engagement.length && this.engagement[0][0] < now - win) this.engagement.shift();
    if (b.enabled !== false && !this.busy(now) && now >= this.nextBig) {
      const score = this.engagement.reduce((s, [, p]) => s + p, 0);
      if (score >= (b.threshold ?? 250)) {
        const on = b.events || {};
        const pool = ["tug", "boat", "lantern", "niu"].filter((t) => on[t] !== false);
        this.engagement = [];
        this.nextBig = now + (b.cooldownMinutes ?? 5) * 60000;
        if (pool.length) {
          const type = pool[(Math.random() * pool.length) | 0];
          this.bc({ t: "episode", phase: "announce", ep: { type, label: BIG[type]?.label || "Bịt mắt đập niêu" } });
          return this.begin(type, "auto");
        }
      }
    }
    if (this.scene && now >= this.stageFreeAt) this.scene = null; // the game never reported back
    if (this.busy(now)) return;

    // queued requests first (admin buttons, Lão's threats)
    const q = this.queue.shift();
    if (q) return this.begin(q.type, q.by, q.extra);

    if (!e.enabled) return;
    if (now >= this.next.challenge) {
      const types = Object.keys(CHALLENGES).filter((t) => e[t]?.enabled !== false);
      this.next.challenge = now + e.everyMinutes * 60000;
      if (types.length) this.begin(types[(Math.random() * types.length) | 0], "auto");
      return;
    }
    const qz = this.cfg().quiz || {};
    if (qz.enabled !== false && qz.everyMinutes > 0 && now >= (this.next.quiz ??= now + 45000)) {
      this.next.quiz = now + qz.everyMinutes * 60000 * (0.85 + Math.random() * 0.3);
      this.begin(QUIZ, "auto");
      return;
    }
    if (e.ongGiaoMinutes > 0 && now >= this.next.ongiao) {
      this.next.ongiao = now + e.ongGiaoMinutes * 60000 * (0.85 + Math.random() * 0.3);
      this.begin("ongiao", "auto");
      return;
    }
    if (e.kidsMinutes > 0 && now >= this.next.kids) {
      this.next.kids = now + e.kidsMinutes * 60000 * (0.7 + Math.random() * 0.6);
      const on = e.scenes || {};
      const pool = LIFE.filter((t) => on[t] !== false);
      if (pool.length) this.begin(pool[(Math.random() * pool.length) | 0], "auto");
    }
  }

  /** How close the live is to a big group event: score in the window vs threshold, cooldown left. */
  meter(now = Date.now()) {
    const b = this.cfg().bigEvents || {};
    const win = (b.windowSeconds ?? 120) * 1000;
    const score = this.engagement.filter(([t]) => t >= now - win).reduce((s, [, p]) => s + p, 0);
    return { enabled: b.enabled !== false, score, threshold: b.threshold ?? 250, readyInMs: Math.max(0, this.nextBig - now), busy: !!this.active?.big };
  }

  status() {
    return { active: this.pub(), scene: this.scene, queue: this.queue.map((q) => q.type), next: this.next };
  }
}
