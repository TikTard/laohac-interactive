#!/bin/bash
# Lao Hac game - macOS launcher (double-click in Finder; first time: chmod +x start.command)
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Chua cai Node.js. Tai tai https://nodejs.org (ban macOS) roi chay lai."
  read -r -p "Nhan Enter de dong..." _
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Dang cai thu vien lan dau..."
  npm install || { read -r -p "Nhan Enter de dong..." _; exit 1; }
fi
(sleep 2 && open "http://127.0.0.1:3939/admin/") &
node server/index.js
