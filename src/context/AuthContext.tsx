import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import apiClient from '../api/client';

export type Role = 'user' | 'pro' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  verified?: boolean;
  licenseStatus?: string;
  img?: string;
  roleDescription?: string;
  accountBalance?: number;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, name: string, role?: Role) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');

    if (storedToken) {
      setToken(storedToken);
      apiClient.setToken(storedToken);
    }

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse stored user', e);
      }
    }

    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.login(email, password);
      const { token, user } = response.data;

      setToken(token);
      setUser(user);
      apiClient.setToken(token);
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));
      return user;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Login failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string, role: Role = 'user') => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.register(email, password, name, role);
      const { token, user } = response.data;

      setToken(token);
      setUser(user);
      apiClient.setToken(token);
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));
      return user;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'تعذر إنشاء الحساب.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await apiClient.logout();
      setUser(null);
      setToken(null);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    error,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
