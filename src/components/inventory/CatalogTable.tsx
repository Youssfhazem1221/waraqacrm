import React from 'react';
import { Edit2, Sparkles, AlertCircle, Plus, Minus, Trash2 } from 'lucide-react';
import type { Product } from '@/types';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { CURRENCY } from '@/lib/constants';

interface CatalogTableProps {
  products: Product[];
  onEditProduct: (p: Product) => void;
  onQuickStockChange: (sku: string, newStock: number, status: string) => Promise<void>;
  onDeleteProduct: (sku: string) => Promise<void>;
}

export default function CatalogTable({
  products,
  onEditProduct,
  onQuickStockChange,
  onDeleteProduct,
}: CatalogTableProps) {
  const statusBadgeVariants: Record<string, 'emerald' | 'rose' | 'gray'> = {
    Active: 'emerald',
    'Out of stock': 'rose',
    Hidden: 'gray',
  };

  return (
    <div className="bg-white border border-[#E6D9C7] rounded-3xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm divide-y divide-[#E6D9C7]">
          <thead className="bg-[#FAF5EE]/80 text-[#6B5D50] uppercase tracking-wider text-[11px] font-semibold">
            <tr>
              <th className="px-6 py-4">Format / SKU</th>
              <th className="px-6 py-4">Specs &amp; Feel</th>
              <th className="px-6 py-4">Price</th>
              <th className="px-6 py-4">Workshop Stock</th>
              <th className="px-6 py-4">Storefront Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#E6D9C7] bg-white">
            {products.map((p) => {
              const isLowStock = p.stock > 0 && p.stock <= 5;
              const isOut = p.stock === 0 || p.status === 'Out of stock';

              return (
                <tr key={p.sku} className="hover:bg-[#FAF5EE]/30 transition-colors">
                  {/* SKU & Title */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-[#241C1B] text-sm">
                        {p.name}
                      </div>
                      {p.featured && (
                        <span className="p-1 rounded-full bg-[#B8862B]/15 text-[#B8862B]" title="Featured on Storefront">
                          <Sparkles size={13} />
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#6B5D50] font-mono mt-0.5">
                      {p.sku} · {p.size}
                    </div>
                    {p.nameAr && (
                      <div className="text-xs text-[#6B5D50] font-arabic mt-0.5">
                        {p.nameAr}
                      </div>
                    )}
                  </td>

                  {/* Specs & Paper */}
                  <td className="px-6 py-4">
                    <div className="text-xs font-semibold text-[#241C1B]">
                      {p.gsm} GSM · {p.sheets} Sheets
                    </div>
                    <div className="text-[11px] text-[#6B5D50] truncate max-w-xs mt-0.5">
                      {p.paperType || 'Standard Paper'}
                    </div>
                  </td>

                  {/* Price */}
                  <td className="px-6 py-4">
                    <div className="font-serif font-bold text-base text-[#4C2224]">
                      {p.price} <span className="text-xs font-sans font-normal text-[#6B5D50]">{CURRENCY}</span>
                    </div>
                    {p.compareAt > p.price && (
                      <div className="text-[11px] text-[#6B5D50] line-through">
                        {p.compareAt} {CURRENCY}
                      </div>
                    )}
                  </td>

                  {/* Stock Quick Stepper */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center border border-[#E6D9C7] rounded-xl bg-[#FAF5EE] overflow-hidden">
                        <button
                          type="button"
                          onClick={() => {
                            const newStock = Math.max(0, p.stock - 1);
                            const newStatus = newStock === 0 ? 'Out of stock' : p.status;
                            onQuickStockChange(p.sku, newStock, newStatus);
                          }}
                          className="px-2.5 py-1.5 hover:bg-[#E6D9C7]/50 text-[#6B5D50] transition-colors cursor-pointer"
                          title="Decrease Stock"
                        >
                          <Minus size={12} />
                        </button>

                        <span className="px-3 py-1 font-mono font-bold text-xs text-[#241C1B] min-w-8 text-center">
                          {p.stock}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            const newStock = p.stock + 1;
                            const newStatus = p.status === 'Out of stock' ? 'Active' : p.status;
                            onQuickStockChange(p.sku, newStock, newStatus);
                          }}
                          className="px-2.5 py-1.5 hover:bg-[#E6D9C7]/50 text-[#6B5D50] transition-colors cursor-pointer"
                          title="Increase Stock"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      {isLowStock && (
                        <span className="text-[10px] bg-[#B8862B]/15 text-[#734E09] border border-[#B8862B]/30 font-bold px-1.5 py-0.5 rounded-md">
                          Low
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Storefront Status */}
                  <td className="px-6 py-4">
                    <Badge variant={statusBadgeVariants[p.status] || 'gray'} dot size="sm">
                      {p.status}
                    </Badge>
                  </td>

                  {/* Action */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditProduct(p)}
                        icon={<Edit2 size={13} />}
                      >
                        <span>Edit SKU</span>
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(`Delete ${p.name} (${p.sku})? This removes it from Google Sheets and the storefront immediately.`)) {
                            onDeleteProduct(p.sku);
                          }
                        }}
                        icon={<Trash2 size={13} />}
                      >
                        <span>Delete</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
