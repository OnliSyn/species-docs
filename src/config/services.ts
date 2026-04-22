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
