'use client';

import { useEffect, useState } from 'react';
import { getSupabase, type Expense } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCurrency, formatCurrency, CURRENCY_CONFIG } from '@/lib/currency-context';
import { useUser } from '@/lib/user-context';
import { exportToCSV, exportToJSON, printReport } from '@/lib/export-utils';
import { ExpenseEditModal } from '@/components/expense-edit-modal';
import { ExpenseListSkeleton } from '@/components/ui/skeleton';
import { NoExpensesState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CATEGORY_CONFIG } from '@/lib/constants';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileJson,
  FileText,
  Printer,
  Pencil,
  Search,
  X,
} from 'lucide-react';

export default function GastosPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const perPage = 10;
  const { selectedCurrency } = useCurrency();
  const { user } = useUser();

  const userPhone = user ? `telegram:${user.telegramId}` : null;

  useEffect(() => {
    if (userPhone) fetchExpenses();
  }, [userPhone]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedCurrency, searchQuery, categoryFilter]);

  async function fetchExpenses() {
    if (!userPhone) return;

    const { data, error } = await getSupabase()
      .from('expenses')
      .select('*')
      .eq('user_phone', userPhone)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && data) {
      setExpenses(data);
    }
    setLoading(false);
  }

  // Filter by selected currency
  const currencyFiltered = selectedCurrency
    ? expenses.filter((e) => e.currency === selectedCurrency)
    : expenses;

  // Filter by search query (local search in this page only)
  const searchFiltered = searchQuery
    ? currencyFiltered.filter((e) => {
        const query = searchQuery.toLowerCase();
        return (
          e.merchant?.toLowerCase().includes(query) ||
          e.description?.toLowerCase().includes(query) ||
          CATEGORY_CONFIG[e.category]?.label.toLowerCase().includes(query)
        );
      })
    : currencyFiltered;

  // Filter by category
  const filteredExpenses = categoryFilter
    ? searchFiltered.filter((e) => e.category === categoryFilter)
    : searchFiltered;

  const currencyConfig = selectedCurrency ? CURRENCY_CONFIG[selectedCurrency] : null;

  const totalPages = Math.ceil(filteredExpenses.length / perPage);
  const paginatedExpenses = filteredExpenses.slice(
    (page - 1) * perPage,
    page * perPage
  );

  const categories = [...new Set(currencyFiltered.map((e) => e.category))];

  const handleExport = (type: 'csv' | 'json' | 'print') => {
    setShowExportMenu(false);
    const title = `Gastos${selectedCurrency ? ` - ${selectedCurrency}` : ''}`;

    switch (type) {
      case 'csv':
        exportToCSV(filteredExpenses, 'gastos');
        break;
      case 'json':
        exportToJSON(filteredExpenses, 'gastos');
        break;
      case 'print':
        printReport(filteredExpenses, title);
        break;
    }
  };

  if (loading) {
    return <ExpenseListSkeleton rows={8} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Gastos</h1>
            <p className="text-sm text-zinc-500">
              {filteredExpenses.length} registros
              {currencyConfig && (
                <span className="ml-2 text-zinc-400">
                  {currencyConfig.flag} {selectedCurrency}
                </span>
              )}
            </p>
          </div>
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>

            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowExportMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl z-50 overflow-hidden">
                  <div className="p-1">
                    <button
                      onClick={() => handleExport('csv')}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-zinc-800 text-white transition-colors"
                    >
                      <FileText className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm">Exportar CSV</span>
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-zinc-800 text-white transition-colors"
                    >
                      <FileJson className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Exportar JSON</span>
                    </button>
                    <button
                      onClick={() => handleExport('print')}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-zinc-800 text-white transition-colors"
                    >
                      <Printer className="h-4 w-4 text-purple-500" />
                      <span className="text-sm">Imprimir reporte</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por comercio o descripcion..."
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2.5 pl-10 pr-10 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={categoryFilter === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCategoryFilter(null)}
          className={categoryFilter === null ? 'bg-emerald-600 hover:bg-emerald-700' : 'border-zinc-700 text-zinc-300'}
        >
          Todos
        </Button>
        {categories.map((cat) => {
          const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.otros;
          return (
            <Button
              key={cat}
              variant={categoryFilter === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoryFilter(cat)}
              className={categoryFilter === cat ? 'bg-emerald-600 hover:bg-emerald-700' : 'border-zinc-700 text-zinc-300'}
            >
              {config.emoji} <span className="hidden sm:inline ml-1">{config.label}</span>
            </Button>
          );
        })}
      </div>

      {/* Content */}
      {filteredExpenses.length === 0 ? (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-0">
            <NoExpensesState />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Table */}
          <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400 text-xs sm:text-sm">Fecha</TableHead>
                    <TableHead className="text-zinc-400 text-xs sm:text-sm">Comercio</TableHead>
                    <TableHead className="text-zinc-400 text-xs sm:text-sm hidden sm:table-cell">Categoria</TableHead>
                    <TableHead className="text-zinc-400 text-xs sm:text-sm hidden lg:table-cell">Descripcion</TableHead>
                    <TableHead className="text-zinc-400 text-right text-xs sm:text-sm">Monto</TableHead>
                    <TableHead className="text-zinc-400 w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedExpenses.map((expense) => {
                    const config = CATEGORY_CONFIG[expense.category] || CATEGORY_CONFIG.otros;
                    return (
                      <TableRow
                        key={expense.id}
                        className="border-zinc-800 hover:bg-zinc-800/50 cursor-pointer"
                        onClick={() => setEditingExpense(expense)}
                      >
                        <TableCell className="text-zinc-300 text-xs sm:text-sm whitespace-nowrap">
                          {format(new Date(expense.date), "d MMM", { locale: es })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div
                              className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg text-sm sm:text-lg flex-shrink-0"
                              style={{ backgroundColor: `${config.color}20` }}
                            >
                              {config.emoji}
                            </div>
                            <div className="min-w-0">
                              <span className="font-medium text-white text-sm block truncate max-w-[120px] sm:max-w-none">
                                {expense.merchant}
                              </span>
                              <span className="text-xs text-zinc-500 sm:hidden">{config.label}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge
                            variant="outline"
                            className="border-zinc-700 text-zinc-300 text-xs"
                            style={{ borderColor: config.color, color: config.color }}
                          >
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-zinc-400 max-w-[200px] truncate hidden lg:table-cell text-sm">
                          {expense.description || '-'}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-white text-sm whitespace-nowrap">
                          {formatCurrency(expense.amount, expense.currency || 'CLP')}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-zinc-500 hover:text-white h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingExpense(expense);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs sm:text-sm text-zinc-500">
                {(page - 1) * perPage + 1} - {Math.min(page * perPage, filteredExpenses.length)} de {filteredExpenses.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="border-zinc-700 text-zinc-300 h-8"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs sm:text-sm text-zinc-400 min-w-[80px] text-center">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="border-zinc-700 text-zinc-300 h-8"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit Modal */}
      <ExpenseEditModal
        expense={editingExpense}
        isOpen={editingExpense !== null}
        onClose={() => setEditingExpense(null)}
        onSave={() => {
          fetchExpenses();
        }}
      />
    </div>
  );
}
