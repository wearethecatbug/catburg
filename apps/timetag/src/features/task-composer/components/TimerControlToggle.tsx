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
            className={`flex items-center gap-3 p-2 border border-gray-200 rounded cursor-pointer hover:bg-white transition-colors ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
        >
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                disabled={disabled}
                className="w-4 h-4 rounded border-gray-300 accent-blue-600 disabled:cursor-not-allowed"
                aria-label={ariaLabel}
            />
            <div className="flex-1">
                <span className="text-xs font-medium text-gray-700">{label}</span>
                <div className="text-xs text-gray-500">{description}</div>
            </div>
        </label>
    );
}

