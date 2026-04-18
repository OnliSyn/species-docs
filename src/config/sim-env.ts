/**
 * Canonical sim origins for MarketSB and Species (Species Core Canon: separated authorities).
 * All server-side fetch paths should use these — never scatter localhost/port literals.
 *
 * Env:
 * - MARKETSB_URL: origin only, e.g. http://127.0.0.1:3101 (no /api/v1 suffix)
 * - SPECIES_URL: origin only, e.g. http://127.0.0.1:3102
 */

const DEFAULT_MARKETSB = 'http://127.0.0.1:3101';
const DEFAULT_SPECIES = 'http://127.0.0.1:3102';

function stripTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

function parseOrigin(raw: string | undefined, fallback: string, name: string): string {
  let v = stripTrailingSlash((raw ?? '').trim() || fallback);
  try {
    const u = new URL(v);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new Error(`${name}: only http(s) allowed`);
    }
    // Accept legacy MARKETSB_URL=http://host:3101/api/v1 — normalize to origin
    if (name === 'MARKETSB_URL' && u.pathname.replace(/\/$/, '') === '/api/v1') {
      return `${u.protocol}//${u.host}`;
    }
    if (u.pathname !== '/' && u.pathname !== '') {
      throw new Error(
        `${name}: must be origin only (e.g. http://127.0.0.1:3101), or for MarketSB only .../api/v1; got ${v}`,
      );
    }
    return `${u.protocol}//${u.host}`;
  } catch (e) {
    throw new Error(`${name}: invalid URL "${v}": ${(e as Error).message}`);
  }
}

/** Call once at module load in server contexts; throws if misconfigured. */
export function getSimEnv(): { marketsbOrigin: string; speciesOrigin: string } {
  const marketsbOrigin = parseOrigin(
    process.env.MARKETSB_URL,
    DEFAULT_MARKETSB,
    'MARKETSB_URL',
  );
  const speciesOrigin = parseOrigin(process.env.SPECIES_URL, DEFAULT_SPECIES, 'SPECIES_URL');
  return { marketsbOrigin, speciesOrigin };
}

/** MarketSB REST API base including /api/v1 */
export function marketsbApiV1Base(): string {
  return `${getSimEnv().marketsbOrigin}/api/v1`;
}

/** Species marketplace REST base including /marketplace/v1 */
export function speciesMarketplaceV1Base(): string {
  return `${getSimEnv().speciesOrigin}/marketplace/v1`;
}

/** Species sim origin (events, oracle paths that are not under marketplace/v1) */
export function speciesOrigin(): string {
  return getSimEnv().speciesOrigin;
}

/** MarketSB origin only */
export function marketsbOrigin(): string {
  return getSimEnv().marketsbOrigin;
}
