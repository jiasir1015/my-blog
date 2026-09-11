#!/usr/bin/env bash
# Start Hugo + local Markdown editor API together.
set -euo pipefail
cd "$(dirname "$0")"

EDITOR_PORT="${EDITOR_PORT:-1314}"
HUGO_PORT="${HUGO_PORT:-1313}"

# Kill any process currently listening on a TCP port (macOS / Linux).
kill_port() {
  local port="$1"
  local label="$2"
  local pids=""

  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -nP -iTCP:"${port}" -sTCP:LISTEN -t 2>/dev/null || true)"
  fi

  if [[ -z "${pids}" ]]; then
    return 0
  fi

  echo "==> ${label} 已在端口 ${port} 运行 (PID: ${pids//$'\n'/ })，先关闭…"
  # shellcheck disable=SC2086
  kill ${pids} 2>/dev/null || true

  # Wait until the port is free (up to ~3s), then force-kill if needed.
  local i
  for i in 1 2 3 4 5 6; do
    if ! lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "==> 端口 ${port} 已释放"
      return 0
    fi
    sleep 0.5
  done

  pids="$(lsof -nP -iTCP:"${port}" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    echo "==> 强制结束端口 ${port} 上的进程…"
    # shellcheck disable=SC2086
    kill -9 ${pids} 2>/dev/null || true
    sleep 0.3
  fi
}

cleanup() {
  [[ -n "${EDITOR_PID:-}" ]] && kill "$EDITOR_PID" 2>/dev/null || true
  [[ -n "${HUGO_PID:-}" ]] && kill "$HUGO_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

kill_port "$EDITOR_PORT" "编辑服务"
kill_port "$HUGO_PORT" "Hugo"

echo "==> editor API on http://127.0.0.1:${EDITOR_PORT}"
EDITOR_PORT="$EDITOR_PORT" node editor-server/server.js &
EDITOR_PID=$!

# Wait briefly for API
for _ in 1 2 3 4 5; do
  if curl -sf "http://127.0.0.1:${EDITOR_PORT}/api/health" >/dev/null; then
    break
  fi
  sleep 0.2
done

echo "==> Hugo on http://localhost:${HUGO_PORT}"
echo "==> 写作台: http://localhost:${HUGO_PORT}/admin/"
hugo server -D --bind 127.0.0.1 --port "$HUGO_PORT" --disableFastRender &
HUGO_PID=$!

wait "$HUGO_PID"
