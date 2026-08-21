// ============================================================
// Waraqa CRM — Operational Constants & Configurations
// ============================================================

export const DEFAULT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbynYVPM62OXO7dkeh5on3uSRgbZOAJOqJtWac0EXt9tbCK-rpfLOw1F8zmsY0rZeogE/exec';
export const CURRENCY = 'EGP';
export const SUPPORT_WA = '201069237525';
export const SLA_HOURS = 24;

export const ORDER_STATUSES: { key: string; label: string; color: string; desc: string }[] = [
  { key: 'Pending', label: 'Pending SLA', color: 'amber', desc: 'Needs WhatsApp/Phone verification within 24h' },
  { key: 'Confirmed', label: 'Confirmed', color: 'blue', desc: 'Customer verified address & total due' },
  { key: 'Packed', label: 'Packed & Ready', color: 'purple', desc: 'Packaged in workshop with shipping label' },
  { key: 'Shipped', label: 'Out with Courier', color: 'indigo', desc: 'Dispatched with local delivery partner' },
  { key: 'Delivered', label: 'Delivered & Paid', color: 'emerald', desc: 'Cash collected successfully' },
  { key: 'Cancelled', label: 'Cancelled / RTO', color: 'rose', desc: 'Customer cancelled or unreachable' },
];

export const GOVERNORATES = [
  'Cairo', 'Giza', 'Alexandria', 'Qalyubia', 'Dakahlia', 'Sharqia',
  'Gharbia', 'Monufia', 'Beheira', 'Kafr El Sheikh', 'Damietta',
  'Port Said', 'Ismailia', 'Suez', 'North Sinai', 'South Sinai',
  'Beni Suef', 'Fayoum', 'Minya', 'Asyut', 'Sohag', 'Qena',
  'Luxor', 'Aswan', 'Red Sea', 'New Valley', 'Matrouh'
];

export const FORMAT_OPTIONS = [
  'A5',
  'Mini (10.5×15)',
  '25×35cm',
  '25×25cm',
  'A4'
];

export const PAPER_TYPES = [
  'Mixed Media Textured Paper',
  'Heavyweight Kraft Paper',
  'Drawing & Sketching Smooth Paper',
  'Heavy Artist Mixed Media Paper',
  'Square Mixed Media Paper'
];

/**
 * Safely format phone number to international WhatsApp format (Egypt +20)
 */
export function formatInternationalPhone(rawPhone: string | number | undefined | null): string {
  const str = String(rawPhone || '').trim();
  const digits = str.replace(/\D/g, '');
  if (!digits) return SUPPORT_WA;

  if (digits.startsWith('20')) {
    return digits;
  }
  if (digits.startsWith('0')) {
    return '2' + digits;
  }
  if (digits.length === 10 && (digits.startsWith('10') || digits.startsWith('11') || digits.startsWith('12') || digits.startsWith('15'))) {
    return '20' + digits;
  }
  return digits;
}

/**
 * WhatsApp Message Templates (Bilingual & Personalized) with full null-safety
 */
export function generateWhatsAppMessage(
  type: 'verify' | 'dispatched' | 'feedback',
  order?: {
    orderId?: string | number | null;
    customerName?: string | null;
    itemsSummary?: string | null;
    total?: number | string | null;
    governorate?: string | null;
    address?: string | null;
  } | null
): string {
  const safeOrder = order || {};
  const orderId = String(safeOrder.orderId || 'WRQ-1000');
  const rawName = String(safeOrder.customerName || 'Customer').trim();
  const firstName = rawName.split(/\s+/)[0] || 'Customer';
  const items = String(safeOrder.itemsSummary || 'دفتر سكتش بوك ورقة');
  const total = Number(safeOrder.total) || 0;
  const gov = String(safeOrder.governorate || 'القاهرة');
  const addr = String(safeOrder.address || '');

  switch (type) {
    case 'verify':
      return `أهلاً بك يا ${firstName}! 👋\nمعاك فريق ورشة ورقة (Waraqa) لدفاتر الرسم.\n\nبنأكد استلام طلبك رقم *${orderId}*:\n📦 ${items}\n💵 إجمالي المبلغ عند الاستلام: *${total} ج.م*\n📍 العنوان: ${gov}${addr ? ' — ' + addr : ''}\n\nهل تفاصيل العنوان وميعاد التسليم مناسبين لحضرتك؟ نرجو الرد لتجهيز شحنتك فوراً! 🎨`;

    case 'dispatched':
      return `أهلاً يا ${firstName}! 🚚\nطلبك رقم *${orderId}* من *ورقة (Waraqa)* خرج مع مندوب الشحن ومتوقع يوصلك خلال ساعات.\n\n💵 نرجو تجهيز مبلغ *${total} ج.م* كاش عند المعاينة والاستلام.\n\nيومك مليان إبداع! ✨`;

    case 'feedback':
      return `أهلاً يا ${firstName}! 🌿\nأتمنى يكون سكتش بوك *ورقة* عجبك وورقه مريح في الرسم والتجربة.\n\nيسعدنا جداً تشاركنا أول رسمة وتعملنا Tag على إنستجرام *@waraqa.eg* لننشر شغلك في مجتمع الفنانين! 🎨❤️`;
  }
}

