import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    // Update user profile to rejected status
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        role: 'rejected',
        approved_at: new Date().toISOString(),
        approved_by: user.id,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error rejecting user:', updateError);
      return NextResponse.json(
        { error: 'Failed to reject user' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User rejected successfully',
    });
  } catch (error) {
    console.error('Error in POST /api/admin/users/[id]/reject:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
