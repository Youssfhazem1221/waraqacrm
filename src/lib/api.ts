import type { Product, Order, Customer, AnalyticsMetrics, OrderStatus } from '@/types';
import { INITIAL_PRODUCTS, INITIAL_ORDERS, INITIAL_CUSTOMERS } from './data';
import { DEFAULT_WEB_APP_URL } from './constants';

const STORAGE_KEY_PRODUCTS = 'waraqa_crm_products';
const STORAGE_KEY_ORDERS = 'waraqa_crm_orders';
const STORAGE_KEY_CUSTOMERS = 'waraqa_crm_customers';
const STORAGE_KEY_TOKEN = 'waraqa_crm_token';
const STORAGE_KEY_API_URL = 'waraqa_crm_api_url';

export function getStoredApiUrl(): string {
  return localStorage.getItem(STORAGE_KEY_API_URL) || DEFAULT_WEB_APP_URL || '';
}

export function setStoredApiUrl(url: string) {
  localStorage.setItem(STORAGE_KEY_API_URL, url.trim());
}

export function getStoredToken(): string {
  return sessionStorage.getItem(STORAGE_KEY_TOKEN) || localStorage.getItem(STORAGE_KEY_TOKEN) || '';
}

export function setStoredToken(token: string) {
  sessionStorage.setItem(STORAGE_KEY_TOKEN, token.trim());
  localStorage.setItem(STORAGE_KEY_TOKEN, token.trim());
}

export function clearStoredToken() {
  sessionStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_TOKEN);
}

// -------------------------------------------------------------
// NORMALIZERS FOR BULLETPROOF GOOGLE SHEETS COMPATIBILITY
// -------------------------------------------------------------

export function normalizeProduct(raw: any): Product {
  return {
    sku: String(raw.sku || raw.SKU || ''),
    name: String(raw.name || raw['Name (EN)'] || raw.Name || 'Sketchbook'),
    nameAr: String(raw.nameAr || raw['Name (AR)'] || raw['الاسم'] || ''),
    category: String(raw.category || raw.Category || 'Sketchbooks'),
    size: String(raw.size || raw.Size || 'A5'),
    sheets: Number(raw.sheets || raw.Sheets || 0),
    gsm: Number(raw.gsm || raw.GSM || 0),
    paperType: String(raw.paperType || raw['Paper Type'] || raw['Paper feel'] || ''),
    price: Number(raw.price || raw['Price (EGP)'] || raw.Price || 0),
    compareAt: Number(raw.compareAt || raw['Compare-at (EGP)'] || raw['Compare-at'] || 0),
    stock: Number(raw.stock !== undefined ? raw.stock : raw.Stock !== undefined ? raw.Stock : 0),
    status: (raw.status || raw.Status || (Number(raw.stock || 0) === 0 ? 'Out of stock' : 'Active')) as Product['status'],
    image: String(raw.image || raw['Image filename'] || raw.Image || ''),
    description: String(raw.description || raw['Short description'] || raw.Description || ''),
    featured: Boolean(raw.featured === true || raw['Featured?'] === 'Yes' || String(raw.featured).toLowerCase() === 'true'),
  };
}

export function normalizeOrder(raw: any): Order {
  const orderId = String(raw['Order ID'] || raw['Order #'] || raw.orderId || raw.id || 'WRQ-1000');
  const timestampRaw = raw['Timestamp'] || raw['Date'] || raw.timestamp || '';
  const timestampStr = typeof timestampRaw === 'string' ? timestampRaw : String(timestampRaw);

  return {
    'Order ID': orderId,
    'Timestamp': timestampStr,
    'Customer name': String(raw['Customer name'] || raw['Customer Name'] || raw.customerName || 'Customer'),
    'Phone (WhatsApp)': String(raw['Phone (WhatsApp)'] || raw['Phone'] || raw.phone || ''),
    'Email': String(raw['Email'] || raw.email || ''),
    'Governorate/City': String(raw['Governorate/City'] || raw['Governorate'] || raw['City'] || raw.city || 'Cairo'),
    'Address': String(raw['Address'] || raw.address || ''),
    'Items summary': String(raw['Items summary'] || raw['Items'] || raw.itemsSummary || ''),
    'Total qty': Number(raw['Total qty'] || raw['Total Qty'] || raw.totalQty || 1),
    'Subtotal (EGP)': Number(raw['Subtotal (EGP)'] || raw['Subtotal'] || raw.subtotal || 0),
    'Shipping (EGP)': Number(raw['Shipping (EGP)'] || raw['Shipping'] || raw.shipping || 0),
    'Total (EGP)': Number(raw['Total (EGP)'] || raw['Total'] || raw.total || 0),
    'Payment': String(raw['Payment'] || raw.payment || 'Cash on delivery'),
    'Status': (raw['Status'] || raw.status || 'Pending') as OrderStatus,
    'WhatsApp sent?': (raw['WhatsApp sent?'] === 'Yes' || raw.whatsAppSent ? 'Yes' : 'No') as 'Yes' | 'No',
    'Notes': String(raw['Notes'] || raw.notes || ''),
  };
}

