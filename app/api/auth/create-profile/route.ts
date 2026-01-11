import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    // Create a Supabase client with service role key to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { userId, email } = await request.json();

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'Missing userId or email' },
        { status: 400 }
      );
    }

    // Check if profile already exists
    const { data: existing } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (existing) {
      return NextResponse.json({ 
        message: 'Profile already exists',
        profile: existing 
      });
    }

    // Check if this is the first user
    const { count } = await supabaseAdmin
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    const isFirstUser = count === 0;

    // Create user profile with service role (bypasses RLS)
    const { data: profile, error } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: userId,
        email,
        role: isFirstUser ? 'admin' : 'pending',
        approved_at: isFirstUser ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user profile:', error);
      return NextResponse.json(
        { error: 'Failed to create profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      profile 
    });
  } catch (error) {
    console.error('Error in POST /api/auth/create-profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
