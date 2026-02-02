'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBudget, type Budget } from '@/lib/budget-context';
import { useCurrency, CURRENCY_CONFIG, formatCurrency } from '@/lib/currency-context';
import { CATEGORY_CONFIG } from '@/lib/constants';
import { Plus, Trash2, Target, Wallet } from 'lucide-react';
import { Modal } from '@/components/ui/modal';

export default function ConfiguracionPage() {
  const { budgets, addBudget, updateBudget, deleteBudget } = useBudget();
  const { selectedCurrency } = useCurrency();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [formData, setFormData] = useState({
    category: '',
    currency: 'CLP',
    amount: '',
  });

  const handleAdd = () => {
    if (!formData.amount) return;
    addBudget({
      category: formData.category || null,
      currency: formData.currency,
      amount: parseFloat(formData.amount),
      period: 'monthly',
    });
    setShowAddModal(false);
    setFormData({ category: '', currency: 'CLP', amount: '' });
  };

  const handleUpdate = () => {
    if (!editingBudget || !formData.amount) return;
    updateBudget(editingBudget.id, {
      amount: parseFloat(formData.amount),
    });
    setEditingBudget(null);
    setFormData({ category: '', currency: 'CLP', amount: '' });
  };

  const openEditModal = (budget: Budget) => {
    setEditingBudget(budget);
    setFormData({
      category: budget.category || '',
      currency: budget.currency,
      amount: budget.amount.toString(),
    });
  };

  const totalBudgets = budgets.filter((b) => b.category === null);
  const categoryBudgets = budgets.filter((b) => b.category !== null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Configuracion</h1>
          <p className="text-sm text-zinc-500">Administra tus presupuestos</p>
        </div>
      </div>

      {/* Total Budgets */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
            <Wallet className="h-5 w-5 text-emerald-500" />
            Presupuesto mensual
          </CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setFormData({ category: '', currency: selectedCurrency || 'CLP', amount: '' });
              setShowAddModal(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Agregar</span>
          </Button>
        </CardHeader>
        <CardContent>
          {totalBudgets.length === 0 ? (
            <p className="text-zinc-500 text-sm">No has configurado presupuestos</p>
          ) : (
            <div className="space-y-3">
              {totalBudgets.map((budget) => {
                const currencyConfig = CURRENCY_CONFIG[budget.currency];
                return (
                  <div
                    key={budget.id}
                    className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl sm:text-2xl">{currencyConfig?.flag || '🏳️'}</span>
                      <div>
                        <p className="text-xs sm:text-sm text-zinc-400">{currencyConfig?.name || budget.currency}</p>
                        <p className="text-lg sm:text-xl font-bold text-white">
                          {formatCurrency(budget.amount, budget.currency)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(budget)}
                        className="text-zinc-400 hover:text-white text-xs sm:text-sm"
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteBudget(budget.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Budgets */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-500" />
            Limites por categoria
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setFormData({ category: 'alimentacion', currency: selectedCurrency || 'CLP', amount: '' });
              setShowAddModal(true);
            }}
            className="border-zinc-700"
          >
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Agregar</span>
          </Button>
        </CardHeader>
        <CardContent>
          {categoryBudgets.length === 0 ? (
            <p className="text-zinc-500 text-sm">
              Establece limites para categorias especificas
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {categoryBudgets.map((budget) => {
                const catConfig = CATEGORY_CONFIG[budget.category || ''];
                return (
                  <div
                    key={budget.id}
                    className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg text-lg sm:text-xl"
                        style={{ backgroundColor: `${catConfig?.color}20` }}
                      >
                        {catConfig?.emoji || '📦'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {catConfig?.label || budget.category}
                        </p>
                        <p className="text-xs sm:text-sm text-zinc-400">
                          {formatCurrency(budget.amount, budget.currency)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteBudget(budget.id)}
                      className="text-zinc-400 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAddModal || editingBudget !== null}
        onClose={() => {
          setShowAddModal(false);
          setEditingBudget(null);
        }}
        title={editingBudget ? 'Editar presupuesto' : 'Nuevo presupuesto'}
        size="sm"
      >
        <div className="space-y-4">
          {!editingBudget && (
            <>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                  Tipo
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Total mensual</option>
                  {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.emoji} {config.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                  Moneda
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                >
                  {Object.entries(CURRENCY_CONFIG).map(([code, config]) => (
                    <option key={code} value={code}>
                      {config.flag} {code} - {config.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              Monto limite
            </label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="Ej: 500000"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 border-zinc-700"
              onClick={() => {
                setShowAddModal(false);
                setEditingBudget(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={editingBudget ? handleUpdate : handleAdd}
            >
              {editingBudget ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
