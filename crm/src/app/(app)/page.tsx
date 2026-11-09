'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useData } from '@/components/DataProvider';
import { PageHeader } from '@/components/Shell';
import { OrderDrawer } from '@/components/OrderDrawer';
import { Badge, Card, Empty, Stat } from '@/components/ui';
import { ago, hoursSince, money } from '@/lib/format';
import { economics, inPeriod, isOpen } from '@/lib/metrics';

export default function TodayPage() {
  const { snap } = useData();
  const [open, setOpen] = useState<string | null>(null);
  const { slaHours, lowStockThreshold } = snap.settings;

  const pending = useMemo(
    () => snap.orders.filter((o) => o.status === 'Pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [snap.orders],
  );
  const late = pending.filter((o) => hoursSince(o.createdAt) > slaHours);
  const notMessaged = snap.orders.filter((o) => isOpen(o) && !o.whatsappSent);
  const toShip = snap.orders.filter((o) => o.status === 'Confirmed' || o.status === 'Packed');
  const lowStock = snap.products.filter((p) => p.status !== 'Hidden' && p.stock <= lowStockThreshold).sort((a, b) => a.stock - b.stock);
  const month = economics(snap.orders.filter((o) => inPeriod(o, '30d')), snap.items);

  return (
    <>
      <PageHeader title="Today" sub="What needs doing, newest store orders included (refreshes every 30 seconds)." />
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat label="To confirm" value={pending.length} sub={late.length ? `${late.length} past the ${slaHours}h target` : `within ${slaHours}h`} tone={late.length ? 'bad' : pending.length ? 'warn' : undefined} />
        <Stat label="To pack & ship" value={toShip.length} />
        <Stat label="Low stock" value={lowStock.length} sub={`at or below ${lowStockThreshold}`} tone={lowStock.some((p) => p.stock === 0) ? 'bad' : lowStock.length ? 'warn' : undefined} />
        <Stat label="Profit, 30 days" value={money(month.grossProfit)} sub={`${money(month.sales + month.shippingCharged)} revenue · ${month.revenueOrders} orders`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Card title="Confirm these orders" actions={<Link className="text-sm underline" href="/orders">Board →</Link>}>
          {pending.length ? (
            <ul className="divide-y divide-line -my-2">
              {pending.map((o) => (
                <li key={o.id}>
                  <button onClick={() => setOpen(o.id)} className="w-full flex items-center justify-between gap-3 py-2 text-left text-sm hover:bg-cream/50">
                    <span className="min-w-0">
                      <span className="font-mono text-xs text-muted">{o.id}</span> <span className="font-medium">{o.customerName}</span>
                      <div className="text-xs text-muted truncate">{o.governorate} · {o.itemsSummary}</div>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="tabular-nums">{money(o.total)}</span>
                      {hoursSince(o.createdAt) > slaHours ? <Badge tone="Cancelled">{ago(o.createdAt)}</Badge> : <span className="text-xs text-muted">{ago(o.createdAt)}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No orders waiting. 🎉</Empty>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Not messaged on WhatsApp yet">
            {notMessaged.length ? (
              <ul className="flex flex-wrap gap-2">
                {notMessaged.map((o) => (
                  <li key={o.id}>
                    <button onClick={() => setOpen(o.id)} className="border border-line px-2 py-1 text-sm hover:border-maroon">
                      {o.id} · {o.customerName.split(' ')[0]} <Badge>{o.status}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Everyone with an open order has been messaged.</Empty>
            )}
          </Card>
          <Card title="Running low" actions={<Link className="text-sm underline" href="/products">Products →</Link>}>
            {lowStock.length ? (
              <ul className="divide-y divide-line -my-2 text-sm">
                {lowStock.map((p) => (
                  <li key={p.sku} className="flex justify-between py-2">
                    <span>{p.nameEn}</span>
                    <span className={p.stock === 0 ? 'text-error font-semibold' : 'text-warning font-semibold'}>{p.stock} left</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Stock is healthy.</Empty>
            )}
          </Card>
        </div>
      </div>
      <OrderDrawer orderId={open} onClose={() => setOpen(null)} />
    </>
  );
}
