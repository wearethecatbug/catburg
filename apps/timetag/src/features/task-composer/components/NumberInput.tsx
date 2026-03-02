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
    return (
        <div className="flex flex-col">
            <label htmlFor={id} className="text-xs font-medium text-gray-700 mb-1">
                {label}
            </label>
            <input
                id={id}
                type="number"
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(Math.max(min, Number(e.target.value || min)))}
                className="py-2 px-2 text-gray-700 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={ariaLabel}
            />
            {unit && <span className="text-xs text-gray-500 mt-1">{unit}</span>}
        </div>
    );
}

