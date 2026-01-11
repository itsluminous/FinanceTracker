import { NextResponse } from 'next/server';
import { supabase, getCurrentUser, isAdmin } from '@/lib/supabase';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    const userId = params.id;

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
