import React from 'react';

interface TimerControlToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    label: string;
    description: string;
    ariaLabel: string;
}

export function TimerControlToggle({
    checked,
    onChange,
    disabled = false,
    label,
    description,
    ariaLabel,
}: TimerControlToggleProps) {
    return (
        <label
            className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{
                borderColor: 'var(--tt-border)',
                background: 'var(--tt-surface)',
                boxShadow: 'var(--tt-shadow-soft)',
            }}
        >
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                disabled={disabled}
                className="h-4 w-4 rounded disabled:cursor-not-allowed"
                style={{ accentColor: 'var(--tt-accent)' }}
                aria-label={ariaLabel}
            />
            <div className="flex-1">
                <span className="text-xs font-medium" style={{ color: 'var(--tt-text)' }}>{label}</span>
                <div className="text-xs" style={{ color: 'var(--tt-text-muted)' }}>{description}</div>
            </div>
        </label>
    );
}

