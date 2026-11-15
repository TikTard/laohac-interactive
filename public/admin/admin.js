const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (n) => Number(n || 0).toLocaleString("vi-VN");
const api = (url, body) =>
  fetch(url, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json());

// ------------------------------------------------------------------ tabs
document.querySelectorAll(".tab").forEach((b) =>
  b.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === b));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("on", v.id === b.dataset.tab));
    location.hash = b.dataset.tab;
  }));
if (location.hash) document.querySelector(`.tab[data-tab="${location.hash.slice(1)}"]`)?.click();

// ------------------------------------------------------------------ live link
const STATE_NAMES = { connected: "Đã kết nối", connecting: "Đang kết nối…", disconnected: "Mất kết nối", error: "Lỗi kết nối", disabled: "Đã tắt" };
const TYPE_NAMES = { gift: "🎁 Quà", chat: "💬 Chat", like: "❤️ Tim", follow: "➕ Follow", share: "🔁 Share", join: "👋 Vào", subscribe: "⭐ Hội viên" };

function connect() {
  const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws?role=admin`);
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.t === "status") renderStatus(msg.status);
    if (msg.t === "hello" || msg.t === "state") renderState(msg.state);
    if (msg.t === "event") logEvent(msg.ev);
    if (msg.t === "raw" && $("showRaw").checked) logRaw(msg.raw);
  };
  ws.onclose = () => {
    $("tfState").textContent = "Mất kết nối tới máy chủ game";
    $("tfDot").className = "dot error";
    setTimeout(connect, 2000);
  };
}

function ago(ts) {
  if (!ts) return "chưa có";
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return s + " giây trước";
  if (s < 3600) return Math.round(s / 60) + " phút trước";
  return Math.round(s / 3600) + " giờ trước";
}
function dur(ms) {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h} giờ ${m} phút` : `${m} phút ${s % 60} giây`;
}

function renderStatus(st) {
  const tf = st.tikfinity;
  $("tfDot").className = "dot " + tf.state;
  $("tfState").textContent = STATE_NAMES[tf.state] || tf.state;
  $("tfUrl").textContent = tf.url;
  $("tfInfo").textContent = `${fmt(tf.messages)} tin nhắn · tin cuối ${ago(tf.lastMessageAt)}${tf.reconnects ? ` · thử lại ${tf.reconnects} lần` : ""}`;
  $("tfErr").textContent = tf.state === "connected" ? "" : tf.lastError ? "Lỗi: " + tf.lastError + " — TikFinity đã mở và kết nối live chưa?" : "";
  // event flow over the last 5 minutes: shows at once when chat stops arriving
  const fl = st.flow || { byType: {}, bySource: {} };
  const ty = fl.byType, so = fl.bySource;
  const other = (ty.gift || 0) + (ty.like || 0) + (ty.join || 0) + (ty.follow || 0) + (ty.share || 0);
  $("flowInfo").textContent = `5 phút qua: chat ${ty.chat || 0} · quà ${ty.gift || 0} · tim ${ty.like || 0} · vào ${ty.join || 0} — nguồn: TikFinity ${so.tikfinity || 0}, username ${so.tiktok || 0}, webhook ${so.webhook || 0}`;
  $("flowWarn").textContent = !ty.chat && other >= 10
    ? "⚠️ Không nhận được chat nào trong 5 phút dù vẫn có tương tác khác. Mở TikFinity bấm Connect vào live (hoặc bật kết nối username) để game nhận được chat."
    : "";
  $("gameClients").textContent = st.clients.game;
  $("gameHint").textContent = st.clients.game > 1
    ? "Chỉ 1 màn hình phát tiếng, các màn hình khác chỉ hiện phụ đề"
    : st.clients.game ? "OBS / trình duyệt đang chạy game" : "Chưa có màn hình game nào — mở /game/ trong OBS";
  $("screens").innerHTML = (st.clients.screens || []).map((s) =>
    `<li>${s.audio ? "🔊" : "🔇"} #${s.id} ${esc(s.label)} <span class="muted">từ ${new Date(s.since).toLocaleTimeString("vi-VN")}</span>
      ${s.audio ? "<b>đang phát tiếng</b>" : `<button class="btn sm ghost" data-audio="${s.id}">Phát tiếng ở đây</button>`}</li>`).join("");
  const t = st.tts;
  $("ttsProvider").textContent = t.provider;
  $("ttsInfo").textContent = `${fmt(t.requests)} câu · ${fmt(t.cacheHits)} dùng lại · lần cuối ${t.lastMs} ms${t.lastProvider ? " (" + t.lastProvider + ")" : ""}`;
  $("ttsErr").textContent = t.lastError ? `${t.errors} lỗi · ${t.lastError}` : "";
  $("uptime").textContent = dur(st.uptime);
  renderLive(st.direct);
  renderEpisodeLive(st);
  const ep = st.episodes?.active;
  if (ep) {
    $("epState").textContent = ep.label;
    $("epFill").style.width = Math.min(100, (ep.progress / ep.target) * 100) + "%";
    $("epInfo").textContent = fmt(ep.progress) + " / " + fmt(ep.target) + " " + ep.unit + " · còn " + Math.ceil(ep.remainingMs / 1000) + " giây";
  } else {
    $("epState").textContent = "Không có";
    $("epFill").style.width = "0%";
    const n = st.episodes?.next?.challenge;
    $("epInfo").textContent = n ? "Thử thách tiếp theo khoảng " + new Date(n).toLocaleTimeString("vi-VN") : "";
  }
}