export function normalizeCustomer(raw: any): Customer {
  return {
    'Phone (WhatsApp)': String(raw['Phone (WhatsApp)'] || raw['Phone'] || raw.phone || ''),
    'Customer Name': String(raw['Customer Name'] || raw['Customer name'] || raw.name || 'Customer'),
    'Email': String(raw['Email'] || raw.email || ''),
    'Delivery Address': String(raw['Delivery Address'] || raw['Address'] || raw.address || ''),
    'First Order Date': String(raw['First Order Date'] || raw['First Order'] || raw.date || ''),
    'Total Orders': Number(raw['Total Orders'] || raw.ordersCount || 1),
    'Total Spent (EGP)': Number(raw['Total Spent (EGP)'] || raw['Total Spent'] || raw.totalSpent || 0),
    'Customer Tag': (raw['Customer Tag'] || raw.tag || 'Active') as Customer['Customer Tag'],
    'Notes': String(raw['Notes'] || raw.notes || ''),
  };
}

// -------------------------------------------------------------
// LOCAL STATE MANAGEMENT & FALLBACK BRIDGE
// -------------------------------------------------------------

function getLocalProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRODUCTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeProduct);
      }
    }
  } catch (e) {
    console.warn('Error reading local products', e);
  }
  return INITIAL_PRODUCTS.map(normalizeProduct);
}

function saveLocalProducts(products: Product[]) {
  localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products));
}

function getLocalOrders(): Order[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ORDERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeOrder);
      }
    }
  } catch (e) {
    console.warn('Error reading local orders', e);
  }
  return INITIAL_ORDERS.map(normalizeOrder);
}

function saveLocalOrders(orders: Order[]) {
  localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
}

function getLocalCustomers(): Customer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOMERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeCustomer);
      }
    }
  } catch (e) {
    console.warn('Error reading local customers', e);
  }
  return INITIAL_CUSTOMERS.map(normalizeCustomer);
}

function saveLocalCustomers(customers: Customer[]) {
  localStorage.setItem(STORAGE_KEY_CUSTOMERS, JSON.stringify(customers));
}

// -------------------------------------------------------------
// TRANSPORT
// -------------------------------------------------------------
// Every call below used to carry its own copy of the same
// AbortController/setTimeout/try-catch block. Besides the duplication, each
// copy leaked its timer whenever the fetch threw (clearTimeout sat on the happy
// path only), and read timeouts were set to 2.5s — shorter than a routine Apps
// Script cold start, so the CRM fell back to cached data on almost every load
// and reported itself as offline.

/** Reads: generous enough to survive an Apps Script cold start. */
const READ_TIMEOUT_MS = 15_000;
/** Writes: a sheet write plus email sending can legitimately take a while. */
const WRITE_TIMEOUT_MS = 20_000;

export interface WriteResult {
  /** Did the change reach the Google Sheet? */
  synced: boolean;
  /** Why not, when it didn't — safe to show the operator. */
  error?: string;
}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(READ_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * POST an admin action to the Apps Script.
 * Returns whether the sheet actually accepted the write, so callers can tell
 * the operator the truth instead of assuming success.
 */
async function postAction(payload: Record<string, unknown>): Promise<WriteResult> {
  const apiUrl = getStoredApiUrl();
  if (!apiUrl) return { synced: false, error: 'No Web App URL configured' };
  if (!payload.token) return { synced: false, error: 'Not signed in' };

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
    });

    if (!res.ok) return { synced: false, error: `Backend returned HTTP ${res.status}` };

    const data = await res.json();
    if (data?.ok === true) return { synced: true };

    return {
      synced: false,
      error:
        data?.error === 'unauthorized'
          ? 'Admin token rejected by the backend'
          : String(data?.error || 'Backend refused the change'),
    };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    return {
      synced: false,
      error: timedOut ? 'Backend timed out' : 'Could not reach the Google Sheet',
    };
  }
}

