'use client';

import { useState } from 'react';
import { money } from '@/lib/format';

/**
 * Daily revenue: one series, one hue, thin bars with a 2px gap, rounded data
 * end, recessive axis, and a hover tooltip per bar (hit target = full column).
 */
export function DailyBars({ data }: { data: { day: string; revenue: number; orders: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.revenue));
  const W = 720;
  const H = 180;
  const pad = { top: 12, bottom: 22, left: 0 };
  const slot = W / data.length;
  const bar = Math.max(2, slot - 2);
  const h = (v: number) => ((H - pad.top - pad.bottom) * v) / max;
  const labelEvery = Math.ceil(data.length / 8);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Revenue per day">
        <line x1={0} x2={W} y1={H - pad.bottom} y2={H - pad.bottom} stroke="var(--color-line)" />
        {data.map((d, i) => {
          const bh = h(d.revenue);
          const x = i * slot + (slot - bar) / 2;
          const y = H - pad.bottom - bh;
          const r = Math.min(4, bar / 2, bh);
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
              {bh > 0 && (
                <path
                  d={`M${x},${H - pad.bottom} V${y + r} Q${x},${y} ${x + r},${y} H${x + bar - r} Q${x + bar},${y} ${x + bar},${y + r} V${H - pad.bottom} Z`}
                  fill="var(--color-maroon)"
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
              {i % labelEvery === 0 && (
                <text x={i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--color-muted)">
                  {d.day.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="absolute top-0 pointer-events-none bg-esp text-cream text-xs px-2 py-1.5 whitespace-nowrap"
          style={{ left: `clamp(0px, calc(${((hover + 0.5) / data.length) * 100}% - 60px), calc(100% - 120px))` }}
        >
          <div className="font-semibold">{data[hover].day}</div>
          <div>{money(data[hover].revenue)} · {data[hover].orders} order{data[hover].orders === 1 ? '' : 's'}</div>
        </div>
      )}
    </div>
  );
}

/** Horizontal bar inside a table row: magnitude only, labelled by the row's own text. */
export function InlineBar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-2 bg-cream w-full" aria-hidden>
      <div className="h-2 bg-maroon" style={{ width: `${max ? Math.max(1, (value / max) * 100) : 0}%`, borderRadius: '0 4px 4px 0' }} />
    </div>
  );
}
