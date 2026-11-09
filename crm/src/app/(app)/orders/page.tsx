'use client';

import { useMemo, useState } from 'react';
import type { Order, OrderStatus } from '@data/types';
import { useData } from '@/components/DataProvider';
import { PageHeader } from '@/components/Shell';
import { OrderDrawer, useStatusChange } from '@/components/OrderDrawer';
import { Badge, Input } from '@/components/ui';
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

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return snap.orders
      .filter((o) =>
        !s ||
        [o.id, o.customerName, o.phone, o.governorate, o.city, o.itemsSummary].some((v) => v.toLowerCase().includes(s)),
      )
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

  return (
    <>
      <PageHeader
        title="Orders"
        sub="Drag a card to change its status, or open it for details and WhatsApp."
        actions={
          <>
            <Input placeholder="Search name, phone, WRQ-…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
              Cancelled & returned
            </label>
          </>
        }
      />
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0">
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
                  <OrderCard key={o.id} order={o} slaHours={snap.settings.slaHours} onOpen={() => setOpen(o.id)} />
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

function OrderCard({ order, slaHours, onOpen }: { order: Order; slaHours: number; onOpen: () => void }) {
  const late = order.status === 'Pending' && hoursSince(order.createdAt) > slaHours;
  return (
    <button
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', order.id)}
      onClick={onOpen}
      className={cn('w-full text-left bg-white border p-3 hover:border-maroon cursor-grab active:cursor-grabbing', late ? 'border-error' : 'border-line')}
    >
      <div className="flex items-center justify-between text-xs text-muted">
        <span className="font-mono">{order.id}</span>
        <span>{ago(order.createdAt)}</span>
      </div>
      <div className="mt-1 font-medium text-sm truncate">{order.customerName}</div>
      <div className="text-xs text-muted truncate">{[order.governorate, order.city].filter(Boolean).join(' · ')}</div>
      <div className="text-xs text-muted truncate mt-1">{order.itemsSummary}</div>
      <div className="mt-2 flex items-center justify-between">
        <span className="font-semibold text-sm tabular-nums">{money(order.total)}</span>
        <span className="flex gap-1">
          {late && <Badge tone="Cancelled">Late</Badge>}
          {order.whatsappSent ? <Badge tone="Delivered">WA ✓</Badge> : order.status === 'Pending' ? <Badge tone="Pending">WA</Badge> : null}
        </span>
      </div>
    </button>
  );
}
