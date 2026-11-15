/** Sound: AI voice queue for Lão Hạc + synthesized dog barks and little SFX. */

export const ctx = new (window.AudioContext || window.webkitAudioContext)();
const master = ctx.createGain();
master.gain.value = 0.9;
master.connect(ctx.destination);

export function unlocked() {
  return ctx.state === "running";
}
/** Secondary screens are muted: only one screen in the stream plays sound (server decides). */
export let muted = false;
export function setMuted(m) {
  muted = !!m;
  master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
  if (muted && "speechSynthesis" in window) speechSynthesis.cancel();
}
export async function unlock() {
  try { await ctx.resume(); } catch {}
  // also unlock HTMLAudio + speechSynthesis with a silent utterance
  try { const a = new Audio(); a.muted = true; await a.play().catch(() => {}); } catch {}
  return unlocked();
}

// --------------------------------------------------------------- dog bark synth
let noiseBuf = null;
function noise() {
  if (noiseBuf) return noiseBuf;
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}
const shaper = (() => {
  const ws = ctx.createWaveShaper();
  const n = 1024, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / n) * 2 - 1; curve[i] = Math.tanh(x * 3.5); }
  ws.curve = curve;
  return ws;
})();
const barkBus = ctx.createGain();
barkBus.gain.value = 0.55;
shaper.connect(barkBus).connect(master);

function woof(t, pitch = 1) {
  const f0 = 430 * pitch;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(f0 * 0.75, t);
  osc.frequency.exponentialRampToValueAtTime(f0, t + 0.03);
  osc.frequency.exponentialRampToValueAtTime(f0 * 0.5, t + 0.16);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = 1100 * pitch; bp.Q.value = 1.1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1.0, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  osc.connect(bp).connect(g).connect(shaper);
  const nz = ctx.createBufferSource();
  nz.buffer = noise();
  const nf = ctx.createBiquadFilter();
  nf.type = "bandpass"; nf.frequency.value = 1700 * pitch; nf.Q.value = 0.8;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.exponentialRampToValueAtTime(0.5, t + 0.008);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  nz.connect(nf).connect(ng).connect(shaper);
  osc.start(t); osc.stop(t + 0.22);
  nz.start(t); nz.stop(t + 0.12);
}

export function bark(n = 2, excited = false) {
  if (!unlocked()) return;
  const t = ctx.currentTime + 0.02;
  for (let i = 0; i < n; i++) woof(t + i * 0.3, (excited ? 1.15 : 1) * (0.95 + Math.random() * 0.1));
}

export function whine() {
  if (!unlocked()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(900, t);
  o.frequency.linearRampToValueAtTime(1300, t + 0.25);
  o.frequency.linearRampToValueAtTime(800, t + 0.6);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + 0.7);
}

// --------------------------------------------------------------- sfx
export function ting() {
  if (!unlocked()) return;
  const t = ctx.currentTime;
  for (const [f, v] of [[1760, 0.18], [2640, 0.1], [3520, 0.05]]) {
    const o = ctx.createOscillator();
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.65);
  }
}
export function thud() {
  if (!unlocked()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(60, t + 0.15);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + 0.22);
}
let lastFanfare = 0;
export function fanfare() {
  if (!unlocked()) return;
  if (ctx.currentTime - lastFanfare < 3) return;
  lastFanfare = ctx.currentTime;
  const t = ctx.currentTime;
  [523, 659, 784, 1047].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t + i * 0.12);
    g.gain.exponentialRampToValueAtTime(0.18, t + i * 0.12 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.5);
    o.connect(g).connect(master);
    o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.55);
  });
}

