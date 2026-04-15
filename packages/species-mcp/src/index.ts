/**
 * MCP server — proxies @species/sim HTTP API for AI tools (stdio transport).
 * Env: SPECIES_URL (default http://localhost:3102) — origin only.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE = (process.env.SPECIES_URL ?? 'http://localhost:3102').replace(/\/$/, '');
const MP = `${BASE}/marketplace/v1`;

function textJson(data: unknown, status?: number): { content: [{ type: 'text'; text: string }] } {
  const payload =
    status !== undefined
      ? { ok: status >= 200 && status < 300, status, body: data }
      : data;
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  };
}

async function readBody(res: Response): Promise<unknown> {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return t;
  }
}

async function get(url: string): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(15_000) });
}

async function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
}

const writeMeta = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
} as const;

const server = new McpServer(
  {
    name: 'onli-species-sim',
    version: '0.1.0',
  },
  {
    instructions: `Tools for the Species marketplace simulator (${BASE}). Orchestrates buy/sell/transfer pipelines, vaults, and asset oracle; calls MarketSB post-batch at payment.confirmed. Use MarketSB MCP for funding VA and cashier details.`,
  },
);

server.registerTool(
  'species_agent_context',
  {
    description: 'LLM-oriented map of pipeline stages, endpoints, and MarketSB integration.',
  },
  async () => {
    const res = await get(`${MP}/agentContext`);
    return textJson(await readBody(res), res.status);
  },
);

server.registerTool(
  'species_get_stats',
  {
    description: 'Aggregate order/listing/vault stats for the sim.',
  },
  async () => {
    const res = await get(`${MP}/stats`);
    return textJson(await readBody(res), res.status);
  },
);

server.registerTool(
  'species_list_listings',
  {
    description: 'Active and historical listings JSON array.',
  },
  async () => {
    const res = await get(`${MP}/listings`);
    return textJson(await readBody(res), res.status);
  },
);

server.registerTool(
  'species_get_listing',
  {
    description: 'Single listing by id.',
    inputSchema: { listingId: z.string() },
  },
  async ({ listingId }) => {
    const res = await get(`${MP}/listings/${encodeURIComponent(listingId)}`);
    return textJson(await readBody(res), res.status);
  },
);

server.registerTool(
  'species_get_event_status',
  {
    description: 'Pipeline status and completed stages for an order eventId.',
    inputSchema: { eventId: z.string() },
  },
  async ({ eventId }) => {
    const res = await get(`${MP}/events/${encodeURIComponent(eventId)}/status`);
    return textJson(await readBody(res), res.status);
  },
);

server.registerTool(
  'species_get_event_receipt',
  {
    description: 'Final receipt (409 until order completed).',
    inputSchema: { eventId: z.string() },
  },
  async ({ eventId }) => {
    const res = await get(`${MP}/events/${encodeURIComponent(eventId)}/receipt`);
    return textJson(await readBody(res), res.status);
  },
);

server.registerTool(
  'species_get_vault',
  {
    description: 'Vault balance for onliId uid (e.g. onli-user-001).',
    inputSchema: { onliId: z.string() },
  },
  async ({ onliId }) => {
    const res = await get(`${MP}/vault/${encodeURIComponent(onliId)}`);
    return textJson(await readBody(res), res.status);
  },
);

server.registerTool(
  'species_get_vault_history',
  {
    description: 'Vault movement history for onliId.',
    inputSchema: { onliId: z.string() },
  },
  async ({ onliId }) => {
    const res = await get(`${MP}/vault/${encodeURIComponent(onliId)}/history`);
    return textJson(await readBody(res), res.status);
  },
);

server.registerTool(
  'species_asset_oracle_ledger',
  {
    description: 'Paged global asset oracle (change_owner entries).',
    inputSchema: {
      limit: z.number().int().min(1).max(200).optional().default(50),
      offset: z.number().int().min(0).optional().default(0),
    },
  },
  async ({ limit, offset }) => {
    const res = await get(`${BASE}/oracle/ledger?limit=${limit}&offset=${offset}`);
    return textJson(await readBody(res), res.status);
  },
);

server.registerTool(
  'species_asset_oracle_for_onli',
  {
    description: 'Asset oracle entries involving an onliId.',
    inputSchema: {
      onliId: z.string(),
      limit: z.number().int().min(1).max(200).optional().default(50),
      offset: z.number().int().min(0).optional().default(0),
    },
  },
  async ({ onliId, limit, offset }) => {
    const res = await get(
      `${BASE}/oracle/onli/${encodeURIComponent(onliId)}/ledger?limit=${limit}&offset=${offset}`,
    );
    return textJson(await readBody(res), res.status);
  },
);

server.registerTool(
  'species_asset_oracle_for_event',
  {
    description: 'Asset oracle entries for a marketplace eventId.',
    inputSchema: { eventId: z.string() },
  },
  async ({ eventId }) => {
    const res = await get(`${BASE}/oracle/events/${encodeURIComponent(eventId)}/entries`);
    return textJson(await readBody(res), res.status);
  },
);

server.registerTool(
  'species_submit_event_request',
  {
    description:
      'POST /marketplace/v1/eventRequest — start buy/sell/transfer pipeline (returns 202 + ws channel).',
    inputSchema: {
      eventId: z.string(),
      intent: z.enum(['buy', 'sell', 'transfer']),
      quantity: z.number().int().positive(),
      idempotencyKey: z.string(),
      paymentSource: z.object({ vaId: z.string() }).optional(),
      recipient: z.object({ onliId: z.string() }).optional(),
      listingConfig: z.object({ autoAuthorize: z.boolean().optional() }).optional(),
    },
    annotations: writeMeta,
  },
  async (body) => {
    const res = await postJson(`${MP}/eventRequest`, body);
    return textJson(await readBody(res), res.status);
  },
);

server.registerTool(
  'species_reset_sim',
  {
    description: 'POST /sim/reset — re-seed Species sim (destructive).',
    annotations: writeMeta,
  },
  async () => {
    const res = await postJson(`${BASE}/sim/reset`, {});
    return textJson(await readBody(res), res.status);
  },
);

server.registerTool(
  'species_sim_approve_ask_to_move',
  {
    description: 'POST /sim/approve/:eventId — approve pending AskToMove for an event.',
    inputSchema: { eventId: z.string() },
    annotations: writeMeta,
  },
  async ({ eventId }) => {
    const res = await postJson(`${BASE}/sim/approve/${encodeURIComponent(eventId)}`, {});
    return textJson(await readBody(res), res.status);
  },
);

server.registerTool(
  'species_get_sim_state',
  {
    description: 'GET /sim/state — full Species sim snapshot (dev/debug).',
  },
  async () => {
    const res = await get(`${BASE}/sim/state`);
    return textJson(await readBody(res), res.status);
  },
);

server.registerTool(
  'species_verify_asset_oracle',
  {
    description:
      'POST /oracle/onli/:onliId/verify — reconcile user vault count vs asset oracle-derived count.',
    inputSchema: { onliId: z.string() },
  },
  async ({ onliId }) => {
    const res = await postJson(`${BASE}/oracle/onli/${encodeURIComponent(onliId)}/verify`, {});
    return textJson(await readBody(res), res.status);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
