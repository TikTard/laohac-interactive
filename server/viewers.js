import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./config.js";

/**
 * Viewer levels, kept across lives (data/viewers.json).
 * Experience comes from interaction AND gifts, so everyone can level up:
 * join (once per 30 min), chat (once per 15 s), likes (1 per 10), follow, share, subscribe, gifts (per diamond).
 */
const FILE = path.join(DATA_DIR, "viewers.json");
let viewers = {};
let saveTimer = null;

export function loadViewers() {
  try {
    if (fs.existsSync(FILE)) viewers = JSON.parse(fs.readFileSync(FILE, "utf8")) || {};
  } catch (e) {
    console.error("viewers.json unreadable:", e.message);
  }
}
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => fs.writeFileSync(FILE, JSON.stringify(viewers)), 1500);
}

export function levelFor(xp, levels) {
  let lv = 1;
  levels.forEach((l, i) => { if (xp >= l.xp) lv = i + 1; });
  return lv;
}

/** Add experience for an event. Returns { level, title, xp, next, leveledUp }. */
export function award(ev, cfg, source = "") {
  const L = cfg.levels;
  const id = ev.user?.id;
  if (!id || id === "unknown") return null;
  const now = Date.now();
  const v = (viewers[id] ||= { name: ev.user.name, xp: 0, level: 1, firstSeen: now, lastSeen: now, likeAcc: 0, gifts: 0, diamonds: 0 });
  v.name = ev.user.name || v.name;
  if (ev.user.avatar) v.avatar = ev.user.avatar;
  const x = L.xp;
  let add = 0;
  switch (ev.type) {
    case "join":
      if (!v.lastJoinXp || now - v.lastJoinXp > 30 * 60000) { add = x.join; v.lastJoinXp = now; }
      break;
    case "chat":
      if (!v.lastChatXp || now - v.lastChatXp > 15000) { add = x.chat; v.lastChatXp = now; }
      break;
    case "like": {
      v.likeAcc = (v.likeAcc || 0) + (ev.count || 1);
      add = Math.floor(v.likeAcc / 10) * x.per10Likes;
      v.likeAcc %= 10;
      break;
    }
    case "follow": if (!v.followed) { add = x.follow; v.followed = true; } break;
    case "share": add = x.share; break;
    case "subscribe": add = x.subscribe; break;
    case "gift":
      add = Math.round((ev.diamonds || 0) * x.perDiamond);
      v.gifts += ev.count || 1;
      v.diamonds += ev.diamonds || 0;
      break;
  }
  v.lastSeen = now;
  if (source === "simulator") v.sim = true; // seeding / test accounts never show on the public board
  const before = v.level || 1;
  v.xp += add;
  v.level = levelFor(v.xp, L.list);
  scheduleSave();
  const lvl = L.list[v.level - 1];
  const nxt = L.list[v.level];
  return { level: v.level, title: lvl?.title || "", xp: v.xp, next: nxt?.xp ?? null, leveledUp: v.level > before };
}

/** Bonus XP (e.g. for winning a big group event). */
export function bonus(id, name, add, cfg) {
  const L = cfg.levels;
  const now = Date.now();
  const v = (viewers[id] ||= { name, xp: 0, level: 1, firstSeen: now, lastSeen: now, likeAcc: 0, gifts: 0, diamonds: 0 });
  const before = v.level || 1;
  v.xp += add;
  v.level = levelFor(v.xp, L.list);
  scheduleSave();
  const lvl = L.list[v.level - 1];
  return { level: v.level, title: lvl?.title || "", xp: v.xp, leveledUp: v.level > before, name: v.name || name, avatar: v.avatar || "" };
}

export function topViewers(n = 20, publicOnly = false) {
  return Object.entries(viewers)
    .filter(([, v]) => !publicOnly || !v.sim)
    .map(([id, v]) => ({ id, name: v.name, avatar: v.avatar || "", xp: v.xp, level: v.level, diamonds: v.diamonds, lastSeen: v.lastSeen, sim: !!v.sim }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, n);
}

export function resetViewers() {
  viewers = {};
  scheduleSave();
}

/** Re-level everyone after the thresholds change. */
export function relevel(levels) {
  for (const v of Object.values(viewers)) v.level = levelFor(v.xp, levels);
  scheduleSave();
}

/** Meme costume a viewer picked by chat (kept across lives). "" = normal villager. */
export function getSkin(id) {
  return viewers[id]?.skin || "";
}
export function setSkin(id, name, skin) {
  const now = Date.now();
  const v = (viewers[id] ||= { name, xp: 0, level: 1, firstSeen: now, lastSeen: now, likeAcc: 0, gifts: 0, diamonds: 0 });
  v.skin = skin;
  scheduleSave();
}
