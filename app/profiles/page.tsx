'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, getUserProfile, supabase } from '@/lib/supabase';
import { MainNav } from '@/components/main-nav';
import { FinancialEntryForm } from '@/components/financial-entry-form';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { PageLoadingSkeleton } from '@/components/loading-skeletons';

export default function ProfilesPage() {
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [hasEditPermission, setHasEditPermission] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          router.push('/auth/login');
          return;
        }
        
        // Check user role and permissions
        const { data: profile, error } = await getUserProfile(currentUser.id);
        
        if (error) {
          console.error('Error loading user profile:', error);
          toast({
            title: 'Error',
            description: 'Unable to load user profile. Please try again.',
            variant: 'destructive',
          });
          return;
        }
        
        if (profile) {
          
          // Check if user has permission to access profiles
          if (profile.role === 'pending') {
            toast({
              title: 'Access Denied',
              description: 'Your account is pending approval. Please wait for admin approval.',
              variant: 'destructive',
            });
            router.push('/');
            return;
          }
          
          if (profile.role === 'rejected') {
            toast({
              title: 'Access Denied',
              description: 'Your account has been rejected. Please contact support.',
              variant: 'destructive',
            });
            router.push('/');
            return;
          }

          // Only admins and approved users can add financial data
          // Read-only users should not access this page
          if (profile.role !== 'admin' && profile.role !== 'approved') {
            toast({
              title: 'Access Denied',
              description: 'You do not have permission to add financial data.',
              variant: 'destructive',
            });
            router.push('/');
            return;
          }

          setHasEditPermission(true);
        }
      } catch (error) {
        console.error('Error loading user:', error);
        toast({
          title: 'Error',
          description: 'An error occurred while loading your profile.',
          variant: 'destructive',
        });
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [router, toast]);

  // Check edit permission for selected profile
  useEffect(() => {
    const checkProfilePermission = async () => {
      if (!selectedProfileId) return;

      const currentUser = await getCurrentUser();
      if (!currentUser) return;

      const { data: profile } = await getUserProfile(currentUser.id);
      if (profile?.role === 'admin') {
        setHasEditPermission(true);
        return;
      }

      // Check if user has edit permission for this specific profile
      const { data: link } = await supabase
        .from('user_profile_links')
        .select('permission')
        .eq('user_id', currentUser.id)
        .eq('profile_id', selectedProfileId)
        .single();

      setHasEditPermission((link as { permission: 'read' | 'edit' } | null)?.permission === 'edit');
    };

    checkProfilePermission();
  }, [selectedProfileId]);

  if (loading) {
    return <PageLoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <MainNav
        showProfileSelector
        selectedProfileId={selectedProfileId || undefined}
        onProfileSelect={setSelectedProfileId}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Financial Entry Form */}
          {selectedProfileId && hasEditPermission && (
            <FinancialEntryForm
              profileId={selectedProfileId}
              onSuccess={() => {
                // Cache cleared automatically in FinancialEntryForm
                // Any analytics/portfolio components will refetch on next load
              }}
            />
          )}

          {selectedProfileId && !hasEditPermission && (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <p>You have read-only access to this profile.</p>
                <p className="text-sm mt-2">Contact an administrator to request edit permissions.</p>
              </CardContent>
            </Card>
          )}

          {!selectedProfileId && (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <p>Please select or create a profile to enter financial data</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
