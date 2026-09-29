import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOME } from '../utils/constants';
import { PageLoader } from '../components/ui/States';

/** Requires login; optionally restricts to roles. Wrong-role users go to their own dashboard. */
export default function ProtectedRoute({ roles }) {
  const { user, initializing } = useAuth();
  const location = useLocation();
  if (initializing) return <PageLoader label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return <Outlet />;
}

/** Login/registration pages: signed-in users are sent on (to the requested page if it belongs to their role). */
export function PublicOnlyRoute() {
  const { user, initializing, redirectTo } = useAuth();
  if (initializing) return <PageLoader label="Checking your session…" />;
  if (user) {
    const allowed = redirectTo && redirectTo.startsWith(`/${user.role.toLowerCase()}/`);
    return <Navigate to={allowed ? redirectTo : ROLE_HOME[user.role]} replace />;
  }
  return <Outlet />;
}
