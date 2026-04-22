import { GET } from '@/app/api/mcp/[service]/tools/route';
import { NextRequest } from 'next/server';

function makeReq(service: string) {
  return {
    req: new NextRequest(`http://localhost/api/mcp/${service}/tools`),
    ctx: { params: Promise.resolve({ service }) },
  };
}

test('returns 400 for unknown service', async () => {
  const { req, ctx } = makeReq('evil-host.com/etc/passwd');
  const res = await GET(req, ctx);
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error).toBe('Unknown service');
});

test('proxies tools/list and returns tools array', async () => {
  const mockTools = [
    { name: 'ping', description: 'Ping the service', inputSchema: { type: 'object', properties: {} } },
  ];
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ result: { tools: mockTools } }),
  });

  const { req, ctx } = makeReq('species-trust');
  const res = await GET(req, ctx);
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data).toEqual(mockTools);

  expect(global.fetch).toHaveBeenCalledWith(
    'https://species-trust.fly.dev/mcp',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
  );
});

test('returns 502 when upstream fails', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 503,
    text: () => Promise.resolve('Service Unavailable'),
  });

  const { req, ctx } = makeReq('species-audit');
  const res = await GET(req, ctx);
  expect(res.status).toBe(502);
});
