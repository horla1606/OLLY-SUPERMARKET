'use client';

import { useState, FormEvent, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

function LoginForm() {
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const [email, setEmail]     = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email.trim());
      // AuthContext handles redirect; preserve ?redirect param if needed
      const redirectTo = searchParams.get('redirect');
      if (redirectTo) window.location.href = redirectTo;
    } catch (err: unknown) {
      const resp = err as { response?: { data?: { message?: string; suggestion?: string } } };
      const msg  = resp?.response?.data?.message ?? 'Sign in failed. Please try again.';
      const hint = resp?.response?.data?.suggestion;

      if (hint === 'signup' || msg.toLowerCase().includes('no account')) {
        setError('No account found for this email. Please sign up first.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-extrabold text-secondary">
            OLLY <span className="text-accent">Supermarket</span>
          </Link>
          <p className="text-gray-500 mt-2 text-sm">Sign in with your email</p>
        </div>

        <div className="card">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              {error}
              {error.includes('sign up') && (
                <>
                  {' '}
                  <Link href="/signup" className="font-medium underline">
                    Create account →
                  </Link>
                </>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                autoFocus
                className="input-field"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">
                Enter the email you signed up with — no password needed.
              </p>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-primary font-medium hover:underline">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
