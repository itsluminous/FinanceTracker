'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase, getCurrentUser, getUserProfile } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { User } from '@supabase/supabase-js';

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

export function AuthHandler({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    // Check active session and restore it
    const checkSession = async () => {
      try {
        const currentUser = await getCurrentUser();
        
        if (currentUser) {
          setUser(currentUser);
          
          // Fetch user profile to check role
          const { data: profile, error } = await getUserProfile(currentUser.id);
          
          if (error) {
            console.error('Error fetching user profile:', error);
          } else if (profile) {
            setUserProfile(profile);
            
            // Handle user status
            if (profile.role === 'pending') {
              toast({
                title: 'Account Pending',
                description: 'Your account is pending admin approval. You will be notified once approved.',
                duration: 5000,
              });
              
              // Redirect to login if not already there
              if (pathname !== '/auth/login') {
                router.push('/auth/login');
              }
            } else if (profile.role === 'rejected') {
              toast({
                title: 'Account Rejected',
                description: 'Your account has been rejected. Please contact the administrator.',
                variant: 'destructive',
                duration: 5000,
              });
              
              // Redirect to login if not already there
              if (pathname !== '/auth/login') {
                router.push('/auth/login');
              }
            }
          }
        } else {
          // No user, redirect to login if not already there
          if (pathname !== '/auth/login') {
            router.push('/auth/login');
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          
          // Fetch user profile
          const { data: profile } = await getUserProfile(session.user.id);
          if (profile) {
            setUserProfile(profile);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setUserProfile(null);
          router.push('/auth/login');
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router, pathname, toast]);

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

  return <>{children}</>;
}
