import React from 'react';

interface QueryControlTriggerProps {
  icon: React.ReactNode;
  label: string;
  trailing?: React.ReactNode;
  className?: string;
}

export function QueryControlTrigger({
  icon,
  label,
  trailing,
  className = '',
}: QueryControlTriggerProps) {
  return (
    <span
      className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm ${className}`.trim()}
      title={label}
      style={{
        color: 'var(--tt-text)',
        background: 'var(--tt-surface-subtle)',
        borderColor: 'var(--tt-border)',
      }}
    >
      <span aria-hidden="true" className="shrink-0">
        {icon}
      </span>
      <span className="hidden sm:inline">{label}</span>
      <span className="sr-only sm:hidden">{label}</span>
      {trailing ? (
        <span aria-hidden="true" className="shrink-0">
          {trailing}
        </span>
      ) : null}
    </span>
  );
}


