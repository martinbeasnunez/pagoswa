'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CATEGORY_CONFIG } from '@/lib/constants';
import type { Expense } from '@/lib/supabase';
import {
  Flame,
  Target,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Trophy,
  AlertTriangle,
  Sparkles,
  Calendar,
  PiggyBank,
} from 'lucide-react';

interface InsightsPanelProps {
  expenses: Expense[];
  lastMonthExpenses: Expense[];
  monthlyBudget?: number;
  streak: number;
  mainCurrency: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  CLP: '$',
  COP: '$',
  USD: '$',
  PEN: 'S/',
  MXN: '$',
  ARS: '$',
  EUR: '€',
};

function formatMoney(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || '$';
  return `${symbol}${amount.toLocaleString()}`;
}

export function InsightsPanel({
  expenses,
  lastMonthExpenses,
  monthlyBudget = 500000,
  streak,
  mainCurrency,
}: InsightsPanelProps) {
  const totalMonth = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalLastMonth = lastMonthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // Calculate days in month and current day
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysRemaining = daysInMonth - currentDay;

  // Projected spending
  const dailyAvg = totalMonth / currentDay;
  const projectedTotal = dailyAvg * daysInMonth;
  const projectedSavings = monthlyBudget - projectedTotal;

  // Budget progress
  const budgetProgress = (totalMonth / monthlyBudget) * 100;
  const isOverBudget = budgetProgress > 100;
  const budgetOnTrack = budgetProgress <= (currentDay / daysInMonth) * 100;

  // Month over month change
  const momChange = totalLastMonth > 0
    ? ((totalMonth - totalLastMonth) / totalLastMonth) * 100
    : 0;

  // Category insights
  const categoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
    return acc;
  }, {} as Record<string, number>);

  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  const topCategoryPercent = topCategory ? (topCategory[1] / totalMonth) * 100 : 0;

  // Generate smart insights
  const insights: Array<{ icon: typeof Lightbulb; text: string; type: 'tip' | 'warning' | 'success' }> = [];

  if (topCategoryPercent > 40) {
    const config = CATEGORY_CONFIG[topCategory[0]] || CATEGORY_CONFIG.otros;
    insights.push({
      icon: Lightbulb,
      text: `${config.emoji} ${config.label} representa el ${Math.round(topCategoryPercent)}% de tus gastos. ¿Puedes reducirlo?`,
      type: 'tip',
    });
  }

  if (projectedSavings > 0) {
    insights.push({
      icon: PiggyBank,
      text: `A este ritmo ahorrarás ${formatMoney(Math.round(projectedSavings), mainCurrency)} este mes 🎉`,
      type: 'success',
    });
  } else if (projectedSavings < 0) {
    insights.push({
      icon: AlertTriangle,
      text: `Cuidado: Proyectas gastar ${formatMoney(Math.round(Math.abs(projectedSavings)), mainCurrency)} más de tu meta`,
      type: 'warning',
    });
  }

  if (streak >= 7) {
    insights.push({
      icon: Trophy,
      text: `¡${streak} días registrando gastos! Eres un crack 🔥`,
      type: 'success',
    });
  } else if (streak >= 3) {
    insights.push({
      icon: Flame,
      text: `${streak} días de racha. ¡Sigue así para llegar a 7!`,
      type: 'tip',
    });
  }

  if (momChange < -10 && totalLastMonth > 0) {
    insights.push({
      icon: TrendingDown,
      text: `Gastaste ${Math.round(Math.abs(momChange))}% menos que el mes pasado. ¡Excelente!`,
      type: 'success',
    });
  }

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {/* Streak Card */}
      <Card className="bg-gradient-to-br from-orange-500/20 to-red-500/20 border-orange-500/30">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-orange-300/80 font-medium">Racha actual</p>
              <p className="text-2xl sm:text-3xl font-bold text-white mt-1">{streak} días</p>
              <p className="text-xs text-orange-300/60 mt-1">
                {streak >= 7 ? '¡Increíble constancia!' : streak >= 3 ? '¡Vas muy bien!' : 'Sigue registrando'}
              </p>
            </div>
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-orange-500/30 flex items-center justify-center">
              <Flame className="h-6 w-6 sm:h-7 sm:w-7 text-orange-400" />
            </div>
          </div>
          {/* Streak dots */}
          <div className="flex gap-1 mt-4">
            {[...Array(7)].map((_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full ${
                  i < streak ? 'bg-orange-400' : 'bg-zinc-700'
                }`}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Budget Progress Card */}
      <Card className={`border ${
        isOverBudget
          ? 'bg-gradient-to-br from-red-500/20 to-pink-500/20 border-red-500/30'
          : budgetOnTrack
            ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/30'
            : 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/30'
      }`}>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-zinc-400 font-medium">Meta mensual</p>
              <p className="text-2xl sm:text-3xl font-bold text-white mt-1">
                {Math.round(budgetProgress)}%
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {formatMoney(totalMonth, mainCurrency)} / {formatMoney(monthlyBudget, mainCurrency)}
              </p>
            </div>
            <div className={`h-12 w-12 sm:h-14 sm:w-14 rounded-full flex items-center justify-center ${
              isOverBudget ? 'bg-red-500/30' : budgetOnTrack ? 'bg-emerald-500/30' : 'bg-yellow-500/30'
            }`}>
              <Target className={`h-6 w-6 sm:h-7 sm:w-7 ${
                isOverBudget ? 'text-red-400' : budgetOnTrack ? 'text-emerald-400' : 'text-yellow-400'
              }`} />
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-4 h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isOverBudget ? 'bg-red-500' : budgetOnTrack ? 'bg-emerald-500' : 'bg-yellow-500'
              }`}
              style={{ width: `${Math.min(budgetProgress, 100)}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            {daysRemaining} días restantes del mes
          </p>
        </CardContent>
      </Card>

      {/* Projection Card */}
      <Card className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 border-purple-500/30 sm:col-span-2 lg:col-span-1">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-purple-300/80 font-medium">Proyección fin de mes</p>
              <p className="text-2xl sm:text-3xl font-bold text-white mt-1">
                {formatMoney(Math.round(projectedTotal), mainCurrency)}
              </p>
              <p className={`text-xs mt-1 flex items-center gap-1 ${
                projectedSavings >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {projectedSavings >= 0 ? (
                  <>
                    <TrendingDown className="h-3 w-3" />
                    Ahorrarás {formatMoney(Math.round(projectedSavings), mainCurrency)}
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-3 w-3" />
                    Te pasarás {formatMoney(Math.round(Math.abs(projectedSavings)), mainCurrency)}
                  </>
                )}
              </p>
            </div>
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-purple-500/30 flex items-center justify-center">
              <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 text-purple-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
            <Calendar className="h-3 w-3" />
            <span>Basado en {formatMoney(Math.round(dailyAvg), mainCurrency)}/día promedio</span>
          </div>
        </CardContent>
      </Card>

      {/* Smart Insights */}
      {insights.length > 0 && (
        <Card className="bg-zinc-900/50 border-zinc-800 col-span-1 sm:col-span-2 lg:col-span-3">
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-400" />
              Insights personalizados
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {insights.map((insight, i) => (
                <div
                  key={i}
                  className={`p-3 sm:p-4 rounded-xl border ${
                    insight.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : insight.type === 'warning'
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-blue-500/10 border-blue-500/30'
                  }`}
                >
                  <p className={`text-xs sm:text-sm ${
                    insight.type === 'success'
                      ? 'text-emerald-300'
                      : insight.type === 'warning'
                      ? 'text-red-300'
                      : 'text-blue-300'
                  }`}>
                    {insight.text}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
