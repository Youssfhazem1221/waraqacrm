// ============================================================
// SheetStore: the one Durable Object that talks to the Sheet.
//
// Why a Durable Object: every write (a store order, a CRM price edit, a status
// change) runs here, one at a time, against a copy of the Sheet read inside
// the same turn. A sale and a stock edit can never interleave and lose one of
// the two, which the old setup could only prevent with Apps Script's lock.
//
// Why it syncs better: reads are served from memory, and every write drops the
// cached copy, so the store sees a CRM price change on its next request. Edits
// typed straight into the Sheet are picked up within READ_TTL_MS.
// ============================================================

import { DurableObject } from 'cloudflare:workers';
import { SheetsClient, type SheetsLike } from './google';
import { FakeSheetsClient } from './fake';
import {
  AUDIT,
  CUSTOMERS,
  DEFAULT_SETTINGS,
  DEFAULT_ZONES,
  NEWSLETTER,
  ORDERS,
  ORDER_ITEMS,
  PRODUCTS,
  SETTINGS,
  SHIPPING,
  TABS,
  a1,
  buildRow,
  parseTable,
  tabRange,
  toCell,
  type Row,
  type TabDef,
  type Table,
} from './schema';
import {
  EMAIL_RE,
  FIELD_MAX,
  MAX_LINE_QTY,
  MAX_ORDER_LINES,
  MOBILE_RE,
  canonPhone,
  cleanText,
  customerStats,
  mergeCustomer,
  nextOrderId,
  nowCairo,
  shippingFee,
  zoneFor,
} from './rules';
import { importFromOldSheet } from './import';
import type {
  Catalog,
  Customer,
  Order,
  OrderItem,
  OrderRequest,
  OrderResult,
  OrderStatus,
  Product,
  Result,
  Settings,
  ShippingZone,
  Snapshot,
} from './types';
import { ORDER_STATUSES } from './types';

export interface Env {
  STORE: DurableObjectNamespace<SheetStore>;
  SHEET_ID: string;
  GOOGLE_SA_EMAIL: string;
  GOOGLE_SA_KEY: string;
  /** Slim Apps Script that sends order emails. Optional: no emails without it. */
  MAILER_URL?: string;
  MAILER_SECRET?: string;
  /** "1" = in-memory fake spreadsheet for local development. Never set in production. */
  FAKE_SHEETS?: string;
}

/** A cached copy older than this is re-read before a CRM read or any write. */
const READ_TTL_MS = 15_000;
/** The store may be served a copy this old while a fresh one loads in the background. */
const STALE_OK_MS = 10 * 60_000;

const ORDER_LIMIT_PER_10MIN = 30;
const ORDER_LIMIT_PER_PHONE_HOUR = 5;
const SUBSCRIBE_LIMIT_PER_10MIN = 60;

interface Tables {
  products: Table<Product>;
  orders: Table<Order>;
  items: Table<OrderItem>;
  customers: Table<Customer>;
  zones: Table<ShippingZone>;
  settings: Table<{ key: string; value: string; about: string }>;
  newsletter: Table<{ email: string; date: string; locale: string; source: string }>;
  audit: Table<{ at: string; action: string; target: string; details: string }>;
  readAt: number;
}

const READ_TABS: [keyof Omit<Tables, 'readAt'>, TabDef][] = [
  ['products', PRODUCTS],
  ['orders', ORDERS],
  ['items', ORDER_ITEMS],
  ['customers', CUSTOMERS],
  ['zones', SHIPPING],
  ['settings', SETTINGS],
  ['newsletter', NEWSLETTER],
  ['audit', AUDIT],
];

function settingsFrom(t: Tables['settings']): Settings {
  const get = (k: string, d: string) => t.rows.find((r) => r.key === k)?.value ?? d;
  const yes = (v: string) => /^(yes|true|1)$/i.test(v.trim());
  return {
    supportWhatsapp: get('support_whatsapp', '201069237525').replace(/\D/g, ''),
    slaHours: Number(get('sla_hours', '24')) || 24,
    restockOnCancel: yes(get('restock_on_cancel', 'Yes')),
    lowStockThreshold: Number(get('low_stock_threshold', '3')) || 0,
  };
}

const ok = <T extends object>(v: T = {} as T): Result<T> => ({ ok: true, ...v });
const fail = (error: string, conflict = false): { ok: false; error: string; conflict?: boolean } =>
  conflict ? { ok: false, error, conflict } : { ok: false, error };

