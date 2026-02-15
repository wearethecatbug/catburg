'use client';

import React, { useState, useEffect } from 'react';
import { CloseIcon } from './icons';

interface ToastProps {
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
  onClose: () => void;
}

export function Toast({
  message,
  action,
  duration = 5000,
  onClose,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 text-white rounded-lg shadow-lg">
        <span className="text-sm">{message}</span>
        {action && (
          <button
            type="button"
            onClick={() => {
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

// Toast container hook
interface ToastItem {
  id: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (
    message: string,
    action?: { label: string; onClick: () => void }
  ) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, action }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const ToastContainer = () => (
    <>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          action={toast.action}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </>
  );

  return { showToast, ToastContainer };
}
