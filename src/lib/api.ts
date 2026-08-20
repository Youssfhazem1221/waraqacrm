import type { Product, Order, Customer, AnalyticsMetrics, OrderStatus } from '@/types';
import { INITIAL_PRODUCTS, INITIAL_ORDERS, INITIAL_CUSTOMERS } from './data';

const STORAGE_KEY_PRODUCTS = 'waraqa_crm_products';
const STORAGE_KEY_ORDERS = 'waraqa_crm_orders';
const STORAGE_KEY_CUSTOMERS = 'waraqa_crm_customers';
const STORAGE_KEY_TOKEN = 'waraqa_crm_token';
const STORAGE_KEY_API_URL = 'waraqa_crm_api_url';

export function getStoredApiUrl(): string {
  return localStorage.getItem(STORAGE_KEY_API_URL) || '';
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
// LOCAL STATE MANAGEMENT & FALLBACK BRIDGE
// -------------------------------------------------------------

function getLocalProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRODUCTS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading local products', e);
  }
  return INITIAL_PRODUCTS;
}

function saveLocalProducts(products: Product[]) {
  localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products));
}

function getLocalOrders(): Order[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ORDERS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading local orders', e);
  }
  return INITIAL_ORDERS;
}

function saveLocalOrders(orders: Order[]) {
  localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
}

function getLocalCustomers(): Customer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOMERS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading local customers', e);
  }
  return INITIAL_CUSTOMERS;
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
    const res = await fetch(`${apiUrl}?what=products`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.ok && Array.isArray(data.products) && data.products.length > 0) {
      saveLocalProducts(data.products);
      return { products: data.products, isLive: true };
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
    const res = await fetch(`${apiUrl}?what=orders&token=${encodeURIComponent(token)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.ok && Array.isArray(data.orders)) {
      saveLocalOrders(data.orders);
      return { orders: data.orders, isLive: true };
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
    const res = await fetch(`${apiUrl}?what=customers&token=${encodeURIComponent(token)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.ok && Array.isArray(data.customers)) {
      saveLocalCustomers(data.customers);
      return { customers: data.customers, isLive: true };
    }
  } catch (err) {
    console.warn('[Waraqa CRM] Using local cached customers:', err);
  }

  return { customers: getLocalCustomers(), isLive: false };
}

export async function saveProductToBackend(product: Product, token: string): Promise<boolean> {
  // Update local cache immediately
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
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'saveProduct',
        token,
        product,
      }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch (err) {
    console.error('[Waraqa CRM] Failed to save product to Google Sheet:', err);
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
    });
    const data = await res.json();
    return data.ok === true;
  } catch (err) {
    console.error('[Waraqa CRM] Failed to update stock to Google Sheet:', err);
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
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'updateOrderStatus',
        token,
        orderId,
        status,
      }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch (err) {
    console.error('[Waraqa CRM] Failed to update order status to Google Sheet:', err);
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
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'logWhatsApp',
        token,
        orderId,
        sent,
      }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch (err) {
    console.error('[Waraqa CRM] Failed to log WhatsApp to Google Sheet:', err);
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

    const govRaw = o['Governorate/City'] || 'Cairo';
    const govClean = govRaw.split('·')[0].split(',')[0].trim();
    govDistribution[govClean] = (govDistribution[govClean] || 0) + 1;
  });

  const aov = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;
  const repeatCount = customers.filter(c => c['Total Orders'] >= 2).length;
  const repeatCustomerRate = customers.length > 0 ? Math.round((repeatCount / customers.length) * 100) : 0;
  const totalStockUnits = products.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
  const lowStockSkus = products.filter(p => p.stock > 0 && p.stock <= 5).length;
  const outOfStockSkus = products.filter(p => p.stock === 0).length;

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
