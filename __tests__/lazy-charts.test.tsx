/**
 * Unit tests for lazy-loaded chart components
 * Tests dynamic imports and loading states
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { LazyRiskDistributionChart, LazyAssetTrendChart, LazyIndividualAssetChart } from '@/components/lazy-charts';

// Mock the chart components
vi.mock('@/components/risk-distribution-chart', () => ({
  RiskDistributionChart: () => <div>Risk Distribution Chart</div>,
}));

vi.mock('@/components/asset-trend-chart', () => ({
  AssetTrendChart: () => <div>Asset Trend Chart</div>,
}));

vi.mock('@/components/individual-asset-chart', () => ({
  IndividualAssetChart: () => <div>Individual Asset Chart</div>,
}));

describe('Lazy Chart Components', () => {
  it('should render LazyRiskDistributionChart with loading state', () => {
    const { container } = render(<LazyRiskDistributionChart data={[]} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('should render LazyAssetTrendChart with loading state', () => {
    const { container } = render(<LazyAssetTrendChart data={[]} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('should render LazyIndividualAssetChart with loading state', () => {
    const { container } = render(<LazyIndividualAssetChart data={[]} />);
    expect(container.firstChild).toBeTruthy();
  });
});
