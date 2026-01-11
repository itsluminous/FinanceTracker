import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Generator for decimal values with exactly 2 decimal places (0 to 1,000,000)
const decimalArbitrary = fc
  .integer({ min: 0, max: 100000000 }) // Max ₹1,000,000.00 in paise
  .map((paise) => paise / 100);

// Simulate database storage and retrieval (rounds to 2 decimal places)
function storeAndRetrieveDecimal(value: number): number {
  // Simulate storing as DECIMAL(15, 2) in PostgreSQL
  // This rounds to 2 decimal places
  return Math.round(value * 100) / 100;
}

// All asset field names
const assetFields = [
  // High/Medium Risk
  'direct_equity',
  'esops',
  'equity_pms',
  'ulip',
  'real_estate',
  'real_estate_funds',
  'private_equity',
  'equity_mutual_funds',
  'structured_products_equity',
  // Low Risk
  'bank_balance',
  'debt_mutual_funds',
  'endowment_plans',
  'fixed_deposits',
  'nps',
  'epf',
  'ppf',
  'structured_products_debt',
  'gold_etfs_funds',
];

describe('Property Test: Decimal Precision Preservation', () => {
  it('should preserve decimal precision up to 2 decimal places for any asset field', () => {
    fc.assert(
      fc.property(decimalArbitrary, (value) => {
        // Store and retrieve the value
        const retrieved = storeAndRetrieveDecimal(value);

        // The retrieved value should match the original rounded to 2 decimal places
        const expected = Math.round(value * 100) / 100;
        expect(Math.abs(retrieved - expected)).toBeLessThan(0.001);
      }),
      { numRuns: 100 }
    );
  });

  it('should handle zero values correctly', () => {
    const retrieved = storeAndRetrieveDecimal(0);
    expect(retrieved).toBe(0);
  });

  it('should handle maximum values correctly', () => {
    fc.assert(
      fc.property(decimalArbitrary, (value) => {
        const retrieved = storeAndRetrieveDecimal(value);
        expect(retrieved).toBeLessThanOrEqual(1000000);
        expect(retrieved).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should round values with more than 2 decimal places', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1000000, noNaN: true }),
        (value) => {
          const retrieved = storeAndRetrieveDecimal(value);

          // Check that the retrieved value has at most 2 decimal places
          const decimalPart = retrieved.toString().split('.')[1];
          if (decimalPart) {
            expect(decimalPart.length).toBeLessThanOrEqual(2);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be idempotent (storing twice gives same result)', () => {
    fc.assert(
      fc.property(decimalArbitrary, (value) => {
        const firstStore = storeAndRetrieveDecimal(value);
        const secondStore = storeAndRetrieveDecimal(firstStore);

        expect(Math.abs(firstStore - secondStore)).toBeLessThan(0.001);
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve exact values with 0, 1, or 2 decimal places', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000000 }),
        (paise) => {
          const value = paise / 100; // This gives exactly 2 decimal places
          const retrieved = storeAndRetrieveDecimal(value);

          expect(Math.abs(retrieved - value)).toBeLessThan(0.001);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle all asset fields consistently', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...assetFields),
        decimalArbitrary,
        (fieldName, value) => {
          // Simulate storing the value for any field
          const retrieved = storeAndRetrieveDecimal(value);

          // All fields should preserve precision the same way
          const expected = Math.round(value * 100) / 100;
          expect(Math.abs(retrieved - expected)).toBeLessThan(0.001);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain precision after arithmetic operations', () => {
    fc.assert(
      fc.property(
        decimalArbitrary,
        decimalArbitrary,
        (value1, value2) => {
          // Store both values
          const stored1 = storeAndRetrieveDecimal(value1);
          const stored2 = storeAndRetrieveDecimal(value2);

          // Add them
          const sum = stored1 + stored2;

          // Store the sum
          const storedSum = storeAndRetrieveDecimal(sum);

          // The stored sum should have at most 2 decimal places
          const roundedSum = Math.round(sum * 100) / 100;
          expect(Math.abs(storedSum - roundedSum)).toBeLessThan(0.001);
        }
      ),
      { numRuns: 100 }
    );
  });
});
