import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import type { WsEvent } from '../sim-species/pipeline.js';

interface WsClient {
  ws: WebSocket;
  eventId: string;
}

export interface WsBroadcaster {
  /** Emit a stage event to all clients subscribed to this eventId */
  emit: (eventId: string, event: WsEvent) => void;
  /** Close all connections and shut down the server */
  close: () => void;
}

/**
 * Create a WebSocket server attached to an HTTP server.
 * Clients connect to /events/:eventId/stream to receive pipeline events.
 */
export function createWsServer(httpServer: HttpServer): WsBroadcaster {
  const wss = new WebSocketServer({ server: httpServer, path: undefined });
  const clients: Map<string, Set<WebSocket>> = new Map();

  // Handle upgrade manually to support path-based routing
  httpServer.on('upgrade', (request, socket, head) => {
    const url = request.url ?? '';
    const match = url.match(/^\/events\/([^/]+)\/stream$/);

    if (!match) {
      // Not a valid WS path — let it fail
      socket.destroy();
      return;
    }

    const eventId = match[1];

    wss.handleUpgrade(request, socket, head, (ws) => {
      // Register client for this eventId
      if (!clients.has(eventId)) {
        clients.set(eventId, new Set());
      }
      clients.get(eventId)!.add(ws);

      ws.on('close', () => {
        const set = clients.get(eventId);
        if (set) {
          set.delete(ws);
          if (set.size === 0) {
            clients.delete(eventId);
          }
        }
      });

      ws.on('error', () => {
        const set = clients.get(eventId);
        if (set) {
          set.delete(ws);
        }
      });

      // Send a connected acknowledgment
      ws.send(
        JSON.stringify({
          source: 'species',
          eventId,
          stage: 'ws.connected',
          timestamp: new Date().toISOString(),
          data: { message: 'Connected to event stream' },
        }),
      );
    });
  });

  const emit = (eventId: string, event: WsEvent) => {
    const subscribers = clients.get(eventId);
    if (!subscribers) return;

    const message = JSON.stringify(event);
    for (const ws of subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }

    // Close connections on terminal events
    if (event.stage === 'order.completed' || event.stage === 'order.failed') {
      for (const ws of subscribers) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, event.stage);
        }
      }
      clients.delete(eventId);
    }
  };

  const close = () => {
    for (const [, set] of clients) {
      for (const ws of set) {
        ws.close(1000, 'server_shutdown');
      }
    }
    clients.clear();
    wss.close();
  };

  return { emit, close };
}