// --------------------------------------------------------------- AI voice queue
export class Voice {
  constructor(getTtsConfig) {
    this.cfg = getTtsConfig;
    this.queue = [];
    this.busy = false;
    this.onStart = () => {};
    this.onEnd = () => {};
    this.lastEnd = performance.now();
    this.seq = 0;
  }
  usesServer() {
    return !["browser", "off"].includes(this.cfg().provider);
  }
  /**
   * priority: 0 chatter/idle, 1 normal, 2 gifts, 3 story / big gifts / admin.
   * who: "lao" (Lão Hạc) or another speaker key (uses the second NPC voice).
   * Resolves when the line has been spoken (or dropped).
   */
  say(text, priority = 1, display = null, who = "lao") {
    text = String(text || "").trim();
    if (!text) return Promise.resolve();
    let done;
    const p = new Promise((r) => (done = r));
    const item = { text, display: display || text, priority, who, npc: who !== "lao", seq: this.seq++, done };
    if (this.usesServer() && !muted) {
      item.fetch = fetch("/api/tts?text=" + encodeURIComponent(text) + (item.npc ? "&who=npc" : ""))
        .then((r) => (r.status === 200 ? r.blob() : null))
        .catch(() => null);
    }
    this.queue.push(item);
    this.queue.sort((a, b) => b.priority - a.priority || a.seq - b.seq);
    const max = Math.max(3, this.cfg().maxQueue || 6);
    while (this.queue.length > max) this.queue.pop().done();
    this.pump();
    return p;
  }
  clearLow(maxPriority = 1) {
    this.queue = this.queue.filter((i) => (i.priority > maxPriority ? true : (i.done(), false)));
  }
  get idleFor() {
    return this.busy || this.queue.length ? 0 : (performance.now() - this.lastEnd) / 1000;
  }
  async pump() {
    if (this.busy) return;
    const item = this.queue.shift();
    if (!item) return;
    this.busy = true;
    this.onStart(item);
    try {
      await this.play(item);
    } catch (e) {
      console.warn("voice", e);
    }
    this.onEnd(item);
    item.done();
    this.busy = false;
    this.lastEnd = performance.now();
    setTimeout(() => this.pump(), 300);
  }
  async play(item) {
    const c = this.cfg();
    const readTime = 1200 + item.text.length * 70;
    if (c.provider === "off" || muted) return wait(readTime); // muted screen: subtitles only
    const rate = item.npc ? c.npcRate || 1.05 : c.rate || 1;
    if (c.provider !== "browser") {
      const blob = await item.fetch;
      if (blob && unlocked()) return playBlob(blob, { ...c, rate });
      if (blob) return wait(readTime);
    }
    return speakBrowser(item.text, { ...c, rate }, readTime, item.npc ? 1.0 : 0.6);
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function playBlob(blob, c) {
  return new Promise((res) => {
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    a.preservesPitch = (c.rate || 1) >= 1; // faster: keep natural pitch; slower than 1: deeper, older voice
    a.playbackRate = c.rate || 1;
    a.volume = Math.min(1, Math.max(0, c.volume ?? 1));
    const done = () => { clearTimeout(guard); URL.revokeObjectURL(url); res(); };
    const guard = setTimeout(done, 30000);
    a.onended = done;
    a.onerror = done;
    a.play().catch(done);
  });
}

function speakBrowser(text, c, fallbackMs, pitch = 0.6) {
  if (!("speechSynthesis" in window)) return wait(fallbackMs);
  return new Promise((res) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "vi-VN";
    const v = speechSynthesis.getVoices().find((x) => x.lang?.toLowerCase().startsWith("vi"));
    if (v) u.voice = v;
    u.rate = Math.max(0.6, (c.rate || 1) * 0.95);
    u.pitch = pitch;
    u.volume = c.volume ?? 1;
    const guard = setTimeout(res, fallbackMs + 8000);
    u.onend = () => { clearTimeout(guard); res(); };
    u.onerror = () => { clearTimeout(guard); res(); };
    speechSynthesis.speak(u);
  });
}

// --------------------------------------------------------------- hip-hop beat for Cậu Vàng's dance
export function hiphopBeat(seconds = 14, bpm = 94) {
  if (!unlocked()) return () => {};
  const bus = ctx.createGain();
  bus.gain.value = 0.55;
  bus.connect(master);
  const beat = 60 / bpm;
  const t0 = ctx.currentTime + 0.05;
  const steps = Math.floor(seconds / (beat / 2));
  const kickAt = [0, 3, 4, 7];      // eighth-note grid in a bar of 8
  const snareAt = [2, 6];
  const bass = [55, 55, 65.4, 49];  // A1 A1 C2 G1, one note per bar
  for (let i = 0; i < steps; i++) {
    const t = t0 + i * (beat / 2);
    const pos = i % 8;
    if (kickAt.includes(pos)) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(bus);
      o.start(t); o.stop(t + 0.32);
    }
    if (snareAt.includes(pos)) {
      const n = ctx.createBufferSource();
      n.buffer = noise();
      const f = ctx.createBiquadFilter();
      f.type = "highpass"; f.frequency.value = 1500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      n.connect(f).connect(g).connect(bus);
      n.start(t); n.stop(t + 0.2);
    }
    { // hi-hat every eighth
      const n = ctx.createBufferSource();
      n.buffer = noise();
      const f = ctx.createBiquadFilter();
      f.type = "highpass"; f.frequency.value = 7000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(pos % 2 ? 0.08 : 0.14, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      n.connect(f).connect(g).connect(bus);
      n.start(t); n.stop(t + 0.06);
    }
    if (pos === 0 || pos === 3 || pos === 5) {
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.value = bass[Math.floor(i / 8) % bass.length] * (pos === 5 ? 1.5 : 1);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 380;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.9);
      o.connect(lp).connect(g).connect(bus);
      o.start(t); o.stop(t + beat);
    }
  }
  return () => {
    bus.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    setTimeout(() => bus.disconnect(), 600);
  };
}

