import type { EventRequest, EventReceipt, MarketplaceStats } from '@/types';
import { IS_MOCK_SPECIES, withMockFallback } from './mock-interceptor';
import { MOCK_MARKETPLACE_STATS, MOCK_ORDER_RECEIPT } from '@/lib/mock-data';

const SPECIES_BASE_URL = '/marketplace/v1';

async function speciesFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const { useAuthStore } = await import('@/stores/auth-store');
  const apiKey = useAuthStore.getState().speciesApiKey;

  const response = await fetch(`${SPECIES_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(body.message || 'Species API error');
  }

  return response.json();
}

export async function submitOrder(request: EventRequest): Promise<{ event_id: string }> {
  return withMockFallback(
    IS_MOCK_SPECIES,
    () => speciesFetch('/eventRequest', { method: 'POST', body: JSON.stringify(request) }),
    { event_id: `evt_mock_${Date.now()}` },
  );
}

export async function getOrderReceipt(eventId: string): Promise<EventReceipt> {
  return withMockFallback(
    IS_MOCK_SPECIES,
    () => speciesFetch(`/events/${eventId}/receipt`),
    { ...MOCK_ORDER_RECEIPT, event_id: eventId },
  );
}

export async function getMarketplaceStats(): Promise<MarketplaceStats> {
  return withMockFallback(IS_MOCK_SPECIES, () => speciesFetch('/stats'), MOCK_MARKETPLACE_STATS);
}

/** SSE event stream for order progress */
export function createEventStream(eventId: string): EventSource {
  return new EventSource(`${SPECIES_BASE_URL}/events/${eventId}/stream`);
}
