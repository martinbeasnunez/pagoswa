import { createClient } from '@supabase/supabase-js';
import type { Expense, User } from '../types/index.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Usuarios
export async function getOrCreateUser(phone: string, name?: string): Promise<User> {
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .single();

  if (existing) return existing;

  const { data: newUser, error } = await supabase
    .from('users')
    .insert({ phone, name })
    .select()
    .single();

  if (error) throw error;
  return newUser;
}

// Gastos
export async function saveExpense(expense: Omit<Expense, 'id' | 'created_at'>): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .insert(expense)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getExpensesByUser(phone: string, limit = 10): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_phone', phone)
    .order('date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getMonthlyExpenses(phone: string, year: number, month: number): Promise<Expense[]> {
  const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_phone', phone)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getExpensesByCategory(phone: string, year: number, month: number) {
  const expenses = await getMonthlyExpenses(phone, year, month);

  const byCategory: Record<string, { total: number; count: number }> = {};

  for (const expense of expenses) {
    if (!byCategory[expense.category]) {
      byCategory[expense.category] = { total: 0, count: 0 };
    }
    byCategory[expense.category]!.total += expense.amount;
    byCategory[expense.category]!.count += 1;
  }

  return byCategory;
}
