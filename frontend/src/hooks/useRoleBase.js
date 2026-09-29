import { useAuth } from '../context/AuthContext';

/** "/student", "/faculty" or "/admin" for building role-specific links. */
export function useRoleBase() {
  const { user } = useAuth();
  return `/${(user?.role || 'student').toLowerCase()}`;
}
