import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { aggregateCombinedPortfolio } from '../lib/analytics';
import { FinancialEntry } from '../lib/types';

describe('Property 10: Portfolio aggregation', () => {
  // Generator for financial entries with random dates and values
  // Ensure total_assets = total_high_medium_risk + total_low_risk for consistency
  const financialEntryArbitrary = fc.record({
    id: fc.uuid(),
    profile_id: fc.uuid(),
    entry_date: fc.date({ min: new Date('2020-01-01'), max: new Date('2026-12-31') }),
    high_medium_risk: fc.record({
      direct_equity: fc.double({ min: 0, max: 100000, noNaN: true }),
      esops: fc.double({ min: 0, max: 100000, noNaN: true }),
      equity_pms: fc.double({ min: 0, max: 100000, noNaN: true }),
      ulip: fc.double({ min: 0, max: 100000, noNaN: true }),
      real_estate: fc.double({ min: 0, max: 100000, noNaN: true }),
      real_estate_funds: fc.double({ min: 0, max: 100000, noNaN: true }),
      private_equity: fc.double({ min: 0, max: 100000, noNaN: true }),
      equity_mutual_funds: fc.double({ min: 0, max: 100000, noNaN: true }),
      structured_products_equity: fc.double({ min: 0, max: 100000, noNaN: true })
    }),
    low_risk: fc.record({
      bank_balance: fc.double({ min: 0, max: 100000, noNaN: true }),
      debt_mutual_funds: fc.double({ min: 0, max: 100000, noNaN: true }),
      endowment_plans: fc.double({ min: 0, max: 100000, noNaN: true }),
      fixed_deposits: fc.double({ min: 0, max: 100000, noNaN: true }),
      nps: fc.double({ min: 0, max: 100000, noNaN: true }),
      epf: fc.double({ min: 0, max: 100000, noNaN: true }),
      ppf: fc.double({ min: 0, max: 100000, noNaN: true }),
      structured_products_debt: fc.double({ min: 0, max: 100000, noNaN: true }),
      gold_etfs_funds: fc.double({ min: 0, max: 100000, noNaN: true })
    }),
    total_high_medium_risk: fc.double({ min: 0, max: 900000, noNaN: true }),
    total_low_risk: fc.double({ min: 0, max: 900000, noNaN: true }),
    created_at: fc.date(),
    updated_at: fc.date(),
    created_by: fc.uuid()
  }).map(entry => ({
    ...entry,
    // Ensure total_assets equals sum of risk components for consistency
    total_assets: entry.total_high_medium_risk + entry.total_low_risk
  }));

  // Generator for a map of profile entries
  const profileEntriesMapArbitrary = fc.dictionary(
    fc.uuid(), // profile IDs
    fc.array(financialEntryArbitrary, { minLength: 1, maxLength: 10 }),
    { minKeys: 1, maxKeys: 5 }
  ).map(dict => {
    const map = new Map<string, FinancialEntry[]>();
    Object.entries(dict).forEach(([key, value]) => {
      map.set(key, value as FinancialEntry[]);
    });
    return map;
  });

  it('should aggregate total assets correctly from most recent entries', () => {
    fc.assert(
      fc.property(
        profileEntriesMapArbitrary,
        (profileEntries: Map<string, FinancialEntry[]>) => {
          const result = aggregateCombinedPortfolio(profileEntries);
          
          // Calculate expected total from most recent entry of each profile
          let expectedTotal = 0;
          profileEntries.forEach(entries => {
            if (entries.length > 0) {
              // Filter out entries with invalid dates
              const validEntries = entries.filter(entry => {
                const date = new Date(entry.entry_date);
                return !isNaN(date.getTime());
              });
              
              if (validEntries.length > 0) {
                const latestEntry = validEntries.reduce((latest, entry) => {
                  return new Date(entry.entry_date) > new Date(latest.entry_date) ? entry : latest;
                });
                expectedTotal += latestEntry.total_assets;
              }
            }
          });
          
          // Allow for small floating point differences
          expect(Math.abs(result.totalAssets - expectedTotal)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should aggregate risk distribution correctly from most recent entries', () => {
    fc.assert(
      fc.property(
        profileEntriesMapArbitrary,
        (profileEntries: Map<string, FinancialEntry[]>) => {
          const result = aggregateCombinedPortfolio(profileEntries);
          
          // Calculate expected totals from most recent entry of each profile
          let expectedHighMediumRisk = 0;
          let expectedLowRisk = 0;
          
          profileEntries.forEach(entries => {
            if (entries.length > 0) {
              // Filter out entries with invalid dates
              const validEntries = entries.filter(entry => {
                const date = new Date(entry.entry_date);
                return !isNaN(date.getTime());
              });
              
              if (validEntries.length > 0) {
                const latestEntry = validEntries.reduce((latest, entry) => {
                  return new Date(entry.entry_date) > new Date(latest.entry_date) ? entry : latest;
                });
                expectedHighMediumRisk += latestEntry.total_high_medium_risk;
                expectedLowRisk += latestEntry.total_low_risk;
              }
            }
          });
          
          const MIN_TOTAL_ASSETS = 0.01;
          const riskSum = expectedHighMediumRisk + expectedLowRisk;
          if (result.totalAssets >= MIN_TOTAL_ASSETS && Math.abs(result.totalAssets - riskSum) < 0.01) {
            // Verify risk distribution values
            const highMediumRiskItem = result.riskDistribution.find(
              item => item.name === 'High/Medium Risk'
            );
            const lowRiskItem = result.riskDistribution.find(
              item => item.name === 'Low Risk'
            );
            
            expect(highMediumRiskItem).toBeDefined();
            expect(lowRiskItem).toBeDefined();
            
            if (highMediumRiskItem && lowRiskItem) {
              // Allow for small floating point differences
              expect(Math.abs(highMediumRiskItem.value - expectedHighMediumRisk)).toBeLessThan(0.01);
              expect(Math.abs(lowRiskItem.value - expectedLowRisk)).toBeLessThan(0.01);
              
              // Verify percentages sum to approximately 100 (with tolerance for floating point)
              const totalPercentage = highMediumRiskItem.percentage + lowRiskItem.percentage;
              expect(Math.abs(totalPercentage - 100)).toBeLessThan(0.1);
            }
          } else {
            // If total assets is below threshold, risk distribution should be empty
            expect(result.riskDistribution).toEqual([]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty profile entries map', () => {
    const emptyMap = new Map<string, FinancialEntry[]>();
    const result = aggregateCombinedPortfolio(emptyMap);
    
    expect(result.totalAssets).toBe(0);
    expect(result.riskDistribution).toEqual([]);
    expect(result.chartData).toEqual([]);
  });

  it('should handle profiles with no entries', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.uuid(),
          fc.constant([]),
          { minKeys: 1, maxKeys: 3 }
        ).map(dict => {
          const map = new Map<string, FinancialEntry[]>();
          Object.entries(dict).forEach(([key, value]) => {
            map.set(key, value as FinancialEntry[]);
          });
          return map;
        }),
        (profileEntries: Map<string, FinancialEntry[]>) => {
          const result = aggregateCombinedPortfolio(profileEntries);
          
          expect(result.totalAssets).toBe(0);
          expect(result.riskDistribution).toEqual([]);
          expect(result.chartData).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should aggregate chart data correctly across profiles', () => {
    fc.assert(
      fc.property(
        profileEntriesMapArbitrary,
        (profileEntries: Map<string, FinancialEntry[]>) => {
          const result = aggregateCombinedPortfolio(profileEntries);
          
          // Verify chart data is sorted by date
          for (let i = 0; i < result.chartData.length - 1; i++) {
            const date1 = new Date(result.chartData[i].date);
            const date2 = new Date(result.chartData[i + 1].date);
            expect(date1.getTime()).toBeLessThanOrEqual(date2.getTime());
          }
          
          // Verify each chart data point has valid values
          result.chartData.forEach(point => {
            expect(point.total_assets).toBeGreaterThanOrEqual(0);
            expect(point.high_medium_risk).toBeGreaterThanOrEqual(0);
            expect(point.low_risk).toBeGreaterThanOrEqual(0);
            
            // Total should equal sum of risk categories (with floating point tolerance)
            // Note: Test data may have inconsistencies, so we use a lenient tolerance
            const sum = point.high_medium_risk + point.low_risk;
            expect(Math.abs(point.total_assets - sum)).toBeLessThan(0.1);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
