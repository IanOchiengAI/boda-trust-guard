import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Initialize Supabase client with enhanced security headers
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !user) {
      // Log failed authentication attempt
      console.error('Authentication failed:', userError?.message || 'Invalid token');
      await logSecurityEvent(supabase, null, 'auth_failure', {
        error: userError?.message || 'Invalid token',
        ip: req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for'),
        userAgent: req.headers.get('user-agent')
      });
      throw new Error('Invalid user token');
    }

    // Check rate limiting
    const isRateLimited = await checkAndUpdateRateLimit(supabase, user.id);
    if (isRateLimited) {
      await logSecurityEvent(supabase, user.id, 'rate_limit_exceeded', {
        ip: req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for'),
        userAgent: req.headers.get('user-agent')
      });
      throw new Error('Rate limit exceeded. You can send up to 5 SMS per hour.');
    }

    const { message, location, trustPacketId }: SMSRequest = await req.json();

    // Validate request size (max 10KB)
    const requestSize = JSON.stringify({ message, location, trustPacketId }).length;
    if (requestSize > 10240) {
      throw new Error('Request too large');
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
    
    // Prepare SMS content with input sanitization
    let smsMessage = `🚨 EMERGENCY ALERT 🚨\n\n${message.substring(0, 500)}`; // Limit message length
    
    if (location) {
      smsMessage += `\n\nLocation: https://maps.google.com/maps?q=${location.latitude},${location.longitude}`;
    }
    
    if (trustPacketId) {
      smsMessage += `\n\nTrust Packet ID: ${trustPacketId.substring(0, 50)}`;
    }
    
    smsMessage += `\n\nTime: ${new Date().toLocaleString()}`;

    // Log emergency SMS initiation
    await logSecurityEvent(supabase, user.id, 'emergency_sms_initiated', {
      contactCount: contacts.length,
      hasLocation: !!location,
      hasTrustPacket: !!trustPacketId,
      messageLength: message.length,
      ip: req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent')
    });

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
    
    // Log SMS completion
    await logSecurityEvent(supabase, user.id, 'emergency_sms_completed', {
      successCount,
      totalContacts: contacts.length,
      results: results.map(r => ({ success: r.success, contact: r.contact }))
    });
    
    return new Response(JSON.stringify({
      success: successCount > 0,
      message: `SMS sent to ${successCount} of ${contacts.length} contacts`,
      results
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Security-Policy': "default-src 'self'",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
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
      
      await logSecurityEvent(supabase, null, 'function_error', {
        error: error.message,
        stack: error.stack,
        ip: req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for'),
        userAgent: req.headers.get('user-agent')
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
        'Content-Security-Policy': "default-src 'self'",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        ...corsHeaders 
      },
    });
  }
};

// Rate limiting function
async function checkAndUpdateRateLimit(supabase: any, userId: string): Promise<boolean> {
  const now = new Date();
  
  try {
    // Check existing rate limit
    const { data: existingLimit } = await supabase
      .from('sms_rate_limits')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!existingLimit) {
      // Create new rate limit entry
      const { error } = await supabase
        .from('sms_rate_limits')
        .insert({
          user_id: userId,
          sms_count: 1,
          reset_time: new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
        });
      
      if (error) {
        console.error('Error creating rate limit:', error);
        return false; // Allow on error to not block emergency services
      }
      return false;
    }

    // Check if reset time has passed
    const resetTime = new Date(existingLimit.reset_time);
    if (now > resetTime) {
      // Reset the counter
      const { error } = await supabase
        .from('sms_rate_limits')
        .update({
          sms_count: 1,
          reset_time: new Date(now.getTime() + 60 * 60 * 1000),
          updated_at: now
        })
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error resetting rate limit:', error);
      }
      return false;
    }

    // Check if limit exceeded (5 SMS per hour)
    if (existingLimit.sms_count >= 5) {
      return true;
    }

    // Increment counter
    const { error } = await supabase
      .from('sms_rate_limits')
      .update({
        sms_count: existingLimit.sms_count + 1,
        updated_at: now
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating rate limit:', error);
    }

    return false;
  } catch (error) {
    console.error('Rate limiting error:', error);
    return false; // Allow on error to not block emergency services
  }
}

// Security logging function
async function logSecurityEvent(supabase: any, userId: string | null, eventType: string, details: any) {
  try {
    const { error } = await supabase
      .from('security_audit_logs')
      .insert({
        user_id: userId,
        event_type: eventType,
        event_details: details,
        ip_address: details.ip,
        user_agent: details.userAgent
      });
    
    if (error) {
      console.error('Failed to log security event:', error);
    }
  } catch (error) {
    console.error('Security logging error:', error);
  }
}

serve(handler);