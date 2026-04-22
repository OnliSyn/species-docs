# Species Docs Explorer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a standalone MCP explorer at species-docs.vercel.app — a React Flow node graph of 4 live MCP services with per-tool documentation and an interactive call playground.

**Architecture:** Fork oai_5-oh into a new repo OnliSyn/species-docs, strip all trading features, add @xyflow/react for the graph. Four service nodes connect to a central hub node; clicking a service opens a slide-in right panel with tool docs and a live playground that proxies calls through Next.js API routes.

**Tech Stack:** Next.js 16 App Router, TypeScript 5.9, Tailwind 4, shadcn/ui, @xyflow/react v12, Vitest 4, Playwright, Vercel

**Working directory:** `/Users/syn/DevStudio/species-docs` (created in Task 1)

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/config/services.ts` | Static registry of the 4 MCP services |
| `src/app/api/mcp/[service]/tools/route.ts` | GET proxy → tools/list |
| `src/app/api/mcp/[service]/call/route.ts` | POST proxy → tools/call |
| `src/hooks/useMcpTools.ts` | Fetch all services in parallel on mount |
| `src/features/explorer/ExplorerPage.tsx` | React Flow canvas + panel open/close state |
| `src/features/explorer/HubNode.tsx` | Central decorative hub node |
| `src/features/explorer/ServiceNode.tsx` | Custom RF node: name, url, count, status dot |
| `src/features/explorer/ServicePanel.tsx` | Slide-in 390px panel shell |
| `src/features/explorer/ToolList.tsx` | Scrollable tool rows |
| `src/features/explorer/ToolDetail.tsx` | Tool docs + back button |
| `src/features/explorer/ToolPlayground.tsx` | JSON Schema → form, Run button, response |
| `src/app/layout.tsx` | Root layout: font, Tailwind base |
| `src/app/page.tsx` | Renders `<ExplorerPage />` |
| `tests/unit/services.test.ts` | Service registry validation |
| `tests/unit/tools-route.test.ts` | Proxy route: SSRF guard + happy path |
| `tests/unit/call-route.test.ts` | Proxy route: SSRF guard + forwarding |
| `tests/unit/useMcpTools.test.ts` | Hook: parallel fetch, error handling |
| `tests/unit/ToolPlayground.test.ts` | Form generation from JSON Schema |
| `tests/e2e/explorer.spec.ts` | Graph renders, panel opens, tool call fires |

---

## Task 1: Fork & Strip Repo

**Files:**
- Create: `/Users/syn/DevStudio/species-docs/` (new repo)

- [ ] **Step 1: Fork oai_5-oh into OnliSyn/species-docs and clone**

```bash
gh repo fork OnliSyn/oai_5-oh --org OnliSyn --fork-name species-docs --clone
mv species-docs /Users/syn/DevStudio/species-docs
cd /Users/syn/DevStudio/species-docs
```

- [ ] **Step 2: Remove all trading features and packages**

```bash
rm -rf src/features src/stores packages src/app/analytics src/app/assets \
  src/app/assurance src/app/transactions src/app/settings \
  src/config/sim-env.ts src/config/canon.ts \
  tests/global-setup.ts tests/sims tests/journeys tests/unit/sim* \
  scripts/smoke-sims.sh entrypoint.sh fly.toml .fly
```

- [ ] **Step 3: Remove sim rewrites from next.config.ts**

Replace `next.config.ts` entirely:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
};

export default nextConfig;
```

- [ ] **Step 4: Update package.json — replace deps**

Replace `package.json`:

```json
{
  "name": "species-docs",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@fontsource-variable/geist": "^5.2.8",
    "@xyflow/react": "^12.4.4",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.7.0",
    "next": "^16.2.2",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "tailwind-merge": "^3.5.0",
    "tailwindcss": "^4.2.2",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@playwright/test": "^1.55.0",
    "@tailwindcss/postcss": "^4.2.2",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^22",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "jsdom": "^26.1.0",
    "typescript": "~5.9.3",
    "vitest": "^4.1.3"
  }
}
```

- [ ] **Step 5: Install deps**

```bash
npm install
```

