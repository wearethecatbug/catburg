'use client';

import React from 'react';

// ============================================================================
// Icon Types
// ============================================================================

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface IconProps {
  /** Icon size preset */
  size?: IconSize;
  /** Custom className for additional styling */
  className?: string;
  /** Color class (e.g., 'text-gray-500') — applied via className */
  color?: string;
  /** Accessibility label */
  'aria-label'?: string;
  /** Hide from screen readers */
  'aria-hidden'?: boolean;
}

const SIZE_MAP: Record<IconSize, { className: string; width: number; height: number }> = {
  xs: { className: 'w-3 h-3', width: 12, height: 12 },
  sm: { className: 'w-4 h-4', width: 16, height: 16 },
  md: { className: 'w-5 h-5', width: 20, height: 20 },
  lg: { className: 'w-6 h-6', width: 24, height: 24 },
  xl: { className: 'w-7 h-7', width: 28, height: 28 },
};

export interface IconBaseProps extends IconProps {
  children: React.ReactNode;
  viewBox?: string;
  fill?: string;
  stroke?: string;
}

/**
 * Base SVG wrapper for all icons.
 * Ensures consistent sizing, scaling and accessibility.
 */
export function IconBase({
  size = 'md',
  className = '',
  color = 'currentColor',
  children,
  viewBox = '0 0 24 24',
  fill = 'none',
  stroke = 'currentColor',
  'aria-label': ariaLabel,
  'aria-hidden': ariaHidden = true,
}: IconBaseProps) {
  const s = SIZE_MAP[size];

  return (
    <svg
      className={`${s.className} shrink-0 ${color} ${className}`}
      width={s.width}
      height={s.height}
      viewBox={viewBox}
      fill={fill}
      stroke={stroke}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden}
    >
      {children}
    </svg>
  );
}

