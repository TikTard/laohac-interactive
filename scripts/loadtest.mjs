// Load test: N simulated viewers join the live, then chat / like / call Vàng / gift for a while.
// Usage: node scripts/loadtest.mjs [baseUrl=http://localhost:3939] [viewers=200] [seconds=90] [eventsPerSec=12]
// Halfway through it starts the DJ party (Cậu Vàng dances) so the heaviest scene is covered too.
const [base = "http://localhost:3939", nArg = "200", secArg = "90", rateArg = "12"] = process.argv.slice(2);
const N = +nArg, SECS = +secArg, RATE = +rateArg;

const FIRST = ["An", "Bình", "Chi", "Dũng", "Hà", "Khoa", "Linh", "Minh", "Nga", "Phúc", "Quân", "Sơn", "Trang", "Uyên", "Vy", "Yến"];
const users = Array.from({ length: N }, (_, i) => ({ id: "lt" + i, name: `${FIRST[i % FIRST.length]} ${i}` }));
const CHATS = ["Vàng ơi", "Lão ơi", "hay quá", "chào cả làng", "quẩy lên", "haha", "đổi ếch", "Vàng ơi!!", "xin chào", "đẹp quá"];
const pick = (a) => a[(Math.random() * a.length) | 0];

let sent = 0, failed = 0;
const lat = [];
async function post(path, body) {
  const t = performance.now();
  try {
    const r = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) failed++;
  } catch { failed++; }
  lat.push(performance.now() - t);
  sent++;
}
const sim = (u, type, extra = {}) => post("/api/simulate", { type, id: u.id, name: u.name, ...extra });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`load test → ${base}: ${N} viewers, ${SECS}s, ~${RATE} events/s`);
const t0 = Date.now();
// 1) everyone joins over ~15 s
for (let i = 0; i < N; i++) {
  sim(users[i], "join");
  await sleep(15000 / N);
}
console.log(`joined ${N} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// 2) steady interaction
let party = false;
const end = Date.now() + SECS * 1000;
while (Date.now() < end) {
  if (!party && Date.now() > end - (SECS * 1000) / 2) {
    party = true;
    post("/api/action", { action: "dance" });
    console.log("→ DJ party started");
  }
  const u = pick(users), r = Math.random();
  if (r < 0.55) sim(u, "chat", { text: pick(CHATS) });
  else if (r < 0.9) sim(u, "like", { count: 5 + ((Math.random() * 20) | 0) });
  else if (r < 0.97) sim(u, pick(["follow", "share"]));
  else sim(u, "gift", { gift: "Rose", count: 1, diamonds: 1 });
  await sleep(1000 / RATE);
}
await sleep(1500);
lat.sort((a, b) => a - b);
const pc = (p) => lat[Math.min(lat.length - 1, (lat.length * p) | 0)].toFixed(1);
console.log(`sent ${sent} requests, failed ${failed}; latency p50 ${pc(0.5)}ms p95 ${pc(0.95)}ms max ${pc(1)}ms`);
