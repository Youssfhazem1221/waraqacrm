import React from 'react';
import { 
  Clock, 
  MapPin, 
  Phone, 
  MessageSquare, 
  ChevronRight, 
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import type { Order, OrderStatus } from '@/types';
import Badge from '@/components/ui/Badge';
import { ORDER_STATUSES, CURRENCY } from '@/lib/constants';

interface OrderKanbanProps {
  orders: Order[];
  onOpenOrder: (order: Order) => void;
  onOpenWhatsApp: (order: Order) => void;
  onAdvanceStatus: (orderId: string, currentStatus: OrderStatus) => Promise<void>;
}

export default function OrderKanban({
  orders,
  onOpenOrder,
  onOpenWhatsApp,
  onAdvanceStatus,
}: OrderKanbanProps) {
  const getNextStatus = (curr: OrderStatus): OrderStatus | null => {
    switch (curr) {
      case 'Pending': return 'Confirmed';
      case 'Confirmed': return 'Packed';
      case 'Packed': return 'Shipped';
      case 'Shipped': return 'Delivered';
      default: return null;
    }
  };

  const badgeVariants: Record<string, 'amber' | 'blue' | 'purple' | 'emerald' | 'rose' | 'gray'> = {
    Pending: 'amber',
    Confirmed: 'blue',
    Packed: 'purple',
    Shipped: 'purple',
    Delivered: 'emerald',
    Cancelled: 'rose',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
      {ORDER_STATUSES.filter(s => s.key !== 'Cancelled').map((column) => {
        const colOrders = orders.filter((o) => (o.Status || 'Pending') === column.key);
        const colTotal = colOrders.reduce((sum, o) => sum + (Number(o['Total (EGP)']) || 0), 0);

        return (
          <div
            key={column.key}
            className="bg-[#FAF5EE] border border-[#E6D9C7] rounded-3xl p-3.5 flex flex-col gap-3 min-h-[500px]"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[#E6D9C7] px-1">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-serif font-bold text-sm text-[#241C1B]">
                    {column.label}
                  </span>
                  <span className="text-xs bg-white text-[#4C2224] border border-[#E6D9C7] font-mono font-bold px-2 py-0.5 rounded-full">
                    {colOrders.length}
                  </span>
                </div>
                <span className="text-[10px] text-[#6B5D50] font-mono">
                  {colTotal.toLocaleString()} {CURRENCY}
                </span>
              </div>
            </div>

            {/* Column Cards */}
            <div className="space-y-3 overflow-y-auto max-h-[70vh] pr-0.5">
              {colOrders.length === 0 ? (
                <div className="p-6 text-center text-[#6B5D50]/60 text-xs italic">
                  No orders in this stage
                </div>
              ) : (
                colOrders.map((order) => {
                  const orderId = order['Order ID'];
                  const nextSt = getNextStatus(order.Status || 'Pending');

                  return (
                    <div
                      key={orderId}
                      className="bg-white border border-[#E6D9C7] rounded-2xl p-4 shadow-xs hover:shadow-md hover:border-[#C0A286] transition-all space-y-3"
                    >
                      {/* Top Header & Order ID */}
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => onOpenOrder(order)}
                          className="font-mono font-bold text-sm text-[#4C2224] hover:underline cursor-pointer"
                        >
                          #{orderId}
                        </button>
                        <span className="text-[10px] text-[#6B5D50] font-mono">
                          {order.Timestamp?.split(' ')[1] || order.Timestamp}
                        </span>
                      </div>

                      {/* Customer Info */}
                      <div>
                        <div className="font-bold text-xs text-[#241C1B] line-clamp-1">
                          {order['Customer name']}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#6B5D50] mt-0.5 truncate">
                          <MapPin size={12} className="text-[#A3492F] shrink-0" />
                          <span>{order['Governorate/City']}</span>
                        </div>
                      </div>

                      {/* Items Summary */}
                      <div className="text-[11px] text-[#6B5D50] bg-[#FAF5EE] p-2 rounded-xl line-clamp-2 leading-relaxed">
                        {order['Items summary']}
                      </div>

                      {/* Total and Actions */}
                      <div className="pt-2 border-t border-[#E6D9C7] flex items-center justify-between">
                        <div className="font-serif font-bold text-sm text-[#4C2224]">
                          {order['Total (EGP)']} <span className="text-[10px] font-sans font-normal text-[#6B5D50]">{CURRENCY}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* WhatsApp Outreach */}
                          <button
                            onClick={() => onOpenWhatsApp(order)}
                            className="p-1.5 rounded-lg bg-[#8A9A7B]/20 text-[#38482D] hover:bg-[#8A9A7B]/35 transition-colors cursor-pointer"
                            title="Open WhatsApp Message"
                          >
                            <MessageSquare size={13} />
                          </button>

                          {/* Advance Status Button */}
                          {nextSt && (
                            <button
                              onClick={() => onAdvanceStatus(orderId, order.Status || 'Pending')}
                              className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#4C2224] text-white hover:bg-[#37181A] px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
                              title={`Advance to ${nextSt}`}
                            >
                              <span>{nextSt}</span>
                              <ChevronRight size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
