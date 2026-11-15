import express from "express";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { WebSocketServer } from "ws";
import { ROOT, loadConfig, getConfig, updateConfig, resetSection, publicConfig } from "./config.js";
import { loadStats, record, summary, resetStats } from "./stats.js";
import { TikFinityClient, normalize } from "./tikfinity.js";
import { TikTokDirect, cleanUsername } from "./tiktoklive.js";
import { synthesize, ttsStats } from "./tts.js";
import { Episodes } from "./episodes.js";
import { loadViewers, award, bonus, topViewers, resetViewers, relevel, getSkin, setSkin } from "./viewers.js";
import { SKINS, parseSkin } from "../public/game/skincatalog.js";
import { SpamGuard } from "./spam.js";

const PORT = Number(process.env.PORT || 3939);
const HOST = process.env.HOST || "127.0.0.1";
const startedAt = Date.now();

loadConfig();
loadStats();
loadViewers();

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.get("/", (_req, res) => res.redirect("/game/"));
app.use(express.static(path.join(ROOT, "public")));
app.use("/vendor/three", express.static(path.join(ROOT, "node_modules/three")));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
const clients = new Set(); // { ws, role, id, since, label, prefer }
let clientSeq = 0;
let audioId = null; // the ONE game screen that plays sound (others show subtitles only)

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}
function broadcast(msg, role = null) {
  const s = JSON.stringify(msg);
  for (const c of clients) if ((!role || c.role === role) && c.ws.readyState === 1) c.ws.send(s);
}
function clientCounts() {
  let game = 0, admin = 0;
  for (const c of clients) c.role === "game" ? game++ : admin++;
  const screens = [...clients].filter((c) => c.role === "game")
    .map((c) => ({ id: c.id, label: c.label, since: c.since, audio: c.id === audioId }));
  return { game, admin, screens };
}
/** Keep exactly one game screen with sound: ?master=1 first, then OBS, then the oldest. */
function pickAudio(force = null) {
  const games = [...clients].filter((c) => c.role === "game");
  if (force && games.some((c) => c.id === force)) audioId = force;
  else if (!games.some((c) => c.id === audioId)) {
    games.sort((a, b) => b.prefer - a.prefer || a.since - b.since);
    audioId = games[0]?.id ?? null;
  }
  for (const c of games) send(c.ws, { t: "audio", on: c.id === audioId, id: c.id });
}

// ------------------------------------------------------------------ game code version
// Game screens (often an OBS / LIVE Studio source nobody reloads) compare this on every hello and reload
// themselves when the game files changed, so a screen never keeps running old code after an update.
const GAME_DIR = path.join(ROOT, "public/game");
function gameBuild() {
  let h = 0;
  try {
    for (const f of fs.readdirSync(GAME_DIR).sort()) {
      const st = fs.statSync(path.join(GAME_DIR, f));
      for (const ch of f + st.size + ":" + Math.floor(st.mtimeMs)) h = (h * 31 + ch.charCodeAt(0)) | 0;
    }
  } catch {}
  return (h >>> 0).toString(36);
}
let build = gameBuild();
let buildTimer = null;
try {
  fs.watch(GAME_DIR, () => {
    clearTimeout(buildTimer);
    buildTimer = setTimeout(() => {
      const b = gameBuild();
      if (b !== build) { build = b; broadcast({ t: "build", build }, "game"); }
    }, 800);
  });
} catch {}

// ------------------------------------------------------------------ story episodes
const episodes = new Episodes({ getConfig, broadcast: (m) => broadcast(m), onWin: rewardWinners });

/** Big event winners: bonus XP; their level-ups come after the shout-out, quietly (no spotlight each). */
function rewardWinners(list, xp) {
  const cfg = getConfig();
  const ups = [];
  for (const w of list) {
    const r = bonus(w.id, w.name, xp, cfg);
    if (r.leveledUp) ups.push({ type: "levelup", quiet: true, user: { id: w.id, name: r.name, avatar: r.avatar, level: r.level, title: r.title }, level: r.level, title: r.title, xp: r.xp, source: "bigEvent", at: Date.now() });
  }
  ups.forEach((up, i) => setTimeout(() => { eventLog.push(up); broadcast({ t: "event", ev: up }); }, 14000 + i * 400));
  setTimeout(sendState, 15000);
}

