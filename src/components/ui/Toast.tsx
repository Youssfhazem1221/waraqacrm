import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export default function ToastContainer({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icons = {
    success: <CheckCircle2 size={18} className="text-[#4A6B3A] shrink-0" />,
    error: <AlertCircle size={18} className="text-[#A3492F] shrink-0" />,
    info: <Info size={18} className="text-[#4C2224] shrink-0" />,
  };

  const borders = {
    success: 'border-[#4A6B3A]/30 bg-white',
    error: 'border-[#A3492F]/30 bg-white',
    info: 'border-[#4C2224]/30 bg-white',
  };

  return (
    <div
      className={`pointer-events-auto border rounded-2xl p-3.5 shadow-lg flex items-start gap-3 transition-all animate-fadeIn ${borders[toast.type]}`}
    >
      <div className="mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-xs text-[#241C1B]">{toast.title}</div>
        {toast.message && (
          <div className="text-[11px] text-[#6B5D50] mt-0.5 leading-snug truncate">
            {toast.message}
          </div>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-[#6B5D50] hover:text-[#241C1B] p-1 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
        aria-label="Close"
      >
        <X size={14} />
      </button>
    </div>
  );
}
