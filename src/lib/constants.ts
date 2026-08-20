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
 * WhatsApp Message Templates (Bilingual & Personalized)
 */
export function generateWhatsAppMessage(
  type: 'verify' | 'dispatched' | 'feedback',
  order: {
    orderId: string;
    customerName: string;
    itemsSummary: string;
    total: number;
    governorate: string;
    address: string;
  }
): string {
  const firstName = order.customerName.split(' ')[0] || order.customerName;

  switch (type) {
    case 'verify':
      return `أهلاً بك يا ${firstName}! 👋\nمعاك فريق ورشة ورقة (Waraqa) لدفاتر الرسم.\n\nبنأكد استلام طلبك رقم *${order.orderId}*:\n📦 ${order.itemsSummary}\n💵 إجمالي المبلغ عند الاستلام: *${order.total} ج.م*\n📍 العنوان: ${order.governorate} — ${order.address}\n\nهل تفاصيل العنوان وميعاد التسليم مناسبين لحضرتك؟ نرجو الرد لتجهيز شحنتك فوراً! 🎨`;

    case 'dispatched':
      return `أهلاً يا ${firstName}! 🚚\nطلبك رقم *${order.orderId}* من *ورقة (Waraqa)* خرج مع مندوب الشحن ومتوقع يوصلك خلال ساعات.\n\n💵 نرجو تجهيز مبلغ *${order.total} ج.م* كاش عند المعاينة والاستلام.\n\nيومك مليان إبداع! ✨`;

    case 'feedback':
      return `أهلاً يا ${firstName}! 🌿\nأتمنى يكون سكتش بوك *ورقة* عجبك وورقه مريح في الرسم والتجربة.\n\nيسعدنا جداً تشاركنا أول رسمة وتعملنا Tag على إنستجرام *@waraqa.eg* لننشر شغلك في مجتمع الفنانين! 🎨❤️`;
  }
}
