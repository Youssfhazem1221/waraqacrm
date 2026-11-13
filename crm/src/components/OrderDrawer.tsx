'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Order, OrderStatus, Snapshot } from '@data/types';
import { ORDER_STATUSES } from '@data/types';
import { useData } from './DataProvider';
import { Badge, Button, Drawer, Input, Select } from './ui';
import { WhatsAppPanel } from './WhatsAppPanel';
import { setOrderStatus, updateOrder } from '@/app/actions';
import { ago, hoursSince, money, pct } from '@/lib/format';

export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  Pending: 'Confirmed',
  Confirmed: 'Packed',
  Packed: 'Shipped',
  Shipped: 'Delivered',
};

/** The screen moves the order at once; the Sheet's answer (with any restock) follows. */
export function patchOrder(s: Snapshot, id: string, fields: Partial<Order>): Snapshot {
  return { ...s, orders: s.orders.map((o) => (o.id === id ? { ...o, ...fields } : o)) };
}

export function useStatusChange() {
  const { run, snap, toast } = useData();
  return async (order: Order, status: OrderStatus) => {
    if (status === order.status) return;
    if (status === 'Cancelled' && !confirm(`Cancel ${order.id}?${snap.settings.restockOnCancel ? ' Its items go back in stock.' : ''}`)) return;
    const res = await run(setOrderStatus(order.id, status), undefined, (s) => patchOrder(s, order.id, { status }));
    if (res) toast('ok', `${order.id} → ${status}${res.restocked ? ' · items back in stock' : ''}`);
  };
}

