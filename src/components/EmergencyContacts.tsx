import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, User, Phone } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { validateAndFormatPhone } from '@/utils/phoneValidation';
import { validateEmergencyContact, sanitizeInput, checkClientRateLimit } from '@/utils/securityValidation';
import { useSecurityAudit } from '@/hooks/useSecurityAudit';

interface EmergencyContact {
  id: string;
  name: string;
  phone_number: string;
  relationship?: string;
  is_primary: boolean;
}

export const EmergencyContacts = () => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phone_number: '',
    relationship: '',
    is_primary: false
  });
  const [phoneError, setPhoneError] = useState('');
  const { toast } = useToast();
  const { logSecurityEvent } = useSecurityAudit();

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('*')
        .order('is_primary', { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch emergency contacts",
        variant: "destructive",
      });
    }
  };

  const addContact = async () => {
    // Check client-side rate limiting (max 10 contacts per minute)
    if (checkClientRateLimit('add_contact', 10, 60000)) {
      toast({
        title: "Rate Limited",
        description: "Please wait before adding more contacts",
        variant: "destructive",
      });
      return;
    }

    if (!newContact.name || !newContact.phone_number) {
      toast({
        title: "Error",
        description: "Name and phone number are required",
        variant: "destructive",
      });
      return;
    }

    // Enhanced validation with security checks
    const sanitizedContact = {
      name: sanitizeInput(newContact.name),
      phone_number: sanitizeInput(newContact.phone_number),
      relationship: newContact.relationship ? sanitizeInput(newContact.relationship) : ''
    };

    const validation = validateEmergencyContact(sanitizedContact);
    if (!validation.isValid) {
      toast({
        title: "Validation Error",
        description: validation.errors.join('. '),
        variant: "destructive",
      });
      return;
    }

    // Validate phone number format
    const phoneValidation = validateAndFormatPhone(sanitizedContact.phone_number);
    if (!phoneValidation.isValid) {
      setPhoneError(phoneValidation.error || 'Invalid phone number');
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('emergency_contacts')
        .insert({
          name: sanitizedContact.name,
          phone_number: phoneValidation.formatted || sanitizedContact.phone_number,
          relationship: sanitizedContact.relationship || null,
          is_primary: newContact.is_primary,
          user_id: user.id
        });

      if (error) throw error;

      // Log security event
      await logSecurityEvent('emergency_contact_added', {
        contact_name: newContact.name,
        relationship: newContact.relationship,
        is_primary: newContact.is_primary
      }, user.id);

      toast({
        title: "Success",
        description: "Emergency contact added successfully",
      });

      setNewContact({ name: '', phone_number: '', relationship: '', is_primary: false });
      setPhoneError('');
      await fetchContacts();
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

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewContact({ ...newContact, phone_number: value });
    if (phoneError && value.trim()) {
      setPhoneError('');
    }
  };

  const deleteContact = async (id: string) => {
    try {
      const { error } = await supabase
        .from('emergency_contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Log security event
      const { data: { user } } = await supabase.auth.getUser();
      await logSecurityEvent('emergency_contact_deleted', {
        contact_id: id
      }, user?.id);

      toast({
        title: "Success",
        description: "Emergency contact deleted",
      });

      await fetchContacts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Emergency Contacts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new contact form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={newContact.name}
              onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
              placeholder="Enter contact name"
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              type="tel"
              value={newContact.phone_number}
              onChange={handlePhoneChange}
              placeholder="+1234567890 or (123) 456-7890"
              className={phoneError ? 'border-destructive' : ''}
            />
            {phoneError && (
              <p className="text-sm text-destructive mt-1">{phoneError}</p>
            )}
          </div>
          <div>
            <Label htmlFor="relationship">Relationship</Label>
            <Input
              id="relationship"
              value={newContact.relationship}
              onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
              placeholder="e.g., Spouse, Parent, Friend"
            />
          </div>
          <div className="flex items-end">
            <Button 
              onClick={addContact} 
              disabled={isLoading}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </div>

        {/* Contacts list */}
        <div className="space-y-3">
          {contacts.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No emergency contacts added yet
            </p>
          ) : (
            contacts.map((contact) => (
              <div key={contact.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">
                      {contact.name}
                      {contact.is_primary && (
                        <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {contact.phone_number}
                      {contact.relationship && ` • ${contact.relationship}`}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteContact(contact.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};