function renderState(s) {
  if (!s) return;
  const k = s.totals;
  const seedD = k.seedDiamonds || 0, seedG = k.seedGifts || 0;
  const realD = k.diamonds - seedD, realG = k.gifts - seedG;
  const items = [
    ["💎", "Xu thật", realD, "real", fmt(realG) + " quà từ TikTok"],
    ["🌱", "Xu seeding", seedD, "seed", fmt(seedG) + " quà tặng từ admin"],
    ["👥", "Người tặng", s.donorsCount], ["❤️", "Tim", k.likes],
    ["💬", "Bình luận", k.comments], ["➕", "Follow", k.follows], ["🔁", "Chia sẻ", k.shares], ["👋", "Lượt vào", k.joins]];
  $("kpis").innerHTML = items.map(([i, n, v, cls, sub]) =>
    `<div class="card kpi ${cls || ""}"><div class="v">${fmt(v)}</div><div class="k">${i} ${n}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>`).join("");
  $("epm").textContent = `${s.eventsPerMinute} sự kiện / phút · phiên từ ${new Date(s.since).toLocaleString("vi-VN")}`;
  const g = s.goal;
  $("goalLvl").textContent = `Cấp ${Math.min(g.level + 1, g.levels)}/${g.levels}`;
  $("goalName").textContent = g.done ? "Đã hoàn thành mọi mục tiêu 🎉" : g.name;
  $("goalFill").style.width = Math.min(100, (g.have / g.need) * 100) + "%";
  $("goalText").textContent = `${fmt(g.have)} / ${fmt(g.need)} xu`;
  $("donors").innerHTML = (s.top || []).map((d, i) =>
    `<li><span class="rk">${i + 1}</span><div class="av">${d.avatar ? `<img src="${esc(d.avatar)}" referrerpolicy="no-referrer">` : esc((d.name || "?")[0])}</div><span class="nm">${esc(d.name)}</span><b>💎 ${fmt(d.diamonds - (d.seedDiamonds || 0))}${d.seedDiamonds ? ` <span class="split">+ 🌱${fmt(d.seedDiamonds)}</span>` : ""}</b></li>`).join("")
    || `<li class="muted">Chưa có ai tặng quà.</li>`;
}

function describe(ev) {
  switch (ev.type) {
    case "gift": return `<b>${esc(ev.user.name)}</b> tặng ${esc(ev.gift)} x${ev.count} = ${fmt(ev.diamonds)} xu → ${esc(ev.tier?.label || "")}${ev.levelUp ? " · 🏆 LÊN CẤP" : ""}`;
    case "chat": return `<b>${esc(ev.user.name)}</b>: ${esc(ev.text)}`;
    case "like": return `<b>${esc(ev.user.name)}</b> thả ${ev.count} tim`;
    default: return `<b>${esc(ev.user.name)}</b>`;
  }
}
function pushLog(html) {
  const log = $("log");
  log.insertAdjacentHTML("afterbegin", html);
  while (log.children.length > 200) log.lastChild.remove();
}
function logEvent(ev) {
  const t = new Date(ev.at || Date.now()).toLocaleTimeString("vi-VN");
  pushLog(`<div class="e ${ev.type}"><span class="t">${t}</span><span class="ty">${TYPE_NAMES[ev.type] || ev.type}</span><span>${describe(ev)}${ev.source === "simulator" ? ` <span class="seed-tag">🌱 seeding</span>` : `<span class="src">${esc(ev.source)}</span>`}</span></div>`);
}
function logRaw(raw) {
  pushLog(`<div class="e"><span class="t">${new Date().toLocaleTimeString("vi-VN")}</span><span class="ty">RAW</span><span>${esc(raw.event || raw.type || "")}</span><pre>${esc(JSON.stringify(raw).slice(0, 600))}</pre></div>`);
}

