import { supabase } from '@/integrations/supabase/client';

export interface TrustPacket {
  eventId: string;
  timestamp: string;
  location: {
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
  };
  evidence: {
    photo: string; // Base64 encoded image
    audioSignature: string; // Audio fingerprint
  };
  metadata: {
    userAgent: string;
    deviceInfo: string;
    captureDelay: number; // The "Golden Second" delay
  };
  hash?: string; // SHA-256 hash of the packet (excluding this field)
}

export const playAlertSound = async (): Promise<void> => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create a distinctive alert tone
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(400, audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
    
    return new Promise(resolve => {
      setTimeout(resolve, 600);
    });
  } catch (error) {
    console.error('Failed to play alert sound:', error);
  }
};

export const capturePhoto = async (): Promise<string> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: 'environment', // Prefer back camera
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    const video = document.createElement('video');
    video.srcObject = stream;
    video.play();

    return new Promise((resolve, reject) => {
      video.onloadedmetadata = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        ctx.drawImage(video, 0, 0);
        
        // Stop the camera stream
        stream.getTracks().forEach(track => track.stop());
        
        const dataURL = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataURL);
      };

      video.onerror = () => {
        stream.getTracks().forEach(track => track.stop());
        reject(new Error('Failed to capture photo'));
      };
    });
  } catch (error) {
    console.error('Camera access failed:', error);
    throw new Error('Camera access denied or not available');
  }
};

export const getCurrentLocation = (): Promise<{latitude: number | null, longitude: number | null, accuracy: number | null}> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ latitude: null, longitude: null, accuracy: null });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        console.error('Geolocation failed:', error);
        resolve({ latitude: null, longitude: null, accuracy: null });
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  });
};

export const generateAudioSignature = async (): Promise<string> => {
  try {
    // Create a simple audio fingerprint based on ambient noise
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    return new Promise((resolve) => {
      setTimeout(() => {
        analyser.getByteFrequencyData(dataArray);
        stream.getTracks().forEach(track => track.stop());
        
        // Create a simple hash from the frequency data
        const signature = Array.from(dataArray).slice(0, 32).join(',');
        resolve(signature);
      }, 100);
    });
  } catch (error) {
    console.error('Audio signature failed:', error);
    return 'audio_unavailable';
  }
};

export const generateEventId = (): string => {
  return `bodabox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const generateHash = async (data: string): Promise<string> => {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (error) {
    console.error('Hash generation failed:', error);
    return 'hash_unavailable';
  }
};

export const captureEvidence = async (): Promise<TrustPacket> => {
  const startTime = Date.now();
  
  // Step 1: Play alert sound
  await playAlertSound();
  
  // Step 2: The "Golden Second" - give user time to aim camera
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Step 3: Capture all evidence concurrently
  const [photo, location, audioSignature] = await Promise.all([
    capturePhoto(),
    getCurrentLocation(),
    generateAudioSignature()
  ]);
  
  const captureDelay = Date.now() - startTime;
  
  // Step 4: Create trust packet
  const trustPacket: TrustPacket = {
    eventId: generateEventId(),
    timestamp: new Date().toISOString(),
    location,
    evidence: {
      photo,
      audioSignature
    },
    metadata: {
      userAgent: navigator.userAgent,
      deviceInfo: `${navigator.platform} - ${navigator.language}`,
      captureDelay
    }
  };
  
  // Step 5: Generate hash and add to packet
  const packetString = JSON.stringify(trustPacket);
  const hash = await generateHash(packetString);
  trustPacket.hash = hash;
  
  return trustPacket;
};

export const saveTrustPacket = (trustPacket: TrustPacket): void => {
  try {
    const packetString = JSON.stringify(trustPacket);
    localStorage.setItem('boda_trust_packet', packetString);
    localStorage.setItem('boda_trust_hash', trustPacket.hash || '');
    console.log('Trust packet saved to localStorage');
  } catch (error) {
    console.error('Failed to save trust packet:', error);
  }
};

export const loadTrustPacket = (): TrustPacket | null => {
  try {
    const packetString = localStorage.getItem('boda_trust_packet');
    if (!packetString) return null;
    
    return JSON.parse(packetString);
  } catch (error) {
    console.error('Failed to load trust packet:', error);
    return null;
  }
};

export const sendEmergencySMS = async (location?: { latitude: number; longitude: number }, trustPacketId?: string) => {
  try {
    // Check if online, if not, queue for later
    if (!navigator.onLine) {
      const queueData = { location, trustPacketId };
      const queueString = localStorage.getItem('boda_offline_queue') || '[]';
      const queue = JSON.parse(queueString);
      queue.push({
        id: `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'emergency_sms',
        data: queueData,
        timestamp: Date.now(),
        retryCount: 0
      });
      localStorage.setItem('boda_offline_queue', JSON.stringify(queue));
      console.log('SMS queued for offline processing');
      return { queued: true };
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const message = `Emergency detected by Boda-Box crash detection system. Immediate assistance may be required.`;

    const response = await supabase.functions.invoke('send-emergency-sms', {
      body: {
        message,
        location,
        trustPacketId
      }
    });

    if (response.error) {
      throw response.error;
    }

    return response.data;
  } catch (error) {
    console.error('Error sending emergency SMS:', error);
    throw error;
  }
};

export const exportTrustPacket = (): void => {
  try {
    const packetString = localStorage.getItem('boda_trust_packet');
    if (!packetString) {
      throw new Error('No trust packet found');
    }
    
    const packet = JSON.parse(packetString);
    const blob = new Blob([packetString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `trust_packet_${packet.eventId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('Trust packet exported successfully');
  } catch (error) {
    console.error('Failed to export trust packet:', error);
    throw error;
  }
};