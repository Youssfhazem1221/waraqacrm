'use client';

import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({ variant = 'secondary', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-2 px-3 h-9 text-sm font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
        variant === 'primary' && 'bg-maroon text-cream border-maroon hover:bg-esp',
        variant === 'secondary' && 'bg-white text-char border-line hover:border-kraft',
        variant === 'ghost' && 'bg-transparent border-transparent text-char hover:bg-cream',
        variant === 'danger' && 'bg-white text-error border-error/40 hover:bg-error hover:text-white',
        className,
      )}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn('h-9 px-2.5 border border-line bg-white text-sm text-char focus:outline-none focus:border-maroon w-full', className)}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn('h-9 px-2 border border-line bg-white text-sm text-char focus:outline-none focus:border-maroon', className)}>
      {children}
    </select>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted text-xs uppercase tracking-wide">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('bg-white border border-line', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line">
          <h2 className="font-semibold text-char">{title}</h2>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'warn' | 'bad' | 'good' }) {
  return (
    <div className="bg-white border border-line p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums',
          tone === 'warn' && 'text-warning',
          tone === 'bad' && 'text-error',
          tone === 'good' && 'text-success',
          !tone && 'text-char',
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

const BADGE: Record<string, string> = {
  Pending: 'bg-warning/15 text-warning border-warning/30',
  Confirmed: 'bg-sage/20 text-success border-sage/40',
  Packed: 'bg-kraft/25 text-esp border-kraft/50',
  Shipped: 'bg-maroon/10 text-maroon border-maroon/30',
  Delivered: 'bg-success/15 text-success border-success/30',
  Cancelled: 'bg-error/10 text-error border-error/30',
  Returned: 'bg-error/10 text-error border-error/30',
  Active: 'bg-success/15 text-success border-success/30',
  'Out of stock': 'bg-error/10 text-error border-error/30',
  Hidden: 'bg-line text-muted border-line',
  VIP: 'bg-maroon text-cream border-maroon',
  Repeat: 'bg-kraft/25 text-esp border-kraft/50',
  New: 'bg-cream text-char border-line',
  Risk: 'bg-warning/15 text-warning border-warning/30',
  Blocked: 'bg-error/10 text-error border-error/30',
};

export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const key = tone ?? (typeof children === 'string' ? children : '');
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 text-xs border whitespace-nowrap', BADGE[key] ?? 'bg-cream text-char border-line')}>
      {children}
    </span>
  );
}

export function Drawer({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-esp/40" aria-label="Close" onClick={onClose} />
      <div className={cn('relative h-full w-full bg-cream border-l border-line overflow-y-auto', wide ? 'max-w-3xl' : 'max-w-xl')}>
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 bg-cream border-b border-line">
          <div className="font-semibold text-lg text-char min-w-0">{title}</div>
          <Button variant="ghost" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </header>
        <div className="p-5 space-y-5">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="text-sm text-muted py-8 text-center">{children}</div>;
}
