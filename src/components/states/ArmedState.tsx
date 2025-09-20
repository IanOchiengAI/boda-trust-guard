import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Shield, AlertTriangle, Power } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ArmedStateProps {
  onEmergencyButton: () => void;
  startMonitoring: () => Promise<boolean>;
  stopMonitoring: () => void;
}

export const ArmedState = ({ onEmergencyButton, startMonitoring, stopMonitoring }: ArmedStateProps) => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const { toast } = useToast();

  const handleStartMonitoring = async () => {
    try {
      const success = await startMonitoring();
      if (success) {
        setIsMonitoring(true);
        setPermissionDenied(false);
        toast({
          title: "System Armed",
          description: "Crash detection is now active",
          variant: "default",
        });
      } else {
        setPermissionDenied(true);
        toast({
          title: "Permission Required",
          description: "Please grant motion sensor access to enable crash detection",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Failed to start monitoring:', error);
      setPermissionDenied(true);
    }
  };

  const handleStopMonitoring = () => {
    stopMonitoring();
    setIsMonitoring(false);
    toast({
      title: "System Disarmed",
      description: "Crash detection is now inactive",
    });
  };

  useEffect(() => {
    // Auto-start monitoring when component mounts
    handleStartMonitoring();
    
    return () => {
      stopMonitoring();
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-background to-card p-4">
      {/* Header */}
      <div className="text-center py-8">
        <div className="inline-flex items-center gap-3 mb-4">
          <Shield className="w-8 h-8 text-safety" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-safety to-primary bg-clip-text text-transparent">
            BODA-BOX
          </h1>
        </div>
        <p className="text-muted-foreground">Crash Detection & Evidence System</p>
      </div>

      {/* System Status */}
      <Card className="mx-auto max-w-md p-6 mb-8 bg-gradient-to-br from-card to-card/50 border-safety/20">
        <div className="text-center">
          <div className={`inline-flex items-center gap-2 mb-4 ${isMonitoring ? 'text-safety' : 'text-warning'}`}>
            <div className={`w-3 h-3 rounded-full ${isMonitoring ? 'bg-safety animate-pulse' : 'bg-warning'}`} />
            <span className="font-bold text-lg">
              {isMonitoring ? 'SYSTEM ARMED' : 'SYSTEM DISARMED'}
            </span>
          </div>
          
          <p className="text-sm text-muted-foreground mb-6">
            {isMonitoring 
              ? 'Monitoring for crashes using multi-sensor fusion'
              : 'Tap the power button to activate crash detection'
            }
          </p>

          {/* Control Button */}
          {!isMonitoring ? (
            <Button
              onClick={handleStartMonitoring}
              variant="safety"
              size="lg"
              className="w-full mb-4"
              disabled={permissionDenied}
            >
              <Power className="w-5 h-5 mr-2" />
              ARM SYSTEM
            </Button>
          ) : (
            <Button
              onClick={handleStopMonitoring}
              variant="cancel"
              size="lg"
              className="w-full mb-4"
            >
              <Power className="w-5 h-5 mr-2" />
              DISARM SYSTEM
            </Button>
          )}

          {permissionDenied && (
            <div className="text-warning text-sm p-3 bg-warning/10 rounded-lg border border-warning/20">
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              Sensor permissions required for crash detection
            </div>
          )}
        </div>
      </Card>

      {/* Emergency Button */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-6 text-sm">
            Emergency Override
          </p>
          <Button
            onClick={onEmergencyButton}
            variant="emergency"
            size="lg"
            className="w-48 h-48 rounded-full text-xl shadow-[var(--shadow-emergency)]"
          >
            <div className="flex flex-col items-center gap-2">
              <AlertTriangle className="w-12 h-12" />
              <span>EMERGENCY</span>
            </div>
          </Button>
          <p className="text-xs text-muted-foreground mt-4 max-w-xs">
            Press and hold for manual crash reporting
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 text-xs text-muted-foreground">
        <p>Boda-Box v2.1 • Offline-First Evidence Capture</p>
      </div>
    </div>
  );
};