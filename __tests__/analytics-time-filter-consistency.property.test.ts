import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  filterEntriesByPeriod, 
  getStartDateForPeriod,
  TimePeriod 
} from '../lib/analytics';
import { FinancialEntry } from '../lib/types';

describe('Property 9: Analytics time filter consistency', () => {
  // Generator for financial entries with random dates
  const financialEntryArbitrary = fc.record({
    id: fc.uuid(),
    profile_id: fc.uuid(),
    entry_date: fc.date({ min: new Date('2020-01-01'), max: new Date('2026-12-31') }),
    high_medium_risk: fc.record({
      direct_equity: fc.double({ min: 0, max: 1000000, noNaN: true }),
      esops: fc.double({ min: 0, max: 1000000, noNaN: true }),
      equity_pms: fc.double({ min: 0, max: 1000000, noNaN: true }),
      ulip: fc.double({ min: 0, max: 1000000, noNaN: true }),
      real_estate: fc.double({ min: 0, max: 1000000, noNaN: true }),
      real_estate_funds: fc.double({ min: 0, max: 1000000, noNaN: true }),
      private_equity: fc.double({ min: 0, max: 1000000, noNaN: true }),
      equity_mutual_funds: fc.double({ min: 0, max: 1000000, noNaN: true }),
      structured_products_equity: fc.double({ min: 0, max: 1000000, noNaN: true })
    }),
    low_risk: fc.record({
      bank_balance: fc.double({ min: 0, max: 1000000, noNaN: true }),
      debt_mutual_funds: fc.double({ min: 0, max: 1000000, noNaN: true }),
      endowment_plans: fc.double({ min: 0, max: 1000000, noNaN: true }),
      fixed_deposits: fc.double({ min: 0, max: 1000000, noNaN: true }),
      nps: fc.double({ min: 0, max: 1000000, noNaN: true }),
      epf: fc.double({ min: 0, max: 1000000, noNaN: true }),
      ppf: fc.double({ min: 0, max: 1000000, noNaN: true }),
      structured_products_debt: fc.double({ min: 0, max: 1000000, noNaN: true }),
      gold_etfs_funds: fc.double({ min: 0, max: 1000000, noNaN: true })
    }),
    total_high_medium_risk: fc.double({ min: 0, max: 9000000, noNaN: true }),
    total_low_risk: fc.double({ min: 0, max: 9000000, noNaN: true }),
    total_assets: fc.double({ min: 0, max: 18000000, noNaN: true }),
    created_at: fc.date(),
    updated_at: fc.date(),
    created_by: fc.uuid()
  });

  const timePeriodArbitrary = fc.constantFrom<TimePeriod>('30days', '3months', '1year');

  it('should only return entries within the specified time period', () => {
    fc.assert(
      fc.property(
        fc.array(financialEntryArbitrary, { minLength: 0, maxLength: 50 }),
        timePeriodArbitrary,
        (entries: FinancialEntry[], period: TimePeriod) => {
          // Filter entries by the time period
          const filteredEntries = filterEntriesByPeriod(entries, period);
          
          // Get the start date for the period
          const startDate = getStartDateForPeriod(period);
          
          // Verify all filtered entries are within the period
          const allWithinPeriod = filteredEntries.every(entry => {
            const entryDate = new Date(entry.entry_date);
            return entryDate >= startDate;
          });
          
          expect(allWithinPeriod).toBe(true);
          
          // Verify no entries before the start date are included
          const noEntriesBeforeStartDate = filteredEntries.every(entry => {
            const entryDate = new Date(entry.entry_date);
            return entryDate >= startDate;
          });
          
          expect(noEntriesBeforeStartDate).toBe(true);
          
          // Verify that entries outside the period are excluded
          const entriesOutsidePeriod = entries.filter(entry => {
            const entryDate = new Date(entry.entry_date);
            return entryDate < startDate;
          });
          
          const noneOutsidePeriodIncluded = entriesOutsidePeriod.every(outsideEntry => {
            return !filteredEntries.some(filteredEntry => filteredEntry.id === outsideEntry.id);
          });
          
          expect(noneOutsidePeriodIncluded).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty entry arrays', () => {
    fc.assert(
      fc.property(
        timePeriodArbitrary,
        (period: TimePeriod) => {
          const filteredEntries = filterEntriesByPeriod([], period);
          expect(filteredEntries).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve entry order when filtering', () => {
    fc.assert(
      fc.property(
        fc.array(financialEntryArbitrary, { minLength: 2, maxLength: 20 }),
        timePeriodArbitrary,
        (entries: FinancialEntry[], period: TimePeriod) => {
          const filteredEntries = filterEntriesByPeriod(entries, period);
          
          // Check that the relative order is preserved
          for (let i = 0; i < filteredEntries.length - 1; i++) {
            const indexInOriginal1 = entries.findIndex(e => e.id === filteredEntries[i].id);
            const indexInOriginal2 = entries.findIndex(e => e.id === filteredEntries[i + 1].id);
            
            expect(indexInOriginal1).toBeLessThan(indexInOriginal2);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
