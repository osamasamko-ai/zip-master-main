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
        playNotificationSound();
        setTimeout(() => setActiveToast(null), 6000); // Auto-dismiss toast
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
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  }, []);

  const NotificationBell = useCallback(() => (
    <button
      onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
      className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-brand-navy hover:shadow-md transition-all relative"
    >
      <i className="fa-solid fa-bell"></i>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 border-2 border-white text-[8px] font-black text-white flex items-center justify-center">
          {unreadCount}
        </span>
      )}
    </button>
  ), [isNotificationsOpen, unreadCount]);

  const value = useMemo(() => ({
    notifications, unreadCount, isNotificationsOpen, setIsNotificationsOpen, markAsRead, clearAllNotifications, NotificationBell
  }), [notifications, unreadCount, isNotificationsOpen, setIsNotificationsOpen, markAsRead, clearAllNotifications, NotificationBell]);

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
            <div className="bg-brand-dark text-white rounded-[2rem] p-5 shadow-2xl border border-white/10 flex items-start gap-4 backdrop-blur-md text-right">
              <div className="h-12 w-12 rounded-2xl bg-brand-gold/20 flex items-center justify-center text-brand-gold shrink-0 shadow-inner">
                <i className="fa-solid fa-bell-concierge text-lg animate-bounce"></i>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-black text-brand-gold mb-1">{activeToast.title}</h4>
                <p className="text-xs font-bold text-slate-300 leading-relaxed line-clamp-2">{activeToast.message}</p>
                <button 
                  onClick={() => {
                    markAsRead(activeToast.id);
                    if (activeToast.link) navigate(activeToast.link);
                    setActiveToast(null);
                  }}
                  className="mt-3 text-[10px] font-black uppercase tracking-widest text-brand-gold hover:text-white transition-colors"
                >
                  عرض التفاصيل <i className="fa-solid fa-arrow-left mr-1"></i>
                </button>
              </div>
              <button onClick={() => setActiveToast(null)} className="text-white/30 hover:text-white transition">
                <i className="fa-solid fa-xmark"></i>
              </button>
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
