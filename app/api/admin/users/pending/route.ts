import { NextResponse } from 'next/server';
import { supabase, getCurrentUser, isAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    // Check if user is authenticated and is admin
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userIsAdmin = await isAdmin(user.id);
    
    if (!userIsAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Fetch all pending users
    const { data: pendingUsers, error } = await supabase
      .from('user_profiles')
      .select('id, email, name, created_at')
      .eq('role', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching pending users:', error);
      return NextResponse.json(
        { error: 'Failed to fetch pending users' },
        { status: 500 }
      );
    }

    return NextResponse.json({ users: pendingUsers || [] });
  } catch (error) {
    console.error('Error in GET /api/admin/users/pending:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
