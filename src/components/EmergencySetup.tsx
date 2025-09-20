import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Shield } from 'lucide-react';
import { EmergencyContacts } from './EmergencyContacts';
import { EmailInputDialog } from './EmailInputDialog';
import { SecurityDashboard } from './SecurityDashboard';
import { useToast } from '@/components/ui/use-toast';

export const EmergencySetup = () => {
  const [user, setUser] = useState(null);
  const [showSetup, setShowSetup] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [sessionExpiry, setSessionExpiry] = useState<Date | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    checkUser();

    // Set up auth state listener for real-time updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setAuthError('');
        
        // Set session expiry tracking
        if (session?.expires_at) {
          setSessionExpiry(new Date(session.expires_at * 1000));
        } else {
          setSessionExpiry(null);
        }
        
        if (event === 'SIGNED_IN') {
          toast({
            title: "Successfully signed in",
            description: "You can now configure emergency contacts",
          });
        } else if (event === 'SIGNED_OUT') {
          setShowSetup(false);
          setSessionExpiry(null);
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('Session token refreshed');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [toast]);

  const handleSignIn = async (email: string) => {
    setIsLoading(true);
    setAuthError('');
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        }
      });
      
      if (error) {
        // Enhanced error handling
        let userFriendlyMessage = error.message;
        
        if (error.message.includes('rate_limit')) {
          userFriendlyMessage = 'Too many login attempts. Please wait a few minutes before trying again.';
        } else if (error.message.includes('email_address_invalid')) {
          userFriendlyMessage = 'Please enter a valid email address.';
        } else if (error.message.includes('signup_disabled')) {
          userFriendlyMessage = 'New signups are currently disabled. Please contact support.';
        }
        
        setAuthError(userFriendlyMessage);
        throw new Error(userFriendlyMessage);
      }
      
      toast({
        title: "Check your email",
        description: "We've sent you a secure login link. Please check your spam folder if you don't see it.",
      });
    } catch (error: any) {
      toast({
        title: "Authentication Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      setShowSetup(false);
      
      toast({
        title: "Signed out successfully",
        description: "You have been safely signed out",
      });
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast({
        title: "Sign Out Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Emergency SMS Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Sign in to configure emergency contacts for automatic SMS alerts during crashes.
          </p>
          <EmailInputDialog onSubmit={handleSignIn} loading={isLoading} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Emergency SMS System
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 mb-4">
            <p className="text-muted-foreground">
              Logged in as: {user.email}
            </p>
            {sessionExpiry && (
              <p className="text-xs text-muted-foreground">
                Session expires: {sessionExpiry.toLocaleString()}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Button 
              onClick={() => setShowSetup(!showSetup)} 
              variant={showSetup ? "secondary" : "default"}
              className="w-full"
            >
              {showSetup ? "Hide" : "Show"} Emergency Contacts Setup
            </Button>
            <Button 
              onClick={() => setShowSecurity(!showSecurity)} 
              variant={showSecurity ? "secondary" : "outline"}
              className="w-full"
            >
              <Shield className="h-4 w-4 mr-2" />
              {showSecurity ? "Hide" : "Show"} Security Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>

      {showSetup && <EmergencyContacts />}
      {showSecurity && <SecurityDashboard />}
    </div>
  );
};