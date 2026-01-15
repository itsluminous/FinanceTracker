import { NextResponse } from 'next/server';
import { supabase, getCurrentUser, getUserProfile } from '@/lib/supabase';

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get current user's profile
    const { data: profile } = await getUserProfile(user.id);

    // Try to fetch pending users with detailed error info
    const { data: pendingUsers, error } = await supabase
      .from('user_profiles')
      .select('id, email, name, role, created_at')
      .eq('role', 'pending')
      .order('created_at', { ascending: true });

    // Also try to get ALL users to see what we can access
    const { data: allUsers, error: allError } = await supabase
      .from('user_profiles')
      .select('id, email, role')
      .order('created_at', { ascending: true });

    return NextResponse.json({
      currentUser: {
        id: user.id,
        email: user.email,
        profile: profile,
      },
      pendingUsers: pendingUsers || [],
      pendingError: error,
      allUsers: allUsers || [],
      allUsersError: allError,
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
