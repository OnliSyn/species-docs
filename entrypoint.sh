#!/bin/sh
set -e

echo "[entrypoint] Starting Onli Synth..."

# Start MarketSB sim (port 3101) in background
echo "[entrypoint] Starting MarketSB sim on :3101..."
MARKETSB_SIM_PORT=3101 tsx packages/marketsb-sim/src/index.ts &
sleep 2

# Start Species sim (port 3102) — override PORT so it doesn't take 8080
echo "[entrypoint] Starting Species sim on :3102..."
PORT=3102 MARKETSB_URL=http://localhost:3101/api/v1 tsx packages/species-sim/src/index.ts &
sleep 2

echo "[entrypoint] Sims started. Launching Next.js on :8080..."

# Start Next.js standalone server on 8080 (Fly proxy forwards here)
HOSTNAME=0.0.0.0 PORT=8080 exec node server.js
