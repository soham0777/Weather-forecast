import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ChevronDown, GraduationCap, LogOut, Menu, UserCircle2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../services/api';
import { authService } from '../services/endpoints';
import { ROLE_LABEL } from '../utils/constants';
import { NAVIGATION } from './navigation';
import { Alert } from '../components/ui/States';
import Button from '../components/ui/Button';

function Sidebar({ items, onNavigate }) {
  return (
    <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={onNavigate}
                 className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
                   ${isActive ? 'bg-brand-800 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/10 px-5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
        <GraduationCap className="h-5 w-5 text-white" aria-hidden="true" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-white">CIMS</p>
        <p className="text-[11px] text-slate-400">Internship Management</p>
      </div>
    </div>
  );
}

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100">
        <UserCircle2 className="h-8 w-8 text-slate-400" aria-hidden="true" />
        <span className="hidden sm:block">
          <span className="block max-w-[180px] truncate text-sm font-medium text-slate-900">{user.name || user.email}</span>
          <span className="block text-xs text-slate-500">{ROLE_LABEL[user.role]}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-60 rounded-xl border border-slate-200 bg-white py-2 shadow-lg">
          <div className="border-b border-slate-100 px-4 pb-2">
            <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <button type="button" role="menuitem" onClick={onLogout}
                  className="mt-1 flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <LogOut className="h-4 w-4" aria-hidden="true" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

function VerificationBanner() {
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const resend = async () => {
    setSending(true);
    try {
      await authService.resendVerification();
      toast.success('A new verification link has been sent to your e-mail address.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };
  return (
    <Alert tone="warning" title="Please verify your e-mail address"
           action={<Button size="sm" variant="secondary" loading={sending} onClick={resend}>Resend link</Button>}>
      We sent a verification link to your college e-mail. Verified accounts help the placement cell contact you.
    </Alert>
  );
}

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = NAVIGATION[user.role] || [];

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-slate-900 lg:flex">
        <Brand />
        <Sidebar items={items} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <aside className="relative flex h-full w-72 max-w-[85%] flex-col bg-slate-900">
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation"
                      className="rounded-lg p-2 text-slate-300 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <Sidebar items={items} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"
                    className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <p className="text-sm font-medium text-slate-500">
              <span className="hidden sm:inline">College Internship Management System · </span>
              <span className="text-slate-900">{ROLE_LABEL[user.role]} portal</span>
            </p>
          </div>
          <UserMenu user={user} onLogout={logout} />
        </header>
        <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {!user.verified && <div className="mb-6"><VerificationBanner /></div>}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
