'use client';

import { useEffect, useState } from 'react';
import { getSupabase, type Expense } from '@/lib/supabase';
import { StatsCard } from '@/components/stats-card';
import { ExpenseChart } from '@/components/expense-chart';
import { CategoryChart } from '@/components/category-chart';
import { RecentExpenses } from '@/components/recent-expenses';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { BudgetProgress } from '@/components/budget-alert';
import { GoalCard } from '@/components/goal-card';
import { CATEGORY_CONFIG } from '@/lib/constants';
import { useGoal } from '@/lib/goal-context';
import { useUser } from '@/lib/user-context';
import {
  Wallet,
  TrendingUp,
  Receipt,
  PieChart,
  ChevronLeft,
  ChevronRight,
  Flame,
  Sparkles,
  ArrowRight,
  Settings,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, eachDayOfInterval, differenceInDays, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCurrency, formatCurrency, CURRENCY_CONFIG } from '@/lib/currency-context';
import { useBudget } from '@/lib/budget-context';
import Link from 'next/link';

export function DashboardContent() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [lastMonthExpenses, setLastMonthExpenses] = useState<Expense[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const { selectedCurrency } = useCurrency();
  const { getTotalBudget } = useBudget();
  const { goal } = useGoal();
  const { user } = useUser();

  // Get user's phone format for filtering
  const userPhone = user ? `telegram:${user.telegramId}` : null;

  useEffect(() => {
    if (userPhone) fetchExpenses();
  }, [selectedMonth, userPhone]);

  useEffect(() => {
    if (userPhone) fetchAllExpenses();
  }, [userPhone]);

  async function fetchExpenses() {
    if (!userPhone) return;

    setLoading(true);
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);

    const { data, error } = await getSupabase()
      .from('expenses')
      .select('*')
      .eq('user_phone', userPhone)
      .gte('date', format(start, 'yyyy-MM-dd'))
      .lte('date', format(end, 'yyyy-MM-dd'))
      .order('date', { ascending: false });

    const lastStart = startOfMonth(subMonths(selectedMonth, 1));
    const lastEnd = endOfMonth(subMonths(selectedMonth, 1));

    const { data: lastData } = await getSupabase()
      .from('expenses')
      .select('*')
      .eq('user_phone', userPhone)
      .gte('date', format(lastStart, 'yyyy-MM-dd'))
      .lte('date', format(lastEnd, 'yyyy-MM-dd'));

    if (!error && data) setExpenses(data);
    if (lastData) setLastMonthExpenses(lastData);
    setLoading(false);
  }

  async function fetchAllExpenses() {
    if (!userPhone) return;

    const { data } = await getSupabase()
      .from('expenses')
      .select('*')
      .eq('user_phone', userPhone)
      .order('created_at', { ascending: false });
    if (data) setAllExpenses(data);
  }

  // Calculate streak
  function calculateStreak(): number {
    if (allExpenses.length === 0) return 0;
    const uniqueDays = new Set(allExpenses.map((e) => e.date));
    const sortedDays = Array.from(uniqueDays).sort().reverse();
    let streak = 0;
    const today = format(new Date(), 'yyyy-MM-dd');

    if (sortedDays[0] !== today && differenceInDays(new Date(), new Date(sortedDays[0])) > 1) {
      return 0;
    }

    for (let i = 0; i < sortedDays.length; i++) {
      const current = new Date(sortedDays[i]);
      const expected = new Date();
      expected.setDate(expected.getDate() - i);
      if (format(current, 'yyyy-MM-dd') === format(expected, 'yyyy-MM-dd')) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  const streak = calculateStreak();

  // Filter by selected currency
  const filteredExpenses = selectedCurrency
    ? expenses.filter((e) => e.currency === selectedCurrency)
    : expenses;

  const filteredLastMonthExpenses = selectedCurrency
    ? lastMonthExpenses.filter((e) => e.currency === selectedCurrency)
    : lastMonthExpenses;

  // Group by currency
  const expensesByCurrency = filteredExpenses.reduce((acc, expense) => {
    const currency = expense.currency || 'CLP';
    if (!acc[currency]) acc[currency] = [];
    acc[currency].push(expense);
    return acc;
  }, {} as Record<string, Expense[]>);

  const currencies = Object.keys(expensesByCurrency);
  const hasMultipleCurrencies = currencies.length > 1;

  // Calculate totals per currency
  const totalsByCurrency = currencies.map((currency) => {
    const exps = expensesByCurrency[currency];
    const total = exps.reduce((sum, e) => sum + Number(e.amount), 0);
    const lastMonthTotal = filteredLastMonthExpenses
      .filter((e) => e.currency === currency)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const change = lastMonthTotal > 0 ? ((total - lastMonthTotal) / lastMonthTotal) * 100 : 0;

    return { currency, total, count: exps.length, change, lastMonthTotal };
  }).sort((a, b) => b.count - a.count);

  const mainCurrency = selectedCurrency || totalsByCurrency[0]?.currency || 'CLP';
  const mainTotal = totalsByCurrency[0]?.total || 0;
  const mainChange = totalsByCurrency[0]?.change || 0;
  const budget = getTotalBudget(mainCurrency);

  // Stats calculations
  const now = new Date();
  const currentDay = selectedMonth.getMonth() === now.getMonth() ? now.getDate() : endOfMonth(selectedMonth).getDate();
  const avgPerDay = mainTotal / currentDay;
  const transactionCount = filteredExpenses.length;

  // Category data
  const categoryData = filteredExpenses.reduce((acc, expense) => {
    const existing = acc.find((c) => c.category === expense.category);
    if (existing) {
      existing.total += Number(expense.amount);
      existing.count += 1;
    } else {
      acc.push({ category: expense.category, total: Number(expense.amount), count: 1 });
    }
    return acc;
  }, [] as Array<{ category: string; total: number; count: number }>);
  categoryData.sort((a, b) => b.total - a.total);

  const topCategory = categoryData[0]?.category || 'N/A';
  const topCategoryPercent = mainTotal > 0 && categoryData[0] ? (categoryData[0].total / mainTotal) * 100 : 0;

  // Calculate daily budget remaining
  const daysInMonthTotal = endOfMonth(selectedMonth).getDate();
  const daysRemaining = daysInMonthTotal - currentDay;
  const remainingBudget = budget > 0 ? budget - mainTotal : 0;
  const dailyBudgetRemaining = daysRemaining > 0 ? remainingBudget / daysRemaining : 0;

  // Calculate savings for goal tracking
  const calculateSavings = () => {
    const goalCurrency = goal?.currency || mainCurrency;

    // Get expenses for last 3 months to calculate average
    const threeMonthsAgo = subMonths(now, 3);
    const last3MonthsExpenses = allExpenses.filter(e => {
      const expenseDate = new Date(e.date);
      return expenseDate >= threeMonthsAgo &&
             expenseDate < startOfMonth(now) &&
             e.currency === goalCurrency;
    });

    // Calculate monthly average from last 3 months
    const monthlyTotals: Record<string, number> = {};
    last3MonthsExpenses.forEach(e => {
      const monthKey = format(new Date(e.date), 'yyyy-MM');
      monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + Number(e.amount);
    });
    const monthsWithData = Object.keys(monthlyTotals).length;
    const totalFromLast3Months = Object.values(monthlyTotals).reduce((a, b) => a + b, 0);
    const monthlyAverage = monthsWithData > 0 ? totalFromLast3Months / monthsWithData : 0;

    // Current month spending in goal currency
    const currentMonthTotal = filteredExpenses
      .filter(e => e.currency === goalCurrency)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    // Projected monthly total (if month isn't complete)
    const projectedMonthTotal = currentDay > 0
      ? (currentMonthTotal / currentDay) * daysInMonthTotal
      : currentMonthTotal;

    // Monthly savings = average - projected (positive = saving)
    const monthlySavings = monthlyAverage > 0 ? monthlyAverage - projectedMonthTotal : 0;

    // Weekly savings (current week vs average week)
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekExpenses = allExpenses.filter(e => {
      const expenseDate = new Date(e.date);
      return expenseDate >= weekStart && e.currency === goalCurrency;
    });
    const weekTotal = weekExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const avgWeekly = monthlyAverage / 4;
    const weeklySavings = avgWeekly > 0 ? avgWeekly - weekTotal : 0;

    // Total saved since goal creation
    let totalSavedSinceGoal = 0;
    if (goal) {
      const goalDate = new Date(goal.createdAt);
      const monthsSinceGoal = Math.max(1, Math.ceil(differenceInDays(now, goalDate) / 30));

      // Get expenses since goal creation
      const expensesSinceGoal = allExpenses.filter(e => {
        const expenseDate = new Date(e.date);
        return expenseDate >= goalDate && e.currency === goalCurrency;
      });
      const totalSpentSinceGoal = expensesSinceGoal.reduce((sum, e) => sum + Number(e.amount), 0);
      const expectedSpending = monthlyAverage * monthsSinceGoal;
      totalSavedSinceGoal = Math.max(0, expectedSpending - totalSpentSinceGoal);
    }

    return {
      monthlySavings: Math.max(0, monthlySavings),
      weeklySavings: Math.max(0, weeklySavings),
      totalSavedSinceGoal,
      monthlyAverage,
    };
  };

  const savings = calculateSavings();

  // Daily chart data
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(selectedMonth),
    end: selectedMonth.getMonth() === now.getMonth() && selectedMonth.getFullYear() === now.getFullYear()
      ? now
      : endOfMonth(selectedMonth),
  });

  const chartData = daysInMonth.map((day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayExpenses = filteredExpenses.filter((e) => e.date === dayStr);
    return {
      date: format(day, 'd MMM', { locale: es }),
      amount: dayExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
    };
  });

  const goToPreviousMonth = () => setSelectedMonth(subMonths(selectedMonth, 1));
  const goToNextMonth = () => {
    const next = addMonths(selectedMonth, 1);
    if (next <= new Date()) setSelectedMonth(next);
  };
  const isCurrentMonth = selectedMonth.getMonth() === now.getMonth() && selectedMonth.getFullYear() === now.getFullYear();

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with month selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Dashboard</h1>
          <div className="flex items-center gap-2 mt-1">
            <button onClick={goToPreviousMonth} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-zinc-300 font-medium min-w-[130px] text-center capitalize text-sm sm:text-base">
              {format(selectedMonth, "MMMM yyyy", { locale: es })}
            </span>
            <button
              onClick={goToNextMonth}
              disabled={isCurrentMonth}
              className={`p-1.5 rounded transition-colors ${isCurrentMonth ? 'text-zinc-600 cursor-not-allowed' : 'hover:bg-zinc-800 text-zinc-400 hover:text-white'}`}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Streak badge */}
        {isCurrentMonth && streak > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/20 border border-orange-500/30">
            <Flame className="h-4 w-4 text-orange-400" />
            <span className="text-sm font-medium text-orange-300">{streak} días de racha</span>
          </div>
        )}
      </div>

      {/* Budget + Goal Row - Compact */}
      {isCurrentMonth && (budget > 0 || true) && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          {/* Budget Mini Card */}
          {budget > 0 && (
            <Link href="/configuracion">
              <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer group h-full">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-zinc-400">Presupuesto</span>
                    <span className="text-xs text-zinc-500">
                      {formatCurrency(mainTotal, mainCurrency)} / {formatCurrency(budget, mainCurrency)}
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        mainTotal > budget ? 'bg-red-500' : mainTotal > budget * 0.8 ? 'bg-yellow-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min((mainTotal / budget) * 100, 100)}%` }}
                    />
                  </div>
                  <p className={`text-xs mt-1 ${remainingBudget > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {remainingBudget > 0
                      ? `${formatCurrency(Math.round(dailyBudgetRemaining), mainCurrency)}/día`
                      : `Excedido ${formatCurrency(Math.abs(remainingBudget), mainCurrency)}`}
                  </p>
                </CardContent>
              </Card>
            </Link>
          )}

          {/* Goal Mini Card */}
          <GoalCard
            savings={savings.monthlySavings}
            weeklySavings={savings.weeklySavings}
            totalSavedSinceGoal={savings.totalSavedSinceGoal}
            monthlyAverage={savings.monthlyAverage}
            topCategory={categoryData[0]}
            compact={true}
          />
        </div>
      )}

      {/* Stats Grid */}
      {hasMultipleCurrencies ? (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {totalsByCurrency.map(({ currency, total, count, change }) => {
            const config = CURRENCY_CONFIG[currency] || { symbol: '$', name: currency, flag: '🏳️' };
            const currencyBudget = getTotalBudget(currency);
            return (
              <Card key={currency} className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{config.flag}</span>
                        <span className="text-xs sm:text-sm text-zinc-400 font-medium">{config.name}</span>
                      </div>
                      <p className="text-2xl sm:text-3xl font-bold text-white">
                        {formatCurrency(total, currency)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-zinc-500">{count} gastos</span>
                        {change !== 0 && (
                          <span className={`text-xs font-medium ${change > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {change > 0 ? '+' : ''}{Math.round(change)}%
                          </span>
                        )}
                      </div>
                      {currencyBudget > 0 && (
                        <div className="mt-3">
                          <BudgetProgress spent={total} budget={currencyBudget} currency={currency} />
                        </div>
                      )}
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-800/80">
                      <Wallet className="h-5 w-5 text-emerald-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Gastos del mes"
            value={formatCurrency(mainTotal, mainCurrency)}
            change={mainChange !== 0 ? `${mainChange > 0 ? '+' : ''}${Math.round(mainChange)}% vs anterior` : mainCurrency}
            changeType={mainChange > 0 ? 'negative' : mainChange < 0 ? 'positive' : 'neutral'}
            icon={Wallet}
          />
          <StatsCard
            title="Promedio diario"
            value={formatCurrency(Math.round(avgPerDay), mainCurrency)}
            icon={TrendingUp}
            iconColor="text-blue-500"
          />
          <StatsCard
            title="Transacciones"
            value={transactionCount.toString()}
            change={`${transactionCount} registros`}
            changeType="neutral"
            icon={Receipt}
            iconColor="text-purple-500"
          />
          <StatsCard
            title="Mas gastaste en"
            value={CATEGORY_CONFIG[topCategory]?.label || topCategory}
            change={categoryData[0] ? `${Math.round(topCategoryPercent)}% del total` : ''}
            changeType="neutral"
            icon={PieChart}
            iconColor="text-orange-500"
          />
        </div>
      )}

      {/* Secondary stats for multi-currency */}
      {hasMultipleCurrencies && (
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Transacciones"
            value={transactionCount.toString()}
            change={`${currencies.length} monedas`}
            changeType="neutral"
            icon={Receipt}
            iconColor="text-purple-500"
          />
          <StatsCard
            title="Promedio/día"
            value={formatCurrency(Math.round(avgPerDay), mainCurrency)}
            change={`en ${CURRENCY_CONFIG[mainCurrency]?.name || mainCurrency}`}
            changeType="neutral"
            icon={TrendingUp}
            iconColor="text-blue-500"
          />
          <StatsCard
            title="Mas gastaste en"
            value={CATEGORY_CONFIG[topCategory]?.label || topCategory}
            change={`${Math.round(topCategoryPercent)}% del total`}
            changeType="neutral"
            icon={PieChart}
            iconColor="text-orange-500"
          />
          <StatsCard
            title="Racha"
            value={`${streak} días`}
            change={streak >= 7 ? 'Increible!' : streak >= 3 ? 'Sigue asi!' : 'Registra hoy'}
            changeType={streak >= 3 ? 'positive' : 'neutral'}
            icon={Flame}
            iconColor="text-orange-500"
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
        <ExpenseChart data={chartData} />
        <CategoryChart data={categoryData} />
      </div>

      {/* Recent expenses */}
      <RecentExpenses expenses={filteredExpenses} />

      {/* CTA to Insights */}
      {isCurrentMonth && (
        <Link href="/insights">
          <Card className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/30 hover:border-purple-500/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Sparkles className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Ver insights financieros</p>
                  <p className="text-xs text-zinc-400">Proyecciones, patrones y tips personalizados</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-purple-400" />
            </CardContent>
          </Card>
        </Link>
      )}
    </div>
  );
}
