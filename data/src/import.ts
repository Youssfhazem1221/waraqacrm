// ============================================================
// One-time import from the old Apps Script Sheet into the new layout.
// Old tabs are found by name ignoring emoji/case/spaces, and old columns by
// any of the spellings the old Apps Script accepted.
// ============================================================

import type { SheetsLike } from './google';
import type { Customer, Order, OrderItem, OrderStatus, Product } from './types';
import { ORDER_STATUSES } from './types';
import { canonPhone, customerStats, mergeCustomer } from './rules';
import type { Row } from './schema';

const OLD = {
  products: {
    sku: ['SKU'],
    nameEn: ['Name (EN)', 'Name'],
    nameAr: ['Name (AR)'],
    category: ['Category'],
    size: ['Size'],
    sheets: ['Sheets'],
    gsm: ['GSM'],
    paperType: ['Paper Type', 'Paper feel'],
    price: ['Price (EGP)', 'Price'],
    compareAt: ['Compare-at (EGP)', 'Compare-at'],
    cost: ['Cost (EGP)', 'Cost', 'Unit cost'],
    stock: ['Stock', 'Quantity', 'Amount', 'In Stock', 'Qty'],
    status: ['Status'],
    image: ['Image filename', 'Image'],
    descriptionEn: ['Short description', 'Description'],
    descriptionAr: ['Description (AR)', 'Short description (AR)'],
    featured: ['Featured?', 'Featured'],
  },
  orders: {
    id: ['Order ID', 'Order #'],
    time: ['Timestamp', 'Date'],
    name: ['Customer name', 'Customer Name', 'Name'],
    phone: ['Phone (WhatsApp)', 'Phone'],
    email: ['Email'],
    gov: ['Governorate/City', 'Governorate', 'City'],
    address: ['Address'],
    summary: ['Items summary', 'Items'],
    qty: ['Total qty'],
    subtotal: ['Subtotal (EGP)', 'Subtotal'],
    shipping: ['Shipping (EGP)', 'Shipping'],
    total: ['Total (EGP)', 'Total'],
    payment: ['Payment'],
    status: ['Status'],
    wa: ['WhatsApp sent?', 'WhatsApp', 'WA Sent'],
    notes: ['Notes'],
  },
  items: {
    id: ['Order ID'],
    sku: ['SKU'],
    name: ['Product name', 'Name'],
    qty: ['Qty', 'Quantity'],
    price: ['Unit price (EGP)', 'Unit price', 'Price'],
    line: ['Line total (EGP)', 'Line total'],
  },
  customers: {
    phone: ['Phone (WhatsApp)', 'Phone'],
    name: ['Customer Name', 'Name', 'Customer name'],
    email: ['Email'],
    addr: ['Delivery Address', 'Default address', 'Address'],
    tag: ['Customer Tag', 'Tags', 'Tag'],
    notes: ['Notes'],
  },
  newsletter: { email: ['Email'], date: ['Date'], locale: ['Locale'], source: ['Source'] },
};

/** Courier cost assumed for imported orders that left the workshop (old CRM used 80). */
const IMPORTED_COURIER_COST = 80;

const norm = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

function reader(values: Row[], spec: Record<string, string[]>) {
  const head = (values[0] ?? []).map((h) => String(h).trim().toLowerCase());
  const col: Record<string, number> = {};
  for (const [k, aliases] of Object.entries(spec)) {
    col[k] = head.findIndex((h) => aliases.some((a) => a.toLowerCase() === h));
  }
  const rows = values.slice(1).filter((r) => r.some((v) => String(v ?? '').trim() !== ''));
  const get = (r: Row, k: string) => (col[k] >= 0 ? r[col[k]] : '');
  return { rows, get, col };
}

const s = (v: unknown) => String(v ?? '').trim();
const n = (v: unknown) => {
  const x = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(x) ? x : 0;
};
const yes = (v: unknown) => /^(yes|true|1)$/i.test(s(v)) || v === true;

