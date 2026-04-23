'use client';

import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

// ============================================================================
// Dropdown
// ============================================================================

export interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  menuWidth?: 'auto' | 'trigger';
  menuMinWidth?: number | string;
  disabled?: boolean;
  className?: string;
  closeOnSelect?: boolean; // Whether to close dropdown when item is clicked
  isOpen?: boolean; // Controlled state (optional)
  onClose?: () => void; // Callback when dropdown should close
  onOpen?: () => void; // Callback when dropdown should open
}

export function Dropdown({
  trigger,
  children,
  align = 'left',
  menuWidth = 'auto',
  menuMinWidth,
  disabled = false,
  className = '',
  closeOnSelect = true,
  isOpen: controlledIsOpen,
  onClose,
  onOpen,
}: DropdownProps) {
  const VIEWPORT_PADDING_PX = 8;
  const MENU_OFFSET_PX = 4;
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuLeft, setMenuLeft] = useState<number | undefined>(undefined);
  const [menuTop, setMenuTop] = useState<number | undefined>(undefined);
  const [menuWidthPx, setMenuWidthPx] = useState<number | undefined>(undefined);
  const [menuMaxWidth, setMenuMaxWidth] = useState<number | undefined>(undefined);
  const [menuMaxHeight, setMenuMaxHeight] = useState<number | undefined>(undefined);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      setInternalIsOpen(false);
    }
  }, [onClose]);

  const handleOpen = useCallback(() => {
    if (onOpen) {
      onOpen();
    } else {
      setInternalIsOpen(true);
    }
  }, [onOpen]);

  const updateMenuPlacement = useCallback(() => {
    if (!isOpen || !dropdownRef.current || !menuRef.current) {
      return;
    }

    const wrapperRect = dropdownRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const nextMaxWidth = Math.max(180, viewportWidth - VIEWPORT_PADDING_PX * 2);
    const nextMaxHeight = Math.max(
      0,
      viewportHeight - wrapperRect.bottom - VIEWPORT_PADDING_PX - MENU_OFFSET_PX,
    );
    const nextMenuWidthPx = menuWidth === 'trigger'
      ? Math.min(wrapperRect.width, nextMaxWidth)
      : undefined;
    const effectiveWidth = Math.min(nextMenuWidthPx ?? menuRect.width, nextMaxWidth);

    const projectedLeft = align === 'right'
      ? wrapperRect.right - effectiveWidth
      : wrapperRect.left;
    const nextLeft = Math.min(
      Math.max(VIEWPORT_PADDING_PX, projectedLeft),
      Math.max(VIEWPORT_PADDING_PX, viewportWidth - VIEWPORT_PADDING_PX - effectiveWidth),
    );
    const nextTop = Math.max(VIEWPORT_PADDING_PX, wrapperRect.bottom + MENU_OFFSET_PX);

    setMenuMaxWidth((current) => current === nextMaxWidth ? current : nextMaxWidth);
    setMenuMaxHeight((current) => current === nextMaxHeight ? current : nextMaxHeight);
    setMenuLeft((current) => current === nextLeft ? current : nextLeft);
    setMenuTop((current) => current === nextTop ? current : nextTop);
    setMenuWidthPx((current) => current === nextMenuWidthPx ? current : nextMenuWidthPx);
  }, [align, isOpen, menuWidth]);

  // Close on outside click (only while dropdown is open)
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !(menuRef.current && menuRef.current.contains(event.target as Node))
      ) {
        handleClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, handleClose]);

  // Close on Escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') handleClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, handleClose]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuLeft(undefined);
      setMenuTop(undefined);
      setMenuWidthPx(undefined);
      setMenuMaxWidth(undefined);
      setMenuMaxHeight(undefined);
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
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && (isOpen ? handleClose() : handleOpen())}
        disabled={disabled}
        className="flex items-center"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {trigger}
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className={`fixed z-[120] overflow-y-auto rounded-lg border py-1 ${menuWidth === 'trigger' ? '' : 'min-w-[180px]'}`}
          style={{
            top: menuTop,
            left: menuLeft,
            width: menuWidthPx,
            minWidth: menuWidth === 'trigger' ? undefined : menuMinWidth,
            background: 'var(--tt-surface-elevated)',
            borderColor: 'var(--tt-border)',
            boxShadow: 'var(--tt-shadow)',
            backdropFilter: 'blur(16px) saturate(1.06)',
            maxWidth: menuMaxWidth,
            maxHeight: menuMaxHeight,
            visibility: menuLeft === undefined || menuTop === undefined ? 'hidden' : undefined,
          }}
          role="menu"
        >
          {React.Children.map(children, (child) =>
            React.isValidElement(child)
              ? React.cloneElement(
                  child as React.ReactElement<{ onClick?: () => void }>,
                  {
                    onClick: () => {
                      (
                        child as React.ReactElement<{ onClick?: () => void }>
                      ).props.onClick?.();
                      if (closeOnSelect) {
                        handleClose();
                      }
                    },
                  },
                )
              : child,
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

// ============================================================================
// DropdownItem
// ============================================================================

interface DropdownItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function DropdownItem({
  children,
  onClick,
  danger = false,
  disabled = false,
}: DropdownItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full px-4 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        color: danger ? '#dc2626' : 'var(--tt-text)',
        background: 'transparent',
      }}
      role="menuitem"
    >
      {children}
    </button>
  );
}

// ============================================================================
// DropdownDivider
// ============================================================================

interface DropdownDividerProps {
  onClick?: () => void;
}

export function DropdownDivider({ onClick: _onClick }: DropdownDividerProps) {
  return <div className="my-1 border-t" style={{ borderColor: 'var(--tt-border)' }} />;
}

