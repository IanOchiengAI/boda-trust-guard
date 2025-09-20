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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    const { message, location, trustPacketId }: SMSRequest = await req.json();

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