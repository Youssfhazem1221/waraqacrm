'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Snapshot } from '@data/types';
import { loadSnapshot, type ActionResult } from '@/app/actions';

type Toast = { id: number; kind: 'ok' | 'error' | 'warn'; text: string };

interface DataContext {
  snap: Snapshot;
  syncing: boolean;
  syncError: string | null;
  /** Re-read the Sheet. `fresh` skips the data Worker's 15-second cache. */
  refresh: (fresh?: boolean) => Promise<void>;
  /**
   * Run a server action, show what happened, and replace local data with the
   * Sheet as it is after the write. Returns true when it saved.
   */
  run: <T extends object>(action: Promise<ActionResult<T>>, okText?: string) => Promise<(ActionResult<T>['result'] & { ok: true }) | null>;
  toast: (kind: Toast['kind'], text: string) => void;
}

const Ctx = createContext<DataContext | null>(null);

export function useData() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData outside DataProvider');
  return c;
}

const POLL_MS = 30_000;

export function DataProvider({ initial, children }: { initial: Snapshot; children: ReactNode }) {
  const [snap, setSnap] = useState(initial);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const toast = useCallback((kind: Toast['kind'], text: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 8000 : 3500);
  }, []);

  const refresh = useCallback(async (fresh = false) => {
    setSyncing(true);
    try {
      const res = await loadSnapshot(fresh);
      if (res.snapshot) {
        setSnap(res.snapshot);
        setSyncError(null);
      } else {
        setSyncError(res.error ?? 'Could not reach the Sheet.');
        if (res.error?.startsWith('Signed out')) window.location.href = '/login';
      }
    } catch {
      setSyncError('Could not reach the CRM server.');
    } finally {
      setSyncing(false);
    }
  }, []);

  const run = useCallback<DataContext['run']>(
    async (action, okText) => {
      setSyncing(true);
      try {
        const { result, snapshot } = await action;
        if (snapshot) setSnap(snapshot);
        if (result.ok) {
          if (okText) toast('ok', okText);
          return result as never;
        }
        toast(result.conflict ? 'warn' : 'error', result.error);
        if (result.error.startsWith('Signed out')) window.location.href = '/login';
        return null;
      } catch (err) {
        toast('error', err instanceof Error ? err.message : 'Save failed.');
        return null;
      } finally {
        setSyncing(false);
      }
    },
    [toast],
  );

  // New store orders and hand edits in the Sheet show up without a manual refresh.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refresh]);

  return (
    <Ctx.Provider value={{ snap, syncing, syncError, refresh, run, toast }}>
      {children}
      <div className="fixed bottom-20 md:bottom-4 right-4 z-50 flex flex-col gap-2 w-[min(92vw,380px)]" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              'border px-4 py-3 text-sm bg-white ' +
              (t.kind === 'ok' ? 'border-success text-success' : t.kind === 'warn' ? 'border-warning text-char' : 'border-error text-error')
            }
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
