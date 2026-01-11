import { FinancialEntry, ChartDataPoint, RiskDistribution } from './types';

export type TimePeriod = '30days' | '3months' | '1year';

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
    low_risk: entry.total_low_risk
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
  const dateMap = new Map<string, { high_medium_risk: number; low_risk: number; total_assets: number }>();
  
  profileEntries.forEach(entries => {
    entries.forEach(entry => {
      const date = new Date(entry.entry_date);
      // Skip entries with invalid dates
      if (isNaN(date.getTime())) {
        return;
      }
      
      const dateKey = date.toISOString().split('T')[0];
      const existing = dateMap.get(dateKey) || { high_medium_risk: 0, low_risk: 0, total_assets: 0 };
      
      dateMap.set(dateKey, {
        high_medium_risk: existing.high_medium_risk + entry.total_high_medium_risk,
        low_risk: existing.low_risk + entry.total_low_risk,
        total_assets: existing.total_assets + entry.total_assets
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
