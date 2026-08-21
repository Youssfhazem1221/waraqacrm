import React, { useState, useMemo } from 'react';
import { MessageSquare, Send, Check, Copy, ExternalLink, Phone, Globe } from 'lucide-react';
import type { Order } from '@/types';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { generateWhatsAppMessage, formatInternationalPhone } from '@/lib/constants';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onLogWhatsApp: (orderId: string, sent: boolean) => Promise<void>;
}

export default function WhatsAppModal({
  isOpen,
  onClose,
  order,
  onLogWhatsApp,
}: WhatsAppModalProps) {
  const [templateType, setTemplateType] = useState<'verify' | 'dispatched' | 'feedback'>('verify');
  const [customText, setCustomText] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLogging, setIsLogging] = useState(false);

  if (!order) return null;

  const orderId = String(order['Order ID'] || 'WRQ-1000');
  const customerName = String(order['Customer name'] || 'Customer');
  const rawPhone = String(order['Phone (WhatsApp)'] || '');
  const internationalPhone = formatInternationalPhone(rawPhone);

  const generated = useMemo(() => {
    return generateWhatsAppMessage(templateType, {
      orderId,
      customerName,
      itemsSummary: String(order['Items summary'] || ''),
      total: Number(order['Total (EGP)']) || 0,
      governorate: String(order['Governorate/City'] || 'Cairo'),
      address: String(order.Address || ''),
    });
  }, [templateType, orderId, customerName, order]);

  const activeMessage = customText || generated;

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(activeMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Clipboard copy fallback', e);
    }
  };

  const handleLaunchWhatsApp = async (mode: 'app' | 'web') => {
    const textToSend = activeMessage;
    const targetUrl = mode === 'web'
      ? `https://web.whatsapp.com/send?phone=${internationalPhone}&text=${encodeURIComponent(textToSend)}`
      : `https://wa.me/${internationalPhone}?text=${encodeURIComponent(textToSend)}`;

    try {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.warn('window.open blocked', e);
    }

    setIsLogging(true);
    try {
      await onLogWhatsApp(orderId, true);
    } catch (err) {
      console.warn('Error logging WhatsApp status:', err);
    } finally {
      setIsLogging(false);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`WhatsApp Outreach · #${orderId}`}
      subtitle={`Customer: ${customerName} (${rawPhone})`}
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Template Selector Tabs */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#241C1B] mb-2">
            Select Message Stage Template
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setTemplateType('verify');
                setCustomText('');
              }}
              className={`p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-left ${
                templateType === 'verify'
                  ? 'bg-[#4C2224] text-white border-[#4C2224] shadow-xs ring-2 ring-[#4C2224]/30'
                  : 'bg-white text-[#6B5D50] border-[#E6D9C7] hover:border-[#4C2224]'
              }`}
            >
              <div className="font-bold">1. SLA Verification</div>
              <div className="text-[10px] opacity-80 mt-0.5">Confirm address &amp; items</div>
            </button>

            <button
              type="button"
              onClick={() => {
                setTemplateType('dispatched');
                setCustomText('');
              }}
              className={`p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-left ${
                templateType === 'dispatched'
                  ? 'bg-[#4C2224] text-white border-[#4C2224] shadow-xs ring-2 ring-[#4C2224]/30'
                  : 'bg-white text-[#6B5D50] border-[#E6D9C7] hover:border-[#4C2224]'
              }`}
            >
              <div className="font-bold">2. Courier Dispatched</div>
              <div className="text-[10px] opacity-80 mt-0.5">Out for delivery alert</div>
            </button>

            <button
              type="button"
              onClick={() => {
                setTemplateType('feedback');
                setCustomText('');
              }}
              className={`p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-left ${
                templateType === 'feedback'
                  ? 'bg-[#4C2224] text-white border-[#4C2224] shadow-xs ring-2 ring-[#4C2224]/30'
                  : 'bg-white text-[#6B5D50] border-[#E6D9C7] hover:border-[#4C2224]'
              }`}
            >
              <div className="font-bold">3. Art Review &amp; Tag</div>
              <div className="text-[10px] opacity-80 mt-0.5">Community engagement</div>
            </button>
          </div>
        </div>

        {/* Message Editor Area */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#241C1B]">
              Message Preview &amp; Editor
            </label>
            <button
              type="button"
              onClick={handleCopy}
              className="text-xs text-[#4C2224] hover:underline flex items-center gap-1 font-medium cursor-pointer"
            >
              {copied ? <Check size={12} className="text-[#4A6B3A]" /> : <Copy size={12} />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Text'}</span>
            </button>
          </div>
          <textarea
            dir="rtl"
            rows={8}
            value={activeMessage}
            onChange={(e) => setCustomText(e.target.value)}
            className="w-full bg-white border border-[#E6D9C7] rounded-2xl p-4 text-xs font-arabic leading-relaxed text-[#241C1B] focus:outline-none focus:border-[#4C2224] focus:ring-2 focus:ring-[#4C2224]/10"
          />
        </div>

        {/* Recipient Details snapshot */}
        <div className="bg-[#FAF5EE] border border-[#E6D9C7] rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-2">
            <Phone size={14} className="text-[#8A9A7B]" />
            <span className="font-semibold text-[#241C1B] font-mono">+{internationalPhone}</span>
            <span className="text-[10px] text-[#6B5D50]">({customerName})</span>
          </div>
          <div className="text-[#6B5D50]">
            WhatsApp logged in Sheet: <strong className={order['WhatsApp sent?'] === 'Yes' ? 'text-[#4A6B3A]' : 'text-[#B8862B]'}>{order['WhatsApp sent?'] || 'No'}</strong>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <Button variant="outline" size="md" onClick={onClose} type="button">
            <span>Cancel</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              type="button"
              onClick={() => handleLaunchWhatsApp('web')}
              isLoading={isLogging}
              icon={<Globe size={15} />}
              title="Open WhatsApp Web in Browser"
            >
              <span>WhatsApp Web</span>
            </Button>

            <Button
              variant="success"
              size="md"
              type="button"
              onClick={() => handleLaunchWhatsApp('app')}
              isLoading={isLogging}
              icon={<ExternalLink size={16} />}
            >
              <span>Launch App &amp; Mark Sent</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
