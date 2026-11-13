// ============================================================
// The new Sheet's layout. One definition per tab: every column has a key
// (what the code calls it), a header (what the Sheet shows) and a type.
//
// Columns are found by header text, never by position, so you can reorder
// columns or add your own in the Sheet without breaking anything. Renaming a
// header the code uses does break it: the data Worker then reports the
// missing column instead of guessing.
// ============================================================

export type ColType = 'text' | 'number' | 'bool' | 'list';

export interface Column {
  key: string;
  header: string;
  type: ColType;
  /** Shown as a note on the header cell. */
  note?: string;
  /** Dropdown values for data validation. */
  options?: readonly string[];
}

export interface TabDef {
  name: string;
  /** Key of the column that identifies a row (SKU, Order ID, phone...). */
  id?: string;
  columns: Column[];
}

const c = (key: string, header: string, type: ColType = 'text', extra: Partial<Column> = {}): Column => ({
  key,
  header,
  type,
  ...extra,
});

export const PRODUCTS: TabDef = {
  name: 'Products',
  id: 'sku',
  columns: [
    c('sku', 'SKU'),
    c('nameEn', 'Name (EN)'),
    c('nameAr', 'Name (AR)'),
    c('category', 'Category'),
    c('size', 'Size'),
    c('sheets', 'Sheets', 'number'),
    c('gsm', 'GSM', 'number'),
    c('paperType', 'Paper Type'),
    c('price', 'Price (EGP)', 'number', { note: 'What the customer pays. The store updates within seconds of a change.' }),
    c('compareAt', 'Compare-at (EGP)', 'number', { note: 'Old price shown struck through. 0 for none.' }),
    c('cost', 'Cost (EGP)', 'number', { note: 'What one unit costs to make. Private: never sent to the store.' }),
    c('stock', 'Stock', 'number'),
    c('status', 'Status', 'text', { options: ['Active', 'Out of stock', 'Hidden'] }),
    c('image', 'Image'),
    c('descriptionEn', 'Description (EN)'),
    c('descriptionAr', 'Description (AR)'),
    c('featured', 'Featured', 'bool', { options: ['Yes', 'No'] }),
    c('updatedAt', 'Updated At'),
  ],
};

export const ORDERS: TabDef = {
  name: 'Orders',
  id: 'id',
  columns: [
    c('id', 'Order ID'),
    c('createdAt', 'Created At'),
    c('customerName', 'Customer Name'),
    c('phone', 'Phone'),
    c('email', 'Email'),
    c('governorate', 'Governorate'),
    c('city', 'City'),
    c('address', 'Address'),
    c('itemsSummary', 'Items'),
    c('totalQty', 'Qty', 'number'),
    c('subtotal', 'Subtotal (EGP)', 'number'),
    c('shippingCharged', 'Shipping Charged (EGP)', 'number'),
    c('courierCost', 'Courier Cost (EGP)', 'number', { note: 'What the courier charged us for this order.' }),
    c('total', 'Total (EGP)', 'number'),
    c('payment', 'Payment'),
    c('status', 'Status', 'text', {
      options: ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled', 'Returned'],
    }),
    c('whatsappSent', 'WhatsApp Sent', 'bool', { options: ['Yes', 'No'] }),
    c('statusUpdatedAt', 'Status Updated At'),
    c('notes', 'Notes'),
    c('lang', 'Lang'),
  ],
};

export const ORDER_ITEMS: TabDef = {
  name: 'Order Items',
  columns: [
    c('orderId', 'Order ID'),
    c('sku', 'SKU'),
    c('productName', 'Product'),
    c('qty', 'Qty', 'number'),
    c('unitPrice', 'Unit Price (EGP)', 'number'),
    c('unitCost', 'Unit Cost (EGP)', 'number'),
    c('lineTotal', 'Line Total (EGP)', 'number'),
  ],
};

export const CUSTOMERS: TabDef = {
  name: 'Customers',
  id: 'phone',
  columns: [
    c('phone', 'Phone'),
    c('name', 'Name'),
    c('email', 'Email'),
    c('governorate', 'Governorate'),
    c('address', 'Address'),
    c('firstOrder', 'First Order'),
    c('lastOrder', 'Last Order'),
    c('orders', 'Orders', 'number', { note: 'Orders that were not cancelled. Kept up to date automatically.' }),
    c('spent', 'Spent (EGP)', 'number', { note: 'Total of orders that were neither cancelled nor returned.' }),
    c('tag', 'Tag', 'text', {
      note: 'New / Repeat / VIP are set automatically and only move up. Any other tag (Risk, Blocked...) is yours and is never overwritten.',
    }),
    c('notes', 'Notes'),
  ],
};

export const SHIPPING: TabDef = {
  name: 'Shipping',
  id: 'zone',
  columns: [
    c('zone', 'Zone'),
    c('governorates', 'Governorates', 'list', {
      note: 'Comma-separated, English and/or Arabic. Use * for "everywhere else".',
    }),
    c('fee', 'Fee (EGP)', 'number', { note: 'Shipping the customer pays.' }),
    c('freeOver', 'Free Over (EGP)', 'number', { note: 'Subtotal at which shipping is free. 0 = never free.' }),
    c('courierCost', 'Courier Cost (EGP)', 'number', { note: 'What the courier charges us per order.' }),
  ],
};

