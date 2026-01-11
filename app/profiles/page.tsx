'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase';
import { ProfileSelector } from '@/components/profile-selector';
import { ProfileDialog } from '@/components/profile-dialog';
import { FinancialEntryForm } from '@/components/financial-entry-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProfilesPage() {
  const [user, setUser] = useState<any>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          router.push('/auth/login');
          return;
        }
        setUser(currentUser);
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
      {/* Simple Navigation Bar */}
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Profile Selector */}
          <Card>
            <CardHeader>
              <CardTitle>Select Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <ProfileSelector
                onProfileSelect={(profileId) => setSelectedProfileId(profileId)}
                onAddProfile={() => setShowProfileDialog(true)}
                selectedProfileId={selectedProfileId || undefined}
              />
            </CardContent>
          </Card>

          {/* Financial Entry Form */}
          {selectedProfileId && (
            <FinancialEntryForm
              profileId={selectedProfileId}
              onSuccess={() => {
                // Optionally refresh or show success message
                console.log('Entry saved successfully');
              }}
            />
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

      {/* Profile Dialog */}
      <ProfileDialog
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        onSuccess={() => {
          setShowProfileDialog(false);
          // Refresh profiles by reloading the page or triggering a refresh
          window.location.reload();
        }}
      />
    </div>
  );
}
