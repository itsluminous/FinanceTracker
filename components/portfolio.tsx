'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LazyRiskDistributionChart, LazyAssetTrendChart } from './lazy-charts';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { ChartDataPoint, RiskDistribution } from '@/lib/types';
import { TimePeriod } from '@/lib/analytics';
import { getSession, getUserProfile } from '@/lib/supabase';
import { getCache, setCache } from '@/lib/cache';
import type { UserProfile } from '@/lib/types';

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
  const router = useRouter();
  const [period, setPeriod] = useState<TimePeriod>('1year');
  const [data, setData] = useState<PortfolioData | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const { session } = await getSession();
        if (!session) return;

        // Fetch user profile
        const { data: profile } = await getUserProfile(session.user.id);
        if (profile) {
          setUserProfile(profile);
        }

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
        const cacheKey = `analytics_${period}_${profileIds}`;
        
        // Check cache first
        const cachedData = getCache<PortfolioData>(cacheKey);
        if (cachedData) {
          setData(cachedData);
          setLoading(false);
          return;
        }
        
        const url = `/api/analytics/combined?period=${period}${profileIds ? `&profileIds=${profileIds}` : ''}`;
        
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        
        if (!response.ok) throw new Error('Failed to fetch analytics data');
        
        const analyticsData = await response.json();
        setData(analyticsData);
        
        // Cache the data for 5 minutes
        setCache(cacheKey, analyticsData, 5 * 60 * 1000);
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
      if (next.has(profileId)) {
        next.delete(profileId);
      } else {
        next.add(profileId);
      }
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
        <h2 className="text-2xl font-bold text-foreground">Portfolio</h2>
        <div className="flex h-[400px] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary"></div>
            <p className="mt-4 text-muted-foreground">Loading portfolio data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground">Portfolio</h2>
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
          <h2 className="text-2xl font-bold text-foreground">Portfolio</h2>
          {data && data.profileCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedProfiles.size} of {profiles.length} profile{profiles.length > 1 ? 's' : ''} selected
            </p>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button variant={period === '30days' ? 'secondary' : 'outline'} size="sm" onClick={() => setPeriod('30days')}>30 Days</Button>
          <Button variant={period === '3months' ? 'secondary' : 'outline'} size="sm" onClick={() => setPeriod('3months')}>3 Months</Button>
          <Button variant={period === '1year' ? 'secondary' : 'outline'} size="sm" onClick={() => setPeriod('1year')}>1 Year</Button>
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
            <p className="text-4xl font-bold text-foreground">{formatCurrency(data.totalAssets)}</p>
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
          <LazyRiskDistributionChart 
            data={data.riskDistribution}
            title="Risk Distribution"
            description="Asset allocation across selected profiles"
          />
          <LazyAssetTrendChart 
            data={data.chartData}
            title="Asset Trends"
            description={`Portfolio growth over ${period === '30days' ? '30 days' : period === '3months' ? '3 months' : '1 year'}`}
            showRiskBreakdown={true}
          />
        </div>
      ) : (
        <Card className="w-full max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Personal Finance Tracker</CardTitle>
            <CardDescription>
              Track and manage your financial assets across multiple profiles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {userProfile && (
              <div className="rounded-lg bg-blue-50 p-4">
                <h3 className="font-semibold text-blue-900">Account Status</h3>
                <div className="mt-2 space-y-1 text-sm text-blue-800">
                  <p>Email: {userProfile.email}</p>
                  <p>Role: <span className="capitalize font-medium">{userProfile.role}</span></p>
                  {userProfile.role === 'admin' && (
                    <p className="text-green-700 font-medium">✓ You have administrator privileges</p>
                  )}
                  {userProfile.role === 'pending' && (
                    <p className="text-yellow-700 font-medium">⏳ Your account is pending approval</p>
                  )}
                  {userProfile.role === 'approved' && (
                    <p className="text-green-700 font-medium">✓ Your account is approved</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Getting Started</h3>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">1</span>
                  <div>
                    <p className="font-medium text-foreground">Create or Select a Profile</p>
                    <p>Set up financial profiles for yourself or family members</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">2</span>
                  <div>
                    <p className="font-medium text-foreground">Enter Financial Data</p>
                    <p>Track assets across high/medium risk and low risk categories</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">3</span>
                  <div>
                    <p className="font-medium text-foreground">View Analytics</p>
                    <p>Visualize your portfolio with charts and trends over time</p>
                  </div>
                </div>
              </div>
            </div>

            {userProfile?.role === 'admin' && (
              <div className="rounded-lg border border-border p-4">
                <h3 className="font-semibold text-foreground">Admin Features</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  As an administrator, you can approve new users and manage access to financial profiles.
                </p>
                <Button variant="secondary" className="mt-3" onClick={() => router.push('/admin')}>
                  Go to Admin Panel
                </Button>
              </div>
            )}

            {userProfile?.role === 'pending' && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <h3 className="font-semibold text-yellow-900">Waiting for Approval</h3>
                <p className="mt-1 text-sm text-yellow-800">
                  Your account is pending approval from an administrator. You&apos;ll receive a notification once your account is approved.
                </p>
              </div>
            )}

            {(userProfile?.role === 'approved' || userProfile?.role === 'admin') && (
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => router.push('/profiles')} className="flex-1">
                  Add Financial Data
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
