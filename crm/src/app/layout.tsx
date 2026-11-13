import type { Metadata, Viewport } from 'next';
import { Readex_Pro } from 'next/font/google';
import './globals.css';

const readex = Readex_Pro({ subsets: ['latin', 'arabic'], variable: '--font-readex', display: 'swap' });

export const metadata: Metadata = {
  title: 'Waraqa CRM',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#201513', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={readex.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
