import { ReactNode } from 'react';
import { FileQuestion, Search, TrendingUp, Wallet, Receipt, Calendar } from 'lucide-react';

interface EmptyStateProps {
  icon?: 'search' | 'expenses' | 'trends' | 'calendar' | 'receipt' | 'default';
  title: string;
  description?: string;
  action?: ReactNode;
}

const icons = {
  search: Search,
  expenses: Wallet,
  trends: TrendingUp,
  calendar: Calendar,
  receipt: Receipt,
  default: FileQuestion,
};

export function EmptyState({ icon = 'default', title, description, action }: EmptyStateProps) {
  const Icon = icons[icon];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="relative mb-6">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full blur-2xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-zinc-800/80 border border-zinc-700">
          <Icon className="h-10 w-10 text-zinc-400" />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-white mb-2 text-center">{title}</h3>

      {description && (
        <p className="text-sm text-zinc-400 text-center max-w-sm mb-6">{description}</p>
      )}

      {action && <div>{action}</div>}
    </div>
  );
}

export function NoResultsState({ query }: { query: string }) {
  return (
    <EmptyState
      icon="search"
      title="Sin resultados"
      description={`No encontramos gastos que coincidan con "${query}". Intenta con otros términos.`}
    />
  );
}

export function NoExpensesState() {
  return (
    <EmptyState
      icon="expenses"
      title="No hay gastos registrados"
      description="Envía una foto de tu recibo por WhatsApp para comenzar a registrar tus gastos."
    />
  );
}

export function NoDataForPeriodState() {
  return (
    <EmptyState
      icon="calendar"
      title="Sin datos en este período"
      description="No hay gastos registrados para el período seleccionado."
    />
  );
}
