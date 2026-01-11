import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// High/Medium Risk Asset fields
interface HighMediumRiskAssets {
  direct_equity: number;
  esops: number;
  equity_pms: number;
  ulip: number;
  real_estate: number;
  real_estate_funds: number;
  private_equity: number;
  equity_mutual_funds: number;
  structured_products_equity: number;
}

// Function to calculate total high/medium risk assets
function calculateTotalHighMediumRisk(assets: HighMediumRiskAssets): number {
  return (
    assets.direct_equity +
    assets.esops +
    assets.equity_pms +
    assets.ulip +
    assets.real_estate +
    assets.real_estate_funds +
    assets.private_equity +
    assets.equity_mutual_funds +
    assets.structured_products_equity
  );
}

// Generator for decimal values with 2 decimal places (0 to 1,000,000)
const decimalArbitrary = fc
  .integer({ min: 0, max: 100000000 }) // Max ₹1,000,000.00 in paise
  .map((paise) => paise / 100);

// Generator for HighMediumRiskAssets
const highMediumRiskAssetsArbitrary = fc.record({
  direct_equity: decimalArbitrary,
  esops: decimalArbitrary,
  equity_pms: decimalArbitrary,
  ulip: decimalArbitrary,
  real_estate: decimalArbitrary,
  real_estate_funds: decimalArbitrary,
  private_equity: decimalArbitrary,
  equity_mutual_funds: decimalArbitrary,
  structured_products_equity: decimalArbitrary,
});

describe('Property Test: Total Calculation Accuracy', () => {
  it('should calculate total_high_medium_risk as sum of all high/medium risk asset fields', () => {
    fc.assert(
      fc.property(highMediumRiskAssetsArbitrary, (assets) => {
        // Calculate the total using the function
        const calculatedTotal = calculateTotalHighMediumRisk(assets);

        // Manually calculate the expected total
        const expectedTotal =
          assets.direct_equity +
          assets.esops +
          assets.equity_pms +
          assets.ulip +
          assets.real_estate +
          assets.real_estate_funds +
          assets.private_equity +
          assets.equity_mutual_funds +
          assets.structured_products_equity;

        // Verify they match (with floating point tolerance)
        expect(Math.abs(calculatedTotal - expectedTotal)).toBeLessThan(0.01);
      }),
      { numRuns: 100 }
    );
  });

  it('should handle zero values correctly', () => {
    fc.assert(
      fc.property(highMediumRiskAssetsArbitrary, (assets) => {
        // Set all values to zero
        const zeroAssets: HighMediumRiskAssets = {
          direct_equity: 0,
          esops: 0,
          equity_pms: 0,
          ulip: 0,
          real_estate: 0,
          real_estate_funds: 0,
          private_equity: 0,
          equity_mutual_funds: 0,
          structured_products_equity: 0,
        };

        const total = calculateTotalHighMediumRisk(zeroAssets);
        expect(total).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should handle single non-zero field correctly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'direct_equity',
          'esops',
          'equity_pms',
          'ulip',
          'real_estate',
          'real_estate_funds',
          'private_equity',
          'equity_mutual_funds',
          'structured_products_equity'
        ),
        decimalArbitrary,
        (fieldName, value) => {
          // Create assets with only one field set
          const assets: HighMediumRiskAssets = {
            direct_equity: 0,
            esops: 0,
            equity_pms: 0,
            ulip: 0,
            real_estate: 0,
            real_estate_funds: 0,
            private_equity: 0,
            equity_mutual_funds: 0,
            structured_products_equity: 0,
            [fieldName]: value,
          };

          const total = calculateTotalHighMediumRisk(assets);
          expect(Math.abs(total - value)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain precision with decimal values', () => {
    fc.assert(
      fc.property(highMediumRiskAssetsArbitrary, (assets) => {
        const total = calculateTotalHighMediumRisk(assets);

        // Verify the total has at most 2 decimal places
        const roundedTotal = Math.round(total * 100) / 100;
        expect(Math.abs(total - roundedTotal)).toBeLessThan(0.001);
      }),
      { numRuns: 100 }
    );
  });

  it('should be commutative (order of addition does not matter)', () => {
    fc.assert(
      fc.property(highMediumRiskAssetsArbitrary, (assets) => {
        // Calculate in different orders
        const total1 =
          assets.direct_equity +
          assets.esops +
          assets.equity_pms +
          assets.ulip +
          assets.real_estate +
          assets.real_estate_funds +
          assets.private_equity +
          assets.equity_mutual_funds +
          assets.structured_products_equity;

        const total2 =
          assets.structured_products_equity +
          assets.equity_mutual_funds +
          assets.private_equity +
          assets.real_estate_funds +
          assets.real_estate +
          assets.ulip +
          assets.equity_pms +
          assets.esops +
          assets.direct_equity;

        expect(Math.abs(total1 - total2)).toBeLessThan(0.01);
      }),
      { numRuns: 100 }
    );
  });
});
