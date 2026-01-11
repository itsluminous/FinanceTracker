'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, getUserProfile } from '@/lib/supabase';
import { AdminPanel } from '@/components/admin-panel';
import { MainNav } from '@/components/main-nav';
import { PageLoadingSkeleton } from '@/components/loading-skeletons';

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const user = await getCurrentUser();
        
        if (!user) {
          router.push('/auth/login');
          return;
        }

        const { data: profile } = await getUserProfile(user.id);
        
        if (profile?.role !== 'admin') {
          router.push('/');
          return;
        }

        setIsAdmin(true);
      } catch (error) {
        console.error('Error checking admin access:', error);
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    checkAdminAccess();
  }, [router]);

  if (loading) {
    return <PageLoadingSkeleton />;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNav />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-gray-600 mt-1">Manage user approvals and access</p>
        </div>
        
        <AdminPanel />
      </div>
    </div>
  );
}
