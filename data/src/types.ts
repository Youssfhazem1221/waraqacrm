// ============================================================
// Waraqa data: domain types shared by the data Worker, the CRM and the store.
// The CRM imports these directly; the store keeps a copy in its own repo.
// ============================================================

export type ProductStatus = 'Active' | 'Out of stock' | 'Hidden';

export interface Product {
  sku: string;
  nameEn: string;
  nameAr: string;
  category: string;
  size: string;
  sheets: number;
  gsm: number;
  paperType: string;
  /** What the customer pays (EGP). */
  price: number;
  /** Struck-through "was" price; 0 for none. */
  compareAt: number;
  /** What one unit costs us to make (EGP). Never sent to the store. */
  cost: number;
  stock: number;
  status: ProductStatus;
  image: string;
  descriptionEn: string;
  descriptionAr: string;
  featured: boolean;
  updatedAt: string;
}

/** A product as the public store sees it: no cost. */
export type PublicProduct = Omit<Product, 'cost'>;

export const ORDER_STATUSES = [
  'Pending',
  'Confirmed',
  'Packed',
  'Shipped',
  'Delivered',
  'Cancelled',
  'Returned',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface Order {
  id: string;
  createdAt: string;
  customerName: string;
  phone: string;
  email: string;
  governorate: string;
  city: string;
  address: string;
  itemsSummary: string;
  totalQty: number;
  subtotal: number;
  /** Shipping fee the customer was charged. */
  shippingCharged: number;
  /** What the courier charges us for this order. */
  courierCost: number;
  total: number;
  payment: string;
  status: OrderStatus;
  whatsappSent: boolean;
  statusUpdatedAt: string;
  notes: string;
  lang: 'en' | 'ar';
}

export interface OrderItem {
  orderId: string;
  sku: string;
  productName: string;
  qty: number;
  unitPrice: number;
  /** Product cost when the order was placed, so margins stay historical. */
  unitCost: number;
  lineTotal: number;
}

export const AUTO_TAGS = ['New', 'Repeat', 'VIP'] as const;
export const CUSTOMER_TAGS = ['New', 'Repeat', 'VIP', 'Risk', 'Blocked'] as const;

export interface Customer {
  phone: string;
  name: string;
  email: string;
  governorate: string;
  address: string;
  firstOrder: string;
  lastOrder: string;
  orders: number;
  spent: number;
  tag: string;
  notes: string;
}

export interface ShippingZone {
  zone: string;
  /** Lower-case governorate names (English and Arabic) in this zone. `*` = everywhere else. */
  governorates: string[];
  /** Fee charged to the customer (EGP). */
  fee: number;
  /** Subtotal at which shipping becomes free; 0 = never free. */
  freeOver: number;
  /** What the courier charges us per order in this zone (EGP). */
  courierCost: number;
}

export interface Settings {
  supportWhatsapp: string;
  slaHours: number;
  restockOnCancel: boolean;
  lowStockThreshold: number;
}

export interface AuditEntry {
  at: string;
  action: string;
  target: string;
  details: string;
}

/** Everything the CRM works with, read in one go. */
export interface Snapshot {
  products: Product[];
  orders: Order[];
  items: OrderItem[];
  customers: Customer[];
  zones: ShippingZone[];
  settings: Settings;
  /** When the data was read from the Sheet (ms since epoch). */
  readAt: number;
  sheetUrl: string;
}

/** What the store needs: the public catalog and how to price shipping. */
export interface Catalog {
  products: PublicProduct[];
  zones: Omit<ShippingZone, 'courierCost'>[];
  /** Cairo date (yyyy-mm-dd) the customer-facing rates last changed; '' if never recorded. */
  shippingUpdatedAt: string;
  supportWhatsapp: string;
  readAt: number;
}

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; conflict?: boolean };

// ---- Store → data Worker -----------------------------------------------

export interface OrderRequest {
  customer: {
    name: string;
    phone: string;
    email: string;
    governorate: string;
    city?: string;
    address: string;
  };
  items: { sku: string; qty: number }[];
  notes?: string;
  lang?: 'en' | 'ar';
}

export type OrderResult = Result<{ orderId: string; subtotal: number; shipping: number; total: number }>;