export const SETTINGS: TabDef = {
  name: 'Settings',
  id: 'key',
  columns: [c('key', 'Key'), c('value', 'Value'), c('about', 'About')],
};

export const NEWSLETTER: TabDef = {
  name: 'Newsletter',
  id: 'email',
  columns: [c('email', 'Email'), c('date', 'Date'), c('locale', 'Locale'), c('source', 'Source')],
};

export const AUDIT: TabDef = {
  name: 'Audit Log',
  columns: [c('at', 'At'), c('action', 'Action'), c('target', 'Target'), c('details', 'Details')],
};

export const TABS = [PRODUCTS, ORDERS, ORDER_ITEMS, CUSTOMERS, SHIPPING, SETTINGS, NEWSLETTER, AUDIT];

/** Settings rows written on first setup. */
export const DEFAULT_SETTINGS: { key: string; value: string; about: string }[] = [
  { key: 'support_whatsapp', value: '201069237525', about: 'Support WhatsApp number, international format, no +.' },
  { key: 'sla_hours', value: '24', about: 'Hours to confirm a new order before it is flagged late.' },
  { key: 'restock_on_cancel', value: 'Yes', about: 'Put items back in stock when an order is cancelled.' },
  { key: 'low_stock_threshold', value: '3', about: 'Stock at or below this shows as low in the CRM.' },
];

/** Shipping zones written on first setup (today's rates). */
export const DEFAULT_ZONES = [
  { zone: 'Cairo & Giza', governorates: 'cairo, giza, القاهرة, الجيزة', fee: 60, freeOver: 800, courierCost: 80 },
  { zone: 'Rest of Egypt', governorates: '*', fee: 75, freeOver: 0, courierCost: 80 },
];

// ---- Row <-> object ------------------------------------------------------

export type Cell = string | number | boolean;
export type Row = Cell[];

/** Header text -> column index, matched case-insensitively. */
export function headerIndex(header: Row): Map<string, number> {
  const m = new Map<string, number>();
  header.forEach((h, i) => m.set(String(h).trim().toLowerCase(), i));
  return m;
}

export interface Table<T> {
  def: TabDef;
  /** Column key -> 0-based column index in the Sheet. -1 when missing. */
  col: Record<string, number>;
  rows: T[];
  /** 1-based Sheet row number of each entry in `rows`. */
  rowNumbers: number[];
  width: number;
}

function parseCell(v: Cell | undefined, type: ColType): unknown {
  switch (type) {
    case 'number': {
      if (v === undefined || v === '') return 0;
      const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''));
      return Number.isFinite(n) ? n : 0;
    }
    case 'bool': {
      const s = String(v ?? '').trim().toLowerCase();
      return s === 'yes' || s === 'true' || s === '1' || v === true;
    }
    case 'list':
      return String(v ?? '')
        .split(/[,،]/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    default:
      return String(v ?? '').trim();
  }
}

export function toCell(v: unknown, type: ColType): Cell {
  switch (type) {
    case 'number':
      return Number(v) || 0;
    case 'bool':
      return v ? 'Yes' : 'No';
    case 'list':
      return Array.isArray(v) ? v.join(', ') : String(v ?? '');
    default:
      return String(v ?? '');
  }
}

export function parseTable<T>(def: TabDef, values: Row[]): Table<T> {
  const header = values[0] ?? [];
  const idx = headerIndex(header);
  const col: Record<string, number> = {};
  for (const column of def.columns) col[column.key] = idx.get(column.header.toLowerCase()) ?? -1;

  const rows: T[] = [];
  const rowNumbers: number[] = [];
  const idCol = def.id ? col[def.id] : -1;
  for (let r = 1; r < values.length; r++) {
    const raw = values[r] ?? [];
    // Skip blank rows, and rows without an id on tabs that have one.
    if (!raw.some((v) => String(v ?? '').trim() !== '')) continue;
    if (idCol >= 0 && String(raw[idCol] ?? '').trim() === '') continue;
    const obj: Record<string, unknown> = {};
    for (const column of def.columns) {
      const i = col[column.key];
      obj[column.key] = parseCell(i >= 0 ? raw[i] : undefined, column.type);
    }
    rows.push(obj as T);
    rowNumbers.push(r + 1);
  }
  return { def, col, rows, rowNumbers, width: header.length };
}

/** A full row in the Sheet's own column order, for appending. */
export function buildRow(table: Table<unknown>, obj: Record<string, unknown>): Row {
  const row: Row = new Array(Math.max(table.width, 1)).fill('');
  for (const column of table.def.columns) {
    const i = table.col[column.key];
    if (i >= 0 && obj[column.key] !== undefined) row[i] = toCell(obj[column.key], column.type);
  }
  return row;
}

/** Column index -> A1 letters (0 -> A, 26 -> AA). */
export function colLetter(i: number): string {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** `'Order Items'!C5` */
export function a1(tab: string, colIndex: number, rowNumber: number): string {
  return `'${tab.replace(/'/g, "''")}'!${colLetter(colIndex)}${rowNumber}`;
}

export function tabRange(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'`;
}
