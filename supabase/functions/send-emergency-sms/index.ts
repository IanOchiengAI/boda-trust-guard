import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'",
};

const MAX_SMS_PER_HOUR = 5;
const MAX_REQUEST_SIZE = 1024 * 10; // 10KB limit

interface SMSRequest {
  message: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  trustPacketId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Request size validation
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
      throw new Error('Request too large');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Get client info for logging
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !user) {
      // Log failed authentication attempt
      await supabase.from('security_audit_logs').insert({
        event_type: 'failed_auth',
        event_details: { error: userError?.message || 'Invalid token' },
        ip_address: clientIP,
        user_agent: userAgent
      });
      throw new Error('Invalid user token');
    }

    const { message, location, trustPacketId }: SMSRequest = await req.json();

    // Check rate limiting
    const { data: rateLimit, error: rateLimitError } = await supabase
      .from('sms_rate_limits')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (rateLimitError && rateLimitError.code !== 'PGRST116') {
      throw new Error('Error checking rate limits');
    }

    const now = new Date();
    
    if (rateLimit) {
      const resetTime = new Date(rateLimit.reset_time);
      
      if (now > resetTime) {
        // Reset the counter
        await supabase
          .from('sms_rate_limits')
          .update({
            sms_count: 1,
            reset_time: new Date(now.getTime() + 60 * 60 * 1000).toISOString() // 1 hour from now
          })
          .eq('user_id', user.id);
      } else if (rateLimit.sms_count >= MAX_SMS_PER_HOUR) {
        // Log rate limit violation
        await supabase.from('security_audit_logs').insert({
          user_id: user.id,
          event_type: 'rate_limit_exceeded',
          event_details: { 
            current_count: rateLimit.sms_count,
            max_allowed: MAX_SMS_PER_HOUR,
            reset_time: rateLimit.reset_time
          },
          ip_address: clientIP,
          user_agent: userAgent
        });
        
        throw new Error(`Rate limit exceeded. Maximum ${MAX_SMS_PER_HOUR} SMS per hour. Reset at ${resetTime.toLocaleString()}`);
      } else {
        // Increment counter
        await supabase
          .from('sms_rate_limits')
          .update({ sms_count: rateLimit.sms_count + 1 })
          .eq('user_id', user.id);
      }
    } else {
      // Create new rate limit entry
      await supabase
        .from('sms_rate_limits')
        .insert({
          user_id: user.id,
          sms_count: 1,
          reset_time: new Date(now.getTime() + 60 * 60 * 1000).toISOString()
        });
    }

    // Get emergency contacts for the user
    const { data: contacts, error: contactsError } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', user.id)
      .order('is_primary', { ascending: false });

    if (contactsError) {
      throw new Error(`Error fetching contacts: ${contactsError.message}`);
    }

    if (!contacts || contacts.length === 0) {
      throw new Error('No emergency contacts found');
    }

    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      throw new Error('Twilio credentials not configured');
    }

    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
    
    // Prepare SMS content
    let smsMessage = `🚨 EMERGENCY ALERT 🚨\n\n${message}`;
    
    if (location) {
      smsMessage += `\n\nLocation: https://maps.google.com/maps?q=${location.latitude},${location.longitude}`;
    }
    
    if (trustPacketId) {
      smsMessage += `\n\nTrust Packet ID: ${trustPacketId}`;
    }
    
    smsMessage += `\n\nTime: ${new Date().toLocaleString()}`;

    // Send SMS to all emergency contacts
    const results = [];
    for (const contact of contacts) {
      try {
        console.log(`Sending SMS to ${contact.name} at ${contact.phone_number}`);
        
        const twilioResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              To: contact.phone_number,
              From: twilioPhoneNumber,
              Body: smsMessage,
            }),
          }
        );

        const twilioData = await twilioResponse.json();
        
        if (!twilioResponse.ok) {
          console.error(`Twilio error for ${contact.name}:`, twilioData);
          results.push({
            contact: contact.name,
            phone: contact.phone_number,
            success: false,
            error: twilioData.message || 'Unknown error'
          });
        } else {
          console.log(`SMS sent successfully to ${contact.name}:`, twilioData.sid);
          results.push({
            contact: contact.name,
            phone: contact.phone_number,
            success: true,
            sid: twilioData.sid
          });
        }
      } catch (error) {
        console.error(`Error sending SMS to ${contact.name}:`, error);
        results.push({
          contact: contact.name,
          phone: contact.phone_number,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    // Log successful SMS send
    await supabase.from('security_audit_logs').insert({
      user_id: user.id,
      event_type: 'emergency_sms_sent',
      event_details: { 
        contacts_count: contacts.length,
        success_count: successCount,
        message_preview: message.substring(0, 50),
        has_location: !!location,
        trust_packet_id: trustPacketId
      },
      ip_address: clientIP,
      user_agent: userAgent
    });
    
    return new Response(JSON.stringify({
      success: successCount > 0,
      message: `SMS sent to ${successCount} of ${contacts.length} contacts`,
      results
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in send-emergency-sms function:', error);
    
    // Log error events
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase.from('security_audit_logs').insert({
        event_type: 'sms_function_error',
        event_details: { 
          error_message: error.message,
          error_stack: error.stack
        },
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown'
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json', 
        ...corsHeaders 
      },
    });
  }
};

serve(handler);