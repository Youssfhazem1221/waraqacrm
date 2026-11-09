'use client';

import { useState } from 'react';
import type { Product } from '@data/types';
import { useData } from '@/components/DataProvider';
import { PageHeader } from '@/components/Shell';
import { NumberCell } from '@/components/NumberCell';
import { ProductEditor, productImage } from '@/components/ProductEditor';
import { Badge, Button, Select } from '@/components/ui';
import { patchProduct } from '@/app/actions';
import { ago, cn, money, pct } from '@/lib/format';
import { unitMargin } from '@/lib/metrics';

export default function ProductsPage() {
  const { snap, run } = useData();
  const [editing, setEditing] = useState<string | null>(null);
  const low = snap.settings.lowStockThreshold;

  const patch = (p: Product, fields: Partial<Product>, okText: string) =>
    run(patchProduct(p.sku, fields, fields.stock !== undefined ? { stock: p.stock } : undefined), okText);

  const units = snap.products.reduce((s, p) => s + p.stock, 0);
  const stockValue = snap.products.reduce((s, p) => s + p.stock * p.cost, 0);
  const noCost = snap.products.filter((p) => !p.cost).length;

  return (
    <>
      <PageHeader
        title="Products"
        sub={
          <>
            Click a number to edit it; it saves when you press Enter or click away, and the store shows it within seconds.{' '}
            {units} units in stock ({money(stockValue)} at cost).
            {noCost > 0 && <span className="text-warning"> {noCost} product(s) have no cost yet, so margins are overstated.</span>}
          </>
        }
        actions={
          <Button variant="primary" onClick={() => setEditing('')}>
            + New product
          </Button>
        }
      />
      <div className="bg-white border border-line overflow-x-auto">
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
            {snap.products.map((p) => {
              const m = unitMargin(p);
              return (
                <tr key={p.sku} className="border-b border-line/60 hover:bg-cream/40">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={productImage(p.image)} alt="" className="w-10 h-10 object-cover border border-line" />
                      ) : (
                        <div className="w-10 h-10 bg-cream border border-line" />
                      )}
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
                    <NumberCell label={`Price of ${p.sku}`} value={p.price} onSave={(n) => patch(p, { price: n }, `${p.sku} price → ${n} EGP`)} />
                  </td>
                  <td className="p-3 text-right">
                    <NumberCell label={`Compare-at of ${p.sku}`} value={p.compareAt} onSave={(n) => patch(p, { compareAt: n }, `${p.sku} compare-at → ${n}`)} />
                  </td>
                  <td className="p-3 text-right">
                    <NumberCell label={`Cost of ${p.sku}`} value={p.cost} onSave={(n) => patch(p, { cost: n }, `${p.sku} cost → ${n}`)} className={!p.cost ? 'bg-warning/10' : ''} />
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
                    <div className="inline-flex items-center gap-1">
                      <Button className="h-8 w-8 px-0" aria-label={`One less ${p.sku}`} disabled={p.stock <= 0} onClick={() => patch(p, { stock: p.stock - 1 }, `${p.sku} stock → ${p.stock - 1}`)}>
                        −
                      </Button>
                      <NumberCell
                        label={`Stock of ${p.sku}`}
                        value={p.stock}
                        className={cn('w-14', p.stock === 0 ? 'text-error' : p.stock <= low ? 'text-warning' : '')}
                        onSave={(n) => patch(p, { stock: n }, `${p.sku} stock → ${n}`)}
                      />
                      <Button className="h-8 w-8 px-0" aria-label={`One more ${p.sku}`} onClick={() => patch(p, { stock: p.stock + 1 }, `${p.sku} stock → ${p.stock + 1}`)}>
                        +
                      </Button>
                    </div>
                  </td>
                  <td className="p-3">
                    <Select
                      value={p.status}
                      aria-label={`Status of ${p.sku}`}
                      onChange={(e) => patch(p, { status: e.target.value as Product['status'] }, `${p.sku} → ${e.target.value}`)}
                      className="h-8"
                    >
                      <option>Active</option>
                      <option>Out of stock</option>
                      <option>Hidden</option>
                    </Select>
                  </td>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      aria-label={`Feature ${p.sku}`}
                      checked={p.featured}
                      onChange={(e) => patch(p, { featured: e.target.checked }, `${p.sku} ${e.target.checked ? 'featured' : 'unfeatured'}`)}
                    />
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
        {!snap.products.length && (
          <div className="p-8 text-center text-sm text-muted">
            No products yet. Import from the old Sheet in <a className="underline" href="/settings">Settings</a>, or add one.
          </div>
        )}
      </div>
      <p className="text-xs text-muted mt-3 flex gap-3">
        <Badge tone="Out of stock">0 = out of stock</Badge>
        <span>Stock at or below {low} shows amber. Selling the last unit sets Out of stock automatically; restocking sets it Active.</span>
      </p>
      <ProductEditor sku={editing} onClose={() => setEditing(null)} />
    </>
  );
}
