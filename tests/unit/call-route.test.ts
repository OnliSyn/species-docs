import { POST } from '@/app/api/mcp/[service]/call/route';
import { NextRequest } from 'next/server';

function makeReq(service: string, body: unknown) {
  return {
    req: new NextRequest(`http://localhost/api/mcp/${service}/call`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
    ctx: { params: Promise.resolve({ service }) },
  };
}

test('returns 400 for unknown service', async () => {
  const { req, ctx } = makeReq('unknown', { name: 'ping', arguments: {} });
  const res = await POST(req, ctx);
  expect(res.status).toBe(400);
});

test('proxies tools/call and returns result', async () => {
  const mockResult = { content: [{ type: 'text', text: 'pong' }] };
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ result: mockResult }),
  });

  const { req, ctx } = makeReq('species-trust', { name: 'ping', arguments: { delay: 0 } });
  const res = await POST(req, ctx);
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data).toEqual(mockResult);

  expect(global.fetch).toHaveBeenCalledWith(
    'https://species-trust.fly.dev/mcp',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'ping', arguments: { delay: 0 } },
      }),
    })
  );
});

test('returns 502 when upstream call fails', async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('err') });
  const { req, ctx } = makeReq('species-market', { name: 'foo', arguments: {} });
  const res = await POST(req, ctx);
  expect(res.status).toBe(502);
});
