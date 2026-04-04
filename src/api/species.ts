import type { EventRequest, EventReceipt, MarketplaceStats } from '@/types';

const SPECIES_BASE_URL = import.meta.env.VITE_SPECIES_API_URL || 'http://localhost:3002';

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
  return speciesFetch('/eventRequest', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getOrderReceipt(eventId: string): Promise<EventReceipt> {
  return speciesFetch(`/events/${eventId}/receipt`);
}

export async function getMarketplaceStats(): Promise<MarketplaceStats> {
  return speciesFetch('/stats');
}

/** SSE event stream for order progress */
export function createEventStream(eventId: string): EventSource {
  return new EventSource(`${SPECIES_BASE_URL}/events/${eventId}/stream`);
}
