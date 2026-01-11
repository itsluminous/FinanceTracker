import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/profiles/:id/entries - Get all entries for a profile
 * Returns all financial entries for the specified profile, ordered by date descending
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

    // Fetch all entries for the profile
    const { data: entries, error } = await supabase
      .from('financial_entries')
      .select('*')
      .eq('profile_id', profileId)
      .order('entry_date', { ascending: false });

    if (error) {
      console.error('Error fetching entries:', error);
      return NextResponse.json(
        { error: 'Failed to fetch entries' },
        { status: 500 }
      );
    }

    return NextResponse.json({ entries: entries || [] });
  } catch (error) {
    console.error('Error in GET /api/profiles/:id/entries:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/profiles/:id/entries - Create new entry for a profile
 * Creates a new financial entry for the specified profile
 */
export async function POST(
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

    // Check if user has edit permission for this profile
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userProfile?.role === 'admin';

    if (!isAdmin) {
      // Check if user has edit permission for this profile
      const { data: link, error: linkError } = await supabase
        .from('user_profile_links')
        .select('permission')
        .eq('user_id', user.id)
        .eq('profile_id', profileId)
        .single();

      if (linkError || !link) {
        return NextResponse.json(
          { 
            error: 'Access denied to this profile',
            message: 'You do not have access to this profile.'
          },
          { status: 403 }
        );
      }

      if (link.permission !== 'edit') {
        return NextResponse.json(
          { 
            error: 'Edit permission required for this profile',
            message: 'You have read-only access to this profile. Please contact an administrator to request edit permissions.'
          },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const { entry_date, high_medium_risk, low_risk } = body;

    // Validate required fields
    if (!entry_date) {
      return NextResponse.json(
        { error: 'Entry date is required' },
        { status: 400 }
      );
    }

    // Create the entry
    const { data: entry, error } = await supabase
      .from('financial_entries')
      .insert({
        profile_id: profileId,
        entry_date,
        direct_equity: high_medium_risk?.direct_equity || 0,
        esops: high_medium_risk?.esops || 0,
        equity_pms: high_medium_risk?.equity_pms || 0,
        ulip: high_medium_risk?.ulip || 0,
        real_estate: high_medium_risk?.real_estate || 0,
        real_estate_funds: high_medium_risk?.real_estate_funds || 0,
        private_equity: high_medium_risk?.private_equity || 0,
        equity_mutual_funds: high_medium_risk?.equity_mutual_funds || 0,
        structured_products_equity: high_medium_risk?.structured_products_equity || 0,
        bank_balance: low_risk?.bank_balance || 0,
        debt_mutual_funds: low_risk?.debt_mutual_funds || 0,
        endowment_plans: low_risk?.endowment_plans || 0,
        fixed_deposits: low_risk?.fixed_deposits || 0,
        nps: low_risk?.nps || 0,
        epf: low_risk?.epf || 0,
        ppf: low_risk?.ppf || 0,
        structured_products_debt: low_risk?.structured_products_debt || 0,
        gold_etfs_funds: low_risk?.gold_etfs_funds || 0,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating entry:', error);
      return NextResponse.json(
        { error: 'Failed to create entry' },
        { status: 500 }
      );
    }

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/profiles/:id/entries:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
