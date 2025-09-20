import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Camera, Hash, Smartphone } from 'lucide-react';
import { TrustPacket } from '@/utils/evidenceCapture';

interface EvidenceCardProps {
  trustPacket: TrustPacket;
}

export const EvidenceCard = ({ trustPacket }: EvidenceCardProps) => {
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatLocation = (location: TrustPacket['location']) => {
    if (!location.latitude || !location.longitude) {
      return 'Location unavailable';
    }
    return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-primary/20">
      {/* Evidence Photo */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Camera className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Captured Evidence</h3>
        </div>
        <div className="relative rounded-lg overflow-hidden bg-muted">
          <img
            src={trustPacket.evidence.photo}
            alt="Crash evidence"
            className="w-full h-48 object-cover"
          />
          <div className="absolute bottom-2 right-2">
            <Badge variant="secondary" className="text-xs">
              {formatTimestamp(trustPacket.timestamp)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Event ID */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Hash className="w-4 h-4" />
            Event ID
          </div>
          <p className="text-xs text-muted-foreground font-mono break-all">
            {trustPacket.eventId}
          </p>
        </div>

        {/* Timestamp */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="w-4 h-4" />
            Capture Time
          </div>
          <p className="text-xs text-muted-foreground">
            {formatTimestamp(trustPacket.timestamp)}
          </p>
        </div>

        {/* Location */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="w-4 h-4" />
            Location
          </div>
          <p className="text-xs text-muted-foreground">
            {formatLocation(trustPacket.location)}
          </p>
          {trustPacket.location.accuracy && (
            <p className="text-xs text-muted-foreground">
              Accuracy: {trustPacket.location.accuracy.toFixed(1)}m
            </p>
          )}
        </div>

        {/* Device Info */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Smartphone className="w-4 h-4" />
            Device
          </div>
          <p className="text-xs text-muted-foreground">
            {trustPacket.metadata.deviceInfo}
          </p>
        </div>
      </div>

      {/* Tamper-Proof Hash */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 bg-safety rounded-full" />
          <span className="text-sm font-semibold text-safety">Tamper-Proof Hash</span>
        </div>
        <p className="text-xs font-mono bg-muted/50 p-3 rounded border break-all">
          {trustPacket.hash}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          This SHA-256 hash proves the integrity of all captured data. 
          Any modification to the evidence will change this hash value.
        </p>
      </div>

      {/* Technical Details */}
      <div className="mt-4 pt-4 border-t border-border">
        <details className="text-xs">
          <summary className="cursor-pointer font-medium mb-2">Technical Details</summary>
          <div className="space-y-1 text-muted-foreground">
            <p>Audio Signature: {trustPacket.evidence.audioSignature.substring(0, 50)}...</p>
            <p>Capture Delay: {trustPacket.metadata.captureDelay}ms</p>
            <p>User Agent: {trustPacket.metadata.userAgent.substring(0, 50)}...</p>
          </div>
        </details>
      </div>
    </Card>
  );
};