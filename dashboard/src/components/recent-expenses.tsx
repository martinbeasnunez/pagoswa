'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CATEGORY_CONFIG } from '@/lib/constants';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Expense } from '@/lib/supabase';

interface RecentExpensesProps {
  expenses: Expense[];
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

export function RecentExpenses({ expenses }: RecentExpensesProps) {
  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between px-4 sm:px-6 py-4">
        <CardTitle className="text-base sm:text-lg font-semibold text-white">
          Últimos gastos
        </CardTitle>
        <Badge variant="outline" className="text-zinc-400 border-zinc-700 text-xs">
          {expenses.length} registros
        </Badge>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
        <div className="space-y-3 sm:space-y-4">
          {expenses.slice(0, 6).map((expense) => {
            const config = CATEGORY_CONFIG[expense.category] || CATEGORY_CONFIG.otros;
            const symbol = CURRENCY_SYMBOLS[expense.currency] || '$';
            return (
              <div
                key={expense.id}
                className="flex items-center justify-between py-2 sm:py-3 border-b border-zinc-800 last:border-0"
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  <div
                    className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl text-xl sm:text-2xl shrink-0"
                    style={{ backgroundColor: `${config.color}20` }}
                  >
                    {config.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white text-sm sm:text-base truncate">{expense.merchant}</p>
                    <p className="text-xs sm:text-sm text-zinc-500 truncate">
                      {format(new Date(expense.date), "d 'de' MMM", { locale: es })}
                      <span className="hidden sm:inline"> · {config.label}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="font-semibold text-white text-sm sm:text-base">
                    {symbol}{Number(expense.amount).toLocaleString()}
                  </p>
                  <p className="text-xs text-zinc-500">{expense.currency}</p>
                </div>
              </div>
            );
          })}

          {expenses.length === 0 && (
            <div className="text-center py-8 text-zinc-500">
              <p className="text-sm">No hay gastos registrados</p>
              <p className="text-xs mt-1">Envía una foto de tu factura a WhatsApp</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