Expected: no errors, `node_modules/@xyflow/react` present.

- [ ] **Step 6: Replace src/app/globals.css**

```css
@import "tailwindcss";
@import "@fontsource-variable/geist";

@custom-variant dark (&:is(.dark *));

:root {
  --color-bg-primary: #FFFFFF;
  --color-bg-card: #FAFAFA;
  --color-bg-sidebar: #F5F5F5;
  --color-bg-outer: #0A0A0A;
  --color-cta-primary: #2D2D2D;
  --color-accent-green: #C5DE8A;
  --color-accent-amber: #FFCE73;
  --color-accent-red: #E74C3C;
  --color-text-primary: #1A1A1A;
  --color-text-secondary: #6B6B6B;
  --color-border: #E5E5E5;
  --radius-card: 20px;
  --radius-panel: 24px;
  --radius-button: 12px;
  --font-family: 'Geist Variable', system-ui, sans-serif;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --border: oklch(0.922 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--font-family); background: var(--color-bg-primary); color: var(--color-text-primary); }
```

- [ ] **Step 7: Replace src/app/layout.tsx**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Species MCP Explorer',
  description: 'Interactive explorer for Species MCP services',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Replace src/app/page.tsx with placeholder**

```tsx
export default function Home() {
  return <main style={{ padding: 24 }}>Explorer coming soon</main>;
}
```

- [ ] **Step 9: Replace vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
  },
});
```

- [ ] **Step 10: Verify build passes**

```bash
npm run build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: strip oai_5-oh to design shell for species-docs explorer"
```

---

## Task 2: Service Registry

**Files:**
- Create: `src/config/services.ts`
- Create: `tests/unit/services.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/services.test.ts`:

```ts
import { SERVICES, getServiceById } from '@/config/services';

test('exports exactly 4 services', () => {
  expect(SERVICES).toHaveLength(4);
});

