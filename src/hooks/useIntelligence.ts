import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '../api/client';

type IntelligenceEvent = {
  name: string;
  page: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
};

type IntelligenceState = {
  data: any;
  loading: boolean;
  updatedAt: number;
};

const INTELLIGENCE_TTL_MS = 30_000;
const listeners = new Set<(state: IntelligenceState) => void>();
let sharedState: IntelligenceState = { data: null, loading: false, updatedAt: 0 };
let sharedRequest: Promise<void> | null = null;

const publishIntelligence = (patch: Partial<IntelligenceState>) => {
  sharedState = { ...sharedState, ...patch };
  listeners.forEach((listener) => listener(sharedState));
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
  const [state, setState] = useState<IntelligenceState>(sharedState);

  const refresh = useCallback(async (options: { force?: boolean } = {}) => {
    if (!apiClient.getToken()) return;
    const freshEnough = Date.now() - sharedState.updatedAt < INTELLIGENCE_TTL_MS;
    if (!options.force && sharedState.data && freshEnough) return;
    if (sharedRequest) return sharedRequest;

    publishIntelligence({ loading: true });
    sharedRequest = apiClient
      .getIntelligence()
      .then((response) => {
        publishIntelligence({ data: response.data, updatedAt: Date.now(), loading: false });
      })
      .catch(() => {
        publishIntelligence({ data: null, loading: false });
      })
      .finally(() => {
        sharedRequest = null;
      });

    return sharedRequest;
  }, []);

  useEffect(() => {
    listeners.add(setState);
    void refresh();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      listeners.delete(setState);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refresh]);

  return { data: state.data, loading: state.loading, refresh };
}
