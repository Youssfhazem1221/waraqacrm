'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ShippingZone } from '@data/types';
import { shippingFee, zoneFor } from '@data/rules';
import { useData } from '@/components/DataProvider';
import { PageHeader } from '@/components/Shell';
import { GovernoratePicker, GovernorateSelect } from '@/components/GovernoratePicker';
import { Button, Card, Field, Input, Select, Stat } from '@/components/ui';
import { saveZones } from '@/app/actions';
import { cn, money } from '@/lib/format';
import { GOVERNORATES, governorateFor, type Governorate } from '@/lib/governorates';
import { inPeriod, isRevenue, type Period } from '@/lib/metrics';

// ---- Zone drafts: what the form edits, in words rather than the Sheet's tokens ----

interface ZoneDraft {
  key: string;
  zone: string;
  /** The zone for every governorate not listed in another zone (Sheet: "*"). */
  everywhereElse: boolean;
  govs: Governorate[];
  /** Tokens in the Sheet that aren't a known governorate; kept as they are. */
  extra: string[];
  fee: string;
  freeOn: boolean;
  freeOver: string;
  courierCost: string;
}

let seq = 0;
const key = () => `z${++seq}`;

function toDraft(z: ShippingZone): ZoneDraft {
  const govs: Governorate[] = [];
  const extra: string[] = [];
  for (const t of z.governorates) {
    if (t === '*') continue;
    const g = governorateFor(t);
    if (g) {
      if (!govs.some((x) => x.en === g.en)) govs.push(g);
    } else extra.push(t);
  }
  return {
    key: key(),
    zone: z.zone,
    everywhereElse: z.governorates.includes('*'),
    govs,
    extra,
    fee: String(z.fee),
    freeOn: z.freeOver > 0,
    freeOver: z.freeOver > 0 ? String(z.freeOver) : '800',
    courierCost: String(z.courierCost),
  };
}

function fromDraft(d: ZoneDraft): ShippingZone {
  return {
    zone: d.zone.trim(),
    governorates: d.everywhereElse ? ['*'] : [...d.govs.flatMap((g) => [g.en.toLowerCase(), g.ar]), ...d.extra],
    fee: Number(d.fee) || 0,
    freeOver: d.freeOn ? Number(d.freeOver) || 0 : 0,
    courierCost: Number(d.courierCost) || 0,
  };
}

const num = (s: string) => Number(s);
const badNum = (s: string) => s.trim() === '' || !Number.isFinite(num(s)) || num(s) < 0;

function problems(drafts: ZoneDraft[]): string[] {
  const out: string[] = [];
  const catchAll = drafts.filter((d) => d.everywhereElse);
  if (catchAll.length === 0) out.push('One zone has to cover “everywhere else”, or customers outside your zones can’t check out.');
  if (catchAll.length > 1) out.push('Only one zone can be “everywhere else”.');
  for (const d of drafts) {
    const name = d.zone.trim() || 'A zone';
    if (!d.zone.trim()) out.push('Every zone needs a name.');
    if (!d.everywhereElse && d.govs.length === 0 && d.extra.length === 0) out.push(`${name}: add at least one governorate.`);
    if (badNum(d.fee)) out.push(`${name}: the delivery fee must be a number, 0 or more.`);
    if (badNum(d.courierCost)) out.push(`${name}: the courier cost must be a number, 0 or more.`);
    if (d.freeOn && (badNum(d.freeOver) || num(d.freeOver) <= 0)) out.push(`${name}: set the order total for free delivery, or turn it off.`);
  }
  return [...new Set(out)];
}

