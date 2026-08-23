import React, { useEffect } from 'react';

/**
 * Analytics loader.
 *
 * `posthog-js` used to be a static import here, so its ~180 kB landed in the
 * initial bundle of every CRM load — even with no key configured, and even
 * though nothing in the app consumes the PostHog client or its React context
 * (the analytics tab just embeds a shared dashboard URL in an iframe). Loading
 * it dynamically, only when a key exists, keeps it off the critical path
 * entirely: the operator sees the dashboard sooner, and the library arrives
 * afterwards if it is wanted at all.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    let cancelled = false;

    import('posthog-js')
      .then(({ default: posthog }) => {
        if (cancelled || posthog.__loaded) return;
        posthog.init(key, {
          api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
          person_profiles: 'identified_only',
        });
      })
      .catch((err) => {
        // Analytics must never take the CRM down with it.
        console.warn('[Waraqa CRM] Analytics failed to load:', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return <>{children}</>;
}
