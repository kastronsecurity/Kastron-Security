import React from 'react';
import { motion } from 'motion/react';
import { Bell, ShieldAlert, Server, CheckCircle2, Settings as SettingsIcon } from 'lucide-react';
import { useNotifications, NotificationType } from '../../contexts/NotificationContext';
import { cn } from '../../lib/utils';

export const SettingsPage = () => {
  const { settings, updateSettings } = useNotifications();

  const handleTogglePopups = () => {
    updateSettings({ allowPopups: !settings.allowPopups });
  };

  const handleToggleSeverity = (type: NotificationType) => {
    updateSettings({
      popupSeverities: {
        ...settings.popupSeverities,
        [type]: !settings.popupSeverities[type]
      }
    });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <SettingsIcon className="w-6 h-6 text-neutral-400" />
          Settings
        </h1>
        <p className="text-neutral-400 mt-2">Manage your application preferences and notification settings.</p>
      </div>

      <div className="space-y-6">
        <section className="bg-[#0a0a0a] border border-neutral-800 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-neutral-800">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-neutral-400" />
              Notification Preferences
            </h2>
            <p className="text-sm text-neutral-400 mt-1">Configure how and when you receive alerts.</p>
          </div>

          <div className="p-6 space-y-8">
            {/* Master Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-medium">Enable Popup Notifications</h3>
                <p className="text-sm text-neutral-400 mt-1">Show toast notifications in the top right corner of the screen.</p>
              </div>
              <button
                onClick={handleTogglePopups}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                  settings.allowPopups ? "bg-blue-500" : "bg-neutral-700"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    settings.allowPopups ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>

            {/* Severity Toggles */}
            <div className={cn("space-y-4 transition-opacity", !settings.allowPopups && "opacity-50 pointer-events-none")}>
              <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">Alert Severities</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { type: 'critical', label: 'Critical Alerts', icon: ShieldAlert, color: 'text-red-500' },
                  { type: 'high', label: 'High Alerts', icon: ShieldAlert, color: 'text-orange-500' },
                  { type: 'medium', label: 'Medium Alerts', icon: ShieldAlert, color: 'text-yellow-500' },
                  { type: 'low', label: 'Low Alerts', icon: ShieldAlert, color: 'text-blue-500' },
                ].map((item) => (
                  <div key={item.type} className="flex items-center justify-between p-4 bg-neutral-900/50 border border-neutral-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <item.icon className={cn("w-5 h-5", item.color)} />
                      <span className="text-neutral-200">{item.label}</span>
                    </div>
                    <button
                      onClick={() => handleToggleSeverity(item.type as NotificationType)}
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                        settings.popupSeverities[item.type as NotificationType] ? "bg-blue-500" : "bg-neutral-700"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                          settings.popupSeverities[item.type as NotificationType] ? "translate-x-5" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* System Events Toggles */}
            <div className={cn("space-y-4 transition-opacity", !settings.allowPopups && "opacity-50 pointer-events-none")}>
              <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">System Events</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { type: 'agent_online', label: 'Agent Online', icon: Server, color: 'text-green-500' },
                  { type: 'agent_offline', label: 'Agent Offline', icon: Server, color: 'text-neutral-500' },
                  { type: 'agent_deleted', label: 'Agent Deleted', icon: Server, color: 'text-neutral-500' },
                  { type: 'rule_deployed', label: 'Rule Deployed', icon: CheckCircle2, color: 'text-green-500' },
                ].map((item) => (
                  <div key={item.type} className="flex items-center justify-between p-4 bg-neutral-900/50 border border-neutral-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <item.icon className={cn("w-5 h-5", item.color)} />
                      <span className="text-neutral-200">{item.label}</span>
                    </div>
                    <button
                      onClick={() => handleToggleSeverity(item.type as NotificationType)}
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                        settings.popupSeverities[item.type as NotificationType] ? "bg-blue-500" : "bg-neutral-700"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                          settings.popupSeverities[item.type as NotificationType] ? "translate-x-5" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>
      </div>
    </div>
  );
};
