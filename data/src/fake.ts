// ============================================================
// Local development only (FAKE_SHEETS=1 in .dev.vars): an in-memory stand-in
// for the Google Sheets API, so the CRM and store can be run end to end
// without a service account. The spreadsheet "demo-old-sheet-for-local-dev" is pre-filled in
// the OLD Apps Script layout (real products, made-up orders) so the import
// can be exercised too. Nothing here is used when FAKE_SHEETS is unset.
// ============================================================

import type { Row } from './schema';

type Book = Map<string, Row[]>;
const books = new Map<string, Book>();

const OLD_PRODUCTS: Row[] = [
  ['SKU', 'Name (EN)', 'Name (AR)', 'Category', 'Size', 'Sheets', 'GSM', 'Paper feel', 'Price (EGP)', 'Compare-at (EGP)', 'Stock', 'Status', 'Image filename', 'Short description', 'Featured?'],
  ...([["WRQ-A5-320", "A5 Mixed Media Sketchbook, 25 Sheets, 320gsm", "سكتش بوك ميكسد ميديا A5 — ٢٥ ورقة", "Sketchbooks", "A5", 25, 320, "Mixed Media", 280, 0, 3, "Active", "wrq-a5-320.jpeg", "Heavy 320gsm mixed media paper — perfect for watercolour, gouache, ink, and markers. 25 sheets of premium acid-free paper with a kraft cover and sturdy spiral binding.", "No"], ["WRQ-A5-KFT", "A5 Kraft Sketchbook, 40 Sheets, 180gsm", "سكتش بوك كرافت A5 — ٤٠ ورقة", "Sketchbooks", "A5", 40, 180, "Kraft", 220, 0, 16, "Active", "wrq-a5-kft.jpeg", "Warm-toned 180gsm kraft paper, ideal for pencil, charcoal, and pastel work. 40 sheets with a natural kraft cover and wire spiral binding.", "Yes"], ["WRQ-A5-150", "A5 Drawing Sketchbook, 50 Sheets, 150gsm", "سكتش بوك رسم A5 — ٥٠ ورقة", "Sketchbooks", "A5", 50, 150, "Drawing", 250, 0, 4, "Active", "wrq-a5-150.jpeg", "Your everyday drawing companion — 50 sheets of smooth 150gsm paper for pencil, pen, and light marker work. Kraft cover with spiral binding.", "Yes"], ["WRQ-A5-250", "A5 Sketchbook, 35 Sheets, 250gsm", "سكتش بوك A5 — ٣٥ ورقة", "Sketchbooks", "A5", 35, 250, "Mixed Media", 255, 0, 7, "Active", "wrq-a5-250.jpeg", "Versatile 250gsm paper for mixed media, watercolour, and ink techniques. 35 sheets of acid-free paper with a kraft cover and spiral binding.", "No"], ["WRQ-MINI", "Mini Sketchbook, 40 Sheets, 200gsm", "سكتش بوك ميني — ٤٠ ورقة", "Sketchbooks", "Mini (10.5×15)", 40, 200, "Mixed Media", 100, 0, 20, "Active", "wrq-mini.jpeg", "Pocket-sized creativity — 40 sheets of 200gsm mixed media paper in a compact 10.5×15cm format. Top spiral binding, perfect for sketching on the go.", "Yes"], ["WRQ-LG-150", "Large Sketchbook 25×35, 20 Sheets, 150gsm", "سكتش بوك كبير ٢٥×٣٥ — ٢٠ ورقة", "Sketchbooks", "25×35cm", 20, 150, "Dry Media", 200, 0, 4, "Active", "wrq-lg-150.jpeg", "Large 25×35cm format for expansive sketches — 20 sheets of 150gsm dry media paper. Top spiral binding with a vintage-illustrated kraft cover.", "Yes"], ["WRQ-SQ-250", "Square Sketchbook 25×35, 20 Sheets, 250gsm", "سكتش بوك مربع ٢٥×٢٥ — ٢٠ ورقة", "Sketchbooks", "25×35cm", 20, 250, "Mixed Media", 245, 0, 3, "Active", "wrq-sq-250.jpeg", "Unique square format — 20 sheets of heavy 250gsm mixed media paper in a 25×25cm size. Ideal for composition studies, illustration, and creative layouts.", "No"], ["WRQ-A4-320", "A4 Mixed Media Sketchbook, 20 Sheets, 320gsm", "سكتش بوك ميكسد ميديا A4 — ٢٠ ورقة", "Sketchbooks", "A4", 20, 320, "Mixed Media", 250, 0, 0, "Out of stock", "wrq-a4-320.jpeg", "Studio-grade A4 format — 20 sheets of ultra-heavy 320gsm mixed media paper. Handles watercolour, acrylic, ink, and heavy media with ease. Top spiral binding.", "No"]] as Row[]),
];

