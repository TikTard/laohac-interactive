import * as THREE from "three";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (n) => (n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(".0", "") + "k" : String(n));

export function avatar(url, name) {
  const initial = esc((String(name || "?").trim()[0] || "?").toUpperCase());
  if (!url) return `<div class="av">${initial}</div>`;
  return `<div class="av"><img src="${esc(url)}" referrerpolicy="no-referrer" alt="" onerror="this.parentNode.textContent='${initial}'"></div>`;
}

export function setTitle(t) { $("title").textContent = t; document.title = t; }

export function setState(state) {
  const g = state.goal;
  $("goalName").textContent = g.done ? "Lão đã đạt mọi mục tiêu!" : g.name;
  $("goalLevel").textContent = `Cấp ${Math.min(g.level + 1, g.levels)}/${g.levels}`;
  const pct = g.need ? Math.min(100, (g.have / g.need) * 100) : 100;
  $("goalFill").style.width = pct + "%";
  $("goalText").textContent = `💎 ${fmt(g.have)} / ${fmt(g.need)}`;
  board.levelTop = state.levelTop || [];
  if (board.view === "top") renderBoard();
}

// ------------------------------------------------------------------ "Bạn của làng" board: 3 pages that rotate
// friends (who just did something) · top XP · how to become Dân làng. No money amounts anywhere.
const LV_ICON = ["", "🌾", "🏡", "🎖️", "📜", "🏮", "👑"];
const board = { view: "friends", friends: [], levelTop: [], cfg: null, filter: (s) => s, timer: null };
const VIEWS = ["friends", "top", "levels", "howto"];
export function setNameFilter(fn) { board.filter = fn; }
/** Someone just did something nice (called for every event). */
export function friend(user, did) {
  if (!user?.name || user.id === "unknown") return;
  const name = board.filter(user.name);
  board.friends = board.friends.filter((f) => f.id !== user.id);
  board.friends.unshift({ id: user.id, name, avatar: user.avatar, level: user.level || 1, did });
  board.friends.length = Math.min(board.friends.length, 5);
  if (board.view === "friends") renderBoard();
}
function lvIcon(l) { return LV_ICON[Math.min(Math.max(l || 1, 1), 6)]; }
function renderBoard() {
  const v = board.view;
  const ol = $("top"), foot = $("bdFoot");
  $("bdDots").innerHTML = VIEWS.map((x) => `<i class="${x === v ? "on" : ""}"></i>`).join("");
  if (v === "friends") {
    $("bdTitle").textContent = "Bạn của làng";
    ol.className = "fr";
    ol.innerHTML = board.friends.length
      ? board.friends.map((f) => `<li>${avatar(f.avatar, f.name)}<div class="tx"><span class="nm">${lvIcon(f.level)} ${esc(f.name)}</span><span class="did">${esc(f.did)}</span></div></li>`).join("")
      : `<li class="empty">Chưa có ai… ghé làng chơi với Lão nhé!</li>`;
    foot.textContent = "";
  } else if (v === "top") {
    $("bdTitle").textContent = "⭐ Top kinh nghiệm";
    ol.className = "lt";
    const t = board.levelTop;
    ol.innerHTML = t.length
      ? t.map((d, i) => `<li><span class="rk">${i + 1}</span>${avatar(d.avatar, d.name)}<div class="tx"><span class="nm">${esc(board.filter(d.name))}</span><span class="did">${lvIcon(d.level)} ${esc(d.title)} · ${fmt(d.xp)}⭐</span></div></li>`).join("")
      : `<li class="empty">Chưa có ai lên cấp — bình luận, thả tim để là người đầu tiên!</li>`;
    foot.textContent = "";
  } else if (v === "levels") {
    $("bdTitle").textContent = "🏯 Các cấp dân làng";
    ol.className = "lv";
    const list = board.cfg?.levels?.list || [];
    ol.innerHTML = list.map((l, i) => `<li><span class="ic">${lvIcon(i + 1)}</span><span class="nm">${esc(l.title)}</span><b>${fmt(l.xp)}⭐</b></li>`).join("")
      + (board.cfg?.landlord?.enabled !== false ? `<li class="ll"><span class="ic">🏯</span><span class="nm">Địa chủ của làng</span></li>` : "");
    foot.textContent = "Cấp cao: áo đẹp hơn, đứng gần Lão hơn.";
  } else {
    const x = board.cfg?.levels?.xp || {};
    const need = board.cfg?.levels?.list?.[1]?.xp ?? 10;
    $("bdTitle").textContent = "🌾 Làm Dân làng";
    ol.className = "ht";
    const rows = [["👋", "Vào live", x.join ?? 3], ["💬", "Bình luận", x.chat ?? 2], ["❤️", "10 tim", x.per10Likes ?? 1],
      ["➕", "Follow", x.follow ?? 25], ["🔁", "Chia sẻ", x.share ?? 15], ["🏆", "Đội thắng sự kiện", board.cfg?.bigEvents?.winXp ?? 30]];
    ol.innerHTML = rows.filter((r) => r[2] > 0).map(([i, k, n]) => `<li><span class="ic">${i}</span><span class="nm">${k}</span><b>+${n}</b></li>`).join("");
    foot.innerHTML = `Đủ <b>${need}⭐</b> là thành <b>🌾 Dân làng</b>, cấp càng cao áo càng đẹp, đứng càng gần Lão. Miễn phí, ai cũng lên được!`;
  }
}
function rotateBoard() {
  clearTimeout(board.timer);
  let i = VIEWS.indexOf(board.view);
  i = (i + 1) % VIEWS.length;
  if (VIEWS[i] === "friends" && !board.friends.length) i = (i + 1) % VIEWS.length;
  if (VIEWS[i] === "top" && !board.levelTop.length) i = (i + 1) % VIEWS.length;
  board.view = VIEWS[i];
  const el = $("top");
  el.classList.add("swap");
  setTimeout(() => { renderBoard(); el.classList.remove("swap"); }, 180);
  board.timer = setTimeout(rotateBoard, board.view === "howto" ? 10000 : 8000);
}
board.timer = setTimeout(rotateBoard, 8000);

