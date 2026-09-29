import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import AuthLayout from '../../layouts/AuthLayout';
import { Spinner } from '../../components/ui/States';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getErrorMessage } from '../../services/api';
import { authService } from '../../services/endpoints';
import { ROLE_HOME } from '../../utils/constants';

export default function VerifyEmailPage() {
  useDocumentTitle('Verify e-mail');
  const [params] = useSearchParams();
  const token = params.get('token');
  const { user, refreshUser } = useAuth();
  const [state, setState] = useState(token ? 'loading' : 'error');
  const [message, setMessage] = useState(token ? null : 'The verification link is incomplete. Please use the link from your e-mail.');
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    authService.verifyEmail(token)
      .then(() => {
        setState('success');
        if (user) refreshUser().catch(() => {});
      })
      .catch((err) => {
        setState('error');
        setMessage(getErrorMessage(err));
      });
  }, [token, user, refreshUser]);

  return (
    <AuthLayout title="E-mail verification">
      <div className="flex flex-col items-center text-center" aria-live="polite">
        {state === 'loading' && (<><Spinner className="h-8 w-8" /><p className="mt-3 text-sm text-slate-600">Verifying your e-mail address…</p></>)}
        {state === 'success' && (
          <>
            <CheckCircle2 className="h-12 w-12 text-emerald-600" aria-hidden="true" />
            <p className="mt-3 font-medium text-slate-900">Your e-mail address has been verified.</p>
            <Button className="mt-5" to={user ? ROLE_HOME[user.role] : '/login'}>{user ? 'Go to dashboard' : 'Log in'}</Button>
          </>
        )}
        {state === 'error' && (
          <>
            <XCircle className="h-12 w-12 text-rose-500" aria-hidden="true" />
            <p className="mt-3 font-medium text-slate-900">Verification failed</p>
            <p className="mt-1 text-sm text-slate-600">{message}</p>
            <p className="mt-4 text-sm text-slate-600">
              Log in and use <strong>Resend link</strong> on your dashboard to get a new link.{' '}
              <Link to="/login" className="font-medium text-brand-700 hover:underline">Go to login</Link>
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
