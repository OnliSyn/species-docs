#!/bin/sh
# Wait for MarketSB + Species sim health endpoints (used by entrypoint / manual checks).
set -e
MSB_URL="${MARKETSB_URL:-http://127.0.0.1:3101}"
SP_URL="${SPECIES_URL:-http://127.0.0.1:3102}"
case "$MSB_URL" in */api/v1) MSB_ORIGIN="${MSB_URL%/api/v1}" ;; *) MSB_ORIGIN="${MSB_URL%/}" ;; esac
SP_ORIGIN="${SP_URL%/}"

wait_http() {
  label="$1"
  url="$2"
  i=0
  while [ "$i" -lt 90 ]; do
    # BusyBox wget (node:22-alpine) — avoid relying on curl in the runtime image
    if wget -q -O /dev/null "$url" 2>/dev/null; then
      echo "[smoke-sims] $label ok ($url)"
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  echo "[smoke-sims] TIMEOUT waiting for $label ($url)" >&2
  return 1
}

wait_http "marketsb" "$MSB_ORIGIN/health"
wait_http "species" "$SP_ORIGIN/health"
echo "[smoke-sims] Both authorities healthy."
