'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getSupabase } from './supabase';

interface User {
  telegramId: string;
  name: string;
  username?: string;
}

interface UserContextType {
  user: User | null;
  isLoading: boolean;
  login: (code: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'pagoswa_user';

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (code: string): Promise<{ success: boolean; error?: string }> => {
    const normalizedCode = code.toUpperCase().trim();

    // Find the code in database
    const { data, error } = await getSupabase()
      .from('link_codes')
      .select('*')
      .eq('code', normalizedCode)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      return { success: false, error: 'Código inválido o expirado' };
    }

    // Mark code as used
    await getSupabase()
      .from('link_codes')
      .update({ used: true })
      .eq('id', data.id);

    // Create user object
    const newUser: User = {
      telegramId: data.telegram_id,
      name: data.telegram_name || 'Usuario',
      username: data.telegram_username,
    };

    // Save to state and localStorage
    setUser(newUser);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));

    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
  };

  return (
    <UserContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
}
