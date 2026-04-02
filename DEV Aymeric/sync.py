#!/usr/bin/env python3
"""AutoCutter - Sync uploads to GCS and cleanup old files.

v2: staging + atomic move + size verification.
Files are uploaded to {user}/staging/ first, verified, then moved
atomically to {user}/uploads/ where the pipeline watches.
"""

import fcntl
import json
import os
import sys
import time
import warnings

warnings.filterwarnings("ignore")

from google.cloud import storage
from google.oauth2 import service_account

AUTOCUTTER_DIR = os.path.expanduser("~/.autocutter")
UPLOADS_DIR = os.path.join(AUTOCUTTER_DIR, "uploads")
KEY_FILE = os.path.join(AUTOCUTTER_DIR, ".sa-key.json")
LOG_FILE = "/tmp/autocutter-sync.log"
LOCK_FILE = "/tmp/autocutter-sync.lock"

USER_ID = "ce17cfbf-c7b3-4a89-8f1d-8f4c51b8e764"
BUCKET_NAME = "autocutter-data-lake-prod"
CLEANUP_DAYS = 2
MAX_RETRIES = 3
RETRY_DELAY = 10  # seconds


def log(msg):
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")


def get_client():
    with open(KEY_FILE) as f:
        sa_info = json.load(f)
    creds = service_account.Credentials.from_service_account_info(sa_info)
    return storage.Client(credentials=creds, project=sa_info.get("project_id"))


def upload_with_verification(bucket, filepath, filename):
    """Upload to staging, verify size, then atomic move to uploads/.

    Returns True if the file was uploaded and moved successfully.
    """
    local_size = os.path.getsize(filepath)
    staging_path = f"{USER_ID}/staging/{filename}"
    final_path = f"{USER_ID}/uploads/{filename}"

    staging_blob = bucket.blob(staging_path)

    # Step 1: Upload to staging with explicit timeout (30min for large files)
    log(f"  [1/3] Uploading to staging ({local_size:,} bytes)...")
    staging_blob.upload_from_filename(filepath, timeout=1800)

    # Step 2: Verify size on GCS matches local
    staging_blob.reload()
    remote_size = staging_blob.size

    if remote_size != local_size:
        log(f"  [2/3] SIZE MISMATCH: local={local_size:,} vs gcs={remote_size:,}")
        staging_blob.delete()
        return False

    log(f"  [2/3] Size verified: {remote_size:,} bytes OK")

    # Step 3: Atomic move staging -> uploads (server-side, no re-upload)
    final_blob = bucket.blob(final_path)
    final_blob.rewrite(staging_blob)
    staging_blob.delete()
    log(f"  [3/3] Moved to uploads/ OK")

    return True


def upload_new_files(client):
    """Upload files that don't have an .uploaded marker."""
    bucket = client.bucket(BUCKET_NAME)

    for filename in sorted(os.listdir(UPLOADS_DIR)):
        filepath = os.path.join(UPLOADS_DIR, filename)
        if (
            not os.path.isfile(filepath)
            or filename.startswith(".")
            or filename.endswith(".partial")
        ):
            continue

        marker = os.path.join(UPLOADS_DIR, f".{filename}.uploaded")
        if os.path.exists(marker):
            continue

        log(f"Uploading: {filename}")

        success = False
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                success = upload_with_verification(bucket, filepath, filename)
                if success:
                    break
                log(
                    f"  Attempt {attempt}/{MAX_RETRIES} failed (size mismatch), retrying in {RETRY_DELAY}s..."
                )
            except Exception as e:
                log(f"  Attempt {attempt}/{MAX_RETRIES} error: {e}")
                # Clean up partial staging blob on failure
                try:
                    bucket.blob(f"{USER_ID}/staging/{filename}").delete()
                except Exception:
                    pass

            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY)

        if success:
            with open(marker, "w") as f:
                f.write(str(time.time()))
            log(f"Uploaded OK: {filename}")
        else:
            log(f"FAILED after {MAX_RETRIES} attempts: {filename}")


def cleanup_old_files():
    """Delete local files uploaded more than CLEANUP_DAYS days ago."""
    now = time.time()
    cutoff = now - (CLEANUP_DAYS * 86400)

    for filename in os.listdir(UPLOADS_DIR):
        if not filename.startswith(".") or not filename.endswith(".uploaded"):
            continue

        marker_path = os.path.join(UPLOADS_DIR, filename)
        try:
            with open(marker_path) as f:
                upload_time = float(f.read().strip())
        except (ValueError, OSError):
            continue

        if upload_time > cutoff:
            continue

        # Extract original filename from marker: .XXXXX.uploaded -> XXXXX
        original = filename[1:-9]  # strip leading . and trailing .uploaded
        original_path = os.path.join(UPLOADS_DIR, original)

        if os.path.exists(original_path):
            os.remove(original_path)
            log(f"Cleanup: deleted {original} (uploaded {CLEANUP_DAYS}+ days ago)")
        os.remove(marker_path)


def sync():
    client = get_client()
    upload_new_files(client)
    cleanup_old_files()


def sync_with_lock():
    """Exécute sync() avec un verrou exclusif.
    Si une autre instance tourne déjà, on attend qu'elle se termine
    puis on s'exécute à notre tour (file d'attente implicite).
    """
    with open(LOCK_FILE, "w") as lockf:
        log("En attente du verrou...")
        fcntl.flock(lockf, fcntl.LOCK_EX)   # bloquant : attend si nécessaire
        log("Verrou acquis, démarrage du sync.")
        sync()
        # Le verrou est libéré automatiquement à la fermeture du fichier


def main():
    print("AutoCutter GCS Sync v2")
    print(f"  Source:  {UPLOADS_DIR}")
    print(f"  Staging: gs://{BUCKET_NAME}/{USER_ID}/staging/")
    print(f"  Dest:    gs://{BUCKET_NAME}/{USER_ID}/uploads/")
    print(f"  Cleanup: {CLEANUP_DAYS} days")
    print()

    if len(sys.argv) > 1 and sys.argv[1] == "--watch":
        print("Watch mode - syncing every 30 seconds. Ctrl+C to stop.")
        while True:
            try:
                sync_with_lock()
            except Exception as e:
                log(f"ERROR: {e}")
            time.sleep(30)
    else:
        sync_with_lock()


if __name__ == "__main__":
    main()
