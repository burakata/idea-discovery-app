# Shared helpers for update.sh and rollback.sh. Sourced, not run.
# Nothing here prints the contents of .env.

fail() { echo "ERROR: $*" >&2; exit 1; }

require_sha() {
  [[ "$1" =~ ^[0-9a-f]{40}$ ]] || fail "'$1' is not a full 40-character commit SHA."
}

require_env_file() {
  [ -f .env ] || fail ".env not found in $(pwd). Copy .env.example to .env first."
}

# get_env NAME: the value of NAME in .env (empty if not set).
get_env() {
  { grep -E "^$1=" .env || true; } | tail -n 1 | cut -d= -f2-
}

# set_env NAME VALUE: replaces the NAME line in .env (or adds it). The value is
# passed through the environment, never on a command line, and the new file is
# private (0600) from the start.
set_env() {
  local tmp
  tmp="$(umask 077; mktemp .env.XXXXXX)"
  ENV_VALUE="$2" awk -v key="$1" '
    BEGIN { FS = OFS = "=" }
    $1 == key { print key "=" ENVIRON["ENV_VALUE"]; done = 1; next }
    { print }
    END { if (!done) print key "=" ENVIRON["ENV_VALUE"] }
  ' .env > "$tmp"
  chmod 600 "$tmp"
  mv "$tmp" .env
}

# in_data SCRIPT [ARGS...]: runs a shell script as the app user, inside a throwaway
# container that has the data folder at /data. Works without sudo on the host.
# The script sees ARGS as $1, $2, ...
in_data() {
  local script="$1"
  shift
  docker compose run --rm --no-deps -T --entrypoint sh api -c "umask 077; $script" sh "$@"
}

# wait_healthy: waits up to about 2 minutes for the api container to report healthy.
wait_healthy() {
  local id status
  for _ in $(seq 1 24); do
    id="$(docker compose ps -q api)"
    if [ -n "$id" ]; then
      status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id")"
      [ "$status" = "healthy" ] && return 0
    fi
    sleep 5
  done
  echo "The API did not become healthy. Its last log lines:" >&2
  docker compose logs --tail 40 api >&2 || true
  return 1
}
