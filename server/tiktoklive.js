import { EventEmitter } from "node:events";

/**
 * Direct connection to a TikTok LIVE by username (no TikFinity needed), using the
 * unofficial `tiktok-live-connector` library. Emits the same normalized events as tikfinity.js.
 * Signing goes through the Euler Stream sign server (free tier works; an API key raises limits).
 */
export function cleanUsername(s) {
  let u = String(s || "").trim();
  const m = u.match(/tiktok\.com\/@([^/?#\s]+)/i);
  if (m) u = m[1];
  return u.replace(/^@+/, "").replace(/[^\w.]/g, "").slice(0, 40);
}

const RETRY_OFFLINE_MS = 15000;
const RETRY_DROP_MS = 8000;

export class TikTokDirect extends EventEmitter {
  constructor() {
    super();
    this.enabled = false;
    this.username = "";
    this.apiKey = "";
    this.conn = null;
    this.state = "disabled"; // disabled | connecting | connected | offline | error
    this.lastError = "";
    this.roomId = "";
    this.viewers = 0;
    this.connectedAt = 0;
    this.lastMessageAt = 0;
    this.messages = 0;
    this.timer = null;
    this.gen = 0; // bumps on every (re)configure so stale callbacks are ignored
    this.lib = null;
  }

  configure({ enabled, username, signApiKey }) {
    const u = cleanUsername(username);
    const changed = !!enabled !== this.enabled || u !== this.username || (signApiKey || "") !== this.apiKey;
    this.enabled = !!enabled && !!u;
    this.username = u;
    this.apiKey = signApiKey || "";
    if (changed) this.restart();
  }

  async loadLib() {
    if (!this.lib) this.lib = await import("tiktok-live-connector");
    return this.lib;
  }

  setState(s, err) {
    this.state = s;
    if (err !== undefined) this.lastError = err;
    this.emit("status", this.status());
  }

  stopConn() {
    clearTimeout(this.timer);
    const c = this.conn;
    this.conn = null;
    if (c) { try { c.removeAllListeners?.(); c.disconnect(); } catch {} }
  }

  restart() {
    this.gen++;
    this.stopConn();
    this.roomId = "";
    this.viewers = 0;
    if (!this.enabled) return this.setState("disabled", "");
    this.connect();
  }

  retry(ms) {
    clearTimeout(this.timer);
    const gen = this.gen;
    this.timer = setTimeout(() => gen === this.gen && this.enabled && this.connect(), ms);
  }

  async connect() {
    const gen = this.gen;
    this.setState("connecting");
    let lib;
    try {
      lib = await this.loadLib();
    } catch (e) {
      return this.setState("error", "Thiếu thư viện tiktok-live-connector — chạy: npm install");
    }
    if (gen !== this.gen) return;
    const { TikTokLiveConnection, WebcastEvent, ControlEvent } = lib;
    const conn = new TikTokLiveConnection(this.username, {
      ...(this.apiKey ? { signApiKey: this.apiKey } : {}),
      processInitialData: false,
      enableExtendedGiftInfo: false,
    });
    this.conn = conn;
    const live = () => gen === this.gen && this.conn === conn;
    const user = (d) => {
      // tiktok-live-connector 2.x moved the fields around (and some events carry the user elsewhere):
      // try every known spot; if TikTok sends no id at all, the nickname is the id (stable within a live)
      const u = d?.user || d?.userDetails || d?.member || d || {};
      const nick = u.nickname || u.nickName || u.displayName || d?.nickname || "";
      const uid = u.uniqueId || u.userId || u.id || u.secUid || u.displayId || d?.uniqueId || d?.userId || "";
      const pic = u.profilePicture || u.avatarThumb || u.avatarMedium || {};
      const avatar = pic.url?.[0] || pic.urlList?.[0] || pic.urls?.[0] || d?.profilePictureUrl || "";
      if (!this.loggedUser && process.env.DEBUG_LIVE) { this.loggedUser = true; console.log("[direct] user keys:", Object.keys(u)); }
      const name = String(nick || uid || "Ai đó").slice(0, 40);
      return {
        id: String(uid && uid !== "0" ? uid : nick ? "nick:" + nick : "unknown"),
        name,
        avatar: typeof avatar === "string" ? avatar : "",
      };
    };
    const emit = (ev) => {
      if (!live()) return;
      this.lastMessageAt = Date.now();
      this.messages++;
      this.emit("event", ev);
    };

    // tiktok-live-connector 2.5 decodes with the v3 proto: chat text is `content` (was `comment`),
    // gift info is `gift` (was `giftDetails`), likes are `count`/`total`. Keep old names as fallbacks.
    conn.on(WebcastEvent.CHAT, (d) => emit({ type: "chat", user: user(d), text: String(d.content ?? d.comment ?? "").slice(0, 200) }));
    conn.on(WebcastEvent.GIFT, (d) => {
      const g = d.gift || d.giftDetails || {};
      const gType = Number(g.type ?? g.giftType);
      if (gType === 1 && !Number(d.repeatEnd)) return; // streak still running
      const count = Number(d.repeatCount || d.comboCount) || 1;
      const each = Number(g.diamondCount) || 1;
      const img = g.image || g.icon || g.giftImage || {};
      emit({
        type: "gift", user: user(d), count, diamonds: each * count,
        gift: String(g.name || g.giftName || "quà"), giftImg: img.urlList?.[0] || img.url?.[0] || "",
      });
    });
    conn.on(WebcastEvent.LIKE, (d) => emit({ type: "like", user: user(d), count: Number(d.count ?? d.likeCount) || 1, total: Number(d.total ?? d.totalLikeCount) || 0 }));
    conn.on(WebcastEvent.FOLLOW, (d) => emit({ type: "follow", user: user(d) }));
    conn.on(WebcastEvent.SHARE, (d) => emit({ type: "share", user: user(d) }));
    conn.on(WebcastEvent.MEMBER, (d) => emit({ type: "join", user: user(d) }));
    if (WebcastEvent.SUBSCRIBE) conn.on(WebcastEvent.SUBSCRIBE, (d) => emit({ type: "subscribe", user: user(d) }));
    conn.on(WebcastEvent.ROOM_USER, (d) => {
      if (!live()) return;
      this.viewers = Number(d.total ?? d.viewerCount) || 0;
    });
    conn.on(WebcastEvent.STREAM_END, () => {
      if (!live()) return;
      this.setState("offline", "Buổi live đã kết thúc — sẽ tự kết nối lại khi bạn live tiếp");
      this.stopConn();
      this.retry(RETRY_OFFLINE_MS);
    });
    conn.on(ControlEvent.DISCONNECTED, () => {
      if (!live() || this.state === "offline") return;
      this.setState("connecting", "Mất kết nối, đang thử lại…");
      this.conn = null;
      this.retry(RETRY_DROP_MS);
    });
    conn.on(ControlEvent.ERROR, (e) => {
      if (!live()) return;
      this.lastError = String(e?.message || e?.info || e || "lỗi").slice(0, 200);
    });

    try {
      const st = await conn.connect();
      if (!live()) { try { conn.disconnect(); } catch {} return; }
      this.roomId = String(st?.roomId || "");
      this.connectedAt = Date.now();
      this.setState("connected", "");
    } catch (e) {
      if (!live()) return;
      this.conn = null;
      const name = e?.constructor?.name || "";
      const msg = String(e?.message || e || "");
      if (name === "UserOfflineError" || /offline|not.*live/i.test(msg)) {
        this.setState("offline", "@" + this.username + " chưa lên live — tự thử lại sau 30 giây");
        this.retry(RETRY_OFFLINE_MS);
      } else if (name === "InvalidUniqueIdError" || /unique ?id|user.*not.*found/i.test(msg)) {
        this.setState("error", "Không tìm thấy tài khoản @" + this.username);
      } else {
        this.setState("error", (name ? name + ": " : "") + msg.slice(0, 200));
        this.retry(RETRY_OFFLINE_MS);
      }
    }
  }

  status() {
    return {
      enabled: this.enabled,
      username: this.username,
      state: this.state,
      lastError: this.lastError,
      roomId: this.roomId,
      viewers: this.viewers,
      connectedAt: this.connectedAt,
      lastMessageAt: this.lastMessageAt,
      messages: this.messages,
      hasApiKey: !!this.apiKey,
    };
  }
}
