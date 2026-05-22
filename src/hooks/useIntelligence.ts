import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '../api/client';

type IntelligenceEvent = {
  name: string;
  page: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
};

export function useTrackEvent(page: string) {
  const queueRef = useRef<IntelligenceEvent[]>([]);
  const flushTimerRef = useRef<number | null>(null);

  const flush = useCallback(async () => {
    const queued = queueRef.current.splice(0, 20);
    if (!queued.length || !apiClient.getToken()) return;

    try {
      await apiClient.trackEvents(queued);
    } catch {
      queueRef.current.unshift(...queued.slice(0, 10));
    }
  }, []);

  const trackEvent = useCallback(
    (name: string, metadata: Record<string, unknown> = {}, resourceId?: string | null) => {
      queueRef.current.push({ name, page, resourceId, metadata });

      if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = window.setTimeout(flush, 900);
    },
    [flush, page]
  );

  useEffect(() => {
    trackEvent('page_view', { path: window.location.pathname });

    return () => {
      if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
      void flush();
    };
  }, [flush, trackEvent]);

  return { trackEvent, flushEvents: flush };
}

export function useUserIntelligence() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!apiClient.getToken()) return;
    setLoading(true);
    try {
      const response = await apiClient.getIntelligence();
      setData(response.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, refresh };
}
