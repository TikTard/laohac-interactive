import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./config.js";

const FILE = path.join(DATA_DIR, "stats.json");

function fresh() {
  return {
    since: Date.now(),
    // diamonds / gifts include everything; seedDiamonds / seedGifts are the part sent from the admin simulator
    totals: { diamonds: 0, gifts: 0, seedDiamonds: 0, seedGifts: 0, likes: 0, comments: 0, follows: 0, shares: 0, joins: 0, subscribes: 0 },
    donors: {}, // id -> { name, avatar, diamonds, gifts, seedDiamonds }
    goalDiamonds: 0,
    goalSeedDiamonds: 0, // part of goalDiamonds that came from admin seeding
  };
}

let stats = fresh();
let saveTimer = null;
const recent = []; // timestamps of events, for events/min

export function loadStats() {
  try {
    if (fs.existsSync(FILE)) {
      const saved = JSON.parse(fs.readFileSync(FILE, "utf8"));
      stats = { ...fresh(), ...saved, totals: { ...fresh().totals, ...(saved.totals || {}) } };
    }
  } catch (e) {
    console.error("stats.json unreadable:", e.message);
  }
  return stats;
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => fs.writeFileSync(FILE, JSON.stringify(stats)), 1000);
}

export function resetStats(keepGoal = false) {
  const goal = stats.goalDiamonds;
  stats = fresh();
  if (keepGoal) stats.goalDiamonds = goal;
  scheduleSave();
}

/** includeSeed = false: only real gifts count (what viewers see on stream unless seeding is shown). */
export function goalState(goals, includeSeed = true) {
  const total = includeSeed ? stats.goalDiamonds : stats.goalDiamonds - (stats.goalSeedDiamonds || 0);
  let acc = 0;
  for (let i = 0; i < goals.length; i++) {
    const g = goals[i];
    if (total < acc + g.target) {
      return { level: i, levels: goals.length, name: g.name, have: total - acc, need: g.target, done: false };
    }
    acc += g.target;
  }
  const last = goals[goals.length - 1] || { name: "", target: 1 };
  return { level: goals.length, levels: goals.length, name: last.name, have: last.target, need: last.target, done: true };
}

/** Apply a normalized event. seed = sent from the admin simulator. Returns { levelUp: goalName | null }. */
export function record(ev, goals, seed = false, includeSeed = true) {
  recent.push(Date.now());
  const t = stats.totals;
  let levelUp = null;
  switch (ev.type) {
    case "gift": {
      const before = goalState(goals, includeSeed).level;
      t.diamonds += ev.diamonds;
      t.gifts += ev.count;
      if (seed) { t.seedDiamonds += ev.diamonds; t.seedGifts += ev.count; }
      stats.goalDiamonds += ev.diamonds;
      if (seed) stats.goalSeedDiamonds = (stats.goalSeedDiamonds || 0) + ev.diamonds;
      const d = (stats.donors[ev.user.id] ||= { name: ev.user.name, avatar: "", diamonds: 0, gifts: 0, seedDiamonds: 0 });
      if (seed) d.seedDiamonds = (d.seedDiamonds || 0) + ev.diamonds;
      d.name = ev.user.name;
      if (ev.user.avatar) d.avatar = ev.user.avatar;
      d.diamonds += ev.diamonds;
      d.gifts += ev.count;
      const after = goalState(goals, includeSeed).level;
      if (after > before) levelUp = goals[after - 1]?.name || null;
      break;
    }
    case "like": t.likes += ev.count; break;
    case "chat": t.comments++; break;
    case "follow": t.follows++; break;
    case "share": t.shares++; break;
    case "join": t.joins++; break;
    case "subscribe": t.subscribes++; break;
  }
  scheduleSave();
  return { levelUp };
}

/** includeSeed = false is the public view: seeded coins are left out of the leaderboard and the goal. */
export function summary(goals, top = 5, includeSeed = true) {
  const now = Date.now();
  while (recent.length && recent[0] < now - 60000) recent.shift();
  const donors = Object.entries(stats.donors)
    .map(([id, d]) => (includeSeed ? { id, ...d } : { id, ...d, diamonds: d.diamonds - (d.seedDiamonds || 0), seedDiamonds: 0 }))
    .filter((d) => d.diamonds > 0)
    .sort((a, b) => b.diamonds - a.diamonds);
  return {
    since: stats.since,
    totals: stats.totals,
    donorsCount: donors.length,
    top: donors.slice(0, top),
    goal: goalState(goals, includeSeed),
    eventsPerMinute: recent.length,
  };
}
