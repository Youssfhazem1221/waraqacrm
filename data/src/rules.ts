// ============================================================
// Business rules, kept pure so they are easy to test and to share with the CRM
// (which shows the same shipping quote and customer tags).
// Ported from the old Apps Script; behaviour is unchanged unless noted.
// ============================================================

import type { Customer, Order, ShippingZone } from './types';

/** Longest value accepted per checkout field. Matches FIELD_MAX in the store. */
export const FIELD_MAX = { name: 100, phone: 20, email: 254, governorate: 60, city: 80, address: 300, notes: 1000 };
export const MAX_ORDER_LINES = 30;
export const MAX_LINE_QTY = 50;

/**
 * One canonical form for every Egyptian mobile: 01XXXXXXXXX. Accepts +20,
 * 0020, 20, 0, Arabic-Indic digits, and the 10-digit number left behind when a
 * spreadsheet drops the leading zero. Anything else is kept as bare digits.
 */
export function canonPhone(v: unknown): string {
  const d = String(v ?? '')
    .replace(/[٠-٩]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, '');
  if (d.length >= 10) {
    const last10 = d.slice(-10);
    if (/^1[0125]\d{8}$/.test(last10)) return '0' + last10;
  }
  return d;
}

/** Drop control characters, trim, cap length. (Formula injection is handled by RAW writes.) */
export function cleanText(v: unknown, max: number): string {
  return String(v ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

/** "2026-11-09 18:42" in Cairo time. Sorts correctly as text. */
export function nowCairo(d = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}`;
}

// ---- Shipping ------------------------------------------------------------

/** First segment of "Cairo · Nasr City" / "Cairo, Nasr City", lower-cased. */
function govKey(governorate: string): string {
  return String(governorate || '').split('·')[0].split(',')[0].trim().toLowerCase();
}

/** The zone a governorate falls in: an explicit match first, then the `*` zone. */
export function zoneFor<Z extends Pick<ShippingZone, 'governorates'>>(zones: Z[], governorate: string): Z | null {
  const g = govKey(governorate);
  if (g) {
    const hit = zones.find((z) => z.governorates.includes(g));
    if (hit) return hit;
  }
  return zones.find((z) => z.governorates.includes('*')) ?? zones[zones.length - 1] ?? null;
}

export function shippingFee(zones: Pick<ShippingZone, 'governorates' | 'fee' | 'freeOver'>[], subtotal: number, governorate: string): number {
  const z = zoneFor(zones, governorate);
  if (!z) return 0;
  return z.freeOver > 0 && subtotal >= z.freeOver ? 0 : z.fee;
}

// ---- Customers -----------------------------------------------------------

const AUTO_RANK: Record<string, number> = { New: 0, Active: 1, Repeat: 2, VIP: 3 };

export function autoTag(count: number): string {
  return count >= 3 ? 'VIP' : count >= 2 ? 'Repeat' : 'New';
}

/** Automatic tags only move up; a tag a person set (Risk, Blocked...) is kept. */
export function mergeTag(current: string, count: number): string {
  const auto = autoTag(count);
  const cur = String(current || '').trim();
  if (!cur) return auto;
  if (!(cur in AUTO_RANK)) return cur;
  return AUTO_RANK[cur] >= AUTO_RANK[auto] ? cur : auto;
}

export interface CustomerStats {
  phone: string;
  name: string;
  email: string;
  governorate: string;
  address: string;
  firstOrder: string;
  lastOrder: string;
  orders: number;
  spent: number;
}

/**
 * Per-phone stats from the orders. Orders = not cancelled; spent = neither
 * cancelled nor returned. Newer orders' contact details win.
 */
export function customerStats(orders: Order[]): Map<string, CustomerStats> {
  const by = new Map<string, CustomerStats>();
  const sorted = [...orders].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const o of sorted) {
    const key = canonPhone(o.phone);
    if (!key) continue;
    let x = by.get(key);
    if (!x) {
      x = { phone: key, name: '', email: '', governorate: '', address: '', firstOrder: '', lastOrder: '', orders: 0, spent: 0 };
      by.set(key, x);
    }
    if (o.status !== 'Cancelled') x.orders++;
    if (o.status !== 'Cancelled' && o.status !== 'Returned') x.spent += o.total;
    const day = o.createdAt.slice(0, 10);
    if (day && (!x.firstOrder || day < x.firstOrder)) x.firstOrder = day;
    if (day && day > x.lastOrder) x.lastOrder = day;
    if (o.customerName) x.name = o.customerName;
    if (o.email) x.email = o.email;
    if (o.governorate) x.governorate = o.governorate;
    if (o.address) x.address = [o.city, o.address].filter(Boolean).join(', ');
  }
  return by;
}

/** Merge fresh stats into an existing customer row; hand-typed details win. */
export function mergeCustomer(existing: Customer | undefined, st: CustomerStats): Customer {
  return {
    phone: st.phone,
    name: existing?.name || st.name,
    email: existing?.email || st.email,
    governorate: existing?.governorate || st.governorate,
    address: existing?.address || st.address,
    firstOrder: st.firstOrder || existing?.firstOrder || '',
    lastOrder: st.lastOrder || existing?.lastOrder || '',
    orders: st.orders,
    spent: st.spent,
    tag: mergeTag(existing?.tag ?? '', st.orders),
    notes: existing?.notes ?? '',
  };
}

// ---- Validation ----------------------------------------------------------

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MOBILE_RE = /^01[0125]\d{8}$/;

export function nextOrderId(orders: Pick<Order, 'id'>[]): string {
  let max = 1000;
  for (const o of orders) {
    const n = parseInt(String(o.id).replace(/\D/g, ''), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `WRQ-${max + 1}`;
}
