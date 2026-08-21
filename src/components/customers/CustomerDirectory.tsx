import React, { useState } from 'react';
import { Users, Phone, Mail, MapPin, MessageSquare, Star, ShoppingBag, Copy, Check } from 'lucide-react';
import type { Customer } from '@/types';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { CURRENCY, formatInternationalPhone } from '@/lib/constants';

interface CustomerDirectoryProps {
  customers: Customer[];
  searchQuery: string;
}

export default function CustomerDirectory({
  customers,
  searchQuery,
}: CustomerDirectoryProps) {
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('All');
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const safeCustomers = Array.isArray(customers) ? customers : [];

  const filtered = safeCustomers.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    const name = String(c['Customer Name'] || '').toLowerCase();
    const phone = String(c['Phone (WhatsApp)'] || '');
    const email = String(c.Email || '').toLowerCase();
    const addr = String(c['Delivery Address'] || '').toLowerCase();

    const matchesSearch = !q ||
      name.includes(q) ||
      phone.includes(q) ||
      email.includes(q) ||
      addr.includes(q);

    const tag = String(c['Customer Tag'] || 'New');
    const matchesTag = selectedTagFilter === 'All' || tag === selectedTagFilter;
    return matchesSearch && matchesTag;
  });

  const tagVariants: Record<string, 'emerald' | 'amber' | 'purple' | 'blue' | 'rose' | 'gray'> = {
    VIP: 'amber',
    Repeat: 'purple',
    Active: 'blue',
    New: 'emerald',
    Risk: 'rose',
  };

  const handleCopyPhone = (phone: string) => {
    try {
      navigator.clipboard.writeText(phone);
      setCopiedPhone(phone);
      setTimeout(() => setCopiedPhone(null), 2000);
    } catch (e) {
      console.warn('Copy phone fallback', e);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tag Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {['All', 'VIP', 'Repeat', 'Active', 'New'].map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => setSelectedTagFilter(tag)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedTagFilter === tag
                ? 'bg-[#4C2224] text-white shadow-xs ring-2 ring-[#4C2224]/20'
                : 'bg-white text-[#6B5D50] border border-[#E6D9C7] hover:border-[#4C2224]'
            }`}
          >
            {tag} ({tag === 'All' ? safeCustomers.length : safeCustomers.filter(c => (c['Customer Tag'] || 'New') === tag).length})
          </button>
        ))}
      </div>

      {/* Customers Table */}
      <div className="bg-white border border-[#E6D9C7] rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm divide-y divide-[#E6D9C7]">
            <thead className="bg-[#FAF5EE]/80 text-[#6B5D50] uppercase tracking-wider text-[11px] font-semibold">
              <tr>
                <th className="px-6 py-4">Customer Name &amp; Contact</th>
                <th className="px-6 py-4">Location / Address</th>
                <th className="px-6 py-4">Orders &amp; Frequency</th>
                <th className="px-6 py-4">Total Lifetime Spend (LTV)</th>
                <th className="px-6 py-4">Segment Tag</th>
                <th className="px-6 py-4 text-right">Outreach</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#E6D9C7] bg-white">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-xs text-[#6B5D50] italic">
                    No customers found matching your criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((c, idx) => {
                  const rawPhone = String(c['Phone (WhatsApp)'] || '');
                  const intlPhone = formatInternationalPhone(rawPhone);
                  const isCopied = copiedPhone === rawPhone;

                  return (
                    <tr key={rawPhone || idx} className="hover:bg-[#FAF5EE]/30 transition-colors">
                      {/* Name & Phone */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-[#241C1B] text-sm">
                          {c['Customer Name'] || 'Customer'}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-[#6B5D50] font-mono mt-0.5">
                          <Phone size={12} className="text-[#8A9A7B]" />
                          <span>{rawPhone}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyPhone(rawPhone)}
                            className="text-[#6B5D50] hover:text-[#4C2224] p-0.5 rounded transition-colors"
                            title="Copy Phone"
                          >
                            {isCopied ? <Check size={11} className="text-[#4A6B3A]" /> : <Copy size={11} />}
                          </button>
                        </div>
                        {c.Email && (
                          <div className="flex items-center gap-1.5 text-xs text-[#6B5D50] mt-0.5">
                            <Mail size={12} className="text-[#C0A286]" />
                            <span>{c.Email}</span>
                          </div>
                        )}
                      </td>

                      {/* Address */}
                      <td className="px-6 py-4 text-xs text-[#241C1B] max-w-xs">
                        <div className="flex items-start gap-1.5">
                          <MapPin size={14} className="text-[#A3492F] mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{c['Delivery Address'] || '—'}</span>
                        </div>
                      </td>

                      {/* Orders count */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-[#241C1B] flex items-center gap-1.5">
                          <ShoppingBag size={14} className="text-[#4C2224]" />
                          <span>{Number(c['Total Orders']) || 1} Order{Number(c['Total Orders']) > 1 ? 's' : ''}</span>
                        </div>
                        <span className="text-[11px] text-[#6B5D50]">
                          Customer since {c['First Order Date'] || 'Recent'}
                        </span>
                      </td>

                      {/* Total Spend */}
                      <td className="px-6 py-4">
                        <div className="font-serif font-bold text-base text-[#4C2224]">
                          {Number(c['Total Spent (EGP)'] || 0).toLocaleString()} <span className="text-xs font-sans font-normal text-[#6B5D50]">{CURRENCY}</span>
                        </div>
                        <div className="text-[10px] text-[#6B5D50]">
                          Avg. {(Number(c['Total Spent (EGP)'] || 0) / Math.max(1, Number(c['Total Orders'] || 1))).toFixed(0)} {CURRENCY} / order
                        </div>
                      </td>

                      {/* Segment Tag */}
                      <td className="px-6 py-4">
                        <Badge variant={tagVariants[c['Customer Tag']] || 'gray'} dot size="sm">
                          {c['Customer Tag'] || 'New'}
                        </Badge>
                      </td>

                      {/* Direct WhatsApp button */}
                      <td className="px-6 py-4 text-right">
                        <a
                          href={`https://wa.me/${intlPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-[#8A9A7B]/20 text-[#38482D] hover:bg-[#8A9A7B]/35 rounded-xl transition-colors"
                        >
                          <MessageSquare size={13} />
                          <span>WhatsApp</span>
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
