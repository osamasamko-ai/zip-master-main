import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  link?: string;
  read: boolean;
  createdAt: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (isOpen: boolean) => void;
  markAsRead: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  NotificationBell: React.FC;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Web Audio API helper for notification sound
const playNotificationSound = () => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;

  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
  osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.1); // C6
  osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.3); // G5

  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.4);
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [activeToast, setActiveToast] = useState<Notification | null>(null);
  const [bellPulse, setBellPulse] = useState(false);
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const data = await response.json();
      setNotifications(data.data || []);
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();

    let socket: Socket | undefined;
    if (user?.id) {
      socket = io(window.location.origin, {
        query: { userId: user.id }
      });

      socket.on('notification', (payload: Notification) => {
        setNotifications(prev => [payload, ...prev]);
        setActiveToast(payload);
        setBellPulse(true);
        playNotificationSound();
        setTimeout(() => setActiveToast(null), 6000); // Auto-dismiss toast
        setTimeout(() => setBellPulse(false), 1600);
      });
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [user?.id, fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  }, []);

  const clearAllNotifications = useCallback(async () => {
    // Mark all as read locally and attempt to update server
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    try {
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
    } catch (err) {
      // Silent fail — local UX still updated
    }
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` } });
    } catch (err) {
      console.error('Failed to delete notification', err);
    }
  }, []);

  const NotificationBell = useCallback(() => (
    <button
      onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
      title={unreadCount ? `${unreadCount} إشعارات جديدة` : 'لا توجد إشعارات جديدة'}
      className={`h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-brand-navy hover:shadow-md transition-all relative ${bellPulse ? 'animate-pulse-slow' : ''}`}
    >
      <i className={`fa-solid fa-bell ${bellPulse ? 'text-amber-500' : ''}`}></i>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-red-500 border-2 border-white text-[9px] font-black text-white flex items-center justify-center">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  ), [isNotificationsOpen, unreadCount, bellPulse]);

  const value = useMemo(() => ({
    notifications, unreadCount, isNotificationsOpen, setIsNotificationsOpen, markAsRead, clearAllNotifications, deleteNotification, NotificationBell
  }), [notifications, unreadCount, isNotificationsOpen, setIsNotificationsOpen, markAsRead, clearAllNotifications, deleteNotification, NotificationBell]);

  const formatTimeAgo = (iso: string) => {
    try {
      const diff = Date.now() - new Date(iso).getTime();
      const seconds = Math.floor(diff / 1000);
      if (seconds < 10) return 'الآن';
      if (seconds < 60) return `${seconds} ثوانٍ`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes} دقيقة`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} ساعة`;
      const days = Math.floor(hours / 24);
      return `${days} يوم${days > 1 ? 'ين' : ''}`;
    } catch {
      return '';
    }
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9, x: 20 }}
            animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
            exit={{ opacity: 0, y: 20, scale: 0.9, x: 20 }}
            className="fixed bottom-6 right-6 z-[600] max-w-sm w-full"
          >
            <div className="bg-white rounded-[2rem] p-4 shadow-2xl border border-slate-100 flex items-start gap-4 backdrop-blur-md text-right">
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${activeToast.type === 'success' ? 'bg-emerald-50 text-emerald-600' : activeToast.type === 'warning' ? 'bg-amber-50 text-amber-600' : activeToast.type === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-600'}`}>
                <i className={`fa-solid ${activeToast.type === 'success' ? 'fa-circle-check' : activeToast.type === 'warning' ? 'fa-triangle-exclamation' : activeToast.type === 'error' ? 'fa-xmark-circle' : 'fa-info-circle'} text-lg`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-brand-dark mb-1 truncate">{activeToast.title}</h4>
                  <span className="text-[10px] text-slate-400 font-bold mr-2">{formatTimeAgo(activeToast.createdAt)}</span>
                </div>
                <p className="text-xs font-bold text-slate-600 leading-relaxed line-clamp-3">{activeToast.message}</p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => {
                      markAsRead(activeToast.id);
                      if (activeToast.link) navigate(activeToast.link);
                      setActiveToast(null);
                    }}
                    className="text-[11px] font-black uppercase tracking-widest text-brand-navy hover:text-brand-dark transition-colors"
                  >
                    عرض التفاصيل
                  </button>
                  <button onClick={() => setActiveToast(null)} className="text-[11px] font-black text-slate-400 hover:text-slate-600 transition">إغلاق</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
