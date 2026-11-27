#!/usr/bin/env bash
# Goes back to the previous build and the database copy taken by update.sh.
# Usage (from this folder): ./rollback.sh <previous-commit-sha> [--yes]
#
# A rollback is a security event. Everything people did after the copy is lost,
# and sign-in links and sessions made since could otherwise still work. So this
# script also:
#  - sets a new Auth__TokenKey in .env. Sign-in links are stored only as a keyed
#    hash of the link under that key, so every unused link stops matching.
#  - deletes the Data Protection keys. A session cookie and the antiforgery token
#    are protected with those keys, so every cookie in every browser stops being
#    readable and everyone must sign in again. (The restored database also no
#    longer holds the sessions created after the copy.)
set -euo pipefail
cd "$(dirname "$0")"
. ./lib.sh

old_tag="${1:?Usage: ./rollback.sh <previous-commit-sha> [--yes]}"
require_sha "$old_tag"
require_env_file
command -v openssl >/dev/null || fail "openssl is needed to make the new token key."

echo "Looking for the newest pre-update database copy..."
backup="$(in_data 'ls -1t /data/backups/pre-update-*.db 2>/dev/null | head -n 1 || true')"
backup="${backup%$'\r'}"
[ -n "$backup" ] || fail "There is no pre-update copy in the data folder's backups. Nothing was changed."
echo "Newest copy: $backup"
echo
echo "This will:"
echo "  - go back to build $old_tag"
echo "  - replace the database with that copy (later changes are kept aside, not deleted)"
echo "  - make every unused sign-in link stop working"
echo "  - sign everyone out"
if [ "${2:-}" != "--yes" ]; then
  read -r -p "Type yes to continue: " answer
  [ "$answer" = "yes" ] || fail "Cancelled. Nothing was changed."
fi

echo "1/5 Stopping the API..."
docker compose stop api

echo "2/5 Restoring the database copy..."
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
in_data '
  set -e
  # Keep what is being replaced, in case it is needed to investigate.
  mv /data/idea-discovery.db "/data/backups/rolled-back-$2.db" 2>/dev/null || true
  if [ -f /data/idea-discovery.db-wal ]; then mv /data/idea-discovery.db-wal "/data/backups/rolled-back-$2.db-wal"; fi
  rm -f /data/idea-discovery.db-shm
  cp "$1" /data/idea-discovery.db
  if [ -f "$1-wal" ]; then cp "$1-wal" /data/idea-discovery.db-wal; fi
  echo "Restored $1"
  echo "The replaced database is kept as /data/backups/rolled-back-$2.db (delete it when not needed)."
' "$backup" "$stamp"

echo "3/5 Making every unused sign-in link stop working (new Auth__TokenKey)..."
set_env Auth__TokenKey "$(openssl rand -base64 48 | tr -d '\n')"

echo "4/5 Signing everyone out (deleting the Data Protection keys)..."
in_data 'rm -rf /data/keys && mkdir -m 700 /data/keys'

echo "5/5 Starting build $old_tag..."
set_env IMAGE_TAG "$old_tag"
docker compose up -d
wait_healthy || fail "The API did not become healthy after the rollback."

echo
echo "Done. The server runs $old_tag with the database copy $backup."
echo "All sign-in links made before now are dead and everyone is signed out."
echo "Ask people to request a new link; Burak can copy links on the People screen."
