import React from 'react';

export default function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] bg-white text-2xl text-slate-300 shadow-sm">
        <i className={`fa-solid ${icon}`}></i>
      </div>
      <h3 className="mt-6 text-xl font-black text-brand-dark">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm font-bold leading-7 text-slate-500">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
