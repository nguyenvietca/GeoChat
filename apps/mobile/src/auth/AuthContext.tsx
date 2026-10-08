import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentUser, loginUser, registerUser } from '../api/authApi';
import { clearTokens, getToken, saveTokens } from '../storage/tokenStorage';
import { registerForPushNotifications, unregisterCurrentPushDevice } from '../services/pushNotificationService';
import { disconnectAllChatWebSockets } from '../services/chatWebSocketService';
import { setUnauthorizedHandler } from '../api/client';
import { LoginRequest, RegisterRequest, User } from '../types/auth';

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(async () => {
    disconnectAllChatWebSockets();
    await clearTokens();
    setUser(null);
    setToken(null);
  }, []);

  const refreshSession = async () => {
    const currentToken = await getToken();

    if (!currentToken) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await getCurrentUser(currentToken);
      setUser(currentUser);
      setToken(currentToken);
      void registerForPushNotifications(currentToken);
    } catch (_error) {
      await clearSession();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshSession();
  }, [clearSession]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clearSession().catch(() => {
        setUser(null);
        setToken(null);
      });
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const login = async (payload: LoginRequest) => {
    const authData = await loginUser(payload);
    await saveTokens(authData.token, authData.tokenType || 'Bearer');
    const currentUser = await getCurrentUser(authData.token);
    setToken(authData.token);
    setUser(currentUser);
    void registerForPushNotifications(authData.token);
  };

  const register = async (payload: RegisterRequest) => {
    await registerUser(payload);
    await login({ username: payload.username, password: payload.password });
  };

  const logout = async () => {
    if (token) {
      void unregisterCurrentPushDevice(token).catch(() => undefined);
    }
    await clearSession();
  };

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: !!user && !!token,
      login,
      register,
      logout,
      refreshSession,
      updateUser,
    }),
    [user, token, isLoading, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
