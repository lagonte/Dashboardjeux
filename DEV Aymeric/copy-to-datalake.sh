#!/bin/bash
# AutoCutter - Copy recording to data lake folder
# Usage (Softron post-recording script):
#   /Users/regiemerciinternet/.autocutter/copy-to-datalake.sh "/path/to/recording.mp4"

set -euo pipefail

DATALAKE_DIR="$HOME/.autocutter/uploads"
LOG_FILE="/tmp/autocutter-copy.log"
CONTACT_LOGS="$HOME/Desktop/Merci Internet/Automatisateur/logs.json"
AUTOMATISATEUR_DIR="$HOME/Desktop/Merci Internet/Automatisateur"
CONTACT_LOGS="$AUTOMATISATEUR_DIR/logs.json"
RUNTIME_DIR="$AUTOMATISATEUR_DIR/runtime"

# Attendre que le fichier soit stable (taille constante pendant 10s)
wait_for_stable_file() {
    local file="$1"
    local stable_count=0
    local prev_size=-1
    local attempts=0
    local max_attempts=30

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Waiting for file to stabilize: $file" | tee -a "$LOG_FILE"

    while [[ $stable_count -lt 3 ]]; do
        if [[ $attempts -ge $max_attempts ]]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] TIMEOUT: file never stabilized, aborting." | tee -a "$LOG_FILE"
            exit 1
        fi

        local curr_size
        curr_size=$(stat -f%z "$file" 2>/dev/null || echo -1)

        if [[ "$curr_size" == "$prev_size" && "$curr_size" -gt 0 ]]; then
            (( stable_count++ )) || true
        else
            stable_count=0
        fi

        prev_size="$curr_size"
        (( attempts++ )) || true
        sleep 10
    done

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] File stable at ${prev_size} bytes." | tee -a "$LOG_FILE"
}

extract_studio_from_filename() {
    local filename="$1"

    if [[ "$filename" =~ ST4b|ST4B ]]; then
        echo "ST4B"
        return
    elif [[ "$filename" =~ ST4 ]]; then
        echo "ST4"
        return
    elif [[ "$filename" =~ ST3 ]]; then
        echo "ST3"
        return
    elif [[ "$filename" =~ ST2 ]]; then
        echo "ST2"
        return
    elif [[ "$filename" =~ ST1 ]]; then
        echo "ST1"
        return
    fi

    echo ""
}

