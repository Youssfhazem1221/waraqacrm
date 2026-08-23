// ============================================================
// Waraqa CRM — TypeScript Domain Types
// ============================================================

export interface Product {
  sku: string;
  name: string;
  nameAr: string;
  category: string;
  size: string;
  sheets: number;
  gsm: number;
  paperType: string;
  price: number;
  compareAt: number;
  stock: number;
  status: 'Active' | 'Out of stock' | 'Hidden';
  image: string;
  description: string;
  featured: boolean;
}

export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Packed'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled'
  | 'Returned';

export interface Order {
  'Order ID': string;
  'Timestamp': string;
  'Customer name': string;
  'Phone (WhatsApp)': string;
  'Email': string;
  'Governorate/City': string;
  'Address': string;
  'Items summary': string;
  'Total qty': number;
  'Subtotal (EGP)': number;
  'Shipping (EGP)': number;
  'Total (EGP)': number;
  'Payment': string;
  'Status': OrderStatus;
  'WhatsApp sent?': 'Yes' | 'No';
  'Notes': string;
}

export interface Customer {
  'Phone (WhatsApp)': string;
  'Customer Name': string;
  'Email': string;
  'Delivery Address': string;
  'First Order Date': string;
  'Total Orders': number;
  'Total Spent (EGP)': number;
  'Customer Tag': 'New' | 'Active' | 'Repeat' | 'VIP' | 'Risk';
  'Notes'?: string;
}

export interface AnalyticsMetrics {
  totalRevenue: number;
  deliveredRevenue: number;
  pendingRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  aov: number;
  /** Shipping fees actually collected on delivered orders (EGP). */
  shippingCollected: number;
  totalCustomers: number;
  repeatCustomerRate: number;
  totalStockUnits: number;
  lowStockSkus: number;
  outOfStockSkus: number;
  govDistribution: Record<string, number>;
}

export type ActiveTab = 'dashboard' | 'orders' | 'inventory' | 'customers' | 'analytics' | 'settings';
