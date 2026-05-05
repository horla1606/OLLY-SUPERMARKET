'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { authApi } from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';

function ProfileContent() {
  const { user, refreshUser, logout } = useAuth();

  const [form, setForm]       = useState({ name: '', phone: '' });
  const [saving, setSaving]   = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (user) setForm({ name: user.name, phone: user.phone ?? '' });
  }, [user]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await authApi.updateMe({ name: form.name.trim(), phone: form.phone.trim() || undefined });
      await refreshUser();
      setFeedback({ ok: true, msg: 'Profile updated successfully.' });
    } catch {
      setFeedback({ ok: false, msg: 'Failed to save changes. Please try again.' });
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  }

  return (
    <div className="min-h-screen bg-neutral">
      <header className="bg-secondary text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">My Profile</h1>
          <p className="text-white/60 text-sm">{user?.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard/customer" className="text-white/80 hover:text-white text-sm">
            My Orders
          </Link>
          <Link href="/shop" className="text-white/80 hover:text-white text-sm">
            Shop
          </Link>
          <button onClick={logout} className="text-white/70 hover:text-white text-sm">
            Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">Account Details</h2>

          {feedback && (
            <div className={`mb-4 p-3 rounded-xl text-sm ${
              feedback.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {feedback.msg}
            </div>
          )}

          {/* Email — read only */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              disabled
              value={user?.email ?? ''}
              className="input-field bg-neutral cursor-not-allowed text-gray-400"
            />
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed.</p>
          </div>

          {/* Role — read only */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">
              {user?.role}
            </span>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="Your full name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="tel"
                className="input-field"
                placeholder="+234 800 000 0000"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>

            <button type="submit" disabled={saving} className="btn-primary w-full py-3">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6">
          <Link href="/dashboard/customer" className="text-sm text-primary hover:underline">
            ← Back to my orders
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}
