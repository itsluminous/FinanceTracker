'use client';

import { useState, useEffect } from 'react';
import { RiskDistributionChart } from './risk-distribution-chart';
import { AssetTrendChart } from './asset-trend-chart';
import { Button } from './ui/button';
import { ChartDataPoint, RiskDistribution } from '@/lib/types';
import { TimePeriod } from '@/lib/analytics';

interface ProfileAnalyticsProps {
  profileId: string;
  profileName: string;
}

interface AnalyticsData {
  chartData: ChartDataPoint[];
  riskDistribution: RiskDistribution[];
  period: TimePeriod;
  message?: string;
}

export function ProfileAnalytics({ profileId, profileName }: ProfileAnalyticsProps) {
  const [period, setPeriod] = useState<TimePeriod>('1year');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/profiles/${profileId}/analytics?period=${period}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch analytics data');
        }
        
        const analyticsData = await response.json();
        setData(analyticsData);
      } catch (err) {
        console.error('Error fetching analytics:', err);
        setError('Failed to load analytics data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [profileId, period]);

  const handlePeriodChange = (newPeriod: TimePeriod) => {
    setPeriod(newPeriod);
  };

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Analytics - {profileName}</h2>
        </div>
        <div className="flex h-[300px] sm:h-[400px] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
            <p className="mt-4 text-sm sm:text-base text-gray-600">Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Analytics - {profileName}</h2>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  const hasData = data && data.chartData.length > 0;
  const insufficientData = data?.message;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with time period filters */}
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Analytics - {profileName}</h2>
        
        {/* Mobile: Full width buttons, Desktop: Compact buttons */}
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            variant={period === '30days' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePeriodChange('30days')}
            className="w-full sm:w-auto"
          >
            30 Days
          </Button>
          <Button
            variant={period === '3months' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePeriodChange('3months')}
            className="w-full sm:w-auto"
          >
            3 Months
          </Button>
          <Button
            variant={period === '1year' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePeriodChange('1year')}
            className="w-full sm:w-auto"
          >
            1 Year
          </Button>
        </div>
      </div>

      {/* Insufficient data message */}
      {insufficientData && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-yellow-800">{insufficientData}</p>
        </div>
      )}

      {/* Charts - Mobile: Stacked, Tablet+: Side by side */}
      {hasData ? (
        <div className="space-y-6 sm:space-y-0 sm:grid sm:grid-cols-1 md:grid-cols-2 sm:gap-6">
          {/* Risk Distribution Chart */}
          <div className="w-full">
            <RiskDistributionChart 
              data={data.riskDistribution}
              title="Risk Distribution"
              description="Current asset allocation by risk category"
            />
          </div>
          
          {/* Asset Trend Chart */}
          <div className="w-full">
            <AssetTrendChart 
              data={data.chartData}
              title="Asset Trends"
              description={`Total assets over ${period === '30days' ? '30 days' : period === '3months' ? '3 months' : '1 year'}`}
              showRiskBreakdown={true}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 sm:p-8 text-center">
          <p className="text-sm sm:text-base text-gray-600">No financial data available for this profile.</p>
          <p className="mt-2 text-xs sm:text-sm text-gray-500">
            Add financial entries to see analytics and trends.
          </p>
        </div>
      )}
    </div>
  );
}
