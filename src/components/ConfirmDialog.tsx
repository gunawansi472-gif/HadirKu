import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { ConfirmationState } from '../types/attendance';

interface ConfirmDialogProps {
  state: ConfirmationState | null;
  onClose: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ state, onClose }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!state || !state.isOpen) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await state.onConfirm();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDanger = state.variant === 'danger';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in duration-150">
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isDanger ? 'bg-rose-50 text-rose-700' : 'bg-teal-50 text-teal-700'
              }`}
            >
              {isDanger ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 id="confirm-dialog-title" className="text-lg font-bold text-slate-900">
                {state.title}
              </h3>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">{state.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Tutup dialog"
            className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {state.details && state.details.length > 0 && (
          <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-1.5">
            {state.details.map((line, i) => (
              <p key={i} className="text-xs font-mono text-slate-700 tabular-nums">
                {line}
              </p>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all whitespace-nowrap"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={`min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-semibold text-white inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-all whitespace-nowrap disabled:opacity-60 ${
              isDanger ? 'bg-rose-700 hover:bg-rose-800' : 'bg-teal-700 hover:bg-teal-800'
            }`}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{state.confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
