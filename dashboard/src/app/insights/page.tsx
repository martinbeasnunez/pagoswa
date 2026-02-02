'use client';

import { useEffect, useState, useMemo } from 'react';
import { getSupabase, type Expense } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCurrency, formatCurrency, CURRENCY_CONFIG } from '@/lib/currency-context';
import { useBudget } from '@/lib/budget-context';
import { useUser } from '@/lib/user-context';
import { CATEGORY_CONFIG } from '@/lib/constants';
import { ChartSkeleton, CardSkeleton } from '@/components/ui/skeleton';
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  parseISO,
  differenceInDays,
  eachMonthOfInterval,
  getDay,
  subYears,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Target,
  Zap,
  AlertTriangle,
  Award,
  PiggyBank,
  Clock,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  RefreshCcw,
  Wallet,
  ShoppingBag,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  CartesianGrid,
} from 'recharts';

export default function InsightsPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [lastYearExpenses, setLastYearExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'6months' | '12months' | 'yoy'>('6months');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { selectedCurrency } = useCurrency();
  const { getTotalBudget } = useBudget();
  const { user } = useUser();

  const userPhone = user ? `telegram:${user.telegramId}` : null;

  useEffect(() => {
    if (userPhone) fetchExpenses();
  }, [userPhone]);

  async function fetchExpenses() {
    if (!userPhone) return;

    const twelveMonthsAgo = format(subMonths(new Date(), 11), 'yyyy-MM-dd');

    const { data, error } = await getSupabase()
      .from('expenses')
      .select('*')
      .eq('user_phone', userPhone)
      .gte('date', twelveMonthsAgo)
      .order('date', { ascending: true });

    // Fetch last year's data for YoY comparison
    const lastYearStart = format(subYears(subMonths(new Date(), 11), 1), 'yyyy-MM-dd');
    const lastYearEnd = format(subYears(new Date(), 1), 'yyyy-MM-dd');

    const { data: lastYearData } = await getSupabase()
      .from('expenses')
      .select('*')
      .eq('user_phone', userPhone)
      .gte('date', lastYearStart)
      .lte('date', lastYearEnd);

    if (!error && data) {
      setExpenses(data);
    }
    if (lastYearData) {
      setLastYearExpenses(lastYearData);
    }
    setLoading(false);
  }

  // Filter by currency
  const filteredExpenses = useMemo(() => {
    return selectedCurrency
      ? expenses.filter((e) => e.currency === selectedCurrency)
      : expenses;
  }, [expenses, selectedCurrency]);

  const filteredLastYearExpenses = useMemo(() => {
    return selectedCurrency
      ? lastYearExpenses.filter((e) => e.currency === selectedCurrency)
      : lastYearExpenses;
  }, [lastYearExpenses, selectedCurrency]);

  const currency = selectedCurrency || 'CLP';
  const budget = getTotalBudget(currency);
  const currencyConfig = selectedCurrency ? CURRENCY_CONFIG[selectedCurrency] : null;

  // Date ranges
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const prevMonthStart = startOfMonth(subMonths(now, 1));
  const prevMonthEnd = endOfMonth(subMonths(now, 1));

  // Get months based on view mode
  const monthCount = viewMode === '6months' ? 6 : 12;
  const months = eachMonthOfInterval({
    start: subMonths(now, monthCount - 1),
    end: now,
  });

  // Monthly data for charts
  const monthlyData = useMemo(() => {
    return months.map((month) => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      const monthExpenses = filteredExpenses.filter((e) => {
        const date = parseISO(e.date);
        return date >= monthStart && date <= monthEnd;
      });
      const total = monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

      // Last year's same month
      const lastYearMonth = subYears(month, 1);
      const lastYearStart = startOfMonth(lastYearMonth);
      const lastYearEnd = endOfMonth(lastYearMonth);
      const lastYearMonthExpenses = filteredLastYearExpenses.filter((e) => {
        const date = parseISO(e.date);
        return date >= lastYearStart && date <= lastYearEnd;
      });
      const lastYearTotal = lastYearMonthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

      return {
        month: format(month, 'MMM', { locale: es }),
        fullMonth: format(month, 'MMMM yyyy', { locale: es }),
        amount: total,
        lastYear: lastYearTotal,
        count: monthExpenses.length,
      };
    });
  }, [months, filteredExpenses, filteredLastYearExpenses]);

  // Current and previous month expenses
  const currentMonthExpenses = filteredExpenses.filter((e) => {
    const date = parseISO(e.date);
    return date >= currentMonthStart && date <= currentMonthEnd;
  });

  const prevMonthExpenses = filteredExpenses.filter((e) => {
    const date = parseISO(e.date);
    return date >= prevMonthStart && date <= prevMonthEnd;
  });

  const currentTotal = currentMonthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const prevTotal = prevMonthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const monthChange = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;

  // Days calculations
  const daysPassed = now.getDate();
  const daysInMonth = endOfMonth(now).getDate();
  const daysRemaining = daysInMonth - daysPassed;

  // Daily average and projection
  const dailyAvg = currentTotal / daysPassed;
  const projectedTotal = dailyAvg * daysInMonth;
  const projectedVsBudget = budget > 0 ? projectedTotal - budget : 0;

  // Remaining budget per day
  const remainingBudget = budget > 0 ? budget - currentTotal : 0;
  const dailyBudgetRemaining = daysRemaining > 0 ? remainingBudget / daysRemaining : 0;

  // Year-over-year change
  const thisYearTotal = monthlyData.reduce((sum, m) => sum + m.amount, 0);
  const lastYearTotal = monthlyData.reduce((sum, m) => sum + m.lastYear, 0);
  const yoyChange = lastYearTotal > 0 ? ((thisYearTotal - lastYearTotal) / lastYearTotal) * 100 : 0;

  // Category trends
  const categoryTrends = useMemo(() => {
    return Object.keys(CATEGORY_CONFIG).map((category) => {
      const catExpenses = filteredExpenses.filter((e) => e.category === category);
      const total = catExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
      const count = catExpenses.length;

      // Current month
      const currentCat = currentMonthExpenses
        .filter((e) => e.category === category)
        .reduce((sum, e) => sum + Number(e.amount), 0);

      // Previous month
      const prevCat = prevMonthExpenses
        .filter((e) => e.category === category)
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const change = prevCat > 0 ? ((currentCat - prevCat) / prevCat) * 100 : currentCat > 0 ? 100 : 0;
      const trend: 'up' | 'down' | 'stable' = change > 5 ? 'up' : change < -5 ? 'down' : 'stable';

      // Monthly totals for sparkline
      const monthlyTotals = months.map((month) => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        const monthExpenses = catExpenses.filter((e) => {
          const date = parseISO(e.date);
          return date >= monthStart && date <= monthEnd;
        });
        return {
          month: format(month, 'MMM', { locale: es }),
          amount: monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
        };
      });

      return {
        category,
        total,
        count,
        current: currentCat,
        previous: prevCat,
        change,
        trend,
        monthlyTotals,
        config: CATEGORY_CONFIG[category],
      };
    }).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  }, [filteredExpenses, currentMonthExpenses, prevMonthExpenses, months]);

  // Selected category chart data
  const selectedCategoryData = selectedCategory
    ? categoryTrends.find((c) => c.category === selectedCategory)?.monthlyTotals || []
    : null;

  // Day of week analysis
  const dayOfWeekData = useMemo(() => {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const byDay = filteredExpenses.reduce((acc, e) => {
      const dayNum = getDay(parseISO(e.date));
      if (!acc[dayNum]) acc[dayNum] = { total: 0, count: 0 };
      acc[dayNum].total += Number(e.amount);
      acc[dayNum].count += 1;
      return acc;
    }, {} as Record<number, { total: number; count: number }>);

    return days.map((day, i) => ({
      day,
      dayNum: i,
      total: byDay[i]?.total || 0,
      count: byDay[i]?.count || 0,
      avg: byDay[i] ? byDay[i].total / byDay[i].count : 0,
    }));
  }, [filteredExpenses]);

  const maxSpendingDay = dayOfWeekData.reduce((max, d) => (d.total > max.total ? d : max), dayOfWeekData[0]);

  // Recurring/subscription detection
  const recurringExpenses = useMemo(() => {
    const byMerchant = filteredExpenses.reduce((acc, e) => {
      const key = e.merchant.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!acc[key]) acc[key] = [];
      acc[key].push(e);
      return acc;
    }, {} as Record<string, Expense[]>);

    const recurring: { merchant: string; avgAmount: number; frequency: string; count: number }[] = [];

    for (const [, exps] of Object.entries(byMerchant)) {
      if (exps.length < 2) continue;
      const sorted = [...exps].sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        intervals.push(differenceInDays(parseISO(sorted[i].date), parseISO(sorted[i - 1].date)));
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const stdDev = Math.sqrt(intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length);

      if (stdDev <= avgInterval * 0.3) {
        let frequency = '';
        if (avgInterval >= 5 && avgInterval <= 9) frequency = 'Semanal';
        else if (avgInterval >= 25 && avgInterval <= 35) frequency = 'Mensual';
        else if (avgInterval >= 350 && avgInterval <= 380) frequency = 'Anual';
        else continue;

        recurring.push({
          merchant: exps[0].merchant,
          avgAmount: sorted.reduce((sum, e) => sum + Number(e.amount), 0) / sorted.length,
          frequency,
          count: exps.length,
        });
      }
    }

    return recurring.sort((a, b) => b.avgAmount - a.avgAmount);
  }, [filteredExpenses]);

  const monthlyRecurring = recurringExpenses.reduce((sum, r) => {
    const multiplier = r.frequency === 'Semanal' ? 4.33 : r.frequency === 'Anual' ? 1 / 12 : 1;
    return sum + r.avgAmount * multiplier;
  }, 0);

  // Top merchants
  const topMerchants = useMemo(() => {
    const byMerchant = currentMonthExpenses.reduce((acc, e) => {
      if (!acc[e.merchant]) acc[e.merchant] = { total: 0, count: 0 };
      acc[e.merchant].total += Number(e.amount);
      acc[e.merchant].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number }>);

    return Object.entries(byMerchant)
      .map(([merchant, data]) => ({ merchant, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [currentMonthExpenses]);

  // Biggest expense this month
  const biggestExpense = currentMonthExpenses.reduce(
    (max, e) => (Number(e.amount) > Number(max?.amount || 0) ? e : max),
    null as Expense | null
  );

  // Discretionary spending
  const discretionaryCategories = ['entretenimiento', 'restaurantes', 'compras'];
  const discretionaryTotal = currentMonthExpenses
    .filter((e) => discretionaryCategories.includes(e.category))
    .reduce((sum, e) => sum + Number(e.amount), 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <ChartSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-400" />
            Insights
          </h1>
          <p className="text-sm text-zinc-500">
            Análisis inteligente de tus gastos
            {currencyConfig && (
              <span className="ml-2 text-zinc-400">
                {currencyConfig.flag} {selectedCurrency}
              </span>
            )}
          </p>
        </div>

        {/* View mode selector */}
        <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-1">
          <Button
            size="sm"
            variant={viewMode === '6months' ? 'default' : 'ghost'}
            onClick={() => setViewMode('6months')}
            className={`text-xs ${viewMode === '6months' ? 'bg-emerald-600' : 'text-zinc-400'}`}
          >
            6M
          </Button>
          <Button
            size="sm"
            variant={viewMode === '12months' ? 'default' : 'ghost'}
            onClick={() => setViewMode('12months')}
            className={`text-xs ${viewMode === '12months' ? 'bg-emerald-600' : 'text-zinc-400'}`}
          >
            12M
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'yoy' ? 'default' : 'ghost'}
            onClick={() => setViewMode('yoy')}
            className={`text-xs ${viewMode === 'yoy' ? 'bg-emerald-600' : 'text-zinc-400'}`}
          >
            YoY
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {/* Projected end of month */}
        <Card className="bg-gradient-to-br from-purple-500/20 to-purple-900/20 border-purple-500/30">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 text-purple-300 mb-1">
              <Target className="h-4 w-4" />
              <span className="text-xs font-medium">Proyección</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-white">
              {formatCurrency(Math.round(projectedTotal), currency)}
            </p>
            {budget > 0 && (
              <p className={`text-xs mt-0.5 ${projectedVsBudget <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {projectedVsBudget <= 0 ? 'Bajo presupuesto' : 'Sobre presupuesto'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Daily budget remaining */}
        <Card className={`border ${remainingBudget >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <CardContent className="p-3 sm:p-4">
            <div className={`flex items-center gap-2 mb-1 ${remainingBudget >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              <Wallet className="h-4 w-4" />
              <span className="text-xs font-medium">Por día</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-white">
              {formatCurrency(Math.round(Math.max(0, dailyBudgetRemaining)), currency)}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              {daysRemaining} días restantes
            </p>
          </CardContent>
        </Card>

        {/* Month comparison */}
        <Card className={`border ${monthChange <= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <CardContent className="p-3 sm:p-4">
            <div className={`flex items-center gap-2 mb-1 ${monthChange <= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {monthChange <= 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              <span className="text-xs font-medium">vs anterior</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-white">
              {monthChange > 0 ? '+' : ''}{Math.round(monthChange)}%
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              {monthChange <= 0 ? 'Gastando menos' : 'Gastando más'}
            </p>
          </CardContent>
        </Card>

        {/* YoY or Recurring */}
        <Card className="bg-cyan-500/10 border-cyan-500/30">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 text-cyan-300 mb-1">
              <RefreshCcw className="h-4 w-4" />
              <span className="text-xs font-medium">Fijos/mes</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-white">
              {formatCurrency(Math.round(monthlyRecurring), currency)}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              {recurringExpenses.length} suscripciones
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Trend Chart */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-500" />
            {viewMode === 'yoy' ? 'Año vs año' : 'Evolución mensual'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] sm:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              {viewMode === 'yoy' ? (
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="month" stroke="#52525b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#52525b" fontSize={11} tickLine={false} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl">
                            <p className="text-xs text-zinc-400 capitalize">{data.fullMonth}</p>
                            <p className="text-sm font-bold text-emerald-400">
                              Este año: {formatCurrency(data.amount, currency)}
                            </p>
                            <p className="text-sm font-bold text-blue-400">
                              Año pasado: {formatCurrency(data.lastYear, currency)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="amount" name="Este año" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 3 }} />
                  <Line type="monotone" dataKey="lastYear" name="Año pasado" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#3b82f6', r: 2 }} />
                </LineChart>
              ) : (
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="month" stroke="#52525b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#52525b" fontSize={11} tickLine={false} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl">
                            <p className="text-xs text-zinc-400 capitalize">{data.fullMonth}</p>
                            <p className="text-lg font-bold text-white">
                              {formatCurrency(data.amount, currency)}
                            </p>
                            <p className="text-xs text-zinc-400">{data.count} transacciones</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorTrend)" />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Category Trend Selector */}
      {categoryTrends.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-zinc-400">Filtrar:</span>
          <Button
            size="sm"
            variant={selectedCategory === null ? 'default' : 'outline'}
            onClick={() => setSelectedCategory(null)}
            className={`h-7 text-xs ${selectedCategory === null ? 'bg-emerald-600' : 'border-zinc-700 text-zinc-300'}`}
          >
            Todas
          </Button>
          {categoryTrends.slice(0, 5).map((cat) => (
            <Button
              key={cat.category}
              size="sm"
              variant={selectedCategory === cat.category ? 'default' : 'outline'}
              onClick={() => setSelectedCategory(selectedCategory === cat.category ? null : cat.category)}
              className={`h-7 text-xs ${selectedCategory === cat.category ? 'bg-emerald-600' : 'border-zinc-700 text-zinc-300'}`}
            >
              {cat.config.emoji}
            </Button>
          ))}
        </div>
      )}

      {/* Selected category chart */}
      {selectedCategoryData && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <span className="text-xl">{CATEGORY_CONFIG[selectedCategory!]?.emoji}</span>
              {CATEGORY_CONFIG[selectedCategory!]?.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={selectedCategoryData}>
                  <defs>
                    <linearGradient id="colorCategory" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CATEGORY_CONFIG[selectedCategory!]?.color || '#10b981'} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CATEGORY_CONFIG[selectedCategory!]?.color || '#10b981'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="month" stroke="#52525b" fontSize={11} />
                  <YAxis stroke="#52525b" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl">
                            <p className="text-xs text-zinc-400">{data.month}</p>
                            <p className="text-sm font-bold text-white">
                              {formatCurrency(data.amount, currency)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke={CATEGORY_CONFIG[selectedCategory!]?.color || '#10b981'}
                    strokeWidth={3}
                    fill="url(#colorCategory)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category Changes & Day Pattern Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Category trends */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-400" />
              vs mes anterior
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {categoryTrends.slice(0, 5).map((cat) => (
                <div
                  key={cat.category}
                  className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/50 cursor-pointer hover:bg-zinc-800"
                  onClick={() => setSelectedCategory(selectedCategory === cat.category ? null : cat.category)}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-base"
                      style={{ backgroundColor: `${cat.config.color}20` }}
                    >
                      {cat.config.emoji}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{cat.config.label}</p>
                      <p className="text-xs text-zinc-500">
                        {formatCurrency(cat.current, currency)}
                      </p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    cat.trend === 'down' ? 'bg-emerald-500/20 text-emerald-400' :
                    cat.trend === 'up' ? 'bg-red-500/20 text-red-400' :
                    'bg-zinc-700/50 text-zinc-400'
                  }`}>
                    {cat.trend === 'down' ? <ArrowDownRight className="h-3 w-3" /> :
                     cat.trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : null}
                    {cat.change !== 0 ? `${Math.round(Math.abs(cat.change))}%` : '='}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Day of Week Pattern */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-400" />
              Patrón semanal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayOfWeekData}>
                  <XAxis dataKey="day" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value: number) => [formatCurrency(value, currency), 'Total']}
                  />
                  <Bar dataKey="total" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-zinc-400 mt-1 text-center">
              <span className="text-orange-400 font-medium">{maxSpendingDay.day}</span> es el día que más gastas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Merchants & Tips Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Merchants */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-pink-400" />
              Donde más gastas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topMerchants.map((m, i) => (
                <div key={m.merchant} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-600 w-4">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{m.merchant}</p>
                      <p className="text-xs text-zinc-500">{m.count} visitas</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-white">
                    {formatCurrency(m.total, currency)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Smart Tips */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {/* Discretionary spending tip */}
              {discretionaryTotal > 0 && (
                <div className="p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-xs text-yellow-200">
                    <PiggyBank className="h-3.5 w-3.5 inline mr-1.5" />
                    Ocio: <span className="font-semibold">{formatCurrency(discretionaryTotal, currency)}</span>
                    {budget > 0 && ` (${Math.round((discretionaryTotal / budget) * 100)}% del presupuesto)`}
                  </p>
                </div>
              )}

              {/* Biggest expense */}
              {biggestExpense && (
                <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30">
                  <p className="text-xs text-purple-200">
                    <Award className="h-3.5 w-3.5 inline mr-1.5" />
                    Mayor gasto: <span className="font-semibold">{biggestExpense.merchant}</span> - {formatCurrency(biggestExpense.amount, currency)}
                  </p>
                </div>
              )}

              {/* Spending pattern tip */}
              <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <p className="text-xs text-blue-200">
                  <Clock className="h-3.5 w-3.5 inline mr-1.5" />
                  Evita compras los <span className="font-semibold">{maxSpendingDay.day}</span> - cuando más gastas
                </p>
              </div>

              {/* Budget warning */}
              {budget > 0 && projectedVsBudget > 0 && (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-xs text-red-200">
                    <AlertTriangle className="h-3.5 w-3.5 inline mr-1.5" />
                    A este ritmo: {formatCurrency(Math.round(projectedVsBudget), currency)} sobre presupuesto
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recurring Expenses */}
      {recurringExpenses.length > 0 && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <RefreshCcw className="h-5 w-5 text-cyan-400" />
              Suscripciones detectadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {recurringExpenses.slice(0, 6).map((r) => (
                <div
                  key={r.merchant}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{r.merchant}</p>
                    <p className="text-xs text-zinc-500">{r.frequency}</p>
                  </div>
                  <p className="text-sm font-semibold text-white">
                    {formatCurrency(Math.round(r.avgAmount), currency)}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-500 mt-3 text-center">
              Total mensual: <span className="text-cyan-400 font-semibold">{formatCurrency(Math.round(monthlyRecurring), currency)}</span>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
