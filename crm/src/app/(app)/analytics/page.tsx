'use client';

import { useMemo, useState } from 'react';
import { useData } from '@/components/DataProvider';
import { PageHeader } from '@/components/Shell';
import { DailyBars, InlineBar } from '@/components/charts';
import { Card, Select, Stat } from '@/components/ui';
import { money, pct } from '@/lib/format';
import { byGovernorate, dailySeries, economics, inPeriod, topProducts, type Period } from '@/lib/metrics';

const DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90, all: 90 };

export default function AnalyticsPage() {
  const { snap } = useData();
  const [period, setPeriod] = useState<Period>('30d');
  const orders = useMemo(() => snap.orders.filter((o) => inPeriod(o, period)), [snap.orders, period]);
  const e = useMemo(() => economics(orders, snap.items), [orders, snap.items]);
  const series = useMemo(() => dailySeries(snap.orders, DAYS[period]), [snap.orders, period]);
  const top = useMemo(() => topProducts(orders, snap.items), [orders, snap.items]);
  const govs = useMemo(() => byGovernorate(orders), [orders]);
  const repeat = snap.customers.length ? snap.customers.filter((c) => c.orders >= 2).length / snap.customers.length : 0;

  return (
    <>
      <PageHeader
        title="Analytics"
        sub="Cancelled and returned orders are not counted as revenue. Profit = what customers paid − product cost − courier cost."
        actions={
          <Select value={period} onChange={(ev) => setPeriod(ev.target.value as Period)} aria-label="Period">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </Select>
        }
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue" value={money(e.sales + e.shippingCharged)} sub={`${e.revenueOrders} orders · AOV ${money(e.aov)}`} />
        <Stat
          label="Gross profit"
          value={money(e.grossProfit)}
          sub={`${pct(e.margin)} margin${e.missingCostLines ? ` · ${e.missingCostLines} line(s) without cost` : ''}`}
          tone={e.grossProfit < 0 ? 'bad' : undefined}
        />
        <Stat label="Product cost" value={money(e.cogs)} sub={`Product sales ${money(e.sales)}`} />
        <Stat
          label={e.shippingSubsidy > 0 ? 'Shipping we covered' : 'Shipping earned'}
          value={money(Math.abs(e.shippingSubsidy))}
          sub={`Paid ${money(e.shippingCharged)} · courier ${money(e.courierCost)}`}
          tone={e.shippingSubsidy > 0 ? 'warn' : undefined}
        />
        <Stat label="Delivered" value={e.delivered} sub={`of ${e.orders} orders placed`} />
        <Stat label="Cancelled" value={e.cancelled} sub={pct(e.orders ? e.cancelled / e.orders : 0)} tone={e.cancelled ? 'warn' : undefined} />
        <Stat label="Returned" value={e.returned} sub={pct(e.orders ? e.returned / e.orders : 0)} tone={e.returned ? 'warn' : undefined} />
        <Stat label="Repeat customers" value={pct(repeat)} sub={`${snap.customers.length} customers, all time`} />
      </div>

      <Card title={`Revenue per day${period === 'all' ? ' (last 90 days)' : ''}`} className="mt-4">
        <DailyBars data={series} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Card title="Best sellers">
          <div className="overflow-x-auto -mx-4 px-4"><table className="w-full text-sm min-w-[22rem]">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="text-left pb-2">Product</th>
                <th className="text-right pb-2">Units</th>
                <th className="text-right pb-2">Sales</th>
                <th className="text-right pb-2">Margin</th>
                <th className="pb-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {top.map((p) => (
                <tr key={p.sku} className="border-t border-line">
                  <td className="py-2 pr-2">
                    <div className="truncate max-w-[200px]">{p.name}</div>
                    <div className="text-xs text-muted">{p.sku}</div>
                  </td>
                  <td className="py-2 text-right tabular-nums">{p.qty}</td>
                  <td className="py-2 text-right tabular-nums">{money(p.sales)}</td>
                  <td className="py-2 text-right tabular-nums">{p.cost ? pct((p.sales - p.cost) / p.sales) : '–'}</td>
                  <td className="py-2 pl-3">
                    <InlineBar value={p.sales} max={top[0]?.sales ?? 0} />
                  </td>
                </tr>
              ))}
              {!top.length && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted">No sales in this period.</td>
                </tr>
              )}
            </tbody>
          </table></div>
        </Card>

        <Card title="Where orders go">
          <div className="overflow-x-auto -mx-4 px-4"><table className="w-full text-sm min-w-[22rem]">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="text-left pb-2">Governorate</th>
                <th className="text-right pb-2">Orders</th>
                <th className="text-right pb-2">Revenue</th>
                <th className="pb-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {govs.slice(0, 12).map((g) => (
                <tr key={g.gov} className="border-t border-line">
                  <td className="py-2">{g.gov}</td>
                  <td className="py-2 text-right tabular-nums">{g.orders}</td>
                  <td className="py-2 text-right tabular-nums">{money(g.revenue)}</td>
                  <td className="py-2 pl-3">
                    <InlineBar value={g.orders} max={govs[0]?.orders ?? 0} />
                  </td>
                </tr>
              ))}
              {!govs.length && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted">No orders in this period.</td>
                </tr>
              )}
            </tbody>
          </table></div>
        </Card>
      </div>
    </>
  );
}
