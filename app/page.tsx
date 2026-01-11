'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase';
import { Portfolio } from '@/components/portfolio';
import { MainNav } from '@/components/main-nav';
import { PageLoadingSkeleton } from '@/components/loading-skeletons';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          router.push('/auth/login');
          return;
        }
      } catch (error) {
        console.error('Error loading user:', error);
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [router]);

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
