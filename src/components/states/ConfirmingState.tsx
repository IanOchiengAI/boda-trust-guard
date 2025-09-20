import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmingStateProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmingState = ({ onConfirm, onCancel }: ConfirmingStateProps) => {
  const [countdown, setCountdown] = useState(5);
  const [isPlaying, setIsPlaying] = useState(false);

  // Play loud alert sound
  useEffect(() => {
    const playAlertSound = async () => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Create an oscillating alarm sound
        const createBeep = (frequency: number, duration: number, delay: number) => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + delay);
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + delay);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + delay + duration);
          
          oscillator.start(audioContext.currentTime + delay);
          oscillator.stop(audioContext.currentTime + delay + duration);
        };
        
        // Create repeating alarm pattern
        for (let i = 0; i < 10; i++) {
          createBeep(800, 0.2, i * 0.5);
          createBeep(400, 0.2, i * 0.5 + 0.25);
        }
        
        setIsPlaying(true);
      } catch (error) {
        console.error('Failed to play alert sound:', error);
      }
    };

    playAlertSound();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Auto-confirm after countdown
      onConfirm();
    }
  }, [countdown, onConfirm]);

  return (
    <div className="fixed inset-0 bg-emergency/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-card border-emergency shadow-[var(--shadow-emergency)] animate-pulse">
        <div className="p-8 text-center">
          {/* Alert Icon */}
          <div className="mb-6">
            <AlertTriangle className="w-24 h-24 text-emergency mx-auto animate-bounce" />
          </div>

          {/* Alert Message */}
          <h1 className="text-3xl font-bold text-emergency mb-2">
            CRASH DETECTED?
          </h1>
          
          <p className="text-muted-foreground mb-6">
            Evidence capture will begin automatically
          </p>

          {/* Countdown */}
          <div className="text-6xl font-bold text-emergency mb-8 font-mono">
            {countdown}
          </div>

          {/* Cancel Button */}
          <Button
            onClick={onCancel}
            variant="cancel"
            size="lg"
            className="w-full"
          >
            <X className="w-5 h-5 mr-2" />
            CANCEL - False Alarm
          </Button>

          <p className="text-xs text-muted-foreground mt-4">
            This alert will proceed automatically in {countdown} seconds
          </p>
        </div>
      </Card>
    </div>
  );
};