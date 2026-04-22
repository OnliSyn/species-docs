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
