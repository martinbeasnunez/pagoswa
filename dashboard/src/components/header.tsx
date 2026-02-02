'use client';

import { ChevronDown, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useCurrency, CURRENCY_CONFIG } from '@/lib/currency-context';
import { useUser } from '@/lib/user-context';
import { useState, useRef, useEffect } from 'react';

export function Header() {
  const { selectedCurrency, setSelectedCurrency, availableCurrencies, isLoading } = useCurrency();
  const { user, logout } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentConfig = selectedCurrency ? CURRENCY_CONFIG[selectedCurrency] : null;

  // Get initials from user name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center justify-between border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl px-4 sm:px-6">
      {/* Left spacer for mobile menu button */}
      <div className="w-10 lg:hidden" />

      {/* Center - empty or future use */}
      <div className="flex-1" />

      {/* Right section */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Currency Selector */}
        {!isLoading && availableCurrencies.length > 1 && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors"
            >
              {currentConfig && (
                <>
                  <span className="text-base sm:text-lg">{currentConfig.flag}</span>
                  <span className="text-xs sm:text-sm font-medium text-white hidden sm:inline">
                    {selectedCurrency}
                  </span>
                </>
              )}
              <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Currency Dropdown */}
            {isOpen && (
              <div className="absolute right-0 mt-2 w-48 sm:w-56 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl z-50 overflow-hidden">
                <div className="p-1">
                  {availableCurrencies.map((currency) => {
                    const config = CURRENCY_CONFIG[currency] || { flag: '🏳️', name: currency, symbol: '$' };
                    const isSelected = currency === selectedCurrency;
                    return (
                      <button
                        key={currency}
                        onClick={() => {
                          setSelectedCurrency(currency);
                          setIsOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                          isSelected
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'hover:bg-zinc-800 text-white'
                        }`}
                      >
                        <span className="text-xl">{config.flag}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{currency}</p>
                          <p className="text-xs text-zinc-500">{config.name}</p>
                        </div>
                        {isSelected && (
                          <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Single currency badge */}
        {!isLoading && availableCurrencies.length === 1 && currentConfig && (
          <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
            <span className="text-base">{currentConfig.flag}</span>
            <span className="text-xs font-medium text-zinc-400">{selectedCurrency}</span>
          </div>
        )}

        {/* User avatar with dropdown */}
        {user && (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity"
            >
              <Avatar className="h-8 w-8 sm:h-9 sm:w-9 border-2 border-zinc-700">
                <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs sm:text-sm">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-white">{user.name}</p>
                <p className="text-xs text-zinc-500">
                  {user.username ? `@${user.username}` : 'via Telegram'}
                </p>
              </div>
              <ChevronDown className={`h-4 w-4 text-zinc-400 hidden md:block transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* User Menu Dropdown */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl z-50 overflow-hidden">
                <div className="p-2 border-b border-zinc-800">
                  <p className="text-sm font-medium text-white">{user.name}</p>
                  <p className="text-xs text-zinc-500">
                    {user.username ? `@${user.username}` : 'Telegram'}
                  </p>
                </div>
                <div className="p-1">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="text-sm">Cerrar sesión</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
