import { describe, it, expect, beforeEach } from 'vitest';
import {
  getStartDateForPeriod,
  filterEntriesByPeriod,
  transformToChartData,
  calculateRiskDistribution,
  aggregateCombinedPortfolio,
  filterCombinedPortfolioByPeriod
} from '../lib/analytics';
import { FinancialEntry } from '../lib/types';

describe('Analytics Functions', () => {
  let sampleEntries: FinancialEntry[];

  beforeEach(() => {
    const now = new Date();
    sampleEntries = [
      {
        id: '1',
        profile_id: 'profile-1',
        entry_date: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        high_medium_risk: {
          direct_equity: 100000,
          esops: 50000,
          equity_pms: 0,
          ulip: 0,
          real_estate: 0,
          real_estate_funds: 0,
          private_equity: 0,
          equity_mutual_funds: 0,
          structured_products_equity: 0
        },
        low_risk: {
          bank_balance: 50000,
          debt_mutual_funds: 0,
          endowment_plans: 0,
          fixed_deposits: 100000,
          nps: 0,
          epf: 0,
          ppf: 0,
          structured_products_debt: 0,
          gold_etfs_funds: 0
        },
        total_high_medium_risk: 150000,
        total_low_risk: 150000,
        total_assets: 300000,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: 'user-1'
      },
      {
        id: '2',
        profile_id: 'profile-1',
        entry_date: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        high_medium_risk: {
          direct_equity: 80000,
          esops: 40000,
          equity_pms: 0,
          ulip: 0,
          real_estate: 0,
          real_estate_funds: 0,
          private_equity: 0,
          equity_mutual_funds: 0,
          structured_products_equity: 0
        },
        low_risk: {
          bank_balance: 40000,
          debt_mutual_funds: 0,
          endowment_plans: 0,
          fixed_deposits: 80000,
          nps: 0,
          epf: 0,
          ppf: 0,
          structured_products_debt: 0,
          gold_etfs_funds: 0
        },
        total_high_medium_risk: 120000,
        total_low_risk: 120000,
        total_assets: 240000,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: 'user-1'
      },
      {
        id: '3',
        profile_id: 'profile-1',
        entry_date: new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000), // 200 days ago
        high_medium_risk: {
          direct_equity: 60000,
          esops: 30000,
          equity_pms: 0,
          ulip: 0,
          real_estate: 0,
          real_estate_funds: 0,
          private_equity: 0,
          equity_mutual_funds: 0,
          structured_products_equity: 0
        },
        low_risk: {
          bank_balance: 30000,
          debt_mutual_funds: 0,
          endowment_plans: 0,
          fixed_deposits: 60000,
          nps: 0,
          epf: 0,
          ppf: 0,
          structured_products_debt: 0,
          gold_etfs_funds: 0
        },
        total_high_medium_risk: 90000,
        total_low_risk: 90000,
        total_assets: 180000,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: 'user-1'
      }
    ];
  });

  describe('Time Period Filtering', () => {
    it('should calculate correct start date for 30 days period', () => {
      const startDate = getStartDateForPeriod('30days');
      const now = new Date();
      const expectedDate = new Date(now);
      expectedDate.setDate(now.getDate() - 30);
      
      // Allow 1 second difference for test execution time
      expect(Math.abs(startDate.getTime() - expectedDate.getTime())).toBeLessThan(1000);
    });

    it('should calculate correct start date for 3 months period', () => {
      const startDate = getStartDateForPeriod('3months');
      const now = new Date();
      const expectedDate = new Date(now);
      expectedDate.setMonth(now.getMonth() - 3);
      
      expect(Math.abs(startDate.getTime() - expectedDate.getTime())).toBeLessThan(1000);
    });

    it('should calculate correct start date for 1 year period', () => {
      const startDate = getStartDateForPeriod('1year');
      const now = new Date();
      const expectedDate = new Date(now);
      expectedDate.setFullYear(now.getFullYear() - 1);
      
      expect(Math.abs(startDate.getTime() - expectedDate.getTime())).toBeLessThan(1000);
    });

    it('should filter entries for 30 days period', () => {
      const filtered = filterEntriesByPeriod(sampleEntries, '30days');
      expect(filtered.length).toBe(1); // Only the 10-day-old entry
      expect(filtered[0].id).toBe('1');
    });

    it('should filter entries for 3 months period', () => {
      const filtered = filterEntriesByPeriod(sampleEntries, '3months');
      expect(filtered.length).toBe(2); // 10-day and 60-day old entries
    });

    it('should filter entries for 1 year period', () => {
      const filtered = filterEntriesByPeriod(sampleEntries, '1year');
      expect(filtered.length).toBe(3); // All entries
    });

    it('should return empty array when no entries match period', () => {
      const oldEntries: FinancialEntry[] = [{
        ...sampleEntries[0],
        entry_date: new Date('2020-01-01') // Very old entry
      }];
      
      const filtered = filterEntriesByPeriod(oldEntries, '30days');
      expect(filtered.length).toBe(0);
    });
  });

  describe('Chart Data Transformation', () => {
    it('should transform entries to chart data points', () => {
      const chartData = transformToChartData(sampleEntries);
      
      expect(chartData.length).toBe(3);
      expect(chartData[0].total_assets).toBe(180000); // Oldest entry first
      expect(chartData[2].total_assets).toBe(300000); // Newest entry last
    });

    it('should format dates correctly', () => {
      const chartData = transformToChartData(sampleEntries);
      
      chartData.forEach(point => {
        // Date format is "DD MMM YYYY" (e.g., "25 Jun 2025")
        expect(point.date).toMatch(/\d{1,2} \w+ \d{4}/);
      });
    });

    it('should handle empty entries array', () => {
      const chartData = transformToChartData([]);
      expect(chartData).toEqual([]);
    });

    it('should sort entries by date', () => {
      const unsortedEntries = [sampleEntries[2], sampleEntries[0], sampleEntries[1]];
      const chartData = transformToChartData(unsortedEntries);
      
      // Verify chronological order
      for (let i = 0; i < chartData.length - 1; i++) {
        const date1 = new Date(chartData[i].date);
        const date2 = new Date(chartData[i + 1].date);
        expect(date1.getTime()).toBeLessThanOrEqual(date2.getTime());
      }
    });
  });

  describe('Risk Distribution Calculation', () => {
    it('should calculate risk distribution from most recent entry', () => {
      const distribution = calculateRiskDistribution(sampleEntries);
      
      expect(distribution.length).toBe(2);
      
      const highMediumRisk = distribution.find(d => d.name === 'High/Medium Risk');
      const lowRisk = distribution.find(d => d.name === 'Low Risk');
      
      expect(highMediumRisk).toBeDefined();
      expect(lowRisk).toBeDefined();
      expect(highMediumRisk?.value).toBe(150000);
      expect(lowRisk?.value).toBe(150000);
      expect(highMediumRisk?.percentage).toBe(50);
      expect(lowRisk?.percentage).toBe(50);
    });

    it('should return empty array for empty entries', () => {
      const distribution = calculateRiskDistribution([]);
      expect(distribution).toEqual([]);
    });

    it('should return empty array when total assets is zero', () => {
      const zeroEntry: FinancialEntry = {
        ...sampleEntries[0],
        total_high_medium_risk: 0,
        total_low_risk: 0,
        total_assets: 0
      };
      
      const distribution = calculateRiskDistribution([zeroEntry]);
      expect(distribution).toEqual([]);
    });

    it('should calculate correct percentages for unequal distribution', () => {
      const unequalEntry: FinancialEntry = {
        ...sampleEntries[0],
        total_high_medium_risk: 300000,
        total_low_risk: 100000,
        total_assets: 400000
      };
      
      const distribution = calculateRiskDistribution([unequalEntry]);
      
      const highMediumRisk = distribution.find(d => d.name === 'High/Medium Risk');
      const lowRisk = distribution.find(d => d.name === 'Low Risk');
      
      expect(highMediumRisk?.percentage).toBe(75);
      expect(lowRisk?.percentage).toBe(25);
    });
  });

  describe('Combined Portfolio Aggregation', () => {
    it('should aggregate data from multiple profiles', () => {
      const profileEntries = new Map<string, FinancialEntry[]>();
      profileEntries.set('profile-1', [sampleEntries[0]]);
      profileEntries.set('profile-2', [sampleEntries[1]]);
      
      const result = aggregateCombinedPortfolio(profileEntries);
      
      expect(result.totalAssets).toBe(540000); // 300000 + 240000
      expect(result.riskDistribution.length).toBe(2);
      expect(result.chartData.length).toBeGreaterThan(0);
    });

    it('should handle empty profile entries map', () => {
      const emptyMap = new Map<string, FinancialEntry[]>();
      const result = aggregateCombinedPortfolio(emptyMap);
      
      expect(result.totalAssets).toBe(0);
      expect(result.riskDistribution).toEqual([]);
      expect(result.chartData).toEqual([]);
    });

    it('should aggregate chart data by date', () => {
      const now = new Date();
      const sameDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      
      const entry1: FinancialEntry = {
        ...sampleEntries[0],
        entry_date: sameDate,
        total_assets: 100000
      };
      
      const entry2: FinancialEntry = {
        ...sampleEntries[0],
        id: '2',
        profile_id: 'profile-2',
        entry_date: sameDate,
        total_assets: 200000
      };
      
      const profileEntries = new Map<string, FinancialEntry[]>();
      profileEntries.set('profile-1', [entry1]);
      profileEntries.set('profile-2', [entry2]);
      
      const result = aggregateCombinedPortfolio(profileEntries);
      
      // Should have one chart data point with combined values
      expect(result.chartData.length).toBe(1);
      expect(result.chartData[0].total_assets).toBe(300000);
    });
  });

  describe('Combined Portfolio Time Filtering', () => {
    it('should filter combined portfolio by time period', () => {
      const profileEntries = new Map<string, FinancialEntry[]>();
      profileEntries.set('profile-1', sampleEntries);
      
      const filtered = filterCombinedPortfolioByPeriod(profileEntries, '30days');
      
      expect(filtered.size).toBe(1);
      expect(filtered.get('profile-1')?.length).toBe(1);
    });

    it('should exclude profiles with no entries in period', () => {
      const oldEntries: FinancialEntry[] = [{
        ...sampleEntries[0],
        entry_date: new Date('2020-01-01')
      }];
      
      const profileEntries = new Map<string, FinancialEntry[]>();
      profileEntries.set('profile-1', oldEntries);
      
      const filtered = filterCombinedPortfolioByPeriod(profileEntries, '30days');
      
      expect(filtered.size).toBe(0);
    });
  });

  describe('Insufficient Data Handling', () => {
    it('should handle single entry gracefully', () => {
      const singleEntry = [sampleEntries[0]];
      
      const chartData = transformToChartData(singleEntry);
      const distribution = calculateRiskDistribution(singleEntry);
      
      expect(chartData.length).toBe(1);
      expect(distribution.length).toBe(2);
    });

    it('should handle entries with zero values', () => {
      const zeroEntry: FinancialEntry = {
        ...sampleEntries[0],
        high_medium_risk: {
          direct_equity: 0,
          esops: 0,
          equity_pms: 0,
          ulip: 0,
          real_estate: 0,
          real_estate_funds: 0,
          private_equity: 0,
          equity_mutual_funds: 0,
          structured_products_equity: 0
        },
        low_risk: {
          bank_balance: 0,
          debt_mutual_funds: 0,
          endowment_plans: 0,
          fixed_deposits: 0,
          nps: 0,
          epf: 0,
          ppf: 0,
          structured_products_debt: 0,
          gold_etfs_funds: 0
        },
        total_high_medium_risk: 0,
        total_low_risk: 0,
        total_assets: 0
      };
      
      const chartData = transformToChartData([zeroEntry]);
      const distribution = calculateRiskDistribution([zeroEntry]);
      
      expect(chartData.length).toBe(1);
      expect(chartData[0].total_assets).toBe(0);
      expect(distribution).toEqual([]);
    });
  });
});
