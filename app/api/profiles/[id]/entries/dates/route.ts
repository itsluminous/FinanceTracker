import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/profiles/:id/entries/dates - Get all dates that have entries
 * Returns an array of dates that have financial entries for the specified profile
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: profileId } = await params;

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

    // Fetch all entry dates for the profile
    const { data: entries, error } = await supabase
      .from('financial_entries')
      .select('entry_date')
      .eq('profile_id', profileId)
      .order('entry_date', { ascending: false });

    if (error) {
      console.error('Error fetching entry dates:', error);
      return NextResponse.json(
        { error: 'Failed to fetch entry dates' },
        { status: 500 }
      );
    }

    const dates = entries?.map(entry => entry.entry_date) || [];
    return NextResponse.json({ dates });
  } catch (error) {
    console.error('Error in GET /api/profiles/:id/entries/dates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}