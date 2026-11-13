'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useData } from './DataProvider';
import { ago, cn } from '@/lib/format';
import { logout } from '@/app/actions';

const NAV = [
  { href: '/', label: 'Today', icon: '◎' },
  { href: '/orders', label: 'Orders', icon: '▤' },
  { href: '/products', label: 'Products', icon: '▦' },
  { href: '/shipping', label: 'Shipping', icon: '⇄' },
  { href: '/customers', label: 'Customers', icon: '☺' },
  { href: '/analytics', label: 'Analytics', icon: '◢' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];
const PHONE_BAR = ['/', '/orders', '/products', '/shipping'];

function SyncStatus() {
  const { snap, syncing, pending, savedAt, syncError, refresh } = useData();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const justSaved = pending === 0 && Date.now() - savedAt < 2500;
  const label = syncError
    ? 'Offline: showing last copy'
    : pending > 0
      ? 'Saving…'
      : justSaved
        ? 'Saved ✓'
        : syncing
          ? 'Syncing…'
          : `Synced ${ago(snap.readAt)}`;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span suppressHydrationWarning className={cn('inline-flex items-center gap-1.5', syncError ? 'text-error' : justSaved ? 'text-success' : 'text-muted')} title={syncError ?? undefined}>
        <span className={cn('w-2 h-2 rounded-full', syncError ? 'bg-error' : pending > 0 || syncing ? 'bg-warning animate-pulse' : 'bg-success')} />
        {label}
      </span>
      <button
        className="h-9 px-2 border border-line bg-white text-char disabled:opacity-50"
        disabled={syncing || pending > 0}
        onClick={() => refresh(true)}
        aria-label="Refresh from the Sheet"
      >
        ↻<span className="hidden sm:inline"> Refresh</span>
      </button>
      <a className="hidden sm:inline underline text-char" href={snap.sheetUrl} target="_blank" rel="noreferrer">
        Open Sheet
      </a>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { snap } = useData();
  const [more, setMore] = useState(false);
  const pending = snap.orders.filter((o) => o.status === 'Pending').length;
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  useEffect(() => setMore(false), [path]);

  return (
    <div className="min-h-screen md:pl-56 overflow-x-hidden">
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-56 flex-col bg-esp text-cream">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="text-lg font-semibold">ورقة · Waraqa</div>
          <div className="text-xs text-kraft">Operations</div>
        </div>
        <nav className="flex-1 py-3">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn('flex items-center gap-3 px-5 py-2.5 text-sm', active(n.href) ? 'bg-maroon text-cream' : 'text-cream/80 hover:bg-white/5')}
            >
              <span className="w-4 text-center" aria-hidden>
                {n.icon}
              </span>
              {n.label}
              {n.href === '/orders' && pending > 0 && <span className="ml-auto text-xs bg-warning text-esp px-1.5">{pending}</span>}
            </Link>
          ))}
        </nav>
        <form action={logout} className="p-4 border-t border-white/10">
          <button className="text-xs text-cream/70 underline">Sign out</button>
        </form>
      </aside>

      <header className="sticky top-0 z-30 bg-cream/95 backdrop-blur border-b border-line px-4 md:px-8 h-14 flex items-center justify-between gap-3">
        <div className="md:hidden font-semibold truncate">Waraqa</div>
        <div className="ml-auto">
          <SyncStatus />
        </div>
      </header>

      <main className="px-4 md:px-8 py-5 md:py-6 pb-28 md:pb-10 max-w-[1400px]">{children}</main>

      {/* Phone navigation: the four daily screens, and More for the rest. */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-esp text-cream grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {NAV.filter((n) => PHONE_BAR.includes(n.href)).map((n) => (
          <Link key={n.href} href={n.href} className={cn('relative flex flex-col items-center justify-center gap-0.5 h-14 text-[11px]', active(n.href) ? 'bg-maroon' : '')}>
            <span aria-hidden className="text-base leading-none">
              {n.icon}
            </span>
            {n.label}
            {n.href === '/orders' && pending > 0 && <span className="absolute top-1.5 right-3 min-w-4 h-4 px-1 text-[10px] leading-4 bg-warning text-esp rounded-full">{pending}</span>}
          </Link>
        ))}
        <button
          onClick={() => setMore((m) => !m)}
          className={cn('flex flex-col items-center justify-center gap-0.5 h-14 text-[11px]', more || NAV.slice(4).some((n) => active(n.href)) ? 'bg-maroon' : '')}
          aria-expanded={more}
        >
          <span aria-hidden className="text-base leading-none">⋯</span>
          More
        </button>
      </nav>
      {more && (
        <div className="md:hidden fixed inset-0 z-30" onClick={() => setMore(false)}>
          <div className="absolute inset-0 bg-esp/40" />
          <div className="absolute inset-x-0 bottom-14 bg-cream border-t border-line pb-[env(safe-area-inset-bottom)]" onClick={(e) => e.stopPropagation()}>
            {NAV.slice(4).map((n) => (
              <Link key={n.href} href={n.href} className={cn('flex items-center gap-3 px-5 h-14 border-b border-line text-base', active(n.href) && 'font-semibold text-maroon')}>
                <span className="w-5 text-center" aria-hidden>
                  {n.icon}
                </span>
                {n.label}
              </Link>
            ))}
            <form action={logout}>
              <button className="w-full text-left px-5 h-14 text-base text-muted">Sign out</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5 md:mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-char">{title}</h1>
        {sub && <p className="text-sm text-muted mt-1 max-w-3xl">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">{actions}</div>}
    </div>
  );
}
