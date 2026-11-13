import { redirect } from 'next/navigation';
import { data, hasSession } from '@/lib/auth';
import { DataProvider } from '@/components/DataProvider';
import { Shell } from '@/components/Shell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasSession())) redirect('/login');

  let snapshot;
  try {
    snapshot = await data().snapshot();
  } catch (err) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg bg-white border border-error p-6 space-y-3">
          <h1 className="text-lg font-semibold text-error">Can’t read the Sheet</h1>
          <p className="text-sm text-char">{err instanceof Error ? err.message : String(err)}</p>
          <p className="text-sm text-muted">
            Check that the data Worker is running and the Sheet is shared with its service account, then reload.
          </p>
        </div>
      </main>
    );
  }

  return (
    <DataProvider initial={snapshot}>
      <Shell>{children}</Shell>
    </DataProvider>
  );
}
