import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const useIsAdmin = () => {
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminLoading, setAdminLoading] = useState(true)

  useEffect(() => {
    let mounted = true;

    const checkAdmin = async (user: any) => {
      if (!mounted) return;
      
      try {
        if (!user) {
          setIsAdmin(false);
          setAdminLoading(false);
          return;
        }

        const userEmail = user.email?.toLowerCase().trim() || '';
        console.log('useIsAdmin: Checking email:', userEmail);
        
        // Auto-admin for strictly designated admin only
        if (userEmail === 'adminkastronsec@gmail.com' || userEmail === 'kastronsec@gmail.com') {
          setIsAdmin(true);
          setAdminLoading(false);
          return;
        }

        // For any other account, strictly deny admin access
        setIsAdmin(false);
        setAdminLoading(false);
      } catch (err) {
        console.error('Error checking admin status:', err)
        if (mounted) setIsAdmin(false);
      } finally {
        if (mounted) setAdminLoading(false);
      }
    };

    // Initial check
    supabase.auth.getUser().then(({ data: { user } }) => {
      checkAdmin(user);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      checkAdmin(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [])

  return { isAdmin, adminLoading }
}
