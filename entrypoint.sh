#!/bin/sh
set -e

echo "[entrypoint] Starting Onli Synth..."

# Start MarketSB sim (port 4001) in background
echo "[entrypoint] Starting MarketSB sim on :4001..."
MARKETSB_SIM_PORT=4001 tsx packages/marketsb-sim/src/index.ts &
sleep 2

# Start Species sim (port 4012) — override PORT so it doesn't take 8080
echo "[entrypoint] Starting Species sim on :4012..."
PORT=4012 MARKETSB_URL=http://localhost:4001/api/v1 tsx packages/species-sim/src/index.ts &
sleep 2

echo "[entrypoint] Sims started. Launching Next.js on :8080..."

# Start Next.js standalone server on 8080 (Fly proxy forwards here)
HOSTNAME=0.0.0.0 PORT=8080 exec node server.js
