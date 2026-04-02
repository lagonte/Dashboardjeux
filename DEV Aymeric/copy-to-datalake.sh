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

    python3 - "$studio_id" "$runtime_dir" "$logs_file" <<'PY'
import sys, json, base64, os
from datetime import datetime

studio_id = sys.argv[1]
runtime_dir = sys.argv[2]
logs_file = sys.argv[3]

runtime_file = os.path.join(runtime_dir, f"{studio_id}-current-session.json")

if not os.path.exists(runtime_file):
    sys.exit(1)

with open(runtime_file, "r", encoding="utf-8") as f:
    current = json.load(f)

session_id = current.get("sessionId")
if not session_id:
    sys.exit(1)

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

name = str(match.get("name", "")).strip()
email = str(match.get("email", "")).strip().lower()
phone = str(match.get("phone", "")).strip()
created_at = str(match.get("createdAt", "")).strip()

hhmm = ""
if created_at:
    try:
        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        hhmm = dt.strftime("%H:%M")
    except Exception:
        hhmm = ""

payload = f"{name}|{email}|{phone}|{hhmm}"
encoded = base64.urlsafe_b64encode(payload.encode("utf-8")).decode("ascii").rstrip("=")

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
    if ENCODED_NAME="$(build_encoded_name_from_session "$STUDIO_ID" "$RUNTIME_DIR" "$CONTACT_LOGS" 2>/dev/null)"; then
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