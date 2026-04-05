/**
 * MCP server — proxies @marketsb/sim HTTP API for AI tools (stdio transport).
 * Env: MARKETSB_URL (default http://localhost:4001) — origin only, no /api/v1 suffix.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE = (process.env.MARKETSB_URL ?? 'http://localhost:4001').replace(/\/$/, '');
const API = `${BASE}/api/v1`;

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

async function get(path: string): Promise<Response> {
  return fetch(`${API}${path.startsWith('/') ? path : `/${path}`}`, {
    signal: AbortSignal.timeout(15_000),
  });
}

async function getSim(path: string): Promise<Response> {
  return fetch(`${BASE}${path.startsWith('/') ? path : `/${path}`}`, {
    signal: AbortSignal.timeout(15_000),
  });
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
    name: 'onli-marketsb-sim',
    version: '0.1.0',
  },
  {
    instructions: `Tools for the MarketSB simulator (${BASE}). Use for virtual accounts, oracle ledgers, cashier post-batch, reconciliation, and sim control. Pair with the Species MCP for marketplace pipelines.`,
  },
);

server.registerTool(
  'marketsb_agent_context',
  {
    description: 'LLM-oriented map of the Cashier spec, fees, and how Species calls post-batch.',
  },
  async () => {
    const res = await get('/agentContext');
    return textJson(await readBody(res), res.status);
  },
);

server.registerTool(
  'marketsb_get_virtual_account',
  {
    description: 'GET virtual account balance DTO by vaId (e.g. va-funding-user-001, treasury-100).',
    inputSchema: { vaId: z.string().describe('Virtual account id') },
  },
  async ({ vaId }) => {
    const res = await get(`/virtual-accounts/${encodeURIComponent(vaId)}`);
    return textJson(await readBody(res), res.status);
  },
);

server.registerTool(
  'marketsb_list_virtual_accounts',
  {
    description: 'List virtual accounts; optional filter by ownerRef.',
    inputSchema: {
      ownerRef: z.string().optional().describe('Filter by owner reference'),
    },
  },
  async (args) => {
    const q = args.ownerRef ? `?ownerRef=${encodeURIComponent(args.ownerRef)}` : '';
    const res = await get(`/virtual-accounts${q}`);
    return textJson(await readBody(res), res.status);
  },
);

server.registerTool(
  'marketsb_get_oracle_ledger',
  {
    description: 'Oracle ledger entries for a virtual account.',
    inputSchema: {
      vaId: z.string().describe('Virtual account id'),
      limit: z.number().int().min(1).max(200).optional().default(50),
    },
  },
  async ({ vaId, limit }) => {
    const res = await get(`/oracle/virtual-accounts/${encodeURIComponent(vaId)}/ledger`);
    const data = await readBody(res);
    if (Array.isArray(data) && limit) {
      return textJson(data.slice(0, limit), res.status);
    }
    return textJson(data, res.status);
  },
);

server.registerTool(
  'marketsb_get_reconciliation_status',
  {
    description: 'Reconciliation snapshot from the sim.',
  },
  async () => {
    const res = await get('/reconciliation/status');
    return textJson(await readBody(res), res.status);
  },
);

server.registerTool(
  'marketsb_get_sim_state',
  {
    description: 'Full simulator state (VAs, deposits, oracle, cashier maps) — dev/debug.',
  },
  async () => {
    const res = await getSim('/sim/state');
    return textJson(await readBody(res), res.status);
  },
);

server.registerTool(
  'marketsb_post_cashier_batch',
  {
    description:
      'POST /cashier/post-batch — executes a buy/sell batch on the sim (mutates balances).',
    inputSchema: {
      eventId: z.string(),
      matchId: z.string(),
      intent: z.enum(['buy', 'sell']),
      quantity: z.union([z.string(), z.number()]),
      buyerVaId: z.string(),
      sellerVaId: z.string().optional(),
      unitPrice: z.union([z.string(), z.number()]),
      fees: z
        .object({
          issuance: z.boolean().optional(),
          liquidity: z.boolean().optional(),
          listing: z.boolean().optional(),
        })
        .optional(),
    },
    annotations: writeMeta,
  },
  async (body) => {
    const res = await postJson(`${API}/cashier/post-batch`, body);
    return textJson(await readBody(res), res.status);
  },
);

server.registerTool(
  'marketsb_reset_sim',
  {
    description: 'POST /sim/reset — re-seed MarketSB sim state (destructive).',
    annotations: writeMeta,
  },
  async () => {
    const res = await postJson(`${BASE}/sim/reset`, {});
    return textJson(await readBody(res), res.status);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
