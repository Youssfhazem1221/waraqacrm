import React, { useMemo } from 'react';
import { AlertTriangle, Clock, ArrowRight, MessageSquare } from 'lucide-react';
import type { Order } from '@/types';
import Button from '@/components/ui/Button';
import { SLA_HOURS } from '@/lib/constants';

interface SLAAlertBannerProps {
  pendingOrders: Order[];
  onOpenOrder: (order: Order) => void;
  onOpenWhatsApp: (order: Order) => void;
}

/**
 * Parse the timestamp the Apps Script writes ("yyyy-MM-dd HH:mm", Cairo time).
 * Safari refuses that format with a bare `new Date(string)`, so build it from
 * parts. Returns null when the cell holds something unexpected.
 */
function parseOrderDate(raw: string): Date | null {
  if (!raw) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(raw.trim());
  if (match) {
    const [, y, mo, d, h, mi] = match;
    const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function hoursSince(raw: string): number | null {
  const date = parseOrderDate(raw);
  if (!date) return null;
  return (Date.now() - date.getTime()) / 36e5;
}

export default function SLAAlertBanner({
  pendingOrders,
  onOpenOrder,
  onOpenWhatsApp,
}: SLAAlertBannerProps) {
  // The banner used to shout "awaiting 24h SLA confirmation" at every pending
  // order, including one placed two minutes ago — so the alert was permanently
  // on and told the operator nothing. Split by actual age: only orders past the
  // window are breaches, and the oldest one is what needs calling first.
  const { breaching, dueSoon } = useMemo(() => {
    const withAge = pendingOrders
      .map((order) => ({ order, age: hoursSince(order['Timestamp']) }))
      // An unparseable timestamp is treated as urgent rather than ignored.
      .sort((a, b) => (b.age ?? Infinity) - (a.age ?? Infinity));

    return {
      breaching: withAge.filter((e) => e.age === null || e.age >= SLA_HOURS),
      dueSoon: withAge.filter((e) => e.age !== null && e.age < SLA_HOURS),
    };
  }, [pendingOrders]);

  if (pendingOrders.length === 0) return null;

  const isBreaching = breaching.length > 0;
  const focus = (isBreaching ? breaching[0] : dueSoon[0]).order;
  const count = isBreaching ? breaching.length : dueSoon.length;
  const focusAge = hoursSince(focus['Timestamp']);

  const accent = isBreaching ? '#A3492F' : '#B8862B';

  return (
    <div
      className="bg-white border border-[#E6D9C7] border-l-4 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      style={{ borderLeftColor: accent }}
    >
      {/* Left Content */}
      <div className="flex items-start gap-3.5">
        <div
          className="p-2.5 rounded-xl text-white shrink-0 mt-0.5 shadow-xs"
          style={{ backgroundColor: accent }}
        >
          <AlertTriangle size={18} />
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif font-bold text-[#241C1B] text-sm sm:text-base">
              {isBreaching
                ? `${count} Order${count > 1 ? 's' : ''} Past the ${SLA_HOURS}h Confirmation Window`
                : `${count} Order${count > 1 ? 's' : ''} Awaiting Confirmation`}
            </h3>
            <span
              className="text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ backgroundColor: accent }}
            >
              <Clock size={10} />
              {isBreaching ? 'OVERDUE' : `WITHIN ${SLA_HOURS}H`}
            </span>
          </div>
          <p className="text-xs text-[#6B5D50] leading-relaxed max-w-2xl">
            {isBreaching
              ? `In Egypt's COD market, confirming orders within ${SLA_HOURS}h cuts return-to-origin (RTO) rates by around 40%. These are already past that window — call or WhatsApp them first.`
              : `Still inside the ${SLA_HOURS}h window. Confirming address and total early is what keeps RTO rates down.`}
          </p>
          {focusAge !== null && (
            <p className="text-[11px] text-[#6B5D50]">
              Oldest: #{focus['Order ID']} · placed {Math.floor(focusAge)}h ago
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons (Full-width on mobile for easy thumb reach) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#E6D9C7]/60">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onOpenOrder(focus)}
          icon={<ArrowRight size={14} />}
          className="w-full sm:w-auto"
        >
          <span>View #{focus['Order ID']}</span>
        </Button>

        <Button
          size="sm"
          variant="primary"
          onClick={() => onOpenWhatsApp(focus)}
          icon={<MessageSquare size={14} className="text-[#8A9A7B]" />}
          className="w-full sm:w-auto"
        >
          <span>WhatsApp Customer</span>
        </Button>
      </div>
    </div>
  );
}
