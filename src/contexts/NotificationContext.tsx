import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useClient } from './ClientContext';

export type NotificationType = 'critical' | 'high' | 'medium' | 'low' | 'agent_online' | 'agent_offline' | 'agent_deleted' | 'rule_deployed';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  agentName?: string;
  alertId?: string;
  timestamp: Date;
  read: boolean;
}

export interface NotificationSettings {
  allowPopups: boolean;
  popupSeverities: {
    critical: boolean;
    high: boolean;
    medium: boolean;
    low: boolean;
    agent_online: boolean;
    agent_offline: boolean;
    agent_deleted: boolean;
    rule_deployed: boolean;
  };
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  removeNotification: (id: string) => void;
  soundEnabled: boolean;
  toggleSound: () => void;
  settings: NotificationSettings;
  updateSettings: (newSettings: Partial<NotificationSettings>) => void;
}

const defaultSettings: NotificationSettings = {
  allowPopups: true,
  popupSeverities: {
    critical: true,
    high: true,
    medium: true,
    low: true,
    agent_online: true,
    agent_offline: true,
    agent_deleted: true,
    rule_deployed: true,
  }
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    const saved = localStorage.getItem('kastron_notification_settings');
    if (saved) {
      try {
        return { ...defaultSettings, ...JSON.parse(saved) };
      } catch (e) {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });
  const { currentClient } = useClient();

  const updateSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('kastron_notification_settings', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const playSound = useCallback((type: NotificationType) => {
    if (!soundEnabled) return;
    if (type === 'critical' || type === 'high') {
      // Create a subtle beep sound using Web Audio API
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(type === 'critical' ? 880 : 660, audioCtx.currentTime); // A5 or E5
        
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5);
      } catch (e) {
        console.error("Audio playback failed", e);
      }
    }
  }, [soundEnabled]);

  const addNotification = useCallback((notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: AppNotification = {
      ...notification,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date(),
      read: false,
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      return updated.slice(0, 100); // Keep last 100
    });

    playSound(notification.type);
  }, [playSound]);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => !prev);
  }, []);

  const agentStatusesRef = useRef<Record<string, string>>({});

  // Fetch initial agent statuses
  useEffect(() => {
    if (!currentClient?.id || !supabase) return;
    
    const fetchAgents = async () => {
      const { data } = await supabase
        .from('agents')
        .select('id, status')
        .eq('client_id', currentClient.id);
        
      if (data) {
        const statuses: Record<string, string> = {};
        data.forEach(agent => {
          statuses[agent.id] = agent.status;
        });
        agentStatusesRef.current = statuses;
      }
    };
    
    fetchAgents();
  }, [currentClient?.id, supabase]);

  // Real-time subscriptions
  useEffect(() => {
    if (!currentClient?.id || !supabase) return;

    const clientId = currentClient.id;

    const alertsSubscription = supabase
      .channel('alerts-realtime-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'alerts',
        filter: `client_id=eq.${clientId}`
      }, (payload) => {
        const severity = payload.new.severity?.toLowerCase() || 'low';
        let type: NotificationType = 'low';
        if (severity === 'critical') type = 'critical';
        else if (severity === 'high') type = 'high';
        else if (severity === 'medium') type = 'medium';

        addNotification({
          type,
          title: `${severity.charAt(0).toUpperCase() + severity.slice(1)} Alert`,
          description: payload.new.description || 'New alert detected',
          agentName: payload.new.agent_name,
          alertId: payload.new.id
        });
      })
      .subscribe();

    const agentsSubscription = supabase
      .channel('agents-realtime-notifications')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'agents',
        filter: `client_id=eq.${clientId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          addNotification({
            type: 'agent_online',
            title: 'Agent Online',
            description: `${payload.new.name} is now connected`,
            agentName: payload.new.name
          });
        } else if (payload.eventType === 'DELETE') {
          addNotification({
            type: 'agent_deleted',
            title: 'Agent Deleted',
            description: `${payload.old.name} was removed`,
            agentName: payload.old.name
          });
        } else if (payload.eventType === 'UPDATE') {
          const oldStatus = agentStatusesRef.current[payload.new.id] || 'disconnected';
          const newStatus = payload.new.status;
          
          if (newStatus !== 'active' && oldStatus === 'active') {
            addNotification({
              type: 'agent_offline',
              title: 'Agent Offline',
              description: `${payload.new.name} disconnected`,
              agentName: payload.new.name
            });
          } else if (newStatus === 'active' && oldStatus !== 'active') {
            addNotification({
              type: 'agent_online',
              title: 'Agent Online',
              description: `${payload.new.name} is now connected`,
              agentName: payload.new.name
            });
          }
          
          agentStatusesRef.current[payload.new.id] = newStatus;
        }
      })
      .subscribe();

    const rulesSubscription = supabase
      .channel('rules-realtime-notifications')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'custom_rules',
        filter: `client_id=eq.${clientId}`
      }, (payload) => {
        if (payload.new.deployed === true && payload.old.deployed !== true) {
          addNotification({
            type: 'rule_deployed',
            title: 'Rule Deployed',
            description: `Rule "${payload.new.name}" was successfully deployed`,
          });
        }
      })
      .subscribe();

    return () => {
      alertsSubscription.unsubscribe();
      agentsSubscription.unsubscribe();
      rulesSubscription.unsubscribe();
    };
  }, [currentClient?.id, addNotification]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      clearAll,
      removeNotification,
      soundEnabled,
      toggleSound,
      settings,
      updateSettings
    }}>
      {children}
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
