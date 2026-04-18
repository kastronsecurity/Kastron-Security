import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertCircle, AlertTriangle, Info, CheckCircle2, Server, Trash2, ServerOff, Sparkles, Download, ShieldAlert } from 'lucide-react';
import { useNotifications, AppNotification, NotificationType } from '../../contexts/NotificationContext';
import { cn } from '../../lib/utils';

const getNotificationConfig = (type: NotificationType) => {
  switch (type) {
    case 'critical':
      return { icon: AlertCircle, color: 'text-red-500', borderColor: 'border-red-500/50', bg: 'bg-red-500' };
    case 'high':
      return { icon: AlertTriangle, color: 'text-orange-500', borderColor: 'border-orange-500/50', bg: 'bg-orange-500' };
    case 'medium':
      return { icon: AlertTriangle, color: 'text-yellow-500', borderColor: 'border-yellow-500/50', bg: 'bg-yellow-500' };
    case 'low':
      return { icon: Info, color: 'text-blue-500', borderColor: 'border-blue-500/50', bg: 'bg-blue-500' };
    case 'agent_online':
      return { icon: Server, color: 'text-green-500', borderColor: 'border-green-500/50', bg: 'bg-green-500' };
    case 'agent_offline':
      return { icon: ServerOff, color: 'text-neutral-500', borderColor: 'border-neutral-500/50', bg: 'bg-neutral-500' };
    case 'agent_deleted':
      return { icon: Trash2, color: 'text-neutral-500', borderColor: 'border-neutral-500/50', bg: 'bg-neutral-500' };
    case 'rule_deployed':
      return { icon: CheckCircle2, color: 'text-green-500', borderColor: 'border-green-500/50', bg: 'bg-green-500' };
    case 'report_generated':
      return { icon: Sparkles, color: 'text-purple-500', borderColor: 'border-purple-500/50', bg: 'bg-purple-500' };
    case 'report_downloaded':
      return { icon: Download, color: 'text-blue-500', borderColor: 'border-blue-500/50', bg: 'bg-blue-500' };
    case 'alert_escalated':
      return { icon: ShieldAlert, color: 'text-red-500', borderColor: 'border-red-500/50', bg: 'bg-red-500' };
    default:
      return { icon: Info, color: 'text-blue-500', borderColor: 'border-blue-500/50', bg: 'bg-blue-500' };
  }
};

const Toast = ({ notification, onRemove, onClick }: { notification: AppNotification, onRemove: (id: string) => void, onClick: (n: AppNotification) => void }) => {
  const config = getNotificationConfig(notification.type);
  const Icon = config.icon;

  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(notification.id);
    }, 5000);

    return () => clearTimeout(timer);
  }, [notification.id, onRemove]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={cn(
        "relative w-[320px] bg-[#0a0a0a] border rounded-lg overflow-hidden cursor-pointer",
        config.borderColor
      )}
      onClick={() => onClick(notification)}
    >
      <div className="py-2.5 px-3 flex items-start gap-2.5">
        <Icon className={cn("w-4 h-4 shrink-0 mt-0.5", config.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <p className={cn("text-[13px] font-bold tracking-tight", config.color)}>
              {notification.title}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(notification.id);
              }}
              className="text-neutral-500 hover:text-white transition-colors ml-2 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[12px] text-neutral-300 mt-0.5 leading-snug line-clamp-1 pr-2">
            {notification.description}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export const NotificationToasts = ({ currentPage }: { currentPage?: string }) => {
  const { notifications, removeNotification, markAsRead, settings } = useNotifications();
  
  const [activeToasts, setActiveToasts] = useState<AppNotification[]>([]);
  const [alertsPageState, setAlertsPageState] = useState({ isScrolled: false, isAlertExpanded: false });

  useEffect(() => {
    const handleAlertsState = (e: any) => {
      if (e.detail) {
        setAlertsPageState(prev => ({ ...prev, ...e.detail }));
      }
    };
    window.addEventListener('alertsPageStateChange', handleAlertsState);
    return () => window.removeEventListener('alertsPageStateChange', handleAlertsState);
  }, []);

  useEffect(() => {
    if (notifications.length > 0) {
      const latest = notifications[0];
      
      // Check if popup is allowed for this notification type
      if (!settings.allowPopups) return;
      if (!settings.popupSeverities[latest.type]) return;

      // Logic for alerts page
      if (currentPage === 'alerts') {
        // If on alerts page, only show if scrolled down or an alert is expanded
        if (!alertsPageState.isScrolled && !alertsPageState.isAlertExpanded) {
          return;
        }
      }

      setActiveToasts(prev => {
        if (!prev.find(t => t.id === latest.id)) {
          const newToasts = [...prev, latest];
          if (newToasts.length > 3) {
            return newToasts.slice(1);
          }
          return newToasts;
        }
        return prev;
      });
    }
  }, [notifications, settings, currentPage, alertsPageState]);

  const removeToast = (id: string) => {
    setActiveToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleToastClick = (notification: AppNotification) => {
    markAsRead(notification.id);
    removeToast(notification.id);
    if (notification.alertId) {
      window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'alerts', data: { openAlertId: notification.alertId } } }));
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {activeToasts.map(notification => (
          <div key={notification.id} className="pointer-events-auto">
            <Toast 
              notification={notification} 
              onRemove={removeToast} 
              onClick={handleToastClick}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};
