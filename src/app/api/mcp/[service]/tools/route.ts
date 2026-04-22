import { NextRequest, NextResponse } from 'next/server';
import { getServiceById } from '@/config/services';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ service: string }> }
) {
  const { service } = await params;
  const svc = getServiceById(service);
  if (!svc) {
    return NextResponse.json({ error: 'Unknown service' }, { status: 400 });
  }

  const upstream = await fetch(svc.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    next: { revalidate: 60 },
  });

  if (!upstream.ok) {
    return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
  }

  const data = await upstream.json();
  const tools = data?.result?.tools ?? [];
  return NextResponse.json(tools);
}