// ------------------------------------------------------------------ TikFinity
const tik = new TikFinityClient();
tik.on("status", (st) => broadcast({ t: "status", status: fullStatus() }, "admin"));
tik.on("raw", (raw) => broadcast({ t: "raw", raw }, "admin"));
tik.on("event", (ev) => handleEvent(ev, "tikfinity"));

// ------------------------------------------------------------------ TikTok LIVE by username (no TikFinity)
const direct = new TikTokDirect();
direct.on("status", () => broadcast({ t: "status", status: fullStatus() }, "admin"));
direct.on("event", (ev) => handleEvent(ev, "tiktok"));

// start both sources only once everything above exists
tik.configure(getConfig().tikfinity);
direct.configure(getConfig().direct);

// ------------------------------------------------------------------ events
const eventLog = [];
let stateTimer = null;

function tierFor(diamonds) {
  const tiers = [...getConfig().tiers].sort((a, b) => a.min - b.min);
  let t = tiers[0];
  for (const x of tiers) if (diamonds >= x.min) t = x;
  return t;
}

/** Game screens get the public view (no seeding unless enabled); admins always get everything. */
function publicSummary() {
  const g = getConfig().game;
  const levels = getConfig().levels.list;
  // XP leaderboard for the stream: level + XP only (no diamonds), seeding accounts hidden
  const levelTop = topViewers(5, !g.showSeedOnStream).filter((v) => v.xp > 0)
    .map((v) => ({ name: v.name, avatar: v.avatar, level: v.level, title: levels[v.level - 1]?.title || "", xp: v.xp }));
  const s = summary(g.goals, 5, !!g.showSeedOnStream);
  const L = getConfig().landlord || {};
  const best = s.top[0];
  const landlord = L.enabled !== false && best && best.diamonds >= (L.minDiamonds ?? 30) ? { id: best.id, name: best.name, avatar: best.avatar || "" } : null;
  return { ...s, levelTop, landlord };
}
function sendState() {
  broadcast({ t: "state", state: publicSummary() }, "game");
  broadcast({ t: "state", state: summary(getConfig().game.goals) }, "admin");
}

const spam = new SpamGuard();
const skinChangedAt = new Map(); // userId -> last costume change (one change every 4 s at most)
var seen = new Map(); // dedupe key -> {at, source} (var: status can be asked for during start-up)
var flow = []; // [at, type, source] for the last 5 minutes

function dedupeKey(ev) {
  const who = String(ev.user?.name || ev.user?.id || "").toLowerCase().trim();
  const what = ev.type === "chat" ? String(ev.text || "").trim().toLowerCase() : ev.type === "gift" ? (ev.gift || "") + "x" + (ev.count || 1) : ev.type === "like" ? String(ev.count || 1) : "";
  return ev.type + "|" + who + "|" + what;
}

