'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useGoal } from '@/lib/goal-context';
import { useCurrency, formatCurrency, CURRENCY_CONFIG } from '@/lib/currency-context';
import { CATEGORY_CONFIG } from '@/lib/constants';
import { Target, Plus, Trophy, Trash2, Lightbulb } from 'lucide-react';

interface GoalCardProps {
  savings: number;
  weeklySavings: number;
  totalSavedSinceGoal: number;
  monthlyAverage?: number;
  topCategory?: { category: string; total: number; count: number };
  compact?: boolean;
}

export function GoalCard({
  savings,
  weeklySavings,
  totalSavedSinceGoal,
  monthlyAverage = 0,
  topCategory,
  compact = false,
}: GoalCardProps) {
  const { goal, createGoal, deleteGoal, completeGoal } = useGoal();
  const { selectedCurrency } = useCurrency();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalAmount, setGoalAmount] = useState('');

  const currency = goal?.currency || selectedCurrency || 'CLP';
  const currencyConfig = CURRENCY_CONFIG[currency];

  const handleCreate = () => {
    if (!goalName || !goalAmount) return;
    createGoal(goalName, parseFloat(goalAmount), currency);
    setShowCreateModal(false);
    setGoalName('');
    setGoalAmount('');
  };

  const handleDelete = () => {
    deleteGoal();
    setShowDetailsModal(false);
  };

  // Calculate progress
  const progress = goal ? Math.min((totalSavedSinceGoal / goal.targetAmount) * 100, 100) : 0;
  const remaining = goal ? Math.max(goal.targetAmount - totalSavedSinceGoal, 0) : 0;

  // Calculate estimated time to goal
  const weeksToGoal = weeklySavings > 0 ? Math.ceil(remaining / weeklySavings) : null;
  const getTimeEstimate = () => {
    if (!weeksToGoal || weeklySavings <= 0) return null;
    if (weeksToGoal <= 1) return '<1 sem';
    if (weeksToGoal <= 4) return `~${weeksToGoal} sem`;
    const months = Math.ceil(weeksToGoal / 4);
    return `~${months} mes${months > 1 ? 'es' : ''}`;
  };

  // Calculate suggestion based on top category
  const getSuggestion = () => {
    if (!goal || !topCategory || topCategory.total <= 0) return null;

    const catConfig = CATEGORY_CONFIG[topCategory.category];
    const catName = catConfig?.label || topCategory.category;
    const catEmoji = catConfig?.emoji || '📦';

    // Suggest reducing top category by 30%
    const reductionPercent = 0.3;
    const monthlyReduction = topCategory.total * reductionPercent;
    const monthsToGoal = monthlyReduction > 0 ? Math.ceil(remaining / monthlyReduction) : null;

    if (!monthsToGoal || monthsToGoal > 24) return null;

    const reducedAmount = Math.round(topCategory.total * (1 - reductionPercent));

    return {
      category: catName,
      emoji: catEmoji,
      currentAmount: topCategory.total,
      reducedAmount,
      monthsToGoal,
      monthlyReduction,
    };
  };

  const suggestion = getSuggestion();
  const timeEstimate = getTimeEstimate();

  // Goal completed
  if (goal && progress >= 100 && !goal.completedAt) {
    return (
      <>
        <Card
          className="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/30 cursor-pointer h-full"
          onClick={() => setShowDetailsModal(true)}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-400" />
                <span className="text-xs text-yellow-300">Meta lograda!</span>
              </div>
            </div>
            <p className="text-sm font-bold text-white truncate">{goal.name}</p>
            <p className="text-xs text-yellow-400 mt-1">
              {formatCurrency(goal.targetAmount, currency)}
            </p>
          </CardContent>
        </Card>

        <Modal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          title="Meta alcanzada!"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-zinc-400">
              Lograste tu meta "{goal.name}" de {formatCurrency(goal.targetAmount, currency)}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-zinc-700"
                onClick={handleDelete}
              >
                Cerrar
              </Button>
              <Button
                className="flex-1 bg-yellow-600 hover:bg-yellow-700"
                onClick={() => {
                  completeGoal();
                  deleteGoal();
                  setShowDetailsModal(false);
                  setShowCreateModal(true);
                }}
              >
                Nueva meta
              </Button>
            </div>
          </div>
        </Modal>
      </>
    );
  }

  // Has active goal
  if (goal) {
    return (
      <>
        <Card
          className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-500/30 cursor-pointer h-full"
          onClick={() => setShowDetailsModal(true)}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-violet-400" />
                <span className="text-xs text-zinc-400 truncate">{goal.name}</span>
              </div>
              <span className="text-xs text-zinc-500">
                {formatCurrency(totalSavedSinceGoal, currency)} / {formatCurrency(goal.targetAmount, currency)}
              </span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all"
                style={{ width: `${Math.max(progress, 1)}%` }}
              />
            </div>
            <p className="text-xs mt-1">
              {timeEstimate ? (
                <span className="text-violet-300">{timeEstimate}</span>
              ) : suggestion ? (
                <span className="text-amber-400">Reduce {suggestion.emoji} {suggestion.category} → {suggestion.monthsToGoal}m</span>
              ) : topCategory ? (
                <span className="text-zinc-400">Reduce {CATEGORY_CONFIG[topCategory.category]?.emoji} {CATEGORY_CONFIG[topCategory.category]?.label}</span>
              ) : (
                <span className="text-zinc-500">Gasta menos para avanzar</span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Details Modal with Suggestion */}
        <Modal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          title={goal.name}
          size="sm"
        >
          <div className="space-y-4">
            {/* Progress */}
            <div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-bold text-violet-400">
                  {formatCurrency(totalSavedSinceGoal, currency)}
                </span>
                <span className="text-zinc-500">
                  / {formatCurrency(goal.targetAmount, currency)}
                </span>
              </div>
              <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"
                  style={{ width: `${Math.max(progress, 1)}%` }}
                />
              </div>
              <p className="text-sm text-zinc-400 mt-2">
                {progress.toFixed(1)}% completado
                {timeEstimate && ` · ${timeEstimate}`}
              </p>
            </div>

            {/* Suggestion */}
            {suggestion && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-amber-200 font-medium">
                      Tip para llegar más rápido
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Si reduces <span className="text-white">{suggestion.emoji} {suggestion.category}</span> de{' '}
                      <span className="text-white">{formatCurrency(suggestion.currentAmount, currency)}</span> a{' '}
                      <span className="text-emerald-400">{formatCurrency(suggestion.reducedAmount, currency)}</span>/mes
                    </p>
                    <p className="text-xs text-amber-300 mt-1">
                      → Llegas en ~{suggestion.monthsToGoal} {suggestion.monthsToGoal === 1 ? 'mes' : 'meses'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!suggestion && !timeEstimate && topCategory && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-amber-200 font-medium">
                      Tu mayor gasto es {CATEGORY_CONFIG[topCategory.category]?.emoji} {CATEGORY_CONFIG[topCategory.category]?.label}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Estás gastando <span className="text-white">{formatCurrency(topCategory.total, currency)}</span> este mes.
                      Reducir esta categoría te ayudará a avanzar más rápido.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!suggestion && !timeEstimate && !topCategory && (
              <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <p className="text-sm text-zinc-400">
                  Necesitas gastar menos que tu promedio para avanzar hacia tu meta.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-zinc-700"
                onClick={() => setShowDetailsModal(false)}
              >
                Cerrar
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Eliminar
              </Button>
            </div>
          </div>
        </Modal>
      </>
    );
  }

  // No goal - show CTA
  return (
    <>
      <Card
        className="bg-zinc-900/50 border-zinc-800 border-dashed hover:border-violet-500/50 transition-colors cursor-pointer group h-full"
        onClick={() => setShowCreateModal(true)}
      >
        <CardContent className="p-3 flex items-center gap-3 h-full">
          <Target className="h-4 w-4 text-violet-400" />
          <span className="text-xs text-zinc-400 group-hover:text-zinc-300 flex-1">
            ¿Ahorrando para algo?
          </span>
          <Plus className="h-4 w-4 text-zinc-600 group-hover:text-violet-400" />
        </CardContent>
      </Card>

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nueva meta"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              ¿Para qué estás ahorrando?
            </label>
            <input
              type="text"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              placeholder="Ej: Entrada concierto, Pasajes..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              Monto ({currencyConfig?.symbol || '$'})
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                {currencyConfig?.symbol || '$'}
              </span>
              <input
                type="number"
                value={goalAmount}
                onChange={(e) => setGoalAmount(e.target.value)}
                placeholder="120000"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 pl-8 pr-3 py-2 text-white focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>

          <p className="text-xs text-zinc-500">
            Tu progreso se calcula según cuánto gastas menos que tu promedio
          </p>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 border-zinc-700"
              onClick={() => setShowCreateModal(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-violet-600 hover:bg-violet-700"
              onClick={handleCreate}
              disabled={!goalName || !goalAmount}
            >
              Crear
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
