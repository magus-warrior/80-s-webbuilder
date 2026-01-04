import { useState } from 'react';

import { useAuthStore } from '../../store/authStore';

type AuthMode = 'login' | 'register';

type AuthResponse = {
  access_token: string;
  token_type: string;
};

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch(`/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { detail?: string };
        throw new Error(payload.detail ?? `Auth failed: ${response.status}`);
      }

      const data = (await response.json()) as AuthResponse;
      setAuth(data.access_token, email);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-slate-900 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg rounded-3xl border-neon bg-slate-950/80 p-10 shadow-xl neon-glow-soft">
          <div className="flex flex-col gap-2 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">Studio Suite</p>
            <h1 className="text-3xl font-semibold text-white">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-sm text-slate-300">
              {mode === 'login'
                ? 'Log in to access the builder experience.'
                : 'Register to start designing polished layouts.'}
            </p>
          </div>

          <div className="mt-8 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition ${
                mode === 'login'
                  ? 'bg-neon-gradient text-slate-950 shadow-lg neon-glow'
                  : 'border-neon-soft text-slate-200'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition ${
                mode === 'register'
                  ? 'bg-neon-gradient text-slate-950 shadow-lg neon-glow'
                  : 'border-neon-soft text-slate-200'
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block text-sm text-slate-200">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-800 bg-black/60 px-4 py-3 text-sm text-slate-100 focus:border-cyan-300 focus:outline-none"
                placeholder="you@example.com"
                required
              />
            </label>
            <label className="block text-sm text-slate-200">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-800 bg-black/60 px-4 py-3 text-sm text-slate-100 focus:border-cyan-300 focus:outline-none"
                placeholder="Minimum 8 characters"
                minLength={8}
                required
              />
            </label>

            {error ? <p className="text-sm text-rose-300">{error}</p> : null}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-full bg-neon-gradient px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg neon-glow transition hover:translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading
                ? mode === 'login'
                  ? 'Logging in...'
                  : 'Creating account...'
                : mode === 'login'
                  ? 'Login'
                  : 'Register'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