function handleEvent(ev, source) {
  const cfg = getConfig();
  const now = Date.now();
  if (source === "tikfinity" || source === "tiktok") {
    const key = dedupeKey(ev);
    const prev = seen.get(key);
    if (prev && prev.source !== source && now - prev.at < 5000) return; // already received from the other connection
    seen.set(key, { at: now, source });
    if (seen.size > 2000) for (const [k, v] of seen) { if (now - v.at > 10000) seen.delete(k); }
  }
  flow.push([now, ev.type, source]);
  while (flow.length && flow[0][0] < now - 300000) flow.shift();
  // anti-spam: repeated / flooding chat does not score; strikes -> warning, then points muted for a while
  const sp = spam.check(ev, { ...cfg.antiSpam, keywords: [...(cfg.game.barkKeywords || []), ...(cfg.game.callKeywords || [])] });
  const { levelUp } = record(ev, cfg.game.goals, source === "simulator", !!cfg.game.showSeedOnStream);
  const lv = sp.muted || (ev.type === "chat" && !sp.score) ? null : award(ev, cfg, source);
  const out = { ...ev, user: lv ? { ...ev.user, level: lv.level, title: lv.title } : ev.user, source, at: Date.now() };
  // meme costume: "đổi ếch" / "#mèo" / just "đổi" (random) — remembered per viewer, sent with every event of theirs
  const uid = ev.user?.id;
  if (uid && uid !== "unknown") {
    let skin = getSkin(uid);
    const want = ev.type === "chat" ? parseSkin(ev.text) : null;
    const lastAt = skinChangedAt.get(uid) || 0;
    if (want !== null && now - lastAt > 4000) {
      if (want === "?") { const pool = SKINS.filter((s) => s.id && s.id !== skin); skin = pool[(Math.random() * pool.length) | 0].id; }
      else skin = want;
      skinChangedAt.set(uid, now);
      if (skinChangedAt.size > 5000) skinChangedAt.clear();
      setSkin(uid, ev.user.name, skin);
      out.skinChange = true;
    }
    out.user = { ...out.user, skin };
  }
  if (sp.muted) out.spam = "muted";
  else if (ev.type === "chat" && !sp.score) out.spam = "noscore";
  if (ev.type === "gift") out.tier = tierFor(ev.diamonds);
  if (levelUp) out.levelUp = levelUp;
  eventLog.push(out);
  if (eventLog.length > 300) eventLog.shift();
  broadcast({ t: "event", ev: out });
  episodes.onEvent({ ...ev, noScore: !sp.score, muted: sp.muted });
  if (sp.action) {
    const s = { type: "spam", action: sp.action, reason: sp.reason, minutes: sp.minutes, user: { id: ev.user.id, name: ev.user.name, avatar: ev.user.avatar || "" }, source, at: Date.now() };
    eventLog.push(s);
    broadcast({ t: "event", ev: s });
  }
  if (lv?.leveledUp) {
    const up = { type: "levelup", user: out.user, level: lv.level, title: lv.title, xp: lv.xp, source, at: Date.now() };
    eventLog.push(up);
    broadcast({ t: "event", ev: up });
  }
  clearTimeout(stateTimer);
  stateTimer = setTimeout(sendState, 250);
}

function flowSummary() {
  const since = Date.now() - 300000;
  const byType = {}, bySource = {};
  for (const [at, type, source] of flow || []) {
    if (at < since) continue;
    byType[type] = (byType[type] || 0) + 1;
    bySource[source] = (bySource[source] || 0) + 1;
  }
  return { byType, bySource };
}

function fullStatus() {
  return {
    flow: flowSummary(),
    uptime: Date.now() - startedAt,
    tikfinity: tik.status(),
    direct: direct.status(),
    clients: clientCounts(),
    tts: { provider: getConfig().tts.provider, ...ttsStats },
    episodes: episodes.status(),
  };
}
setInterval(() => broadcast({ t: "status", status: fullStatus() }, "admin"), 2000);

// ------------------------------------------------------------------ websocket
wss.on("connection", (ws, req) => {
  const q = new URL(req.url, "http://x").searchParams;
  const role = q.get("role") === "admin" ? "admin" : "game";
  const ua = String(req.headers["user-agent"] || "");
  const obs = /OBS|Streamlabs|TikTok ?LIVE ?Studio/i.test(ua);
  const c = {
    ws, role, id: ++clientSeq, since: Date.now(),
    prefer: q.get("master") === "1" ? 2 : obs ? 1 : 0,
    label: q.get("name") || (obs ? "OBS / LIVE Studio" : /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : "Trình duyệt"),
  };
  clients.add(c);
  send(ws, { t: "hello", build, config: publicConfig(), state: role === "admin" ? summary(getConfig().game.goals) : publicSummary(), episode: episodes.pub() });
  if (role === "admin") send(ws, { t: "status", status: fullStatus() });
  if (role === "game") {
    if (c.prefer === 2) audioId = null; // an explicit ?master=1 screen takes the sound over
    pickAudio(c.prefer === 2 ? c.id : null);
  }
  ws.on("message", (buf) => {
    let m;
    try { m = JSON.parse(buf.toString()); } catch { return; }
    // the game asks for a challenge (e.g. Lão threatens to sell Cậu Vàng -> quan huyện shows up)
    // only the sound screen drives the story, so two open screens never double it
    if (c.id !== audioId) return;
    if (m.t === "trigger" && episodes.isChallenge(m.type) && getConfig().episodes.enabled) episodes.start(m.type, "game");
    if (m.t === "sceneDone") episodes.sceneDone(m.id);
  });
  const gone = () => {
    if (!clients.delete(c)) return;
    if (c.id === audioId) { audioId = null; pickAudio(); }
  };
  ws.on("close", gone);
  ws.on("error", gone);
});

