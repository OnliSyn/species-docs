#!/bin/sh
set -e

echo "[entrypoint] Starting Onli Synth..."

# Start MarketSB sim (port 4001) in background
echo "[entrypoint] Starting MarketSB sim on :4001..."
tsx packages/marketsb-sim/src/index.ts &
MARKETSB_PID=$!
sleep 2

# Start Species sim (port 4012) in background
echo "[entrypoint] Starting Species sim on :4012..."
tsx packages/species-sim/src/index.ts &
SPECIES_PID=$!
sleep 2

# Start Next.js (port 3000) in foreground
echo "[entrypoint] Starting Next.js on :3000..."
exec node server.js
