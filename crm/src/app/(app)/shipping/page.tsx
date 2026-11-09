'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ShippingZone } from '@data/types';
import { shippingFee, zoneFor } from '@data/rules';
import { useData } from '@/components/DataProvider';
import { PageHeader } from '@/components/Shell';
import { Button, Card, Field, Input, Select, Stat } from '@/components/ui';
import { saveZones } from '@/app/actions';
import { money } from '@/lib/format';
import { inPeriod, isRevenue, type Period } from '@/lib/metrics';

const GOVERNORATES = [
  'Cairo', 'Giza', 'Alexandria', 'Qalyubia', 'Dakahlia', 'Sharqia', 'Gharbia', 'Monufia', 'Beheira', 'Kafr El Sheikh',
  'Damietta', 'Port Said', 'Ismailia', 'Suez', 'North Sinai', 'South Sinai', 'Beni Suef', 'Fayoum', 'Minya', 'Asyut',
  'Sohag', 'Qena', 'Luxor', 'Aswan', 'Red Sea', 'New Valley', 'Matrouh',
];

type Draft = Omit<ShippingZone, 'governorates'> & { governorates: string };

const toDraft = (z: ShippingZone): Draft => ({ ...z, governorates: z.governorates.join(', ') });
const fromDraft = (d: Draft): ShippingZone => ({
  ...d,
  fee: Number(d.fee) || 0,
  freeOver: Number(d.freeOver) || 0,
  courierCost: Number(d.courierCost) || 0,
  governorates: d.governorates.split(/[,،]/).map((g) => g.trim().toLowerCase()).filter(Boolean),
});

