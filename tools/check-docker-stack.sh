#!/usr/bin/env bash
# Proves the packaged app works: starts the two images with the deploy compose
# file, using dummy settings, and checks what the proxy exposes. Used by CI, and
# runnable anywhere with Docker and openssl (it needs ports 80 and 443 free).
# Usage: IMAGE_TAG=<tag of images already built> tools/check-docker-stack.sh
# Nothing here is a secret: the key and password-like values are made up per run.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
tag="${IMAGE_TAG:?Set IMAGE_TAG to the tag of the built images}"
prefix="ghcr.io/burakata/idea-discovery-app"
work="$(mktemp -d)"
cd "$root/deploy"

failed=1
cleanup() {
  if [ "$failed" -ne 0 ]; then
    echo "::group::API logs"; docker compose logs api || true; echo "::endgroup::"
    echo "::group::Web logs"; docker compose logs web || true; echo "::endgroup::"
  fi
  docker compose down -v >/dev/null 2>&1 || true
  rm -f .env
  rm -rf "$work"
}
trap cleanup EXIT

check() { echo "OK: $1"; }
fail() { echo "::error::$1"; exit 1; }

# The data folder must be writable by the app user (uid 1654) inside the container.
mkdir "$work/data"
chmod 777 "$work/data"

# A CI-only .env: Production settings, made-up values, Caddy's own test certificate.
( umask 077
  cat > .env <<ENV
IMAGE_TAG=$tag
APP_DOMAIN=localhost
App__PublicBaseUrl=https://localhost
DATA_DIR=$work/data
Proxy__KnownProxy=172.28.7.10
Consultant__Email=consultant@example.com
Auth__TokenKey=$(openssl rand -base64 48 | tr -d '\n')
Email__Provider=Resend
Email__From=Rooms <noreply@example.com>
Email__Resend__ApiKey=re_dummy_key_nothing_is_sent_at_startup
ENV
)

docker compose up -d --pull never

echo "Waiting for https://localhost/api/health ..."
health=""
for _ in $(seq 1 40); do
  health="$(curl -ksf https://localhost/api/health || true)"
  [ -n "$health" ] && break
  sleep 3
done
[ -n "$health" ] || fail "The API did not answer at /api/health."
echo "$health" | grep -q '"status":"ok"' || fail "/api/health did not return the API's JSON: $health"
check "/api/health answers the API's JSON (settings valid, image library loaded)"

# Root paths never reach the API: they get the client's page.
for path in /health /projects /consultant/projects; do
  headers="$(curl -ks -D - -o "$work/body" "https://localhost$path")"
  echo "$headers" | grep -qi '^content-type: text/html' || fail "$path did not return HTML."
  grep -qi '<div id="root"' "$work/body" || fail "$path did not return the client page."
done
check "/health, /projects and /consultant/projects return the client page, not the API"

headers="$(curl -ks -D - -o "$work/index.html" https://localhost/)"
grep -qi '<div id="root"' "$work/index.html" || fail "/ did not return the client's index.html."
echo "$headers" | grep -qi '^strict-transport-security: max-age=31536000\s*$' \
  || fail "HSTS is missing or has extra directives (no includeSubDomains, no preload)."
echo "$headers" | grep -qi '^x-content-type-options: nosniff' || fail "X-Content-Type-Options is missing."
echo "$headers" | grep -qi '^referrer-policy: same-origin' || fail "Referrer-Policy is missing."
echo "$headers" | grep -qi '^x-frame-options: DENY' || fail "X-Frame-Options is missing."
check "/ returns the client with the security headers"

api_id="$(docker compose ps -q api)"
published="$(docker inspect -f '{{range $p, $b := .NetworkSettings.Ports}}{{if $b}}{{$p}} {{end}}{{end}}' "$api_id")"
[ -z "$published" ] || fail "The api container publishes ports: $published"
check "the api container publishes no port"

# The client files in the web image hold no demo code.
web_id="$(docker create "$prefix/web:$tag")"
docker cp "$web_id:/srv" "$work/web-files"
docker rm "$web_id" >/dev/null
"$root/tools/check-no-demo-code.sh" "$work/web-files/assets"
check "the web image's files hold no demo code"

# No secrets or local data inside either image.
unwanted='\( -name .env -o -name ".env.*" -o -name emails -o -name "*.db" -o -name "*.db-wal" -o -name "*.db-shm" \)'
found_api="$(docker run --rm --entrypoint sh "$prefix/api:$tag" -c "find /app /data $unwanted -print")"
found_web="$(docker run --rm --entrypoint sh "$prefix/web:$tag" -c "find /srv /etc/caddy $unwanted -print")"
[ -z "$found_api$found_web" ] || fail "An image holds files it must not: $found_api $found_web"
check "neither image holds .env files, an emails folder or a database"

failed=0
echo "All checks passed."
