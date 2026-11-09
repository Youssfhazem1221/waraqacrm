'use client';

import { useEffect, useState } from 'react';
import type { Order, OrderItem } from '@data/types';
import { TEMPLATES, readWaMode, storeWaMode, templateForStatus, waLink, waMessage, type Template, type WaMode } from '@/lib/whatsapp';
import { cn } from '@/lib/format';
import { Select } from './ui';

/** Segmented control: open chats in WhatsApp Web or the WhatsApp app. Remembered per device. */
export function WaModeToggle({ mode, onChange }: { mode: WaMode; onChange: (m: WaMode) => void }) {
  return (
    <div className="inline-flex border border-line bg-white text-xs" role="radiogroup" aria-label="Open WhatsApp in">
      {(['web', 'app'] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          onClick={() => {
            onChange(m);
            storeWaMode(m);
          }}
          className={cn('px-3 h-8', mode === m ? 'bg-maroon text-cream' : 'text-char hover:bg-cream')}
        >
          {m === 'web' ? 'WhatsApp Web' : 'WhatsApp app'}
        </button>
      ))}
    </div>
  );
}

export function useWaMode() {
  const [mode, setMode] = useState<WaMode>('web');
  useEffect(() => setMode(readWaMode()), []);
  return [mode, setMode] as const;
}

export function WhatsAppPanel({ order, items, onSent }: { order: Order; items: OrderItem[]; onSent: () => void }) {
  const [mode, setMode] = useWaMode();
  const [template, setTemplate] = useState<Template>(templateForStatus(order.status));
  const [lang, setLang] = useState<'ar' | 'en'>(order.lang === 'en' ? 'en' : 'ar');
  const [text, setText] = useState('');

  useEffect(() => {
    setText(waMessage(template, lang, order, items));
  }, [template, lang, order, items]);

  const href = waLink(mode, order.phone, text);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={template} onChange={(e) => setTemplate(e.target.value as Template)} aria-label="Message">
          {TEMPLATES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </Select>
        <Select value={lang} onChange={(e) => setLang(e.target.value as 'ar' | 'en')} aria-label="Language">
          <option value="ar">العربية</option>
          <option value="en">English</option>
        </Select>
        <WaModeToggle mode={mode} onChange={setMode} />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        rows={8}
        className="w-full border border-line bg-white p-3 text-sm focus:outline-none focus:border-maroon"
      />
      <a
        href={href}
        target={mode === 'web' ? 'whatsapp-web' : undefined}
        rel="noreferrer"
        onClick={onSent}
        className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-success text-white text-sm font-medium hover:opacity-90"
      >
        Open chat in {mode === 'web' ? 'WhatsApp Web' : 'the WhatsApp app'} ↗
      </a>
      <p className="text-xs text-muted">
        Opening the chat marks the order as messaged. The message isn’t sent until you press send in WhatsApp.
      </p>
    </div>
  );
}
