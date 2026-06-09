import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import apiClient from '../api/client';

export type Role = 'user' | 'pro' | 'lawyer' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  verified?: boolean;
  licenseStatus?: string;
  img?: string;
  avatar?: string;
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
  updateUser: (patch: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyUser = (nextUser: AuthUser) => {
    setUser(nextUser);
    localStorage.setItem('auth_user', JSON.stringify(nextUser));
  };

  // Load token from localStorage on mount
  useEffect(() => {
    let isMounted = true;
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

    const refreshUserProfile = async () => {
      if (!storedToken) return;

      try {
        const response = await apiClient.getSettings();
        const profile = response.data?.profile;
        if (!profile || !isMounted) return;

        setUser((current) => {
          if (!current) return current;

          const nextUser = {
            ...current,
            name: profile.name || current.name,
            email: profile.email || current.email,
            img: profile.img || profile.avatar || current.img,
            avatar: profile.avatar || profile.img || current.avatar,
            roleDescription: profile.roleDescription || current.roleDescription,
            accountBalance: profile.accountBalance ?? current.accountBalance,
          };

          localStorage.setItem('auth_user', JSON.stringify(nextUser));
          return nextUser;
        });
      } catch (e) {
        console.error('Failed to refresh current user profile', e);
      }
    };

    refreshUserProfile().finally(() => {
      if (isMounted) setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.login(email, password);
      const { token, user } = response.data;

      setToken(token);
      applyUser(user);
      apiClient.setToken(token);
      localStorage.setItem('auth_token', token);
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
      applyUser(user);
      apiClient.setToken(token);
      localStorage.setItem('auth_token', token);
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

  const updateUser = (patch: Partial<AuthUser>) => {
    setUser((current) => {
      if (!current) return current;
      const nextUser = { ...current, ...patch };
      localStorage.setItem('auth_user', JSON.stringify(nextUser));
      return nextUser;
    });
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
    updateUser,
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
