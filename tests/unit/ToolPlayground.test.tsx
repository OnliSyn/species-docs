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
