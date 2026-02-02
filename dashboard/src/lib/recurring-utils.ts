import { type Expense } from './supabase';
import { differenceInDays, parseISO, format } from 'date-fns';

export interface RecurringExpense {
  merchant: string;
  category: string;
  avgAmount: number;
  currency: string;
  frequency: 'weekly' | 'monthly' | 'yearly';
  occurrences: number;
  lastDate: string;
  nextExpectedDate: string;
  expenses: Expense[];
}

export function detectRecurringExpenses(expenses: Expense[]): RecurringExpense[] {
  // Group expenses by merchant (normalized)
  const byMerchant = expenses.reduce((acc, expense) => {
    const key = normalizemerchant(expense.merchant);
    if (!acc[key]) acc[key] = [];
    acc[key].push(expense);
    return acc;
  }, {} as Record<string, Expense[]>);

  const recurring: RecurringExpense[] = [];

  for (const [merchant, exps] of Object.entries(byMerchant)) {
    // Need at least 2 occurrences to detect a pattern
    if (exps.length < 2) continue;

    // Sort by date
    const sorted = [...exps].sort((a, b) =>
      parseISO(a.date).getTime() - parseISO(b.date).getTime()
    );

    // Calculate intervals between occurrences
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const days = differenceInDays(
        parseISO(sorted[i].date),
        parseISO(sorted[i - 1].date)
      );
      intervals.push(days);
    }

    // Calculate average interval
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    // Determine frequency based on average interval
    let frequency: 'weekly' | 'monthly' | 'yearly' | null = null;
    if (avgInterval >= 5 && avgInterval <= 9) {
      frequency = 'weekly';
    } else if (avgInterval >= 25 && avgInterval <= 35) {
      frequency = 'monthly';
    } else if (avgInterval >= 350 && avgInterval <= 380) {
      frequency = 'yearly';
    }

    // If no clear pattern, skip
    if (!frequency) continue;

    // Check consistency (standard deviation should be low)
    const stdDev = Math.sqrt(
      intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length
    );

    // If too much variation, not a recurring expense
    if (stdDev > avgInterval * 0.3) continue;

    // Calculate average amount
    const avgAmount = sorted.reduce((sum, e) => sum + Number(e.amount), 0) / sorted.length;
    const lastExpense = sorted[sorted.length - 1];
    const lastDate = parseISO(lastExpense.date);

    // Calculate next expected date
    const daysToAdd = frequency === 'weekly' ? 7 : frequency === 'monthly' ? 30 : 365;
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + daysToAdd);

    recurring.push({
      merchant: exps[0].merchant, // Use original merchant name
      category: exps[0].category,
      avgAmount: Math.round(avgAmount),
      currency: exps[0].currency || 'CLP',
      frequency,
      occurrences: sorted.length,
      lastDate: lastExpense.date,
      nextExpectedDate: format(nextDate, 'yyyy-MM-dd'),
      expenses: sorted,
    });
  }

  // Sort by average amount descending
  return recurring.sort((a, b) => b.avgAmount - a.avgAmount);
}

function normalizemerchant(merchant: string): string {
  return merchant
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function getMonthlyRecurringTotal(recurring: RecurringExpense[]): number {
  return recurring.reduce((total, r) => {
    const multiplier = r.frequency === 'weekly' ? 4.33 : r.frequency === 'yearly' ? 1 / 12 : 1;
    return total + r.avgAmount * multiplier;
  }, 0);
}

export function formatFrequency(frequency: 'weekly' | 'monthly' | 'yearly'): string {
  switch (frequency) {
    case 'weekly':
      return 'Semanal';
    case 'monthly':
      return 'Mensual';
    case 'yearly':
      return 'Anual';
  }
}