export function setGuide(config) {
  board.cfg = config;
  renderBoard();
  const tiers = [...config.tiers].sort((a, b) => a.min - b.min);
  const shown = tiers.filter((t, i) => i % 2 === 0 || t.big || i === tiers.length - 1);
  const rows = [
    ["❤️ Tim", "Vàng vẫy đuôi"],
    ["💬 Vàng ơi", "Vàng sủa chào"],
    ["💬 Lão ơi", "Lão trả lời"],
    ["💬 đổi ếch / mèo / cá mập…", "Hóa trang meme 🐸 (gõ “đổi” = ngẫu nhiên)"],
    ["❤️ Nhiều tim", "Vàng nhảy hiphop 🕺"],
    ["🎁 Quà", "Hiệu ứng mừng hội làng"],
  ];
  $("guideList").innerHTML = rows.map(([k, v]) => `<li><span class="k">${esc(k)}</span><span>${esc(v)}</span></li>`).join("");
}

/** "Vui" (happiness) bars for Lão and Cậu Vàng — purely cosmetic, no warning state. */
export function setMood(lao, dog) {
  for (const [id, v] of [["hungerLao", lao], ["hungerDog", dog]]) $(id).style.width = Math.max(3, v) + "%";
}

// ------------------------------------------------------------------ feed
export function feed(html, avatarUrl, name) {
  const box = $("feed");
  const el = document.createElement("div");
  el.className = "fi";
  el.innerHTML = (avatarUrl !== undefined ? avatar(avatarUrl, name) : "") + `<span>${html}</span>`;
  box.prepend(el);
  while (box.children.length > 4) box.lastChild.remove();
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 500); }, 9000);
}
export { esc };

// ------------------------------------------------------------------ 3D anchored labels / bubbles
const labels = new Map(); // key -> { el, getPos, until }
const v3 = new THREE.Vector3();

export function label(key, html, cls, getPos, ms = 0) {
  let l = labels.get(key);
  if (!l) {
    const wrap = document.createElement("div");
    const el = document.createElement("div");
    wrap.appendChild(el);
    $("labels").appendChild(wrap);
    l = { wrap, el };
    labels.set(key, l);
  }
  if (l.html !== html || l.cls !== cls) {
    l.el.className = cls;
    l.el.innerHTML = html;
    l.html = html; l.cls = cls;
  }
  l.getPos = getPos;
  l.until = ms ? performance.now() + ms : 0;
  return l;
}
export function unlabel(key) {
  const l = labels.get(key);
  if (l) { l.wrap.remove(); labels.delete(key); }
}
export function updateLabels(camera, w, h) {
  const now = performance.now();
  for (const [key, l] of labels) {
    if (l.until && now > l.until) { unlabel(key); continue; }
    const p = l.getPos(v3);
    if (!p) { l.wrap.style.display = "none"; continue; }
    p.project(camera);
    if (p.z > 1 || Math.abs(p.x) > 1.15 || p.y < -1.1 || p.y > 1.3) { l.wrap.style.display = "none"; continue; } // off-screen: hide, don't pile at the edge
    l.wrap.style.display = "";
    const x = (p.x * 0.5 + 0.5) * w;
    const y = (-p.y * 0.5 + 0.5) * h;
    const half = (l.el.offsetWidth || 0) / 2;
    const cx = Math.min(Math.max(x, half + 6), w - half - 6);
    l.wrap.style.transform = `translate(${cx}px, ${Math.max(y, 8)}px) translate(-50%, -100%)`;
  }
}

