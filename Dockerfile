# ── Onli Synth — single container: Next.js + MarketSB sim + Species sim ──
FROM node:22-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/marketsb-sim/package.json packages/marketsb-sim/
COPY packages/species-sim/package.json packages/species-sim/
RUN npm ci --include=dev

# Build Next.js
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/marketsb-sim/node_modules ./packages/marketsb-sim/node_modules
COPY --from=deps /app/packages/species-sim/node_modules ./packages/species-sim/node_modules
COPY . .
RUN npx next build

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV MARKETSB_SIM_PORT=4001
ENV SPECIES_SIM_PORT=4012
ENV MARKETSB_URL=http://localhost:4001
ENV SPECIES_URL=http://localhost:4012

# Copy Next.js standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy sim source + deps (run with tsx at runtime)
COPY --from=builder /app/packages/marketsb-sim ./packages/marketsb-sim
COPY --from=builder /app/packages/species-sim ./packages/species-sim
COPY --from=deps /app/node_modules ./node_modules

# Copy config files needed at runtime
COPY --from=builder /app/src/config ./src/config

# Install tsx globally for sim servers
RUN npm install -g tsx

# Entrypoint script starts all 3 services
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3000
CMD ["./entrypoint.sh"]
