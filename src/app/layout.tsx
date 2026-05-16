import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { PwaRegister } from '@/components/pwa/PwaRegister';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reel Mobile',
  description: 'A mobile-first browser fishing feel experiment.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Reel Mobile',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Reel Mobile'
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icon.svg' }]
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#3d6068'
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
