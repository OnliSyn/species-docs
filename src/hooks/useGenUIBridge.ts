'use client';

import { useEffect, useRef } from 'react';
import type { UIMessage } from 'ai';
import { useGenUIStore } from '@/stores/genui-store';
import { useTabStore } from '@/stores/tab-store';

// Write tools that require user confirmation
const WRITE_TOOLS = new Set([
  'submit_buy_order',
  'submit_sell_order',
  'submit_transfer_order',
  'transfer_between_accounts',
  'request_withdrawal',
]);

/**
 * Bridge hook — watches useChat messages and extracts gen-ui tool results
 * into the genui-store so they render in the left panel instead of inline.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useGenUIBridge(
  messages: UIMessage[],
  addToolResult: (options: any) => void,
) {
  const processedIds = useRef(new Set<string>());
  const { pushCard, pushConfirmation, clearAll } = useGenUIStore();
  const chatMode = useTabStore((s) => s.chatMode);
  const prevMode = useRef(chatMode);

  // Clear cards on mode switch
  useEffect(() => {
    if (prevMode.current !== chatMode) {
      clearAll();
      processedIds.current.clear();
      prevMode.current = chatMode;
    }
  }, [chatMode, clearAll]);

  // Scan messages for tool parts
  useEffect(() => {
    for (const message of messages) {
      if (message.role !== 'assistant') continue;

      for (const part of message.parts) {
        const p = part as Record<string, unknown>;

        // Only process tool-like parts (AI SDK uses tool-{toolName} as type)
        const partType = String(p.type || '');
        if (partType !== 'tool-invocation' && !partType.startsWith('tool-')) continue;

        const toolCallId = String(p.toolCallId || '');
        if (!toolCallId) continue;

        // --- Output-available: extract gen-ui card ---
        if (p.state === 'output-available' && p.output) {
          const cardKey = `card-${toolCallId}`;
          if (processedIds.current.has(cardKey)) continue;

          let output = p.output as unknown;
          // Unwrap { type: 'text', value: '...' } envelope
          if (typeof output === 'object' && output !== null && 'value' in (output as Record<string, unknown>)) {
            output = (output as Record<string, unknown>).value;
          }
          if (typeof output === 'string') {
            try { output = JSON.parse(output); } catch { /* keep as string */ }
          }

          if (typeof output === 'object' && output !== null && '_ui' in (output as Record<string, unknown>)) {
            const data = output as Record<string, unknown>;
            processedIds.current.add(cardKey);
            pushCard({
              id: toolCallId,
              ui: String(data._ui),
              data,
              toolName: String(p.toolName || partType.replace('tool-', '')),
              timestamp: Date.now(),
            });
          }
        }

        // --- Input-available: write-tool confirmation ---
        if (p.state === 'input-available' && WRITE_TOOLS.has(String(p.toolName))) {
          const confKey = `conf-${toolCallId}`;
          if (processedIds.current.has(confKey)) continue;
          processedIds.current.add(confKey);

          pushConfirmation({
            id: toolCallId,
            toolName: String(p.toolName),
            input: (p.input as Record<string, unknown>) || {},
            onResolve: (approved: boolean) => {
              if (approved) {
                addToolResult({
                  tool: String(p.toolName) as never,
                  toolCallId,
                  output: JSON.stringify({ success: true }),
                });
              } else {
                addToolResult({
                  tool: String(p.toolName) as never,
                  toolCallId,
                  state: 'output-error',
                  errorText: 'User cancelled',
                });
              }
            },
            timestamp: Date.now(),
          });
        }
      }
    }
  }, [messages, pushCard, pushConfirmation, addToolResult]);
}
