import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SecurityAuditLog {
  id: string;
  event_type: string;
  event_details: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export const useSecurityAudit = () => {
  const [logs, setLogs] = useState<SecurityAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAuditLogs = async (limit = 10) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('security_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const logSecurityEvent = async (
    eventType: string,
    eventDetails: any,
    userId?: string
  ) => {
    try {
      const { error } = await supabase.from('security_audit_logs').insert({
        user_id: userId,
        event_type: eventType,
        event_details: eventDetails,
        ip_address: 'client-side', // Client-side can't get real IP
        user_agent: navigator.userAgent
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  return {
    logs,
    isLoading,
    fetchAuditLogs,
    logSecurityEvent
  };
};