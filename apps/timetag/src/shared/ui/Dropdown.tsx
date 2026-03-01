'use client';

import React, { useState, useRef, useEffect } from 'react';

// ============================================================================
// Dropdown
// ============================================================================

export interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
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
  disabled = false,
  className = '',
  closeOnSelect = true,
  isOpen: controlledIsOpen,
  onClose,
  onOpen,
}: DropdownProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setInternalIsOpen(false);
    }
  };

  const handleOpen = () => {
    if (onOpen) {
      onOpen();
    } else {
      setInternalIsOpen(true);
    }
  };

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') handleClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

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

      {isOpen && (
        <div
          className={`absolute top-full mt-1 z-50 min-w-[180px] bg-white rounded-lg shadow-lg border border-gray-200 py-1 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
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
        </div>
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
      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed ${
        danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'
      }`}
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
  return <div className="border-t border-gray-200 my-1" />;
}

