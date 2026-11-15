import { EventEmitter } from "node:events";
import WebSocket from "ws";

/**
 * Client for the TikFinity desktop app's local WebSocket API (default ws://localhost:21213/).
 * TikFinity forwards TikTok LIVE events as JSON, typically { event: "gift", data: {...} }
 * with TikTok-Live-Connector style fields. normalize() is deliberately tolerant.
 */
export class TikFinityClient extends EventEmitter {
  constructor() {
    super();
    this.url = "";
    this.enabled = false;
    this.ws = null;
    this.state = "disconnected"; // disconnected | connecting | connected | error | disabled
    this.lastError = "";
    this.connectedAt = 0;
    this.lastMessageAt = 0;
    this.messages = 0;
    this.reconnects = 0;
    this.timer = null;
  }

  configure({ enabled, url }) {
    const changed = url !== this.url || enabled !== this.enabled;
    this.url = url;
    this.enabled = enabled;
    if (changed) this.restart();
  }

  restart() {
    clearTimeout(this.timer);
    if (this.ws) {
      this.ws.removeAllListeners();
      try { this.ws.terminate(); } catch {}
      this.ws = null;
    }
    if (!this.enabled) return this.setState("disabled");
    this.connect();
  }

  setState(s, err = "") {
    this.state = s;
    if (err) this.lastError = err;
    this.emit("status", this.status());
  }

  connect() {
    this.setState("connecting");
    let ws;
    try {
      ws = new WebSocket(this.url, { handshakeTimeout: 5000 });
    } catch (e) {
      this.setState("error", e.message);
      return this.scheduleReconnect();
    }
    this.ws = ws;
    ws.on("open", () => {
      this.connectedAt = Date.now();
      this.lastError = "";
      this.setState("connected");
    });
    ws.on("message", (buf) => {
      this.lastMessageAt = Date.now();
      this.messages++;
      let msg;
      try { msg = JSON.parse(buf.toString()); } catch { return; }
      this.emit("raw", msg);
      const ev = normalize(msg);
      if (ev) this.emit("event", ev);
    });
    ws.on("error", (e) => {
      const code = e.code || e.errors?.[0]?.code || "";
      const msg = code === "ECONNREFUSED"
        ? "Không kết nối được tới TikFinity (ECONNREFUSED) — TikFinity desktop chưa mở, hoặc sai cổng"
        : [code, e.message].filter(Boolean).join(" ") || String(e);
      this.setState("error", msg);
    });
    ws.on("close", () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.state !== "error") this.setState("disconnected");
      this.scheduleReconnect();
    });
  }

  scheduleReconnect() {
    clearTimeout(this.timer);
    if (!this.enabled) return;
    this.timer = setTimeout(() => {
      this.reconnects++;
      this.connect();
    }, 3000);
  }

  status() {
    return {
      state: this.state,
      url: this.url,
      enabled: this.enabled,
      lastError: this.lastError,
      connectedAt: this.connectedAt,
      lastMessageAt: this.lastMessageAt,
      messages: this.messages,
      reconnects: this.reconnects,
    };
  }
}

function pickUser(d) {
  const u = d.user || d.userDetails || {};
  const id = d.uniqueId || u.uniqueId || d.userId || u.userId || d.username || d.nickname || "unknown";
  const name = d.nickname || u.nickname || d.uniqueId || u.uniqueId || d.username || "Ai đó";
  const avatar =
    d.profilePictureUrl || u.profilePictureUrl || u.profilePictureUrls?.[0] ||
    d.userDetails?.profilePictureUrls?.[0] || d.avatar || "";
  return { id: String(id), name: String(name).slice(0, 40), avatar };
}

export function normalize(msg) {
  if (!msg || typeof msg !== "object") return null;
  const kind = String(msg.event || msg.type || msg.eventType || msg.name || "").toLowerCase();
  const d = msg.data && typeof msg.data === "object" ? msg.data : msg;
  const user = pickUser(d);
  switch (kind) {
    case "gift": {
      // streakable gifts send many events; only act on the final one
      if (Number(d.giftType) === 1 && d.repeatEnd === false) return null;
      const count = Number(d.repeatCount || d.count || d.amount || 1) || 1;
      const each = Number(d.diamondCount ?? d.giftDetails?.diamondCount ?? d.coins ?? d.diamonds ?? 1) || 1;
      return {
        type: "gift", user, count,
        gift: String(d.giftName || d.giftDetails?.giftName || d.gift || "quà"),
        giftImg: d.giftPictureUrl || d.giftDetails?.giftImage?.giftPictureUrl || "",
        diamonds: each * count,
      };
    }
    case "chat":
    case "comment":
      return { type: "chat", user, text: String(d.comment ?? d.text ?? d.message ?? "").slice(0, 200) };
    case "like":
      return { type: "like", user, count: Number(d.likeCount || d.count || 1) || 1, total: Number(d.totalLikeCount || 0) };
    case "follow":
      return { type: "follow", user };
    case "share":
      return { type: "share", user };
    case "social": {
      const t = String(d.displayType || d.label || "").toLowerCase();
      if (t.includes("follow")) return { type: "follow", user };
      if (t.includes("share")) return { type: "share", user };
      return null;
    }
    case "member":
    case "join":
      return { type: "join", user };
    case "subscribe":
      return { type: "subscribe", user };
    default:
      return null;
  }
}
