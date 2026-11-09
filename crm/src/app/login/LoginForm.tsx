'use client';

import { useActionState } from 'react';
import { login } from '../actions';

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="text-xs uppercase tracking-wide text-muted">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          className="mt-1 w-full h-11 px-3 border border-line bg-white focus:outline-none focus:border-maroon"
        />
      </label>
      {state?.error && <p className="text-sm text-error">{state.error}</p>}
      <button
        disabled={pending}
        className="w-full h-11 bg-maroon text-cream font-medium hover:bg-esp disabled:opacity-60"
      >
        {pending ? 'Checking…' : 'Sign in'}
      </button>
    </form>
  );
}
