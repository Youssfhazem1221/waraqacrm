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

function SyncStatus() {
  const { snap, syncing, syncError, refresh } = useData();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-3 text-xs">
      {/* "Synced 3s ago" differs by a second between server and browser render. */}
      <span suppressHydrationWarning className={cn('inline-flex items-center gap-1.5', syncError ? 'text-error' : 'text-muted')} title={syncError ?? undefined}>
        <span className={cn('w-2 h-2 rounded-full', syncError ? 'bg-error' : syncing ? 'bg-warning animate-pulse' : 'bg-success')} />
        {syncError ? 'Not synced: showing last copy' : syncing ? 'Syncing…' : `Synced ${ago(snap.readAt)}`}
      </span>
      <button className="underline text-char disabled:opacity-50" disabled={syncing} onClick={() => refresh(true)}>
        Refresh
      </button>
      <a className="underline text-char hidden sm:inline" href={snap.sheetUrl} target="_blank" rel="noreferrer">
        Open Sheet
      </a>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { snap } = useData();
  const pending = snap.orders.filter((o) => o.status === 'Pending').length;
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <div className="min-h-screen md:pl-56">
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
              className={cn(
                'flex items-center gap-3 px-5 py-2.5 text-sm',
                active(n.href) ? 'bg-maroon text-cream' : 'text-cream/80 hover:bg-white/5',
              )}
            >
              <span className="w-4 text-center" aria-hidden>
                {n.icon}
              </span>
              {n.label}
              {n.href === '/orders' && pending > 0 && (
                <span className="ml-auto text-xs bg-warning text-esp px-1.5">{pending}</span>
              )}
            </Link>
          ))}
        </nav>
        <form action={logout} className="p-4 border-t border-white/10">
          <button className="text-xs text-cream/70 underline">Sign out</button>
        </form>
      </aside>

      <header className="sticky top-0 z-30 bg-cream/95 backdrop-blur border-b border-line px-4 md:px-8 py-3 flex items-center justify-between gap-4">
        <div className="md:hidden font-semibold">Waraqa CRM</div>
        <div className="ml-auto">
          <SyncStatus />
        </div>
      </header>

      <main className="px-4 md:px-8 py-6 pb-24 md:pb-10 max-w-[1400px]">{children}</main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-esp text-cream grid grid-cols-5 text-[11px]">
        {NAV.filter((n) => ['/', '/orders', '/products', '/customers', '/settings'].includes(n.href)).map((n) => (
          <Link key={n.href} href={n.href} className={cn('flex flex-col items-center py-2', active(n.href) ? 'bg-maroon' : '')}>
            <span aria-hidden>{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-char">{title}</h1>
        {sub && <p className="text-sm text-muted mt-1">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