// ------------------------------------------------------------------ hearts, banner, confetti
const MAX_HEARTS = 24; // on screen at once
export function hearts(n, fromX = 0.78, fromY = 0.86) {
  const box = $("hearts");
  const glyphs = ["❤️", "💛", "🧡", "💖", "🤎"];
  const room = MAX_HEARTS - box.childElementCount;
  for (let i = 0; i < Math.min(n, 6, room); i++) {
    setTimeout(() => {
      const el = document.createElement("div");
      el.className = "heart";
      el.textContent = glyphs[(Math.random() * glyphs.length) | 0];
      el.style.left = fromX * innerWidth + (Math.random() - 0.5) * 60 + "px";
      el.style.top = fromY * innerHeight + "px";
      el.style.setProperty("--dx", (Math.random() - 0.5) * 160 + "px");
      box.appendChild(el);
      setTimeout(() => el.remove(), 2700);
    }, i * 120);
  }
}

let bannerTimer = null;
export function banner(big, sub = "", ms = 4500) {
  const el = $("banner");
  el.innerHTML = `<div class="big">${esc(big)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}`;
  el.classList.add("show");
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => el.classList.remove("show"), ms);
}

let lastConfetti = 0;
/** One burst at a time: a new burst within 4 s of the last one is skipped. */
export function confetti(n = 90) {
  const now = performance.now();
  if (now - lastConfetti < 4000) return;
  lastConfetti = now;
  n = Math.min(n, 100);
  const box = $("confetti");
  const colors = ["#f3c25a", "#e2574c", "#84c95c", "#5aa9e6", "#fff3dc", "#c76bd6"];
  for (let i = 0; i < n; i++) {
    const el = document.createElement("div");
    el.className = "cf";
    el.style.left = Math.random() * 100 + "vw";
    el.style.background = colors[i % colors.length];
    el.style.animationDuration = 2.5 + Math.random() * 2.5 + "s";
    el.style.animationDelay = Math.random() * 0.8 + "s";
    el.style.setProperty("--dx", (Math.random() - 0.5) * 30 + "vw");
    el.style.setProperty("--rot", Math.random() * 1440 - 720 + "deg");
    box.appendChild(el);
    setTimeout(() => el.remove(), 6000);
  }
}

export function setConn(ok) { $("conn").classList.toggle("ok", ok); }
export function loaded() { const el = $("loading"); el.classList.add("done"); setTimeout(() => el.remove(), 900); }

