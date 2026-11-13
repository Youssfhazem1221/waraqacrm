// Egypt's 27 governorates, English as the store's checkout sends them and
// Arabic as customers read them. Shipping zones match on the lower-case
// English name; the Arabic name is stored too so a hand-typed Arabic
// governorate on an order still finds its zone.

export interface Governorate {
  en: string;
  ar: string;
}

export const GOVERNORATES: Governorate[] = [
  { en: 'Cairo', ar: 'القاهرة' },
  { en: 'Giza', ar: 'الجيزة' },
  { en: 'Alexandria', ar: 'الإسكندرية' },
  { en: 'Qalyubia', ar: 'القليوبية' },
  { en: 'Dakahlia', ar: 'الدقهلية' },
  { en: 'Sharqia', ar: 'الشرقية' },
  { en: 'Gharbia', ar: 'الغربية' },
  { en: 'Monufia', ar: 'المنوفية' },
  { en: 'Beheira', ar: 'البحيرة' },
  { en: 'Kafr El Sheikh', ar: 'كفر الشيخ' },
  { en: 'Damietta', ar: 'دمياط' },
  { en: 'Port Said', ar: 'بورسعيد' },
  { en: 'Ismailia', ar: 'الإسماعيلية' },
  { en: 'Suez', ar: 'السويس' },
  { en: 'North Sinai', ar: 'شمال سيناء' },
  { en: 'South Sinai', ar: 'جنوب سيناء' },
  { en: 'Beni Suef', ar: 'بني سويف' },
  { en: 'Fayoum', ar: 'الفيوم' },
  { en: 'Minya', ar: 'المنيا' },
  { en: 'Asyut', ar: 'أسيوط' },
  { en: 'Sohag', ar: 'سوهاج' },
  { en: 'Qena', ar: 'قنا' },
  { en: 'Luxor', ar: 'الأقصر' },
  { en: 'Aswan', ar: 'أسوان' },
  { en: 'Red Sea', ar: 'البحر الأحمر' },
  { en: 'New Valley', ar: 'الوادي الجديد' },
  { en: 'Matrouh', ar: 'مطروح' },
];

const byToken = new Map<string, Governorate>();
for (const g of GOVERNORATES) {
  byToken.set(g.en.toLowerCase(), g);
  byToken.set(g.ar, g);
}

/** The governorate a zone token ("cairo", "القاهرة") stands for, if any. */
export function governorateFor(token: string): Governorate | undefined {
  return byToken.get(String(token).trim().toLowerCase()) ?? byToken.get(String(token).trim());
}

/** Fold Arabic letter variants and case so "اسكندرية" finds "الإسكندرية". */
export function fold(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/^ال/, '')
    .replace(/\s+ال/g, ' ')
    .replace(/[\s-]+/g, ' ')
    .trim();
}

/** Does this governorate match what was typed (English or Arabic, any part of the name)? */
export function matches(g: Governorate, query: string): boolean {
  const q = fold(query);
  if (!q) return true;
  return fold(g.en).includes(q) || fold(g.ar).includes(q);
}
