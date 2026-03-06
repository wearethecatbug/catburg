'use client';

import React from 'react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  className = '',
  'aria-label': ariaLabel,
}: CheckboxProps) {
  return (
    <label className={`flex items-center gap-2 cursor-pointer ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
        aria-label={ariaLabel}
      />
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </label>
  );
}

