/**
 * Meme costumes viewers pick by chat ("đổi ếch", "#mèo", "skin cá mập"; just "đổi" = a random one).
 * Pure data, shared by the server (which decides and remembers each viewer's costume) and the game (skins.js builds them).
 */
export const SKINS = [
  { id: "ech", name: "Ếch Xanh", emoji: "🐸", keys: ["ech", "coc", "frog"] },
  { id: "meo", name: "Mèo Hoàng Thượng", emoji: "🐱", keys: ["meo", "cat"] },
  { id: "ga", name: "Gà Trống Gáy", emoji: "🐓", keys: ["ga", "gatrong", "chicken"] },
  { id: "camap", name: "Cá Mập Con", emoji: "🦈", keys: ["camap", "shark"] },
  { id: "capy", name: "Capybara Chill", emoji: "🦫", keys: ["capy", "capybara", "chuotlang"] },
  { id: "heo", name: "Heo Hồng", emoji: "🐷", keys: ["heo", "lon", "pig"] },
  { id: "ngau", name: "Dân Chơi Kính Đen", emoji: "😎", keys: ["ngau", "kinh", "kinhden", "danchoi", "cool"] },
  { id: "chuoi", name: "Quả Chuối", emoji: "🍌", keys: ["chuoi", "banana"] },
  { id: "dua", name: "Đầu Dứa", emoji: "🍍", keys: ["dua", "thom", "pineapple"] },
  { id: "ma", name: "Ma Trắng", emoji: "👻", keys: ["ma", "ghost"] },
  { id: "he", name: "Chú Hề", emoji: "🤡", keys: ["he", "chuhe", "clown"] },
  { id: "ninja", name: "Ninja Làng", emoji: "🥷", keys: ["ninja"] },
  { id: "sieunhan", name: "Siêu Nhân Làng", emoji: "🦸", keys: ["sieunhan", "hero"] },
  { id: "phihanh", name: "Phi Hành Gia", emoji: "🧑‍🚀", keys: ["phihanhgia", "phihanh", "vutru", "astronaut"] },
  { id: "caoboi", name: "Cao Bồi", emoji: "🤠", keys: ["caoboi", "cowboy"] },
  { id: "", name: "Dân Làng", emoji: "👕", keys: ["danlang", "goc", "binhthuong", "bo"] },
];

export const stripText = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d");

const TRIGGER = /^\s*(?:#|doi|bien|skin|hoa|thanh)\s*(?:nhan vat|thanh|sang|lam|ve)?\s*(.*)$/;

/**
 * Is this chat line a costume command? Returns null (not a command), a skin id ("" = back to normal villager),
 * or "?" (asked to change, no / unknown costume named: the caller picks a random one).
 */
export function parseSkin(text) {
  const t = stripText(text).trim();
  const m = t.match(TRIGGER);
  if (!m) return null;
  const want = m[1].replace(/[^a-z0-9]/g, "");
  if (!want) return "?";
  for (const s of SKINS) if (s.keys.some((k) => want === k || want.startsWith(k) && k.length >= 3)) return s.id;
  return t.startsWith("#") || t.startsWith("skin") ? "?" : null; // "đổi gì đó lạ" is just chat
}

export const skinById = (id) => SKINS.find((s) => s.id === id) || null;
