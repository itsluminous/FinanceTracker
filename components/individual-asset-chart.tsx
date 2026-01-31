'use client';

/* eslint-disable react-hooks/error-boundaries */
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartDataPoint } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface IndividualAssetChartProps {
  data: ChartDataPoint[];
  title?: string;
  description?: string;
  onError?: () => void;
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

// Custom tooltip component defined outside render
const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    // Sort payload by value in descending order
    const sortedPayload = [...payload].sort((a, b) => b.value - a.value);
    
    return (
      <div className="rounded-lg border bg-popover p-2 sm:p-3 shadow-lg max-h-96 overflow-y-auto">
        <p className="mb-1 sm:mb-2 text-xs sm:text-sm font-medium text-popover-foreground">{label}</p>
        {sortedPayload.map((entry, index: number) => (
          <p key={index} className="text-xs sm:text-sm" style={{ color: entry.color }}>
            {entry.name}: {new Intl.NumberFormat('en-IN', {
              style: 'currency',
              currency: 'INR',
              maximumFractionDigits: 0
            }).format(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Asset field configurations with colors and display names
const assetFields = [
  { key: 'direct_equity', name: 'Direct Equity', color: '#3b82f6' },
  { key: 'esops', name: 'ESOPs', color: '#ef4444' },
  { key: 'equity_pms', name: 'Equity PMS', color: '#22c55e' },
  { key: 'ulip', name: 'ULIP', color: '#f59e0b' },
  { key: 'real_estate', name: 'Real Estate', color: '#8b5cf6' },
  { key: 'real_estate_funds', name: 'Real Estate Funds', color: '#ec4899' },
  { key: 'private_equity', name: 'Private Equity', color: '#06b6d4' },
  { key: 'equity_mutual_funds', name: 'Equity Mutual Funds', color: '#84cc16' },
  { key: 'structured_products_equity', name: 'Structured Products (Equity)', color: '#f97316' },
  { key: 'bank_balance', name: 'Bank Balance', color: '#10b981' },
  { key: 'debt_mutual_funds', name: 'Debt Mutual Funds', color: '#6366f1' },
  { key: 'endowment_plans', name: 'Endowment Plans', color: '#d946ef' },
  { key: 'fixed_deposits', name: 'Fixed Deposits', color: '#14b8a6' },
  { key: 'nps', name: 'NPS', color: '#f43f5e' },
  { key: 'epf', name: 'EPF', color: '#a855f7' },
  { key: 'ppf', name: 'PPF', color: '#0ea5e9' },
  { key: 'structured_products_debt', name: 'Structured Products (Debt)', color: '#eab308' },
  { key: 'gold_etfs_funds', name: 'Gold ETFs/Funds', color: '#dc2626' }
] as const;

export function IndividualAssetChart({ 
  data, 
  title = 'Individual Asset Growth',
  description = 'Growth trends for each asset category',
  onError
}: IndividualAssetChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="chart-container">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
          <CardDescription className="text-xs sm:text-sm">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[250px] sm:h-[300px] items-center justify-center text-xs sm:text-sm text-gray-500">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter out asset fields that are always zero across all data points
  const activeAssets = assetFields.filter(asset => {
    return data.some(dataPoint => {
      const value = dataPoint[asset.key as keyof ChartDataPoint];
      return typeof value === 'number' && value > 0;
    });
  });

  // Format currency for display
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
      notation: 'compact',
      compactDisplay: 'short'
    }).format(value);
  };

  try {
    return (
      <Card className="chart-container">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
          <CardDescription className="text-xs sm:text-sm">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400} className="sm:h-[450px]">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10 }}
                className="sm:text-xs"
                stroke="#6b7280"
              />
              <YAxis 
                tickFormatter={formatCurrency}
                tick={{ fontSize: 10 }}
                className="sm:text-xs"
                stroke="#6b7280"
              />
              <Tooltip content={<CustomTooltip />} />
              {activeAssets.map((asset, index) => (
                <Line 
                  key={asset.key}
                  type="monotone" 
                  dataKey={asset.key} 
                  stroke={asset.color} 
                  strokeWidth={2}
                  name={asset.name}
                  dot={{ r: 1 }}
                  activeDot={{ r: 3 }}
                  animationBegin={index * 100}
                  animationDuration={1000}
                  animationEasing="ease-in-out"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          
          {/* Summary statistics */}
          {data.length > 0 && activeAssets.length > 0 && (
            <div className="mt-3 sm:mt-4 border-t pt-3 sm:pt-4">
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500 mb-2">Latest Values</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {activeAssets
                    .map(asset => {
                      const value = data[data.length - 1][asset.key as keyof ChartDataPoint];
                      return {
                        ...asset,
                        value: typeof value === 'number' ? value : 0
                      };
                    })
                    .sort((a, b) => b.value - a.value)
                    .map(asset => (
                      <div key={asset.key} className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: asset.color }}
                          ></div>
                          <span className="text-gray-600 text-xs">{asset.name}:</span>
                        </div>
                        <span className="font-medium text-xs">
                          {new Intl.NumberFormat('en-IN', {
                            style: 'currency',
                            currency: 'INR',
                            maximumFractionDigits: 0
                          }).format(asset.value)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  } catch (error) {
    console.error('Error rendering individual asset chart:', error);
    if (onError) {
      onError();
    }
    return (
      <Card className="chart-container">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
          <CardDescription className="text-xs sm:text-sm">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[250px] sm:h-[300px] items-center justify-center text-xs sm:text-sm text-red-500">
            Error rendering chart
          </div>
        </CardContent>
      </Card>
    );
  }
}