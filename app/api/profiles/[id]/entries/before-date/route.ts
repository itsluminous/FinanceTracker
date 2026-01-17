import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/profiles/:id/entries/before-date?date=YYYY-MM-DD - Get latest entry before a specific date
 * Returns the most recent financial entry for the specified profile before the given date
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: profileId } = await params;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json(
        { error: 'Date parameter is required' },
        { status: 400 }
      );
    }

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    // Create Supabase client with the user's access token
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has access to this profile
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userProfile?.role === 'admin';

    if (!isAdmin) {
      // Check if user has link to this profile
      const { data: link, error: linkError } = await supabase
        .from('user_profile_links')
        .select('id')
        .eq('user_id', user.id)
        .eq('profile_id', profileId)
        .single();

      if (linkError || !link) {
        return NextResponse.json(
          { 
            error: 'Access denied to this profile',
            message: 'You do not have permission to view this profile. Please contact an administrator if you believe this is an error.'
          },
          { status: 403 }
        );
      }
    }

    // Fetch the most recent entry before the specified date
    const { data: entry, error } = await supabase
      .from('financial_entries')
      .select('*')
      .eq('profile_id', profileId)
      .lt('entry_date', date)
      .order('entry_date', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
      console.error('Error fetching entry before date:', error);
      return NextResponse.json(
        { error: 'Failed to fetch entry' },
        { status: 500 }
      );
    }

    return NextResponse.json({ entry: entry || null });
  } catch (error) {
    console.error('Error in GET /api/profiles/:id/entries/before-date:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}