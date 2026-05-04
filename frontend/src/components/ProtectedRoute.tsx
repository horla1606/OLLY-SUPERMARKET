'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface Props {
  children: React.ReactNode;
  requiredRole?: 'manager' | 'customer';
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { isAuthenticated, isManager, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (requiredRole === 'manager' && !isManager) {
      router.replace('/dashboard/customer');
    }
  }, [isAuthenticated, isManager, loading, requiredRole, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (requiredRole === 'manager' && !isManager) return null;

  return <>{children}</>;
}
