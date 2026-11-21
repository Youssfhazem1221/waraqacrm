import type { Metadata, Viewport } from 'next';
import { Readex_Pro } from 'next/font/google';
import './globals.css';
import { RegisterServiceWorker } from '@/components/RegisterServiceWorker';

const readex = Readex_Pro({ subsets: ['latin', 'arabic'], variable: '--font-readex', display: 'swap' });

export const metadata: Metadata = {
  title: 'Waraqa CRM',
  robots: { index: false, follow: false },
  // Home-screen app on iPhone: its own icon and name, opens full screen.
  appleWebApp: { capable: true, title: 'Waraqa', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = { themeColor: '#201513', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={readex.variable}>
      <body className="antialiased">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