// ------------------------------------------------------------------ API
app.get("/api/spam", (_req, res) => res.json({ list: spam.list() }));
app.post("/api/spam/unmute", (req, res) => res.json({ ok: spam.unmute(String(req.body?.id || "")) }));
app.get("/api/status", (_req, res) => res.json({ ...fullStatus(), state: summary(getConfig().game.goals, 20) }));
app.get("/api/events", (_req, res) => res.json(eventLog.slice(-100)));
app.get("/api/config", (_req, res) => res.json(getConfig()));

app.post("/api/config", (req, res) => {
  const body = req.body || {};
  if (body.direct?.signApiKey === "***") delete body.direct.signApiKey; // masked value from the form
  const cfg = updateConfig(body);
  if (body.levels?.list) relevel(cfg.levels.list);
  tik.configure(cfg.tikfinity);
  direct.configure(cfg.direct);
  broadcast({ t: "config", config: publicConfig() });
  sendState();
  res.json(cfg);
});

app.post("/api/config/reset", (req, res) => {
  const cfg = resetSection(req.body?.section);
  tik.configure(cfg.tikfinity);
  broadcast({ t: "config", config: publicConfig() });
  res.json(cfg);
});

// ---- TikTok username connection
app.post("/api/live/connect", (req, res) => {
  const username = cleanUsername(req.body?.username || getConfig().direct.username);
  if (!username) return res.status(400).json({ error: "Nhập username TikTok" });
  const recent = [username, ...getConfig().direct.recent.filter((u) => u !== username)].slice(0, 10);
  const cfg = updateConfig({ direct: { enabled: true, username, recent } });
  direct.configure(cfg.direct);
  res.json(direct.status());
});
app.post("/api/live/disconnect", (_req, res) => {
  const cfg = updateConfig({ direct: { enabled: false } });
  direct.configure(cfg.direct);
  res.json(direct.status());
});
app.post("/api/live/remove", (req, res) => {
  const u = cleanUsername(req.body?.username);
  const cfg = updateConfig({ direct: { recent: getConfig().direct.recent.filter((x) => x !== u) } });
  res.json(cfg.direct);
});
app.post("/api/live/reconnect", (_req, res) => {
  direct.restart();
  res.json(direct.status());
});

app.post("/api/tikfinity/reconnect", (_req, res) => {
  tik.restart();
  res.json(tik.status());
});

app.get("/api/viewers", (_req, res) => res.json({ levels: getConfig().levels, top: topViewers(30) }));
app.post("/api/viewers/reset", (_req, res) => { resetViewers(); res.json({ ok: true }); });

app.post("/api/stats/reset", (req, res) => {
  resetStats(!!req.body?.keepGoal);
  sendState();
  res.json({ ok: true });
});

/** A real live is running if real (non-simulated) events arrived in the last 2 minutes. */
function liveRunning() {
  const since = Date.now() - 120000;
  return eventLog.some((e) => e.source !== "simulator" && e.source !== "admin" && e.at > since);
}

app.post("/api/simulate", (req, res) => {
  const b = req.body || {};
  // fake viewers / chats / gifts on a real live look like fake engagement: ask the admin to confirm
  if (liveRunning() && !b.force) return res.status(409).json({ live: true, error: "Đang có live thật: người / chat / quà giả lập sẽ hiện trên sóng như tương tác thật (dễ bị TikTok coi là gian lận tương tác)." });
  const name = b.name || "Khách thử nghiệm";
  const user = { id: b.id || name, name, avatar: b.avatar || "" };
  let ev;
  switch (b.type) {
    case "gift": {
      const count = Math.max(1, Number(b.count) || 1);
      const each = Math.max(1, Number(b.diamonds) || 1);
      ev = { type: "gift", user, gift: b.gift || "Rose", count, diamonds: each * count, giftImg: "" };
      break;
    }
    case "chat": ev = { type: "chat", user, text: String(b.text || "Vàng ơi!") }; break;
    case "like": ev = { type: "like", user, count: Number(b.count) || 15 }; break;
    case "follow": case "share": case "join": case "subscribe": ev = { type: b.type, user }; break;
    default: return res.status(400).json({ error: "unknown type" });
  }
  handleEvent(ev, "simulator");
  res.json(ev);
});

