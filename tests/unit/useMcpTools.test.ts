// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { useMcpTools } from '@/hooks/useMcpTools';

const mockTools = [{ name: 'ping', description: 'Ping', inputSchema: { type: 'object' as const, properties: {} } }];

test('fetches tools for all 4 services in parallel', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockTools),
  });

  const { result } = renderHook(() => useMcpTools());

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(global.fetch).toHaveBeenCalledTimes(4);
  expect(result.current.tools['species-trust']).toEqual(mockTools);
  expect(result.current.tools['species-market']).toEqual(mockTools);
  expect(result.current.tools['species-audit']).toEqual(mockTools);
  expect(result.current.tools['onli-synth']).toEqual(mockTools);
});

test('marks service as error when fetch fails', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: false });

  const { result } = renderHook(() => useMcpTools());

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.status['species-trust']).toBe('error');
});

test('starts in loading state', () => {
  global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
  const { result } = renderHook(() => useMcpTools());
  expect(result.current.loading).toBe(true);
});
