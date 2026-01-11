import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface ProfileLink {
  profileId: string;
  permission: 'read' | 'edit';
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;

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

    if (userProfile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }
    const body = await request.json();
    const { role, profileLinks } = body as {
      role: 'admin' | 'approved';
      profileLinks?: ProfileLink[];
    };

    // Validate role
    if (!role || !['admin', 'approved'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be "admin" or "approved"' },
        { status: 400 }
      );
    }

    // Update user profile to approved status with assigned role
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        role,
        approved_at: new Date().toISOString(),
        approved_by: user.id,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating user profile:', updateError);
      return NextResponse.json(
        { error: 'Failed to approve user' },
        { status: 500 }
      );
    }

    // Create profile links if provided
    if (profileLinks && profileLinks.length > 0) {
      const linksToInsert = profileLinks.map(link => ({
        user_id: userId,
        profile_id: link.profileId,
        permission: link.permission,
      }));

      const { error: linksError } = await supabase
        .from('user_profile_links')
        .insert(linksToInsert);

      if (linksError) {
        console.error('Error creating profile links:', linksError);
        // Don't fail the approval, just log the error
        // The user is still approved, they just won't have profile links
      }
    }

    return NextResponse.json({
      success: true,
      message: 'User approved successfully',
    });
  } catch (error) {
    console.error('Error in POST /api/admin/users/[id]/approve:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
