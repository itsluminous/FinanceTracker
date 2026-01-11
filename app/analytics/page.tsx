'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase';
import { Portfolio } from '@/components/portfolio';
import { Button } from '@/components/ui/button';

export default function AnalyticsPage() {
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
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Personal Finance Tracker</h1>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => router.push('/')}>
                Home
              </Button>
              <Button variant="ghost" onClick={() => router.push('/profiles')}>
                Profiles
              </Button>
              <Button variant="ghost" onClick={() => router.push('/admin')}>
                Admin
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Portfolio />
      </div>
    </div>
  );
}
