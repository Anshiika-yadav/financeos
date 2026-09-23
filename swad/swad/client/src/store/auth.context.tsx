import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { AuthUser, AuthState } from '../types';
import { tokenStore } from '../services/api';
import { logout as logoutService } from '../services/auth.service';

interface AuthContextValue extends AuthState {
  login: (user: AuthUser, tokens: { accessToken: string; refreshToken: string }, tenantSlug?: string) => void;
  logout: () => Promise<void>;
  setTenantSlug: (slug: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    tenantSlug: tokenStore.getTenantSlug(),
    isAuthenticated: false,
  });

  // On mount, check if there's a stored refresh token to restore session
  useEffect(() => {
    const slug = tokenStore.getTenantSlug();
    if (slug) {
      setState((s) => ({ ...s, tenantSlug: slug }));
    }
  }, []);

  const loginFn = useCallback(
    (
      user: AuthUser,
      tokens: { accessToken: string; refreshToken: string },
      tenantSlug?: string,
    ) => {
      tokenStore.setAccessToken(tokens.accessToken);
      tokenStore.setRefreshToken(tokens.refreshToken);
      if (tenantSlug) tokenStore.setTenantSlug(tenantSlug);

      setState({
        user,
        accessToken: tokens.accessToken,
        tenantSlug: tenantSlug ?? tokenStore.getTenantSlug(),
        isAuthenticated: true,
      });
    },
    [],
  );

  const logoutFn = useCallback(async () => {
    await logoutService();
    setState({
      user: null,
      accessToken: null,
      tenantSlug: null,
      isAuthenticated: false,
    });
  }, []);

  const setTenantSlug = useCallback((slug: string) => {
    tokenStore.setTenantSlug(slug);
    setState((s) => ({ ...s, tenantSlug: slug }));
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, login: loginFn, logout: logoutFn, setTenantSlug }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
