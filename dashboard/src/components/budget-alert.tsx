'use client';

import { useBudget } from '@/lib/budget-context';
import { formatCurrency } from '@/lib/currency-context';
import { AlertTriangle, TrendingUp, CheckCircle } from 'lucide-react';

interface BudgetAlertProps {
  spent: number;
  currency: string;
  category?: string | null;
}

export function BudgetAlert({ spent, currency, category = null }: BudgetAlertProps) {
  const { getBudgetForCategory, getTotalBudget } = useBudget();

  const budget = category
    ? getBudgetForCategory(category, currency)
    : { amount: getTotalBudget(currency), category: null, currency, period: 'monthly' as const, id: 'total' };

  if (!budget || budget.amount === 0) return null;

  const percentage = (spent / budget.amount) * 100;
  const remaining = budget.amount - spent;

  if (percentage < 50) return null; // Don't show if under 50%

  let variant: 'warning' | 'danger' | 'success' = 'warning';
  let message = '';
  let Icon = TrendingUp;

  if (percentage >= 100) {
    variant = 'danger';
    message = `Te pasaste del presupuesto por ${formatCurrency(Math.abs(remaining), currency)}`;
    Icon = AlertTriangle;
  } else if (percentage >= 80) {
    variant = 'danger';
    message = `Solo te quedan ${formatCurrency(remaining, currency)} del presupuesto`;
    Icon = AlertTriangle;
  } else if (percentage >= 50) {
    variant = 'warning';
    message = `Has gastado el ${percentage.toFixed(0)}% del presupuesto`;
    Icon = TrendingUp;
  }

  const variantStyles = {
    warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
    danger: 'bg-red-500/10 border-red-500/30 text-red-300',
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  };

  const iconStyles = {
    warning: 'text-yellow-400',
    danger: 'text-red-400',
    success: 'text-emerald-400',
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${variantStyles[variant]}`}>
      <Icon className={`h-5 w-5 ${iconStyles[variant]} flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{message}</p>
        <div className="mt-2 h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              percentage >= 100 ? 'bg-red-500' : percentage >= 80 ? 'bg-yellow-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <p className="text-xs text-zinc-500 mt-1">
          {formatCurrency(spent, currency)} de {formatCurrency(budget.amount, currency)}
        </p>
      </div>
    </div>
  );
}

export function BudgetProgress({ spent, budget, currency }: { spent: number; budget: number; currency: string }) {
  if (budget === 0) return null;

  const percentage = Math.min((spent / budget) * 100, 100);
  const isOver = spent > budget;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-400">Presupuesto</span>
        <span className={isOver ? 'text-red-400' : 'text-zinc-300'}>
          {formatCurrency(spent, currency)} / {formatCurrency(budget, currency)}
        </span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isOver ? 'bg-red-500' : percentage > 80 ? 'bg-yellow-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
