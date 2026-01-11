'use client';

/* eslint-disable react-hooks/error-boundaries */
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartDataPoint } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AssetTrendChartProps {
  data: ChartDataPoint[];
  title?: string;
  description?: string;
  showRiskBreakdown?: boolean;
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
    return (
      <div className="rounded-lg border bg-popover p-2 sm:p-3 shadow-lg">
        <p className="mb-1 sm:mb-2 text-xs sm:text-sm font-medium text-popover-foreground">{label}</p>
        {payload.map((entry, index: number) => (
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

export function AssetTrendChart({ 
  data, 
  title = 'Asset Trends',
  description = 'Total assets over time',
  showRiskBreakdown = false,
  onError
}: AssetTrendChartProps) {
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
          <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
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
              <Legend 
                wrapperStyle={{ fontSize: '12px' }}
                className="sm:text-sm"
                iconType="line"
              />
              <Line 
                type="monotone" 
                dataKey="total_assets" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Total Assets"
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                animationBegin={0}
                animationDuration={1000}
                animationEasing="ease-in-out"
              />
              {showRiskBreakdown && (
                <>
                  <Line 
                    type="monotone" 
                    dataKey="high_medium_risk" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    name="High/Medium Risk"
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                    animationBegin={200}
                    animationDuration={1000}
                    animationEasing="ease-in-out"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="low_risk" 
                    stroke="#22c55e" 
                    strokeWidth={2}
                    name="Low Risk"
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                    animationBegin={400}
                    animationDuration={1000}
                    animationEasing="ease-in-out"
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
          
          {/* Summary statistics */}
          {data.length > 0 && (
            <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-3 sm:gap-4 border-t pt-3 sm:pt-4 sm:grid-cols-3">
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500">Latest Value</p>
                <p className="text-sm sm:text-lg font-semibold text-gray-900">
                  {new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: 'INR',
                    maximumFractionDigits: 0,
                    notation: 'compact'
                  }).format(data[data.length - 1].total_assets)}
                </p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500">Data Points</p>
                <p className="text-sm sm:text-lg font-semibold text-gray-900">{data.length}</p>
              </div>
              {data.length > 1 && (
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-[10px] sm:text-xs text-gray-500">Change</p>
                  <p className={`text-sm sm:text-lg font-semibold ${
                    data[data.length - 1].total_assets >= data[0].total_assets 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    {((data[data.length - 1].total_assets - data[0].total_assets) / data[0].total_assets * 100).toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  } catch (error) {
    console.error('Error rendering asset trend chart:', error);
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
