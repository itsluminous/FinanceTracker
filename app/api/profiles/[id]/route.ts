import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * PUT /api/profiles/:id - Update profile
 * Updates a profile's name
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    // Set the auth token for this request
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const profileId = params.id;
    const { name } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Profile name is required' },
        { status: 400 }
      );
    }

    // Check if user has edit permission for this profile
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userProfile?.role === 'admin';

    if (!isAdmin) {
      // Check if user has edit permission
      const { data: link } = await supabase
        .from('user_profile_links')
        .select('permission')
        .eq('user_id', user.id)
        .eq('profile_id', profileId)
        .single();

      if (!link || link.permission !== 'edit') {
        return NextResponse.json(
          { error: 'Insufficient permissions to update this profile' },
          { status: 403 }
        );
      }
    }

    // Update the profile
    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', profileId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Error in PUT /api/profiles/:id:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/profiles/:id - Delete profile
 * Deletes a profile and all associated data (cascades to financial_entries and user_profile_links)
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    // Set the auth token for this request
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const profileId = params.id;

    // Check if user has edit permission for this profile
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userProfile?.role === 'admin';

    if (!isAdmin) {
      // Check if user has edit permission
      const { data: link } = await supabase
        .from('user_profile_links')
        .select('permission')
        .eq('user_id', user.id)
        .eq('profile_id', profileId)
        .single();

      if (!link || link.permission !== 'edit') {
        return NextResponse.json(
          { error: 'Insufficient permissions to delete this profile' },
          { status: 403 }
        );
      }
    }

    // Delete the profile (cascades to financial_entries and user_profile_links)
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', profileId);

    if (deleteError) {
      console.error('Error deleting profile:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/profiles/:id:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