$("screens").addEventListener("click", (e) => {
  const b = e.target.closest("[data-audio]");
  if (b) api("/api/audio", { id: Number(b.dataset.audio) });
});
$("tfReconnect").onclick = () => api("/api/tikfinity/reconnect", {});
$("resetStats").onclick = () => confirm("Xóa toàn bộ thống kê và tiến độ mục tiêu?") && api("/api/stats/reset", { keepGoal: false });
const LV_ICON = ["", "🌾", "🏡", "🎖️", "📜", "🏮", "👑"];
async function loadViewerLevels() {
  const r = await api("/api/viewers");
  const list = r.top || [];
  $("viewerLevels").innerHTML = list.slice(0, 12).map((v, i) => {
    const t = r.levels.list[v.level - 1]?.title || "";
    const next = r.levels.list[v.level]?.xp;
    const pct = next ? Math.min(100, ((v.xp - r.levels.list[v.level - 1].xp) / (next - r.levels.list[v.level - 1].xp)) * 100) : 100;
    return `<li><span class="rk">${i + 1}</span><div class="av">${v.avatar ? `<img src="${esc(v.avatar)}" referrerpolicy="no-referrer">` : esc((v.name || "?")[0])}</div>
      <span class="nm">${esc(v.name)}<br><span class="muted">${LV_ICON[v.level] || ""} Cấp ${v.level} · ${esc(t)}</span>
      <span class="xpbar"><span style="width:${pct}%"></span></span></span><b>${fmt(v.xp)} XP</b></li>`;
  }).join("") || `<li class="muted">Chưa có ai.</li>`;
}
loadViewerLevels();
setInterval(loadViewerLevels, 5000);
$("resetViewers").onclick = async () => {
  if (!confirm("Xóa toàn bộ cấp và điểm kinh nghiệm của mọi người xem? Không hoàn tác được.")) return;
  await api("/api/viewers/reset", {});
  loadViewerLevels();
};
$("resetStatsKeep").onclick = () => confirm("Xóa thống kê phiên nhưng giữ tiến độ mục tiêu?") && api("/api/stats/reset", { keepGoal: true });
api("/api/events").then((evs) => evs.forEach(logEvent));

// ------------------------------------------------------------------ simulator
const sim = async (type, extra = {}) => {
  const body = { type, name: $("simName").value, gift: $("simGift").value, diamonds: $("simDiamonds").value,
    count: $("simCount").value, text: $("simText").value, ...extra };
  let r = await api("/api/simulate", body);
  if (r?.live) {
    if (!confirm(r.error + "\n\nVẫn giả lập?")) return r;
    r = await api("/api/simulate", { ...body, force: true });
  }
  return r;
};
document.querySelectorAll("[data-sim]").forEach((b) => (b.onclick = () => sim(b.dataset.sim)));
document.querySelectorAll("[data-preset]").forEach((b) => (b.onclick = () => {
  const d = Number(b.dataset.preset);
  const names = { 1: "Rose", 10: "Donut", 99: "Hoa lớn", 1000: "Siêu quà" };
  sim("gift", { gift: names[d], diamonds: d === 10 ? 30 : d, count: 1 });
}));
$("burst").onclick = async () => {
  const people = ["Lan", "Hùng", "Mai Anh", "Tuấn 🐉", "Bé Na", "Ông Ba", "Thảo", "Minh", "Cô Tư", "Phúc"];
  for (let i = 0; i < 10; i++) {
    sim("gift", { name: people[i], id: people[i], gift: ["Rose", "Donut", "Kem", "Hoa"][i % 4], diamonds: [1, 30, 5, 99][i % 4], count: 1 + (i % 3) });
    await new Promise((r) => setTimeout(r, 350));
  }
};
$("sayGame").onclick = () => api("/api/say", { text: $("sayText").value });
$("sayHere").onclick = () => playTts($("sayText").value);
document.querySelectorAll("[data-action]").forEach((b) => (b.onclick = () => api("/api/action", { action: b.dataset.action })));
$("hookUrl").textContent = `${location.origin}/api/webhook?type=gift&nickname={nickname}&gift={giftname}&count={repeatcount}&diamonds={coins}`;
$("hookUrl").onclick = () => navigator.clipboard?.writeText($("hookUrl").textContent);

async function playTts(text) {
  const r = await fetch("/api/tts?text=" + encodeURIComponent(text));
  if (r.status === 204) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "vi-VN";
    speechSynthesis.speak(u);
    return;
  }
  if (!r.ok) return alert("Lỗi giọng AI: " + ((await r.json().catch(() => ({}))).error || r.status));
  const a = new Audio(URL.createObjectURL(await r.blob()));
  a.preservesPitch = (Number(form.elements["tts.rate"].value) || 1) >= 1;
  a.playbackRate = Number(form.elements["tts.rate"].value) || 1;
  a.play();
}

// ------------------------------------------------------------------ settings form
const form = $("cfgForm");
let current = null;
const get = (o, path) => path.split(".").reduce((x, k) => x?.[k], o);
const set = (o, path, v) => {
  const ks = path.split(".");
  let x = o;
  for (const k of ks.slice(0, -1)) x = x[k] ||= {};
  x[ks.at(-1)] = v;
};

