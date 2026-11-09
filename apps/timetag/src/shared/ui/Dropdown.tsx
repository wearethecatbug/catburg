'use client';

import React, { useState, useRef, useEffect, useCallback, useLayoutEffect, useId } from 'react';
import { createPortal } from 'react-dom';

const VIEWPORT_PADDING_PX = 8;
const MENU_OFFSET_PX = 4;
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  popupRole?: 'menu' | 'dialog';
  popupLabel?: string;
  triggerRef?: React.Ref<HTMLButtonElement>;
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
  popupRole = 'menu',
  popupLabel,
  triggerRef,
}: DropdownProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasFocusedPopupRef = useRef(false);
  const closeRequestedRef = useRef(false);
  const focusRestoreModeRef = useRef<'always' | 'if-lost' | null>(null);
  const popupId = useId();
  const [menuLeft, setMenuLeft] = useState<number | undefined>(undefined);
  const [menuTop, setMenuTop] = useState<number | undefined>(undefined);
  const [menuWidthPx, setMenuWidthPx] = useState<number | undefined>(undefined);
  const [menuMaxWidth, setMenuMaxWidth] = useState<number | undefined>(undefined);
  const [menuMaxHeight, setMenuMaxHeight] = useState<number | undefined>(undefined);

  const restoreTriggerFocus = useCallback((mode: 'always' | 'if-lost') => {
    window.requestAnimationFrame(() => {
      const triggerButton = triggerButtonRef.current;
      if (!triggerButton?.isConnected) return;
      if (mode === 'if-lost' && document.activeElement !== document.body) return;
      triggerButton.focus();
    });
  }, []);

  const handleClose = useCallback((focusRestoreMode: 'always' | 'if-lost' | null = null) => {
    if (!isOpen || closeRequestedRef.current) return;

    closeRequestedRef.current = true;
    focusRestoreModeRef.current = focusRestoreMode;
    if (onClose) {
      onClose();
    } else {
      setInternalIsOpen(false);
    }
  }, [isOpen, onClose]);

  const handleOpen = useCallback(() => {
    if (onOpen) {
      onOpen();
    } else {
      setInternalIsOpen(true);
    }
  }, [onOpen]);

  const setTriggerButton = useCallback((node: HTMLButtonElement | null) => {
    triggerButtonRef.current = node;
    if (typeof triggerRef === 'function') {
      triggerRef(node);
    } else if (triggerRef) {
      triggerRef.current = node;
    }
  }, [triggerRef]);

  const getEnabledMenuItems = useCallback(() => {
    if (!menuRef.current) return [];
    return Array.from(menuRef.current.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'));
  }, []);

  const focusMenuItem = useCallback((index: number) => {
    const items = getEnabledMenuItems();
    if (items.length === 0) return;

    const nextIndex = (index + items.length) % items.length;
    items.forEach((item, itemIndex) => {
      item.tabIndex = itemIndex === nextIndex ? 0 : -1;
    });
    items[nextIndex].focus();
  }, [getEnabledMenuItems]);

  const focusFirstPopupControl = useCallback(() => {
    if (popupRole === 'menu') {
      focusMenuItem(0);
      return;
    }

    menuRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
  }, [focusMenuItem, popupRole]);

  const focusLogicalNeighbor = useCallback((isPrevious: boolean) => {
    const triggerButton = triggerButtonRef.current;
    if (!triggerButton) return false;

    // The popup is portaled to body, so document order must omit it when leaving the trigger's logical neighborhood.
    const focusables = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => (
      !menuRef.current?.contains(element) && element.tabIndex >= 0 && element.getClientRects().length > 0
    ));
    const triggerIndex = focusables.indexOf(triggerButton);
    const target = focusables[triggerIndex + (isPrevious ? -1 : 1)];
    if (!target) return false;

    target.focus();
    return true;
  }, []);

  const updateMenuPlacement = useCallback(() => {
    if (!isOpen || !dropdownRef.current || !menuRef.current) {
      return;
    }

    const wrapperRect = dropdownRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const nextMaxWidth = Math.max(180, viewportWidth - VIEWPORT_PADDING_PX * 2);
    const spaceBelow = Math.max(
      0,
      viewportHeight - wrapperRect.bottom - VIEWPORT_PADDING_PX - MENU_OFFSET_PX,
    );
    const spaceAbove = Math.max(
      0,
      wrapperRect.top - VIEWPORT_PADDING_PX - MENU_OFFSET_PX,
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
    const shouldOpenUpward = spaceAbove > spaceBelow;
    const nextMaxHeight = shouldOpenUpward ? spaceAbove : spaceBelow;
    const clampedMenuHeight = Math.min(menuRect.height, nextMaxHeight);
    const nextTop = shouldOpenUpward
      ? Math.max(VIEWPORT_PADDING_PX, wrapperRect.top - MENU_OFFSET_PX - clampedMenuHeight)
      : Math.max(VIEWPORT_PADDING_PX, wrapperRect.bottom + MENU_OFFSET_PX);

    setMenuMaxWidth(nextMaxWidth);
    setMenuMaxHeight(nextMaxHeight);
    setMenuLeft(nextLeft);
    setMenuTop(nextTop);
    setMenuWidthPx(nextMenuWidthPx);
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

  useEffect(() => {
    if (!isOpen) {
      const focusRestoreMode = focusRestoreModeRef.current;
      if (focusRestoreMode) {
        focusRestoreModeRef.current = null;
        restoreTriggerFocus(focusRestoreMode);
      }
      closeRequestedRef.current = false;
    }
  }, [isOpen, restoreTriggerFocus]);

  useLayoutEffect(() => {
    if (!isOpen) {
      hasFocusedPopupRef.current = false;
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

  useLayoutEffect(() => {
    if (!isOpen || menuLeft === undefined || menuTop === undefined || hasFocusedPopupRef.current) return;

    // Placement commits visibility before entry focus, avoiding a focus call against the hidden portal mount.
    hasFocusedPopupRef.current = true;
    focusFirstPopupControl();
  }, [focusFirstPopupControl, isOpen, menuLeft, menuTop]);

  const handlePopupKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      handleClose('always');
      return;
    }

    if (popupRole !== 'menu') return;

    if (event.key === 'Tab') {
      if (!focusLogicalNeighbor(event.shiftKey)) {
        // The portaled popup is outside the trigger's document order. Re-anchor before
        // unmounting, then let the browser continue its native boundary navigation.
        const triggerButton = triggerButtonRef.current;
        if (triggerButton?.isConnected) triggerButton.focus();
        handleClose();
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      handleClose();
      return;
    }

    const items = getEnabledMenuItems();
    if (items.length === 0) return;
    const currentIndex = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement));

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusMenuItem(currentIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusMenuItem(currentIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusMenuItem(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusMenuItem(items.length - 1);
    }
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        ref={setTriggerButton}
        type="button"
        onClick={() => !disabled && (isOpen ? handleClose() : handleOpen())}
        disabled={disabled}
        className="flex items-center"
        aria-expanded={isOpen}
        aria-haspopup={popupRole}
        aria-controls={popupId}
      >
        {trigger}
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          id={popupId}
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
          role={popupRole}
          aria-label={popupLabel}
          onBlur={popupRole === 'dialog' ? (event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              handleClose();
            }
          } : undefined}
          onKeyDown={handlePopupKeyDown}
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
                        handleClose('if-lost');
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
  tabIndex?: number;
}

export function DropdownItem({
  children,
  onClick,
  danger = false,
  disabled = false,
  tabIndex,
}: DropdownItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      tabIndex={tabIndex}
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

// Intentionally accepts an injected onClick because parent dropdowns may clone children
// and pass click handlers to all items, while dividers remain non-interactive.
export function DropdownDivider({ onClick: _onClick }: DropdownDividerProps) {
  return <div className="my-1 border-t" style={{ borderColor: 'var(--tt-border)' }} />;
}

