-- Create audit log table for security monitoring
CREATE TABLE public.security_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  event_type TEXT NOT NULL,
  event_details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for audit logs - only authenticated users can view their own logs
CREATE POLICY "Users can view their own audit logs" 
ON public.security_audit_logs 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create SMS rate limiting table
CREATE TABLE public.sms_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sms_count INTEGER NOT NULL DEFAULT 1,
  reset_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '1 hour'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on rate limits
ALTER TABLE public.sms_rate_limits ENABLE ROW LEVEL SECURITY;

-- Create policy for rate limits - users can view their own limits
CREATE POLICY "Users can view their own rate limits" 
ON public.sms_rate_limits 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create unique constraint to prevent duplicate user entries
CREATE UNIQUE INDEX idx_sms_rate_limits_user_id ON public.sms_rate_limits(user_id);

-- Add trigger for automatic timestamp updates on rate limits
CREATE TRIGGER update_sms_rate_limits_updated_at
BEFORE UPDATE ON public.sms_rate_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();