async function loadForm() {
  current = await api("/api/config");
  for (const el of form.elements) {
    if (!el.name) continue;
    const v = get(current, el.name);
    if (el.type === "checkbox") el.checked = !!v;
    else if (el.dataset.list !== undefined) el.value = (v || []).join(", ");
    else el.value = v ?? "";
  }
  $("goalsText").value = current.game.goals.map((g) => `${g.name} | ${g.target}`).join("\n");
  $("levelsText").value = (current.levels?.list || []).map((l) => `${l.title} | ${l.xp}`).join("\n");
  $("quizWords").value = (current.quiz?.words || []).join("\n");
  $("tiersText").value = current.tiers.map((t) => `${t.min} | ${t.item} | ${t.label}${t.big ? " | big" : ""}`).join("\n");
  toggleProviders();
  renderLines();
  renderEpisodes();
}
function toggleProviders() {
  const p = form.elements["tts.provider"].value;
  form.querySelectorAll("fieldset[data-for]").forEach((f) => f.classList.toggle("off", f.dataset.for !== p));
}
form.elements["tts.provider"].addEventListener("change", toggleProviders);

function collect() {
  const patch = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    let v;
    if (el.type === "checkbox") v = el.checked;
    else if (el.type === "number") v = Number(el.value);
    else if (el.dataset.list !== undefined) {
      v = el.value.split(",").map((s) => s.trim()).filter(Boolean);
      if (el.dataset.num !== undefined) v = v.map(Number).filter((n) => n > 0);
    }
    else v = el.value;
    set(patch, el.name, v);
  }
  const lv = $("levelsText").value.split("\n").map((l) => l.split("|").map((s) => s.trim()))
    .filter((p) => p[0] && p[1] !== undefined && !isNaN(Number(p[1]))).map(([title, xp]) => ({ title, xp: Number(xp) }));
  const qw = $("quizWords").value.split("\n").map((w) => w.trim()).filter(Boolean);
  if (qw.length) { patch.quiz = patch.quiz || {}; patch.quiz.words = qw; }
  if (lv.length) { patch.levels = patch.levels || {}; patch.levels.list = lv.sort((a, b) => a.xp - b.xp); }
  patch.game.goals = $("goalsText").value.split("\n").map((l) => l.split("|").map((s) => s.trim()))
    .filter((p) => p[0] && Number(p[1]) > 0).map(([name, target]) => ({ name, target: Number(target) }));
  patch.tiers = $("tiersText").value.split("\n").map((l) => l.split("|").map((s) => s.trim()))
    .filter((p) => p.length >= 3 && p[1]).map(([min, item, label, big]) => ({ min: Number(min) || 0, item, label, ...(big === "big" ? { big: true } : {}) }));
  return patch;
}
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  await api("/api/config", collect());
  $("saveMsg").textContent = "Đã lưu lúc " + new Date().toLocaleTimeString("vi-VN");
  loadForm();
});
$("cfgReload").onclick = loadForm;
$("ttsTest").onclick = async () => {
  await api("/api/config", collect());
  playTts("Lão cảm ơn bà con cô bác nhiều lắm. Cậu Vàng ơi, chào mọi người đi con!");
};

// ------------------------------------------------------------------ lines editor
// Tip shown in the editor: keep lines policy-safe — thank people, invite likes / comments / follows,
// never ask for gifts, never threaten, never tie anything bad to "no gifts".
const LINE_NAMES = { gift: "Cảm ơn quà", bigGift: "Quà lớn", dogGift: "Quà cho Cậu Vàng", follow: "Follow", share: "Chia sẻ",
  subscribe: "Hội viên", join: "Chào người mới", idle: "Tự nói khi vắng", lament: "Lão than thở khi vắng người", lowMood: "Khi làng yên ắng", like: "Mốc thả tim",
  chatCall: "Khi được gọi", levelUp: "Lên cấp mục tiêu", funny: "Câu vui (khi vắng)",
  passerGreet: "Chào người xem đi qua", bigShout: "Vinh danh đội thắng", landlordNew: "Chào Địa chủ mới", landlordBack: "Địa chủ quay lại", quizStart: "Ông Giáo ra đố", quizWrong: "Ông Giáo nhắc khi sai",
  quizClose: "Khi gần đúng", quizHint: "Gợi ý thêm chữ", quizWin: "Khen người đúng", quizNobody: "Không ai đoán ra", dance: "Vàng nhảy hiphop",
  quanArrive: "Quan huyện: tới", laoRefuseQuan: "Lão: từ chối quan", quanDemand: "Quan: thử thách ({target}, {seconds})",
  quanTaunt: "Quan: giục ({left}, {progress})", quanCheer: "Lão: rủ cổ vũ", quanLose: "Quan: chịu thua, về", laoQuanWin: "Lão: giữ được Vàng",
  quanFail: "Quan: chưa đủ điểm, sai lính dắt Vàng", laoQuanFail: "Lão: sau khi quan về", laoDogBack: "Lão: Vàng chạy về",
  laoSadDogTaken: "Lão: buồn khi Vàng bị dắt đi", takerOuch: "Người dắt: Vàng vùng ra", binhTuGrab: "Binh Tư: tóm được Vàng",
  taxDemand: "Lý trưởng: xét mở hội ({target})", laoAskVillage: "Lão: rủ cả làng", taxTaunt: "Lý trưởng: giục", taxPaid: "Lý trưởng: cho mở hội",
  laoTaxPaid: "Lão: mừng mở hội", taxFail: "Lý trưởng: dắt Vàng làm tin", laoTaxFail: "Lão: hẹn lần sau",
  binhTuSneak: "Binh Tư: rón rén", laoSpotThief: "Lão: phát hiện Binh Tư", binhTuFlee: "Binh Tư: bỏ chạy", laoThiefGone: "Lão: đuổi được Binh Tư",
  ongGiaoAppeal: "Ông Giáo: giới thiệu làng, cách chơi", ongGiaoChat: "Ông Giáo ↔ Lão (G: … | L: …)",
  kidsLao: "Lão nói với trẻ con",
  herdLao: "Vàng lùa gà", hugKid: "Trẻ con bế Vàng (trẻ nói)", hugLao: "Trẻ con bế Vàng (Lão nói)",
  ballKid: "Chơi bóng (trẻ nói)", ballLao: "Chơi bóng (Lão nói)",
  fightStart: "Kéo co: người 1 thách ({other})", fightReply: "Kéo co: người 2 nhận lời", fightLao: "Kéo co: Lão hô",
  fightWin: "Kéo co: kết quả ({winner}, {loser})", fightMakeUp: "Kéo co: Lão nói sau trận",
  rainLao: "Mưa rào: Lão nói", rainbowLao: "Cầu vồng: Lão nói", kiteKid: "Thả diều: trẻ nói", kiteLao: "Thả diều: Lão nói",
  butterflyLao: "Vàng đuổi bướm", roosterLao: "Gà trống gáy", levelUpLao: "Người xem lên cấp ({name}, {title})" };
