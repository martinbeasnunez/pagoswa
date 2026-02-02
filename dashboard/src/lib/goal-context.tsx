'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getSupabase } from './supabase';

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currency: string;
  createdAt: string;
  completedAt?: string;
}

interface GoalContextType {
  goal: Goal | null;
  loading: boolean;
  setGoal: (goal: Goal | null) => void;
  createGoal: (name: string, targetAmount: number, currency: string) => Promise<void>;
  completeGoal: () => Promise<void>;
  deleteGoal: () => Promise<void>;
}

const GoalContext = createContext<GoalContextType | undefined>(undefined);

export function GoalProvider({ children }: { children: ReactNode }) {
  const [goal, setGoalState] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGoal();
  }, []);

  async function fetchGoal() {
    try {
      const { data, error } = await getSupabase()
        .from('goals')
        .select('*')
        .is('completed_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data && !error) {
        setGoalState({
          id: data.id,
          name: data.name,
          targetAmount: Number(data.target_amount),
          currency: data.currency,
          createdAt: data.created_at,
          completedAt: data.completed_at || undefined,
        });
      }
    } catch {
      // No active goal
    }
    setLoading(false);
  }

  const createGoal = async (name: string, targetAmount: number, currency: string) => {
    const { data, error } = await getSupabase()
      .from('goals')
      .insert({
        name,
        target_amount: targetAmount,
        currency,
      })
      .select()
      .single();

    if (data && !error) {
      setGoalState({
        id: data.id,
        name: data.name,
        targetAmount: Number(data.target_amount),
        currency: data.currency,
        createdAt: data.created_at,
        completedAt: undefined,
      });
    }
  };

  const completeGoal = async () => {
    if (!goal) return;

    await getSupabase()
      .from('goals')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', goal.id);

    setGoalState({ ...goal, completedAt: new Date().toISOString() });
  };

  const deleteGoal = async () => {
    if (!goal) return;

    await getSupabase()
      .from('goals')
      .delete()
      .eq('id', goal.id);

    setGoalState(null);
  };

  return (
    <GoalContext.Provider
      value={{
        goal,
        loading,
        setGoal: setGoalState,
        createGoal,
        completeGoal,
        deleteGoal,
      }}
    >
      {children}
    </GoalContext.Provider>
  );
}

export function useGoal() {
  const context = useContext(GoalContext);
  if (context === undefined) {
    throw new Error('useGoal must be used within a GoalProvider');
  }
  return context;
}
