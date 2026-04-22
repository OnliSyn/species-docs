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
