'use client';

import { useState } from 'react';
import type { Product, Snapshot } from '@data/types';
import { useData } from '@/components/DataProvider';
import { PageHeader } from '@/components/Shell';
import { NumberCell } from '@/components/NumberCell';
import { ProductEditor, productImage } from '@/components/ProductEditor';
import { Button, Select } from '@/components/ui';
import { patchProduct } from '@/app/actions';
import { ago, cn, money, pct } from '@/lib/format';
import { unitMargin } from '@/lib/metrics';

/** The same patch the data Worker applies, so the screen changes before the Sheet answers. */
function applyPatch(s: Snapshot, sku: string, fields: Partial<Product>): Snapshot {
  return {
    ...s,
    products: s.products.map((p) => {
      if (p.sku !== sku) return p;
      const next = { ...p, ...fields };
      if (fields.stock !== undefined && fields.status === undefined) {
        if (next.stock === 0 && next.status === 'Active') next.status = 'Out of stock';
        if (next.stock > 0 && next.status === 'Out of stock') next.status = 'Active';
      }
      return next;
    }),
  };
}

export default function ProductsPage() {
  const { snap, run } = useData();
  const [editing, setEditing] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const low = snap.settings.lowStockThreshold;

  // No pop-up for inline edits: the header shows Saving… / Saved, errors still pop up.
  const patch = (p: Product, fields: Partial<Product>) =>
    run(
      patchProduct(p.sku, fields, fields.stock !== undefined ? { stock: p.stock } : undefined),
      undefined,
      (s) => applyPatch(s, p.sku, fields),
    );

  const units = snap.products.reduce((s, p) => s + p.stock, 0);
  const stockValue = snap.products.reduce((s, p) => s + p.stock * p.cost, 0);
  const noCost = snap.products.filter((p) => !p.cost).length;
  const products = snap.products.filter(
    (p) => !q.trim() || [p.nameEn, p.nameAr, p.sku, p.size].some((v) => v.toLowerCase().includes(q.trim().toLowerCase())),
  );

  return (
    <>
      <PageHeader
        title="Products"
        sub={
          <>
            Tap a number to change it; it saves as soon as you leave the field and the store shows it within seconds. {units} units in stock
            {stockValue ? ` (${money(stockValue)} at cost)` : ''}.
            {noCost > 0 && <span className="text-warning"> {noCost} product{noCost === 1 ? ' has' : 's have'} no cost yet, so margins are overstated.</span>}
          </>
        }
        actions={
          <>
            <input
              placeholder="Search products…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="flex-1 sm:w-56 h-11 md:h-9 px-3 border border-line bg-white text-base md:text-sm focus:outline-none focus:border-maroon"
            />
            <Button variant="primary" onClick={() => setEditing('')}>
              + New product
            </Button>
          </>
        }
      />

      {/* Phone: one card per product, the three numbers you change most within thumb reach. */}
      <div className="md:hidden space-y-3">
        {products.map((p) => {
          const m = unitMargin(p);
          return (
            <article key={p.sku} className="bg-white border border-line">
              <button className="w-full flex items-center gap-3 p-3 text-left" onClick={() => setEditing(p.sku)}>
                <Thumb image={p.image} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium leading-snug line-clamp-2">{p.nameEn}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {p.sku} · {p.size}
                  </div>
                </div>
                <span className="text-muted text-sm shrink-0">Edit ›</span>
              </button>
              <div className="grid grid-cols-3 gap-2 px-3 pb-3">
                <label className="text-[11px] uppercase tracking-wide text-muted">
                  Price
                  <NumberCell label={`Price of ${p.sku}`} value={p.price} onSave={(n) => patch(p, { price: n })} className="w-full mt-1 text-left" />
                </label>
                <label className="text-[11px] uppercase tracking-wide text-muted">
                  Cost
                  <NumberCell label={`Cost of ${p.sku}`} value={p.cost} onSave={(n) => patch(p, { cost: n })} className={cn('w-full mt-1 text-left', !p.cost && 'bg-warning/10')} />
                </label>
                <div className="text-[11px] uppercase tracking-wide text-muted">
                  Margin
                  <div className={cn('h-11 mt-1 flex items-center text-base normal-case tracking-normal tabular-nums', m.profit < 0 ? 'text-error' : p.cost ? 'text-success' : 'text-muted')}>
                    {p.cost ? pct(m.margin) : '–'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 pb-3">
                <StockStepper p={p} low={low} onChange={(n) => patch(p, { stock: n })} />
                <Select
                  value={p.status}
                  aria-label={`Status of ${p.sku}`}
                  onChange={(e) => patch(p, { status: e.target.value as Product['status'] })}
                  className="flex-1 min-w-0"
                >
                  <option>Active</option>
                  <option>Out of stock</option>
                  <option>Hidden</option>
                </Select>
              </div>
            </article>
          );
        })}
      </div>

      {/* Desktop: the full table. */}
      <div className="hidden md:block bg-white border border-line overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="text-xs uppercase text-muted border-b border-line bg-cream/50">
            <tr>
              <th className="text-left p-3">Product</th>
              <th className="text-right p-3">Price</th>
              <th className="text-right p-3">Compare-at</th>
              <th className="text-right p-3">Cost</th>
              <th className="text-right p-3">Margin</th>
              <th className="text-right p-3">Stock</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Featured</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const m = unitMargin(p);
              return (
                <tr key={p.sku} className="border-b border-line/60 hover:bg-cream/40">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <Thumb image={p.image} />
                      <div className="min-w-0">
                        <div className="font-medium truncate max-w-[260px]">{p.nameEn}</div>
                        <div className="text-xs text-muted">
                          {p.sku} · {p.size} · {p.sheets} sh · {p.gsm} gsm
                          {p.updatedAt && <> · edited {ago(p.updatedAt)}</>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <NumberCell label={`Price of ${p.sku}`} value={p.price} onSave={(n) => patch(p, { price: n })} />
                  </td>
                  <td className="p-3 text-right">
                    <NumberCell label={`Compare-at of ${p.sku}`} value={p.compareAt} onSave={(n) => patch(p, { compareAt: n })} />
                  </td>
                  <td className="p-3 text-right">
                    <NumberCell label={`Cost of ${p.sku}`} value={p.cost} onSave={(n) => patch(p, { cost: n })} className={!p.cost ? 'bg-warning/10' : ''} />
                  </td>
                  <td className={cn('p-3 text-right tabular-nums', m.profit < 0 ? 'text-error' : p.cost ? 'text-success' : 'text-muted')}>
                    {p.cost ? (
                      <>
                        {pct(m.margin)}
                        <div className="text-xs text-muted">{money(m.profit)}</div>
                      </>
                    ) : (
                      '–'
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <StockStepper p={p} low={low} onChange={(n) => patch(p, { stock: n })} />
                  </td>
                  <td className="p-3">
                    <Select
                      value={p.status}
                      aria-label={`Status of ${p.sku}`}
                      onChange={(e) => patch(p, { status: e.target.value as Product['status'] })}
                      className="h-8"
                    >
                      <option>Active</option>
                      <option>Out of stock</option>
                      <option>Hidden</option>
                    </Select>
                  </td>
                  <td className="p-3">
                    <input type="checkbox" className="w-4 h-4 accent-maroon" aria-label={`Feature ${p.sku}`} checked={p.featured} onChange={(e) => patch(p, { featured: e.target.checked })} />
                  </td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" onClick={() => setEditing(p.sku)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!snap.products.length && (
        <div className="p-8 text-center text-sm text-muted bg-white border border-line">
          No products yet. Import from the old Sheet in{' '}
          <a className="underline" href="/settings">
            Settings
          </a>
          , or add one.
        </div>
      )}
      {snap.products.length > 0 && !products.length && <p className="text-sm text-muted p-4">No products match “{q}”.</p>}
      <p className="text-xs text-muted mt-3">
        Stock at or below {low} shows amber. Selling the last one sets it Out of stock; restocking sets it Active again.
      </p>
      <ProductEditor sku={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function Thumb({ image }: { image: string }) {
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={productImage(image)} alt="" className="w-12 h-12 md:w-10 md:h-10 object-cover border border-line shrink-0" />
  ) : (
    <div className="w-12 h-12 md:w-10 md:h-10 bg-cream border border-line shrink-0" />
  );
}

function StockStepper({ p, low, onChange }: { p: Product; low: number; onChange: (n: number) => void }) {
  return (
    <div className="inline-flex items-center border border-line bg-white">
      <button
        className="w-11 h-11 md:w-8 md:h-8 text-lg disabled:opacity-30"
        aria-label={`One less ${p.sku}`}
        disabled={p.stock <= 0}
        onClick={() => onChange(p.stock - 1)}
      >
        −
      </button>
      <NumberCell
        label={`Stock of ${p.sku}`}
        value={p.stock}
        className={cn('w-14 md:w-12 border-0 text-center', p.stock === 0 ? 'text-error font-semibold' : p.stock <= low ? 'text-warning font-semibold' : '')}
        onSave={(n) => onChange(n)}
      />
      <button className="w-11 h-11 md:w-8 md:h-8 text-lg" aria-label={`One more ${p.sku}`} onClick={() => onChange(p.stock + 1)}>
        +
      </button>
    </div>
  );
}