test('each service has required fields', () => {
  for (const s of SERVICES) {
    expect(s.id).toBeTruthy();
    expect(s.label).toBeTruthy();
    expect(s.url).toMatch(/^https:\/\//);
  }
});

test('getServiceById returns matching service', () => {
  const s = getServiceById('species-trust');
  expect(s?.url).toBe('https://species-trust.fly.dev/mcp');
});

test('getServiceById returns undefined for unknown id', () => {
  expect(getServiceById('unknown')).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/services.test.ts
```

Expected: FAIL — `Cannot find module '@/config/services'`

- [ ] **Step 3: Implement service registry**

Create `src/config/services.ts`:

```ts
export interface McpService {
  id: string;
  label: string;
  url: string;
}

export const SERVICES: McpService[] = [
  { id: 'species-trust',  label: 'species-trust',  url: 'https://species-trust.fly.dev/mcp' },
  { id: 'species-market', label: 'species-market', url: 'https://species-market.fly.dev/mcp' },
  { id: 'species-audit',  label: 'species-audit',  url: 'https://species-audit.fly.dev/mcp' },
  { id: 'onli-synth',     label: 'onli-synth',     url: 'https://mcp.synth.dev.onli.app/mcp' },
];

export function getServiceById(id: string): McpService | undefined {
  return SERVICES.find((s) => s.id === id);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/services.test.ts
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/config/services.ts tests/unit/services.test.ts
git commit -m "feat: add MCP service registry"
```

---

## Task 3: MCP Tool Type

**Files:**
- Create: `src/types/mcp.ts`

No test needed — pure type definitions.

- [ ] **Step 1: Create MCP types**

Create `src/types/mcp.ts`:

```ts
export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, JsonSchemaProperty>;
    required?: string[];
  };
}

export interface JsonSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'integer' | 'array' | 'object';
  description?: string;
  enum?: string[];
  default?: unknown;
}

export interface McpToolResult {
  content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>;
  isError?: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/mcp.ts
git commit -m "feat: add MCP tool and result types"
```

---

## Task 4: API Proxy — tools/list

**Files:**
- Create: `src/app/api/mcp/[service]/tools/route.ts`
- Create: `tests/unit/tools-route.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/tools-route.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/unit/tools-route.test.ts
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Implement tools/list proxy**

Create `src/app/api/mcp/[service]/tools/route.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/unit/tools-route.test.ts
```

Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/app/api/mcp/[service]/tools/route.ts tests/unit/tools-route.test.ts
git commit -m "feat: add tools/list proxy route with SSRF guard"
```

---

## Task 5: API Proxy — tools/call

**Files:**
- Create: `src/app/api/mcp/[service]/call/route.ts`
- Create: `tests/unit/call-route.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/call-route.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/unit/call-route.test.ts
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Implement tools/call proxy**

Create `src/app/api/mcp/[service]/call/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getServiceById } from '@/config/services';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ service: string }> }
) {
  const { service } = await params;
  const svc = getServiceById(service);
  if (!svc) {
    return NextResponse.json({ error: 'Unknown service' }, { status: 400 });
  }

  const { name, arguments: args } = await req.json();

  const upstream = await fetch(svc.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });

  if (!upstream.ok) {
    return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
  }

  const data = await upstream.json();
  return NextResponse.json(data?.result ?? {});
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/unit/call-route.test.ts
```

Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/app/api/mcp/[service]/call/route.ts tests/unit/call-route.test.ts
git commit -m "feat: add tools/call proxy route"
```

---

## Task 6: useMcpTools Hook

**Files:**
- Create: `src/hooks/useMcpTools.ts`
- Create: `tests/unit/useMcpTools.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/useMcpTools.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/unit/useMcpTools.test.ts
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Implement useMcpTools**

Create `src/hooks/useMcpTools.ts`:

```ts
import { useEffect, useState } from 'react';
import { SERVICES } from '@/config/services';
import type { McpTool } from '@/types/mcp';

type ServiceStatus = 'loading' | 'live' | 'error';

interface McpToolsState {
  tools: Record<string, McpTool[]>;
  status: Record<string, ServiceStatus>;
  loading: boolean;
}

export function useMcpTools(): McpToolsState {
  const [tools, setTools] = useState<Record<string, McpTool[]>>({});
  const [status, setStatus] = useState<Record<string, ServiceStatus>>(
    Object.fromEntries(SERVICES.map((s) => [s.id, 'loading']))
  );

  useEffect(() => {
    const fetchAll = async () => {
      await Promise.all(
        SERVICES.map(async (svc) => {
          try {
            const res = await fetch(`/api/mcp/${svc.id}/tools`);
            if (!res.ok) throw new Error('fetch failed');
            const data: McpTool[] = await res.json();
            setTools((prev) => ({ ...prev, [svc.id]: data }));
            setStatus((prev) => ({ ...prev, [svc.id]: 'live' }));
          } catch {
            setStatus((prev) => ({ ...prev, [svc.id]: 'error' }));
          }
        })
      );
    };
    fetchAll();
  }, []);

  const loading = Object.values(status).some((s) => s === 'loading');
  return { tools, status, loading };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/unit/useMcpTools.test.ts
```

Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useMcpTools.ts tests/unit/useMcpTools.test.ts
git commit -m "feat: add useMcpTools hook — parallel fetch with per-service status"
```

---

## Task 7: ToolPlayground Component

**Files:**
- Create: `src/features/explorer/ToolPlayground.tsx`
- Create: `tests/unit/ToolPlayground.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/ToolPlayground.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToolPlayground } from '@/features/explorer/ToolPlayground';
import type { McpTool } from '@/types/mcp';

const stringTool: McpTool = {
  name: 'greet',
  description: 'Say hello',
  inputSchema: {
    type: 'object',
    properties: { name: { type: 'string', description: 'Your name' } },
    required: ['name'],
  },
};

const boolTool: McpTool = {
  name: 'toggle',
  description: 'Toggle something',
  inputSchema: {
    type: 'object',
    properties: { enabled: { type: 'boolean', description: 'Enable flag' } },
  },
};

test('renders a text input for string property', () => {
  render(<ToolPlayground tool={stringTool} serviceId="species-trust" />);
  expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
  expect(screen.getByRole('textbox')).toBeInTheDocument();
});

test('renders a checkbox for boolean property', () => {
  render(<ToolPlayground tool={boolTool} serviceId="species-trust" />);
  expect(screen.getByRole('checkbox')).toBeInTheDocument();
});

test('marks required fields with asterisk', () => {
  render(<ToolPlayground tool={stringTool} serviceId="species-trust" />);
  expect(screen.getByText(/name \*/i)).toBeInTheDocument();
});

test('calls /api/mcp/[service]/call on Run and shows response', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ content: [{ type: 'text', text: 'Hello, world' }] }),
  });

  render(<ToolPlayground tool={stringTool} serviceId="species-trust" />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'world' } });
  fireEvent.click(screen.getByRole('button', { name: /run/i }));

  await waitFor(() => expect(screen.getByText(/Hello, world/)).toBeInTheDocument());

  expect(global.fetch).toHaveBeenCalledWith('/api/mcp/species-trust/call', expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({ name: 'greet', arguments: { name: 'world' } }),
  }));
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/unit/ToolPlayground.test.tsx
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Implement ToolPlayground**

