import React from 'react';
import { 
  ShoppingBag, 
  MapPin, 
  Phone, 
  Mail, 
  Calendar, 
  CheckCircle2, 
  MessageSquare, 
  Truck
} from 'lucide-react';
import type { Order, OrderStatus } from '@/types';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { ORDER_STATUSES, CURRENCY, formatInternationalPhone } from '@/lib/constants';

interface OrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onStatusChange: (orderId: string, status: OrderStatus) => Promise<void>;
  onOpenWhatsApp: (order: Order) => void;
}

export default function OrderDetailModal({
  isOpen,
  onClose,
  order,
  onStatusChange,
  onOpenWhatsApp,
}: OrderDetailModalProps) {
  if (!order) return null;

  const currentStatus = (order.Status || 'Pending') as OrderStatus;
  const orderId = String(order['Order ID'] || 'WRQ-1000');
  const customerName = String(order['Customer name'] || 'Customer');
  const phone = String(order['Phone (WhatsApp)'] || '');
  const formattedPhone = formatInternationalPhone(phone);

  const badgeVariants: Record<string, 'amber' | 'blue' | 'purple' | 'emerald' | 'rose' | 'gray'> = {
    Pending: 'amber',
    Confirmed: 'blue',
    Packed: 'purple',
    Shipped: 'purple',
    Delivered: 'emerald',
    Cancelled: 'rose',
    Returned: 'rose',
  };

  const handleStatusClick = async (status: OrderStatus) => {
    await onStatusChange(orderId, status);
  };

  const handleLaunchWhatsApp = () => {
    onClose();
    setTimeout(() => {
      onOpenWhatsApp(order);
    }, 50);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Order #${orderId}`}
      subtitle={`Placed on ${order.Timestamp || 'Recent'}`}
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* Status Action Stepper Bar */}
        <div className="bg-white border border-[#E6D9C7] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B5D50]">
              Fulfillment Pipeline Status
            </span>
            <Badge variant={badgeVariants[currentStatus] || 'gray'} dot size="md">
              {currentStatus}
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5 pt-1">
            {ORDER_STATUSES.map((st) => {
              const isSelected = currentStatus === st.key;
              return (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => handleStatusClick(st.key as OrderStatus)}
                  className={`px-2 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center ${
                    isSelected
                      ? 'bg-[#4C2224] text-white shadow-xs font-bold ring-2 ring-[#4C2224]/30'
                      : 'bg-[#FAF5EE] text-[#6B5D50] hover:bg-[#E6D9C7]/50 hover:text-[#241C1B]'
                  }`}
                >
                  <div>{st.label.split(' ')[0]}</div>
                  <div className="text-[9px] opacity-75 font-normal truncate mt-0.5">{st.key}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Customer & Address Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-[#E6D9C7] rounded-2xl p-4 space-y-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B5D50] block">
              Customer Info
            </span>
            <div className="font-bold text-[#241C1B] text-base font-serif">
              {customerName}
            </div>
            <div className="flex items-center gap-2 text-xs text-[#6B5D50]">
              <Phone size={14} className="text-[#8A9A7B]" />
              <span className="font-mono">{phone}</span>
            </div>
            {order.Email && (
              <div className="flex items-center gap-2 text-xs text-[#6B5D50] truncate">
                <Mail size={14} className="text-[#C0A286]" />
                <span>{order.Email}</span>
              </div>
            )}
          </div>

          <div className="bg-white border border-[#E6D9C7] rounded-2xl p-4 space-y-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B5D50] block">
              Delivery Destination
            </span>
            <div className="flex items-start gap-2 text-xs text-[#241C1B]">
              <MapPin size={16} className="text-[#A3492F] mt-0.5 shrink-0" />
              <div>
                <strong className="block text-[#4C2224]">{order['Governorate/City'] || 'Cairo'}</strong>
                <span className="text-[#6B5D50] mt-0.5 block leading-relaxed">{order.Address || 'No address provided'}</span>
              </div>
            </div>
            {order.Notes && (
              <div className="mt-2 text-[11px] bg-[#FAF5EE] p-2 rounded-lg text-[#6B5D50] border border-[#E6D9C7]/80">
                <strong>Delivery Note:</strong> {order.Notes}
              </div>
            )}
          </div>
        </div>

        {/* Items Summary Breakdown */}
        <div className="bg-white border border-[#E6D9C7] rounded-2xl p-4 space-y-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B5D50] block">
            Items Ordered
          </span>
          <div className="p-3 bg-[#FAF5EE] rounded-xl text-xs sm:text-sm text-[#241C1B] leading-relaxed">
            {order['Items summary'] || 'Sketchbook item'}
          </div>

          <div className="border-t border-[#E6D9C7] pt-3 space-y-1.5 text-xs text-[#6B5D50]">
            <div className="flex justify-between">
              <span>Items Total Qty:</span>
              <span className="font-bold text-[#241C1B]">{order['Total qty'] || 1} units</span>
            </div>
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{order['Subtotal (EGP)'] || 0} {CURRENCY}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping Fee:</span>
              <span>{Number(order['Shipping (EGP)']) === 0 ? 'FREE' : `${order['Shipping (EGP)']} ${CURRENCY}`}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[#E6D9C7] font-serif text-base font-bold text-[#4C2224]">
              <span>Total Cash on Delivery:</span>
              <span>{order['Total (EGP)'] || 0} {CURRENCY}</span>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="primary"
            size="md"
            onClick={handleLaunchWhatsApp}
            icon={<MessageSquare size={16} className="text-[#8A9A7B]" />}
          >
            <span>Open WhatsApp Outreach</span>
          </Button>

          <Button variant="outline" size="md" onClick={onClose}>
            <span>Done</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
