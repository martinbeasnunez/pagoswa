'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Receipt,
  PieChart,
  Sparkles,
  Settings,
  MessageCircle,
  Menu,
  X,
} from 'lucide-react';
import { useState, useEffect } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Gastos', href: '/gastos', icon: Receipt },
  { name: 'Categorías', href: '/categorias', icon: PieChart },
  { name: 'Insights', href: '/insights', icon: Sparkles },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Close sidebar when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-4 z-40 p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-zinc-950 border-r border-zinc-800 transition-transform duration-300 ease-in-out',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Close button (mobile) */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 p-1 rounded-lg text-zinc-400 hover:text-white lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-zinc-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
            <MessageCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">PagosWA</h1>
            <p className="text-xs text-zinc-500">Control de gastos</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 p-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
                )}
              >
                <item.icon className={cn('h-5 w-5', isActive && 'text-emerald-500')} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-zinc-800">
          <Link
            href="/configuracion"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
              pathname === '/configuracion'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
            )}
          >
            <Settings className={cn('h-5 w-5', pathname === '/configuracion' && 'text-emerald-500')} />
            Configuración
          </Link>
        </div>
      </aside>
    </>
  );
}
