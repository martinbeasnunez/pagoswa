'use client';

import { useEffect, useState } from 'react';
import { getSupabase, type Expense } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CATEGORY_CONFIG } from '@/lib/constants';
import { useCurrency, formatCurrency, CURRENCY_CONFIG } from '@/lib/currency-context';
import { useUser } from '@/lib/user-context';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export default function CategoriasPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedCurrency } = useCurrency();
  const { user } = useUser();

  const userPhone = user ? `telegram:${user.telegramId}` : null;

  useEffect(() => {
    if (userPhone) fetchExpenses();
  }, [userPhone]);

  async function fetchExpenses() {
    if (!userPhone) return;

    const { data, error } = await getSupabase()
      .from('expenses')
      .select('*')
      .eq('user_phone', userPhone)
      .order('date', { ascending: false });

    if (!error && data) {
      setExpenses(data);
    }
    setLoading(false);
  }

  // Filter by selected currency
  const filteredExpenses = selectedCurrency
    ? expenses.filter((e) => e.currency === selectedCurrency)
    : expenses;

  // Calculate category totals
  const categoryData = filteredExpenses.reduce((acc, expense) => {
    const existing = acc.find((c) => c.category === expense.category);
    if (existing) {
      existing.total += Number(expense.amount);
      existing.count += 1;
    } else {
      acc.push({
        category: expense.category,
        total: Number(expense.amount),
        count: 1,
      });
    }
    return acc;
  }, [] as Array<{ category: string; total: number; count: number }>);

  categoryData.sort((a, b) => b.total - a.total);

  const chartData = categoryData.map((item) => ({
    name: CATEGORY_CONFIG[item.category]?.label || item.category,
    value: item.total,
    count: item.count,
    color: CATEGORY_CONFIG[item.category]?.color || 'hsl(215, 14%, 45%)',
    emoji: CATEGORY_CONFIG[item.category]?.emoji || '📦',
  }));

  const total = categoryData.reduce((sum, item) => sum + item.total, 0);
  const currencyConfig = selectedCurrency ? CURRENCY_CONFIG[selectedCurrency] : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Categorías</h1>
        <p className="text-zinc-500">
          Distribución de gastos por categoría
          {currencyConfig && (
            <span className="ml-2 text-zinc-400">
              {currencyConfig.flag} {selectedCurrency}
            </span>
          )}
        </p>
      </div>

      {filteredExpenses.length === 0 ? (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-8 text-center">
            <p className="text-zinc-400">No hay gastos registrados en esta moneda</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Pie Chart */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-white">
                  Distribución
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={140}
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
                              <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 shadow-xl">
                                <p className="text-base font-medium text-white">
                                  {data.emoji} {data.name}
                                </p>
                                <p className="text-lg font-bold text-white">
                                  {formatCurrency(data.value, selectedCurrency || 'CLP')}
                                </p>
                                <p className="text-sm text-zinc-400">
                                  {data.count} transacciones
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
              </CardContent>
            </Card>

            {/* Bar Chart */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-white">
                  Comparativa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical">
                      <XAxis type="number" stroke="#52525b" fontSize={12} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="emoji" stroke="#52525b" fontSize={18} width={40} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 shadow-xl">
                                <p className="text-base font-medium text-white">
                                  {data.emoji} {data.name}
                                </p>
                                <p className="text-lg font-bold text-white">
                                  {formatCurrency(data.value, selectedCurrency || 'CLP')}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Category cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {chartData.map((item, index) => (
              <Card key={index} className="bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900/80 transition-all">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-xl text-3xl"
                        style={{ backgroundColor: `${item.color}20` }}
                      >
                        {item.emoji}
                      </div>
                      <div>
                        <p className="font-semibold text-white text-lg">{item.name}</p>
                        <p className="text-sm text-zinc-500">
                          {item.count} transacciones
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-white">
                        {formatCurrency(item.value, selectedCurrency || 'CLP')}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {((item.value / total) * 100).toFixed(1)}% del total
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