function renderLines() {
  $("linesGrid").innerHTML = Object.keys(LINE_NAMES).map((k) =>
    `<label>${LINE_NAMES[k]}<textarea data-line="${k}" rows="5">${esc((current.lines[k] || []).join("\n"))}</textarea></label>`).join("");
}
$("linesSave").onclick = async () => {
  const lines = {};
  document.querySelectorAll("[data-line]").forEach((t) => (lines[t.dataset.line] = t.value.split("\n").map((s) => s.trim()).filter(Boolean)));
  await api("/api/config", { lines });
  $("linesMsg").textContent = "Đã lưu lúc " + new Date().toLocaleTimeString("vi-VN");
  loadForm();
};
$("linesReset").onclick = async () => {
  if (!confirm("Khôi phục toàn bộ câu thoại mặc định?")) return;
  await api("/api/config/reset", { section: "lines" });
  loadForm();
};

loadForm();
connect();

// ------------------------------------------------------------------ episodes tab
const EPISODES = {
  challenges: [
    { type: "quan", ic: "🎩", name: "Quan huyện hỏi mua Cậu Vàng", d: "Đủ điểm: quan chịu thua. Chưa đủ: lính dắt Vàng đi, Lão buồn; tới cổng làng Vàng vùng ra chạy về.", cfg: "quan" },
    { type: "tax", ic: "🏮", name: "Lý trưởng xét mở hội làng", d: "Đủ điểm: mở hội, camera lùi xa, cả làng cùng nhảy. Chưa đủ: lính dắt Vàng đi làm tin; tới cổng Vàng vùng ra chạy về.", cfg: "tax" },
    { type: "binhtu", ic: "🥷", name: "Binh Tư lảng vảng", d: "Đủ điểm: cả làng hô, hắn chạy. Chưa đủ: hắn dắt Vàng đi; tới cổng Vàng vùng ra chạy về.", cfg: "binhtu" },
  ],
  scenes: [
    { type: "ongiao", ic: "👓", name: "Ông Giáo giới thiệu làng", d: "Ông Giáo kể về Lão Hạc trong truyện Nam Cao, hướng dẫn cách chơi, trò chuyện với Lão.", sched: "ongGiaoMinutes" },
    { type: "kids", ic: "🧒", name: "Trẻ con chạy qua", d: "Hai đứa trẻ chạy đuổi nhau, gà chạy tán loạn.", scene: "kids" },
    { type: "kidsHug", ic: "🤗", name: "Trẻ con bế Cậu Vàng", d: "Bế Vàng lên quay vòng rồi đặt xuống.", scene: "kidsHug" },
    { type: "kidsBall", ic: "⚽", name: "Trẻ con chơi bóng với Vàng", d: "Hai đứa trẻ ném bóng, Cậu Vàng chạy nhặt về.", scene: "kidsBall" },
    { type: "herd", ic: "🐔", name: "Cậu Vàng lùa gà", d: "Vàng chạy đuổi cả đàn gà quanh sân.", scene: "herd" },
    { type: "fight", ic: "🪢", name: "Người xem thi kéo co", d: "Hai người dân mang tên người xem vừa tương tác thi kéo co, cả làng cổ vũ, Lão bắt tay làm lành.", scene: "fight" },
    { type: "rain", ic: "🌧️", name: "Mưa rào + cầu vồng", d: "Trời tối lại, mưa rào, người dân chạy mưa; Vàng rũ nước; mưa tạnh có cầu vồng.", scene: "rain" },
    { type: "kite", ic: "🪁", name: "Trẻ con thả diều", d: "Một đứa trẻ thả diều bay cao qua làng, Lão kể chuyện hồi bé.", scene: "kite" },
    { type: "butterflies", ic: "🦋", name: "Vàng đuổi bướm", d: "Bướm bay quanh sân, Cậu Vàng chạy đuổi mãi không bắt được.", scene: "butterflies" },
    { type: "dogFlip", ic: "🤸", name: "Vàng nhào lộn đớp bóng", d: "Trẻ con sút bóng lên cao, Cậu Vàng bật nhảy lộn một vòng trên không đớp gọn.", scene: "dogFlip" },
    { type: "poem", ic: "📜", name: "Ông Giáo đọc thơ + khen", d: "Ông Giáo đọc ca dao, rồi gọi tên khen 2–3 người vừa bình luận (có spotlight).", scene: "poem" },
    { type: "quay", ic: "🕺", name: "Quẩy trẩy hội", d: "Camera kéo ra xa, người xem trong làng xếp hàng nhảy hiphop theo nhịp (đủ kiểu tư thế); thanh nhịp chạy như game nhảy; Lão Hạc & Cậu Vàng đeo kính làm DJ.", scene: "quay" },
    { type: "dogChase", ic: "🐕", name: "Vàng dí cắn người xem", d: "Cậu Vàng chọn một người xem đang trong làng, dí chạy vòng quanh sân rồi ngoạm đùa ống quần; Lão can và xin lỗi.", scene: "dogChase" },
    { type: "scuffle", ic: "💢", name: "Hàng xóm cãi nhau", d: "Hai người xem đang trong làng (hoặc 2 người admin chọn) cãi nhau, lăn vào đám mây bụi; người xem gõ “can” để can, rồi bắt tay làm lành.", scene: "scuffle" },
  ],
  quiz: [
    { type: "quiz", ic: "📜", name: "Ông Giáo đố chữ", d: "Các chữ cái bị xáo trộn; ai gõ đúng nhanh nhất được vinh danh + kinh nghiệm. Gõ sai bị Ông Giáo nhắc vui.", quiz: true },
  ],
  big: [
    { type: "tug", ic: "🪢", name: "Kéo co hai phe", d: "Xóm Đông vs Xóm Tây. Gõ Đông/Tây hoặc 1/2 để chọn phe; người xem trong đám đông xếp hàng kéo thật.", big: "tug" },
    { type: "boat", ic: "🚣", name: "Đua thuyền 4 thuyền", d: "Camera ra sông; Đỏ / Vàng / Xanh / Tím (1–4). Tim & bình luận là chèo, thuyền nào tới đích trước thắng.", big: "boat" },
    { type: "lantern", ic: "🏮", name: "Thả đèn trời", d: "Cả làng cùng góp tim & bình luận; đèn mang tên người góp bay lên, đủ mục tiêu thì thả hàng loạt + pháo hoa.", big: "lantern" },
    { type: "niu", ic: "🙈", name: "Bịt mắt đập niêu", d: "Một người xem bị bịt mắt; cả live gõ trái / phải / lên / xuống / đập để chỉ đường.", big: "niu" },
  ],
  actions: [
    { action: "festival", ic: "🏮", name: "Mở hội làng", d: "Camera lùi ra xa, cả làng cùng nhảy 15 giây." },
    { action: "dance", ic: "🕺", name: "Vàng nhảy hiphop", d: "Đứng dậy nhảy với nhạc beat, mũ và dây chuyền vàng." },
    { action: "sleep", ic: "💤", name: "Vàng ngủ gật", d: "Cho Vàng ngủ ngay; có sự kiện là tỉnh." },
    { action: "bark", ic: "🐶", name: "Vàng sủa", d: "Sủa ba tiếng." },
    { action: "thank", ic: "🙏", name: "Lão vái tạ ơn", d: "Lão chắp tay vái, Vàng vẫy đuôi." },
    { action: "cheer", ic: "🎉", name: "Cả làng reo", d: "Người dân vẫy tay, pháo giấy, Lão giơ tay mừng." },
    { action: "villager", ic: "🚶", name: "Thêm người qua đường", d: "Thêm một người dân đi qua làng." },
  ],
};

