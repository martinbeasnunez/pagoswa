'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Budget {
  id: string;
  category: string | null; // null = total budget
  currency: string;
  amount: number;
  period: 'monthly' | 'weekly';
}

interface BudgetContextType {
  budgets: Budget[];
  setBudgets: (budgets: Budget[]) => void;
  addBudget: (budget: Omit<Budget, 'id'>) => void;
  updateBudget: (id: string, budget: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;
  getBudgetForCategory: (category: string | null, currency: string) => Budget | undefined;
  getTotalBudget: (currency: string) => number;
}

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

const DEFAULT_BUDGETS: Budget[] = [
  { id: '1', category: null, currency: 'CLP', amount: 500000, period: 'monthly' },
  { id: '2', category: null, currency: 'COP', amount: 2000000, period: 'monthly' },
  { id: '3', category: null, currency: 'PEN', amount: 3000, period: 'monthly' },
];

export function BudgetProvider({ children }: { children: ReactNode }) {
  const [budgets, setBudgetsState] = useState<Budget[]>(DEFAULT_BUDGETS);

  useEffect(() => {
    const savedBudgets = localStorage.getItem('pagoswa-budgets');
    if (savedBudgets) {
      try {
        setBudgetsState(JSON.parse(savedBudgets));
      } catch {
        // Use defaults
      }
    }
  }, []);

  const saveBudgets = (newBudgets: Budget[]) => {
    setBudgetsState(newBudgets);
    localStorage.setItem('pagoswa-budgets', JSON.stringify(newBudgets));
  };

  const addBudget = (budget: Omit<Budget, 'id'>) => {
    const newBudget = { ...budget, id: Date.now().toString() };
    saveBudgets([...budgets, newBudget]);
  };

  const updateBudget = (id: string, updates: Partial<Budget>) => {
    saveBudgets(budgets.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const deleteBudget = (id: string) => {
    saveBudgets(budgets.filter((b) => b.id !== id));
  };

  const getBudgetForCategory = (category: string | null, currency: string) => {
    return budgets.find((b) => b.category === category && b.currency === currency);
  };

  const getTotalBudget = (currency: string) => {
    const totalBudget = budgets.find((b) => b.category === null && b.currency === currency);
    return totalBudget?.amount || 0;
  };

  return (
    <BudgetContext.Provider
      value={{
        budgets,
        setBudgets: saveBudgets,
        addBudget,
        updateBudget,
        deleteBudget,
        getBudgetForCategory,
        getTotalBudget,
      }}
    >
      {children}
    </BudgetContext.Provider>
  );
}

export function useBudget() {
  const context = useContext(BudgetContext);
  if (context === undefined) {
    throw new Error('useBudget must be used within a BudgetProvider');
  }
  return context;
}
