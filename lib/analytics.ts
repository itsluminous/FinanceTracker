import { FinancialEntry, ChartDataPoint, RiskDistribution } from './types';

export type TimePeriod = '30days' | '3months' | '1year' | '3years' | '5years' | '10years';

/**
 * Calculate the start date for a given time period
 */
export function getStartDateForPeriod(period: TimePeriod): Date {
  const now = new Date();
  const startDate = new Date(now);
  
  switch (period) {
    case '30days':
      startDate.setDate(now.getDate() - 30);
      break;
    case '3months':
      startDate.setMonth(now.getMonth() - 3);
      break;
    case '1year':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    case '3years':
      startDate.setFullYear(now.getFullYear() - 3);
      break;
    case '5years':
      startDate.setFullYear(now.getFullYear() - 5);
      break;
    case '10years':
      startDate.setFullYear(now.getFullYear() - 10);
      break;
  }
  
  return startDate;
}

/**
 * Filter financial entries by time period
 */
export function filterEntriesByPeriod(
  entries: FinancialEntry[],
  period: TimePeriod
): FinancialEntry[] {
  const startDate = getStartDateForPeriod(period);
  
  return entries.filter(entry => {
    const entryDate = new Date(entry.entry_date);
    return entryDate >= startDate;
  });
}

/**
 * Transform financial entries into chart data points
 */
export function transformToChartData(entries: FinancialEntry[]): ChartDataPoint[] {
  // Sort entries by date (oldest first)
  const sortedEntries = [...entries].sort((a, b) => {
    return new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime();
  });
  
  return sortedEntries.map(entry => ({
    date: new Date(entry.entry_date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }),
    total_assets: entry.total_assets,
    high_medium_risk: entry.total_high_medium_risk,
    low_risk: entry.total_low_risk,
    // Individual asset fields
    direct_equity: entry.high_medium_risk.direct_equity,
    esops: entry.high_medium_risk.esops,
    equity_pms: entry.high_medium_risk.equity_pms,
    ulip: entry.high_medium_risk.ulip,
    real_estate: entry.high_medium_risk.real_estate,
    real_estate_funds: entry.high_medium_risk.real_estate_funds,
    private_equity: entry.high_medium_risk.private_equity,
    equity_mutual_funds: entry.high_medium_risk.equity_mutual_funds,
    structured_products_equity: entry.high_medium_risk.structured_products_equity,
    bank_balance: entry.low_risk.bank_balance,
    debt_mutual_funds: entry.low_risk.debt_mutual_funds,
    endowment_plans: entry.low_risk.endowment_plans,
    fixed_deposits: entry.low_risk.fixed_deposits,
    nps: entry.low_risk.nps,
    epf: entry.low_risk.epf,
    ppf: entry.low_risk.ppf,
    structured_products_debt: entry.low_risk.structured_products_debt,
    gold_etfs_funds: entry.low_risk.gold_etfs_funds
  }));
}

/**
 * Calculate risk distribution from the most recent entry
 */
export function calculateRiskDistribution(
  entries: FinancialEntry[]
): RiskDistribution[] {
  if (entries.length === 0) {
    return [];
  }
  
  // Get the most recent entry
  const latestEntry = entries.reduce((latest, entry) => {
    return new Date(entry.entry_date) > new Date(latest.entry_date) ? entry : latest;
  });
  
  const totalAssets = latestEntry.total_assets;
  
  if (totalAssets === 0) {
    return [];
  }
  
  const highMediumRisk = latestEntry.total_high_medium_risk;
  const lowRisk = latestEntry.total_low_risk;
  
  return [
    {
      name: 'High/Medium Risk',
      value: highMediumRisk,
      percentage: (highMediumRisk / totalAssets) * 100
    },
    {
      name: 'Low Risk',
      value: lowRisk,
      percentage: (lowRisk / totalAssets) * 100
    }
  ];
}

/**
 * Aggregate data across multiple profiles for combined portfolio view
 */