/** short "scratch" record sound to start the dance */
export function scratch() {
  if (!unlocked()) return;
  const t = ctx.currentTime;
  const n = ctx.createBufferSource();
  n.buffer = noise();
  n.playbackRate.setValueAtTime(0.4, t);
  n.playbackRate.linearRampToValueAtTime(2.2, t + 0.12);
  n.playbackRate.linearRampToValueAtTime(0.3, t + 0.3);
  const f = ctx.createBiquadFilter();
  f.type = "bandpass"; f.frequency.value = 1200; f.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  n.connect(f).connect(g).connect(master);
  n.start(t); n.stop(t + 0.36);
}

// --------------------------------------------------------------- effects: firecrackers, fireworks, rain, rooster
/** Pháo nổ: short sharp crack */
export function pop() {
  if (!unlocked()) return;
  const t = ctx.currentTime;
  const n = ctx.createBufferSource();
  n.buffer = noise();
  const f = ctx.createBiquadFilter();
  f.type = "bandpass"; f.frequency.value = 1800 + Math.random() * 1200; f.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  n.connect(f).connect(g).connect(master);
  n.start(t); n.stop(t + 0.08);
}
/** Pháo hoa: low boom then crackle */
export function boom() {
  if (!unlocked()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.5);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + 0.62);
  for (let i = 0; i < 6; i++) setTimeout(pop, 250 + i * 70 + Math.random() * 60);
}
/** Mưa: filtered noise bed. Returns stop(). */
export function rainNoise(seconds = 14) {
  if (!unlocked()) return () => {};
  const t = ctx.currentTime;
  const n = ctx.createBufferSource();
  n.buffer = noise();
  n.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass"; f.frequency.value = 1600; // softer, less hiss
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.035, t + 2.5); // quiet background, under the voices
  n.connect(f).connect(g).connect(master);
  n.start(t);
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
    setTimeout(() => { try { n.stop(); } catch {} }, 1500);
  };
  setTimeout(stop, seconds * 1000);
  return stop;
}
/** Gà trống gáy: ò ó o o */
export function crow() {
  if (!unlocked()) return;
  const t = ctx.currentTime;
  const notes = [[700, 0.18], [950, 0.22], [880, 0.2], [620, 0.45]];
  let at = t;
  for (const [f, d] of notes) {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f * 0.9, at);
    o.frequency.linearRampToValueAtTime(f, at + d * 0.3);
    o.frequency.linearRampToValueAtTime(f * 0.85, at + d);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 1500; bp.Q.value = 1.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.18, at + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, at + d);
    o.connect(bp).connect(g).connect(master);
    o.start(at); o.stop(at + d + 0.02);
    at += d * 0.85;
  }
}
