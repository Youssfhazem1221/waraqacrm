'use client';

import { useEffect, useState } from 'react';
import type { AuditEntry, Settings } from '@data/types';
import { useData } from '@/components/DataProvider';
import { PageHeader } from '@/components/Shell';
import { WaModeToggle, useWaMode } from '@/components/WhatsAppPanel';
import { Button, Card, Field, Input } from '@/components/ui';
import { loadAudit, logout, runImport, runSetup, saveSettings } from '@/app/actions';

export default function SettingsPage() {
  const { snap, run } = useData();
  const [s, setS] = useState<Settings>(snap.settings);
  const [mode, setMode] = useWaMode();
  const [oldSheet, setOldSheet] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);

  useEffect(() => setS(snap.settings), [snap.settings]);
  const dirty = JSON.stringify(s) !== JSON.stringify(snap.settings);
  const empty = !snap.products.length && !snap.orders.length;

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Business rules" actions={dirty && <Button variant="primary" onClick={() => run(saveSettings(s), 'Settings saved')}>Save</Button>}>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Support WhatsApp" hint="International format, e.g. 2010…">
              <Input value={s.supportWhatsapp} onChange={(e) => setS({ ...s, supportWhatsapp: e.target.value })} />
            </Field>
            <Field label="Confirm within (hours)" hint="Pending orders older than this show as late.">
              <Input type="number" min={1} value={s.slaHours} onChange={(e) => setS({ ...s, slaHours: Number(e.target.value) })} />
            </Field>
            <Field label="Low stock at" hint="Stock at or below this is flagged.">
              <Input type="number" min={0} value={s.lowStockThreshold} onChange={(e) => setS({ ...s, lowStockThreshold: Number(e.target.value) })} />
            </Field>
            <label className="flex items-center gap-2 text-sm self-center">
              <input type="checkbox" checked={s.restockOnCancel} onChange={(e) => setS({ ...s, restockOnCancel: e.target.checked })} />
              Put items back in stock when an order is cancelled
            </label>
          </div>
          <p className="text-xs text-muted mt-3">Shipping rates live on the Shipping page.</p>
        </Card>

        <Card title="WhatsApp on this device">
          <p className="text-sm text-muted mb-3">
            Choose where chats open on this computer or phone. WhatsApp Web opens in a browser tab; the app option opens the installed WhatsApp
            or WhatsApp Business. You can switch per message too.
          </p>
          <WaModeToggle mode={mode} onChange={setMode} />
        </Card>

        <Card title="Google Sheet">
          <p className="text-sm">
            All data lives in{' '}
            <a className="underline" href={snap.sheetUrl} target="_blank" rel="noreferrer">
              this Sheet
            </a>
            . You can edit it by hand: the CRM and the store pick changes up within about 15 seconds. Don’t rename the column headers.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              onClick={async () => {
                const r = await run(runSetup(), 'Sheet checked');
                if (r) setLog(r.log);
              }}
            >
              Set up / repair tabs
            </Button>
          </div>
          <p className="text-xs text-muted mt-2">Creates missing tabs and columns, dropdowns and header notes. Never touches your rows.</p>
        </Card>

        <Card title="Import from the old Sheet">
          {empty ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Copies products, orders, order items, customers and newsletter sign-ups from the old Apps Script Sheet. Share the old Sheet with the
                data Worker’s service account (Viewer is enough) first. Runs only while this Sheet has no products or orders.
              </p>
              <Input placeholder="Old Sheet URL or ID" value={oldSheet} onChange={(e) => setOldSheet(e.target.value)} />
              <Button
                variant="primary"
                disabled={!oldSheet.trim()}
                onClick={async () => {
                  const r = await run(runImport(oldSheet), 'Import finished');
                  if (r) setLog(r.log);
                }}
              >
                Import
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted">This Sheet already has data, so import is off (it would create duplicates).</p>
          )}
        </Card>
      </div>

      {log.length > 0 && (
        <Card title="Result" className="mt-4">
          <ul className="text-sm list-disc pl-5 space-y-1">
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card
        title="Change log"
        className="mt-4"
        actions={<Button onClick={async () => setAudit(await loadAudit())}>{audit ? 'Reload' : 'Show'}</Button>}
      >
        {audit ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted">
                <tr>
                  <th className="text-left pb-2">When</th>
                  <th className="text-left pb-2">What</th>
                  <th className="text-left pb-2">Item</th>
                  <th className="text-left pb-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a, i) => (
                  <tr key={i} className="border-t border-line align-top">
                    <td className="py-1.5 pr-3 whitespace-nowrap text-muted">{a.at}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{a.action}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{a.target}</td>
                    <td className="py-1.5 break-all">{a.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">Every price, stock, status, shipping and settings change made from the CRM, also kept in the Sheet’s “Audit Log” tab.</p>
        )}
      </Card>

      <form action={logout} className="mt-6">
        <Button>Sign out</Button>
      </form>
    </>
  );
}
