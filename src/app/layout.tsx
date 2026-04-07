import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', weight: ['200', '400', '500', '600', '700'] });

export const metadata: Metadata = {
  title: 'Onli Synth',
  description: 'Unified financial and asset operations dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
