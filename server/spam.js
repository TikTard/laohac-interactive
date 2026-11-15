/**
 * Anti-spam for points: people flooding the chat to farm points / XP.
 *  - a chat line only scores if it is not a repeat (same text within dupSeconds) and not too fast (minGapSeconds)
 *  - flooding (burstCount lines within burstSeconds) or repeating -> a strike; 1st strike = friendly warning,
 *    strikesToMute strikes within strikeWindowMinutes = points muted for muteMinutes (no points, no XP, no quiz win,
 *    chat is still shown and answered). TikTok gives no API to block accounts: this is an in-game block only.
 */
const strip = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d").replace(/[^a-z0-9]/g, "");

export const SPAM_DEFAULTS = {
  enabled: true,
  minGapSeconds: 4, // chat lines closer than this do not score
  dupSeconds: 60, // the same text again within this many seconds does not score
  burstCount: 8, // this many lines ...
  burstSeconds: 20, // ... within this window = flooding
  dupStrike: 3, // repeating the same text this many times = flooding
  strikesToMute: 2,
  strikeWindowMinutes: 5,
  muteMinutes: 5,
};

export class SpamGuard {
  constructor() {
    this.users = new Map(); // id -> {times:[], texts:[[t,text]], lastScored, strikes:[], mutedUntil, name, warnedAt}
  }
  rec(id, name) {
    let u = this.users.get(id);
    if (!u) { u = { times: [], texts: [], lastScored: 0, strikes: [], mutedUntil: 0, name }; this.users.set(id, u); }
    if (name) u.name = name;
    return u;
  }
  isMuted(id, now = Date.now()) { return (this.users.get(id)?.mutedUntil || 0) > now; }

  /**
   * Look at one event. Returns { score: bool, muted: bool, action: null | "warn" | "mute", reason }.
   * Only chat lines are judged; likes etc. score unless the user is muted.
   */
  check(ev, cfg = {}) {
    const c = { ...SPAM_DEFAULTS, ...cfg };
    const id = ev.user?.id;
    if (!c.enabled || !id || id === "unknown") return { score: true, muted: false, action: null };
    const now = Date.now();
    const u = this.rec(id, ev.user.name);
    const muted = u.mutedUntil > now;
    if (ev.type !== "chat") return { score: !muted, muted, action: null };

    const text = strip(ev.text);
    u.times = u.times.filter((t) => now - t < c.burstSeconds * 1000);
    u.times.push(now);
    u.texts = u.texts.filter(([t]) => now - t < c.dupSeconds * 1000);
    const dupCount = u.texts.filter(([, x]) => x && x === text).length;
    // the game itself asks viewers to type these ("Vàng ơi", "Lão ơi"): repeating them never scores twice,
    // but it is not punished as spam either (only real flooding is)
    const keyword = !!text && (c.keywords || []).some((k) => { const s = strip(k); return s && text.includes(s); });
    u.texts.push([now, text]);

    const tooFast = now - u.lastScored < c.minGapSeconds * 1000;
    const repeat = !!text && dupCount > 0;
    let score = !muted && !tooFast && !repeat;
    if (score) u.lastScored = now;

    // flooding -> strike (at most one strike per 10 s)
    let action = null, reason = "";
    const flood = u.times.length >= c.burstCount;
    const spamDup = !keyword && dupCount + 1 >= c.dupStrike;
    if ((flood || spamDup) && !muted && now - (u.lastStrike || 0) > 10000) {
      u.lastStrike = now;
      u.strikes = u.strikes.filter((t) => now - t < c.strikeWindowMinutes * 60000);
      u.strikes.push(now);
      reason = flood ? "flood" : "repeat";
      if (u.strikes.length >= c.strikesToMute) {
        u.mutedUntil = now + c.muteMinutes * 60000;
        u.strikes = [];
        action = "mute";
        score = false;
      } else action = "warn";
    }
    return { score, muted: muted || action === "mute", action, reason, minutes: c.muteMinutes };
  }
  unmute(id) {
    const u = this.users.get(id);
    if (!u) return false;
    u.mutedUntil = 0; u.strikes = [];
    return true;
  }
  list(now = Date.now()) {
    return [...this.users.entries()]
      .filter(([, u]) => u.mutedUntil > now || u.strikes.some((t) => now - t < 5 * 60000))
      .map(([id, u]) => ({ id, name: u.name, mutedUntil: u.mutedUntil > now ? u.mutedUntil : 0, strikes: u.strikes.length }));
  }
}
