'use client';

import React from 'react';
import type { UrgencyLevel } from '@/domain/task.types';
import { getUrgencyColorClass } from '@/domain/task.urgency';

type BadgeVariant = 'neutral' | 'urgency';

interface BadgeProps {
  children: React.ReactNode;
  urgency?: UrgencyLevel;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({
                        children,
                        urgency,
                        variant = 'urgency', // чтобы не сломать текущие места, где ждут цвет
                        className = '',
                      }: BadgeProps) {
  const neutral = 'border border-black/10 bg-black/5 text-black/70 dark:border-white/10 dark:bg-white/10 dark:text-white/80';

  const colorClass =
      variant === 'urgency' && urgency ? getUrgencyColorClass(urgency) : neutral;

  return (
      <span
          className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colorClass} ${className}`}
      >
      {children}
    </span>
  );
}

