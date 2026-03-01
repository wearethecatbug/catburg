import React, { useRef, useEffect } from 'react';

export interface DropdownOption {
    id: string;
    label: string;
    icon?: React.ReactNode;
}

interface DropdownProps {
    id: string;
    label: string;
    icon: React.ReactNode;
    buttonContent: React.ReactNode;
    options: DropdownOption[];
    selectedId: string;
    isOpen: boolean;
    onToggle: () => void;
    onSelect: (id: string) => void;
    onClose: () => void;
    title?: string;
    ariaLabel?: string;
}

export function Dropdown({
    id,
    label,
    icon,
    buttonContent,
    options,
    selectedId,
    isOpen,
    onToggle,
    onSelect,
    onClose,
    title,
    ariaLabel,
}: DropdownProps) {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const buttonRef = useRef<HTMLButtonElement | null>(null);

    // Close dropdown on click outside
    useEffect(() => {
        function handleDocClick(e: MouseEvent) {
            const target = e.target as Node | null;
            if (isOpen && wrapperRef.current && !wrapperRef.current.contains(target)) {
                onClose();
            }
        }
        if (isOpen) {
            document.addEventListener('click', handleDocClick);
        }
        return () => document.removeEventListener('click', handleDocClick);
    }, [isOpen, onClose]);

    // Keyboard support
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (document.activeElement === buttonRef.current) {
                if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggle();
                }
                if (e.key === 'Escape') onClose();
            }
            if (e.key === 'Escape' && isOpen) {
                onClose();
                buttonRef.current?.focus();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onToggle, onClose]);

    return (
        <div ref={wrapperRef} className="relative flex-shrink-0">
            <label className="sr-only" htmlFor={id}>
                {label}
            </label>
            <button
                id={id}
                ref={buttonRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={isOpen}
                onClick={onToggle}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title={title}
            >
                {icon}
                {buttonContent}
            </button>

            {isOpen && (
                <div
                    role="menu"
                    aria-label={ariaLabel || label}
                    className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-md shadow-md z-40"
                >
                    <ul className="py-1" role="none">
                        {options.map((option) => (
                            <li key={option.id} role="none">
                                <button
                                    role="menuitem"
                                    type="button"
                                    onClick={() => onSelect(option.id)}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                                        option.id === selectedId ? 'font-medium text-gray-900' : 'text-gray-700'
                                    }`}
                                >
                                    {option.icon ? (
                                        <span className="inline-flex items-center gap-2">
                                            {option.icon} {option.label}
                                        </span>
                                    ) : (
                                        option.label
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

