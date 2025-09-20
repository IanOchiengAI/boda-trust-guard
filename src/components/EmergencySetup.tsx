import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Shield } from 'lucide-react';
import { EmergencyContacts } from './EmergencyContacts';
import { EmailInputDialog } from './EmailInputDialog';
import { useToast } from '@/components/ui/use-toast';

export const EmergencySetup = () => {
  const [user, setUser] = useState(null);
  const [showSetup, setShowSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
        
        if (event === 'SIGNED_IN') {
          toast({
            title: "Successfully signed in",
            description: "You can now configure emergency contacts",
          });
        } else if (event === 'SIGNED_OUT') {
          setShowSetup(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [toast]);

  const handleSignIn = async (email: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Check your email",
        description: "We've sent you a secure login link",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setShowSetup(false);
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
          <p className="text-muted-foreground mb-4">
            Logged in as: {user.email}
          </p>
          <Button 
            onClick={() => setShowSetup(!showSetup)} 
            variant={showSetup ? "secondary" : "default"}
            className="w-full"
          >
            {showSetup ? "Hide" : "Show"} Emergency Contacts Setup
          </Button>
        </CardContent>
      </Card>

      {showSetup && <EmergencyContacts />}
    </div>
  );
};