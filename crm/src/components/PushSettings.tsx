'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PushDevice } from '@/lib/data-api';
import { addPushDevice, pushConfig, pushDevices, removePushDevice, testPush } from '@/app/actions';
import { useData } from './DataProvider';
import { Button, Card } from './ui';

type State = 'loading' | 'unsupported' | 'ios-install' | 'server-off' | 'denied' | 'off' | 'on';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const device = /iphone/i.test(ua) ? 'iPhone' : /ipad/i.test(ua) ? 'iPad' : /android/i.test(ua) ? 'Android phone' : /mac/i.test(ua) ? 'Mac' : /windows/i.test(ua) ? 'Windows PC' : 'Computer';
  const browser = /edg\//i.test(ua) ? 'Edge' : /chrome|crios/i.test(ua) ? 'Chrome' : /firefox|fxios/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : '';
  return `${device}${browser && !isStandalone() ? ` · ${browser}` : ''}${isStandalone() ? ' · app' : ''}`;
}

/** Same id the data Worker gives a device: first 8 bytes of SHA-256(endpoint), hex. */
async function deviceId(endpoint: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)));
  return [...h.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function PushSettings() {
  const { toast } = useData();
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<PushDevice[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);

  const refresh = useCallback(async () => {
    const list = await pushDevices().catch(() => [] as PushDevice[]);
    setDevices(list);
    if (!pushSupported()) return setState(isIOS() && !isStandalone() ? 'ios-install' : 'unsupported');
    if (isIOS() && !isStandalone()) return setState('ios-install');
    const { publicKey } = await pushConfig();
    if (!publicKey) return setState('server-off');
    if (Notification.permission === 'denied') return setState('denied');
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    const id = sub ? await deviceId(sub.endpoint) : null;
    setMyId(id);
    // "On" only if the server still has this device (it drops ones that stop
    // accepting pushes, or someone pressed Remove), else offer to turn it on.
    setState(id && list.some((d) => d.id === id) ? 'on' : 'off');
  }, []);

  useEffect(() => {
    refresh();
    setInstalled(isStandalone());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', () => setInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [refresh]);

  const turnOn = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const { publicKey } = await pushConfig();
      if (!publicKey) return setState('server-off');
      const reg = await navigator.serviceWorker.ready;
      const key = keyBytes(publicKey);
      let sub = await reg.pushManager.getSubscription();
      // A subscription made with an older key pair would be rejected on every push.
      if (sub && !sameKey(sub.options.applicationServerKey, key)) {
        await removePushDevice(sub.endpoint).catch(() => undefined);
        await sub.unsubscribe().catch(() => undefined);
        sub = null;
      }
      sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const res = await addPushDevice(sub.toJSON(), deviceLabel());
      if (!res.ok) {
        toast('error', res.error);
        await sub.unsubscribe().catch(() => undefined);
      } else toast('ok', 'Order notifications are on for this device');
    } catch (err) {
      toast('error', `Couldn’t turn notifications on: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushDevice(sub.endpoint);
        await sub.unsubscribe();
      }
      toast('ok', 'Notifications are off for this device');
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const sendTest = async () => {
    setBusy(true);
    const res = await testPush();
    setBusy(false);
    if (res.ok) toast('ok', `Test sent to ${res.sent} device${res.sent === 1 ? '' : 's'}${res.removed ? ` (${res.removed} gone, removed)` : ''}`);
    else toast('error', res.error);
    refresh();
  };

  const removeOther = async (d: PushDevice) => {
    if (!confirm(`Stop sending order notifications to ${d.label}?`)) return;
    await removePushDevice(d.id);
    refresh();
  };

  return (
    <Card title="Order notifications">
      <div className="space-y-4 text-sm">
        <p className="text-muted">Get a notification on this phone or computer the moment a new order comes in, even when the CRM is closed.</p>

        {state === 'loading' && <p className="text-muted">Checking this device…</p>}

        {state === 'ios-install' && (
          <div className="bg-cream/60 border border-line p-3 space-y-2">
            <p className="font-medium">On iPhone, add the CRM to your Home Screen first</p>
            <ol className="list-decimal pl-5 space-y-1 text-char/85">
              <li>
                In Safari, tap the <strong>Share</strong> button (square with an arrow).
              </li>
              <li>
                Tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
              </li>
              <li>Open Waraqa from the new icon, come back here and turn notifications on.</li>
            </ol>
            <p className="text-xs text-muted">Apple only allows web notifications for installed apps (iOS 16.4 or newer).</p>
          </div>
        )}

        {state === 'unsupported' && <p className="text-warning">This browser can’t receive web notifications. Try Chrome on Android or a computer, or the installed app on iPhone.</p>}

        {state === 'server-off' && <p className="text-warning">Notifications aren’t set up on the server yet.</p>}

        {state === 'denied' && (
          <div className="bg-warning/10 border border-warning/30 p-3">
            Notifications are blocked for this site. Allow them in your browser or phone settings (Site settings → Notifications → crm.waraqa.art), then reload this page.
          </div>
        )}

        {(state === 'off' || state === 'on') && (
          <div className="flex flex-wrap items-center gap-2">
            {state === 'off' ? (
              <Button variant="primary" disabled={busy} onClick={turnOn} className="w-full sm:w-auto">
                {busy ? 'Turning on…' : 'Turn on for this device'}
              </Button>
            ) : (
              <>
                <span className="inline-flex items-center gap-2 text-success font-medium mr-2">
                  <span className="w-2 h-2 rounded-full bg-success" /> On for this device
                </span>
                <Button disabled={busy} onClick={sendTest}>
                  Send a test
                </Button>
                <Button variant="ghost" disabled={busy} onClick={turnOff}>
                  Turn off
                </Button>
              </>
            )}
          </div>
        )}

        {!installed && install && (
          <Button
            onClick={async () => {
              await install.prompt();
              const { outcome } = await install.userChoice;
              if (outcome === 'accepted') setInstalled(true);
              setInstall(null);
            }}
          >
            Install the app on this device
          </Button>
        )}

        {devices.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wide text-muted mb-1">Getting notifications</div>
            <ul className="divide-y divide-line border border-line bg-white">
              {devices.map((d) => {
                const mine = myId !== null && d.id === myId;
                return (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0">
                      {d.label}
                      {mine && <span className="text-muted"> (this device)</span>}
                      <div className="text-xs text-muted">
                        added {d.addedAt.slice(0, 10)} · {d.lastOkAt ? `last notified ${d.lastOkAt}` : 'not notified yet'}
                      </div>
                    </span>
                    {!mine && (
                      <button className="text-xs text-error underline" onClick={() => removeOther(d)}>
                        Remove
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