/**
 * Check an admin token against the backend.
 * The sign-in form used to accept any string and only discover a bad token
 * later, as silent fallbacks to demo data.
 */
export async function verifyToken(token: string): Promise<{ ok: boolean; error?: string }> {
  const apiUrl = getStoredApiUrl();
  if (!apiUrl) return { ok: false, error: 'No Web App URL configured yet — add it in Settings.' };
  if (!token.trim()) return { ok: false, error: 'Enter your admin token.' };

  try {
    const data = await getJson(`${apiUrl}?what=customers&token=${encodeURIComponent(token.trim())}`);
    if (data?.ok === true) return { ok: true };
    if (data?.error === 'unauthorized') {
      return { ok: false, error: 'That token does not match the one in the Apps Script.' };
    }
    return { ok: false, error: String(data?.error || 'Backend rejected the token.') };
  } catch {
    return {
      ok: false,
      error: 'Could not reach the backend. Check the Web App URL in Settings, or continue offline.',
    };
  }
}

// -------------------------------------------------------------
// CRM API OPERATIONS (BIDIRECTIONAL REAL-TIME SYNC)
// -------------------------------------------------------------

export async function fetchProductsData(): Promise<{ products: Product[]; isLive: boolean }> {
  const apiUrl = getStoredApiUrl();
  if (!apiUrl) {
    return { products: getLocalProducts(), isLive: false };
  }

  try {
    const data = await getJson(`${apiUrl}?what=products`);
    if (data.ok && Array.isArray(data.products) && data.products.length > 0) {
      const normalized = data.products.map(normalizeProduct);
      saveLocalProducts(normalized);
      return { products: normalized, isLive: true };
    }
  } catch (err) {
    console.warn('[Waraqa CRM] Using local cached products:', err);
  }

  return { products: getLocalProducts(), isLive: false };
}

export async function fetchOrdersData(token: string): Promise<{ orders: Order[]; isLive: boolean }> {
  const apiUrl = getStoredApiUrl();
  if (!apiUrl || !token) {
    return { orders: getLocalOrders(), isLive: false };
  }

  try {
    const data = await getJson(`${apiUrl}?what=orders&token=${encodeURIComponent(token)}`);
    if (data.ok && Array.isArray(data.orders)) {
      const normalized = data.orders.map(normalizeOrder);
      saveLocalOrders(normalized);
      return { orders: normalized, isLive: true };
    }
  } catch (err) {
    console.warn('[Waraqa CRM] Using local cached orders:', err);
  }

  return { orders: getLocalOrders(), isLive: false };
}

export async function fetchCustomersData(token: string): Promise<{ customers: Customer[]; isLive: boolean }> {
  const apiUrl = getStoredApiUrl();
  if (!apiUrl || !token) {
    return { customers: getLocalCustomers(), isLive: false };
  }

  try {
    const data = await getJson(`${apiUrl}?what=customers&token=${encodeURIComponent(token)}`);
    if (data.ok && Array.isArray(data.customers)) {
      const normalized = data.customers.map(normalizeCustomer);
      saveLocalCustomers(normalized);
      return { customers: normalized, isLive: true };
    }
  } catch (err) {
    console.warn('[Waraqa CRM] Using local cached customers:', err);
  }

  return { customers: getLocalCustomers(), isLive: false };
}

export async function saveProductToBackend(product: Product, token: string): Promise<WriteResult> {
  const current = getLocalProducts();
  const index = current.findIndex(p => p.sku === product.sku);
  const updated = index >= 0
    ? current.map(p => p.sku === product.sku ? product : p)
    : [product, ...current];
  saveLocalProducts(updated);

  return postAction({ action: 'saveProduct', token, product });
}

export async function deleteProductFromBackend(sku: string, token: string): Promise<WriteResult> {
  const current = getLocalProducts();
  saveLocalProducts(current.filter(p => p.sku !== sku));

  return postAction({ action: 'deleteProduct', token, sku });
}

