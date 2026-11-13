import { redirect } from 'next/navigation';
import { hasSession } from '@/lib/auth';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await hasSession()) redirect('/');
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-esp">
      <div className="w-full max-w-sm bg-cream border border-kraft p-8">
        <div className="text-2xl font-semibold text-maroon">ورقة · Waraqa</div>
        <p className="text-sm text-muted mt-1 mb-6">Operations CRM</p>
        <LoginForm />
      </div>
    </main>
  );
}
