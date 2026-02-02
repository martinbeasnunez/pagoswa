'use client';

import { useState, useEffect } from 'react';
import { Modal, ConfirmModal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { getSupabase, type Expense } from '@/lib/supabase';
import { CATEGORY_CONFIG } from '@/lib/constants';
import { CURRENCY_CONFIG } from '@/lib/currency-context';
import { Trash2, Image as ImageIcon } from 'lucide-react';

interface ExpenseEditModalProps {
  expense: Expense | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function ExpenseEditModal({ expense, isOpen, onClose, onSave }: ExpenseEditModalProps) {
  const [formData, setFormData] = useState({
    amount: '',
    currency: 'CLP',
    category: 'otros',
    merchant: '',
    description: '',
    date: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (expense) {
      setFormData({
        amount: expense.amount.toString(),
        currency: expense.currency || 'CLP',
        category: expense.category || 'otros',
        merchant: expense.merchant || '',
        description: expense.description || '',
        date: expense.date || '',
      });
    }
  }, [expense]);

  const handleSave = async () => {
    if (!expense) return;
    setIsSaving(true);

    try {
      const { error } = await getSupabase()
        .from('expenses')
        .update({
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          category: formData.category,
          merchant: formData.merchant,
          description: formData.description || null,
          date: formData.date,
        })
        .eq('id', expense.id);

      if (!error) {
        onSave();
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!expense) return;
    setIsDeleting(true);

    try {
      const { error } = await getSupabase()
        .from('expenses')
        .delete()
        .eq('id', expense.id);

      if (!error) {
        onSave();
        onClose();
        setShowDeleteConfirm(false);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (!expense) return null;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Editar gasto" size="md">
        <div className="space-y-4">
          {/* Amount & Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                Monto
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                Moneda
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {Object.entries(CURRENCY_CONFIG).map(([code, config]) => (
                  <option key={code} value={code}>
                    {config.flag} {code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Merchant */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              Comercio
            </label>
            <input
              type="text"
              value={formData.merchant}
              onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              Categoría
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.emoji} {config.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              Fecha
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              Descripción (opcional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="border-zinc-700">
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isSaving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Eliminar gasto"
        message="¿Estás seguro de que deseas eliminar este gasto? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        variant="danger"
        isLoading={isDeleting}
      />
    </>
  );
}
