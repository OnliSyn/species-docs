# ── Onli Synth — single container: Next.js + MarketSB sim + Species sim ──
FROM node:22-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/marketsb-sim/package.json packages/marketsb-sim/package-lock.json* packages/marketsb-sim/
COPY packages/species-sim/package.json packages/species-sim/package-lock.json* packages/species-sim/
RUN npm ci --include=dev \
 && cd packages/marketsb-sim && npm install --omit=dev \
 && cd ../species-sim && npm install --omit=dev

# Build Next.js
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx next build

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=8080
ENV MARKETSB_SIM_PORT=3101
ENV MARKETSB_URL=http://localhost:3101
ENV SPECIES_URL=http://localhost:3102

# Copy Next.js standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy sim source + their node_modules (run with tsx at runtime)
COPY --from=builder /app/packages/marketsb-sim ./packages/marketsb-sim
COPY --from=builder /app/packages/species-sim ./packages/species-sim
COPY --from=deps /app/packages/marketsb-sim/node_modules ./packages/marketsb-sim/node_modules
COPY --from=deps /app/packages/species-sim/node_modules ./packages/species-sim/node_modules

# Copy shared node_modules
COPY --from=deps /app/node_modules ./node_modules

# Copy config files needed at runtime
COPY --from=builder /app/src/config ./src/config

# Install tsx globally for sim servers
RUN npm install -g tsx

# Entrypoint + sim smoke (entrypoint.sh waits for both authorities)
COPY entrypoint.sh ./
COPY --from=builder /app/scripts/smoke-sims.sh ./scripts/smoke-sims.sh
RUN chmod +x entrypoint.sh scripts/smoke-sims.sh

EXPOSE 8080
CMD ["./entrypoint.sh"]
