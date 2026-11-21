// ============================================================
// Order notifications: Web Push (RFC 8030/8291/8292) to every device that
// turned them on in the CRM. Subscriptions are kept in the SheetStore Durable
// Object's own storage, not the Sheet: a subscription is a delivery address
// with keys, and nobody needs to see or edit it by hand.
// ============================================================

import { buildPushPayload, type PushSubscription, type VapidKeys } from '@block65/webcrypto-web-push';

export interface PushEnv {
  /** Public VAPID key (base64url, 65-byte point). Not secret: the browser needs it. */
  VAPID_PUBLIC_KEY?: string;
  /** Private VAPID key (base64url `d`). Secret. */
  VAPID_PRIVATE_KEY?: string;
  /** mailto: or https: contact the push services can reach. */
  VAPID_SUBJECT?: string;
}

export interface Device {
  /** Short id derived from the endpoint, for removing it. */
  id: string;
  label: string;
  addedAt: string;
  lastOkAt?: string;
}

interface StoredDevice extends Device {
  subscription: PushSubscription;
}

export interface Notice {
  title: string;
  body: string;
  /** Path in the CRM to open when tapped, e.g. /orders?open=WRQ-1022 */
  url: string;
  /** Same tag replaces an earlier notification instead of stacking. */
  tag?: string;
}

const PREFIX = 'push:';

async function idFor(endpoint: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)));
  return [...h.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function pushReady(env: PushEnv): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
}

export function validSubscription(s: unknown): s is PushSubscription {
  const x = s as PushSubscription;
  return (
    !!x &&
    typeof x.endpoint === 'string' &&
    /^https:\/\//.test(x.endpoint) &&
    x.endpoint.length < 1000 &&
    typeof x.keys?.p256dh === 'string' &&
    typeof x.keys?.auth === 'string'
  );
}

export async function addDevice(storage: DurableObjectStorage, sub: PushSubscription, label: string, now: string): Promise<Device> {
  const id = await idFor(sub.endpoint);
  const device: StoredDevice = {
    id,
    label: String(label || 'Device').slice(0, 60),
    addedAt: now,
    subscription: { endpoint: sub.endpoint, expirationTime: null, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
  };
  await storage.put(PREFIX + id, device);
  return { id, label: device.label, addedAt: now };
}

export async function removeDevice(storage: DurableObjectStorage, idOrEndpoint: string): Promise<void> {
  const id = /^https:/.test(idOrEndpoint) ? await idFor(idOrEndpoint) : idOrEndpoint;
  await storage.delete(PREFIX + id);
}

export async function listDevices(storage: DurableObjectStorage): Promise<Device[]> {
  const all = await storage.list<StoredDevice>({ prefix: PREFIX });
  return [...all.values()].map(({ subscription: _s, ...d }) => d).sort((a, b) => a.addedAt.localeCompare(b.addedAt));
}

/**
 * Send to every device. A device the push service says is gone (404/410:
 * uninstalled, permission withdrawn) is forgotten. Returns how many accepted.
 */
export async function sendToAll(storage: DurableObjectStorage, env: PushEnv, notice: Notice, now: string): Promise<{ sent: number; failed: number; removed: number }> {
  if (!pushReady(env)) return { sent: 0, failed: 0, removed: 0 };
  const vapid: VapidKeys = { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  const all = await storage.list<StoredDevice>({ prefix: PREFIX });
  let sent = 0;
  let failed = 0;
  let removed = 0;
  await Promise.all(
    [...all.entries()].map(async ([key, d]) => {
      try {
        const payload = await buildPushPayload(
          // Urgency high: phones deliver it right away instead of batching.
          { data: JSON.stringify(notice), options: { ttl: 24 * 60 * 60, urgency: 'high', topic: notice.tag?.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) } },
          d.subscription,
          vapid,
        );
        const res = await fetch(d.subscription.endpoint, payload);
        if (res.status === 404 || res.status === 410) {
          await storage.delete(key);
          removed++;
        } else if (res.ok) {
          sent++;
          await storage.put(key, { ...d, lastOkAt: now });
        } else {
          failed++;
          console.warn('[push] HTTP', res.status, d.label, (await res.text()).slice(0, 200));
        }
      } catch (err) {
        failed++;
        console.warn('[push] failed', d.label, err);
      }
    }),
  );
  return { sent, failed, removed };
}