Create `src/features/explorer/ToolPlayground.tsx`:

```tsx
'use client';
import { useState } from 'react';
import type { McpTool, McpToolResult } from '@/types/mcp';
import { cn } from '@/lib/utils';

interface Props {
  tool: McpTool;
  serviceId: string;
}

export function ToolPlayground({ tool, serviceId }: Props) {
  const properties = tool.inputSchema.properties ?? {};
  const required = tool.inputSchema.required ?? [];

  const [values, setValues] = useState<Record<string, unknown>>(
    Object.fromEntries(Object.keys(properties).map((k) => [k, properties[k].type === 'boolean' ? false : '']))
  );
  const [result, setResult] = useState<McpToolResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/mcp/${serviceId}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tool.name, arguments: values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(properties).map(([key, prop]) => (
        <div key={key} className="flex flex-col gap-1">
          <label htmlFor={key} className="text-xs font-medium text-[var(--color-text-secondary)]">
            {key} {required.includes(key) ? '*' : ''}
          </label>
          {prop.type === 'boolean' ? (
            <input
              id={key}
              type="checkbox"
              checked={values[key] as boolean}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.checked }))}
              className="w-4 h-4"
            />
          ) : prop.type === 'number' || prop.type === 'integer' ? (
            <input
              id={key}
              type="number"
              value={values[key] as string}
              onChange={(e) => setValues((v) => ({ ...v, [key]: Number(e.target.value) }))}
              className="px-3 py-2 rounded-[var(--radius-input)] border border-[var(--color-border)] text-sm bg-white"
            />
          ) : (
            <input
              id={key}
              type="text"
              value={values[key] as string}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              className="px-3 py-2 rounded-[var(--radius-input)] border border-[var(--color-border)] text-sm bg-white"
            />
          )}
          {prop.description && (
            <span className="text-xs text-[var(--color-text-secondary)]">{prop.description}</span>
          )}
        </div>
      ))}

      <button
        onClick={run}
        disabled={running}
        className={cn(
          'px-4 py-2 rounded-[var(--radius-button)] text-sm font-medium bg-[var(--color-cta-primary)] text-white',
          running && 'opacity-50 cursor-not-allowed'
        )}
      >
        {running ? 'Running…' : 'Run'}
      </button>

      {error && (
        <pre className="text-xs text-[var(--color-accent-red)] bg-red-50 p-3 rounded-lg overflow-auto">{error}</pre>
      )}

      {result && (
        <pre className="text-xs bg-[var(--color-bg-card)] border border-[var(--color-border)] p-3 rounded-lg overflow-auto max-h-64">
          {result.content.map((c, i) =>
            c.type === 'text' ? c.text : `[image: ${c.mimeType}]`
          ).join('\n')}
        </pre>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/unit/ToolPlayground.test.tsx
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/features/explorer/ToolPlayground.tsx tests/unit/ToolPlayground.test.tsx
git commit -m "feat: add ToolPlayground — JSON Schema form + live Run button"
```

---

## Task 8: ToolDetail, ToolList, ServicePanel

