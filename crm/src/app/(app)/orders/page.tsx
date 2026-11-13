'use client';

import { useMemo, useState } from 'react';
import type { Order, OrderStatus } from '@data/types';
import { useData } from '@/components/DataProvider';
import { PageHeader } from '@/components/Shell';
import { NEXT_STATUS, OrderDrawer, useStatusChange } from '@/components/OrderDrawer';
import { Badge } from '@/components/ui';
import { ago, cn, hoursSince, money, parseSheetTime } from '@/lib/format';

const COLUMNS: { status: OrderStatus; label: string }[] = [
  { status: 'Pending', label: 'New: confirm' },
  { status: 'Confirmed', label: 'Confirmed' },
  { status: 'Packed', label: 'Packed' },
  { status: 'Shipped', label: 'With courier' },
  { status: 'Delivered', label: 'Delivered' },
];
const CLOSED: OrderStatus[] = ['Cancelled', 'Returned'];
/** Delivered orders older than this drop off the board (search still finds them). */
const DELIVERED_DAYS = 14;

export default function OrdersPage() {
  const { snap } = useData();
  const changeStatus = useStatusChange();
  const [q, setQ] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<OrderStatus | null>(null);
  const [tab, setTab] = useState<OrderStatus>('Pending');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return snap.orders
      .filter((o) => !s || [o.id, o.customerName, o.phone, o.governorate, o.city, o.itemsSummary].some((v) => v.toLowerCase().includes(s)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [snap.orders, q]);

  const columns = [...COLUMNS, ...(showClosed ? CLOSED.map((s) => ({ status: s, label: s })) : [])];
  const inColumn = (status: OrderStatus) =>
    filtered.filter((o) => {
      if (o.status !== status) return false;
      if (status === 'Delivered' && !q) {
        const t = parseSheetTime(o.statusUpdatedAt || o.createdAt);
        return !Number.isFinite(t) || Date.now() - t < DELIVERED_DAYS * 86_400_000;
      }
      return true;
    });

  const drop = (status: OrderStatus, id: string) => {
    const order = snap.orders.find((o) => o.id === id);
    if (order) changeStatus(order, status);
  };

  const tabs = [...COLUMNS, { status: 'Cancelled' as OrderStatus, label: 'Cancelled' }, { status: 'Returned' as OrderStatus, label: 'Returned' }];

  return (
    <>
      <PageHeader
        title="Orders"
        sub={<span className="hidden md:inline">Drag a card to change its status, or open it for details and WhatsApp.</span>}
        actions={
          <>
            <input
              type="search"
              placeholder="Search name, phone, WRQ-…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="flex-1 md:w-64 h-11 md:h-9 px-3 border border-line bg-white text-base md:text-sm focus:outline-none focus:border-maroon"
            />
            <label className="hidden md:flex text-sm items-center gap-2">
              <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
              Cancelled & returned
            </label>
          </>
        }
      />

      {/* Phone: status tabs and a list. */}
      <div className="md:hidden">
        <div className="-mx-4 px-4 flex gap-2 overflow-x-auto pb-3 no-scrollbar" role="tablist">
          {tabs.map((t) => {
            const n = inColumn(t.status).length;
            return (
              <button
                key={t.status}
                role="tab"
                aria-selected={tab === t.status}
                onClick={() => setTab(t.status)}
                className={cn(
                  'shrink-0 h-10 px-3 border text-sm whitespace-nowrap',
                  tab === t.status ? 'bg-maroon text-cream border-maroon' : 'bg-white border-line text-char',
                )}
              >
                {t.label === 'New: confirm' ? 'New' : t.label} <span className={cn('ml-1 tabular-nums', tab === t.status ? 'text-cream/80' : 'text-muted')}>{n}</span>
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {inColumn(tab).map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              slaHours={snap.settings.slaHours}
              onOpen={() => setOpen(o.id)}
              onNext={NEXT_STATUS[o.status] ? () => changeStatus(o, NEXT_STATUS[o.status]!) : undefined}
            />
          ))}
          {!inColumn(tab).length && <div className="text-sm text-muted text-center py-10 bg-white border border-line">No {tab.toLowerCase()} orders{q ? ` matching “${q}”` : ''}.</div>}
        </div>
      </div>

      {/* Desktop: the board. */}
      <div className="hidden md:flex gap-3 overflow-x-auto pb-4">
        {columns.map((col) => {
          const list = inColumn(col.status);
          return (
            <section
              key={col.status}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col.status);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                drop(col.status, e.dataTransfer.getData('text/plain'));
              }}
              className={cn('flex-none w-72 bg-white/60 border border-line flex flex-col max-h-[calc(100vh-12rem)]', dragOver === col.status && 'border-maroon bg-white')}
            >
              <header className="px-3 py-2 border-b border-line flex items-center justify-between">
                <span className="text-sm font-semibold">{col.label}</span>
                <span className="text-xs text-muted tabular-nums">{list.length}</span>
              </header>
              <div className="p-2 space-y-2 overflow-y-auto">
                {list.map((o) => (
                  <OrderCard key={o.id} order={o} slaHours={snap.settings.slaHours} onOpen={() => setOpen(o.id)} draggable />
                ))}
                {!list.length && <div className="text-xs text-muted text-center py-6">Nothing here</div>}
              </div>
            </section>
          );
        })}
      </div>
      <OrderDrawer orderId={open} onClose={() => setOpen(null)} />
    </>
  );
}

function OrderCard({
  order,
  slaHours,
  onOpen,
  onNext,
  draggable,
}: {
  order: Order;
  slaHours: number;
  onOpen: () => void;
  onNext?: () => void;
  draggable?: boolean;
}) {
  const late = order.status === 'Pending' && hoursSince(order.createdAt) > slaHours;
  const next = NEXT_STATUS[order.status];
  return (
    <div className={cn('bg-white border', late ? 'border-error' : 'border-line')}>
      <button
        draggable={draggable}
        onDragStart={(e) => e.dataTransfer.setData('text/plain', order.id)}
        onClick={onOpen}
        className={cn('w-full text-left p-3 hover:bg-cream/40', draggable && 'cursor-grab active:cursor-grabbing')}
      >
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="font-mono">{order.id}</span>
          <span>{ago(order.createdAt)}</span>
        </div>
        <div className="mt-1 font-medium truncate">{order.customerName}</div>
        <div className="text-xs text-muted truncate">{[order.governorate, order.city].filter(Boolean).join(' · ')}</div>
        <div className="text-xs text-muted truncate mt-1">{order.itemsSummary}</div>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-semibold tabular-nums">{money(order.total)}</span>
          <span className="flex gap-1">
            {late && <Badge tone="Cancelled">Late</Badge>}
            {order.whatsappSent ? <Badge tone="Delivered">WA ✓</Badge> : order.status === 'Pending' ? <Badge tone="Pending">WA</Badge> : null}
          </span>
        </div>
      </button>
      {onNext && next && (
        <button onClick={onNext} className="w-full h-11 border-t border-line text-sm font-medium text-maroon active:bg-cream">
          Mark {next} →
        </button>
      )}
    </div>
  );
}