// ------------------------------------------------------------------ challenge panel (quan huyện, thuế, Binh Tư)
let chEnd = 0, chTimer = null, chHide = null;
export function showChallenge(ep, title, sub) {
  const el = $("challenge");
  clearTimeout(chHide);
  el.hidden = false;
  el.className = "panel challenge " + ep.type;
  $("chTitle").textContent = title;
  $("chSub").textContent = sub;
  chEnd = performance.now() + (ep.remainingMs ?? ep.seconds * 1000);
  updateChallenge(ep);
  clearInterval(chTimer);
  chTimer = setInterval(() => {
    const s = Math.max(0, Math.ceil((chEnd - performance.now()) / 1000));
    $("chTimer").textContent = "⏳ " + s + "s";
    $("chTimer").classList.toggle("hurry", s <= 10);
  }, 200);
}
export function updateChallenge(ep) {
  $("chFill").style.width = Math.min(100, (ep.progress / ep.target) * 100) + "%";
  $("chText").textContent = `${fmt(ep.progress)} / ${fmt(ep.target)} ${ep.unit === "xu" ? "💎" : "điểm"}`;
  if (ep.remainingMs != null) chEnd = performance.now() + ep.remainingMs;
}
export function endChallenge(success, text) {
  clearInterval(chTimer);
  const el = $("challenge");
  el.classList.add(success ? "won" : "lost");
  $("chTimer").textContent = text;
  if (success) $("chFill").style.width = "100%";
  chHide = setTimeout(() => (el.hidden = true), 5000);
}
// ------------------------------------------------------------------ team panel (big group events)
let tmEnd = 0, tmTimer = null, tmHide = null, tmMode = "";
export function showTeams(ep, title, hint) {
  const el = $("teams");
  clearTimeout(tmHide);
  el.hidden = false;
  tmMode = ep.type;
  $("tmTitle").textContent = title;
  $("tmHint").textContent = hint;
  tmEnd = performance.now() + (ep.remainingMs ?? ep.seconds * 1000);
  updateTeams(ep);
  clearInterval(tmTimer);
  tmTimer = setInterval(() => {
    const s = Math.max(0, Math.ceil((tmEnd - performance.now()) / 1000));
    $("tmTimer").textContent = "⏳ " + s + "s";
    $("tmTimer").classList.toggle("hurry", s <= 10);
  }, 200);
}
export function updateTeams(ep) {
  if (ep.remainingMs != null && ep.remainingMs > 0) tmEnd = performance.now() + ep.remainingMs;
  const teams = ep.teams || [];
  if (!teams.length) { $("tmRows").innerHTML = ""; return; }
  const lead = Math.max(...teams.map((t) => t.score));
  if (tmMode === "tug" && teams.length === 2) {
    const [a, b] = teams;
    const diff = Math.max(-1, Math.min(1, (a.score - b.score) / (ep.target || 1)));
    const left = 50 - diff * 50; // the knot moves towards the side that pulls harder
    $("tmRows").innerHTML = `<div class="tug-names"><span style="color:${b.color}">${esc(b.name)} (${b.members}) · ${fmt(b.score)}</span><span style="color:${a.color}">${fmt(a.score)} · ${esc(a.name)} (${a.members})</span></div>
      <div class="tug"><div style="width:${left}%;background:${b.color}"></div><div style="flex:1;background:${a.color}"></div><div class="knot" style="left:calc(${left}% - 2px)"></div></div>
      <div class="tug-names"><span>${esc((b.top || []).join(", "))}</span><span>${esc((a.top || []).join(", "))}</span></div>`;
    return;
  }
  const max = tmMode === "lantern" ? ep.target : Math.max(ep.target || 1, lead);
  $("tmRows").innerHTML = teams.map((t) => `<div class="tm-row ${teams.length > 1 && t.score === lead && lead > 0 ? "lead" : ""}">
      <span class="nm" style="color:${t.color}">${esc(t.name)}${teams.length > 1 ? ` (${t.members})` : ""}</span>
      <div class="tb"><div style="width:${Math.min(100, (t.score / max) * 100)}%;background:${t.color}"></div></div>
      <span class="sc">${fmt(t.score)}</span>
      ${t.top?.length ? `<span class="top">⭐ ${esc(t.top.join(", "))}</span>` : ""}</div>`).join("");
}
export function endTeams(text) {
  clearInterval(tmTimer);
  $("tmTimer").textContent = text;
  tmHide = setTimeout(() => ($("teams").hidden = true), 6000);
}
// ------------------------------------------------------------------ Ông Giáo's word puzzle
let qzEnd = 0, qzTimer = null, qzHide = null;
export function showQuiz(ep) {
  clearTimeout(qzHide);
  $("quiz").hidden = false;
  $("quiz").classList.remove("solved");
  const mode = ep.mode || "scramble";
  $("qzTitle").textContent = mode === "riddle" ? "🤔 Ông Giáo đố vui" : mode === "math" ? "🧮 Ông Giáo đố toán nhanh" : "📜 Ông Giáo đố chữ";
  $("qzTiles").innerHTML = mode === "scramble"
    ? (ep.tiles || []).map((t, i) => `<span style="animation-delay:${i * 40}ms">${esc(t)}</span>`).join("")
    : `<div class="qz-q ${mode}">${esc(ep.question || "")}</div>`;
  $("qzInfo").textContent = mode === "math" ? "Gõ kết quả (số) vào bình luận"
    : mode === "riddle" ? `Đáp án ${ep.words} từ · gõ không dấu cũng được`
    : `${ep.letters} chữ cái · ${ep.words} từ · gõ không dấu cũng được`;
  $("qzWrong").textContent = "";
  qzEnd = performance.now() + (ep.remainingMs ?? ep.seconds * 1000);
  updateQuiz(ep);
  clearInterval(qzTimer);
  qzTimer = setInterval(() => {
    const s = Math.max(0, Math.ceil((qzEnd - performance.now()) / 1000));
    $("qzTimer").textContent = "⏳ " + s + "s";
    $("qzTimer").classList.toggle("hurry", s <= 10);
  }, 200);
}
export function updateQuiz(ep) {
  if (ep.remainingMs > 0) qzEnd = performance.now() + ep.remainingMs;
  const h = ep.answer ? ep.answer.toUpperCase() : ep.hint || (ep.mode === "math" ? "_".repeat(ep.letters || 2) : "");
  $("qzHint").innerHTML = h.split(" ").map((w) => `<span class="w">${[...w].map((ch) => `<i class="${ch === "_" ? "" : "on"}">${ch === "_" ? "" : esc(ch)}</i>`).join("")}</span>`).join("");
}
let wrongT = null;
export function quizWrong(name) {
  const el = $("qzWrong");
  el.textContent = "❌ " + name;
  el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
  clearTimeout(wrongT);
  wrongT = setTimeout(() => (el.textContent = ""), 2500);
}
export function endQuiz(ep, winner) {
  clearInterval(qzTimer);
  updateQuiz(ep);
  $("quiz").classList.add("solved");
  $("qzTimer").textContent = winner ? "🎓 " + winner.name : ep.answer ? "⌛ Hết giờ" : "Đã dừng";
  $("qzWrong").textContent = "";
  qzHide = setTimeout(() => ($("quiz").hidden = true), 9000);
}