**Files:**
- Create: `src/features/explorer/ToolDetail.tsx`
- Create: `src/features/explorer/ToolList.tsx`
- Create: `src/features/explorer/ServicePanel.tsx`

No unit tests for these — pure presentational wiring; covered by E2E in Task 10.

- [ ] **Step 1: Create ToolDetail**

Create `src/features/explorer/ToolDetail.tsx`:

```tsx
'use client';
import { ToolPlayground } from './ToolPlayground';
import type { McpTool } from '@/types/mcp';

interface Props {
  tool: McpTool;
  serviceId: string;
  onBack: () => void;
}

export function ToolDetail({ tool, serviceId, onBack }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] w-fit"
      >
        ← Back
      </button>
      <div>
        <h3 className="text-sm font-semibold">{tool.name}</h3>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1">{tool.description}</p>
      </div>
      <ToolPlayground tool={tool} serviceId={serviceId} />
    </div>
  );
}
```

- [ ] **Step 2: Create ToolList**

Create `src/features/explorer/ToolList.tsx`:

```tsx
'use client';
import type { McpTool } from '@/types/mcp';

interface Props {
  tools: McpTool[];
  onSelect: (tool: McpTool) => void;
}

export function ToolList({ tools, onSelect }: Props) {
  if (tools.length === 0) {
    return <p className="text-xs text-[var(--color-text-secondary)]">No tools loaded.</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {tools.map((tool) => (
        <li key={tool.name}>
          <button
            onClick={() => onSelect(tool)}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--color-bg-sidebar)] transition-colors"
          >
            <div className="text-sm font-medium">{tool.name}</div>
            <div className="text-xs text-[var(--color-text-secondary)] truncate">{tool.description}</div>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Create ServicePanel**

Create `src/features/explorer/ServicePanel.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import { ToolList } from './ToolList';
import { ToolDetail } from './ToolDetail';
import type { McpService } from '@/config/services';
import type { McpTool } from '@/types/mcp';

interface Props {
  service: McpService;
  tools: McpTool[];
  status: 'loading' | 'live' | 'error';
  onClose: () => void;
}

