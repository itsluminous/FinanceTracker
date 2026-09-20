'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, checkSupabaseConnection, withTimeout } from '@/lib/supabase';
import { Portfolio } from '@/components/portfolio';
import { MainNav } from '@/components/main-nav';
import { PageLoadingSkeleton } from '@/components/loading-skeletons';
import { DatabaseUnavailable } from '@/components/database-unavailable';

// How long to wait for the auth check before assuming something is wrong.
// A paused Supabase project can leave requests hanging indefinitely.
const AUTH_CHECK_TIMEOUT_MS = 10000;

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [dbUnavailable, setDbUnavailable] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    // A null user can mean "logged out" or "database unreachable" (e.g., a
    // paused Supabase project). Probe connectivity to tell them apart.
    const handleNoUser = async () => {
      const reachable = await checkSupabaseConnection();
      if (cancelled) return;
      if (!reachable) {
        setDbUnavailable(true);
        setLoading(false);
        return;
      }
      router.push('/auth/login');
    };

    const loadUser = async () => {
      try {
        const currentUser = await withTimeout(getCurrentUser(), AUTH_CHECK_TIMEOUT_MS);
        if (cancelled) return;
        if (!currentUser) {
          await handleNoUser();
          return;
        }
        setLoading(false);
      } catch (error) {
        console.error('Error loading user:', error);
        if (cancelled) return;
        await handleNoUser();
      }
    };

    loadUser();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (dbUnavailable) {
    return <DatabaseUnavailable />;
  }

  if (loading) {
    return <PageLoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <MainNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Portfolio />
      </div>
    </div>
  );
}
