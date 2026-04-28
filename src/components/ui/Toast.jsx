/**
 * Toast — lightweight notification system using React context + Framer Motion.
 * Usage:
 *   const { toast } = useToast();
 *   toast('Saved!');
 *   toast('Error!', 'error');
 *   toast('Info', 'info', 3000);
 */
import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle, Info, X, AlertTriangle } from "lucide-react";

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle,
  error: AlertTriangle,
  info: Info,
};

const COLORS = {
  success: "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  error: "border-rose-400/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  info: "border-blue-400/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
};

function ToastItem({ id, message, type, onDismiss }) {
  const Icon = ICONS[type] || Info;
  const colorClass = COLORS[type] || COLORS.info;

  return (
    <motion.div
      key={id}
      layout
      initial={{ opacity: 0, y: 24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.94 }}
      transition={{ duration: 0.22 }}
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-md ${colorClass}`}
      role="status"
      aria-live="polite"
    >
      <Icon size={16} className="mt-0.5 shrink-0" />
      <p className="max-w-[30ch] flex-1 text-sm leading-snug">{message}</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onDismiss(id)}
        className="shrink-0 rounded-full p-1 opacity-60 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
      >
        <X size={13} />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = "info", duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-[300] flex w-[min(90vw,360px)] -translate-x-1/2 flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem id={t.id} message={t.message} type={t.type} onDismiss={dismiss} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
