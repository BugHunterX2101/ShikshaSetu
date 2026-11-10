'use client';

import React from 'react';
import { useToast, ToastType } from '@/src/context/ToastContext';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />,
  error: <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />,
  info: <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />,
};

const borderColors: Record<ToastType, string> = {
  success: 'border-emerald-300 bg-emerald-50 text-emerald-950',
  error: 'border-rose-300 bg-rose-50 text-rose-950',
  warning: 'border-amber-300 bg-amber-50 text-amber-950',
  info: 'border-blue-300 bg-blue-50 text-blue-950',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border shadow-lg transition-all transform ease-out duration-200 ${borderColors[toast.type]}`}
          role="alert"
        >
          {icons[toast.type]}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-snug">{toast.title}</p>
            {toast.description && (
              <p className="text-xs mt-0.5 opacity-90 leading-relaxed break-words">{toast.description}</p>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-slate-400 hover:text-slate-700 p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-slate-400"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