export async function updateStockQuick(sku: string, stock: number, status: string, token: string): Promise<WriteResult> {
  const current = getLocalProducts();
  const updated = current.map(p => p.sku === sku ? { ...p, stock, status: status as Product['status'] } : p);
  saveLocalProducts(updated);

  return postAction({ action: 'updateStock', token, sku, stock, status });
}

export async function updateOrderStatusInBackend(orderId: string, status: OrderStatus, token: string): Promise<WriteResult> {
  const current = getLocalOrders();
  const updated = current.map(o => o['Order ID'] === orderId ? { ...o, Status: status } : o);
  saveLocalOrders(updated);

  return postAction({ action: 'updateOrderStatus', token, orderId, status });
}

export async function logWhatsAppSent(orderId: string, sent: boolean, token: string): Promise<WriteResult> {
  const current = getLocalOrders();
  const updated = current.map(o => o['Order ID'] === orderId ? { ...o, 'WhatsApp sent?': (sent ? 'Yes' : 'No') as 'Yes' | 'No' } : o);
  saveLocalOrders(updated);

  return postAction({ action: 'logWhatsApp', token, orderId, sent });
}

export async function updateCustomerInBackend(phone: string, updates: { tag?: string; notes?: string }, token: string): Promise<WriteResult> {
  const current = getLocalCustomers();
  const updated = current.map(c => c['Phone (WhatsApp)'] === phone
    ? { ...c, ...(updates.tag !== undefined ? { 'Customer Tag': updates.tag as Customer['Customer Tag'] } : {}), ...(updates.notes !== undefined ? { Notes: updates.notes } : {}) }
    : c);
  saveLocalCustomers(updated);

  return postAction({ action: 'updateCustomer', token, phone, ...updates });
}

export function computeAnalytics(orders: Order[], customers: Customer[], products: Product[]): AnalyticsMetrics {
  let totalRevenue = 0;
  let deliveredRevenue = 0;
  let pendingRevenue = 0;
  let pendingOrders = 0;
  let deliveredOrders = 0;
  let cancelledOrders = 0;
  let shippingCollected = 0;
  const govDistribution: Record<string, number> = {};

  // Orders that will never be paid for are not revenue. Counting them inflated
  // both the revenue headline and AOV, and the inflation grew with every
  // cancellation — exactly when the number most needs to be trustworthy.
  let liveOrders = 0;
  const safeOrders = Array.isArray(orders) ? orders : [];

  safeOrders.forEach(o => {
    const total = Number(o['Total (EGP)']) || 0;
    const status = o.Status || 'Pending';
    const isVoid = status === 'Cancelled' || status === 'Returned';

    if (!isVoid) {
      totalRevenue += total;
      liveOrders++;
    }

    if (status === 'Delivered') {
      deliveredRevenue += total;
      deliveredOrders++;
      shippingCollected += Number(o['Shipping (EGP)']) || 0;
    } else if (status === 'Pending') {
      pendingRevenue += total;
      pendingOrders++;
    } else if (isVoid) {
      cancelledOrders++;
    }

    const govRaw = String(o['Governorate/City'] || 'Cairo');
    const govClean = govRaw.split('·')[0].split(',')[0].trim() || 'Cairo';
    govDistribution[govClean] = (govDistribution[govClean] || 0) + 1;
  });

  const aov = liveOrders > 0 ? Math.round(totalRevenue / liveOrders) : 0;
  const safeCustomers = Array.isArray(customers) ? customers : [];
  const repeatCount = safeCustomers.filter(c => Number(c['Total Orders'] || 0) >= 2).length;
  const repeatCustomerRate = safeCustomers.length > 0 ? Math.round((repeatCount / safeCustomers.length) * 100) : 0;
  const totalStockUnits = Array.isArray(products) ? products.reduce((sum, p) => sum + (Number(p.stock) || 0), 0) : 0;
  const lowStockSkus = Array.isArray(products) ? products.filter(p => Number(p.stock) > 0 && Number(p.stock) <= 5).length : 0;
  const outOfStockSkus = Array.isArray(products) ? products.filter(p => Number(p.stock) === 0).length : 0;

  return {
    totalRevenue,
    deliveredRevenue,
    pendingRevenue,
    totalOrders: safeOrders.length,
    pendingOrders,
    deliveredOrders,
    cancelledOrders,
    aov,
    shippingCollected,
    totalCustomers: safeCustomers.length,
    repeatCustomerRate,
    totalStockUnits,
    lowStockSkus,
    outOfStockSkus,
    govDistribution,
  };
}