function oldOrders(): { orders: Row[]; items: Row[]; customers: Row[] } {
  const orders: Row[] = [['Order ID', 'Timestamp', 'Customer name', 'Phone (WhatsApp)', 'Email', 'Governorate/City', 'Address', 'Items summary', 'Total qty', 'Subtotal (EGP)', 'Shipping (EGP)', 'Total (EGP)', 'Payment', 'Status', 'WhatsApp sent?', 'Notes']];
  const items: Row[] = [['Order ID', 'SKU', 'Product name', 'Qty', 'Unit price (EGP)', 'Line total (EGP)']];
  const people = [
    ['Test Customer One', '1000000001', 'Cairo · Nasr City'],
    ['Test Customer Two', '+201000000002', 'Giza · Dokki'],
    ['Test Customer Three', '01000000003', 'Alexandria · Smouha'],
    ['Test Customer One', '01000000001', 'Cairo · Nasr City'],
  ];
  const statuses = ['Delivered', 'Delivered', 'Shipped', 'Pending', 'Cancelled', 'Confirmed', 'Delivered', 'Pending'];
  const now = Date.now();
  statuses.forEach((status, i) => {
    const [name, phone, gov] = people[i % people.length];
    const p = OLD_PRODUCTS[1 + (i % (OLD_PRODUCTS.length - 1))];
    const qty = 1 + (i % 2);
    const price = Number(p[8]);
    const subtotal = qty * price;
    const ship = gov.startsWith('Alexandria') ? 75 : subtotal >= 800 ? 0 : 60;
    const d = new Date(now - (statuses.length - i) * 3 * 86_400_000 + 2 * 3_600_000);
    const ts = d.toISOString().slice(0, 16).replace('T', ' ');
    const id = 'WRQ-' + (1001 + i);
    orders.push([id, ts, name, phone, 'test' + (i % 3) + '@example.com', gov, 'Test street ' + (i + 1), p[1] + ' ×' + qty, qty, subtotal, ship, subtotal + ship, 'Cash on delivery', status, i < 3 ? 'Yes' : 'No', '']);
    items.push([id, p[0], p[1], qty, price, subtotal]);
  });
  const customers: Row[] = [['Phone (WhatsApp)', 'Customer Name', 'Email', 'Delivery Address', 'First Order Date', 'Total Orders', 'Total Spent (EGP)', 'Customer Tag', 'Notes'], ['01000000003', 'Test Customer Three', '', '', '', 1, 0, 'Risk', 'Asked to call before delivery']];
  return { orders, items, customers };
}

function book(id: string): Book {
  let b = books.get(id);
  if (!b) {
    b = new Map();
    if (id === 'demo-old-sheet-for-local-dev') {
      const o = oldOrders();
      b.set('📦 Products', OLD_PRODUCTS.map((r) => [...r]));
      b.set('Orders', o.orders);
      b.set('Order_Items', o.items);
      b.set('Customers', o.customers);
    } else {
      b.set('Sheet1', []);
    }
    books.set(id, b);
  }
  return b;
}

function parseRange(range: string): { tab: string; cell?: { col: number; row: number }; fromRow?: number } {
  const m = range.match(/^'((?:[^']|'')+)'(?:!(.*))?$/);
  const tab = m ? m[1].replace(/''/g, "'") : range.split('!')[0];
  const ref = m?.[2];
  if (!ref) return { tab };
  const rowOnly = ref.match(/^(\d+):\d+$/);
  if (rowOnly) return { tab, cell: { col: 0, row: +rowOnly[1] } };
  const a = ref.match(/^([A-Z]+)(\d+)/);
  if (!a) return { tab };
  let col = 0;
  for (const ch of a[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { tab, cell: { col: col - 1, row: +a[2] }, fromRow: +a[2] };
}

export class FakeSheetsClient {
  constructor(readonly spreadsheetId: string) {}

  private grid(tab: string): Row[] {
    const g = book(this.spreadsheetId).get(tab);
    if (!g) throw new Error(`Unable to parse range: ${tab}`);
    return g;
  }

  async tabs() {
    return [...book(this.spreadsheetId).keys()].map((title, i) => ({ title, sheetId: i + 1 }));
  }

  async batchGet(ranges: string[]): Promise<Row[][]> {
    return ranges.map((r) => {
      const { tab, cell } = parseRange(r);
      const g = book(this.spreadsheetId).get(tab) ?? [];
      if (cell && /!\d+:\d+$/.test(r)) return g[cell.row - 1] ? [[...g[cell.row - 1]]] : [];
      // Trim trailing empty rows like the real API.
      const out = g.map((row) => [...row]);
      while (out.length && !out[out.length - 1].some((v) => String(v ?? '') !== '')) out.pop();
      return out;
    });
  }

  async batchUpdate(data: { range: string; values: Row[] }[]) {
    for (const d of data) {
      const { tab, cell } = parseRange(d.range);
      const g = this.grid(tab);
      const start = cell ?? { col: 0, row: 1 };
      d.values.forEach((vals, i) => {
        const r = start.row - 1 + i;
        while (g.length <= r) g.push([]);
        vals.forEach((v, j) => {
          const row = g[r];
          while (row.length <= start.col + j) row.push('');
          row[start.col + j] = v;
        });
      });
    }
  }

  async append(range: string, rows: Row[]) {
    const g = this.grid(parseRange(range).tab);
    while (g.length && !g[g.length - 1].some((v) => String(v ?? '') !== '')) g.pop();
    g.push(...rows.map((r) => [...r]));
  }

  async clear(range: string) {
    const { tab, fromRow } = parseRange(range);
    const g = this.grid(tab);
    g.splice((fromRow ?? 1) - 1);
  }

  async structure(requests: unknown[]) {
    const b = book(this.spreadsheetId);
    for (const req of requests as Record<string, any>[]) {
      if (req.addSheet) b.set(req.addSheet.properties.title, []);
      if (req.deleteSheet) {
        const title = [...b.keys()][req.deleteSheet.sheetId - 1];
        if (title) b.delete(title);
      }
      if (req.deleteDimension) {
        const r = req.deleteDimension.range;
        const title = [...b.keys()][r.sheetId - 1];
        b.get(title)?.splice(r.startIndex, r.endIndex - r.startIndex);
      }
      // Formatting, notes and validation have no effect here.
    }
  }
}
