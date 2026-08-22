import React, { useState } from 'react';
import { 
  Clock, 
  MapPin, 
  Phone, 
  MessageSquare, 
  ChevronRight, 
  CheckCircle2, 
  MoreHorizontal,
  ChevronDown
} from 'lucide-react';
import type { Order, OrderStatus } from '@/types';
import Badge from '@/components/ui/Badge';
import { ORDER_STATUSES, CURRENCY } from '@/lib/constants';

interface OrderKanbanProps {
  orders: Order[];
  onOpenOrder: (order: Order) => void;
  onOpenWhatsApp: (order: Order) => void;
  onAdvanceStatus: (orderId: string, nextStatus: OrderStatus) => Promise<void>;
}

function formatOrderTime(raw: string | undefined | null): string {
  if (!raw) return 'Recent';
  const str = String(raw).trim();
  if (str.includes('T')) {
    const timePart = str.split('T')[1]?.substring(0, 5);
    return timePart || str;
  }
  if (str.includes(' ')) {
    return str.split(' ')[1] || str;
  }
  return str;
}

export default function OrderKanban({
  orders,
  onOpenOrder,
  onOpenWhatsApp,
  onAdvanceStatus,
}: OrderKanbanProps) {
  const [activeMenuOrderId, setActiveMenuOrderId] = useState<string | null>(null);

  const getNextStatus = (curr: OrderStatus): OrderStatus | null => {
    switch (curr) {
      case 'Pending': return 'Confirmed';
      case 'Confirmed': return 'Packed';
      case 'Packed': return 'Shipped';
      case 'Shipped': return 'Delivered';
      default: return null;
    }
  };

  const handleAdvanceClick = async (e: React.MouseEvent, orderId: string, nextStatus: OrderStatus) => {
    e.stopPropagation();
    await onAdvanceStatus(orderId, nextStatus);
  };

  const handleSelectStatus = async (e: React.MouseEvent, orderId: string, status: OrderStatus) => {
    e.stopPropagation();
    setActiveMenuOrderId(null);
    await onAdvanceStatus(orderId, status);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
      {ORDER_STATUSES.filter(s => s.key !== 'Cancelled' && s.key !== 'Returned').map((column) => {
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
                  const orderId = String(order['Order ID'] || 'WRQ-1000');
                  const currentStatus = (order.Status || 'Pending') as OrderStatus;
                  const nextSt = getNextStatus(currentStatus);
                  const isMenuOpen = activeMenuOrderId === orderId;
                  const timeFormatted = formatOrderTime(order.Timestamp);

                  return (
                    <div
                      key={orderId}
                      className="bg-white border border-[#E6D9C7] rounded-2xl p-3.5 sm:p-4 shadow-xs hover:shadow-md hover:border-[#C0A286] transition-all space-y-2.5 relative cursor-pointer"
                      onClick={() => onOpenOrder(order)}
                    >
                      {/* Top Header & Order ID */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-xs sm:text-sm text-[#4C2224] hover:underline whitespace-nowrap shrink-0">
                          #{orderId}
                        </span>
                        <span className="text-[10px] text-[#6B5D50] font-mono shrink-0">
                          {timeFormatted}
                        </span>
                      </div>

                      {/* Customer Info */}
                      <div>
                        <div className="font-bold text-xs text-[#241C1B] line-clamp-1">
                          {order['Customer name']}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-[#6B5D50] mt-0.5 truncate">
                          <MapPin size={12} className="text-[#A3492F] shrink-0" />
                          <span className="truncate">{order['Governorate/City']}</span>
                        </div>
                      </div>

                      {/* Items Summary */}
                      <div className="text-[11px] text-[#6B5D50] bg-[#FAF5EE] p-2 rounded-xl line-clamp-2 leading-relaxed">
                        {order['Items summary']}
                      </div>

                      {/* Total and Actions */}
                      <div className="pt-2.5 border-t border-[#E6D9C7] space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-serif font-bold text-sm text-[#4C2224]">
                            {order['Total (EGP)']} <span className="text-[10px] font-sans font-normal text-[#6B5D50]">{CURRENCY}</span>
                          </div>

                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {/* WhatsApp Outreach */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenWhatsApp(order);
                              }}
                              className="p-1.5 rounded-lg bg-[#8A9A7B]/20 text-[#38482D] hover:bg-[#8A9A7B]/35 transition-colors cursor-pointer"
                              title="Open WhatsApp Outreach Modal"
                            >
                              <MessageSquare size={13} />
                            </button>

                            {/* Quick Change Menu Dropdown Toggle */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuOrderId(isMenuOpen ? null : orderId);
                                }}
                                className="p-1.5 rounded-lg bg-[#FAF5EE] text-[#6B5D50] hover:bg-[#E6D9C7]/50 border border-[#E6D9C7] transition-colors cursor-pointer"
                                title="Change stage to any status"
                              >
                                <MoreHorizontal size={13} />
                              </button>

                              {/* Dropdown Menu */}
                              {isMenuOpen && (
                                <div
                                  className="absolute right-0 bottom-full mb-1 z-30 w-44 bg-white border border-[#E6D9C7] rounded-xl shadow-xl py-1 text-xs animate-fadeIn"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="px-2.5 py-1 text-[10px] font-semibold text-[#6B5D50] uppercase tracking-wider border-b border-[#E6D9C7]/60">
                                    Move Status To:
                                  </div>
                                  {ORDER_STATUSES.map((st) => (
                                    <button
                                      key={st.key}
                                      type="button"
                                      onClick={(e) => handleSelectStatus(e, orderId, st.key as OrderStatus)}
                                      className={`w-full text-left px-3 py-1.5 hover:bg-[#FAF5EE] flex items-center justify-between transition-colors ${
                                        currentStatus === st.key ? 'font-bold text-[#4C2224] bg-[#FAF5EE]' : 'text-[#241C1B]'
                                      }`}
                                    >
                                      <span>{st.label}</span>
                                      {currentStatus === st.key && <CheckCircle2 size={12} className="text-[#4C2224]" />}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Advance Status Button full-width below */}
                        {nextSt && (
                          <button
                            type="button"
                            onClick={(e) => handleAdvanceClick(e, orderId, nextSt)}
                            className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] font-bold bg-[#4C2224] text-white hover:bg-[#37181A] px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer shadow-xs"
                            title={`Advance to ${nextSt}`}
                          >
                            <span>Move to {nextSt}</span>
                            <ChevronRight size={12} />
                          </button>
                        )}
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
