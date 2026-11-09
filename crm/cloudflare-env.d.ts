// Bindings available through getCloudflareContext().env.
// Written by hand (not `wrangler types`) so DATA is typed by the data Worker's
// AdminApi without pulling Worker runtime types into the Next.js program.
import type { DataApi } from '@/lib/data-api';

declare global {
  interface CloudflareEnv {
    DATA: DataApi;
    LOGIN_LIMITER?: { limit(opts: { key: string }): Promise<{ success: boolean }> };
    CRM_PASSWORD: string;
    SESSION_SECRET: string;
    ASSETS: unknown;
  }
}

export {};