/** Whatever the old Sheet holds -> "yyyy-MM-dd HH:mm", without shifting time zones. */
export function normalizeDate(v: unknown): string {
  const t = s(v);
  if (!t) return '';
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return fmt(+m[1], +m[2], +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
  // M/D/YYYY H:mm(:ss) as Sheets formats dates for a US-locale file.
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) return fmt(+m[3], +m[1], +m[2], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
  return t;
}
function fmt(y: number, mo: number, d: number, h: number, mi: number) {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${y}-${p(mo)}-${p(d)} ${p(h)}:${p(mi)}`;
}

export async function importFromOldSheet(old: SheetsLike) {
  const log: string[] = [];
  const tabs = await old.tabs();
  const find = (name: string) => tabs.find((t) => norm(t.title) === norm(name))?.title;
  const names = {
    products: find('Products'),
    orders: find('Orders'),
    items: find('Order_Items') ?? find('Order Items'),
    customers: find('Customers'),
    newsletter: find('Newsletter'),
  };
  const present = Object.entries(names).filter(([, v]) => v) as [keyof typeof names, string][];
  const ranges = await old.batchGet(present.map(([, title]) => `'${title.replace(/'/g, "''")}'`));
  const values: Partial<Record<keyof typeof names, Row[]>> = {};
  present.forEach(([k], i) => (values[k] = ranges[i]));
  log.push(`Old tabs found: ${present.map(([, t]) => t).join(', ') || 'none'}`);

  // Products
  const products: Product[] = [];
  if (values.products) {
    const r = reader(values.products, OLD.products);
    for (const row of r.rows) {
      const sku = s(r.get(row, 'sku'));
      if (!sku) continue;
      const status = s(r.get(row, 'status'));
      products.push({
        sku,
        nameEn: s(r.get(row, 'nameEn')),
        nameAr: s(r.get(row, 'nameAr')),
        category: s(r.get(row, 'category')) || 'Sketchbooks',
        size: s(r.get(row, 'size')),
        sheets: n(r.get(row, 'sheets')),
        gsm: n(r.get(row, 'gsm')),
        paperType: s(r.get(row, 'paperType')),
        price: n(r.get(row, 'price')),
        compareAt: n(r.get(row, 'compareAt')),
        cost: n(r.get(row, 'cost')),
        stock: n(r.get(row, 'stock')),
        status: status === 'Hidden' || status === 'Out of stock' ? status : 'Active',
        image: s(r.get(row, 'image')),
        descriptionEn: s(r.get(row, 'descriptionEn')),
        descriptionAr: s(r.get(row, 'descriptionAr')),
        featured: yes(r.get(row, 'featured')),
        updatedAt: '',
      });
    }
    log.push(`Products: ${products.length}${products.some((p) => p.cost) ? '' : ' (no cost column in the old Sheet: set costs in the CRM)'}`);
  }

  // Orders
  const orders: Order[] = [];
  if (values.orders) {
    const r = reader(values.orders, OLD.orders);
    for (const row of r.rows) {
      const id = s(r.get(row, 'id'));
      if (!id) continue;
      const [gov, ...cityParts] = s(r.get(row, 'gov')).split(/\s*·\s*/);
      const statusRaw = s(r.get(row, 'status')) as OrderStatus;
      const status: OrderStatus = ORDER_STATUSES.includes(statusRaw) ? statusRaw : 'Pending';
      const subtotal = n(r.get(row, 'subtotal'));
      const shipping = n(r.get(row, 'shipping'));
      const createdAt = normalizeDate(r.get(row, 'time'));
      orders.push({
        id,
        createdAt,
        customerName: s(r.get(row, 'name')),
        phone: canonPhone(r.get(row, 'phone')),
        email: s(r.get(row, 'email')),
        governorate: gov ?? '',
        city: cityParts.join(' · '),
        address: s(r.get(row, 'address')),
        itemsSummary: s(r.get(row, 'summary')),
        totalQty: n(r.get(row, 'qty')),
        subtotal,
        shippingCharged: shipping,
        courierCost: ['Shipped', 'Delivered', 'Returned'].includes(status) ? IMPORTED_COURIER_COST : 0,
        total: n(r.get(row, 'total')) || subtotal + shipping,
        payment: s(r.get(row, 'payment')) || 'Cash on delivery',
        status,
        whatsappSent: yes(r.get(row, 'wa')),
        statusUpdatedAt: createdAt,
        notes: s(r.get(row, 'notes')),
        lang: 'en',
      });
    }
    log.push(`Orders: ${orders.length} (courier cost set to ${IMPORTED_COURIER_COST} on shipped/delivered/returned; edit per order if different)`);
  }

  // Order items, with today's product cost as the best guess for old lines.
  const items: OrderItem[] = [];
  if (values.items) {
    const r = reader(values.items, OLD.items);
    const costBySku = new Map(products.map((p) => [p.sku, p.cost]));
    for (const row of r.rows) {
      const orderId = s(r.get(row, 'id'));
      if (!orderId) continue;
      const qty = n(r.get(row, 'qty'));
      const price = n(r.get(row, 'price'));
      const sku = s(r.get(row, 'sku'));
      items.push({
        orderId,
        sku,
        productName: s(r.get(row, 'name')),
        qty,
        unitPrice: price,
        unitCost: costBySku.get(sku) ?? 0,
        lineTotal: n(r.get(row, 'line')) || qty * price,
      });
    }
    log.push(`Order items: ${items.length}`);
  }

  // Customers: recomputed from orders; names, tags and notes typed by hand are kept.
  const oldCustomers = new Map<string, Partial<Customer>>();
  if (values.customers) {
    const r = reader(values.customers, OLD.customers);
    for (const row of r.rows) {
      const phone = canonPhone(r.get(row, 'phone'));
      if (!phone) continue;
      oldCustomers.set(phone, {
        name: s(r.get(row, 'name')),
        email: s(r.get(row, 'email')),
        address: s(r.get(row, 'addr')),
        tag: s(r.get(row, 'tag')) === 'Active' ? '' : s(r.get(row, 'tag')),
        notes: s(r.get(row, 'notes')),
      });
    }
  }
  const stats = customerStats(orders);
  const customers: Customer[] = [];
  for (const [phone, st] of stats) {
    const old = oldCustomers.get(phone);
    customers.push(
      mergeCustomer(
        old
          ? { phone, name: old.name ?? '', email: old.email ?? '', governorate: '', address: old.address ?? '', firstOrder: '', lastOrder: '', orders: 0, spent: 0, tag: old.tag ?? '', notes: old.notes ?? '' }
          : undefined,
        st,
      ),
    );
  }
  for (const [phone, old] of oldCustomers) {
    if (stats.has(phone)) continue;
    customers.push({
      phone,
      name: old.name ?? '',
      email: old.email ?? '',
      governorate: '',
      address: old.address ?? '',
      firstOrder: '',
      lastOrder: '',
      orders: 0,
      spent: 0,
      tag: old.tag || 'New',
      notes: old.notes ?? '',
    });
  }
  log.push(`Customers: ${customers.length}`);

  const newsletter: { email: string; date: string; locale: string; source: string }[] = [];
  if (values.newsletter) {
    const r = reader(values.newsletter, OLD.newsletter);
    for (const row of r.rows) {
      const email = s(r.get(row, 'email')).toLowerCase();
      if (!email) continue;
      newsletter.push({ email, date: normalizeDate(r.get(row, 'date')), locale: s(r.get(row, 'locale')), source: s(r.get(row, 'source')) });
    }
    log.push(`Newsletter: ${newsletter.length}`);
  }

  return { products, orders, items, customers, newsletter, log };
}
