'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/format';

/**
 * A number you edit in place. Saves on Enter or when focus leaves; Escape
 * reverts.
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
  onSave: (n: number) => unknown;
  min?: number;
  step?: number;
  className?: string;
  label: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  // The screen updates at once (optimistic save) and the field stays usable;
  // the header shows Saving… / Saved, and a failed save puts the old value back.
  const commit = () => {
    const n = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(n) || n < min) {
      setDraft(String(value));
      return;
    }
    if (n === value) return;
    void onSave(n);
  };

  return (
    <span className="relative inline-flex items-center">
      <input
        type="number"
        inputMode="decimal"
        enterKeyHint="done"
        aria-label={label}
        min={min}
        step={step}
        value={draft}
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
          'cell-input h-11 md:h-8 w-24 md:w-20 px-2 border bg-white text-base md:text-sm tabular-nums focus:outline-none focus:border-maroon',
          Number(draft) !== value ? 'border-warning' : 'border-line md:border-transparent md:hover:border-line',
          className,
        )}
      />
    </span>
  );
}
