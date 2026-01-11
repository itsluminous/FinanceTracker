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

    // Fetch all profiles
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, name, created_at')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching profiles:', error);
      return NextResponse.json(
        { error: 'Failed to fetch profiles' },
        { status: 500 }
      );
    }

    return NextResponse.json({ profiles: profiles || [] });
  } catch (error) {
    console.error('Error in GET /api/admin/profiles:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
