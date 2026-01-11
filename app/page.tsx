'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, getUserProfile } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'approved' | 'pending' | 'rejected';
  approved_at?: string;
  approved_by?: string;
  created_at: string;
  updated_at: string;
}

export default function Home() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const user = await getCurrentUser();
        
        if (user) {
          const { data: profile } = await getUserProfile(user.id);
          if (profile) {
            setUserProfile(profile);
          }
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, []);

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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Welcome to Personal Finance Tracker</CardTitle>
          <CardDescription>
            Track and manage your financial assets across multiple profiles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {userProfile && (
            <div className="rounded-lg bg-blue-50 p-4">
              <h3 className="font-semibold text-blue-900">Account Status</h3>
              <div className="mt-2 space-y-1 text-sm text-blue-800">
                <p>Email: {userProfile.email}</p>
                <p>Role: <span className="capitalize font-medium">{userProfile.role}</span></p>
                {userProfile.role === 'admin' && (
                  <p className="text-green-700 font-medium">✓ You have administrator privileges</p>
                )}
                {userProfile.role === 'pending' && (
                  <p className="text-yellow-700 font-medium">⏳ Your account is pending approval</p>
                )}
                {userProfile.role === 'approved' && (
                  <p className="text-green-700 font-medium">✓ Your account is approved</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Getting Started</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-semibold text-xs">1</span>
                <div>
                  <p className="font-medium text-gray-900">Create or Select a Profile</p>
                  <p>Set up financial profiles for yourself or family members</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-semibold text-xs">2</span>
                <div>
                  <p className="font-medium text-gray-900">Enter Financial Data</p>
                  <p>Track assets across high/medium risk and low risk categories</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-semibold text-xs">3</span>
                <div>
                  <p className="font-medium text-gray-900">View Analytics</p>
                  <p>Visualize your portfolio with charts and trends over time</p>
                </div>
              </div>
            </div>
          </div>

          {userProfile?.role === 'admin' && (
            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900">Admin Features</h3>
              <p className="mt-1 text-sm text-gray-600">
                As an administrator, you can approve new users and manage access to financial profiles.
              </p>
              <Button className="mt-3" onClick={() => router.push('/admin')}>
                Go to Admin Panel
              </Button>
            </div>
          )}

          {userProfile?.role === 'pending' && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <h3 className="font-semibold text-yellow-900">Waiting for Approval</h3>
              <p className="mt-1 text-sm text-yellow-800">
                Your account is pending approval from an administrator. You'll receive a notification once your account is approved.
              </p>
            </div>
          )}

          {(userProfile?.role === 'approved' || userProfile?.role === 'admin') && (
            <div className="flex gap-3">
              <Button onClick={() => router.push('/profiles')} className="flex-1">
                Manage Profiles
              </Button>
              <Button onClick={() => router.push('/analytics')} variant="outline" className="flex-1">
                View Analytics
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
