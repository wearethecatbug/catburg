'use client';

import React from 'react';
import {
    clampDurationSec,
    formatDurationValue,
    toDurationSec,
    type DurationUnit,
} from '@/domain/duration';

interface DurationFieldProps {
    durationSec: number;
    unit: DurationUnit;
    presetLabel?: string;
    onDurationSecChange: (value: number) => void;
    onUnitChange: (unit: DurationUnit) => void;
}

const UNIT_OPTIONS: Array<{ value: DurationUnit; label: string }> = [
    { value: 'min', label: 'min' },
    { value: 'h', label: 'h' },
    { value: 'd', label: 'd' },
];

export function DurationField({
                                  durationSec,
                                  unit,
                                  presetLabel,
                                  onDurationSecChange,
                                  onUnitChange,
                              }: DurationFieldProps) {
    const [inputValue, setInputValue] = React.useState(() =>
        formatDurationValue(durationSec, unit),
    );

    React.useEffect(() => {
        setInputValue(formatDurationValue(durationSec, unit));
    }, [durationSec, unit]);

    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        setInputValue(raw);

        if (raw.trim() === '') return;

        const parsed = Number(raw);
        if (Number.isNaN(parsed)) return;

        const nextSec = clampDurationSec(toDurationSec(parsed, unit));
        onDurationSecChange(nextSec);
    };

    const handleBlur = () => {
        if (inputValue.trim() === '') {
            setInputValue(formatDurationValue(durationSec, unit));
            return;
        }

        const parsed = Number(inputValue);
        if (Number.isNaN(parsed)) {
            setInputValue(formatDurationValue(durationSec, unit));
            return;
        }

        const nextSec = clampDurationSec(toDurationSec(parsed, unit));
        onDurationSecChange(nextSec);
        setInputValue(formatDurationValue(nextSec, unit));
    };

    const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onUnitChange(e.target.value as DurationUnit);
    };

    return (
        <div className="flex flex-col">
            <label htmlFor="duration-value" className="mb-1 text-xs font-medium" style={{ color: 'var(--tt-text-muted)' }}>
                Duration
            </label>

            <div className="flex gap-2">
                <input
                    id="duration-value"
                    type="number"
                    inputMode="decimal"
                    step={unit === 'min' ? 1 : 'any'}
                    value={inputValue}
                    onChange={handleValueChange}
                    onBlur={handleBlur}
                    className="w-24 min-w-[96px] rounded-xl border px-3 py-2 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--tt-ring)]"
                    style={{
                        borderColor: 'var(--tt-border)',
                        background: 'var(--tt-input-bg)',
                        color: 'var(--tt-text)',
                    }}
                    aria-label="Duration value"
                />

                <select
                    value={unit}
                    onChange={handleUnitChange}
                    className="rounded-xl border px-3 py-2 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--tt-ring)]"
                    style={{
                        borderColor: 'var(--tt-border)',
                        background: 'var(--tt-input-bg)',
                        color: 'var(--tt-text)',
                    }}
                    aria-label="Duration unit"
                >
                    {UNIT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>

            {presetLabel ? (
                <div className="mt-1 text-xs" style={{ color: 'var(--tt-text-soft)' }}>Preset: {presetLabel}</div>
            ) : null}
        </div>
    );
}