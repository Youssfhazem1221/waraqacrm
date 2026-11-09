const egp = new Intl.NumberFormat('en-EG', { maximumFractionDigits: 2 });

export function money(n: number): string {
  return `${egp.format(Math.round((Number(n) || 0) * 100) / 100)} EGP`;
}

export function pct(n: number): string {
  if (!Number.isFinite(n)) return '–';
  return `${Math.round(n * 1000) / 10}%`;
}

/** "yyyy-MM-dd HH:mm" (Cairo, as stored in the Sheet) -> epoch ms. */
export function parseSheetTime(s: string): number {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/);
  if (!m) return NaN;
  // Cairo is UTC+2 (UTC+3 in summer time). +2 is close enough for "how long ago".
  return Date.UTC(+m[1], +m[2] - 1, +m[3], (m[4] ? +m[4] : 0) - 2, m[5] ? +m[5] : 0);
}

export function ago(s: string | number): string {
  const t = typeof s === 'number' ? s : parseSheetTime(s);
  if (!Number.isFinite(t)) return '';
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function hoursSince(s: string): number {
  const t = parseSheetTime(s);
  return Number.isFinite(t) ? (Date.now() - t) / 3_600_000 : 0;
}

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
