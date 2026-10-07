import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getCurrentUser, login as loginRequest, register as registerRequest } from '../../api/auth';
import { ApiError, setUnauthorizedHandler } from '../../api/client';
import { LoginRequest, RegisterRequest, User } from '../../types';
import { disconnectAllChatWebSockets } from '../../services/chatWebSocket';

const TOKEN_STORAGE_KEY = 'geochat.web.accessToken';

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionNotice: string;
  login: (payload: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionNotice, setSessionNotice] = useState('');

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setSessionNotice('');
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      return;
    }
    const currentUser = await getCurrentUser(token);
    setUser(currentUser);
  }, [token]);

  useEffect(() => {
    let active = true;
    setUnauthorizedHandler(() => {
      if (active) {
        clearSession();
      }
    });

    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!storedToken) {
      setIsLoading(false);
      return () => {
        active = false;
        setUnauthorizedHandler(null);
      };
    }

    setToken(storedToken);
    void getCurrentUser(storedToken)
      .then((currentUser) => {
        if (active) {
          setUser(currentUser);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          if (error instanceof ApiError && error.status === 401) {
            clearSession();
          } else {
            setToken(null);
            setUser(null);
            setSessionNotice('Your saved session could not be checked. Sign in again or retry when you are online.');
          }
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
      setUnauthorizedHandler(null);
    };
  }, [clearSession]);

  const login = useCallback(async (payload: LoginRequest) => {
    setSessionNotice('');
    const response = await loginRequest(payload);
    localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
    setToken(response.token);
    try {
      const currentUser = await getCurrentUser(response.token);
      setUser(currentUser);
    } catch (error) {
      clearSession();
      throw error;
    }
  }, [clearSession]);

  const register = useCallback((payload: RegisterRequest) => registerRequest(payload), []);
  const logout = useCallback(() => {
    disconnectAllChatWebSockets();
    clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    isLoading,
    isAuthenticated: Boolean(user && token),
    sessionNotice,
    login,
    register,
    logout,
    refreshUser,
  }), [user, token, isLoading, sessionNotice, login, register, logout, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}