export default function ShippingPage() {
  const { snap, run } = useData();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [period, setPeriod] = useState<Period>('30d');
  const [gov, setGov] = useState('Cairo');
  const [subtotal, setSubtotal] = useState(500);

  const saved = useMemo(() => snap.zones.map(toDraft), [snap.zones]);
  useEffect(() => setDrafts(saved), [saved]);
  const dirty = JSON.stringify(drafts) !== JSON.stringify(saved);
  const zones = drafts.map(fromDraft);

  const set = (i: number, k: keyof Draft, v: string) =>
    setDrafts((d) => d.map((z, j) => (j === i ? { ...z, [k]: k === 'zone' || k === 'governorates' ? v : (v as unknown as number) } : z)));

  const quoteZone = zoneFor(zones, gov);
  const quote = shippingFee(zones, subtotal, gov);

  // What shipping actually did, per zone, from real orders.
  const perZone = useMemo(() => {
    const rows = new Map<string, { zone: string; orders: number; charged: number; courier: number; free: number }>();
    for (const o of snap.orders) {
      if (!inPeriod(o, period) || !(isRevenue(o) || o.status === 'Returned')) continue;
      const z = zoneFor(snap.zones, o.governorate)?.zone ?? 'Unknown';
      const r = rows.get(z) ?? { zone: z, orders: 0, charged: 0, courier: 0, free: 0 };
      r.orders++;
      if (o.status !== 'Returned') r.charged += o.shippingCharged;
      r.courier += o.courierCost;
      if (!o.shippingCharged) r.free++;
      rows.set(z, r);
    }
    return [...rows.values()];
  }, [snap.orders, snap.zones, period]);
  const totals = perZone.reduce((a, r) => ({ charged: a.charged + r.charged, courier: a.courier + r.courier }), { charged: 0, courier: 0 });

  return (
    <>
      <PageHeader
        title="Shipping"
        sub="What customers pay for delivery and what the courier costs you. Changes apply to the store’s checkout immediately after saving."
        actions={
          dirty && (
            <>
              <Button onClick={() => setDrafts(saved)}>Discard</Button>
              <Button variant="primary" onClick={() => run(saveZones(zones), 'Shipping rates saved: the store uses them now')}>
                Save rates
              </Button>
            </>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Zones" className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-xs uppercase text-muted">
                <tr>
                  <th className="text-left pb-2">Zone</th>
                  <th className="text-left pb-2">Governorates</th>
                  <th className="text-right pb-2">Customer pays</th>
                  <th className="text-right pb-2">Free over</th>
                  <th className="text-right pb-2">Courier costs us</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {drafts.map((z, i) => (
                  <tr key={i} className="border-t border-line align-top">
                    <td className="py-2 pr-2 min-w-[150px]">
                      <Input value={z.zone} onChange={(e) => set(i, 'zone', e.target.value)} aria-label="Zone name" />
                    </td>
                    <td className="py-2 pr-2">
                      <Input value={z.governorates} onChange={(e) => set(i, 'governorates', e.target.value)} aria-label="Governorates" />
                      {z.governorates.trim() === '*' && <div className="text-xs text-muted mt-1">Everywhere not listed in another zone</div>}
                    </td>
                    <td className="py-2 pr-2">
                      <Input type="number" min={0} className="cell-input w-24 ml-auto" value={z.fee} onChange={(e) => set(i, 'fee', e.target.value)} aria-label="Fee" />
                    </td>
                    <td className="py-2 pr-2">
                      <Input type="number" min={0} className="cell-input w-24 ml-auto" value={z.freeOver} onChange={(e) => set(i, 'freeOver', e.target.value)} aria-label="Free over" />
                      {!Number(z.freeOver) && <div className="text-xs text-muted mt-1 text-right">never free</div>}
                    </td>
                    <td className="py-2 pr-2">
                      <Input type="number" min={0} className="cell-input w-24 ml-auto" value={z.courierCost} onChange={(e) => set(i, 'courierCost', e.target.value)} aria-label="Courier cost" />
                    </td>
                    <td className="py-2">
                      <Button variant="ghost" aria-label="Remove zone" onClick={() => setDrafts((d) => d.filter((_, j) => j !== i))}>
                        ✕
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <Button onClick={() => setDrafts((d) => [...d, { zone: 'New zone', governorates: '', fee: 75, freeOver: 0, courierCost: 80 }])}>+ Add zone</Button>
            <span className="text-xs text-muted">Governorate names in English and/or Arabic, comma-separated. One zone must be *.</span>
          </div>
        </Card>

        <Card title="Try a quote">
          <div className="space-y-3">
            <Field label="Governorate">
              <Select value={gov} onChange={(e) => setGov(e.target.value)}>
                {GOVERNORATES.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </Select>
            </Field>
            <Field label="Cart subtotal (EGP)">
              <Input type="number" min={0} value={subtotal} onChange={(e) => setSubtotal(Number(e.target.value) || 0)} />
            </Field>
            <dl className="grid grid-cols-2 gap-y-1 text-sm pt-2 border-t border-line">
              <dt className="text-muted">Zone</dt>
              <dd className="text-right">{quoteZone?.zone ?? '–'}</dd>
              <dt className="text-muted">Customer pays</dt>
              <dd className="text-right font-semibold">{quote ? money(quote) : 'Free'}</dd>
              <dt className="text-muted">Courier costs us</dt>
              <dd className="text-right">{money(quoteZone?.courierCost ?? 0)}</dd>
              <dt className="text-muted">We cover</dt>
              <dd className={'text-right ' + ((quoteZone?.courierCost ?? 0) - quote > 0 ? 'text-error' : 'text-success')}>
                {money((quoteZone?.courierCost ?? 0) - quote)}
              </dd>
            </dl>
            {dirty && <p className="text-xs text-warning">Quoting your unsaved rates.</p>}
          </div>
        </Card>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-semibold">Shipping so far</h2>
        <Select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 mt-3">
        <Stat label="Customers paid" value={money(totals.charged)} />
        <Stat label="Courier charged us" value={money(totals.courier)} />
        <Stat
          label={totals.courier > totals.charged ? 'We covered' : 'Shipping earned'}
          value={money(Math.abs(totals.courier - totals.charged))}
          tone={totals.courier > totals.charged ? 'bad' : 'good'}
          sub="Courier cost includes returned orders"
        />
      </div>
      <div className="bg-white border border-line mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted border-b border-line">
            <tr>
              <th className="text-left p-3">Zone</th>
              <th className="text-right p-3">Orders</th>
              <th className="text-right p-3">Free shipping</th>
              <th className="text-right p-3">Paid by customers</th>
              <th className="text-right p-3">Courier cost</th>
              <th className="text-right p-3">Difference</th>
            </tr>
          </thead>
          <tbody>
            {perZone.map((r) => (
              <tr key={r.zone} className="border-b border-line/60">
                <td className="p-3">{r.zone}</td>
                <td className="p-3 text-right tabular-nums">{r.orders}</td>
                <td className="p-3 text-right tabular-nums">{r.free}</td>
                <td className="p-3 text-right tabular-nums">{money(r.charged)}</td>
                <td className="p-3 text-right tabular-nums">{money(r.courier)}</td>
                <td className={'p-3 text-right tabular-nums ' + (r.charged - r.courier < 0 ? 'text-error' : 'text-success')}>{money(r.charged - r.courier)}</td>
              </tr>
            ))}
            {!perZone.length && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted">No orders in this period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
