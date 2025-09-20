import { useState, useEffect, useRef } from 'react';

interface SensorReading {
  timestamp: number;
  accelerationX: number;
  accelerationY: number;
  accelerationZ: number;
  rotationAlpha: number;
  rotationBeta: number;
  rotationGamma: number;
}

interface SensorFusionState {
  isCrashDetected: boolean;
  isMonitoring: boolean;
  lastReading: SensorReading | null;
}

const BUFFER_SIZE = 100; // ~2 seconds at 50Hz
const HIGH_G_THRESHOLD = 4.0; // 4G force threshold
const SUSTAINED_DURATION_MS = 100; // Minimum duration for sustained high-G
const ROTATION_THRESHOLD = 90; // 90 degrees rotation threshold

export const useSensorFusion = () => {
  const [state, setState] = useState<SensorFusionState>({
    isCrashDetected: false,
    isMonitoring: false,
    lastReading: null,
  });

  const sensorBufferRef = useRef<SensorReading[]>([]);
  const permissionGrantedRef = useRef(false);

  const calculateMagnitude = (x: number, y: number, z: number): number => {
    return Math.sqrt(x * x + y * y + z * z);
  };

  const calculateRotationChange = (readings: SensorReading[]): number => {
    if (readings.length < 2) return 0;
    
    const first = readings[0];
    const last = readings[readings.length - 1];
    
    const alphaChange = Math.abs(last.rotationAlpha - first.rotationAlpha);
    const betaChange = Math.abs(last.rotationBeta - first.rotationBeta);
    const gammaChange = Math.abs(last.rotationGamma - first.rotationGamma);
    
    return Math.max(alphaChange, betaChange, gammaChange);
  };

  const analyzeBuffer = (): boolean => {
    const buffer = sensorBufferRef.current;
    if (buffer.length < 10) return false;

    const now = Date.now();
    const recentReadings = buffer.filter(
      reading => now - reading.timestamp <= SUSTAINED_DURATION_MS
    );

    if (recentReadings.length < 5) return false;

    // Primary Trigger: Check for high G-force
    const highGReadings = recentReadings.filter(reading => {
      const magnitude = calculateMagnitude(
        reading.accelerationX,
        reading.accelerationY,
        reading.accelerationZ
      );
      return magnitude > HIGH_G_THRESHOLD;
    });

    // Secondary Validation: Sustained high-G for minimum duration
    if (highGReadings.length < 3) return false;

    // Tertiary Confirmation: Sudden rotation
    const rotationChange = calculateRotationChange(recentReadings);
    if (rotationChange < ROTATION_THRESHOLD) return false;

    console.log('CRASH DETECTED:', {
      highGReadings: highGReadings.length,
      rotationChange,
      timeWindow: recentReadings.length
    });

    return true;
  };

  const handleMotionEvent = (event: DeviceMotionEvent) => {
    if (!event.acceleration || !event.rotationRate) return;

    const reading: SensorReading = {
      timestamp: Date.now(),
      accelerationX: event.acceleration.x || 0,
      accelerationY: event.acceleration.y || 0,
      accelerationZ: event.acceleration.z || 0,
      rotationAlpha: event.rotationRate.alpha || 0,
      rotationBeta: event.rotationRate.beta || 0,
      rotationGamma: event.rotationRate.gamma || 0,
    };

    // Add to buffer and maintain size
    sensorBufferRef.current.push(reading);
    if (sensorBufferRef.current.length > BUFFER_SIZE) {
      sensorBufferRef.current.shift();
    }

    setState(prev => ({ ...prev, lastReading: reading }));

    // Analyze for crash detection
    if (analyzeBuffer()) {
      setState(prev => ({ ...prev, isCrashDetected: true }));
    }
  };

  const requestPermissions = async (): Promise<boolean> => {
    try {
      // Request permissions for iOS 13+
      if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        permissionGrantedRef.current = permission === 'granted';
      } else {
        // Assume permission is granted for other browsers
        permissionGrantedRef.current = true;
      }
      return permissionGrantedRef.current;
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  };

  const startMonitoring = async (): Promise<boolean> => {
    if (!permissionGrantedRef.current) {
      const granted = await requestPermissions();
      if (!granted) return false;
    }

    window.addEventListener('devicemotion', handleMotionEvent);
    setState(prev => ({ 
      ...prev, 
      isMonitoring: true, 
      isCrashDetected: false 
    }));
    
    return true;
  };

  const stopMonitoring = () => {
    window.removeEventListener('devicemotion', handleMotionEvent);
    setState(prev => ({ ...prev, isMonitoring: false }));
    sensorBufferRef.current = [];
  };

  const resetCrashDetection = () => {
    setState(prev => ({ ...prev, isCrashDetected: false }));
    sensorBufferRef.current = [];
  };

  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, []);

  return {
    isCrashDetected: state.isCrashDetected,
    isMonitoring: state.isMonitoring,
    lastReading: state.lastReading,
    startMonitoring,
    stopMonitoring,
    resetCrashDetection,
    requestPermissions,
  };
};