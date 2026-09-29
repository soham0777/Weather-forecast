import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onUnauthorized, tokenStorage } from '../services/api';
import { authService } from '../services/endpoints';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(Boolean(tokenStorage.get()));
  // Where to go right after login/registration (read by PublicOnlyRoute).
  const [redirectTo, setRedirectTo] = useState(null);
  const navigate = useNavigate();
  const toast = useToast();

  // Validate a stored token on start-up (the account may have been deactivated meanwhile).
  useEffect(() => {
    if (!tokenStorage.get()) return;
    authService.me()
      .then(setUser)
      .catch(() => tokenStorage.clear())
      .finally(() => setInitializing(false));
  }, []);

  // Session expired / account deactivated → back to login with the server's reason.
  useEffect(() => {
    onUnauthorized((message) => {
      if (!tokenStorage.get()) return;
      tokenStorage.clear();
      setUser(null);
      toast.error(message || 'Your session has ended. Please log in again.');
      navigate('/login', { replace: true });
    });
  }, [navigate, toast]);

  const establish = useCallback((auth, target) => {
    tokenStorage.set(auth.token);
    setRedirectTo(target || null);
    setUser(auth.user);
    return auth.user;
  }, []);

  const login = useCallback(async (email, password, target) =>
    establish(await authService.login({ email, password }), target), [establish]);

  const register = useCallback(async (payload, target) => establish(await authService.register(payload), target), [establish]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      /* the token is discarded locally either way */
    }
    tokenStorage.clear();
    setRedirectTo(null);
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  const refreshUser = useCallback(async () => {
    const me = await authService.me();
    setUser(me);
    return me;
  }, []);

  const value = useMemo(() => ({ user, initializing, redirectTo, login, register, logout, refreshUser }),
    [user, initializing, redirectTo, login, register, logout, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