export function aggregateCombinedPortfolio(
  profileEntries: Map<string, FinancialEntry[]>
): {
  chartData: ChartDataPoint[];
  riskDistribution: RiskDistribution[];
  totalAssets: number;
} {
  // Get the most recent entry from each profile
  const latestEntries: FinancialEntry[] = [];
  
  profileEntries.forEach(entries => {
    if (entries.length > 0) {
      // Filter out entries with invalid dates
      const validEntries = entries.filter(entry => {
        const date = new Date(entry.entry_date);
        return !isNaN(date.getTime());
      });
      
      if (validEntries.length > 0) {
        const latest = validEntries.reduce((latest, entry) => {
          return new Date(entry.entry_date) > new Date(latest.entry_date) ? entry : latest;
        });
        latestEntries.push(latest);
      }
    }
  });
  
  // Calculate combined totals
  const totalAssets = latestEntries.reduce((sum, entry) => sum + entry.total_assets, 0);
  const totalHighMediumRisk = latestEntries.reduce((sum, entry) => sum + entry.total_high_medium_risk, 0);
  const totalLowRisk = latestEntries.reduce((sum, entry) => sum + entry.total_low_risk, 0);
  
  // Calculate risk distribution (only if total assets is meaningful and risk components sum correctly)
  const MIN_TOTAL_ASSETS = 0.01; // Minimum threshold to avoid floating point issues
  const riskSum = totalHighMediumRisk + totalLowRisk;
  const riskDistribution: RiskDistribution[] = 
    (totalAssets >= MIN_TOTAL_ASSETS && Math.abs(totalAssets - riskSum) < 0.01) ? [
      {
        name: 'High/Medium Risk',
        value: totalHighMediumRisk,
        percentage: (totalHighMediumRisk / totalAssets) * 100
      },
      {
        name: 'Low Risk',
        value: totalLowRisk,
        percentage: (totalLowRisk / totalAssets) * 100
      }
    ] : [];
  
  // Aggregate chart data by date
  const dateMap = new Map<string, { 
    high_medium_risk: number; 
    low_risk: number; 
    total_assets: number;
    // Individual asset fields
    direct_equity: number;
    esops: number;
    equity_pms: number;
    ulip: number;
    real_estate: number;
    real_estate_funds: number;
    private_equity: number;
    equity_mutual_funds: number;
    structured_products_equity: number;
    bank_balance: number;
    debt_mutual_funds: number;
    endowment_plans: number;
    fixed_deposits: number;
    nps: number;
    epf: number;
    ppf: number;
    structured_products_debt: number;
    gold_etfs_funds: number;
  }>();
  
  profileEntries.forEach(entries => {
    entries.forEach(entry => {
      const date = new Date(entry.entry_date);
      // Skip entries with invalid dates
      if (isNaN(date.getTime())) {
        return;
      }
      
      const dateKey = date.toISOString().split('T')[0];
      const existing = dateMap.get(dateKey) || { 
        high_medium_risk: 0, 
        low_risk: 0, 
        total_assets: 0,
        // Individual asset fields
        direct_equity: 0,
        esops: 0,
        equity_pms: 0,
        ulip: 0,
        real_estate: 0,
        real_estate_funds: 0,
        private_equity: 0,
        equity_mutual_funds: 0,
        structured_products_equity: 0,
        bank_balance: 0,
        debt_mutual_funds: 0,
        endowment_plans: 0,
        fixed_deposits: 0,
        nps: 0,
        epf: 0,
        ppf: 0,
        structured_products_debt: 0,
        gold_etfs_funds: 0
      };
      
      dateMap.set(dateKey, {
        high_medium_risk: existing.high_medium_risk + entry.total_high_medium_risk,
        low_risk: existing.low_risk + entry.total_low_risk,
        total_assets: existing.total_assets + entry.total_assets,
        // Individual asset fields
        direct_equity: existing.direct_equity + entry.high_medium_risk.direct_equity,
        esops: existing.esops + entry.high_medium_risk.esops,
        equity_pms: existing.equity_pms + entry.high_medium_risk.equity_pms,
        ulip: existing.ulip + entry.high_medium_risk.ulip,
        real_estate: existing.real_estate + entry.high_medium_risk.real_estate,
        real_estate_funds: existing.real_estate_funds + entry.high_medium_risk.real_estate_funds,
        private_equity: existing.private_equity + entry.high_medium_risk.private_equity,
        equity_mutual_funds: existing.equity_mutual_funds + entry.high_medium_risk.equity_mutual_funds,
        structured_products_equity: existing.structured_products_equity + entry.high_medium_risk.structured_products_equity,
        bank_balance: existing.bank_balance + entry.low_risk.bank_balance,
        debt_mutual_funds: existing.debt_mutual_funds + entry.low_risk.debt_mutual_funds,
        endowment_plans: existing.endowment_plans + entry.low_risk.endowment_plans,
        fixed_deposits: existing.fixed_deposits + entry.low_risk.fixed_deposits,
        nps: existing.nps + entry.low_risk.nps,
        epf: existing.epf + entry.low_risk.epf,
        ppf: existing.ppf + entry.low_risk.ppf,
        structured_products_debt: existing.structured_products_debt + entry.low_risk.structured_products_debt,
        gold_etfs_funds: existing.gold_etfs_funds + entry.low_risk.gold_etfs_funds
      });
    });
  });
  
  // Convert to chart data and sort by date
  const chartData: ChartDataPoint[] = Array.from(dateMap.entries())
    .map(([dateStr, values]) => ({
      date: new Date(dateStr).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      ...values
    }))
    .sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  
  return {
    chartData,
    riskDistribution,
    totalAssets
  };
}

/**
 * Filter combined portfolio data by time period
 */
export function filterCombinedPortfolioByPeriod(
  profileEntries: Map<string, FinancialEntry[]>,
  period: TimePeriod
): Map<string, FinancialEntry[]> {
  const startDate = getStartDateForPeriod(period);
  const filtered = new Map<string, FinancialEntry[]>();
  
  profileEntries.forEach((entries, profileId) => {
    const filteredEntries = entries.filter(entry => {
      const entryDate = new Date(entry.entry_date);
      return entryDate >= startDate;
    });
    
    if (filteredEntries.length > 0) {
      filtered.set(profileId, filteredEntries);
    }
  });
  
  return filtered;
}
