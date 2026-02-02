'use client';

import { usePathname } from 'next/navigation';
import { useUser } from '@/lib/user-context';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (!isLoading && !user && !isLoginPage) {
      router.push('/login');
    }
    if (!isLoading && user && isLoginPage) {
      router.push('/');
    }
  }, [user, isLoading, isLoginPage, router]);

  // Show loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600" />
        </div>
      </div>
    );
  }

  // Login page - no shell
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Not logged in - show loading while redirecting
  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600" />
        </div>
      </div>
    );
  }

  // Logged in - show full app
  return (
    <>
      <Sidebar />
      <div className="lg:pl-64">
        <Header />
        <main className="min-h-[calc(100vh-4rem)] p-4 pt-16 sm:p-6 sm:pt-6 lg:pt-6">
          {children}
        </main>
      </div>
    </>
  );
}