function epCard(e, kind) {
  const c = current?.episodes || {};
  let meta = "", toggle = "";
  if (e.cfg) {
    const x = c[e.cfg] || {};
    meta = `Cần ${fmt(x.target)} điểm tương tác · ${x.seconds} giây`;
    toggle = `<label class="switch" title="Cho phép tự diễn"><input type="checkbox" data-ep-toggle="${e.cfg}.enabled" ${x.enabled !== false ? "checked" : ""}><span></span>Tự diễn</label>`;
  } else if (e.scene) {
    toggle = `<label class="switch" title="Cho phép tự diễn"><input type="checkbox" data-ep-toggle="scenes.${e.scene}" ${c.scenes?.[e.scene] !== false ? "checked" : ""}><span></span>Tự diễn</label>`;
    meta = `Xoay vòng mỗi ~${c.kidsMinutes} phút`;
  } else if (e.quiz) {
    const q = current?.quiz || {};
    meta = `${q.seconds || 60} giây · mỗi ~${q.everyMinutes ?? 4} phút · +${q.winXp ?? 20} kinh nghiệm`;
  } else if (e.big) {
    const x = (current?.bigEvents || {})[e.big] || {};
    toggle = `<label class="switch" title="Cho phép tự bắt đầu"><input type="checkbox" data-big-toggle="${e.big}" ${current?.bigEvents?.events?.[e.big] !== false ? "checked" : ""}><span></span>Tự diễn</label>`;
    meta = x.target ? `Mục tiêu ${fmt(x.target)} điểm · ${x.seconds} giây` : `${x.seconds || 70} giây`;
  } else if (e.sched) {
    meta = c[e.sched] > 0 ? `Mỗi ~${c[e.sched]} phút` : "Đang tắt tự diễn (Cài đặt → Tình tiết)";
  }
  const run = e.action ? `data-act="${e.action}"` : `data-run="${e.type}"`;
  return `<div class="card ep" data-card="${e.type || e.action}">
    <div class="t"><span class="ic">${e.ic}</span>${esc(e.name)}</div>
    <div class="d">${esc(e.d)}</div>
    ${meta ? `<div class="meta">${esc(meta)}</div>` : ""}
    <div class="row">${toggle || "<span></span>"}<button class="btn" ${run}>▶ Chạy</button></div>
  </div>`;
}

