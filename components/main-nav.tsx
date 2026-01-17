'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getCurrentUser, getUserProfile } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { UserNav } from '@/components/user-nav';
import { ProfileSelector } from '@/components/profile-selector';
import { ProfileDialog } from '@/components/profile-dialog';
import { ThemeToggle } from '@/components/theme-toggle';

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'approved' | 'pending' | 'rejected';
}

interface MainNavProps {
  showProfileSelector?: boolean;
  selectedProfileId?: string;
  onProfileSelect?: (profileId: string) => void;
}

export function MainNav({ showProfileSelector, selectedProfileId, onProfileSelect }: MainNavProps) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

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

  const isActive = (path: string) => pathname === path;

  const canAccessProfiles = userProfile?.role === 'admin' || userProfile?.role === 'approved';
  const canEditProfiles = userProfile?.role === 'admin' || userProfile?.role === 'approved';

  if (loading) {
    return (
      <nav className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💰</span>
              <h1 className="text-xl font-bold text-foreground">Finance Tracker</h1>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <>
      <nav className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo/Brand */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 text-xl font-bold text-foreground hover:text-primary transition-colors"
              >
                <span className="text-2xl">💰</span>
                <span>Finance Tracker</span>
              </button>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-2">
              {canEditProfiles && (
                <Button
                  variant={isActive('/profiles') ? 'secondary' : 'outline'}
                  onClick={() => router.push('/profiles')}
                >
                  Profiles
                </Button>
              )}
              <ThemeToggle />
              <div className="ml-2">
                <UserNav />
              </div>
            </div>

            {/* Mobile Menu Button - Removed, Profiles now in user menu */}
            <div className="md:hidden flex items-center gap-2">
              <ThemeToggle />
              <UserNav />
            </div>
          </div>

          {/* Profile Selector in Header (Desktop) */}
          {showProfileSelector && canAccessProfiles && (
            <div className="hidden md:block pb-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-muted-foreground">Profile:</span>
                <div className="flex-1 max-w-md">
                  <ProfileSelector
                    onProfileSelect={(profileId) => onProfileSelect?.(profileId)}
                    onAddProfile={() => setShowProfileDialog(true)}
                    selectedProfileId={selectedProfileId}
                    compact
                  />
                </div>
              </div>
            </div>
          )}

          {/* Profile Selector Always Visible on Mobile */}
          {showProfileSelector && canAccessProfiles && (
            <div className="md:hidden pb-4 px-4">
              <ProfileSelector
                onProfileSelect={(profileId) => onProfileSelect?.(profileId)}
                onAddProfile={() => setShowProfileDialog(true)}
                selectedProfileId={selectedProfileId}
              />
            </div>
          )}
        </div>
      </nav>

      {/* Profile Dialog */}
      {showProfileSelector && (
        <ProfileDialog
          open={showProfileDialog}
          onOpenChange={setShowProfileDialog}
          onSuccess={() => {
            setShowProfileDialog(false);
            window.location.reload();
          }}
        />
      )}
    </>
  );
}