// TikFinity "Webhook" action (or any tool): GET/POST /api/webhook?type=gift&nickname=..&gift=..&count=..&diamonds=..
app.all("/api/webhook", (req, res) => {
  // allow calls from a browser page too (TikFinity web on Mac, other overlay tools): CORS + Chrome private-network preflight
  res.set({ "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Private-Network": "true" });
  if (req.method === "OPTIONS") return res.sendStatus(204);
  const p = { ...req.query, ...(typeof req.body === "object" ? req.body : {}) };
  const ev = normalize(p.event || p.data ? p : {
    event: p.type || p.event || "chat",
    data: {
      uniqueId: p.uniqueId || p.username || p.userId || p.nickname,
      nickname: p.nickname || p.username || p.uniqueId,
      profilePictureUrl: p.avatar || p.profilePictureUrl || "",
      giftName: p.gift || p.giftName || p.giftname,
      repeatCount: p.count || p.repeatCount || p.repeatcount,
      diamondCount: p.diamonds || p.diamondCount || p.coins,
      comment: p.comment || p.text || p.message,
      likeCount: p.likeCount || p.likes,
    },
  });
  if (!ev) return res.status(400).json({ ok: false, error: "unrecognised event" });
  handleEvent(ev, "webhook");
  res.json({ ok: true, ev });
});

app.post("/api/episode", (req, res) => {
  const b = req.body || {};
  // the admin may pick two viewers for the friendly scuffle ("đấu vui")
  const cast = Array.isArray(b.cast)
    ? b.cast.slice(0, 2).map((u) => ({ id: String(u?.id || ""), name: String(u?.name || "").slice(0, 40) })).filter((u) => u.id && u.name)
    : [];
  res.json(episodes.start(String(b.type || ""), "admin", cast.length === 2 && cast[0].id !== cast[1].id ? { cast } : null));
});
/** Viewers who interacted in the last 10 minutes (admin picks two of them for the friendly scuffle). */
app.get("/api/viewers/recent", (_req, res) => {
  const since = Date.now() - 600000;
  const m = new Map();
  for (const e of eventLog) {
    if (e.at < since || !e.user?.id || e.user.id === "unknown" || e.type === "spam" || e.type === "levelup" || e.spam === "muted") continue;
    const prev = m.get(e.user.id);
    m.set(e.user.id, { id: e.user.id, name: e.user.name, at: e.at, chats: (prev?.chats || 0) + (e.type === "chat" ? 1 : 0) });
  }
  res.json({ list: [...m.values()].sort((a, b) => b.at - a.at).slice(0, 60) });
});
app.post("/api/audio", (req, res) => {
  pickAudio(Number(req.body?.id));
  res.json({ ok: true, audioId });
});
app.post("/api/episode/stop", (_req, res) => { episodes.stop(); res.json({ ok: true }); });

app.post("/api/say", (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "empty" });
  broadcast({ t: "say", text }, "game");
  res.json({ ok: true });
});

app.post("/api/action", (req, res) => {
  broadcast({ t: "action", action: String(req.body?.action || "") }, "game");
  res.json({ ok: true });
});

app.get("/api/tts", async (req, res) => {
  try {
    const r = await synthesize(req.query.text, getConfig().tts, req.query.who === "npc" ? "npc" : "lao");
    if (!r) return res.status(204).end();
    res.set("Content-Type", "audio/mpeg");
    res.set("X-TTS-Provider", encodeURIComponent(r.provider));
    res.set("Cache-Control", "no-store");
    res.send(r.audio);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  Lão Hạc game:   http://${HOST}:${PORT}/game/`);
  console.log(`  Admin:          http://${HOST}:${PORT}/admin/`);
  console.log(`  Webhook:        http://${HOST}:${PORT}/api/webhook\n`);
});
