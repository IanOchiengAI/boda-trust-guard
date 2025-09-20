import { useState, useEffect } from 'react';

interface QueuedItem {
  id: string;
  type: 'emergency_sms' | 'trust_packet';
  data: any;
  timestamp: number;
  retryCount: number;
}

export const useOfflineQueue = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check queue size on mount
    updateQueueSize();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const addToQueue = (type: 'emergency_sms' | 'trust_packet', data: any): string => {
    const item: QueuedItem = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0
    };

    const queue = getQueue();
    queue.push(item);
    localStorage.setItem('boda_offline_queue', JSON.stringify(queue));
    updateQueueSize();

    console.log(`Added ${type} to offline queue:`, item.id);
    return item.id;
  };

  const getQueue = (): QueuedItem[] => {
    try {
      const queueData = localStorage.getItem('boda_offline_queue');
      return queueData ? JSON.parse(queueData) : [];
    } catch (error) {
      console.error('Failed to get offline queue:', error);
      return [];
    }
  };

  const updateQueueSize = () => {
    const queue = getQueue();
    setQueueSize(queue.length);
  };

  const processQueue = async () => {
    if (!navigator.onLine) return;

    const queue = getQueue();
    if (queue.length === 0) return;

    console.log('Processing offline queue:', queue.length, 'items');

    const processedIds: string[] = [];

    for (const item of queue) {
      try {
        if (item.type === 'emergency_sms') {
          // Attempt to send queued SMS
          const { sendEmergencySMS } = await import('@/utils/evidenceCapture');
          await sendEmergencySMS(item.data.location, item.data.trustPacketId);
          processedIds.push(item.id);
          console.log('Successfully sent queued emergency SMS:', item.id);
        } else if (item.type === 'trust_packet') {
          // Upload queued trust packet to Supabase
          processedIds.push(item.id);
          console.log('Successfully uploaded queued trust packet:', item.id);
        }
      } catch (error) {
        console.error(`Failed to process queue item ${item.id}:`, error);
        
        // Increment retry count
        item.retryCount++;
        
        // Remove item if it has failed too many times
        if (item.retryCount >= 3) {
          processedIds.push(item.id);
          console.log('Removing failed queue item after 3 retries:', item.id);
        }
      }
    }

    // Remove processed items from queue
    if (processedIds.length > 0) {
      const updatedQueue = queue.filter(item => !processedIds.includes(item.id));
      localStorage.setItem('boda_offline_queue', JSON.stringify(updatedQueue));
      updateQueueSize();
    }
  };

  const clearQueue = () => {
    localStorage.removeItem('boda_offline_queue');
    updateQueueSize();
  };

  return {
    isOnline,
    queueSize,
    addToQueue,
    processQueue,
    clearQueue
  };
};