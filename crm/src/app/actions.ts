'use server';

// Every mutation the CRM makes. Each one checks the session, calls the data
// Worker, and returns the result together with the Sheet as it is now, so the
// screen always shows what was actually saved (never an optimistic guess that
// silently failed, which was the old CRM's main sync problem).

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Customer, OrderStatus, Product, Result, Settings, ShippingZone, Snapshot } from '@data/types';
import { checkPassword, data, endSession, loginAllowed, requireSession, startSession } from '@/lib/auth';

export type ActionResult<T = object> = { result: Result<T>; snapshot?: Snapshot };

async function after<T extends object>(result: Result<T>): Promise<ActionResult<T>> {
  // The write dropped the data Worker's cache and a fresh read is already in
  // flight; this waits for it rather than starting another.
  const snapshot = await data().snapshot();
  return { result, snapshot };
}

function failure<T extends object = object>(err: unknown): ActionResult<T> {
  return { result: { ok: false, error: err instanceof Error ? err.message : String(err) } };
}

async function guarded<T extends object>(fn: () => Promise<Result<T>>): Promise<ActionResult<T>> {
  try {
    await requireSession();
    return await after(await fn());
  } catch (err) {
    return failure<T>(err);
  }
}

// ---- Session ---------------------------------------------------------------

export async function login(_prev: { error?: string } | null, form: FormData): Promise<{ error?: string }> {
  const ip = (await headers()).get('cf-connecting-ip') ?? 'local';
  if (!(await loginAllowed(ip))) return { error: 'Too many attempts. Wait a minute and try again.' };
  const password = String(form.get('password') ?? '');
  let ok = false;
  try {
    ok = await checkPassword(password);
  } catch (err) {
    return { error: (err as Error).message };
  }
  if (!ok) return { error: 'Wrong password.' };
  await startSession();
  redirect('/');
}

export async function logout() {
  await endSession();
  redirect('/login');
}

// ---- Reads -------------------------------------------------------------------

export async function loadSnapshot(fresh = false): Promise<{ snapshot?: Snapshot; error?: string }> {
  try {
    await requireSession();
    return { snapshot: await data().snapshot(fresh) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function loadAudit() {
  await requireSession();
  return data().auditLog(300);
}

// ---- Products ------------------------------------------------------------------

export async function patchProduct(
  sku: string,
  patch: Partial<Omit<Product, 'sku' | 'updatedAt'>>,
  expected?: { stock?: number },
) {
  return guarded(() => data().patchProduct(sku, patch, expected));
}

export async function createProduct(product: Product) {
  return guarded(() => data().createProduct(product));
}

export async function deleteProduct(sku: string) {
  return guarded(() => data().deleteProduct(sku));
}

// ---- Orders ----------------------------------------------------------------------

export async function setOrderStatus(orderId: string, status: OrderStatus) {
  return guarded(() => data().updateOrderStatus(orderId, status));
}

export async function updateOrder(orderId: string, patch: { whatsappSent?: boolean; notes?: string; courierCost?: number }) {
  return guarded(() => data().updateOrder(orderId, patch));
}

// ---- Customers -------------------------------------------------------------------

export async function updateCustomer(
  phone: string,
  patch: Partial<Pick<Customer, 'tag' | 'notes' | 'name' | 'email' | 'address'>>,
) {
  return guarded(() => data().updateCustomer(phone, patch));
}

// ---- Shipping & settings ---------------------------------------------------------

export async function saveZones(zones: ShippingZone[]) {
  return guarded(() => data().saveZones(zones));
}

export async function saveSettings(patch: Partial<Settings>) {
  return guarded(() => data().saveSettings(patch));
}

export async function runSetup() {
  return guarded(() => data().setup());
}

export async function runImport(oldSheetIdOrUrl: string) {
  const id = String(oldSheetIdOrUrl).match(/[-\w]{25,}/)?.[0];
  if (!id) return failure<{ log: string[] }>(new Error('Paste the old Sheet URL or its ID.'));
  return guarded(() => data().importFrom(id));
}
