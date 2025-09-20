import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface SecurityAuditLog {
  id: string;
  event_type: string;
  event_details: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

interface RateLimit {
  id: string;
  sms_count: number;
  reset_time: string;
  created_at: string;
}

export const SecurityDashboard = () => {
  const [auditLogs, setAuditLogs] = useState<SecurityAuditLog[]>([]);
  const [rateLimit, setRateLimit] = useState<RateLimit | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchSecurityData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch audit logs
      const { data: logs, error: logsError } = await supabase
        .from('security_audit_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (logsError) {
        console.error('Error fetching audit logs:', logsError);
      } else {
        setAuditLogs(logs || []);
      }

      // Fetch rate limit info
      const { data: rateLimitData, error: rateLimitError } = await supabase
        .from('sms_rate_limits')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (rateLimitError && rateLimitError.code !== 'PGRST116') {
        console.error('Error fetching rate limit:', rateLimitError);
      } else {
        setRateLimit(rateLimitData);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch security data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case 'emergency_sms_initiated':
      case 'emergency_sms_completed':
        return 'bg-green-100 text-green-800';
      case 'auth_failure':
      case 'rate_limit_exceeded':
      case 'function_error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const formatEventType = (eventType: string) => {
    return eventType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getRemainingQuota = () => {
    if (!rateLimit) return 5;
    
    const resetTime = new Date(rateLimit.reset_time);
    const now = new Date();
    
    if (now > resetTime) {
      return 5; // Reset occurred
    }
    
    return Math.max(0, 5 - rateLimit.sms_count);
  };

  const getTimeUntilReset = () => {
    if (!rateLimit) return null;
    
    const resetTime = new Date(rateLimit.reset_time);
    const now = new Date();
    
    if (now > resetTime) {
      return 'Reset available';
    }
    
    const diffMs = resetTime.getTime() - now.getTime();
    const diffMins = Math.ceil(diffMs / (1000 * 60));
    
    if (diffMins < 60) {
      return `${diffMins} minutes`;
    }
    
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;
    
    return `${diffHours}h ${remainingMins}m`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Dashboard
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSecurityData}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Rate Limiting Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  SMS Quota
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{getRemainingQuota()}/5</div>
                <p className="text-xs text-muted-foreground">SMS remaining this hour</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Reset Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm font-semibold">{getTimeUntilReset()}</div>
                <p className="text-xs text-muted-foreground">Until quota resets</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Recent Security Activity</h3>
            {auditLogs.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No security events recorded yet
              </p>
            ) : (
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getEventTypeColor(log.event_type)}>
                          {formatEventType(log.event_type)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(log.created_at)}
                        </span>
                      </div>
                      
                      {log.event_details && (
                        <div className="text-sm space-y-1">
                          {log.event_type === 'emergency_sms_initiated' && (
                            <div>
                              <span className="font-medium">Contacts:</span> {log.event_details.contactCount}
                              {log.event_details.hasLocation && (
                                <span className="ml-2 text-green-600">📍 Location included</span>
                              )}
                            </div>
                          )}
                          
                          {log.event_type === 'emergency_sms_completed' && (
                            <div>
                              <span className="font-medium">Success:</span> {log.event_details.successCount}/{log.event_details.totalContacts} messages sent
                            </div>
                          )}
                          
                          {log.event_type === 'auth_failure' && (
                            <div className="text-red-600">
                              <span className="font-medium">Error:</span> {log.event_details.error}
                            </div>
                          )}
                          
                          {log.event_type === 'rate_limit_exceeded' && (
                            <div className="text-orange-600">
                              SMS rate limit exceeded
                            </div>
                          )}
                        </div>
                      )}
                      
                      {(log.ip_address || log.user_agent) && (
                        <div className="text-xs text-muted-foreground mt-2 space-y-1">
                          {log.ip_address && (
                            <div>IP: {log.ip_address}</div>
                          )}
                          {log.user_agent && (
                            <div className="truncate max-w-md">
                              Agent: {log.user_agent}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};