function renderEpisodes() {
  if (!current) return;
  $("epChallenges").innerHTML = EPISODES.challenges.map((e) => epCard(e)).join("");
  $("epBig").innerHTML = [...EPISODES.quiz, ...EPISODES.big].map((e) => epCard(e)).join("");
  $("epScenes").innerHTML = EPISODES.scenes.map((e) => epCard(e)).join("");
  $("epActions").innerHTML = EPISODES.actions.map((e) => epCard(e)).join("");
  $("epAuto").checked = current.episodes.enabled !== false;
}

function epMsg(text, bad = false) {
  const el = $("epMsg");
  el.textContent = text;
  el.style.color = bad ? "var(--bad)" : "";
  clearTimeout(epMsg.t);
  epMsg.t = setTimeout(() => (el.textContent = ""), 4000);
}

$("episodes").addEventListener("click", async (e) => {
  const run = e.target.closest("[data-run]");
  const act = e.target.closest("[data-act]");
  if (run) {
    const r = await api("/api/episode", { type: run.dataset.run });
    const name = run.closest(".ep").querySelector(".t").textContent.trim();
    epMsg(r.error ? "⚠️ " + r.error : r.queued ? `⏳ Đã xếp hàng (${r.position}): ${name} — sẽ diễn ngay sau tình tiết hiện tại` : "▶ Đã chạy: " + name, !!r.error);
  } else if (act) {
    await api("/api/action", { action: act.dataset.act });
    epMsg("▶ Đã chạy: " + act.closest(".ep").querySelector(".t").textContent.trim());
  }
});
$("episodes").addEventListener("change", async (e) => {
  const bt = e.target.closest("[data-big-toggle]");
  if (bt) {
    current = await api("/api/config", { bigEvents: { events: { [bt.dataset.bigToggle]: bt.checked } } });
    epMsg(bt.checked ? "Đã bật tự diễn" : "Đã tắt tự diễn");
    return;
  }
  const t = e.target.closest("[data-ep-toggle]");
  if (!t) return;
  const patch = {};
  set(patch, "episodes." + t.dataset.epToggle, t.checked);
  current = await api("/api/config", patch);
  epMsg(t.checked ? "Đã bật tự diễn" : "Đã tắt tự diễn");
});
$("epAuto").onchange = async (e) => {
  current = await api("/api/config", { episodes: { enabled: e.target.checked } });
  epMsg(e.target.checked ? "Đã bật tự diễn theo lịch" : "Đã tắt tự diễn — vẫn chạy tay được");
};
$("epStop").onclick = async () => {
  await api("/api/episode/stop", {});
  epMsg("⏹ Đã dừng thử thách và xóa hàng chờ");
};

