// ============================================================
// waraqa-data: the only thing that reads or writes the Waraqa Sheet.
//
// It has no public URL. Other Workers reach it through service bindings:
//   - the store binds to PublicApi (catalog, place an order, newsletter)
//   - the CRM binds to AdminApi (everything)
// so the store can never call an admin method, and nothing on the internet can
// call either. The CRM does its own sign-in before calling AdminApi.
// ============================================================

import { WorkerEntrypoint } from 'cloudflare:workers';
import { SheetStore, type Env } from './store';
import type { Customer, OrderRequest, OrderStatus, Product, Settings, ShippingZone } from './types';

export { SheetStore };

function store(env: Env) {
  return env.STORE.get(env.STORE.idFromName('main'));
}

export class PublicApi extends WorkerEntrypoint<Env> {
  catalog() {
    return store(this.env).catalog();
  }
  createOrder(req: OrderRequest) {
    return store(this.env).createOrder(req);
  }
  subscribe(email: string, locale: string, source: string) {
    return store(this.env).subscribe(email, locale, source);
  }
}

export class AdminApi extends WorkerEntrypoint<Env> {
  snapshot(fresh = false) {
    return store(this.env).snapshot(fresh);
  }
  catalog() {
    return store(this.env).catalog();
  }
  auditLog(limit?: number) {
    return store(this.env).auditLog(limit);
  }
  patchProduct(sku: string, patch: Partial<Omit<Product, 'sku' | 'updatedAt'>>, expected?: { stock?: number }) {
    return store(this.env).patchProduct(sku, patch, expected);
  }
  createProduct(product: Product) {
    return store(this.env).createProduct(product);
  }
  deleteProduct(sku: string) {
    return store(this.env).deleteProduct(sku);
  }
  updateOrderStatus(orderId: string, status: OrderStatus) {
    return store(this.env).updateOrderStatus(orderId, status);
  }
  updateOrder(orderId: string, patch: { whatsappSent?: boolean; notes?: string; courierCost?: number }) {
    return store(this.env).updateOrder(orderId, patch);
  }
  updateCustomer(phone: string, patch: Partial<Pick<Customer, 'tag' | 'notes' | 'name' | 'email' | 'address'>>) {
    return store(this.env).updateCustomer(phone, patch);
  }
  saveZones(zones: ShippingZone[]) {
    return store(this.env).saveZones(zones);
  }
  saveSettings(patch: Partial<Settings>) {
    return store(this.env).saveSettings(patch);
  }
  setup() {
    return store(this.env).setup();
  }
  importFrom(oldSheetId: string) {
    return store(this.env).importFrom(oldSheetId);
  }
}

export default {
  // No public routes. Only a health check, reachable in local dev.
  async fetch(): Promise<Response> {
    return new Response('waraqa-data: use a service binding', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