build_encoded_name_from_session() {
    local studio_id="$1"
    local runtime_dir="$2"
    local logs_file="$3"
    local filename="$4"

    python3 - "$studio_id" "$runtime_dir" "$logs_file" "$filename" <<'PY'
import sys, json, base64, os, re
from datetime import datetime, timezone, timedelta

studio_id  = sys.argv[1]
runtime_dir = sys.argv[2]
logs_file  = sys.argv[3]
filename   = sys.argv[4]

# ── Parse le timestamp depuis le nom du fichier ──────────────────────────────
# Format attendu : "November_30_Session_de_11_42 - ST1.mp4"
recording_start = None
m = re.search(r'(\w+)_(\d+)_Session_de_(\d+)_(\d+)', filename)
if m:
    MONTHS = {
        'January':1,'February':2,'March':3,'April':4,
        'May':5,'June':6,'July':7,'August':8,
        'September':9,'October':10,'November':11,'December':12
    }
    month = MONTHS.get(m.group(1))
    if month:
        now = datetime.now(timezone.utc)
        try:
            recording_start = datetime(
                now.year, month, int(m.group(2)),
                int(m.group(3)), int(m.group(4)),
                tzinfo=timezone.utc
            )
            # Si la date semble dans le futur (ex: décembre lu en janvier)
            if recording_start > now + timedelta(hours=1):
                recording_start = recording_start.replace(year=now.year - 1)
        except ValueError:
            recording_start = None

# ── Lecture session runtime ───────────────────────────────────────────────────
runtime_file = os.path.join(runtime_dir, f"{studio_id}-current-session.json")
if not os.path.exists(runtime_file):
    sys.exit(1)

with open(runtime_file, "r", encoding="utf-8") as f:
    current = json.load(f)

# ── Validation temporelle : l'enregistrement doit être dans la fenêtre session ──
if recording_start:
    started_at_str = current.get("createdAt", "")
    expires_at_str = current.get("expiresAt", "")
    try:
        started_at = datetime.fromisoformat(started_at_str.replace("Z", "+00:00"))
        expires_at = (
            datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
            if expires_at_str
            else started_at + timedelta(hours=1)
        )
        if not (started_at <= recording_start <= expires_at):
            sys.exit(1)
    except Exception:
        pass  # dates non parsables → on continue sans validation temporelle

session_id = current.get("sessionId")
if not session_id:
    sys.exit(1)

# ── Recherche dans les logs ───────────────────────────────────────────────────
if not os.path.exists(logs_file):
    sys.exit(1)

match = None
with open(logs_file, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except Exception:
            continue
        if obj.get("sessionId") == session_id:
            match = obj
            break

if not match:
    sys.exit(1)

# ── Nettoyage : retire les backticks (délimiteur réservé du pipeline) ─────────
def clean(s):
    return str(s).strip().replace("`", "")

name       = clean(match.get("name", ""))
email      = clean(match.get("email", "")).lower()
phone      = str(match.get("phone", "")).strip()   # format international, pas de nettoyage
created_at = str(match.get("createdAt", "")).strip()

# Champ 4 — Heure HH:MM
hhmm = ""
if created_at:
    try:
        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        hhmm = dt.strftime("%H:%M")
    except Exception:
        hhmm = ""

# Champ 5 — Salle = identifiant du studio (ex: ST1, ST2, ST4B)
salle = clean(current.get("studioId", studio_id))

# Champ 6 — Caméra (non géré par le dashboard, vide)
camera = ""

# Champ 7 — Trims (non géré par le dashboard, vide)
trims = ""

# ── Encodage base64 standard, sans padding, safe pour les noms de fichiers ──
# Format : nom|email|téléphone|heure|salle|caméra|trims
payload = f"{name}|{email}|{phone}|{hhmm}|{salle}|{camera}|{trims}"
raw = base64.b64encode(payload.encode("utf-8")).decode("ascii").rstrip("=")
# '/' est invalide dans un nom de fichier macOS/Linux → remplacé par '_'
# Le pipeline Autocutter doit gérer ce remplacement côté décodage
encoded = raw.replace("/", "_")

# Vérification limite : ~188 bytes raw = 251 chars base64 (sans padding) + 4 (.mp4) = 255
if len(encoded) > 251:
    # Troncature : on retire l'email en priorité (champ le plus lourd)
    payload_no_email = f"{name}||{phone}|{hhmm}|{salle}|{camera}|{trims}"
    raw = base64.b64encode(payload_no_email.encode("utf-8")).decode("ascii").rstrip("=")
    encoded = raw.replace("/", "_")

print(encoded)
PY
}

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <file_path>"
    exit 1
fi

SOURCE="$1"

if [[ ! -f "$SOURCE" ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] File not found: $SOURCE" | tee -a "$LOG_FILE"
    exit 1
fi

wait_for_stable_file "$SOURCE"

# Vérification de l'intégrité MP4 via ffprobe
if command -v ffprobe &>/dev/null; then
    if ! ffprobe -v error -select_streams v:0 -show_entries stream=codec_name \
         -of default=noprint_wrappers=1 "$SOURCE" &>/dev/null; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARN: ffprobe check failed on $SOURCE, aborting copy." | tee -a "$LOG_FILE"
        exit 1
    fi
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ffprobe OK." | tee -a "$LOG_FILE"
fi

FILENAME="$(basename "$SOURCE")"
STUDIO_ID="$(extract_studio_from_filename "$FILENAME")"
ENCODED_NAME=""

if [[ -n "$STUDIO_ID" ]]; then
    if ENCODED_NAME="$(build_encoded_name_from_session "$STUDIO_ID" "$RUNTIME_DIR" "$CONTACT_LOGS" "$FILENAME" 2>/dev/null)"; then
        DEST_NAME="${ENCODED_NAME}.mp4"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Session metadata found for $STUDIO_ID -> $DEST_NAME" | tee -a "$LOG_FILE"
    fi
fi

# Fallback si aucun contact/log trouvé
if [[ -z "$ENCODED_NAME" ]]; then
    SANITIZED="$(echo "$FILENAME" | sed 's/[^a-zA-Z0-9._-]/_/g')"
    TIMESTAMP_MS="$(python3 -c 'import time; print(int(time.time() * 1000))')"
    DEST_NAME="${TIMESTAMP_MS}_${SANITIZED}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] No metadata found, fallback name: $DEST_NAME" | tee -a "$LOG_FILE"
fi

cp "$SOURCE" "$DATALAKE_DIR/${DEST_NAME}.partial"
mv "$DATALAKE_DIR/${DEST_NAME}.partial" "$DATALAKE_DIR/$DEST_NAME"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Copied: $FILENAME -> $DATALAKE_DIR/$DEST_NAME" | tee -a "$LOG_FILE"