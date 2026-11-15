/**
 * Text-to-speech providers. Each returns a Buffer of MP3 audio.
 *  - google:     free, no key (unofficial Google Translate voice, female)
 *  - fpt:        FPT.AI, Vietnamese voices incl. male "leminh" (northern) - needs API key
 *  - elevenlabs: needs API key + voice id (pick an old-man voice in their library)
 *  - openai:     needs API key; "instructions" steer the old-man delivery
 *  - browser / off: server returns 204, the game uses the browser voice or stays silent
 */
const cache = new Map();
const CACHE_MAX = 300;
export const ttsStats = { requests: 0, cacheHits: 0, errors: 0, lastError: "", lastMs: 0, lastProvider: "" };

export function cleanText(s) {
  return String(s || "")
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/[_*#@~^<>|\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

function chunks(text, max = 180) {
  const words = text.split(" ");
  const out = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      if (cur) out.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  return out;
}

async function google(text) {
  const parts = [];
  for (const c of chunks(text)) {
    const url = "https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=" + encodeURIComponent(c);
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (LaoHacGame)" } });
    if (!r.ok) throw new Error("google " + r.status);
    parts.push(Buffer.from(await r.arrayBuffer()));
  }
  return Buffer.concat(parts);
}

async function fpt(text, c) {
  if (!c.fptApiKey) throw new Error("FPT.AI chưa có API key");
  const r = await fetch("https://api.fpt.ai/hmi/tts/v5", {
    method: "POST",
    headers: { "api-key": c.fptApiKey, voice: c.fptVoice || "leminh", speed: "", format: "mp3" },
    body: text,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.async) throw new Error("fpt " + r.status + " " + (j.message || ""));
  for (let i = 0; i < 20; i++) {
    await new Promise((res) => setTimeout(res, 400));
    const a = await fetch(j.async);
    if (a.ok && (a.headers.get("content-type") || "").includes("audio")) return Buffer.from(await a.arrayBuffer());
  }
  throw new Error("fpt: audio not ready");
}

async function elevenlabs(text, c) {
  if (!c.elevenApiKey || !c.elevenVoiceId) throw new Error("ElevenLabs thiếu API key hoặc voice id");
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${c.elevenVoiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": c.elevenApiKey, "Content-Type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: c.elevenModel || "eleven_flash_v2_5", language_code: "vi" }),
  });
  if (!r.ok) throw new Error("elevenlabs " + r.status + " " + (await r.text()).slice(0, 120));
  return Buffer.from(await r.arrayBuffer());
}

async function openai(text, c) {
  if (!c.openaiApiKey) throw new Error("OpenAI chưa có API key");
  const r = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${c.openaiApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: c.openaiModel || "gpt-4o-mini-tts",
      voice: c.openaiVoice || "ash",
      input: text,
      instructions: c.openaiInstructions || "",
      response_format: "mp3",
    }),
  });
  if (!r.ok) throw new Error("openai " + r.status + " " + (await r.text()).slice(0, 120));
  return Buffer.from(await r.arrayBuffer());
}

const PROVIDERS = { google, fpt, elevenlabs, openai };

/** Returns { audio: Buffer, provider } or null when the browser should speak / stay silent. */
export async function synthesize(rawText, baseConfig, who = "lao") {
  const text = cleanText(rawText);
  const ttsConfig = who === "npc"
    ? { ...baseConfig,
        fptVoice: baseConfig.npcFptVoice || baseConfig.fptVoice,
        openaiVoice: baseConfig.npcOpenaiVoice || baseConfig.openaiVoice,
        elevenVoiceId: baseConfig.npcElevenVoiceId || baseConfig.elevenVoiceId,
        openaiInstructions: "Giọng đàn ông trung niên miền Bắc Việt Nam, rõ ràng, có cảm xúc, hơi kịch tính." }
    : baseConfig;
  const provider = ttsConfig.provider;
  if (!text || !PROVIDERS[provider]) return null;
  ttsStats.requests++;
  const key = provider + "|" + (ttsConfig.fptVoice || "") + (ttsConfig.elevenVoiceId || "") + (ttsConfig.openaiVoice || "") + "|" + text;
  if (cache.has(key)) {
    ttsStats.cacheHits++;
    return cache.get(key);
  }
  const t0 = Date.now();
  let result;
  try {
    result = { audio: await PROVIDERS[provider](text, ttsConfig), provider };
  } catch (e) {
    ttsStats.errors++;
    ttsStats.lastError = `${provider}: ${e.message}`;
    if (provider === "google") throw e;
    result = { audio: await google(text), provider: "google (dự phòng)" }; // fallback
  }
  ttsStats.lastMs = Date.now() - t0;
  ttsStats.lastProvider = result.provider;
  cache.set(key, result);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return result;
}
