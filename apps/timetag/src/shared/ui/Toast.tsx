'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CloseIcon } from '@/shared/icons';

// ============================================================================
// Toast
// ============================================================================

interface ToastProps {
  message: string;
  action?: ToastAction;
  duration?: number;
  onClose: () => void;
  inStack?: boolean;
}

interface ToastAction {
  label: string;
  onClick: () => void;
  isAvailable?: () => boolean;
  unavailableMessage?: string;
}

export function Toast({ message, action, duration = 5000, onClose, inStack = false }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const onCloseRef = useRef(onClose);
  const actionAvailable = action && (action.isAvailable?.() ?? true);
  const displayMessage = !actionAvailable && action?.unavailableMessage
    ? action.unavailableMessage
    : message;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let removalTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      setIsVisible(false);
      removalTimer = setTimeout(() => onCloseRef.current(), 300);
    }, duration);
    return () => {
      clearTimeout(timer);
      if (removalTimer) clearTimeout(removalTimer);
    };
  }, [duration]);

  return (
    <div
      className={`${inStack ? 'pointer-events-auto' : 'fixed bottom-4 left-1/2 z-50 -translate-x-1/2'} transform transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 text-white rounded-lg shadow-lg">
        <span className="text-sm">{displayMessage}</span>
        {isVisible && actionAvailable && action && (
          <button
            type="button"
            onClick={() => {
              if (action.isAvailable?.() === false) return;
              action.onClick();
              onClose();
            }}
            className="text-sm font-medium text-blue-400 hover:text-blue-300"
          >
            {action.label}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-white"
          aria-label="Close"
        >
          <CloseIcon size="sm" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// useToast Hook
// ============================================================================

interface ToastItem {
  id: string;
  message: string;
  action?: ToastAction;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(0);

  const showToast = useCallback((message: string, action?: ToastAction) => {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : (toastIdRef.current++).toString();
    setToasts((prev) => [...prev, { id, message, action }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, removeToast };
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col-reverse items-center gap-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          action={toast.action}
          onClose={() => onRemove(toast.id)}
          inStack
        />
      ))}
    </div>
  );
}

