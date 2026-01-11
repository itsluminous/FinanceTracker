import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/profiles/:id/entries/latest - Get most recent entry for a profile
 * Returns the most recent financial entry for the specified profile
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
      const { data: link } = await supabase
        .from('user_profile_links')
        .select('id')
        .eq('user_id', user.id)
        .eq('profile_id', profileId)
        .single();

      if (!link) {
        return NextResponse.json(
          { error: 'Access denied to this profile' },
          { status: 403 }
        );
      }
    }

    // Fetch the most recent entry for the profile
    const { data: entry, error } = await supabase
      .from('financial_entries')
      .select('*')
      .eq('profile_id', profileId)
      .order('entry_date', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" which is fine
      console.error('Error fetching latest entry:', error);
      return NextResponse.json(
        { error: 'Failed to fetch latest entry' },
        { status: 500 }
      );
    }

    return NextResponse.json({ entry: entry || null });
  } catch (error) {
    console.error('Error in GET /api/profiles/:id/entries/latest:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
