import React, { useRef, useEffect, useLayoutEffect, useCallback, useState } from 'react';

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
    buttonClassName?: string;
    buttonStyle?: React.CSSProperties;
    options: DropdownOption[];
    selectedId: string;
    isOpen: boolean;
    onToggle: () => void;
    onSelect: (id: string) => void;
    onClose: () => void;
    title?: string;
    ariaLabel?: string;
    fullWidth?: boolean;
    menuAlign?: 'left' | 'right';
    menuWidth?: 'fixed' | 'trigger';
}

export function Dropdown({
    id,
    label,
    icon,
    buttonContent,
    buttonClassName,
    buttonStyle,
    options,
    selectedId,
    isOpen,
    onToggle,
    onSelect,
    onClose,
    title,
    ariaLabel,
    fullWidth = false,
    menuAlign = 'right',
    menuWidth = 'fixed',
}: DropdownProps) {
    const VIEWPORT_PADDING_PX = 8;
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [menuOffsetX, setMenuOffsetX] = useState(0);
    const [menuMaxWidth, setMenuMaxWidth] = useState<number | undefined>(undefined);

    const updateMenuPlacement = useCallback(() => {
        if (!isOpen || !wrapperRef.current || !menuRef.current) {
            return;
        }

        const wrapperRect = wrapperRef.current.getBoundingClientRect();
        const menuRect = menuRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const nextMaxWidth = Math.max(160, viewportWidth - VIEWPORT_PADDING_PX * 2);
        const effectiveWidth = Math.min(menuRect.width, nextMaxWidth);

        const projectedLeft = menuAlign === 'left'
            ? wrapperRect.left
            : wrapperRect.right - effectiveWidth;
        let projectedRight = projectedLeft + effectiveWidth;
        let nextOffset = 0;

        if (projectedLeft < VIEWPORT_PADDING_PX) {
            nextOffset += VIEWPORT_PADDING_PX - projectedLeft;
            projectedRight += VIEWPORT_PADDING_PX - projectedLeft;
        }

        if (projectedRight > viewportWidth - VIEWPORT_PADDING_PX) {
            nextOffset -= projectedRight - (viewportWidth - VIEWPORT_PADDING_PX);
        }

        setMenuMaxWidth((current) => current === nextMaxWidth ? current : nextMaxWidth);
        setMenuOffsetX((current) => current === nextOffset ? current : nextOffset);
    }, [isOpen, menuAlign]);

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

    useLayoutEffect(() => {
        if (!isOpen) {
            setMenuOffsetX(0);
            setMenuMaxWidth(undefined);
            return;
        }

        const frame = window.requestAnimationFrame(updateMenuPlacement);
        window.addEventListener('resize', updateMenuPlacement);
        window.addEventListener('scroll', updateMenuPlacement, true);

        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener('resize', updateMenuPlacement);
            window.removeEventListener('scroll', updateMenuPlacement, true);
        };
    }, [isOpen, updateMenuPlacement]);

    return (
        <div ref={wrapperRef} className={`relative ${fullWidth ? 'w-full' : 'flex-shrink-0'}`}>
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
                className={`${fullWidth ? 'flex w-full justify-between' : 'inline-flex'} min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-sm focus:outline-none ${buttonClassName ?? ''}`}
                style={{
                    borderColor: 'var(--tt-border)',
                    background: 'var(--tt-input-bg)',
                    color: 'var(--tt-text)',
                    ...buttonStyle,
                }}
                title={title}
            >
                {icon}
                {buttonContent}
            </button>

            {isOpen && (
                <div
                    ref={menuRef}
                    role="menu"
                    aria-label={ariaLabel || label}
                    className={`absolute ${menuAlign === 'left' ? 'left-0' : 'right-0'} ${menuWidth === 'trigger' ? 'w-full min-w-full' : 'w-44'} z-40 mt-2 rounded-md border`}
                    style={{
                        background: 'var(--tt-surface-elevated)',
                        borderColor: 'var(--tt-border)',
                        boxShadow: 'var(--tt-shadow)',
                        backdropFilter: 'blur(16px) saturate(1.06)',
                        maxWidth: menuMaxWidth,
                        transform: menuOffsetX === 0 ? undefined : `translateX(${menuOffsetX}px)`,
                    }}
                >
                    <ul className="py-1" role="none">
                        {options.map((option) => (
                            <li key={option.id} role="none">
                                <button
                                    role="menuitem"
                                    type="button"
                                    onClick={() => onSelect(option.id)}
                                    className={`w-full px-3 py-2 text-left text-sm ${option.id === selectedId ? 'font-medium' : ''}`}
                                    style={{
                                        color: option.id === selectedId ? 'var(--tt-accent)' : 'var(--tt-text)',
                                        background: option.id === selectedId ? 'var(--tt-accent-soft)' : 'transparent',
                                    }}
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

