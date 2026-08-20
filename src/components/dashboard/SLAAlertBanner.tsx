import React from 'react';
import { AlertTriangle, Clock, ArrowRight, MessageSquare } from 'lucide-react';
import type { Order } from '@/types';
import Button from '@/components/ui/Button';

interface SLAAlertBannerProps {
  pendingOrders: Order[];
  onOpenOrder: (order: Order) => void;
  onOpenWhatsApp: (order: Order) => void;
}

export default function SLAAlertBanner({
  pendingOrders,
  onOpenOrder,
  onOpenWhatsApp,
}: SLAAlertBannerProps) {
  if (pendingOrders.length === 0) return null;

  return (
    <div className="bg-white border border-[#E6D9C7] border-l-4 border-l-[#B8862B] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      {/* Left Content */}
      <div className="flex items-start gap-3.5">
        <div className="p-2.5 rounded-xl bg-[#B8862B] text-white shrink-0 mt-0.5 shadow-xs">
          <AlertTriangle size={18} />
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif font-bold text-[#241C1B] text-sm sm:text-base">
              {pendingOrders.length} Order{pendingOrders.length > 1 ? 's' : ''} Awaiting 24h SLA Confirmation
            </h3>
            <span className="bg-[#B8862B] text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Clock size={10} />
              URGENT
            </span>
          </div>
          <p className="text-xs text-[#6B5D50] leading-relaxed max-w-2xl">
            In Egypt's COD market, confirming orders within 24h cuts return-to-origin (RTO) rates by 40%. Confirm customer address and dispatch immediately.
          </p>
        </div>
      </div>

      {/* Action Buttons (Full-width on mobile for easy thumb reach) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#E6D9C7]/60">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onOpenOrder(pendingOrders[0])}
          icon={<ArrowRight size={14} />}
          className="w-full sm:w-auto"
        >
          <span>View #{pendingOrders[0]['Order ID']}</span>
        </Button>

        <Button
          size="sm"
          variant="primary"
          onClick={() => onOpenWhatsApp(pendingOrders[0])}
          icon={<MessageSquare size={14} className="text-[#8A9A7B]" />}
          className="w-full sm:w-auto"
        >
          <span>WhatsApp Customer</span>
        </Button>
      </div>
    </div>
  );
}
