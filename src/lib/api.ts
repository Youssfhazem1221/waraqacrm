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
// CRM API OPERATIONS (BIDIRECTIONAL REAL-TIME SYNC)
// -------------------------------------------------------------

export async function fetchProductsData(): Promise<{ products: Product[]; isLive: boolean }> {
  const apiUrl = getStoredApiUrl();
  if (!apiUrl) {
    return { products: getLocalProducts(), isLive: false };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${apiUrl}?what=products`, { cache: 'no-store', signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${apiUrl}?what=orders&token=${encodeURIComponent(token)}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${apiUrl}?what=customers&token=${encodeURIComponent(token)}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
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

export async function saveProductToBackend(product: Product, token: string): Promise<boolean> {
  const current = getLocalProducts();
  const index = current.findIndex(p => p.sku === product.sku);
  let updated: Product[];
  if (index >= 0) {
    updated = current.map(p => p.sku === product.sku ? product : p);
  } else {
    updated = [product, ...current];
  }
  saveLocalProducts(updated);

  const apiUrl = getStoredApiUrl();
  if (!apiUrl || !token) return true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'saveProduct',
        token,
        product,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return false;
    const data = await res.json();
    return data.ok === true;
  } catch (err) {
    console.warn('[Waraqa CRM] Note: Failed to sync product to Google Sheet (local cache saved):', err);
    return false;
  }
}

export async function deleteProductFromBackend(sku: string, token: string): Promise<boolean> {
  const current = getLocalProducts();
  saveLocalProducts(current.filter(p => p.sku !== sku));

  const apiUrl = getStoredApiUrl();
  if (!apiUrl || !token) return true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'deleteProduct',
        token,
        sku,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return false;
    const data = await res.json();
    return data.ok === true;
  } catch (err) {
    console.warn('[Waraqa CRM] Note: Failed to delete product from Google Sheet (removed from local cache):', err);
    return false;
  }
}

export async function updateStockQuick(sku: string, stock: number, status: string, token: string): Promise<boolean> {
  const current = getLocalProducts();
  const updated = current.map(p => p.sku === sku ? { ...p, stock, status: status as Product['status'] } : p);
  saveLocalProducts(updated);

  const apiUrl = getStoredApiUrl();
  if (!apiUrl || !token) return true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'updateStock',
        token,
        sku,
        stock,
        status,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return false;
    const data = await res.json();
    return data.ok === true;
  } catch (err) {
    console.warn('[Waraqa CRM] Note: Failed to sync stock to Google Sheet (local cache saved):', err);
    return false;
  }
}

export async function updateOrderStatusInBackend(orderId: string, status: OrderStatus, token: string): Promise<boolean> {
  const current = getLocalOrders();
  const updated = current.map(o => o['Order ID'] === orderId ? { ...o, Status: status } : o);
  saveLocalOrders(updated);

  const apiUrl = getStoredApiUrl();
  if (!apiUrl || !token) return true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'updateOrderStatus',
        token,
        orderId,
        status,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return false;
    const data = await res.json();
    return data.ok === true;
  } catch (err) {
    console.warn('[Waraqa CRM] Note: Failed to sync order status to Google Sheet (local cache saved):', err);
    return false;
  }
}

export async function logWhatsAppSent(orderId: string, sent: boolean, token: string): Promise<boolean> {
  const current = getLocalOrders();
  const updated = current.map(o => o['Order ID'] === orderId ? { ...o, 'WhatsApp sent?': (sent ? 'Yes' : 'No') as 'Yes' | 'No' } : o);
  saveLocalOrders(updated);

  const apiUrl = getStoredApiUrl();
  if (!apiUrl || !token) return true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'logWhatsApp',
        token,
        orderId,
        sent,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return false;
    const data = await res.json();
    return data.ok === true;
  } catch (err) {
    console.warn('[Waraqa CRM] Note: Failed to sync WhatsApp log to Google Sheet (local cache saved):', err);
    return false;
  }
}

export async function updateCustomerInBackend(phone: string, updates: { tag?: string; notes?: string }, token: string): Promise<boolean> {
  const current = getLocalCustomers();
  const updated = current.map(c => c['Phone (WhatsApp)'] === phone
    ? { ...c, ...(updates.tag !== undefined ? { 'Customer Tag': updates.tag as Customer['Customer Tag'] } : {}), ...(updates.notes !== undefined ? { Notes: updates.notes } : {}) }
    : c);
  saveLocalCustomers(updated);

  const apiUrl = getStoredApiUrl();
  if (!apiUrl || !token) return true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'updateCustomer',
        token,
        phone,
        ...updates,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return false;
    const data = await res.json();
    return data.ok === true;
  } catch (err) {
    console.warn('[Waraqa CRM] Note: Failed to sync customer update to Google Sheet (local cache saved):', err);
    return false;
  }
}

export function computeAnalytics(orders: Order[], customers: Customer[], products: Product[]): AnalyticsMetrics {
  let totalRevenue = 0;
  let deliveredRevenue = 0;
  let pendingRevenue = 0;
  let pendingOrders = 0;
  let deliveredOrders = 0;
  let cancelledOrders = 0;
  const govDistribution: Record<string, number> = {};

  if (Array.isArray(orders)) {
    orders.forEach(o => {
      const total = Number(o['Total (EGP)']) || 0;
      const status = o.Status || 'Pending';
      totalRevenue += total;

      if (status === 'Delivered') {
        deliveredRevenue += total;
        deliveredOrders++;
      } else if (status === 'Pending') {
        pendingRevenue += total;
        pendingOrders++;
      } else if (status === 'Cancelled' || status === 'Returned') {
        cancelledOrders++;
      }

      const govRaw = String(o['Governorate/City'] || 'Cairo');
      const govClean = govRaw.split('·')[0].split(',')[0].trim() || 'Cairo';
      govDistribution[govClean] = (govDistribution[govClean] || 0) + 1;
    });
  }

  const aov = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;
  const repeatCount = Array.isArray(customers) ? customers.filter(c => Number(c['Total Orders'] || 0) >= 2).length : 0;
  const repeatCustomerRate = customers.length > 0 ? Math.round((repeatCount / customers.length) * 100) : 0;
  const totalStockUnits = Array.isArray(products) ? products.reduce((sum, p) => sum + (Number(p.stock) || 0), 0) : 0;
  const lowStockSkus = Array.isArray(products) ? products.filter(p => Number(p.stock) > 0 && Number(p.stock) <= 5).length : 0;
  const outOfStockSkus = Array.isArray(products) ? products.filter(p => Number(p.stock) === 0).length : 0;

  return {
    totalRevenue,
    deliveredRevenue,
    pendingRevenue,
    totalOrders: orders.length,
    pendingOrders,
    deliveredOrders,
    cancelledOrders,
    aov,
    totalCustomers: customers.length,
    repeatCustomerRate,
    totalStockUnits,
    lowStockSkus,
    outOfStockSkus,
    govDistribution,
  };
}
