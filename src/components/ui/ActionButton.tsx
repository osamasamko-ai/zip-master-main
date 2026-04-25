import React from 'react';

type ActionButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ActionButtonSize = 'sm' | 'md';

const variantClassMap: Record<ActionButtonVariant, string> = {
  primary: 'border-brand-navy bg-brand-navy text-white hover:bg-brand-dark hover:border-brand-dark shadow-lg shadow-brand-navy/15',
  secondary: 'border-slate-200 bg-white text-slate-700 hover:border-brand-navy hover:text-brand-navy',
  ghost: 'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-brand-dark',
  danger: 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300',
};

const sizeClassMap: Record<ActionButtonSize, string> = {
  sm: 'px-3 py-2 text-xs rounded-xl',
  md: 'px-4 py-3 text-sm rounded-2xl',
};

export default function ActionButton({
  children,
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
}) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 border font-black transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${variantClassMap[variant]} ${sizeClassMap[size]} ${className}`}
    >
      {children}
    </button>
  );
}
