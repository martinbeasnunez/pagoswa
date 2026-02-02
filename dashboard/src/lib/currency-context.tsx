'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getSupabase } from './supabase';
import { useUser } from './user-context';

interface CurrencyContextType {
  selectedCurrency: string | null; // null = show all
  setSelectedCurrency: (currency: string | null) => void;
  availableCurrencies: string[];
  isLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CURRENCY_CONFIG: Record<string, { symbol: string; name: string; flag: string }> = {
  CLP: { symbol: '$', name: 'Pesos Chilenos', flag: '🇨🇱' },
  COP: { symbol: '$', name: 'Pesos Colombianos', flag: '🇨🇴' },
  USD: { symbol: '$', name: 'Dólares', flag: '🇺🇸' },
  PEN: { symbol: 'S/', name: 'Soles', flag: '🇵🇪' },
  MXN: { symbol: '$', name: 'Pesos Mexicanos', flag: '🇲🇽' },
  ARS: { symbol: '$', name: 'Pesos Argentinos', flag: '🇦🇷' },
  EUR: { symbol: '€', name: 'Euros', flag: '🇪🇺' },
};

export function formatCurrency(amount: number, currency: string): string {
  const config = CURRENCY_CONFIG[currency] || { symbol: '$' };
  return `${config.symbol}${amount.toLocaleString()}`;
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [availableCurrencies, setAvailableCurrencies] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useUser();

  useEffect(() => {
    async function fetchCurrencies() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Get user's telegram phone format
      const userPhone = `telegram:${user.telegramId}`;

      const { data } = await getSupabase()
        .from('expenses')
        .select('currency')
        .eq('user_phone', userPhone);

      if (data) {
        const currencies = [...new Set(data.map((e) => e.currency || 'CLP'))];
        setAvailableCurrencies(currencies);

        // Auto-select if only one currency, or select most common
        if (currencies.length === 1) {
          setSelectedCurrency(currencies[0]);
        } else if (currencies.length > 1) {
          // Count and select most common
          const counts: Record<string, number> = {};
          data.forEach((e) => {
            const c = e.currency || 'CLP';
            counts[c] = (counts[c] || 0) + 1;
          });
          const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
          setSelectedCurrency(sorted[0][0]);
        }
      }
      setIsLoading(false);
    }

    fetchCurrencies();
  }, [user]);

  return (
    <CurrencyContext.Provider
      value={{
        selectedCurrency,
        setSelectedCurrency,
        availableCurrencies,
        isLoading,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
