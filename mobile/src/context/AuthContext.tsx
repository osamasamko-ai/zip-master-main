import React, { createContext, useContext, useMemo, useState } from 'react';
import { apiClient, AuthUser, Role } from '../api/client';

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  error: string;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, name: string, role?: Role) => Promise<AuthUser>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const applySession = (nextToken: string, nextUser: AuthUser) => {
    setToken(nextToken);
    setUser(nextUser);
    apiClient.setToken(nextToken);
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await apiClient.login(email, password);
      applySession(response.data.token, response.data.user);
      return response.data.user;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string, role: Role = 'user') => {
    setIsLoading(true);
    setError('');
    try {
      const response = await apiClient.register(email, password, name, role);
      applySession(response.data.token, response.data.user);
      return response.data.user;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    apiClient.setToken(null);
  };

  const value = useMemo(
    () => ({ user, token, isLoading, error, login, register, logout }),
    [user, token, isLoading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
