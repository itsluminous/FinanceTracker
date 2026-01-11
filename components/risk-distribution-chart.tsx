'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { RiskDistribution } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface RiskDistributionChartProps {
  data: RiskDistribution[];
  title?: string;
  description?: string;
  onError?: () => void;
}

const COLORS = {
  'High/Medium Risk': '#ef4444', // red-500
  'Low Risk': '#22c55e' // green-500
};

export function RiskDistributionChart({ 
  data, 
  title = 'Risk Distribution',
  description = 'Asset allocation by risk category',
  onError
}: RiskDistributionChartProps) {
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
      maximumFractionDigits: 0
    }).format(value);
  };

  // Custom label for pie chart
  const renderLabel = (entry: RiskDistribution) => {
    return `${entry.percentage.toFixed(1)}%`;
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
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderLabel}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                animationBegin={0}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem'
                }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value) => <span className="text-xs sm:text-sm">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
          
          {/* Summary below chart */}
          <div className="mt-3 sm:mt-4 space-y-2 border-t pt-3 sm:pt-4">
            {data.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <div 
                    className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full" 
                    style={{ backgroundColor: COLORS[item.name as keyof typeof COLORS] }}
                  />
                  <span className="text-gray-700">{item.name}</span>
                </div>
                <span className="font-medium">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  } catch (error) {
    console.error('Error rendering risk distribution chart:', error);
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
