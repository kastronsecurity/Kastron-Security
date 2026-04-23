import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface Client {
  id: string;
  user_id: string;
  name: string;
  install_key: string;
  wazuh_group: string;
  onboarding_step?: number;
  infrastructure?: {
    has_windows: boolean;
    has_linux: boolean;
    has_firewall: boolean;
    has_webserver: boolean;
    has_cloud: boolean;
    has_custom: boolean;
    firewall_type?: string;
    firewall_ip?: string;
    syslog_port?: number;
    syslog_protocol?: string;
  };
  created_at: string;
}

interface ClientContextType {
  currentClient: Client | null;
  user: any | null;
  loading: boolean;
  authLoading: boolean;
  isAdmin: boolean;
  adminRole: string | null;
  mfaRequired: boolean;
  mfaLoading: boolean;
  agentCount: number;
  alertCount: number;
  onboardingCompleted: boolean;
  refreshClient: () => Promise<void>;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export const ClientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentClient, setCurrentClient] = useState<Client | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [agentCount, setAgentCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  const isFetching = useRef(false);

  const fetchClient = async (passedUser?: any, isBackground = false) => {
    if (!supabase || isFetching.current) {
      return;
    }

    try {
      isFetching.current = true;
      if (!isBackground) setLoading(true);
      
      let currentUser = passedUser;
      if (!currentUser) {
        const { data: { session } } = await supabase.auth.getSession();
        currentUser = session?.user;
      }
      
      if (!currentUser) {
        setCurrentClient(null);
        setOnboardingCompleted(false);
        setLoading(false);
        return;
      }

      setOnboardingCompleted(!!currentUser.user_metadata?.onboarding_completed);

      // Check if admin
      const { data: adminData } = await supabase
        .from('admin_users')
        .select('role')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      
      if (adminData) {
        setIsAdmin(true);
        setAdminRole(adminData.role);
        // Admins don't strictly need a client_id for metrics, but they might be a client too
      } else {
        setIsAdmin(false);
        setAdminRole(null);
      }

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching client:', error);
        setCurrentClient(null);
      } else {
        setCurrentClient(data);
        if (data) {
          // Fetch agent count and alert count
          const [agentsRes, alertsRes] = await Promise.all([
            supabase.from('agents').select('*', { count: 'exact', head: true }).eq('client_id', data.id),
            supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('client_id', data.id)
          ]);
          
          if (!agentsRes.error) setAgentCount(agentsRes.count || 0);
          if (!alertsRes.error) setAlertCount(alertsRes.count || 0);
        }
      }
    } catch (error) {
      console.error('Unexpected error fetching client:', error);
      setCurrentClient(null);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setAuthLoading(false);
      return;
    }

    // Listen for auth changes to re-fetch client
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change in ClientProvider:', event);
      const newUser = session?.user || null;
      setUser(newUser);
      setAuthLoading(false);

      if (newUser) {
        // Check MFA status
        const checkMFA = async () => {
          setMfaLoading(true);
          try {
            const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            if (error) throw error;
            console.log('MFA Check:', data);
            setMfaRequired(data.nextLevel === 'aal2' && data.currentLevel !== 'aal2');
          } catch (err) {
            console.error('Error checking MFA level:', err);
          } finally {
            setMfaLoading(false);
          }
        };
        checkMFA();
        fetchClient(newUser);
      } else {
        setCurrentClient(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !currentClient) return;

    // Real-time listener for agents and alerts to update counts
    // Filtered by client_id for performance and to avoid unnecessary refreshes
    const countsChannel = supabase
      .channel(`client_counts_${currentClient.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'agents',
        filter: `client_id=eq.${currentClient.id}`
      }, () => {
        if (isFetching.current === false) {
          fetchClient(undefined, true);
        }
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'alerts',
        filter: `client_id=eq.${currentClient.id}`
      }, () => {
        if (isFetching.current === false) {
          fetchClient(undefined, true);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(countsChannel);
    };
  }, [currentClient?.id]);

  return (
    <ClientContext.Provider value={{ 
      currentClient, 
      user, 
      loading, 
      authLoading, 
      isAdmin,
      adminRole,
      mfaRequired,
      mfaLoading,
      agentCount,
      alertCount,
      onboardingCompleted,
      refreshClient: fetchClient 
    }}>
      {children}
    </ClientContext.Provider>
  );
};

export const useClient = () => {
  const context = useContext(ClientContext);
  if (context === undefined) {
    throw new Error('useClient must be used within a ClientProvider');
  }
  return context;
};
