#!/bin/bash
# Build de la distribution Windows pour DashboardJeux
# Usage : npm run build:win-dist
# Contenu livré : DashboardJeux.exe + app-config.json + lanceur VBS
# Exclus : sync.py, copy-to-datalake.sh, node_modules, sources

set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
DIST_DIR="./dist"
STAGE_DIR="$DIST_DIR/_stage_win"
ZIP_PATH="$DIST_DIR/DashboardJeux-v${VERSION}-windows.zip"

echo "▶ Build Windows DashboardJeux v${VERSION}"

# ── 1. Compile le binaire Windows ────────────────────────────────────────────
echo "  [1/4] Compilation pkg…"
npx pkg server.js --target node18-win-x64 --output "$DIST_DIR/DashboardJeux.exe"

# ── 2. Prépare le dossier de staging ─────────────────────────────────────────
echo "  [2/4] Préparation du contenu…"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"

cp "$DIST_DIR/DashboardJeux.exe"       "$STAGE_DIR/DashboardJeux.exe"
cp app-config.json                      "$STAGE_DIR/app-config.json"
cp scripts/launch-windows.vbs           "$STAGE_DIR/Lancer DashboardJeux.vbs"

# ── 3. Vérification des exclusions ───────────────────────────────────────────
echo "  [3/4] Vérification des exclusions…"
if find "$STAGE_DIR" -name "sync.py" -o -name "copy-to-datalake.sh" | grep -q .; then
    echo "  ERREUR : sync.py ou copy-to-datalake.sh trouvé dans le stage !"
    exit 1
fi
echo "  sync.py et copy-to-datalake.sh : absents ✓"

# ── 4. Crée le ZIP ────────────────────────────────────────────────────────────
echo "  [4/4] Création du ZIP…"
rm -f "$ZIP_PATH"
(cd "$STAGE_DIR" && zip -r "../../$ZIP_PATH" .)

rm -rf "$STAGE_DIR"

echo ""
echo "✅ ZIP prêt : $ZIP_PATH"
echo ""
echo "Contenu livré au client :"
echo "  • DashboardJeux.exe              (binaire, code source non lisible)"
echo "  • app-config.json                (configuration studios / Companion)"
echo "  • Lancer DashboardJeux.vbs       (double-clic → démarre sans terminal)"
echo ""
echo "Non inclus :"
echo "  ✗ sync.py"
echo "  ✗ copy-to-datalake.sh"
echo "  ✗ node_modules / sources"
