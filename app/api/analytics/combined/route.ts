import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  filterCombinedPortfolioByPeriod,
  aggregateCombinedPortfolio,
  TimePeriod 
} from '@/lib/analytics';
import { FinancialEntry } from '@/lib/types';

export async function GET(request: NextRequest) {
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
    
    // Get time period from query params (default to 1 year)
    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get('period') || '1year') as TimePeriod;
    const profileIdsParam = searchParams.get('profileIds');
    
    // Validate period
    if (!['30days', '3months', '1year', '3years', '5years', '10years'].includes(period)) {
      return NextResponse.json(
        { error: 'Invalid time period' },
        { status: 400 }
      );
    }
    
    // Get all profiles linked to the user
    const { data: profileLinks, error: linksError } = await supabase
      .from('user_profile_links')
      .select('profile_id')
      .eq('user_id', user.id);
    
    if (linksError) {
      console.error('Error fetching profile links:', linksError);
      return NextResponse.json(
        { error: 'Failed to fetch profile links' },
        { status: 500 }
      );
    }
    
    if (!profileLinks || profileLinks.length === 0) {
      return NextResponse.json({
        chartData: [],
        riskDistribution: [],
        totalAssets: 0,
        message: 'No profiles linked to your account'
      });
    }
    
    const allProfileIds = profileLinks.map(link => link.profile_id);
    const profileIds = profileIdsParam 
      ? profileIdsParam.split(',').filter(id => allProfileIds.includes(id))
      : allProfileIds;
    
    // Fetch all financial entries for all linked profiles
    const { data: entries, error: entriesError } = await supabase
      .from('financial_entries')
      .select('*')
      .in('profile_id', profileIds)
      .order('entry_date', { ascending: true });
    
    if (entriesError) {
      console.error('Error fetching entries:', entriesError);
      return NextResponse.json(
        { error: 'Failed to fetch financial entries' },
        { status: 500 }
      );
    }
    
    if (!entries || entries.length === 0) {
      return NextResponse.json({
        chartData: [],
        riskDistribution: [],
        totalAssets: 0,
        message: 'No financial data available for your profiles'
      });
    }
    
    // Group entries by profile
    const profileEntriesMap = new Map<string, FinancialEntry[]>();
    
    entries.forEach(entry => {
      const financialEntry: FinancialEntry = {
        id: entry.id,
        profile_id: entry.profile_id,
        entry_date: new Date(entry.entry_date),
        high_medium_risk: {
          direct_equity: entry.direct_equity || 0,
          esops: entry.esops || 0,
          equity_pms: entry.equity_pms || 0,
          ulip: entry.ulip || 0,
          real_estate: entry.real_estate || 0,
          real_estate_funds: entry.real_estate_funds || 0,
          private_equity: entry.private_equity || 0,
          equity_mutual_funds: entry.equity_mutual_funds || 0,
          structured_products_equity: entry.structured_products_equity || 0
        },
        low_risk: {
          bank_balance: entry.bank_balance || 0,
          debt_mutual_funds: entry.debt_mutual_funds || 0,
          endowment_plans: entry.endowment_plans || 0,
          fixed_deposits: entry.fixed_deposits || 0,
          nps: entry.nps || 0,
          epf: entry.epf || 0,
          ppf: entry.ppf || 0,
          structured_products_debt: entry.structured_products_debt || 0,
          gold_etfs_funds: entry.gold_etfs_funds || 0
        },
        total_high_medium_risk: entry.total_high_medium_risk || 0,
        total_low_risk: entry.total_low_risk || 0,
        total_assets: entry.total_assets || 0,
        created_at: new Date(entry.created_at),
        updated_at: new Date(entry.updated_at),
        created_by: entry.created_by
      };
      
      const profileEntries = profileEntriesMap.get(entry.profile_id) || [];
      profileEntries.push(financialEntry);
      profileEntriesMap.set(entry.profile_id, profileEntries);
    });
    
    // Filter by time period
    const filteredProfileEntries = filterCombinedPortfolioByPeriod(profileEntriesMap, period);
    
    if (filteredProfileEntries.size === 0) {
      return NextResponse.json({
        chartData: [],
        riskDistribution: [],
        totalAssets: 0,
        message: `No financial data available for the selected time period (${period})`
      });
    }
    
    // Aggregate data across all profiles
    const aggregatedData = aggregateCombinedPortfolio(filteredProfileEntries);
    
    return NextResponse.json({
      ...aggregatedData,
      period,
      profileCount: filteredProfileEntries.size
    });
    
  } catch (error) {
    console.error('Error in combined analytics API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
