'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CATEGORY_CONFIG } from '@/lib/constants';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface CategoryChartProps {
  data: Array<{
    category: string;
    total: number;
    count: number;
  }>;
}

export function CategoryChart({ data }: CategoryChartProps) {
  const chartData = data.map((item) => ({
    name: CATEGORY_CONFIG[item.category]?.label || item.category,
    value: item.total,
    color: CATEGORY_CONFIG[item.category]?.color || 'hsl(215, 14%, 45%)',
    emoji: CATEGORY_CONFIG[item.category]?.emoji || '📦',
  }));

  const total = data.reduce((sum, item) => sum + item.total, 0);

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-white">
          Por categoría
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-8">
          {/* Pie chart */}
          <div className="h-[200px] w-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl">
                          <p className="text-sm font-medium text-white">
                            {data.emoji} {data.name}
                          </p>
                          <p className="text-sm text-zinc-400">
                            ${data.value.toLocaleString()}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-3">
            {chartData.slice(0, 5).map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-zinc-300">
                    {item.emoji} {item.name}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-white">
                    ${item.value.toLocaleString()}
                  </span>
                  <span className="text-xs text-zinc-500 ml-2">
                    {((item.value / total) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
