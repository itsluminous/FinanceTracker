'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase, getUserProfile, checkSupabaseConnection, withTimeout } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { DatabaseUnavailable } from '@/components/database-unavailable';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

// How long to wait for the auth check before assuming something is wrong.
// A paused Supabase project can leave requests hanging for 30+ seconds.
const AUTH_CHECK_TIMEOUT_MS = 10000;

// Helper to get cached auth state from localStorage
const getCachedAuthState = () => {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem('auth-state-cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      const age = Date.now() - parsed.timestamp;
      const TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
      
      if (age < TTL && parsed.user) {
        return { hasUser: true };
      }
    }
  } catch (e) {
    console.error('[Auth] Error reading cache:', e);
  }
  return null;
};

// Helper to set cached auth state in localStorage
const setCachedAuthState = (user: unknown) => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem('auth-state-cache', JSON.stringify({
      user,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.error('[Auth] Error writing cache:', e);
  }
};

export function AuthHandler({ children }: { children: React.ReactNode }) {
  const cachedState = getCachedAuthState();
  const [loading, setLoading] = useState(!cachedState);
  const [dbUnavailable, setDbUnavailable] = useState(false);
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
        // Use getUser() - more reliable than getSession() on mobile.
        // Cap it with a timeout: when the Supabase project is paused, this
        // call can hang for 30+ seconds behind token-refresh retries.
        const { data: { user }, error: userError } = await withTimeout(
          supabase.auth.getUser(),
          AUTH_CHECK_TIMEOUT_MS
        );
        
        // Handle user errors
        if (userError) {
          console.error('❌ [AuthHandler] User error:', userError);
          setCachedAuthState(null);
          // Distinguish an expired session from an unreachable (paused) database
          const reachable = await checkSupabaseConnection();
          if (!reachable) {
            setDbUnavailable(true);
            setLoading(false);
            return;
          }
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
        
        if (!user && pathname !== '/auth/login') {
          setCachedAuthState(null);
          router.push('/auth/login');
          setLoading(false);
          return;
        }
        
        // Cache the user
        if (user) {
          setCachedAuthState(user);
        }
        
        // Check user status if logged in
        if (user && !hasShownStatusToast.current) {
          try {
            const { data: userProfile, error: profileError } = await getUserProfile(user.id);
            
            if (profileError) {
              console.error('❌ [AuthHandler] Error fetching user profile:', profileError);
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
                setCachedAuthState(null);
                router.push('/auth/login');
                setLoading(false);
                return;
              }
            }
          } catch (error) {
            console.error('❌ [AuthHandler] Error checking user status:', error);
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error('❌ [AuthHandler] Auth check error:', error);
        setCachedAuthState(null);
        
        // The timeout above lands here when the database hangs. Check whether
        // Supabase is reachable at all (paused free-tier projects are not).
        const reachable = await checkSupabaseConnection();
        if (!reachable) {
          setDbUnavailable(true);
          setLoading(false);
          return;
        }
        
        if (pathname !== '/auth/login') {
          toast({
            title: 'Connection Error',
            description: 'Unable to verify your session. Please sign in again.',
            variant: 'destructive',
          });
          router.push('/auth/login');
        }
        setLoading(false);
      }
    };

    checkAuthAndStatus();

    // Listen for auth state changes (non-blocking)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        // Use setTimeout to make this non-blocking
        setTimeout(async () => {
          if (event === 'SIGNED_OUT') {
            hasShownStatusToast.current = false;
            setCachedAuthState(null);
            router.push('/auth/login');
          } else if (event === 'TOKEN_REFRESHED') {
            if (session?.user) {
              setCachedAuthState(session.user);
            }
          } else if (event === 'SIGNED_IN' && session) {
            setCachedAuthState(session.user);
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
                setCachedAuthState(null);
              }
            } catch (error) {
              console.error('Error checking user status on sign in:', error);
            }
          }
        }, 0);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [router, pathname, toast]);

  if (dbUnavailable) {
    return <DatabaseUnavailable />;
  }

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

