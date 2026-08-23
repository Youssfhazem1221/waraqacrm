import React, { useState, useEffect } from 'react';
import type { Product } from '@/types';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { FORMAT_OPTIONS, PAPER_TYPES, CURRENCY } from '@/lib/constants';

interface ProductEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSave: (product: Product) => Promise<void>;
  /** SKUs already in the catalog, so a new one cannot collide with them. */
  existingSkus?: string[];
}

/**
 * Read a number field without turning an empty box into 0.
 *
 * `Number(e.target.value)` maps '' to 0, so clearing the price to retype it set
 * the price to zero — and submitting at that moment published a free product.
 * Empty now means "unchanged/absent" and is held as an empty string until the
 * operator types a value.
 */
function numberFieldValue(raw: string, fallback: number): number {
  if (raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export default function ProductEditorModal({
  isOpen,
  onClose,
  product,
  onSave,
  existingSkus = [],
}: ProductEditorModalProps) {
  const [formData, setFormData] = useState<Product>({
    sku: '',
    name: '',
    nameAr: '',
    category: 'Sketchbooks',
    size: 'A5',
    sheets: 25,
    gsm: 320,
    paperType: 'Mixed Media Textured Paper',
    price: 195,
    compareAt: 0,
    stock: 20,
    status: 'Active',
    image: '/products/a5-mixed-media-320gsm.jpeg',
    description: '',
    featured: false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [skuError, setSkuError] = useState('');
  const [priceError, setPriceError] = useState('');

  useEffect(() => {
    if (product) {
      setFormData(product);
    } else {
      setFormData({
        sku: `WRQ-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        name: '',
        nameAr: '',
        category: 'Sketchbooks',
        size: 'A5',
        sheets: 25,
        gsm: 320,
        paperType: 'Mixed Media Textured Paper',
        price: 195,
        compareAt: 0,
        stock: 20,
        status: 'Active',
        image: '/products/a5-mixed-media-320gsm.jpeg',
        description: '',
        featured: false,
      });
    }
  }, [product, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const sku = formData.sku.trim();
    setSkuError('');
    setPriceError('');

    if (!sku) {
      setSkuError('A SKU is required.');
      return;
    }

    // Creating a SKU that already exists routes through the same save path as
    // an edit, so it would quietly overwrite the existing product.
    if (!product && existingSkus.some((s) => s.trim().toLowerCase() === sku.toLowerCase())) {
      setSkuError(`${sku} already exists. Edit that product instead, or pick another SKU.`);
      return;
    }

    if (!Number.isFinite(formData.price) || formData.price <= 0) {
      setPriceError('Set a price above 0 before publishing.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({ ...formData, sku });
      onClose();
    } finally {
      // Leaves the form usable if the save threw, instead of a stuck spinner.
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? `Edit SKU: ${product.sku}` : 'Create New SKU Format'}
      subtitle="Changes directly update your Google Sheet and live website catalog instantly"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: SKU & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="SKU Identifier"
            value={formData.sku}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
            placeholder="e.g. WRQ-A5-MM-25"
            required
            disabled={Boolean(product)}
            error={skuError}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#241C1B]">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full bg-white border border-[#E6D9C7] rounded-xl px-3.5 py-2 text-sm text-[#241C1B] focus:outline-none focus:border-[#4C2224]"
            >
              <option value="Sketchbooks">Sketchbooks</option>
              <option value="Paper Goods">Paper Goods</option>
              <option value="Studio Packs">Studio Packs</option>
            </select>
          </div>
        </div>

        {/* Row 2: English Name */}
        <Input
          label="Product Name (English)"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g. A5 Mixed Media Sketchbook — 25 Sheets (320 GSM)"
          required
        />

        {/* Row 3: Arabic Name */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#241C1B]">
            Product Name (Arabic - للاستور بالعربي)
          </label>
          <input
            dir="rtl"
            value={formData.nameAr}
            onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
            placeholder="مثال: سكتش بوك ميكسد ميديا A5 — ٢٥ ورقة"
            className="w-full bg-white border border-[#E6D9C7] rounded-xl px-3.5 py-2 text-sm font-arabic text-[#241C1B] focus:outline-none focus:border-[#4C2224]"
          />
        </div>

        {/* Row 4: Pricing & Stock */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-4 rounded-2xl border border-[#E6D9C7]">
          <Input
            label={`Store Price (${CURRENCY})`}
            type="number"
            min="0"
            value={formData.price}
            onChange={(e) =>
              setFormData({ ...formData, price: numberFieldValue(e.target.value, 0) })
            }
            required
            error={priceError}
          />

          <Input
            label={`Compare-at Price (${CURRENCY})`}
            type="number"
            min="0"
            value={formData.compareAt}
            onChange={(e) =>
              setFormData({ ...formData, compareAt: numberFieldValue(e.target.value, 0) })
            }
            hint="Original price if on discount"
          />

          <Input
            label="Workshop Stock"
            type="number"
            min="0"
            value={formData.stock}
            onChange={(e) =>
              setFormData({ ...formData, stock: numberFieldValue(e.target.value, 0) })
            }
            required
          />
        </div>

        {/* Row 5: Format Dimensions & GSM */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#241C1B]">
              Size Format
            </label>
            <select
              value={formData.size}
              onChange={(e) => setFormData({ ...formData, size: e.target.value })}
              className="w-full bg-white border border-[#E6D9C7] rounded-xl px-3.5 py-2 text-sm text-[#241C1B] focus:outline-none focus:border-[#4C2224]"
            >
              {FORMAT_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="GSM Weight"
            type="number"
            min="50"
            max="600"
            value={formData.gsm}
            onChange={(e) =>
              setFormData({ ...formData, gsm: numberFieldValue(e.target.value, formData.gsm) })
            }
            placeholder="320"
          />

          <Input
            label="Sheet Count"
            type="number"
            min="1"
            max="200"
            value={formData.sheets}
            onChange={(e) =>
              setFormData({ ...formData, sheets: numberFieldValue(e.target.value, formData.sheets) })
            }
            placeholder="25"
          />
        </div>

        {/* Row 6: Paper Type */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#241C1B]">
            Paper Feel / Texture
          </label>
          <input
            value={formData.paperType}
            onChange={(e) => setFormData({ ...formData, paperType: e.target.value })}
            placeholder="e.g. Mixed Media Textured Paper"
            className="w-full bg-white border border-[#E6D9C7] rounded-xl px-3.5 py-2 text-sm text-[#241C1B] focus:outline-none focus:border-[#4C2224]"
          />
        </div>

        {/* Row 7: Visibility & Featured */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#241C1B]">
              Storefront Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as Product['status'] })}
              className="w-full bg-white border border-[#E6D9C7] rounded-xl px-3.5 py-2 text-sm text-[#241C1B] focus:outline-none focus:border-[#4C2224]"
            >
              <option value="Active">Active (Visible &amp; Purchasable)</option>
              <option value="Out of stock">Out of Stock (Shows Sold-out Badge)</option>
              <option value="Hidden">Hidden (Draft / Unpublished)</option>
            </select>
          </div>

          <div className="flex items-center gap-3 pt-6">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#241C1B]">
              <input
                type="checkbox"
                checked={formData.featured}
                onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                className="w-4 h-4 rounded text-[#4C2224] focus:ring-[#4C2224]"
              />
              <span>Feature on Homepage Best-sellers</span>
            </label>
          </div>
        </div>

        {/* Row 8: Description */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#241C1B]">
            Product Description
          </label>
          <textarea
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Detailed sketchbook properties, tooth texture, bindings..."
            className="w-full bg-white border border-[#E6D9C7] rounded-xl p-3 text-xs text-[#241C1B] leading-relaxed focus:outline-none focus:border-[#4C2224]"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E6D9C7]">
          <Button variant="outline" size="md" onClick={onClose} type="button">
            <span>Cancel</span>
          </Button>
          <Button variant="primary" size="md" type="submit" isLoading={isSaving}>
            <span>{product ? 'Save & Sync to Store' : 'Create SKU & Sync'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