export function ServicePanel({ service, tools, status, onClose }: Props) {
  const [selectedTool, setSelectedTool] = useState<McpTool | null>(null);

  return (
    <div
      data-testid="service-panel"
      className="fixed top-0 right-0 h-full w-[390px] bg-[var(--color-bg-primary)] border-l border-[var(--color-border)] shadow-xl flex flex-col z-50"
      style={{ animation: 'slideIn 200ms ease-out' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
        <div>
          <h2 className="text-sm font-semibold">{service.label}</h2>
          <p className="text-xs text-[var(--color-text-secondary)] truncate max-w-[280px]">{service.url}</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: status === 'live' ? 'var(--color-accent-green)' : status === 'error' ? 'var(--color-accent-red)' : '#ccc' }}
          />
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-bg-sidebar)]">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {selectedTool ? (
          <ToolDetail
            tool={selectedTool}
            serviceId={service.id}
            onBack={() => setSelectedTool(null)}
          />
        ) : (
          <ToolList tools={tools} onSelect={setSelectedTool} />
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/features/explorer/ToolDetail.tsx src/features/explorer/ToolList.tsx src/features/explorer/ServicePanel.tsx
git commit -m "feat: add ServicePanel, ToolList, ToolDetail components"
```

---

## Task 9: React Flow Nodes & ExplorerPage

**Files:**
- Create: `src/features/explorer/HubNode.tsx`
- Create: `src/features/explorer/ServiceNode.tsx`
- Create: `src/features/explorer/ExplorerPage.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create HubNode**

Create `src/features/explorer/HubNode.tsx`:

```tsx
import { Handle, Position } from '@xyflow/react';

export function HubNode() {
  return (
    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-cta-primary)] text-white text-xs font-semibold shadow-lg">
      MCP
      <Handle type="source" position={Position.Right} className="opacity-0" />
      <Handle type="source" position={Position.Left} className="opacity-0" />
      <Handle type="source" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}
```

- [ ] **Step 2: Create ServiceNode**

Create `src/features/explorer/ServiceNode.tsx`:

```tsx
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

export interface ServiceNodeData {
  label: string;
  url: string;
  toolCount: number;
  status: 'loading' | 'live' | 'error';
  onClick: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  live: 'var(--color-accent-green)',
  error: 'var(--color-accent-red)',
  loading: '#ccc',
};

export function ServiceNode({ data }: NodeProps) {
  const d = data as ServiceNodeData;
  return (
    <>
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <button
        onClick={d.onClick}
        className="flex flex-col gap-1 px-4 py-3 rounded-[var(--radius-card)] bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-[var(--shadow-card)] hover:shadow-md transition-shadow text-left min-w-[160px]"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">{d.label}</span>
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: STATUS_COLOR[d.status] ?? '#ccc' }}
          />
        </div>
        <span className="text-xs text-[var(--color-text-secondary)] truncate max-w-[140px]">{d.url.replace('https://', '')}</span>
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">{d.toolCount} tools</span>
      </button>
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </>
  );
}
```

- [ ] **Step 3: Create ExplorerPage**

Create `src/features/explorer/ExplorerPage.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { SERVICES } from '@/config/services';
import { useMcpTools } from '@/hooks/useMcpTools';
import { HubNode } from './HubNode';
import { ServiceNode } from './ServiceNode';
import { ServicePanel } from './ServicePanel';

const NODE_TYPES = { hub: HubNode, service: ServiceNode };

const POSITIONS = [
  { x: -260, y: -80 },
  { x:  160, y: -80 },
  { x: -260, y:  80 },
  { x:  160, y:  80 },
];

const INITIAL_EDGES: Edge[] = SERVICES.map((svc) => ({
  id: `hub-${svc.id}`,
  source: 'hub',
  target: svc.id,
  style: { stroke: 'var(--color-border)', strokeWidth: 1.5 },
}));

export function ExplorerPage() {
  const { tools, status } = useMcpTools();
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, , onEdgesChange] = useEdgesState(INITIAL_EDGES);

  useEffect(() => {
    const hub: Node = { id: 'hub', type: 'hub', position: { x: -32, y: -32 }, data: {} };
    const serviceNodes: Node[] = SERVICES.map((svc, i) => ({
      id: svc.id,
      type: 'service',
      position: POSITIONS[i],
      data: {
        label: svc.label,
        url: svc.url,
        toolCount: tools[svc.id]?.length ?? 0,
        status: status[svc.id] ?? 'loading',
        onClick: () => setSelectedServiceId(svc.id),
      },
    }));
    setNodes([hub, ...serviceNodes]);
  }, [tools, status, setNodes]);

  const selectedService = SERVICES.find((s) => s.id === selectedServiceId) ?? null;

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-3 bg-[var(--color-bg-primary)] border-b border-[var(--color-border)]">
        <span className="text-sm font-semibold">Species MCP Explorer</span>
        <div className="flex items-center gap-4">
          {SERVICES.map((svc) => (
            <div key={svc.id} className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: status[svc.id] === 'live' ? 'var(--color-accent-green)' : status[svc.id] === 'error' ? 'var(--color-accent-red)' : '#ccc' }}
              />
              <span className="text-xs text-[var(--color-text-secondary)]">{svc.label}</span>
            </div>
          ))}
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        style={{ paddingTop: 52 }}
      >
        <Background gap={24} color="var(--color-border)" />
        <Controls />
        <MiniMap />
      </ReactFlow>

      {selectedService && (
        <ServicePanel
          service={selectedService}
          tools={tools[selectedService.id] ?? []}
          status={status[selectedService.id] ?? 'loading'}
          onClose={() => setSelectedServiceId(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Update src/app/page.tsx**

```tsx
import { ExplorerPage } from '@/features/explorer/ExplorerPage';

export default function Home() {
  return <ExplorerPage />;
}
```

- [ ] **Step 5: Verify dev server renders**

```bash
npm run dev
```

Open `http://localhost:3000` — expect to see the React Flow canvas with 5 nodes and the top bar. No console errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/explorer/HubNode.tsx src/features/explorer/ServiceNode.tsx \
  src/features/explorer/ExplorerPage.tsx src/app/page.tsx
git commit -m "feat: add React Flow explorer — hub + service nodes + slide-in panel"
```

---

## Task 10: E2E Tests

**Files:**
- Create: `tests/e2e/explorer.spec.ts`
- Create: `playwright.config.ts`

- [ ] **Step 1: Create playwright.config.ts**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  use: { baseURL: 'http://localhost:3000' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

- [ ] **Step 2: Write E2E tests**

Create `tests/e2e/explorer.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Mock all 4 MCP tool fetches so tests don't depend on live services
  await page.route('/api/mcp/*/tools', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { name: 'ping', description: 'Ping the service', inputSchema: { type: 'object', properties: { message: { type: 'string', description: 'Message to echo' } }, required: ['message'] } },
      ]),
    })
  );
  await page.goto('/');
});