export class SheetStore extends DurableObject<Env> {
  private client: SheetsLike;
  private cache: Tables | null = null;
  private loading: Promise<Tables> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private sheetIds: Map<string, number> | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.client = this.open(env.SHEET_ID);
  }

  private open(spreadsheetId: string): SheetsLike {
    return this.env.FAKE_SHEETS === '1'
      ? new FakeSheetsClient(spreadsheetId)
      : new SheetsClient({ email: this.env.GOOGLE_SA_EMAIL, privateKey: this.env.GOOGLE_SA_KEY }, spreadsheetId);
  }

  // ---- Reading ----------------------------------------------------------

  private load(fresh = false): Promise<Tables> {
    if (!fresh && this.cache && Date.now() - this.cache.readAt < READ_TTL_MS) return Promise.resolve(this.cache);
    if (this.loading) return this.loading;
    this.loading = this.client
      .batchGet(READ_TABS.map(([, def]) => tabRange(def.name)))
      .then((ranges) => {
        const t = { readAt: Date.now() } as Tables;
        READ_TABS.forEach(([key, def], i) => {
          (t as unknown as Record<string, unknown>)[key] = parseTable(def, ranges[i]);
        });
        this.cache = t;
        return t;
      })
      .finally(() => {
        this.loading = null;
      });
    return this.loading;
  }

  /** After a write: drop the copy and start re-reading so the next reader doesn't wait. */
  private invalidate() {
    this.cache = null;
    this.ctx.waitUntil(this.load(true).catch(() => undefined));
  }

  /** Run `fn` alone, against a copy of the Sheet read inside the same turn. */
  private exclusive<T>(fn: (t: Tables) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const t = await this.load(true);
      try {
        return await fn(t);
      } finally {
        this.invalidate();
      }
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async catalog(): Promise<Catalog> {
    let t = this.cache;
    if (!t || Date.now() - t.readAt > STALE_OK_MS) {
      t = await this.load();
    } else if (Date.now() - t.readAt > READ_TTL_MS) {
      this.ctx.waitUntil(this.load().catch(() => undefined));
    }
    const settings = settingsFrom(t.settings);
    return {
      products: t.products.rows.filter((p) => p.status !== 'Hidden').map(({ cost: _cost, ...p }) => p),
      zones: t.zones.rows.map(({ courierCost: _c, ...z }) => z),
      supportWhatsapp: settings.supportWhatsapp,
      readAt: t.readAt,
    };
  }

  async snapshot(fresh = false): Promise<Snapshot> {
    const t = await this.load(fresh);
    return {
      products: t.products.rows,
      orders: t.orders.rows,
      items: t.items.rows,
      customers: t.customers.rows,
      zones: t.zones.rows,
      settings: settingsFrom(t.settings),
      readAt: t.readAt,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${this.env.SHEET_ID}/edit`,
    };
  }

  async auditLog(limit = 200) {
    const t = await this.load();
    return t.audit.rows.slice(-limit).reverse();
  }

  // ---- Write helpers ----------------------------------------------------

  private requireCols(table: Table<unknown>, keys: string[]) {
    const missing = keys.filter((k) => (table.col[k] ?? -1) < 0);
    if (missing.length) {
      const headers = missing.map((k) => table.def.columns.find((c) => c.key === k)?.header ?? k);
      throw new Error(`The "${table.def.name}" tab is missing column(s): ${headers.join(', ')}. Run Setup in CRM Settings.`);
    }
  }

  /** batchUpdate entries that set `values` on one existing row. */
  private cells(table: Table<unknown>, rowNumber: number, values: Record<string, unknown>) {
    const keys = Object.keys(values).filter((k) => values[k] !== undefined);
    this.requireCols(table, keys);
    return keys.map((k) => {
      const col = table.def.columns.find((c) => c.key === k)!;
      return { range: a1(table.def.name, table.col[k], rowNumber), values: [[toCell(values[k], col.type)]] as Row[] };
    });
  }

  private auditRow(t: Tables, action: string, target: string, details: unknown): Row {
    return buildRow(t.audit as Table<unknown>, {
      at: nowCairo(),
      action,
      target,
      details: typeof details === 'string' ? details : JSON.stringify(details),
    });
  }

  private async rateOk(key: string, limit: number, seconds: number): Promise<boolean> {
    const bucket = Math.floor(Date.now() / (seconds * 1000));
    const k = `rl:${key}:${bucket}`;
    const n = ((await this.ctx.storage.get<number>(k)) ?? 0) + 1;
    if (n > limit) return false;
    await this.ctx.storage.put(k, n);
    await this.ctx.storage.delete(`rl:${key}:${bucket - 1}`);
    return true;
  }

  /** Stock moves for an order's items: sign -1 sells, +1 puts back. Keeps Status in step. */
  private stockMoves(t: Tables, items: { sku: string; qty: number }[], sign: 1 | -1) {
    const updates: { range: string; values: Row[] }[] = [];
    const pending = new Map<string, number>();
    for (const it of items) {
      const i = t.products.rows.findIndex((p) => p.sku === it.sku);
      if (i < 0) continue;
      const p = t.products.rows[i];
      const current = pending.get(p.sku) ?? p.stock;
      const next = Math.max(0, current + sign * it.qty);
      pending.set(p.sku, next);
      const status =
        next === 0 && p.status !== 'Hidden' ? 'Out of stock' : next > 0 && p.status === 'Out of stock' ? 'Active' : p.status;
      updates.push(...this.cells(t.products as Table<unknown>, t.products.rowNumbers[i], { stock: next, status, updatedAt: nowCairo() }));
    }
    return updates;
  }

  /** Customer row writes after an order for `phone` changed. */
  private customerWrites(t: Tables, phone: string, ordersAfter: Order[]) {
    const key = canonPhone(phone);
    const st = customerStats(ordersAfter).get(key);
    if (!key || !st) return { updates: [] as { range: string; values: Row[] }[], append: [] as Row[] };
    const i = t.customers.rows.findIndex((c) => canonPhone(c.phone) === key);
    const merged = mergeCustomer(i >= 0 ? t.customers.rows[i] : undefined, st);
    if (i >= 0) {
      return { updates: this.cells(t.customers as Table<unknown>, t.customers.rowNumbers[i], { ...merged }), append: [] };
    }
    return { updates: [], append: [buildRow(t.customers as Table<unknown>, { ...merged })] };
  }

  // ---- Store: orders and newsletter --------------------------------------

  async createOrder(req: OrderRequest): Promise<OrderResult> {
    if (!(await this.rateOk('order', ORDER_LIMIT_PER_10MIN, 600))) {
      return fail('We are receiving a lot of orders right now. Please try again in a few minutes.');
    }
    const raw = req?.customer ?? ({} as OrderRequest['customer']);
    const rawItems = Array.isArray(req?.items) ? req.items : [];
    if (!rawItems.length) return fail('Your cart is empty.');
    if (rawItems.length > MAX_ORDER_LINES) return fail('Too many different items in one order.');

    const str = (v: unknown) => String(v ?? '').trim();
    const name = str(raw.name);
    const email = str(raw.email);
    const gov = str(raw.governorate);
    const city = str(raw.city);
    const address = str(raw.address);
    const notesIn = str(req.notes);
    const phone = canonPhone(raw.phone);
    if (!name || name.length > FIELD_MAX.name) return fail('Please enter your name.');
    if (!MOBILE_RE.test(phone) || str(raw.phone).length > FIELD_MAX.phone) return fail('Please enter a valid Egyptian mobile number.');
    if (!EMAIL_RE.test(email) || email.length > FIELD_MAX.email) return fail('Please enter a valid email address.');
    if (!gov || gov.length > FIELD_MAX.governorate) return fail('Please choose your governorate.');
    if (!address || address.length > FIELD_MAX.address) return fail('Please enter your address.');
    if (city.length > FIELD_MAX.city || notesIn.length > FIELD_MAX.notes) return fail('One of the fields is too long.');
    if (!(await this.rateOk(`phone:${phone}`, ORDER_LIMIT_PER_PHONE_HOUR, 3600))) {
      return fail('We already have several orders from this number. Please WhatsApp us to add to them.');
    }
    const lang = req.lang === 'ar' ? 'ar' : 'en';

    return this.exclusive(async (t) => {
      this.requireCols(t.orders as Table<unknown>, ['id', 'phone', 'status', 'total']);
      this.requireCols(t.products as Table<unknown>, ['sku', 'price', 'stock']);

      // Never trust prices or names from the client: re-price every line from the Sheet.
      const items: (OrderItem & { nameAr: string })[] = [];
      for (const ri of rawItems) {
        const p = t.products.rows.find((x) => x.sku === str(ri?.sku));
        if (!p) return fail('One of the items in your cart is no longer available. Please refresh and try again.');
        const qty = Math.floor(Number(ri.qty));
        if (!qty || qty <= 0 || qty > MAX_LINE_QTY) return fail(`Invalid quantity for ${p.nameEn}.`);
        const already = items.filter((x) => x.sku === p.sku).reduce((s, x) => s + x.qty, 0);
        if (p.status === 'Hidden' || p.stock <= 0) return fail(`${p.nameEn} just sold out. Please remove it from your bag and try again.`);
        if (qty + already > p.stock) return fail(`Only ${p.stock} left of ${p.nameEn}. Please lower the quantity and try again.`);
        items.push({
          orderId: '',
          sku: p.sku,
          productName: p.nameEn,
          nameAr: p.nameAr,
          qty,
          unitPrice: p.price,
          unitCost: p.cost,
          lineTotal: qty * p.price,
        });
      }

      const orderId = nextOrderId(t.orders.rows);
      const createdAt = nowCairo();
      const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
      const zones = t.zones.rows;
      const shipping = shippingFee(zones, subtotal, gov);
      const order: Order = {
        id: orderId,
        createdAt,
        customerName: cleanText(name, FIELD_MAX.name),
        phone,
        email: cleanText(email, FIELD_MAX.email),
        governorate: cleanText(gov, FIELD_MAX.governorate),
        city: cleanText(city, FIELD_MAX.city),
        address: cleanText(address, FIELD_MAX.address),
        itemsSummary: items.map((i) => `${i.productName} ×${i.qty}`).join(', '),
        totalQty: items.reduce((s, i) => s + i.qty, 0),
        subtotal,
        shippingCharged: shipping,
        courierCost: zoneFor(zones, gov)?.courierCost ?? 0,
        total: subtotal + shipping,
        payment: 'Cash on delivery',
        status: 'Pending',
        whatsappSent: false,
        statusUpdatedAt: createdAt,
        notes: cleanText(notesIn, FIELD_MAX.notes),
        lang,
      };
      items.forEach((i) => (i.orderId = orderId));

      const stock = this.stockMoves(t, items, -1);
      const cust = this.customerWrites(t, phone, [...t.orders.rows, order]);

      // Order row first: if anything after it fails, the order is still recorded.
      await this.client.append(tabRange(ORDERS.name), [buildRow(t.orders as Table<unknown>, { ...order })]);
      await this.client.append(
        tabRange(ORDER_ITEMS.name),
        items.map((i) => buildRow(t.items as Table<unknown>, { ...i })),
      );
      await this.client.batchUpdate([...stock, ...cust.updates]);
      if (cust.append.length) await this.client.append(tabRange(CUSTOMERS.name), cust.append);

      this.ctx.waitUntil(this.sendOrderEmail(order, items));
      return { ok: true as const, orderId, subtotal, shipping, total: order.total };
    });
  }

  private async sendOrderEmail(order: Order, items: (OrderItem & { nameAr: string })[]) {
    if (!this.env.MAILER_URL || !this.env.MAILER_SECRET) return;
    try {
      const res = await fetch(this.env.MAILER_URL, {
        method: 'POST',
        headers: { 'content-type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          secret: this.env.MAILER_SECRET,
          order: {
            orderId: order.id,
            now: order.createdAt,
            c: {
              name: order.customerName,
              phone: order.phone,
              email: order.email,
              governorate: order.governorate,
              city: order.city,
              address: order.address,
            },
            to: order.email,
            lang: order.lang,
            items: items.map((i) => ({ sku: i.sku, name: i.productName, nameAr: i.nameAr, qty: i.qty, price: i.unitPrice })),
            subtotal: order.subtotal,
            shipping: order.shippingCharged,
            total: order.total,
            payment: order.payment,
            notes: order.notes,
          },
        }),
      });
      if (!res.ok) console.warn('[mailer] HTTP', res.status);
    } catch (err) {
      console.warn('[mailer] failed', err);
    }
  }

  async subscribe(emailIn: string, locale: string, source: string): Promise<Result<{ alreadySubscribed?: boolean }>> {
    const email = String(emailIn || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > FIELD_MAX.email) return fail('invalid email');
    if (!(await this.rateOk('subscribe', SUBSCRIBE_LIMIT_PER_10MIN, 600))) return fail('Please try again in a few minutes.');
    return this.exclusive(async (t) => {
      if (t.newsletter.rows.some((r) => r.email.toLowerCase() === email)) return ok({ alreadySubscribed: true });
      await this.client.append(tabRange(NEWSLETTER.name), [
        buildRow(t.newsletter as Table<unknown>, {
          email,
          date: nowCairo(),
          locale: locale === 'ar' ? 'ar' : 'en',
          source: cleanText(source || 'storefront', 40),
        }),
      ]);
      return ok({});
    });
  }

  // ---- CRM: products ----------------------------------------------------

  /**
   * Edit some fields of one product. `expected` holds the values the CRM last
   * saw for fields that also change on their own (stock, via sales): if the
   * Sheet has moved on, nothing is written and the CRM is told to reload.
   */
  async patchProduct(
    sku: string,
    patch: Partial<Omit<Product, 'sku' | 'updatedAt'>>,
    expected?: { stock?: number },
  ): Promise<Result<{ product: Product }>> {
    return this.exclusive(async (t) => {
      const i = t.products.rows.findIndex((p) => p.sku === sku);
      if (i < 0) return fail(`No product with SKU ${sku}.`);
      const current = t.products.rows[i];
      if (patch.stock !== undefined && expected?.stock !== undefined && current.stock !== expected.stock) {
        return fail(
          `Stock for ${sku} changed to ${current.stock} since you loaded it (an order or another edit). Reloaded; check and try again.`,
          true,
        );
      }
      const clean = sanitizeProductPatch(patch);
      if ('error' in clean) return fail(clean.error);
      const next: Product = { ...current, ...clean.patch, updatedAt: nowCairo() };
      if (clean.patch.stock !== undefined && clean.patch.status === undefined) {
        if (next.stock === 0 && next.status === 'Active') next.status = 'Out of stock';
        if (next.stock > 0 && next.status === 'Out of stock') next.status = 'Active';
      }
      const changed = Object.fromEntries(
        Object.entries(next).filter(([k, v]) => (current as unknown as Record<string, unknown>)[k] !== v),
      );
      await this.client.batchUpdate(this.cells(t.products as Table<unknown>, t.products.rowNumbers[i], changed));
      const diff = Object.keys(changed)
        .filter((k) => k !== 'updatedAt')
        .map((k) => `${k}: ${(current as unknown as Record<string, unknown>)[k]} → ${(next as unknown as Record<string, unknown>)[k]}`)
        .join('; ');
      await this.client.append(tabRange(AUDIT.name), [this.auditRow(t, 'product.edit', sku, diff)]);
      return ok({ product: next });
    });
  }

  async createProduct(product: Product): Promise<Result<{ product: Product }>> {
    return this.exclusive(async (t) => {
      const sku = String(product?.sku || '').trim().toUpperCase();
      if (!/^[A-Z0-9-]{2,40}$/.test(sku)) return fail('SKU must be 2–40 letters, digits or dashes.');
      if (t.products.rows.some((p) => p.sku === sku)) return fail(`SKU ${sku} already exists.`);
      const clean = sanitizeProductPatch(product);
      if ('error' in clean) return fail(clean.error);
      const next: Product = { ...blankProduct(), ...clean.patch, sku, updatedAt: nowCairo() };
      await this.client.append(tabRange(PRODUCTS.name), [buildRow(t.products as Table<unknown>, { ...next })]);
      await this.client.append(tabRange(AUDIT.name), [this.auditRow(t, 'product.create', sku, `${next.nameEn} @ ${next.price}`)]);
      return ok({ product: next });
    });
  }

  async deleteProduct(sku: string): Promise<Result> {
    return this.exclusive(async (t) => {
      const i = t.products.rows.findIndex((p) => p.sku === sku);
      if (i < 0) return fail(`No product with SKU ${sku}.`);
      const sheetId = await this.sheetId(PRODUCTS.name);
      const row = t.products.rowNumbers[i];
      await this.client.structure([
        { deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: row - 1, endIndex: row } } },
      ]);
      await this.client.append(tabRange(AUDIT.name), [this.auditRow(t, 'product.delete', sku, t.products.rows[i].nameEn)]);
      return ok();
    });
  }

  // ---- CRM: orders ------------------------------------------------------

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<Result<{ restocked: boolean }>> {
    if (!ORDER_STATUSES.includes(status)) return fail(`Unknown status ${status}.`);
    return this.exclusive(async (t) => {
      const i = t.orders.rows.findIndex((o) => o.id === orderId);
      if (i < 0) return fail(`Order ${orderId} not found.`);
      const prev = t.orders.rows[i];
      if (prev.status === status) return ok({ restocked: false });

      const updates = this.cells(t.orders as Table<unknown>, t.orders.rowNumbers[i], {
        status,
        statusUpdatedAt: nowCairo(),
      });
      let restocked = false;
      if (settingsFrom(t.settings).restockOnCancel) {
        const items = t.items.rows.filter((it) => it.orderId === orderId);
        if (prev.status !== 'Cancelled' && status === 'Cancelled') {
          updates.push(...this.stockMoves(t, items, +1));
          restocked = items.length > 0;
        } else if (prev.status === 'Cancelled' && status !== 'Cancelled') {
          updates.push(...this.stockMoves(t, items, -1));
        }
      }
      const after = t.orders.rows.map((o, j) => (j === i ? { ...o, status } : o));
      const cust = this.customerWrites(t, prev.phone, after);
      await this.client.batchUpdate([...updates, ...cust.updates]);
      if (cust.append.length) await this.client.append(tabRange(CUSTOMERS.name), cust.append);
      await this.client.append(tabRange(AUDIT.name), [
        this.auditRow(t, 'order.status', orderId, `${prev.status} → ${status}${restocked ? ' (restocked)' : ''}`),
      ]);
      return ok({ restocked });
    });
  }

  async updateOrder(
    orderId: string,
    patch: { whatsappSent?: boolean; notes?: string; courierCost?: number },
  ): Promise<Result> {
    return this.exclusive(async (t) => {
      const i = t.orders.rows.findIndex((o) => o.id === orderId);
      if (i < 0) return fail(`Order ${orderId} not found.`);
      const values: Record<string, unknown> = {};
      if (patch.whatsappSent !== undefined) values.whatsappSent = Boolean(patch.whatsappSent);
      if (patch.notes !== undefined) values.notes = cleanText(patch.notes, FIELD_MAX.notes);
      if (patch.courierCost !== undefined) {
        const n = Number(patch.courierCost);
        if (!Number.isFinite(n) || n < 0) return fail('Courier cost must be 0 or more.');
        values.courierCost = n;
      }
      await this.client.batchUpdate(this.cells(t.orders as Table<unknown>, t.orders.rowNumbers[i], values));
      if (values.courierCost !== undefined || values.notes !== undefined) {
        await this.client.append(tabRange(AUDIT.name), [this.auditRow(t, 'order.edit', orderId, values)]);
      }
      return ok();
    });
  }

  // ---- CRM: customers ---------------------------------------------------

  async updateCustomer(phone: string, patch: Partial<Pick<Customer, 'tag' | 'notes' | 'name' | 'email' | 'address'>>): Promise<Result> {
    return this.exclusive(async (t) => {
      const key = canonPhone(phone);
      const i = t.customers.rows.findIndex((c) => canonPhone(c.phone) === key);
      if (i < 0) return fail('Customer not found.');
      const values: Record<string, unknown> = {};
      if (patch.tag !== undefined) values.tag = cleanText(patch.tag, 30);
      if (patch.notes !== undefined) values.notes = cleanText(patch.notes, 1000);
      if (patch.name !== undefined) values.name = cleanText(patch.name, FIELD_MAX.name);
      if (patch.email !== undefined) values.email = cleanText(patch.email, FIELD_MAX.email);
      if (patch.address !== undefined) values.address = cleanText(patch.address, FIELD_MAX.address);
      await this.client.batchUpdate(this.cells(t.customers as Table<unknown>, t.customers.rowNumbers[i], values));
      return ok();
    });
  }

  // ---- CRM: shipping and settings ----------------------------------------

  async saveZones(zones: ShippingZone[]): Promise<Result> {
    if (!Array.isArray(zones) || !zones.length) return fail('Add at least one zone.');
    const clean: ShippingZone[] = [];
    for (const z of zones) {
      const name = cleanText(z.zone, 60);
      if (!name) return fail('Every zone needs a name.');
      const nums = [z.fee, z.freeOver, z.courierCost].map(Number);
      if (nums.some((n) => !Number.isFinite(n) || n < 0)) return fail(`${name}: amounts must be 0 or more.`);
      const govs = (Array.isArray(z.governorates) ? z.governorates : String(z.governorates).split(/[,،]/))
        .map((g) => cleanText(g, 60).toLowerCase())
        .filter(Boolean);
      if (!govs.length) return fail(`${name}: list at least one governorate, or * for everywhere else.`);
      clean.push({ zone: name, governorates: govs, fee: nums[0], freeOver: nums[1], courierCost: nums[2] });
    }
    if (!clean.some((z) => z.governorates.includes('*'))) {
      return fail('One zone must cover everywhere else: put * in its governorates.');
    }
    return this.exclusive(async (t) => {
      this.requireCols(t.zones as Table<unknown>, ['zone', 'governorates', 'fee', 'freeOver', 'courierCost']);
      const before = t.zones.rows.map((z) => `${z.zone}: ${z.fee}/${z.freeOver}/${z.courierCost}`).join('; ');
      await this.client.clear(`${tabRange(SHIPPING.name)}!A2:ZZ`);
      await this.client.batchUpdate([
        {
          range: `${tabRange(SHIPPING.name)}!A2`,
          values: clean.map((z) => buildRow(t.zones as Table<unknown>, { ...z })),
        },
      ]);
      const after = clean.map((z) => `${z.zone}: ${z.fee}/${z.freeOver}/${z.courierCost}`).join('; ');
      await this.client.append(tabRange(AUDIT.name), [this.auditRow(t, 'shipping.save', 'zones', `${before} ⇒ ${after}`)]);
      return ok();
    });
  }

  async saveSettings(patch: Partial<Settings>): Promise<Result> {
    const map: Record<string, string> = {};
    if (patch.supportWhatsapp !== undefined) map.support_whatsapp = String(patch.supportWhatsapp).replace(/\D/g, '');
    if (patch.slaHours !== undefined) map.sla_hours = String(Math.max(1, Number(patch.slaHours) || 24));
    if (patch.restockOnCancel !== undefined) map.restock_on_cancel = patch.restockOnCancel ? 'Yes' : 'No';
    if (patch.lowStockThreshold !== undefined) map.low_stock_threshold = String(Math.max(0, Number(patch.lowStockThreshold) || 0));
    return this.exclusive(async (t) => {
      const updates: { range: string; values: Row[] }[] = [];
      const appends: Row[] = [];
      for (const [key, value] of Object.entries(map)) {
        const i = t.settings.rows.findIndex((r) => r.key === key);
        if (i >= 0) updates.push(...this.cells(t.settings as Table<unknown>, t.settings.rowNumbers[i], { value }));
        else appends.push(buildRow(t.settings as Table<unknown>, { key, value, about: '' }));
      }
      await this.client.batchUpdate(updates);
      if (appends.length) await this.client.append(tabRange(SETTINGS.name), appends);
      await this.client.append(tabRange(AUDIT.name), [this.auditRow(t, 'settings.save', 'settings', map)]);
      return ok();
    });
  }

  // ---- Setup and import ---------------------------------------------------

  private async sheetId(name: string): Promise<number> {
    if (!this.sheetIds?.has(name)) {
      this.sheetIds = new Map((await this.client.tabs()).map((s) => [s.title, s.sheetId]));
    }
    const id = this.sheetIds.get(name);
    if (id === undefined) throw new Error(`Tab "${name}" not found.`);
    return id;
  }

  /**
   * Create any missing tab, write headers, freeze/format them, add dropdowns,
   * and fill Shipping/Settings defaults if empty. Safe to run again: it never
   * touches data rows or reorders existing columns; missing columns are added
   * at the end.
   */
  async setup(): Promise<Result<{ log: string[] }>> {
    return this.queueRun(async () => {
      const log: string[] = [];
      let existing = await this.client.tabs();
      const missing = TABS.filter((d) => !existing.some((e) => e.title === d.name));
      if (missing.length) {
        await this.client.structure(missing.map((d) => ({ addSheet: { properties: { title: d.name } } })));
        log.push(`Created tabs: ${missing.map((d) => d.name).join(', ')}`);
        existing = await this.client.tabs();
      }
      this.sheetIds = new Map(existing.map((s) => [s.title, s.sheetId]));

      const headers = await this.client.batchGet(TABS.map((d) => `${tabRange(d.name)}!1:1`));
      const valueWrites: { range: string; values: Row[] }[] = [];
      const formatting: unknown[] = [];
      TABS.forEach((def, i) => {
        const current = (headers[i][0] ?? []).map((h) => String(h).trim());
        const lower = current.map((h) => h.toLowerCase());
        const add = def.columns.filter((c) => !lower.includes(c.header.toLowerCase())).map((c) => c.header);
        const finalHeader = [...current, ...add];
        if (add.length) {
          valueWrites.push({ range: `${tabRange(def.name)}!A1`, values: [finalHeader] });
          log.push(`${def.name}: added ${add.join(', ')}`);
        }
        const sheetId = this.sheetIds!.get(def.name)!;
        formatting.push(
          { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.957, green: 0.925, blue: 0.878 } } },
              fields: 'userEnteredFormat(textFormat,backgroundColor)',
            },
          },
        );
        def.columns.forEach((col) => {
          const ci = finalHeader.findIndex((h) => h.toLowerCase() === col.header.toLowerCase());
          if (ci < 0) return;
          if (col.note) {
            formatting.push({
              updateCells: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: ci, endColumnIndex: ci + 1 }, rows: [{ values: [{ note: col.note }] }], fields: 'note' },
            });
          }
          if (col.options) {
            formatting.push({
              setDataValidation: {
                range: { sheetId, startRowIndex: 1, startColumnIndex: ci, endColumnIndex: ci + 1 },
                rule: { condition: { type: 'ONE_OF_LIST', values: col.options.map((v) => ({ userEnteredValue: v })) }, strict: false, showCustomUi: true },
              },
            });
          }
          // Phone columns as plain text so a hand-typed 010... keeps its zero.
          if (col.key === 'phone') {
            formatting.push({
              repeatCell: {
                range: { sheetId, startRowIndex: 1, startColumnIndex: ci, endColumnIndex: ci + 1 },
                cell: { userEnteredFormat: { numberFormat: { type: 'TEXT' } } },
                fields: 'userEnteredFormat.numberFormat',
              },
            });
          }
        });
      });
      await this.client.batchUpdate(valueWrites);
      await this.client.structure(formatting);

      // Defaults for config tabs that have no rows yet.
      const [ship, sett] = await this.client.batchGet([tabRange(SHIPPING.name), tabRange(SETTINGS.name)]);
      if (ship.length <= 1) {
        const tz = parseTable<ShippingZone>(SHIPPING, ship);
        await this.client.append(tabRange(SHIPPING.name), DEFAULT_ZONES.map((z) => buildRow(tz as Table<unknown>, z)));
        log.push('Shipping: wrote default zones (Cairo & Giza 60, free over 800; rest of Egypt 75; courier 80).');
      }
      if (sett.length <= 1) {
        const ts = parseTable(SETTINGS, sett);
        await this.client.append(tabRange(SETTINGS.name), DEFAULT_SETTINGS.map((s) => buildRow(ts as Table<unknown>, s)));
        log.push('Settings: wrote defaults.');
      }
      // A brand-new spreadsheet comes with an empty "Sheet1"; remove it.
      const blank = existing.find((e) => /^(sheet1|ورقة1)$/i.test(e.title));
      if (blank && existing.length > 1) {
        const [v] = await this.client.batchGet([tabRange(blank.title)]);
        if (!v.length) {
          await this.client.structure([{ deleteSheet: { sheetId: blank.sheetId } }]);
          log.push(`Removed empty "${blank.title}".`);
        }
      }
      this.invalidate();
      if (!log.length) log.push('Sheet already set up; nothing to change.');
      return ok({ log });
    });
  }

  /** Copy products, orders, items, customers and newsletter from the old Sheet. */
  async importFrom(oldSheetId: string): Promise<Result<{ log: string[] }>> {
    return this.exclusive(async (t) => {
      if (t.products.rows.length || t.orders.rows.length) {
        return fail('The new Sheet already has products or orders. Import only runs into an empty Sheet.');
      }
      const old = this.open(oldSheetId);
      const data = await importFromOldSheet(old);
      const write = async (def: TabDef, table: Table<unknown>, rows: object[]) => {
        if (rows.length) await this.client.append(tabRange(def.name), rows.map((r) => buildRow(table, r as Record<string, unknown>)));
      };
      await write(PRODUCTS, t.products as Table<unknown>, data.products);
      await write(ORDERS, t.orders as Table<unknown>, data.orders);
      await write(ORDER_ITEMS, t.items as Table<unknown>, data.items);
      await write(CUSTOMERS, t.customers as Table<unknown>, data.customers);
      await write(NEWSLETTER, t.newsletter as Table<unknown>, data.newsletter);
      await this.client.append(tabRange(AUDIT.name), [this.auditRow(t, 'import', oldSheetId, data.log.join(' | '))]);
      return ok({ log: data.log });
    });
  }

  /** Like exclusive() but without the pre-read (setup may run before tabs exist). */
  private queueRun<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn);
    this.queue = run.catch(() => undefined);
    return run;
  }
}

// ---- Product validation ----------------------------------------------------

function blankProduct(): Product {
  return {
    sku: '',
    nameEn: '',
    nameAr: '',
    category: 'Sketchbooks',
    size: 'A5',
    sheets: 0,
    gsm: 0,
    paperType: '',
    price: 0,
    compareAt: 0,
    cost: 0,
    stock: 0,
    status: 'Active',
    image: '',
    descriptionEn: '',
    descriptionAr: '',
    featured: false,
    updatedAt: '',
  };
}

function sanitizeProductPatch(p: Partial<Product>): { patch: Partial<Product> } | { error: string } {
  const out: Partial<Product> = {};
  const text = (k: keyof Product, max: number) => {
    if (p[k] !== undefined) (out as Record<string, unknown>)[k] = cleanText(p[k], max);
  };
  text('nameEn', 120);
  text('nameAr', 120);
  text('category', 60);
  text('size', 40);
  text('paperType', 80);
  text('image', 300);
  text('descriptionEn', 2000);
  text('descriptionAr', 2000);
  for (const k of ['price', 'compareAt', 'cost', 'stock', 'sheets', 'gsm'] as const) {
    if (p[k] === undefined) continue;
    const n = Number(p[k]);
    if (!Number.isFinite(n) || n < 0) return { error: `${k} must be a number, 0 or more.` };
    out[k] = k === 'stock' || k === 'sheets' || k === 'gsm' ? Math.floor(n) : Math.round(n * 100) / 100;
  }
  if (p.status !== undefined) {
    if (!['Active', 'Out of stock', 'Hidden'].includes(p.status)) return { error: 'Status must be Active, Out of stock or Hidden.' };
    out.status = p.status;
  }
  if (p.featured !== undefined) out.featured = Boolean(p.featured);
  if (out.nameEn !== undefined && !out.nameEn) return { error: 'English name is required.' };
  return { patch: out };
}
