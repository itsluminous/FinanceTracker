'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase, getUserProfile } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export function AuthHandler({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const hasInitialized = useRef(false);
  const hasShownStatusToast = useRef(false);

  useEffect(() => {
    // Prevent duplicate initialization in React Strict Mode
    if (hasInitialized.current) {
      return;
    }
    hasInitialized.current = true;

    const checkAuthAndStatus = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // Handle session errors
        if (sessionError) {
          console.error('Session error:', sessionError);
          if (pathname !== '/auth/login') {
            toast({
              title: 'Session Error',
              description: 'Your session has expired. Please sign in again.',
              variant: 'destructive',
            });
            router.push('/auth/login');
          }
          setLoading(false);
          return;
        }
        
        if (!session && pathname !== '/auth/login') {
          router.push('/auth/login');
          setLoading(false);
          return;
        }
        
        // Check user status if logged in
        if (session && !hasShownStatusToast.current) {
          try {
            const { data: userProfile, error: profileError } = await getUserProfile(session.user.id);
            
            if (profileError) {
              console.error('Error fetching user profile:', profileError);
            } else if (userProfile) {
              // Show toast for pending users
              if (userProfile.role === 'pending') {
                toast({
                  title: 'Account Pending',
                  description: 'Your account is pending admin approval. You will be notified once approved.',
                  variant: 'default',
                });
                hasShownStatusToast.current = true;
              }
              // Show toast for rejected users
              else if (userProfile.role === 'rejected') {
                toast({
                  title: 'Account Rejected',
                  description: 'Your account request has been rejected. Please contact support for more information.',
                  variant: 'destructive',
                });
                hasShownStatusToast.current = true;
                // Sign out rejected users
                await supabase.auth.signOut();
                router.push('/auth/login');
                setLoading(false);
                return;
              }
            }
          } catch (error) {
            console.error('Error checking user status:', error);
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Auth check error:', error);
        // Handle network errors gracefully
        if (pathname !== '/auth/login') {
          toast({
            title: 'Connection Error',
            description: 'Unable to verify your session. Please check your connection.',
            variant: 'destructive',
          });
        }
        setLoading(false);
      }
    };

    checkAuthAndStatus();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: any) => {
        if (event === 'SIGNED_OUT') {
          hasShownStatusToast.current = false;
          router.push('/auth/login');
        } else if (event === 'TOKEN_REFRESHED') {
          // Session refreshed successfully
          console.log('Session refreshed');
        } else if (event === 'SIGNED_IN' && session) {
          // Check user status on sign in
          try {
            const { data: userProfile } = await getUserProfile(session.user.id);
            
            if (userProfile?.role === 'rejected') {
              toast({
                title: 'Account Rejected',
                description: 'Your account request has been rejected.',
                variant: 'destructive',
              });
              await supabase.auth.signOut();
            }
          } catch (error) {
            console.error('Error checking user status on sign in:', error);
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
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

