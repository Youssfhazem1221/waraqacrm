'use client';

import { useEffect, useMemo, useState } from 'react';
import { CUSTOMER_TAGS, type Customer } from '@data/types';
import { useData } from '@/components/DataProvider';
import { PageHeader } from '@/components/Shell';
import { OrderDrawer } from '@/components/OrderDrawer';
import { WaModeToggle, useWaMode } from '@/components/WhatsAppPanel';
import { Badge, Button, Drawer, Input, Select } from '@/components/ui';
import { updateCustomer } from '@/app/actions';
import { money } from '@/lib/format';
import { waLink } from '@/lib/whatsapp';

type Sort = 'recent' | 'spent' | 'orders';

export default function CustomersPage() {
  const { snap } = useData();
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return snap.customers
      .filter((c) => (!tag || (c.tag || 'New') === tag) && (!s || [c.name, c.phone, c.email, c.governorate].some((v) => v.toLowerCase().includes(s))))
      .sort((a, b) => (sort === 'spent' ? b.spent - a.spent : sort === 'orders' ? b.orders - a.orders : b.lastOrder.localeCompare(a.lastOrder)));
  }, [snap.customers, q, tag, sort]);

  const repeat = snap.customers.filter((c) => c.orders >= 2).length;

  return (
    <>
      <PageHeader
        title="Customers"
        sub={`${snap.customers.length} customers · ${repeat} ordered more than once. Tags New → Repeat → VIP update on their own; Risk and Blocked are yours.`}
        actions={
          <>
            <Input placeholder="Search name, phone…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
            <Select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Tag">
              <option value="">All tags</option>
              {CUSTOMER_TAGS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
              <option value="recent">Most recent</option>
              <option value="spent">Top spenders</option>
              <option value="orders">Most orders</option>
            </Select>
          </>
        }
      />
      <div className="bg-white border border-line overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="text-xs uppercase text-muted border-b border-line bg-cream/50">
            <tr>
              <th className="text-left p-3">Customer</th>
              <th className="text-left p-3">Governorate</th>
              <th className="text-right p-3">Orders</th>
              <th className="text-right p-3">Spent</th>
              <th className="text-left p-3">Last order</th>
              <th className="text-left p-3">Tag</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.phone} className="border-b border-line/60 hover:bg-cream/40 cursor-pointer" onClick={() => setOpen(c.phone)}>
                <td className="p-3">
                  <div className="font-medium">{c.name || '—'}</div>
                  <div className="text-xs text-muted">{c.phone}</div>
                </td>
                <td className="p-3">{c.governorate}</td>
                <td className="p-3 text-right tabular-nums">{c.orders}</td>
                <td className="p-3 text-right tabular-nums">{money(c.spent)}</td>
                <td className="p-3 text-muted">{c.lastOrder}</td>
                <td className="p-3">
                  <Badge>{c.tag || 'New'}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <div className="p-8 text-center text-sm text-muted">No customers match.</div>}
      </div>
      <CustomerDrawer phone={open} onClose={() => setOpen(null)} />
    </>
  );
}

function CustomerDrawer({ phone, onClose }: { phone: string | null; onClose: () => void }) {
  const { snap, run } = useData();
  const [mode, setMode] = useWaMode();
  const [orderOpen, setOrderOpen] = useState<string | null>(null);
  const c = snap.customers.find((x) => x.phone === phone);
  const [notes, setNotes] = useState('');
  useEffect(() => setNotes(c?.notes ?? ''), [c?.phone, c?.notes]);
  if (!c) return null;
  const orders = snap.orders.filter((o) => o.phone === c.phone).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const save = (patch: Partial<Customer>, msg: string) => run(updateCustomer(c.phone, patch), msg);
  const first = c.name.split(/\s+/)[0] || '';

  return (
    <>
      <Drawer open onClose={onClose} title={c.name || c.phone}>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs uppercase text-muted">Phone</div>
            {c.phone}
          </div>
          <div>
            <div className="text-xs uppercase text-muted">Email</div>
            <span className="break-all">{c.email || '–'}</span>
          </div>
          <div className="col-span-2">
            <div className="text-xs uppercase text-muted">Address</div>
            <span dir="auto">{[c.governorate, c.address].filter(Boolean).join(' — ')}</span>
          </div>
          <div>
            <div className="text-xs uppercase text-muted">Orders · spent</div>
            {c.orders} · {money(c.spent)}
          </div>
          <div>
            <div className="text-xs uppercase text-muted">First · last order</div>
            {c.firstOrder || '–'} · {c.lastOrder || '–'}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={c.tag || 'New'} onChange={(e) => save({ tag: e.target.value }, `Tagged ${e.target.value}`)} aria-label="Tag">
            {CUSTOMER_TAGS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
          <WaModeToggle mode={mode} onChange={setMode} />
          <a
            className="inline-flex items-center h-9 px-3 bg-success text-white text-sm"
            href={waLink(mode, c.phone, first ? `أهلاً يا ${first}! ` : '')}
            target={mode === 'web' ? 'whatsapp-web' : undefined}
            rel="noreferrer"
          >
            Message ↗
          </a>
        </div>

        <div className="space-y-2">
          <div className="text-xs uppercase text-muted">Notes</div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} dir="auto" className="w-full border border-line p-2 text-sm bg-white" />
          {notes !== c.notes && (
            <Button variant="primary" onClick={() => save({ notes }, 'Notes saved')}>
              Save notes
            </Button>
          )}
        </div>

        <div>
          <div className="text-xs uppercase text-muted mb-2">Orders</div>
          <div className="bg-white border border-line divide-y divide-line">
            {orders.map((o) => (
              <button key={o.id} onClick={() => setOrderOpen(o.id)} className="w-full flex items-center justify-between p-3 text-sm hover:bg-cream/50 text-left">
                <span>
                  <span className="font-mono">{o.id}</span> <span className="text-muted">· {o.createdAt.slice(0, 10)}</span>
                  <div className="text-xs text-muted">{o.itemsSummary}</div>
                </span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">{money(o.total)}</span>
                  <Badge>{o.status}</Badge>
                </span>
              </button>
            ))}
            {!orders.length && <div className="p-3 text-sm text-muted">No orders on record.</div>}
          </div>
        </div>
      </Drawer>
      <OrderDrawer orderId={orderOpen} onClose={() => setOrderOpen(null)} />
    </>
  );
}
