'use client';

import { useEffect } from 'react';

/** Registers /sw.js, which shows order notifications. It caches nothing. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  return null;
}
