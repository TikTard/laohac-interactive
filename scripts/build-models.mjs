// Cross-platform Blender launcher for `npm run build:models` (Windows + macOS + Linux).
// Uses $BLENDER if set, otherwise looks in the usual install locations, then falls back to `blender` on PATH.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function candidates() {
  const list = [];
  if (process.env.BLENDER) list.push(process.env.BLENDER);
  if (process.platform === "win32") {
    list.push("D:/Blender 5.2/blender.exe");
    for (const base of [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter(Boolean)) {
      const dir = path.join(base, "Blender Foundation");
      try {
        // newest version first
        for (const v of fs.readdirSync(dir).sort().reverse()) list.push(path.join(dir, v, "blender.exe"));
      } catch {}
    }
  } else if (process.platform === "darwin") {
    list.push("/Applications/Blender.app/Contents/MacOS/Blender");
    list.push(path.join(process.env.HOME || "", "Applications/Blender.app/Contents/MacOS/Blender"));
  }
  return list;
}

const found = candidates().find((p) => p && fs.existsSync(p));
const exe = found || "blender";
console.log(`Blender: ${exe}${found ? "" : " (from PATH; set BLENDER=/path/to/blender if this fails)"}`);

const r = spawnSync(exe, ["--background", "--python", path.join(ROOT, "blender", "build_all.py")], { cwd: ROOT, stdio: "inherit" });
if (r.error) {
  console.error(`Could not start Blender: ${r.error.message}\nSet the BLENDER environment variable to your Blender executable.`);
  process.exit(1);
}
process.exit(r.status ?? 1);
