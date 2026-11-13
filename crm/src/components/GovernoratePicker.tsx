'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { GOVERNORATES, matches, type Governorate } from '@/lib/governorates';
import { cn } from '@/lib/format';

/**
 * Pick governorates as chips, with suggestions as you type (English or
 * Arabic). `owner` names the zone a governorate currently belongs to, so the
 * list can say "in Rest of Egypt" and picking it moves it here.
 */
export function GovernoratePicker({
  value,
  onChange,
  owner,
  placeholder = 'Add a governorate…',
}: {
  value: Governorate[];
  onChange: (next: Governorate[]) => void;
  owner?: (g: Governorate) => string | null;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const chosen = new Set(value.map((g) => g.en));
  const suggestions = useMemo(
    () => GOVERNORATES.filter((g) => !chosen.has(g.en) && matches(g, q)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, value],
  );

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const add = (g: Governorate) => {
    onChange([...value, g]);
    setQ('');
    setActive(0);
    input.current?.focus();
  };
  const remove = (g: Governorate) => onChange(value.filter((x) => x.en !== g.en));

  return (
    <div ref={box} className="relative">
      <div
        className="min-h-11 flex flex-wrap items-center gap-1.5 border border-line bg-white px-2 py-1.5 focus-within:border-maroon"
        onClick={() => {
          input.current?.focus();
          setOpen(true);
        }}
      >
        {value.map((g) => (
          <span key={g.en} className="inline-flex items-center gap-1 bg-cream border border-line pl-2 pr-1 py-1 text-sm">
            {g.en} <span className="text-muted">· {g.ar}</span>
            <button
              type="button"
              aria-label={`Remove ${g.en}`}
              onClick={(e) => {
                e.stopPropagation();
                remove(g);
              }}
              className="w-6 h-6 inline-flex items-center justify-center text-muted hover:text-error"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, suggestions.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (suggestions[active]) add(suggestions[active]);
            } else if (e.key === 'Backspace' && !q && value.length) {
              remove(value[value.length - 1]);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder={value.length ? '' : placeholder}
          className="flex-1 min-w-[8rem] h-8 bg-transparent text-base md:text-sm focus:outline-none"
        />
      </div>
      {open && (
        <ul id={listId} role="listbox" className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-line shadow-lg">
          {suggestions.length === 0 && <li className="px-3 py-2 text-sm text-muted">{q ? `No governorate matches “${q}”` : 'All governorates are in this zone'}</li>}
          {suggestions.map((g, i) => {
            const where = owner?.(g);
            return (
              <li key={g.en} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => add(g)}
                  onMouseEnter={() => setActive(i)}
                  className={cn('w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm', i === active ? 'bg-cream' : 'bg-white')}
                >
                  <span>
                    {g.en} <span className="text-muted">· {g.ar}</span>
                  </span>
                  {where && <span className="text-xs text-muted whitespace-nowrap">now in {where}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Single governorate, same suggestions: for the quote tester and filters. */
export function GovernorateSelect({ value, onChange }: { value: Governorate | null; onChange: (g: Governorate | null) => void }) {
  return (
    <GovernoratePicker
      value={value ? [value] : []}
      onChange={(next) => onChange(next[next.length - 1] ?? null)}
      placeholder="Type a governorate…"
    />
  );
}