/** "Sự kiện lớn" milestone: how lively the live is vs the threshold, and when the next one can start. */
export function bigMeter(m) {
  const el = $("bigMeter");
  if (!m || !m.enabled || m.busy || document.getElementById("teams")?.hidden === false || document.getElementById("quiz")?.hidden === false) { el.hidden = true; return; }
  el.hidden = false;
  const pct = Math.min(100, (m.score / Math.max(1, m.threshold)) * 100);
  $("bmFill").style.width = pct + "%";
  const wait = Math.ceil(m.readyInMs / 1000);
  const mmss = wait >= 60 ? Math.floor(wait / 60) + ":" + String(wait % 60).padStart(2, "0") : wait + "s";
  el.classList.toggle("ready", pct >= 100 && wait <= 0);
  if (wait > 0) {
    $("bmTitle").textContent = "Sự kiện lớn sau " + mmss;
    $("bmSub").textContent = `Tích sôi nổi ${fmt(m.score)}/${fmt(m.threshold)} · tim & bình luận`;
  } else if (pct >= 100) {
    $("bmTitle").textContent = "Sắp mở sự kiện lớn!";
    $("bmSub").textContent = "Kéo co · đua thuyền · đèn trời · đập niêu";
  } else {
    $("bmTitle").textContent = `Sự kiện lớn: ${fmt(m.score)}/${fmt(m.threshold)}`;
    $("bmSub").textContent = "Làng đủ sôi nổi là mở hội · tim & bình luận";
  }
}

/** Ông Giáo's poem: a scroll with the lines, the current one highlighted (null hides it). */
export function poem(lines) {
  const el = $("poem");
  if (!lines) { el.hidden = true; return; }
  $("pmLines").innerHTML = lines.map((l, i) => `<div class="pm-l" data-i="${i}">${esc(l)}</div>`).join("");
  el.hidden = false;
}
export function poemLine(i) {
  document.querySelectorAll("#pmLines .pm-l").forEach((d) => d.classList.toggle("on", Number(d.dataset.i) === i));
}

/** Honour board for the winners of a big event (null hides it). */
let honorHide = null;
export function honor(title, names = [], color = "#ffd36b", total = 0, xp = 0) {
  const el = $("honor");
  clearTimeout(honorHide);
  if (!title) { el.classList.remove("show"); return; }
  const shown = names.slice(0, 18);
  const more = Math.max(0, (total || names.length) - shown.length);
  el.innerHTML = `<div class="hn-title">${esc(title)}</div>
    <div class="hn-names">${shown.map((n, i) => `<span class="hn-chip${i < 3 ? " top" : ""}" style="--c:${color}">${i < 3 ? ["🥇", "🥈", "🥉"][i] + " " : ""}${esc(n)}</span>`).join("")}${more ? `<span class="hn-chip">+${more}</span>` : ""}</div>
    ${xp ? `<div class="hn-xp">⭐ Cả đội được thưởng +${xp} kinh nghiệm</div>` : ""}`;
  el.classList.add("show");
  honorHide = setTimeout(() => el.classList.remove("show"), 15000);
}

/** Fixed commentary box (used when the camera is away from Lão, e.g. at the river). */
export function commentary(text) {
  const el = $("commentary");
  if (!text) { el.hidden = true; return; }
  $("cmText").textContent = text;
  el.hidden = false;
}

export function challengeLeft() { return Math.max(0, Math.ceil((chEnd - performance.now()) / 1000)); }
