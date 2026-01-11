'use client';

import dynamic from 'next/dynamic';
import { ChartSkeleton } from './loading-skeletons';

// Lazy load chart components with loading fallback
export const LazyRiskDistributionChart = dynamic(
  () => import('./risk-distribution-chart').then(mod => ({ default: mod.RiskDistributionChart })),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);

export const LazyAssetTrendChart = dynamic(
  () => import('./asset-trend-chart').then(mod => ({ default: mod.AssetTrendChart })),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);
