# Species Docs Explorer — Design Spec

**Date:** 2026-04-22  
**Deploy target:** species-docs.vercel.app  
**Source:** Fork of OnliSyn/oai_5-oh → new repo OnliSyn/species-docs

---

## Overview

A standalone developer explorer for the Species MCP ecosystem. Renders a live node graph of all MCP services, lets users browse per-service tool documentation, and fire interactive tool calls directly from the browser.

---

## Repo & Stack

| Item | Value |
|------|-------|
| New repo | `OnliSyn/species-docs` |
| Framework | Next.js 16 App Router + TypeScript |
| Styling | Tailwind 4 + CSS variables (forked from oai_5-oh) |
| Components | shadcn/ui + Geist font |
| Graph | `@xyflow/react` (React Flow v12) |
| Deploy | Vercel → `species-docs.vercel.app` |

**Stripped from fork:** all trading features (chat, trade, species, neich, ask, learn, assurance, analytics, transactions), Zustand stores, `packages/` subdirectories, 3-column dashboard layout.

**Kept:** Tailwind config, CSS variables, shadcn components, Geist font, Next.js + TypeScript config.

---

## MCP Services

```ts
// src/config/services.ts
[
  { id: "species-trust",  label: "species-trust",  url: "https://species-trust.fly.dev/mcp",  toolCount: 15 },
  { id: "species-market", label: "species-market", url: "https://species-market.fly.dev/mcp", toolCount: 15 },
  { id: "species-audit",  label: "species-audit",  url: "https://species-audit.fly.dev/mcp",  toolCount: 8  },
  { id: "onli-synth",     label: "onli-synth",     url: "https://mcp.synth.dev.onli.app/mcp", toolCount: 44 },
]
```

---

## Layout

Single route: `/` renders `<ExplorerPage />`.

**Top bar:** title "Species MCP Explorer" + live/offline status chip per service (fetched on load).

**Canvas:** Full-screen React Flow canvas (pan, zoom, drag nodes).

**Right panel:** 390px slide-in overlay triggered by clicking a service node. Closed with X. Does not resize the canvas.

---

## Graph Structure

5 nodes:
- **HubNode** — central non-clickable anchor labeled "MCP"
- **ServiceNode × 4** — one per service, connected to hub by edges

Each ServiceNode displays: service label, base URL, tool count badge, colored status dot (green = reachable, red = unreachable).

---

## Right Panel Contents

On service node click, panel renders in three states:

1. **Service header** — name, URL, status badge
2. **Tool list** — scrollable rows, each showing tool name + one-line description
3. **Tool detail** (on tool row click) — replaces tool list with:
   - Full tool description
   - Input schema rendered as a dynamic form (string → text input, number → number input, boolean → toggle, required fields marked)
   - **Run** button → `POST /api/mcp/[service]/call`
   - Response display area (JSON, scrollable, monospace)

Back button returns to tool list.

---

## API Routes (MCP Proxy)

All calls go through Next.js API routes to avoid CORS.

### `GET /api/mcp/[service]/tools`
Proxies `tools/list` to the service:
```json
POST https://<service-url>/mcp
{"jsonrpc":"2.0","id":1,"method":"tools/list"}
```
Returns the `tools` array. Response cached with `stale-while-revalidate: 60`.

### `POST /api/mcp/[service]/call`
Body: `{ name: string, arguments: Record<string, unknown> }`  
Proxies `tools/call`:
```json
POST https://<service-url>/mcp
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"...","arguments":{...}}}
```
Streams response back to client.

Service URL is resolved from the static registry by `[service]` id — never from client input (prevents SSRF).

---

## Data Hook

```ts
// src/hooks/useMcpTools.ts
// Fetches all 4 services in parallel on mount.
// Returns: { tools: Record<serviceId, Tool[]>, status: Record<serviceId, 'live'|'error'|'loading'> }
```

---

## Component Tree

```
src/
├── app/
│   ├── page.tsx
│   └── api/mcp/[service]/
│       ├── tools/route.ts
│       └── call/route.ts
├── config/
│   └── services.ts
├── features/explorer/
│   ├── ExplorerPage.tsx       # RF canvas + panel open/close state
│   ├── ServiceNode.tsx        # Custom RF node
│   ├── HubNode.tsx            # Central hub node
│   ├── ServicePanel.tsx       # Slide-in panel shell
│   ├── ToolList.tsx           # Scrollable tool rows
│   ├── ToolDetail.tsx         # Docs + playground
│   └── ToolPlayground.tsx     # Schema → form + Run + response
└── hooks/
    └── useMcpTools.ts
```

---

## Security

- Proxy routes resolve service URL from static registry only — `[service]` param is validated against known IDs, rejecting unknown values. Eliminates SSRF risk.
- No secrets stored client-side.
- Site is fully public, no auth.

---

## Out of Scope

- Authentication / API key management
- Persisting call history
- Editing tool schemas
- Search across tools
