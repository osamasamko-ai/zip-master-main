import React from 'react';

type StatusBadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const toneClassMap: Record<StatusBadgeTone, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  danger: 'bg-red-50 text-red-700 border-red-100',
  info: 'bg-sky-50 text-sky-700 border-sky-100',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function StatusBadge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: React.ReactNode;
  tone?: StatusBadgeTone;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-black ${toneClassMap[tone]} ${className}`}>
      {children}
    </span>
  );
}
