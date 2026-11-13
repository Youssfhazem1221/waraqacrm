'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Snapshot } from '@data/types';
import { loadSnapshot, type ActionResult } from '@/app/actions';

type Toast = { id: number; kind: 'ok' | 'error' | 'warn'; text: string };
type Optimistic = (s: Snapshot) => Snapshot;

interface DataContext {
  snap: Snapshot;
  syncing: boolean;
  /** Saves still on their way to the Sheet. */
  pending: number;
  /** When the last save finished (ms), for a brief "Saved" in the header. */
  savedAt: number;
  syncError: string | null;
  /** Re-read the Sheet. `fresh` skips the data Worker's 15-second cache. */
  refresh: (fresh?: boolean) => Promise<void>;
  /**
   * Run a server action. `optimistic` changes the screen at once; the Sheet's
   * answer then replaces it (and a failed save puts the old values back).
   * Returns the result when it saved, else null.
   */
  run: <T extends object>(
    action: Promise<ActionResult<T>>,
    okText?: string,
    optimistic?: Optimistic,
  ) => Promise<(ActionResult<T>['result'] & { ok: true }) | null>;
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
  const snapRef = useRef(initial);
  const [syncing, setSyncing] = useState(false);
  const [pending, setPending] = useState(0);
  const pendingRef = useRef(0);
  const [savedAt, setSavedAt] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const apply = useCallback((next: Snapshot) => {
    snapRef.current = next;
    setSnap(next);
  }, []);

  const toast = useCallback((kind: Toast['kind'], text: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 8000 : 3000);
  }, []);

  const refresh = useCallback(
    async (fresh = false) => {
      setSyncing(true);
      try {
        const res = await loadSnapshot(fresh);
        // A save started meanwhile: its answer is newer than this read.
        if (pendingRef.current > 0) return;
        if (res.snapshot) {
          apply(res.snapshot);
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
    },
    [apply],
  );

  const run = useCallback<DataContext['run']>(
    async (action, okText, optimistic) => {
      const before = snapRef.current;
      if (optimistic) apply(optimistic(before));
      pendingRef.current++;
      setPending(pendingRef.current);
      try {
        const { result, snapshot } = await action;
        // Only the last save in a burst writes the Sheet's answer back, so a
        // quick second edit isn't briefly undone by the first one's reply.
        if (snapshot && pendingRef.current === 1) apply(snapshot);
        if (result.ok) {
          if (okText) toast('ok', okText);
          setSavedAt(Date.now());
          return result as never;
        }
        if (!snapshot && optimistic) apply(before);
        toast(result.conflict ? 'warn' : 'error', result.error);
        if (result.error.startsWith('Signed out')) window.location.href = '/login';
        return null;
      } catch (err) {
        if (optimistic) apply(before);
        toast('error', err instanceof Error ? `Not saved: ${err.message}` : 'Not saved. Check your connection and try again.');
        return null;
      } finally {
        pendingRef.current--;
        setPending(pendingRef.current);
      }
    },
    [apply, toast],
  );

  // New store orders and hand edits in the Sheet show up without a manual refresh.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible' && pendingRef.current === 0) refresh();
    };
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refresh]);

  return (
    <Ctx.Provider value={{ snap, syncing, pending, savedAt, syncError, refresh, run, toast }}>
      {children}
      <div className="fixed bottom-20 md:bottom-4 inset-x-4 md:inset-x-auto md:right-4 z-50 flex flex-col gap-2 md:w-[380px]" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              'border px-4 py-3 text-sm bg-white shadow-lg ' +
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
