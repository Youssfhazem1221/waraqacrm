// WhatsApp: which client to open, and the message templates.
import type { Order, OrderItem } from '@data/types';

export type WaMode = 'web' | 'app';
export const WA_MODE_KEY = 'waraqa-crm:wa-mode';

/** Egyptian mobile -> 20XXXXXXXXXX (no +). */
export function intlPhone(raw: string): string {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('20')) return d;
  if (d.startsWith('0')) return '2' + d;
  if (/^1[0125]\d{8}$/.test(d)) return '20' + d;
  return d;
}

/**
 * WhatsApp Web opens in a browser tab (desktop, no phone needed nearby once
 * linked). The app link hands off to the installed WhatsApp / WhatsApp
 * Business (phone, or the desktop app).
 */
export function waLink(mode: WaMode, phone: string, text: string): string {
  const p = intlPhone(phone);
  const t = encodeURIComponent(text);
  return mode === 'web'
    ? `https://web.whatsapp.com/send?phone=${p}&text=${t}`
    : `whatsapp://send?phone=${p}&text=${t}`;
}

export function defaultWaMode(): WaMode {
  if (typeof navigator === 'undefined') return 'web';
  return /android|iphone|ipad|mobile/i.test(navigator.userAgent) ? 'app' : 'web';
}

export function readWaMode(): WaMode {
  try {
    const v = localStorage.getItem(WA_MODE_KEY);
    if (v === 'web' || v === 'app') return v;
  } catch {
    // storage blocked
  }
  return defaultWaMode();
}

export function storeWaMode(mode: WaMode) {
  try {
    localStorage.setItem(WA_MODE_KEY, mode);
  } catch {
    // storage blocked
  }
}

export type Template = 'verify' | 'dispatched' | 'delivered' | 'feedback' | 'custom';

export const TEMPLATES: { key: Template; label: string }[] = [
  { key: 'verify', label: 'Confirm order' },
  { key: 'dispatched', label: 'Out for delivery' },
  { key: 'delivered', label: 'Thanks for your order' },
  { key: 'feedback', label: 'Ask for feedback' },
  { key: 'custom', label: 'Blank message' },
];

/** The template a status naturally calls for. */
export function templateForStatus(status: Order['status']): Template {
  switch (status) {
    case 'Pending':
    case 'Confirmed':
      return 'verify';
    case 'Packed':
    case 'Shipped':
      return 'dispatched';
    case 'Delivered':
      return 'feedback';
    default:
      return 'custom';
  }
}

export function waMessage(template: Template, lang: 'ar' | 'en', order: Order, items: OrderItem[]): string {
  const first = (order.customerName || '').trim().split(/\s+/)[0] || (lang === 'ar' ? 'حضرتك' : 'there');
  const lines = items.length
    ? items.map((i) => `• ${i.productName} ×${i.qty}`).join('\n')
    : order.itemsSummary;
  const where = [order.governorate, order.city].filter(Boolean).join(' · ') + (order.address ? ` — ${order.address}` : '');

  if (lang === 'ar') {
    switch (template) {
      case 'verify':
        return `أهلاً يا ${first}! 👋\nمعاك فريق ورقة (Waraqa).\n\nبنأكد طلبك رقم *${order.id}*:\n${lines}\n💵 الإجمالي عند الاستلام: *${order.total} ج.م*\n📍 العنوان: ${where}\n\nممكن تأكد لنا العنوان عشان نجهز الشحنة؟ 🎨`;
      case 'dispatched':
        return `أهلاً يا ${first}! 🚚\nطلبك رقم *${order.id}* خرج مع مندوب الشحن.\n\n💵 من فضلك جهّز *${order.total} ج.م* كاش عند الاستلام.\n\nيومك مليان إبداع! ✨`;
      case 'delivered':
        return `أهلاً يا ${first}! 🌿\nشكراً إنك اخترت ورقة. نتمنى السكتش بوك يعجبك!\nلو احتجت أي حاجة إحنا هنا.`;
      case 'feedback':
        return `أهلاً يا ${first}! 🌿\nنتمنى يكون سكتش بوك *ورقة* عجبك.\n\nيسعدنا تشاركنا أول رسمة وتعملنا Tag على إنستجرام *@waraqa.eg* 🎨❤️`;
      default:
        return `أهلاً يا ${first}! `;
    }
  }
  switch (template) {
    case 'verify':
      return `Hi ${first}! 👋\nThis is Waraqa.\n\nConfirming your order *${order.id}*:\n${lines}\n💵 Total, cash on delivery: *${order.total} EGP*\n📍 Address: ${where}\n\nCould you confirm the address so we can prepare your parcel? 🎨`;
    case 'dispatched':
      return `Hi ${first}! 🚚\nYour order *${order.id}* is out with the courier.\n\n💵 Please have *${order.total} EGP* ready in cash.\n\nHappy sketching! ✨`;
    case 'delivered':
      return `Hi ${first}! 🌿\nThank you for choosing Waraqa. We hope you love your sketchbook!\nWe're here if you need anything.`;
    case 'feedback':
      return `Hi ${first}! 🌿\nHope you're enjoying your *Waraqa* sketchbook.\n\nWe'd love to see your first drawing: tag us on Instagram *@waraqa.eg* 🎨❤️`;
    default:
      return `Hi ${first}! `;
  }
}
