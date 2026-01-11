'use client';

import { useState, useEffect } from 'react';
import { RiskDistributionChart } from './risk-distribution-chart';
import { AssetTrendChart } from './asset-trend-chart';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { ChartDataPoint, RiskDistribution } from '@/lib/types';
import { TimePeriod } from '@/lib/analytics';
import { getSession } from '@/lib/supabase';

interface Profile {
  id: string;
  name: string;
}

interface PortfolioData {
  chartData: ChartDataPoint[];
  riskDistribution: RiskDistribution[];
  totalAssets: number;
  period: TimePeriod;
  profileCount: number;
  message?: string;
}

export function Portfolio() {
  const [period, setPeriod] = useState<TimePeriod>('1year');
  const [data, setData] = useState<PortfolioData | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const { session } = await getSession();
        if (!session) return;

        const response = await fetch('/api/profiles', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        
        if (response.ok) {
          const { profiles } = await response.json();
          setProfiles(profiles);
          setSelectedProfiles(new Set(profiles.map((p: Profile) => p.id)));
        }
      } catch (err) {
        console.error('Error fetching profiles:', err);
      }
    };

    fetchProfiles();
  }, []);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const { session } = await getSession();
        if (!session) throw new Error('No active session');

        const profileIds = Array.from(selectedProfiles).join(',');
        const url = `/api/analytics/combined?period=${period}${profileIds ? `&profileIds=${profileIds}` : ''}`;
        
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        
        if (!response.ok) throw new Error('Failed to fetch analytics data');
        
        setData(await response.json());
      } catch (err) {
        console.error('Error fetching analytics:', err);
        setError('Failed to load portfolio data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (selectedProfiles.size > 0) {
      fetchAnalytics();
    }
  }, [period, selectedProfiles]);

  const toggleProfile = (profileId: string) => {
    setSelectedProfiles(prev => {
      const next = new Set(prev);
      next.has(profileId) ? next.delete(profileId) : next.add(profileId);
      return next;
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Portfolio</h2>
        <div className="flex h-[400px] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading portfolio data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Portfolio</h2>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  const hasData = data && data.chartData.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Portfolio</h2>
          {data && data.profileCount > 0 && (
            <p className="text-sm text-gray-600">
              {selectedProfiles.size} of {profiles.length} profile{profiles.length > 1 ? 's' : ''} selected
            </p>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button variant={period === '30days' ? 'default' : 'outline'} size="sm" onClick={() => setPeriod('30days')}>30 Days</Button>
          <Button variant={period === '3months' ? 'default' : 'outline'} size="sm" onClick={() => setPeriod('3months')}>3 Months</Button>
          <Button variant={period === '1year' ? 'default' : 'outline'} size="sm" onClick={() => setPeriod('1year')}>1 Year</Button>
        </div>
      </div>

      {profiles.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Profiles</CardTitle>
            <CardDescription>Choose which profiles to include</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {profiles.map(profile => (
                <div key={profile.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={profile.id}
                    checked={selectedProfiles.has(profile.id)}
                    onCheckedChange={() => toggleProfile(profile.id)}
                  />
                  <label htmlFor={profile.id} className="text-sm font-medium cursor-pointer">
                    {profile.name}
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {hasData && data && (
        <Card>
          <CardHeader>
            <CardTitle>Total Portfolio Value</CardTitle>
            <CardDescription>Combined value across selected profiles</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-gray-900">{formatCurrency(data.totalAssets)}</p>
          </CardContent>
        </Card>
      )}

      {data?.message && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">{data.message}</p>
        </div>
      )}

      {hasData && data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <RiskDistributionChart 
            data={data.riskDistribution}
            title="Risk Distribution"
            description="Asset allocation across selected profiles"
          />
          <AssetTrendChart 
            data={data.chartData}
            title="Asset Trends"
            description={`Portfolio growth over ${period === '30days' ? '30 days' : period === '3months' ? '3 months' : '1 year'}`}
            showRiskBreakdown={true}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-gray-600">No financial data available.</p>
          <p className="mt-2 text-sm text-gray-500">
            Link profiles and add financial entries to see your portfolio.
          </p>
        </div>
      )}
    </div>
  );
}
