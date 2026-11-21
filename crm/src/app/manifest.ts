import type { MetadataRoute } from 'next';

// Makes the CRM installable ("Add to Home Screen"): its own icon, full screen,
// and on iPhone the only way web notifications are allowed at all.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Waraqa CRM',
    short_name: 'Waraqa',
    description: 'Orders, products, shipping and customers for Waraqa.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#201513',
    theme_color: '#201513',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Orders', url: '/orders', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Products', url: '/products', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
