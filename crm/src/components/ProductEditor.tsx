'use client';

import { useEffect, useState } from 'react';
import type { Product } from '@data/types';
import { useData } from './DataProvider';
import { Button, Drawer, Field, Input, Select } from './ui';
import { createProduct, deleteProduct, patchProduct } from '@/app/actions';
import { money, pct } from '@/lib/format';
import { unitMargin } from '@/lib/metrics';

const EMPTY: Product = {
  sku: '',
  nameEn: '',
  nameAr: '',
  category: 'Sketchbooks',
  size: 'A5',
  sheets: 0,
  gsm: 0,
  paperType: '',
  price: 0,
  compareAt: 0,
  cost: 0,
  stock: 0,
  status: 'Active',
  image: '',
  descriptionEn: '',
  descriptionAr: '',
  featured: false,
  updatedAt: '',
};

export function productImage(image: string) {
  if (!image) return '';
  if (/^https?:\/\//.test(image)) return image;
  return `https://waraqa.art${image.startsWith('/') ? '' : '/products/'}${image}`;
}

/** `sku === null`: closed. `sku === ''`: new product. */
export function ProductEditor({ sku, onClose }: { sku: string | null; onClose: () => void }) {
  const { snap, run } = useData();
  const isNew = sku === '';
  const original = sku ? snap.products.find((p) => p.sku === sku) : undefined;
  const [p, setP] = useState<Product>(EMPTY);

  useEffect(() => {
    setP(original ? { ...original } : { ...EMPTY });
    // Only reset when a different product is opened, not on every background sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sku]);

  if (sku === null) return null;
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }));
  const num = (k: keyof Product) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Number(e.target.value) as never);
  const m = unitMargin(p);

  const save = async () => {
    if (isNew) {
      const res = await run(createProduct(p), `${p.sku} created`);
      if (res) onClose();
      return;
    }
    if (!original) return;
    const patch: Partial<Product> = {};
    (Object.keys(p) as (keyof Product)[]).forEach((k) => {
      if (k !== 'sku' && k !== 'updatedAt' && p[k] !== original[k]) (patch as Record<string, unknown>)[k] = p[k];
    });
    if (!Object.keys(patch).length) return onClose();
    const res = await run(
      patchProduct(original.sku, patch, patch.stock !== undefined ? { stock: original.stock } : undefined),
      `${original.sku} saved`,
    );
    if (res) onClose();
  };

  const remove = async () => {
    if (!original || !confirm(`Delete ${original.sku} from the Sheet? Past orders keep their lines. To just take it off the store, set Status to Hidden instead.`)) return;
    const res = await run(deleteProduct(original.sku), `${original.sku} deleted`);
    if (res) onClose();
  };

  return (
    <Drawer open onClose={onClose} title={isNew ? 'New product' : `${original?.sku} · ${original?.nameEn}`}>
      <div className="grid grid-cols-2 gap-4">
        {isNew && (
          <div className="col-span-2">
            <Field label="SKU" hint="Letters, digits, dashes. Can't be changed later.">
              <Input value={p.sku} onChange={(e) => set('sku', e.target.value.toUpperCase())} placeholder="WRQ-A5-150" />
            </Field>
          </div>
        )}
        <Field label="Name (EN)">
          <Input value={p.nameEn} onChange={(e) => set('nameEn', e.target.value)} />
        </Field>
        <Field label="Name (AR)">
          <Input dir="rtl" value={p.nameAr} onChange={(e) => set('nameAr', e.target.value)} />
        </Field>

        <Field label="Price (EGP)">
          <Input type="number" min={0} value={p.price} onChange={num('price')} />
        </Field>
        <Field label="Compare-at (EGP)" hint="Old price, struck through. 0 for none.">
          <Input type="number" min={0} value={p.compareAt} onChange={num('compareAt')} />
        </Field>
        <Field label="Cost (EGP)" hint="Private: never shown on the store.">
          <Input type="number" min={0} value={p.cost} onChange={num('cost')} />
        </Field>
        <div className="bg-white border border-line p-3 text-sm self-end">
          <div className="text-xs uppercase text-muted">Per unit</div>
          <div className={m.profit < 0 ? 'text-error font-semibold' : 'font-semibold'}>
            {money(m.profit)} profit · {pct(m.margin)}
          </div>
          <div className="text-xs text-muted">before shipping</div>
        </div>

        <Field label="Stock">
          <Input type="number" min={0} value={p.stock} onChange={num('stock')} />
        </Field>
        <Field label="Status">
          <Select value={p.status} onChange={(e) => set('status', e.target.value as Product['status'])}>
            <option>Active</option>
            <option>Out of stock</option>
            <option>Hidden</option>
          </Select>
        </Field>

        <Field label="Category">
          <Input value={p.category} onChange={(e) => set('category', e.target.value)} />
        </Field>
        <Field label="Size">
          <Input value={p.size} onChange={(e) => set('size', e.target.value)} />
        </Field>
        <Field label="Sheets">
          <Input type="number" min={0} value={p.sheets} onChange={num('sheets')} />
        </Field>
        <Field label="GSM">
          <Input type="number" min={0} value={p.gsm} onChange={num('gsm')} />
        </Field>
        <div className="col-span-2">
          <Field label="Paper type">
            <Input value={p.paperType} onChange={(e) => set('paperType', e.target.value)} />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Image" hint="File name in the store's /products folder, or a full URL.">
            <Input value={p.image} onChange={(e) => set('image', e.target.value)} />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Description (EN)">
            <textarea rows={3} value={p.descriptionEn} onChange={(e) => set('descriptionEn', e.target.value)} className="border border-line bg-white p-2 text-sm" />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Description (AR)">
            <textarea dir="rtl" rows={3} value={p.descriptionAr} onChange={(e) => set('descriptionAr', e.target.value)} className="border border-line bg-white p-2 text-sm" />
          </Field>
        </div>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={p.featured} onChange={(e) => set('featured', e.target.checked)} />
          Featured on the home page
        </label>
      </div>
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-line">
        {!isNew ? (
          <Button variant="danger" onClick={remove}>
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            {isNew ? 'Create' : 'Save'}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
