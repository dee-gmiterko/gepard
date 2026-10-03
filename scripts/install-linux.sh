#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

version="$(jq -r .version src/app/package.json)"
appimage="src/app/dist/gepard-${version}.AppImage"

if [[ ! -f "$appimage" ]]; then
  echo "Missing $appimage, run 'yarn build:linux' first." >&2
  exit 1
fi

bin_dir="$HOME/.local/bin"
apps_dir="$HOME/.local/share/applications"
icons_dir="$HOME/.local/share/icons/hicolor"

install -Dm755 "$appimage" "$bin_dir/gepard"
install -Dm644 src/app/build/icon.png "$icons_dir/512x512/apps/gepard.png"

mkdir -p "$apps_dir"
cat >"$apps_dir/io.github.dee-gmiterko.gepard.desktop" <<EOF
[Desktop Entry]
Name=Gepard
Comment=Gepard - Great Pull Request Review Tool
Exec=$bin_dir/gepard --no-sandbox %U
Terminal=false
Type=Application
Icon=gepard
StartupWMClass=io.github.dee-gmiterko.gepard
Categories=Utility;
EOF

update-desktop-database "$apps_dir" 2>/dev/null || true
gtk-update-icon-cache -f -t "$icons_dir" 2>/dev/null || true