function list(names: string[]) {
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** "Customers in Cairo and Giza pay 60 EGP…", so nobody has to decode the numbers. */
function summary(d: ZoneDraft, coveredByElse: number): string {
  const where = d.everywhereElse
    ? `Customers in the other ${coveredByElse} governorate${coveredByElse === 1 ? '' : 's'}`
    : `Customers in ${list(d.govs.map((g) => g.en)) || 'this zone'}`;
  const fee = num(d.fee) || 0;
  const courier = num(d.courierCost) || 0;
  const freeFrom = d.freeOn ? num(d.freeOver) || 0 : 0;
  let s = fee === 0 ? `${where} get free delivery.` : `${where} pay ${money(fee)} for delivery`;
  if (fee > 0) s += freeFrom > 0 ? `, or nothing on orders of ${money(freeFrom)} or more.` : '.';
  const gap = courier - fee;
  if (courier > 0) {
    s += ` The courier charges you ${money(courier)}, so `;
    s += gap > 0 ? `you cover ${money(gap)} per order` : gap < 0 ? `you keep ${money(-gap)} per order` : 'it evens out';
    s += freeFrom > 0 && fee > 0 ? ` (${money(courier)} on free-delivery orders).` : '.';
  }
  return s;
}

export default function ShippingPage() {
  const { snap, run } = useData();
  const saved = useMemo(() => snap.zones.map(toDraft), [snap.zones]);
  const [drafts, setDrafts] = useState<ZoneDraft[]>(saved);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [period, setPeriod] = useState<Period>('30d');
  const [quoteGov, setQuoteGov] = useState<Governorate | null>(GOVERNORATES[0]);
  const [subtotal, setSubtotal] = useState('500');
  const [coverQ, setCoverQ] = useState('');

  // Take the Sheet's version unless you're in the middle of editing.
  useEffect(() => {
    if (!dirty) setDrafts(saved);
  }, [saved, dirty]);

  const edit = (k: string, patch: Partial<ZoneDraft>) => {
    setDirty(true);
    setDrafts((ds) => ds.map((d) => (d.key === k ? { ...d, ...patch } : d)));
  };

  /** Picking a governorate in one zone takes it out of any other. */
  const setGovs = (k: string, govs: Governorate[]) => {
    setDirty(true);
    const picked = new Set(govs.map((g) => g.en));
    setDrafts((ds) => ds.map((d) => (d.key === k ? { ...d, govs } : { ...d, govs: d.govs.filter((g) => !picked.has(g.en)) })));
  };

  const makeEverywhereElse = (k: string) => {
    setDirty(true);
    setDrafts((ds) => ds.map((d) => ({ ...d, everywhereElse: d.key === k })));
  };

  const owner = (k: string) => (g: Governorate) => {
    const other = drafts.find((d) => d.key !== k && d.govs.some((x) => x.en === g.en));
    if (other) return other.zone || 'another zone';
    const fallback = drafts.find((d) => d.everywhereElse && d.key !== k);
    return fallback ? `${fallback.zone || 'everywhere else'}` : null;
  };

  const zones = drafts.map(fromDraft);
  const issues = problems(drafts);
  const listed = new Set(drafts.filter((d) => !d.everywhereElse).flatMap((d) => d.govs.map((g) => g.en)));
  const coveredByElse = GOVERNORATES.filter((g) => !listed.has(g.en)).length;

  // Who pays what, for every governorate.
  const coverage = GOVERNORATES.map((g) => {
    const z = zoneFor(zones, g.en.toLowerCase());
    return { g, zone: z };
  }).filter(({ g }) => !coverQ.trim() || g.en.toLowerCase().includes(coverQ.toLowerCase()) || g.ar.includes(coverQ.trim()));

  const quoteZone = quoteGov ? zoneFor(zones, quoteGov.en.toLowerCase()) : null;
  const quote = quoteGov ? shippingFee(zones, Number(subtotal) || 0, quoteGov.en) : 0;

  const save = async () => {
    if (issues.length) return;
    setSaving(true);
    const res = await run(saveZones(zones), 'Shipping saved: checkout uses the new rates now');
    setSaving(false);
    if (res) setDirty(false);
  };

  const perZone = useMemo(() => {
    const rows = new Map<string, { zone: string; orders: number; charged: number; courier: number; free: number }>();
    for (const o of snap.orders) {
      if (!inPeriod(o, period) || !(isRevenue(o) || o.status === 'Returned')) continue;
      const z = zoneFor(snap.zones, o.governorate)?.zone ?? 'Unknown';
      const r = rows.get(z) ?? { zone: z, orders: 0, charged: 0, courier: 0, free: 0 };
      r.orders++;
      if (o.status !== 'Returned') r.charged += o.shippingCharged;
      r.courier += o.courierCost;
      if (!o.shippingCharged) r.free++;
      rows.set(z, r);
    }
    return [...rows.values()];
  }, [snap.orders, snap.zones, period]);
  const totals = perZone.reduce((a, r) => ({ charged: a.charged + r.charged, courier: a.courier + r.courier }), { charged: 0, courier: 0 });

  return (
    <div className={dirty ? 'pb-24' : ''}>
      <PageHeader
        title="Shipping"
        sub="Group governorates into zones. Each zone has the fee customers pay, an optional free-delivery threshold, and what the courier charges you."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {drafts.map((d) => (
          <section key={d.key} className={cn('bg-white border p-4 space-y-4 min-w-0', d.everywhereElse ? 'border-kraft' : 'border-line')}>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <Field label="Zone name">
                  <Input value={d.zone} onChange={(e) => edit(d.key, { zone: e.target.value })} placeholder="e.g. Delta" />
                </Field>
              </div>
              {!d.everywhereElse && (
                <Button
                  variant="ghost"
                  className="mt-5 text-error"
                  aria-label={`Delete ${d.zone || 'zone'}`}
                  onClick={() => {
                    setDirty(true);
                    setDrafts((ds) => ds.filter((x) => x.key !== d.key));
                  }}
                >
                  Delete
                </Button>
              )}
            </div>

            {d.everywhereElse ? (
              <div className="bg-cream/60 border border-line p-3 text-sm">
                <div className="font-medium">Everywhere else</div>
                <p className="text-muted mt-0.5">
                  Covers the {coveredByElse} governorate{coveredByElse === 1 ? '' : 's'} not in another zone. Add a governorate to another zone to take it out of here.
                </p>
              </div>
            ) : (
              <Field label="Governorates in this zone" hint="Type in English or Arabic and pick from the list.">
                <GovernoratePicker value={d.govs} onChange={(g) => setGovs(d.key, g)} owner={owner(d.key)} />
              </Field>
            )}
            {d.extra.length > 0 && (
              <p className="text-xs text-warning">
                Also matches: {d.extra.join(', ')} (typed in the Sheet, not a governorate name).
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Customer pays">
                <MoneyInput value={d.fee} onChange={(v) => edit(d.key, { fee: v })} />
              </Field>
              <Field label="Courier cost">
                <MoneyInput value={d.courierCost} onChange={(v) => edit(d.key, { courierCost: v })} />
              </Field>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-3 text-sm min-h-11">
                <input type="checkbox" className="w-5 h-5 accent-maroon" checked={d.freeOn} onChange={(e) => edit(d.key, { freeOn: e.target.checked })} />
                Free delivery on bigger orders
              </label>
              {d.freeOn && (
                <Field label="Free when the order total is at least">
                  <MoneyInput value={d.freeOver} onChange={(v) => edit(d.key, { freeOver: v })} />
                </Field>
              )}
            </div>

            <p className="text-sm text-char/85 bg-cream/50 border-l-2 border-kraft px-3 py-2 leading-relaxed">{summary(d, coveredByElse)}</p>

            {!d.everywhereElse && (
              <button type="button" className="text-xs text-muted underline" onClick={() => makeEverywhereElse(d.key)}>
                Make this the “everywhere else” zone instead
              </button>
            )}
          </section>
        ))}

        <button
          type="button"
          onClick={() => {
            setDirty(true);
            setDrafts((ds) => [
              ...ds,
              { key: key(), zone: '', everywhereElse: false, govs: [], extra: [], fee: '75', freeOn: false, freeOver: '800', courierCost: '80' },
            ]);
          }}
          className="min-h-[8rem] border-2 border-dashed border-line text-muted hover:border-maroon hover:text-maroon flex flex-col items-center justify-center gap-1 p-6"
        >
          <span className="text-2xl leading-none">+</span>
          <span className="font-medium">Add a zone</span>
          <span className="text-xs">e.g. Delta, Upper Egypt, Canal cities</span>
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mt-6">
        <Card title="Who pays what">
          <Input placeholder="Find a governorate…" value={coverQ} onChange={(e) => setCoverQ(e.target.value)} className="mb-3" />
          <ul className="divide-y divide-line max-h-80 overflow-y-auto -mx-4">
            {coverage.map(({ g, zone }) => (
              <li key={g.en} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="min-w-0">
                  {g.en} <span className="text-muted">· {g.ar}</span>
                  <div className="text-xs text-muted truncate">{zone?.zone ?? 'No zone'}</div>
                </span>
                <span className="text-right shrink-0 tabular-nums">
                  {zone ? money(zone.fee) : '–'}
                  {zone && zone.freeOver > 0 && <div className="text-xs text-muted">free from {money(zone.freeOver)}</div>}
                </span>
              </li>
            ))}
          </ul>
          {dirty && <p className="text-xs text-warning mt-2">Showing your unsaved changes.</p>}
        </Card>

        <Card title="Try a quote">
          <div className="space-y-3">
            <Field label="Governorate">
              <GovernorateSelect value={quoteGov} onChange={setQuoteGov} />
            </Field>
            <Field label="Order total before delivery">
              <MoneyInput value={subtotal} onChange={setSubtotal} />
            </Field>
            {quoteGov && quoteZone && (
              <div className="bg-cream/60 border border-line p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted">Zone</span>
                  <span>{quoteZone.zone}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Customer pays</span>
                  <span>{quote ? money(quote) : 'Free'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Courier charges you</span>
                  <span>{money(quoteZone.courierCost)}</span>
                </div>
                <div className={cn('flex justify-between', quoteZone.courierCost - quote > 0 ? 'text-error' : 'text-success')}>
                  <span>{quoteZone.courierCost - quote > 0 ? 'You cover' : 'You keep'}</span>
                  <span>{money(Math.abs(quoteZone.courierCost - quote))}</span>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <h2 className="font-semibold">Shipping so far</h2>
        <Select value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="Period">
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </Select>
      </div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 mt-3">
        <Stat label="Customers paid" value={money(totals.charged)} />
        <Stat label="Courier charged you" value={money(totals.courier)} />
        <Stat
          label={totals.courier > totals.charged ? 'You covered' : 'You kept'}
          value={money(Math.abs(totals.courier - totals.charged))}
          tone={totals.courier > totals.charged ? 'bad' : 'good'}
          sub="Courier cost includes returned orders"
        />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {perZone.map((r) => (
          <div key={r.zone} className="bg-white border border-line p-3 text-sm">
            <div className="flex justify-between font-medium">
              <span>{r.zone}</span>
              <span className="text-muted font-normal">
                {r.orders} order{r.orders === 1 ? '' : 's'} · {r.free} free
              </span>
            </div>
            <div className="mt-1 flex justify-between text-muted">
              <span>Paid {money(r.charged)} · courier {money(r.courier)}</span>
              <span className={r.charged - r.courier < 0 ? 'text-error' : 'text-success'}>{money(r.charged - r.courier)}</span>
            </div>
          </div>
        ))}
        {!perZone.length && <p className="text-sm text-muted">No orders in this period.</p>}
      </div>

      {dirty && (
        <div className="fixed inset-x-0 bottom-14 md:bottom-0 md:left-56 z-30 bg-white border-t border-line px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <div className="max-w-[1400px] mx-auto flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[12rem] text-sm">
              {issues.length ? <span className="text-error">{issues[0]}</span> : <span>Unsaved changes. The store keeps the old rates until you save.</span>}
            </div>
            <Button
              onClick={() => {
                setDrafts(saved);
                setDirty(false);
              }}
            >
              Discard
            </Button>
            <Button variant="primary" disabled={saving || issues.length > 0} onClick={save}>
              {saving ? 'Saving…' : 'Save rates'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function MoneyInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center border border-line bg-white focus-within:border-maroon">
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
        className="flex-1 min-w-0 h-11 px-3 bg-transparent text-base md:text-sm tabular-nums focus:outline-none"
      />
      <span className="px-3 text-sm text-muted">EGP</span>
    </div>
  );
}
