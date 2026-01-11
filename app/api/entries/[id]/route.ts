import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * PUT /api/entries/:id - Update an entry
 * Updates an existing financial entry
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: entryId } = await params;

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

    // Get the entry to check profile_id
    const { data: existingEntry, error: fetchError } = await supabase
      .from('financial_entries')
      .select('profile_id')
      .eq('id', entryId)
      .single();

    if (fetchError || !existingEntry) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
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
      const { data: link } = await supabase
        .from('user_profile_links')
        .select('permission')
        .eq('user_id', user.id)
        .eq('profile_id', existingEntry.profile_id)
        .single();

      if (!link || link.permission !== 'edit') {
        return NextResponse.json(
          { error: 'Edit permission required for this profile' },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const { entry_date, high_medium_risk, low_risk } = body;

    // Build update object
    const updateData: Record<string, string | number> = {
      updated_at: new Date().toISOString(),
    };

    if (entry_date) {
      updateData.entry_date = entry_date;
    }

    if (high_medium_risk) {
      if (high_medium_risk.direct_equity !== undefined) updateData.direct_equity = high_medium_risk.direct_equity;
      if (high_medium_risk.esops !== undefined) updateData.esops = high_medium_risk.esops;
      if (high_medium_risk.equity_pms !== undefined) updateData.equity_pms = high_medium_risk.equity_pms;
      if (high_medium_risk.ulip !== undefined) updateData.ulip = high_medium_risk.ulip;
      if (high_medium_risk.real_estate !== undefined) updateData.real_estate = high_medium_risk.real_estate;
      if (high_medium_risk.real_estate_funds !== undefined) updateData.real_estate_funds = high_medium_risk.real_estate_funds;
      if (high_medium_risk.private_equity !== undefined) updateData.private_equity = high_medium_risk.private_equity;
      if (high_medium_risk.equity_mutual_funds !== undefined) updateData.equity_mutual_funds = high_medium_risk.equity_mutual_funds;
      if (high_medium_risk.structured_products_equity !== undefined) updateData.structured_products_equity = high_medium_risk.structured_products_equity;
    }

    if (low_risk) {
      if (low_risk.bank_balance !== undefined) updateData.bank_balance = low_risk.bank_balance;
      if (low_risk.debt_mutual_funds !== undefined) updateData.debt_mutual_funds = low_risk.debt_mutual_funds;
      if (low_risk.endowment_plans !== undefined) updateData.endowment_plans = low_risk.endowment_plans;
      if (low_risk.fixed_deposits !== undefined) updateData.fixed_deposits = low_risk.fixed_deposits;
      if (low_risk.nps !== undefined) updateData.nps = low_risk.nps;
      if (low_risk.epf !== undefined) updateData.epf = low_risk.epf;
      if (low_risk.ppf !== undefined) updateData.ppf = low_risk.ppf;
      if (low_risk.structured_products_debt !== undefined) updateData.structured_products_debt = low_risk.structured_products_debt;
      if (low_risk.gold_etfs_funds !== undefined) updateData.gold_etfs_funds = low_risk.gold_etfs_funds;
    }

    // Update the entry
    const { data: entry, error } = await supabase
      .from('financial_entries')
      .update(updateData)
      .eq('id', entryId)
      .select()
      .single();

    if (error) {
      console.error('Error updating entry:', error);
      return NextResponse.json(
        { error: 'Failed to update entry' },
        { status: 500 }
      );
    }

    return NextResponse.json({ entry });
  } catch (error) {
    console.error('Error in PUT /api/entries/:id:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/entries/:id - Delete an entry
 * Deletes an existing financial entry
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: entryId } = await params;

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

    // Get the entry to check profile_id
    const { data: existingEntry, error: fetchError } = await supabase
      .from('financial_entries')
      .select('profile_id')
      .eq('id', entryId)
      .single();

    if (fetchError || !existingEntry) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
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
      const { data: link } = await supabase
        .from('user_profile_links')
        .select('permission')
        .eq('user_id', user.id)
        .eq('profile_id', existingEntry.profile_id)
        .single();

      if (!link || link.permission !== 'edit') {
        return NextResponse.json(
          { error: 'Edit permission required for this profile' },
          { status: 403 }
        );
      }
    }

    // Delete the entry
    const { error } = await supabase
      .from('financial_entries')
      .delete()
      .eq('id', entryId);

    if (error) {
      console.error('Error deleting entry:', error);
      return NextResponse.json(
        { error: 'Failed to delete entry' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/entries/:id:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