test('renders 4 service nodes and hub', async ({ page }) => {
  await expect(page.getByText('species-trust')).toBeVisible();
  await expect(page.getByText('species-market')).toBeVisible();
  await expect(page.getByText('species-audit')).toBeVisible();
  await expect(page.getByText('onli-synth')).toBeVisible();
  await expect(page.getByText('MCP')).toBeVisible();
});

test('clicking a service node opens the panel', async ({ page }) => {
  await page.getByText('species-trust').click();
  await expect(page.getByTestId('service-panel')).toBeVisible();
  await expect(page.getByText('https://species-trust.fly.dev/mcp')).toBeVisible();
});

test('panel shows tool list after load', async ({ page }) => {
  await page.getByText('species-market').click();
  await expect(page.getByText('ping')).toBeVisible();
  await expect(page.getByText('Ping the service')).toBeVisible();
});

test('clicking a tool shows the playground form', async ({ page }) => {
  await page.getByText('species-audit').click();
  await page.getByText('ping').click();
  await expect(page.getByRole('button', { name: /run/i })).toBeVisible();
  await expect(page.getByRole('textbox')).toBeVisible();
});

test('Run button fires call and shows response', async ({ page }) => {
  await page.route('/api/mcp/onli-synth/call', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: [{ type: 'text', text: 'pong: hello' }] }),
    })
  );
  await page.getByText('onli-synth').click();
  await page.getByText('ping').click();
  await page.getByRole('textbox').fill('hello');
  await page.getByRole('button', { name: /run/i }).click();
  await expect(page.getByText('pong: hello')).toBeVisible();
});

test('X button closes the panel', async ({ page }) => {
  await page.getByText('species-trust').click();
  await expect(page.getByTestId('service-panel')).toBeVisible();
  await page.getByRole('button', { name: '' }).filter({ has: page.locator('svg') }).last().click();
  await expect(page.getByTestId('service-panel')).not.toBeVisible();
});
```

- [ ] **Step 3: Install Playwright browsers**

```bash
npx playwright install chromium
```

- [ ] **Step 4: Run E2E tests**

```bash
npm run test:e2e
```

Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e/explorer.spec.ts
git commit -m "test: add Playwright E2E for explorer graph, panel, and playground"
```

---

## Task 11: Vercel Deployment

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Create vercel.json**

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next"
}
```

- [ ] **Step 2: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 3: Connect to Vercel**

```bash
npx vercel --prod
```

When prompted:
- Link to existing project? **No**
- Project name: **species-docs**
- Directory: `.`

- [ ] **Step 4: Set custom domain**

```bash
npx vercel domains add species-docs.vercel.app
```

Or via Vercel dashboard: Project Settings → Domains → add `species-docs.vercel.app`.

- [ ] **Step 5: Verify live**

Open `https://species-docs.vercel.app` — expect the graph to load and all 4 status chips to turn green.

- [ ] **Step 6: Commit**

```bash
git add vercel.json
git commit -m "chore: add vercel.json for species-docs deployment"
git push origin main
```

---

## All Unit Tests Pass

```bash
npm test
```

Expected: PASS — all unit tests (services, tools-route, call-route, useMcpTools, ToolPlayground)

## All E2E Tests Pass

```bash
npm run test:e2e
```

Expected: PASS — all 6 Playwright tests
