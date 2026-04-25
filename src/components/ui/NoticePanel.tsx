import React from 'react';

type NoticeTone = 'info' | 'success' | 'warning';

const toneClassMap: Record<NoticeTone, string> = {
  info: 'border-brand-navy/10 bg-gradient-to-l from-white via-slate-50 to-brand-navy/[0.04]',
  success: 'border-emerald-200 bg-emerald-50/70',
  warning: 'border-amber-200 bg-amber-50/80',
};

const iconMap: Record<NoticeTone, string> = {
  info: 'fa-compass',
  success: 'fa-circle-check',
  warning: 'fa-triangle-exclamation',
};

export default function NoticePanel({
  title,
  description,
  tone = 'info',
  action,
}: {
  title: string;
  description: string;
  tone?: NoticeTone;
  action?: React.ReactNode;
}) {
  return (
    <section className={`rounded-[1.75rem] border p-5 shadow-sm ${toneClassMap[tone]}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 text-brand-dark shadow-sm">
            <i className={`fa-solid ${iconMap[tone]}`}></i>
          </div>
          <div className="text-right">
            <h3 className="text-sm font-black text-brand-dark">{title}</h3>
            <p className="mt-1 text-sm font-bold leading-7 text-slate-600">{description}</p>
          </div>
        </div>
        {action}
      </div>
    </section>
  );
}
