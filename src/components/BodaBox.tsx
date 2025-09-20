import { useState, useEffect } from 'react';
import { useSensorFusion } from '@/hooks/useSensorFusion';
import { ArmedState } from './states/ArmedState';
import { ConfirmingState } from './states/ConfirmingState';
import { TriggeredState } from './states/TriggeredState';

export type AppState = 'ARMED' | 'CONFIRMING' | 'TRIGGERED';

export const BodaBox = () => {
  const [appState, setAppState] = useState<AppState>('ARMED');
  const { isCrashDetected, startMonitoring, stopMonitoring, resetCrashDetection } = useSensorFusion();

  // Handle automatic crash detection
  useEffect(() => {
    if (isCrashDetected && appState === 'ARMED') {
      setAppState('CONFIRMING');
    }
  }, [isCrashDetected, appState]);

  const handleEmergencyButton = () => {
    if (appState === 'ARMED') {
      setAppState('CONFIRMING');
    }
  };

  const handleConfirmCrash = () => {
    setAppState('TRIGGERED');
  };

  const handleCancelAlert = () => {
    resetCrashDetection();
    setAppState('ARMED');
  };

  const handleReset = () => {
    resetCrashDetection();
    setAppState('ARMED');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {appState === 'ARMED' && (
        <ArmedState
          onEmergencyButton={handleEmergencyButton}
          startMonitoring={startMonitoring}
          stopMonitoring={stopMonitoring}
        />
      )}
      
      {appState === 'CONFIRMING' && (
        <ConfirmingState
          onConfirm={handleConfirmCrash}
          onCancel={handleCancelAlert}
        />
      )}
      
      {appState === 'TRIGGERED' && (
        <TriggeredState
          onReset={handleReset}
        />
      )}
    </div>
  );
};