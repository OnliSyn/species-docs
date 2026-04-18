#!/bin/sh
set -e

echo "[entrypoint] Starting Onli Synth..."

MSB_ORIGIN="${MARKETSB_URL:-http://127.0.0.1:3101}"
SP_ORIGIN="${SPECIES_URL:-http://127.0.0.1:3102}"
export MARKETSB_URL="$MSB_ORIGIN"
export SPECIES_URL="$SP_ORIGIN"

# Next binds :8080 first so Fly machine checks see a listener while sims boot.
# /api/health returns 503 until sims are up (see fly.toml http_service.checks grace_period).
echo "[entrypoint] Starting Next.js on :8080..."
HOSTNAME=0.0.0.0 PORT=8080 node server.js &
NEXT_PID=$!

i=0
bound=0
while [ "$i" -lt 120 ]; do
  if nc -z 127.0.0.1 8080 2>/dev/null; then
    echo "[entrypoint] Next.js listening on :8080"
    bound=1
    break
  fi
  if ! kill -0 "$NEXT_PID" 2>/dev/null; then
    echo "[entrypoint] Next.js exited before binding" >&2
    wait "$NEXT_PID"
    exit 1
  fi
  i=$((i + 1))
  sleep 0.25
done
if [ "$bound" -ne 1 ]; then
  echo "[entrypoint] TIMEOUT waiting for :8080" >&2
  exit 1
fi

echo "[entrypoint] Starting MarketSB sim on :3101..."
MARKETSB_SIM_PORT=3101 tsx packages/marketsb-sim/src/index.ts &
sleep 2

echo "[entrypoint] Starting Species sim on :3102..."
PORT=3102 MARKETSB_URL="${MSB_ORIGIN}/api/v1" tsx packages/species-sim/src/index.ts &
sleep 2

echo "[entrypoint] Waiting for sim health..."
sh scripts/smoke-sims.sh

echo "[entrypoint] Sims healthy. Holding on Next.js (pid $NEXT_PID)..."
wait "$NEXT_PID"
