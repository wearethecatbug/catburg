import React from 'react';

interface NumberInputProps {
    id: string;
    label: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    unit?: string;
    ariaLabel: string;
}

export function NumberInput({
    id,
    label,
    value,
    onChange,
    min = 1,
    max,
    unit,
    ariaLabel,
}: NumberInputProps) {
    const fieldStyle: React.CSSProperties = {
        borderColor: 'var(--tt-border)',
        background: 'var(--tt-input-bg)',
        color: 'var(--tt-text)',
    };

    return (
        <div className="flex flex-col">
            <label htmlFor={id} className="mb-1 text-xs font-medium" style={{ color: 'var(--tt-text-muted)' }}>
                {label}
            </label>
            <input
                id={id}
                type="number"
                min={min}
                max={max}
                value={value}
                onChange={(e) => {
                    let clampedValue = Math.max(min, Number(e.target.value || min)); // Ensure value is at least min
                    if (max !== undefined) {
                        clampedValue = Math.min(max, clampedValue);
                    }
                    onChange(clampedValue);
                }}
                className="rounded-xl border px-3 py-2 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--tt-ring)]"
                style={fieldStyle}
                aria-label={ariaLabel}
            />
            {unit && <span className="mt-1 text-xs" style={{ color: 'var(--tt-text-soft)' }}>{unit}</span>}
        </div>
    );
}

