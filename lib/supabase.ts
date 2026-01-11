import { createClient, User } from '@supabase/supabase-js';
import { UserProfile } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  );
}

// Create a singleton Supabase client to avoid multiple instances
let supabaseInstance: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl!, supabaseAnonKey!, {
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
  return supabaseInstance!; // Non-null assertion since we just created it
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
