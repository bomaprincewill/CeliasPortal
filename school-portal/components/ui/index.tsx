// components/ui/index.tsx
"use client";
import { clsx, type ClassValue } from "clsx";
export function cn(...inputs: ClassValue[]) { return clsx(inputs); }

// ── Spinner ─────────────────────────────────────────────────
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
    </svg>
  );
}

// ── Empty State ──────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }: {
  icon?: React.ElementType; title: string; description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      {Icon && <Icon className="w-12 h-12 text-slate-200 mb-4" />}
      <p className="font-semibold text-ink">{title}</p>
      {description && <p className="text-sm text-muted mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────
export function StatCard({ label, value, icon, color = "bg-brand-50 text-brand-600", border = "border-border", sub }: {
  label: string; value: string | number;
  icon?: React.ReactNode; color?: string; border?: string; sub?: string;
}) {
  return (
    <div className={cn("card card-body flex items-start gap-4 border", border)}>
      {icon && (
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", color)}>
          {icon}
        </div>
      )}
      <div>
        <div className="font-display text-2xl font-bold text-ink">{value}</div>
        <div className="text-xs text-muted mt-0.5">{label}</div>
        {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ── Toast ────────────────────────────────────────────────────
import { useEffect } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

export function Toast({ type, message, onClose }: {
  type: "success" | "error" | "warning"; message: string; onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [onClose]);

  const styles = {
    success: "border-emerald-200 bg-emerald-50",
    error:   "border-red-200 bg-red-50",
    warning: "border-yellow-200 bg-yellow-50",
  };
  const textStyles = {
    success: "text-emerald-800", error: "text-red-800", warning: "text-yellow-800",
  };

  return (
    <div className={cn("fixed bottom-4 left-4 right-4 z-50 card card-body flex items-center gap-3 border-2 py-3 shadow-xl slide-up sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-sm", styles[type])}>
      {type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0"/>}
      {type !== "success" && <AlertTriangle className={cn("w-5 h-5 shrink-0", type === "error" ? "text-red-600" : "text-yellow-600")}/>}
      <p className={cn("text-sm font-medium flex-1", textStyles[type])}>{message}</p>
      <button onClick={onClose} className="text-muted hover:text-ink"><X className="w-4 h-4"/></button>
    </div>
  );
}

// ── Confirm Modal ────────────────────────────────────────────
export function ConfirmModal({ title, message, confirmLabel = "Confirm", danger = false, onConfirm, onCancel, children }: {
  title: string; message: string; confirmLabel?: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void; children?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 fade-in">
      <div className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl bg-white p-4 shadow-xl slide-up sm:p-6">
        <h2 className="font-display font-bold text-xl text-ink">{title}</h2>
        <p className="text-sm text-muted">{message}</p>
        {children}
        <div className="flex gap-3 pt-1">
          <button onClick={onConfirm} className={danger ? "btn-danger flex-1 justify-center" : "btn-primary flex-1 justify-center"}>
            {confirmLabel}
          </button>
          <button onClick={onCancel} className="btn-secondary flex-1 justify-center">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Section Card ─────────────────────────────────────────────
export function SectionCard({ title, action, children, className }: {
  title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("card", className)}>
      {(title || action) && (
        <div className="flex flex-col gap-2 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          {title && <h2 className="font-semibold text-ink text-sm">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
