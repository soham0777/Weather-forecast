import { Compass } from 'lucide-react';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ROLE_HOME } from '../../utils/constants';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <Compass className="h-12 w-12 text-slate-300" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-2 text-sm text-slate-500">The page you are looking for does not exist or has moved.</p>
      <Button className="mt-6" to={user ? ROLE_HOME[user.role] : '/login'}>{user ? 'Back to dashboard' : 'Go to login'}</Button>
    </div>
  );
}
