import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Generator for decimal values with 2 decimal places (0 to 1,000,000)
const decimalArbitrary = fc
  .integer({ min: 0, max: 100000000 }) // Max ₹1,000,000.00 in paise
  .map((paise) => paise / 100);

// Function to calculate total assets
function calculateTotalAssets(
  totalHighMediumRisk: number,
  totalLowRisk: number
): number {
  return totalHighMediumRisk + totalLowRisk;
}

describe('Property Test: Total Assets Calculation', () => {
  it('should calculate total_assets as sum of total_high_medium_risk and total_low_risk', () => {
    fc.assert(
      fc.property(
        decimalArbitrary,
        decimalArbitrary,
        (totalHighMediumRisk, totalLowRisk) => {
          // Calculate total assets
          const totalAssets = calculateTotalAssets(totalHighMediumRisk, totalLowRisk);

          // Verify it equals the sum
          const expectedTotal = totalHighMediumRisk + totalLowRisk;
          expect(Math.abs(totalAssets - expectedTotal)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle zero values correctly', () => {
    fc.assert(
      fc.property(fc.constant(0), fc.constant(0), (totalHighMediumRisk, totalLowRisk) => {
        const totalAssets = calculateTotalAssets(totalHighMediumRisk, totalLowRisk);
        expect(totalAssets).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should handle when only high/medium risk has value', () => {
    fc.assert(
      fc.property(decimalArbitrary, (totalHighMediumRisk) => {
        const totalAssets = calculateTotalAssets(totalHighMediumRisk, 0);
        expect(Math.abs(totalAssets - totalHighMediumRisk)).toBeLessThan(0.01);
      }),
      { numRuns: 100 }
    );
  });

  it('should handle when only low risk has value', () => {
    fc.assert(
      fc.property(decimalArbitrary, (totalLowRisk) => {
        const totalAssets = calculateTotalAssets(0, totalLowRisk);
        expect(Math.abs(totalAssets - totalLowRisk)).toBeLessThan(0.01);
      }),
      { numRuns: 100 }
    );
  });

  it('should be commutative (order does not matter)', () => {
    fc.assert(
      fc.property(
        decimalArbitrary,
        decimalArbitrary,
        (totalHighMediumRisk, totalLowRisk) => {
          const total1 = totalHighMediumRisk + totalLowRisk;
          const total2 = totalLowRisk + totalHighMediumRisk;
          expect(Math.abs(total1 - total2)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain precision with decimal values', () => {
    fc.assert(
      fc.property(
        decimalArbitrary,
        decimalArbitrary,
        (totalHighMediumRisk, totalLowRisk) => {
          const totalAssets = calculateTotalAssets(totalHighMediumRisk, totalLowRisk);

          // Verify the total has at most 2 decimal places
          const roundedTotal = Math.round(totalAssets * 100) / 100;
          expect(Math.abs(totalAssets - roundedTotal)).toBeLessThan(0.001);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be greater than or equal to each component', () => {
    fc.assert(
      fc.property(
        decimalArbitrary,
        decimalArbitrary,
        (totalHighMediumRisk, totalLowRisk) => {
          const totalAssets = calculateTotalAssets(totalHighMediumRisk, totalLowRisk);

          // Total should be >= each component
          expect(totalAssets).toBeGreaterThanOrEqual(totalHighMediumRisk - 0.01);
          expect(totalAssets).toBeGreaterThanOrEqual(totalLowRisk - 0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should equal the larger component when the other is zero', () => {
    fc.assert(
      fc.property(decimalArbitrary, (value) => {
        // When high/medium risk is value and low risk is 0
        const total1 = calculateTotalAssets(value, 0);
        expect(Math.abs(total1 - value)).toBeLessThan(0.01);

        // When low risk is value and high/medium risk is 0
        const total2 = calculateTotalAssets(0, value);
        expect(Math.abs(total2 - value)).toBeLessThan(0.01);
      }),
      { numRuns: 100 }
    );
  });
});
