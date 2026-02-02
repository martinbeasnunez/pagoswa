import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Using the same Supabase instance as the bot
const SUPABASE_URL = 'https://vdwaupekoqmvicogcgpu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkd2F1cGVrb3Ftdmljb2djZ3B1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2OTg0MDgsImV4cCI6MjA4MzI3NDQwOH0.-q159SLrW0Vc749K2uyxhEpy9q6KKHrxFHwt0iNG0bI';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase() {
  if (supabaseInstance) return supabaseInstance;
  supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabaseInstance;
}

export type Expense = {
  id: string;
  user_phone: string;
  amount: number;
  currency: string;
  category: string;
  merchant: string;
  description: string | null;
  date: string;
  created_at: string;
};

export type CategorySummary = {
  category: string;
  total: number;
  count: number;
};
