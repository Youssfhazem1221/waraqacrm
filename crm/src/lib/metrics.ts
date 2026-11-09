// Business numbers, computed from the Sheet snapshot. Rules match the data
// Worker: cancelled and returned orders are not revenue.
import type { Order, OrderItem, Product } from '@data/types';
import { parseSheetTime } from './format';

export type Period = '7d' | '30d' | '90d' | 'all';

export function inPeriod(order: Order, period: Period, now = Date.now()): boolean {
  if (period === 'all') return true;
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const t = parseSheetTime(order.createdAt);
  return Number.isFinite(t) && now - t <= days * 86_400_000;
}

export const isRevenue = (o: Order) => o.status !== 'Cancelled' && o.status !== 'Returned';
export const isOpen = (o: Order) => ['Pending', 'Confirmed', 'Packed', 'Shipped'].includes(o.status);

export interface Economics {
  orders: number;
  revenueOrders: number;
  delivered: number;
  cancelled: number;
  returned: number;
  /** Product sales (subtotal) on revenue orders. */
  sales: number;
  /** What customers paid for shipping on revenue orders. */
  shippingCharged: number;
  /** What the courier cost us: revenue orders plus returned ones (the courier still charged). */
  courierCost: number;
  /** Cost of goods on revenue orders. */
  cogs: number;
  grossProfit: number;
  margin: number;
  aov: number;
  /** courierCost - shippingCharged: what free/cheap shipping cost us. */
  shippingSubsidy: number;
  /** Lines with no cost recorded, so margins are overstated. */
  missingCostLines: number;
}

export function economics(orders: Order[], items: OrderItem[]): Economics {
  const byOrder = new Map<string, OrderItem[]>();
  for (const it of items) {
    const list = byOrder.get(it.orderId) ?? [];
    list.push(it);
    byOrder.set(it.orderId, list);
  }
  let sales = 0;
  let shippingCharged = 0;
  let courierCost = 0;
  let cogs = 0;
  let missingCostLines = 0;
  let revenueOrders = 0;
  for (const o of orders) {
    if (o.status === 'Returned') courierCost += o.courierCost;
    if (!isRevenue(o)) continue;
    revenueOrders++;
    sales += o.subtotal;
    shippingCharged += o.shippingCharged;
    courierCost += o.courierCost;
    for (const it of byOrder.get(o.id) ?? []) {
      cogs += it.unitCost * it.qty;
      if (!it.unitCost) missingCostLines++;
    }
  }
  const revenue = sales + shippingCharged;
  const grossProfit = revenue - cogs - courierCost;
  return {
    orders: orders.length,
    revenueOrders,
    delivered: orders.filter((o) => o.status === 'Delivered').length,
    cancelled: orders.filter((o) => o.status === 'Cancelled').length,
    returned: orders.filter((o) => o.status === 'Returned').length,
    sales,
    shippingCharged,
    courierCost,
    cogs,
    grossProfit,
    margin: revenue ? grossProfit / revenue : 0,
    aov: revenueOrders ? revenue / revenueOrders : 0,
    shippingSubsidy: courierCost - shippingCharged,
    missingCostLines,
  };
}

/** Per-unit numbers for one product at today's price, cost and courier rate. */
export function unitMargin(p: Pick<Product, 'price' | 'cost'>) {
  const profit = p.price - p.cost;
  return { profit, margin: p.price ? profit / p.price : 0 };
}

export function dailySeries(orders: Order[], days: number, now = Date.now()) {
  const out: { day: string; revenue: number; orders: number }[] = [];
  const index = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000 + 2 * 3_600_000).toISOString().slice(0, 10);
    index.set(d, out.length);
    out.push({ day: d, revenue: 0, orders: 0 });
  }
  for (const o of orders) {
    if (!isRevenue(o)) continue;
    const i = index.get(o.createdAt.slice(0, 10));
    if (i === undefined) continue;
    out[i].revenue += o.total;
    out[i].orders++;
  }
  return out;
}

export function topProducts(orders: Order[], items: OrderItem[], limit = 8) {
  const ok = new Set(orders.filter(isRevenue).map((o) => o.id));
  const by = new Map<string, { sku: string; name: string; qty: number; sales: number; cost: number }>();
  for (const it of items) {
    if (!ok.has(it.orderId)) continue;
    const x = by.get(it.sku) ?? { sku: it.sku, name: it.productName, qty: 0, sales: 0, cost: 0 };
    x.qty += it.qty;
    x.sales += it.lineTotal;
    x.cost += it.unitCost * it.qty;
    by.set(it.sku, x);
  }
  return [...by.values()].sort((a, b) => b.sales - a.sales).slice(0, limit);
}

export function byGovernorate(orders: Order[]) {
  const by = new Map<string, { gov: string; orders: number; revenue: number }>();
  for (const o of orders) {
    if (!isRevenue(o)) continue;
    const g = o.governorate || 'Unknown';
    const x = by.get(g) ?? { gov: g, orders: 0, revenue: 0 };
    x.orders++;
    x.revenue += o.total;
    by.set(g, x);
  }
  return [...by.values()].sort((a, b) => b.orders - a.orders);
}
