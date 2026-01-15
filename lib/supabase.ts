import { createClient, User } from '@supabase/supabase-js';
import { UserProfile } from './types';
import { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Only validate environment variables in development and browser context
if (isBrowser && process.env.NODE_ENV === 'development' && (!supabaseUrl || !supabaseAnonKey)) {
  console.error(
    '❌ Missing Supabase environment variables!\n' +
    'Please create a .env.local file with:\n' +
    '  NEXT_PUBLIC_SUPABASE_URL=your_supabase_url\n' +
    '  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key\n\n' +
    'See .env.local.example for reference.'
  );
}

// Create a singleton Supabase client to avoid multiple instances
let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null;

function getSupabaseClient() {
  // If environment variables are missing, throw a helpful error
  if (!supabaseUrl || !supabaseAnonKey) {
    if (isBrowser) {
      throw new Error(
        'Supabase is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file.'
      );
    }
  // During build/SSR, return a mock client to prevent build failures
  return null as unknown as ReturnType<typeof createClient<Database>>;
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      global: {
        headers: {
          'X-Client-Info': 'personal-finance-tracker',
        },
      },
    });
  }
  return supabaseInstance;
}

export const supabase = getSupabaseClient();

// Auth helper functions

/**
 * Sign up a new user with email and password
 * Note: User profile is automatically created by database trigger
 */
export async function signUp(email: string, password: string): Promise<{ data: unknown; error: unknown }> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { data, error };
  } catch (error) {
    console.error('Signup error:', error);
    return { data: null, error };
  }
}

/**
 * Sign in an existing user with email and password
 */
export async function signIn(email: string, password: string): Promise<{ data: unknown; error: unknown }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  } catch (error) {
    console.error('Sign in error:', error);
    return { data: null, error };
  }
}

/**
 * Sign out the current user
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    return { error };
  } catch (error) {
    console.error('Sign out error:', error);
    return { error };
  }
}

/**
 * Get the current session
 */
export async function getSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    return { session: data.session, error };
  } catch (error) {
    console.error('Get session error:', error);
    return { session: null, error };
  }
}

/**
 * Get the current user
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Get user error:', error);
      return null;
    }
    return data.user;
  } catch (error) {
    // Silently handle AbortError in development
    if (error instanceof Error && error.name === 'AbortError') {
      return null;
    }
    console.error('Get current user error:', error);
    return null;
  }
}

/**
 * Get user profile with role information
 * Note: Profile is automatically created by database trigger on signup
 */
export async function getUserProfile(userId: string): Promise<{ data: UserProfile | null; error: unknown }> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    return { data, error };
  } catch (error) {
    console.error('Get user profile error:', error);
    return { data: null, error };
  }
}

/**
 * Check if user is admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const { data } = await getUserProfile(userId);
    return data?.role === 'admin';
  } catch (error) {
    console.error('Is admin check error:', error);
    return false;
  }
}
