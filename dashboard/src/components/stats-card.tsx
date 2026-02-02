'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  iconColor?: string;
}

export function StatsCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  iconColor = 'text-emerald-500',
}: StatsCardProps) {
  return (
    <Card className="relative overflow-hidden bg-zinc-900/50 border-zinc-800 p-3 sm:p-4 md:p-6 transition-all hover:bg-zinc-900/80 glow-card">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />

      <div className="relative flex items-start justify-between gap-2">
        <div className="space-y-1 sm:space-y-2 min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-zinc-400 truncate">{title}</p>
          <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white truncate">{value}</p>
          {change && (
            <p
              className={cn(
                'text-xs sm:text-sm font-medium truncate',
                changeType === 'positive' && 'text-emerald-500',
                changeType === 'negative' && 'text-red-500',
                changeType === 'neutral' && 'text-zinc-400'
              )}
            >
              {change}
            </p>
          )}
        </div>
        <div className={cn('p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-zinc-800/80 shrink-0', iconColor)}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
        </div>
      </div>
    </Card>
  );
}
