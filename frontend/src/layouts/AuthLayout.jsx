import { GraduationCap } from 'lucide-react';

/** Centered card layout for login / registration / verification pages. */
export default function AuthLayout({ title, subtitle, children, wide = false }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-brand-50 via-slate-50 to-white">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-800 text-white shadow">
              <GraduationCap className="h-7 w-7" aria-hidden="true" />
            </div>
            <p className="text-xs font-semibold tracking-widest text-brand-800 uppercase">College Internship Management System</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <div className="card p-6 sm:p-8">{children}</div>
        </div>
      </main>
      <footer className="pb-6 text-center text-xs text-slate-400">© {new Date().getFullYear()} CIMS · Training & Placement Cell</footer>
    </div>
  );
}
