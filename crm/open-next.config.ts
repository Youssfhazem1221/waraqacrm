import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Every CRM page is dynamic and per-user, so there is nothing to cache.
export default defineCloudflareConfig({});
