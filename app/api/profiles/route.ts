import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/profiles - Get user's linked profiles
 * Returns all profiles the authenticated user has access to
 */
export async function GET(request: Request) {
  try {
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

    // Check if user is admin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    let profiles;

    if (userProfile?.role === 'admin') {
      // Admin can see all profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching profiles:', error);
        return NextResponse.json(
          { error: 'Failed to fetch profiles' },
          { status: 500 }
        );
      }

      profiles = data;
    } else {
      // Regular users see only linked profiles
      const { data, error } = await supabase
        .from('user_profile_links')
        .select('profile_id, profiles(*)')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching linked profiles:', error);
        return NextResponse.json(
          { error: 'Failed to fetch profiles' },
          { status: 500 }
        );
      }

      profiles = data?.map(link => link.profiles).filter(Boolean) || [];
    }

    return NextResponse.json({ profiles });
  } catch (error) {
    console.error('Error in GET /api/profiles:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/profiles - Create new profile
 * Creates a new profile and links it to the authenticated user
 */
export async function POST(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    // Create Supabase client with the user's access token
    // This allows RLS policies to work correctly with auth.uid()
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

    // Check if user is approved
    const { data: userProfile, error: userProfileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log('User profile query result:', { userProfile, userProfileError, userId: user.id });

    if (!userProfile || !['admin', 'approved'].includes(userProfile.role)) {
      return NextResponse.json(
        { 
          error: 'User not authorized to create profiles',
          debug: {
            userProfile,
            userProfileError: userProfileError ? {
              message: userProfileError.message,
              code: userProfileError.code,
              details: userProfileError.details,
            } : null,
            userId: user.id,
          }
        },
        { status: 403 }
      );
    }

    const { name } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Profile name is required' },
        { status: 400 }
      );
    }

    // Create the profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({ name: name.trim() })
      .select()
      .single();

    if (profileError) {
      console.error('Error creating profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to create profile' },
        { status: 500 }
      );
    }

    // Link the profile to the user with edit permission
    const { error: linkError } = await supabase
      .from('user_profile_links')
      .insert({
        user_id: user.id,
        profile_id: profile.id,
        permission: 'edit',
      });

    if (linkError) {
      console.error('Error linking profile to user:', linkError);
      // Try to clean up the created profile
      await supabase.from('profiles').delete().eq('id', profile.id);
      return NextResponse.json(
        { error: 'Failed to link profile to user' },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/profiles:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
