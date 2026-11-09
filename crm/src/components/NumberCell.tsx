'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/format';

/**
 * A number you edit in place. Saves on Enter or when focus leaves; Escape
 * reverts. While saving it shows a dot; the value then comes back from the
 * Sheet, so what you see is what was stored.
 */
export function NumberCell({
  value,
  onSave,
  min = 0,
  step = 1,
  className,
  label,
}: {
  value: number;
  onSave: (n: number) => Promise<unknown>;
  min?: number;
  step?: number;
  className?: string;
  label: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(String(value)), [value]);

  const commit = async () => {
    const n = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(n) || n < min) {
      setDraft(String(value));
      return;
    }
    if (n === value) return;
    setSaving(true);
    try {
      await onSave(n);
    } finally {
      setSaving(false);
    }
  };

  return (
    <span className="relative inline-flex items-center">
      <input
        type="number"
        inputMode="decimal"
        aria-label={label}
        min={min}
        step={step}
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setDraft(String(value));
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={cn(
          'cell-input h-8 w-20 px-2 border bg-white text-sm tabular-nums focus:outline-none focus:border-maroon',
          Number(draft) !== value ? 'border-warning' : 'border-transparent hover:border-line',
          className,
        )}
      />
      {saving && <span className="absolute -right-2 w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />}
    </span>
  );
}
