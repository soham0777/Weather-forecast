import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const VARIANTS = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 shadow-sm disabled:bg-brand-300',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 shadow-sm disabled:text-slate-400',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm disabled:bg-rose-300',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm disabled:bg-emerald-300',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-400',
  link: 'text-brand-700 hover:text-brand-900 hover:underline px-0 py-0',
};

const SIZES = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-3.5 py-2 text-sm gap-2',
  lg: 'px-4 py-2.5 text-sm gap-2',
};

export default function Button({
  variant = 'primary', size = 'md', loading = false, icon: Icon, className = '', children, to, type = 'button',
  disabled, ...props
}) {
  const classes = `inline-flex items-center justify-center rounded-lg font-medium transition-colors
    disabled:cursor-not-allowed ${VARIANTS[variant]} ${variant === 'link' ? '' : SIZES[size]} ${className}`;
  const content = (
    <>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        : Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
      {children}
    </>
  );
  if (to) {
    return <Link to={to} className={classes} {...props}>{content}</Link>;
  }
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {content}
    </button>
  );
}
