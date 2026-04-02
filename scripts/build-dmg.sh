#!/bin/bash
# Build du DMG de distribution client pour DashboardJeux (macOS)
# Usage : npm run build:dmg
# Contenu du DMG : binaire + app-config.json + lanceur
# Exclus : sync.py, copy-to-datalake.sh, node_modules, sources

set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
DIST_DIR="./dist"
STAGE_DIR="$DIST_DIR/_stage"
DMG_PATH="$DIST_DIR/DashboardJeux-v${VERSION}.dmg"
VOL_NAME="DashboardJeux"

echo "▶ Build DashboardJeux v${VERSION}"

# ── 1. Compile le binaire ────────────────────────────────────────────────────
echo "  [1/4] Compilation pkg…"
npx pkg server.js --target node18-macos-arm64 --output "$DIST_DIR/DashboardJeux"

# ── 2. Prépare le dossier de staging (contenu final du DMG) ─────────────────
echo "  [2/4] Préparation du contenu…"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"

# Binaire compilé (pas de code source visible)
cp "$DIST_DIR/DashboardJeux" "$STAGE_DIR/DashboardJeux"
chmod +x "$STAGE_DIR/DashboardJeux"

# Config externe (modifiable par le client)
cp app-config.json "$STAGE_DIR/app-config.json"

# Lanceur double-cliquable (.command s'ouvre dans Terminal sur macOS)
cat > "$STAGE_DIR/Lancer DashboardJeux.command" << 'EOF'
#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Ouvre le dashboard dans le navigateur par défaut après 2s
(sleep 2 && open http://localhost:3000) &

# Lance le serveur (fenêtre Terminal visible pour les logs)
./DashboardJeux
EOF
chmod +x "$STAGE_DIR/Lancer DashboardJeux.command"

# ── 3. Vérifie que sync.py et copy-to-datalake.sh sont absents ──────────────
echo "  [3/4] Vérification des exclusions…"
if find "$STAGE_DIR" -name "sync.py" -o -name "copy-to-datalake.sh" | grep -q .; then
    echo "  ERREUR : sync.py ou copy-to-datalake.sh trouvé dans le stage !"
    exit 1
fi
echo "  sync.py et copy-to-datalake.sh : absents ✓"

# ── 4. Crée le DMG ──────────────────────────────────────────────────────────
echo "  [4/4] Création du DMG…"
rm -f "$DMG_PATH"
hdiutil create \
    -volname "$VOL_NAME" \
    -srcfolder "$STAGE_DIR" \
    -ov \
    -format UDZO \
    "$DMG_PATH"

rm -rf "$STAGE_DIR"

echo ""
echo "✅ DMG prêt : $DMG_PATH"
echo ""
echo "Contenu livré au client :"
echo "  • DashboardJeux          (binaire, code source non lisible)"
echo "  • app-config.json        (configuration studios / Companion)"
echo "  • Lancer DashboardJeux   (double-clic pour démarrer)"
echo ""
echo "Non inclus :"
echo "  ✗ sync.py"
echo "  ✗ copy-to-datalake.sh"
echo "  ✗ node_modules / sources"
