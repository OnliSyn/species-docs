/**
 * Mock interceptor simplified for Next.js.
 *
 * In Next.js, the sims run behind rewrites -- API calls go to /api/v1
 * which Next.js rewrites to the sim servers.
 * No mock detection needed -- the sims ARE the backend.
 */

// In Next.js with rewrites, we always hit the real sims
export const IS_MOCK_MARKETSB = false;
export const IS_MOCK_SPECIES = false;
export const IS_MOCK_ONLI_CLOUD = false;

/**
 * Wraps a real API fetcher with a mock fallback.
 * Always uses the real fetcher -- sims are behind Next.js rewrites.
 * Falls back to mock data only if the fetch fails.
 */
export function withMockFallback<T>(
  _isMock: boolean,
  realFetcher: () => Promise<T>,
  mockData: T,
): Promise<T> {
  return realFetcher().catch(() => mockData);
}
