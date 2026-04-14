import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface Client {
  id: string;
  user_id: string;
  name: string;
  install_key: string;
  wazuh_group: string;
  created_at: string;
}

interface ClientContextType {
  currentClient: Client | null;
  user: any | null;
  loading: boolean;
  authLoading: boolean;
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
  const [agentCount, setAgentCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  const isFetching = useRef(false);

  const fetchClient = async (passedUser?: any) => {
    if (!supabase || isFetching.current) {
      return;
    }

    try {
      isFetching.current = true;
      setLoading(true);
      
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
          
          setAgentCount(agentsRes.count || 0);
          setAlertCount(alertsRes.count || 0);
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
        fetchClient(newUser);
      } else {
        setCurrentClient(null);
        setLoading(false);
      }
    });

    // Real-time listener for agents and alerts to update counts
    const countsChannel = supabase
      .channel('client_counts')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'agents'
      }, () => {
        if (isFetching.current === false) {
          fetchClient();
        }
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'alerts'
      }, () => {
        if (isFetching.current === false) {
          fetchClient();
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(countsChannel);
    };
  }, []);

  return (
    <ClientContext.Provider value={{ 
      currentClient, 
      user, 
      loading, 
      authLoading, 
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
