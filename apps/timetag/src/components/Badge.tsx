'use client';

import React from 'react';
import { UrgencyLevel } from '@/types';
import { getUrgencyColorClass } from '@/utils';

interface BadgeProps {
  children: React.ReactNode;
  urgency?: UrgencyLevel;
  className?: string;
}

export function Badge({ children, urgency, className = '' }: BadgeProps) {
  const colorClass = urgency
    ? getUrgencyColorClass(urgency)
    : 'bg-gray-200 text-gray-700';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${colorClass} ${className}`}
    >
      {children}
    </span>
  );
}