const EP_NAMES = { challenge: "Thử thách tiếp", ongiao: "Ông Giáo", kids: "Cảnh đời thường" };
function renderEpisodeLive(st) {
  const ep = st.episodes?.active;
  $("epLive").classList.toggle("on", !!ep);
  document.querySelectorAll(".ep.running").forEach((x) => x.classList.remove("running"));
  if (ep) {
    $("epNowTitle").textContent = ep.label;
    $("epNowFill").style.width = Math.min(100, (ep.progress / ep.target) * 100) + "%";
    $("epNowInfo").textContent = fmt(ep.progress) + " / " + fmt(ep.target) + " " + ep.unit + " · còn " + Math.ceil(ep.remainingMs / 1000) + " giây";
    document.querySelector(`[data-card="${ep.type}"]`)?.classList.add("running");
  } else {
    const sc = st.episodes?.scene;
    const card = sc && document.querySelector(`[data-card="${sc.type}"] .t`);
    $("epNowTitle").textContent = sc ? "🎬 " + (card ? card.textContent.trim() : sc.type) : "Sân khấu đang trống";
    $("epNowFill").style.width = "0%";
    $("epNowInfo").textContent = "";
    if (sc) document.querySelector(`[data-card="${sc.type}"]`)?.classList.add("running");
  }
  const q = st.episodes?.queue || [];
  if (q.length) {
    const names = q.map((t) => document.querySelector(`[data-card="${t}"] .t`)?.textContent.trim() || t);
    $("epNowInfo").textContent += (ep ? " · " : "") + "Hàng chờ: " + names.join(" → ");
  }
  const next = st.episodes?.next || {};
  const auto = current?.episodes?.enabled !== false;
  $("epNext").textContent = auto
    ? Object.entries(next).map(([k, t]) => `${EP_NAMES[k] || k}: ${Math.max(0, Math.round((t - Date.now()) / 1000))}s`).join(" · ")
    : "Tự diễn đang tắt";
}

// ------------------------------------------------------------------ TikTok LIVE by username
const DL_STATE = { connected: "Đang nhận sự kiện", connecting: "Đang kết nối…", offline: "Chưa lên live", error: "Lỗi kết nối", disabled: "Chưa kết nối" };
let dlLast = null;
function renderLive(d) {
  if (!d) return;
  dlLast = d;
  $("dlDot").className = "dot " + d.state;
  $("dlState").textContent = (d.username && d.state !== "disabled" ? "@" + d.username + " · " : "") + (DL_STATE[d.state] || d.state);
  $("dlInfo").textContent = d.state === "connected"
    ? `👀 ${fmt(d.viewers)} người xem · ${fmt(d.messages)} sự kiện · tin cuối ${ago(d.lastMessageAt)}`
    : d.enabled ? "Tự kết nối lại khi có thể" : "";
  $("dlErr").textContent = d.state === "connected" ? "" : d.lastError || "";
  $("dlStop").hidden = !d.enabled;
  $("dlConnect").textContent = d.enabled ? "Đổi / kết nối lại" : "Kết nối";
  renderChips();
}
function renderChips() {
  const list = current?.direct?.recent || [];
  const on = dlLast?.enabled ? dlLast.username : "";
  $("dlRecent").innerHTML = list.map((u) => `<option value="${esc(u)}">`).join("");
  $("dlChips").innerHTML = list.map((u) =>
    `<span class="chip ${u === on ? "on" : ""}"><button type="button" class="go" data-go="${esc(u)}" title="Kết nối">@${esc(u)}</button><button type="button" data-rm="${esc(u)}" title="Xóa khỏi danh sách">×</button></span>`).join("");
}
async function liveConnect(username) {
  const r = await api("/api/live/connect", { username });
  if (r.error) { $("dlErr").textContent = r.error; return; }
  current = await api("/api/config");
  renderLive(r);
}
$("dlForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const u = $("dlUser").value.trim();
  if (!u) return $("dlUser").focus();
  liveConnect(u);
  $("dlUser").value = "";
});
$("dlStop").onclick = async () => { renderLive(await api("/api/live/disconnect", {})); };
$("dlChips").addEventListener("click", async (e) => {
  const go = e.target.closest("[data-go]");
  const rm = e.target.closest("[data-rm]");
  if (go) liveConnect(go.dataset.go);
  if (rm) {
    const d = await api("/api/live/remove", { username: rm.dataset.rm });
    if (current) current.direct = d;
    renderChips();
  }
});

// ------------------------------------------------------------------ friendly scuffle between two viewers
async function loadDuel() {
  const r = await api("/api/viewers/recent");
  const list = r.list || [];
  const opts = list.map((u) => `<option value="${esc(u.id)}" data-name="${esc(u.name)}">${esc(u.name)}${u.chats ? " · 💬" + u.chats : ""}</option>`).join("");
  $("duelA").innerHTML = opts;
  $("duelB").innerHTML = opts;
  if ($("duelB").options.length > 1) $("duelB").selectedIndex = 1;
  $("duelMsg").textContent = list.length ? list.length + " người vừa tương tác" : "Chưa có ai tương tác trong 10 phút qua";
}
$("duelRefresh").onclick = loadDuel;
$("duelGo").onclick = async () => {
  const a = $("duelA").selectedOptions[0], b = $("duelB").selectedOptions[0];
  if (!a || !b || a.value === b.value) { $("duelMsg").textContent = "Chọn 2 người khác nhau"; return; }
  const r = await api("/api/episode", { type: "scuffle", cast: [{ id: a.value, name: a.dataset.name }, { id: b.value, name: b.dataset.name }] });
  $("duelMsg").textContent = r.error ? r.error : r.queued ? "Đã xếp hàng, sẽ diễn sau tình tiết đang chạy" : "Đang diễn: " + a.dataset.name + " vs " + b.dataset.name;
};
loadDuel();
