import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, Download, Copy, RotateCcw, CheckCircle2, Loader2 } from 'lucide-react';
import { captureEvidence, saveTrustPacket, exportTrustPacket, TrustPacket } from '@/utils/evidenceCapture';
import { useToast } from '@/hooks/use-toast';
import { EvidenceCard } from '@/components/EvidenceCard';

interface TriggeredStateProps {
  onReset: () => void;
}

export const TriggeredState = ({ onReset }: TriggeredStateProps) => {
  const [isCapturing, setIsCapturing] = useState(true);
  const [trustPacket, setTrustPacket] = useState<TrustPacket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const performCapture = async () => {
      try {
        setIsCapturing(true);
        const packet = await captureEvidence();
        saveTrustPacket(packet);
        setTrustPacket(packet);
        setError(null);
        
        toast({
          title: "Evidence Captured",
          description: "Trust packet created and secured",
          variant: "default",
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        console.error('Evidence capture failed:', err);
        
        toast({
          title: "Capture Failed",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setIsCapturing(false);
      }
    };

    performCapture();
  }, [toast]);

  const handleCopyVerification = async () => {
    if (!trustPacket) return;

    try {
      // Create a copy of the packet without the hash for verification
      const { hash, ...packetWithoutHash } = trustPacket;
      const verificationString = JSON.stringify(packetWithoutHash, null, 2);
      
      await navigator.clipboard.writeText(verificationString);
      toast({
        title: "Copied to Clipboard",
        description: "Verification data copied for tamper-proof check",
      });
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleExportPacket = () => {
    try {
      exportTrustPacket();
      toast({
        title: "Export Successful",
        description: "Trust packet downloaded to device",
      });
    } catch (err) {
      toast({
        title: "Export Failed",
        description: "Could not export trust packet",
        variant: "destructive",
      });
    }
  };

  if (isCapturing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-card flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center bg-gradient-to-br from-card to-card/50">
          <Loader2 className="w-16 h-16 text-primary mx-auto mb-6 animate-spin" />
          <h2 className="text-2xl font-bold mb-4">Capturing Evidence...</h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>📢 Playing audio alert</p>
            <p>⏱️ Golden second delay</p>
            <p>📸 Accessing camera</p>
            <p>📍 Getting location</p>
            <p>🔒 Generating tamper-proof hash</p>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-card flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center border-destructive/20">
          <div className="text-destructive text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-destructive mb-4">Capture Failed</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={onReset} variant="cancel" className="w-full">
            <RotateCcw className="w-4 h-4 mr-2" />
            Return to Armed State
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-card p-4">
      {/* Header */}
      <div className="text-center py-6">
        <div className="inline-flex items-center gap-2 mb-2">
          <CheckCircle2 className="w-8 h-8 text-safety" />
          <h1 className="text-2xl font-bold text-safety">Evidence Captured</h1>
        </div>
        <p className="text-muted-foreground">Tamper-proof trust packet created</p>
      </div>

      {/* Evidence Display */}
      {trustPacket && (
        <div className="max-w-2xl mx-auto mb-8">
          <EvidenceCard trustPacket={trustPacket} />
        </div>
      )}

      {/* Action Buttons */}
      <div className="max-w-md mx-auto space-y-4 mb-8">
        <Button
          onClick={handleExportPacket}
          variant="default"
          size="lg"
          className="w-full"
        >
          <Download className="w-5 h-5 mr-2" />
          Export Trust Packet
        </Button>

        <Button
          onClick={handleCopyVerification}
          variant="secondary"
          size="lg"
          className="w-full"
        >
          <Copy className="w-5 h-5 mr-2" />
          Copy for Verification
        </Button>

        <Button
          onClick={onReset}
          variant="cancel"
          className="w-full"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Return to Armed State
        </Button>
      </div>

      {/* Footer Info */}
      <div className="text-center text-xs text-muted-foreground max-w-md mx-auto">
        <p className="mb-2">
          The exported trust packet contains cryptographic proof of authenticity.
          Use the verification tool to confirm tamper-proof integrity.
        </p>
        <p>Hash: {trustPacket?.hash?.substring(0, 16)}...</p>
      </div>
    </div>
  );
};