export function OrderDrawer({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const { snap, run } = useData();
  const changeStatus = useStatusChange();
  const order = snap.orders.find((o) => o.id === orderId) ?? null;
  const items = useMemo(() => snap.items.filter((i) => i.orderId === orderId), [snap.items, orderId]);
  const customer = order ? snap.customers.find((c) => c.phone === order.phone) : undefined;

  const [notes, setNotes] = useState('');
  const [courier, setCourier] = useState('');
  useEffect(() => {
    setNotes(order?.notes ?? '');
    setCourier(String(order?.courierCost ?? ''));
  }, [order?.id, order?.notes, order?.courierCost]);

  if (!order) return null;

  const cogs = items.reduce((s, i) => s + i.unitCost * i.qty, 0);
  const revenue = order.subtotal + order.shippingCharged;
  const profit = revenue - cogs - order.courierCost;
  const next = NEXT_STATUS[order.status];
  const late = order.status === 'Pending' && hoursSince(order.createdAt) > snap.settings.slaHours;

  return (
    <Drawer open={!!order} onClose={onClose} wide title={<span className="flex items-center gap-3">{order.id} <Badge>{order.status}</Badge>{late && <Badge tone="Cancelled">Late</Badge>}</span>}>
      <div className="flex flex-col sm:flex-row gap-2">
        {next && (
          <Button variant="primary" className="w-full sm:w-auto h-12 sm:h-9 text-base sm:text-sm" onClick={() => changeStatus(order, next)}>
            Mark {next} →
          </Button>
        )}
        <Select
          value=""
          aria-label="Move to another status"
          onChange={(e) => e.target.value && changeStatus(order, e.target.value as OrderStatus)}
          className="sm:w-48"
        >
          <option value="">Move to…</option>
          {ORDER_STATUSES.filter((s) => s !== order.status).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>
      <p className="text-xs text-muted">
        Placed {order.createdAt} ({ago(order.createdAt)}) · status changed {order.statusUpdatedAt ? ago(order.statusUpdatedAt) : '–'} · {order.payment}
      </p>

      <section className="bg-white border border-line p-4 grid sm:grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs uppercase text-muted">Customer</div>
          <div className="font-medium">{order.customerName}</div>
          {customer && (
            <div className="mt-1 flex gap-1">
              <Badge>{customer.tag || 'New'}</Badge>
              <span className="text-xs text-muted">{customer.orders} orders · {money(customer.spent)}</span>
            </div>
          )}
        </div>
        <div>
          <div className="text-xs uppercase text-muted">Phone</div>
          <button className="font-medium underline decoration-dotted" onClick={() => navigator.clipboard?.writeText(order.phone)} title="Copy">
            {order.phone}
          </button>
          {order.email && <div className="text-muted break-all">{order.email}</div>}
        </div>
        <div className="sm:col-span-2">
          <div className="text-xs uppercase text-muted">Deliver to</div>
          <div>
            {[order.governorate, order.city].filter(Boolean).join(' · ')} — <span dir="auto">{order.address}</span>
          </div>
        </div>
      </section>

      <section className="bg-white border border-line">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted border-b border-line">
            <tr>
              <th className="text-left p-3">Item</th>
              <th className="text-right p-3">Qty</th>
              <th className="text-right p-3">Price</th>
              <th className="text-right p-3 hidden sm:table-cell">Cost</th>
              <th className="text-right p-3">Line</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="p-3 text-muted">{order.itemsSummary}</td>
              </tr>
            )}
            {items.map((i, k) => (
              <tr key={k} className="border-b border-line/60">
                <td className="p-3">
                  {i.productName}
                  <div className="text-xs text-muted">{i.sku}</div>
                </td>
                <td className="p-3 text-right tabular-nums">{i.qty}</td>
                <td className="p-3 text-right tabular-nums">{money(i.unitPrice)}</td>
                <td className="p-3 text-right tabular-nums text-muted hidden sm:table-cell">{i.unitCost ? money(i.unitCost) : '–'}</td>
                <td className="p-3 text-right tabular-nums">{money(i.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="p-4 grid grid-cols-2 gap-y-2 text-sm sm:max-w-sm sm:ml-auto">
          <dt className="text-muted">Subtotal</dt>
          <dd className="text-right tabular-nums">{money(order.subtotal)}</dd>
          <dt className="text-muted">Shipping charged</dt>
          <dd className="text-right tabular-nums">{order.shippingCharged ? money(order.shippingCharged) : 'Free'}</dd>
          <dt className="font-semibold">Customer pays</dt>
          <dd className="text-right tabular-nums font-semibold">{money(order.total)}</dd>
          <dt className="text-muted pt-2">Product cost</dt>
          <dd className="text-right tabular-nums pt-2">{cogs ? `−${money(cogs)}` : money(0)}</dd>
          <dt className="text-muted self-center">Courier cost</dt>
          <dd className="flex justify-end">
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                run(updateOrder(order.id, { courierCost: Number(courier) }), undefined, (s) => patchOrder(s, order.id, { courierCost: Number(courier) }));
              }}
            >
              <Input type="number" min={0} value={courier} onChange={(e) => setCourier(e.target.value)} className="cell-input w-20 h-8" aria-label="Courier cost" />
              {Number(courier) !== order.courierCost && <Button className="h-8">Save</Button>}
            </form>
          </dd>
          <dt className="font-semibold">Profit</dt>
          <dd className={'text-right tabular-nums font-semibold ' + (profit < 0 ? 'text-error' : 'text-success')}>
            {money(profit)} <span className="text-xs text-muted">({pct(revenue ? profit / revenue : 0)})</span>
          </dd>
        </dl>
      </section>

      <section className="bg-white border border-line p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">WhatsApp</h3>
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={order.whatsappSent}
              onChange={(e) => {
                const sent = e.target.checked;
                run(updateOrder(order.id, { whatsappSent: sent }), undefined, (s) => patchOrder(s, order.id, { whatsappSent: sent }));
              }}
            />
            Messaged
          </label>
        </div>
        <WhatsAppPanel
          order={order}
          items={items}
          onSent={() => {
            if (!order.whatsappSent) run(updateOrder(order.id, { whatsappSent: true }), undefined, (s) => patchOrder(s, order.id, { whatsappSent: true }));
          }}
        />
      </section>

      <section className="bg-white border border-line p-4 space-y-2">
        <h3 className="font-semibold">Notes</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          dir="auto"
          className="w-full border border-line p-2 text-sm focus:outline-none focus:border-maroon"
        />
        {notes !== order.notes && (
          <Button variant="primary" onClick={() => run(updateOrder(order.id, { notes }), undefined, (s) => patchOrder(s, order.id, { notes }))}>
            Save notes
          </Button>
        )}
      </section>
    </Drawer>
  );
}
