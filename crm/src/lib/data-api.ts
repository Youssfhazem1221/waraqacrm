// The data Worker's AdminApi as the CRM sees it over the service binding.
// Mirrors data/src/index.ts (AdminApi); keep the two in step.
import type {
  AuditEntry,
  Catalog,
  Customer,
  OrderStatus,
  Product,
  Result,
  Settings,
  ShippingZone,
  Snapshot,
} from '@data/types';

export interface DataApi {
  snapshot(fresh?: boolean): Promise<Snapshot>;
  catalog(): Promise<Catalog>;
  auditLog(limit?: number): Promise<AuditEntry[]>;
  patchProduct(
    sku: string,
    patch: Partial<Omit<Product, 'sku' | 'updatedAt'>>,
    expected?: { stock?: number },
  ): Promise<Result<{ product: Product }>>;
  createProduct(product: Product): Promise<Result<{ product: Product }>>;
  deleteProduct(sku: string): Promise<Result>;
  updateOrderStatus(orderId: string, status: OrderStatus): Promise<Result<{ restocked: boolean }>>;
  updateOrder(orderId: string, patch: { whatsappSent?: boolean; notes?: string; courierCost?: number }): Promise<Result>;
  updateCustomer(
    phone: string,
    patch: Partial<Pick<Customer, 'tag' | 'notes' | 'name' | 'email' | 'address'>>,
  ): Promise<Result>;
  saveZones(zones: ShippingZone[]): Promise<Result>;
  saveSettings(patch: Partial<Settings>): Promise<Result>;
  setup(): Promise<Result<{ log: string[] }>>;
  importFrom(oldSheetId: string): Promise<Result<{ log: string[] }>>;
}
