#!/usr/bin/env bash
# Moves the server to a new build, keeping a copy of the database first.
# Usage (from this folder): ./update.sh <full-commit-sha>
# The new images must already be published (CI pushes them when a change is
# merged to main). Prints the previous tag, which rollback.sh needs.
set -euo pipefail
cd "$(dirname "$0")"
. ./lib.sh

new_tag="${1:?Usage: ./update.sh <full-commit-sha>}"
require_sha "$new_tag"
require_env_file

previous_tag="$(get_env IMAGE_TAG)"
[ -n "$previous_tag" ] || fail "IMAGE_TAG is empty in .env."
[ "$previous_tag" != "$new_tag" ] || fail "The server already runs $new_tag."

echo "1/5 Downloading the new images (the app keeps running meanwhile)..."
IMAGE_TAG="$new_tag" docker compose pull

echo "2/5 Stopping the API, so the database file is consistent..."
docker compose stop api

echo "3/5 Copying the database..."
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
in_data '
  # Stop at the first failure: a failed copy must never be followed by deleting an
  # older copy or starting the new version.
  set -e
  if [ ! -f /data/idea-discovery.db ]; then
    echo "No database yet, nothing to copy."
    exit 0
  fi
  mkdir -p /data/backups
  rm -f /data/backups/*.partial
  copy="/data/backups/pre-update-$1-$2.db"
  # A write-ahead file left after the stop belongs to the copy too.
  if [ -s /data/idea-discovery.db-wal ]; then cp /data/idea-discovery.db-wal "$copy-wal"; fi
  # Written under another name and renamed last, so a partial copy is never
  # taken for the newest one.
  cp /data/idea-discovery.db "$copy.partial"
  mv "$copy.partial" "$copy"
  echo "Saved $copy"
  # Keep only the newest two copies.
  ls -1t /data/backups/pre-update-*.db | tail -n +3 | while read -r old; do
    rm -f "$old" "$old-wal"
    echo "Deleted the older copy $old"
  done
' "$new_tag" "$stamp" || {
  echo "ERROR: the database copy failed. Nothing else was changed, and the API is stopped." >&2
  echo "Start it again with: docker compose up -d" >&2
  exit 1
}

echo "4/5 Switching to $new_tag and starting..."
set_env IMAGE_TAG "$new_tag"
docker compose up -d

echo "5/5 Waiting for the API to be healthy..."
if ! wait_healthy; then
  echo "The update did not start cleanly. To go back: ./rollback.sh $previous_tag" >&2
  exit 1
fi

echo
echo "Done. The server now runs $new_tag."
echo "Previous tag (for rollback): $previous_tag"
echo "To go back: ./rollback.sh $previous_tag"
