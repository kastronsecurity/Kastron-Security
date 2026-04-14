import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, Trash2, Volume2, VolumeX, AlertCircle, AlertTriangle, Info, Server, ServerOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications, NotificationType, AppNotification } from '../../contexts/NotificationContext';
import { cn } from '../../lib/utils';

const getNotificationConfig = (type: NotificationType) => {
  switch (type) {
    case 'critical': return { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10' };
    case 'high': return { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10' };
    case 'medium': return { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
    case 'low': return { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10' };
    case 'agent_online': return { icon: Server, color: 'text-green-500', bg: 'bg-green-500/10' };
    case 'agent_offline':
    case 'agent_deleted': return { icon: ServerOff, color: 'text-neutral-500', bg: 'bg-neutral-500/10' };
    case 'rule_deployed': return { icon: Check, color: 'text-green-500', bg: 'bg-green-500/10' };
    default: return { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10' };
  }
};

const formatTimeAgo = (date: Date) => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export const NotificationBell = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll, soundEnabled, toggleSound } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (notification: AppNotification) => {
    markAsRead(notification.id);
    setIsOpen(false);
    if (notification.alertId) {
      window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'alerts', data: { openAlertId: notification.alertId } } }));
    }
  };

  const hasCriticalUnread = notifications.some(n => !n.read && n.type === 'critical');

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-all relative"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className={cn(
            "absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 flex items-center justify-center text-[9px] font-bold text-white",
            hasCriticalUnread && "animate-pulse"
          )}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-96 bg-[#0a0a0a] border border-neutral-800 rounded-xl shadow-2xl overflow-hidden z-50"
          >
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
              <h3 className="text-sm font-bold text-white">Notifications</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={toggleSound}
                  className="p-1.5 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded transition-colors"
                  title={soundEnabled ? "Mute sounds" : "Unmute sounds"}
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
                <button 
                  onClick={markAllAsRead}
                  className="p-1.5 text-neutral-500 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                  title="Mark all as read"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={clearAll}
                  className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  title="Clear all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto scrollbar-hide">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-neutral-500 text-sm">
                  No notifications yet
                </div>
              ) : (
                <div className="divide-y divide-neutral-800/50">
                  {notifications.slice(0, 20).map(notification => {
                    const config = getNotificationConfig(notification.type);
                    const Icon = config.icon;
                    
                    return (
                      <div 
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={cn(
                          "p-4 hover:bg-neutral-900/50 cursor-pointer transition-colors flex gap-3",
                          !notification.read ? "bg-neutral-900/20" : "opacity-75"
                        )}
                      >
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", config.bg)}>
                          <Icon className={cn("w-4 h-4", config.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm truncate",
                            !notification.read ? "text-white font-medium" : "text-neutral-300"
                          )}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-neutral-500 truncate mt-0.5">
                            {notification.description}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[10px] font-medium text-neutral-600">
                              {notification.agentName}
                            </span>
                            <span className="text-[10px] text-neutral-600">
                              {formatTimeAgo(notification.timestamp)}
                            </span>
                          </div>
                        </div>
                        {!notification.read && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {notifications.length > 20 && (
              <div className="p-2 border-t border-neutral-800 bg-neutral-900/30 text-center">
                <span className="text-xs text-neutral-500">Showing last 20 notifications</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
