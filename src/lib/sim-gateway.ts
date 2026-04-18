/**
 * Single server-side gateway for HTTP calls to MarketSB and Species sims.
 * Uses canonical origins from @/config/sim-env.
 */
import { getSimEnv } from '@/config/sim-env';

const DEFAULT_MS = 15_000;

function withTimeout(signal: AbortSignal | null | undefined, ms: number): AbortSignal {
  const t = AbortSignal.timeout(ms);
  if (signal == null) return t;
  return AbortSignal.any([signal, t]);
}

function joinOrigin(origin: string, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${origin.replace(/\/$/, '')}${p}`;
}

export async function fetchMarketSb(path: string, init?: RequestInit): Promise<Response> {
  const { marketsbOrigin } = getSimEnv();
  return fetch(joinOrigin(marketsbOrigin, path), {
    ...init,
    signal: withTimeout(init?.signal, DEFAULT_MS),
  });
}

export async function fetchSpecies(path: string, init?: RequestInit): Promise<Response> {
  const { speciesOrigin } = getSimEnv();
  return fetch(joinOrigin(speciesOrigin, path), {
    ...init,
    signal: withTimeout(init?.signal, DEFAULT_MS),
  });
}
