/**
 * Manages the SNV2 connection (manager sign-in) and the live day-off request
 * list for the Schedule tab. All SNV2 access goes through the snv2 service.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { friendlySnv2Error, isSnv2Configured, snv2Requests, type DayOffRequest, type Snv2Manager } from '@/services/snv2/requestsService';

export interface Snv2RequestsState {
  configured: boolean;
  manager: Snv2Manager | null;
  /** Still determining whether a session already exists. */
  initializing: boolean;
  connecting: boolean;
  connectError: string | null;
  requests: DayOffRequest[];
  loadingRequests: boolean;
  requestsError: string | null;
  connect: (email: string, password: string) => Promise<void>;
  disconnect: () => Promise<void>;
  setDone: (requestId: string, done: boolean) => Promise<void>;
}

export function useSnv2Requests(formId: string | null): Snv2RequestsState {
  const configured = isSnv2Configured();
  const [manager, setManager] = useState<Snv2Manager | null>(null);
  const [initializing, setInitializing] = useState(configured);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [requests, setRequests] = useState<DayOffRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const settled = useRef(false);

  useEffect(() => {
    if (!configured) return;
    return snv2Requests.watchSession((next) => {
      settled.current = true;
      setInitializing(false);
      setManager(next);
    });
  }, [configured]);

  useEffect(() => {
    if (!manager || !formId) {
      setRequests([]);
      return;
    }
    setLoadingRequests(true);
    setRequestsError(null);
    const unsub = snv2Requests.watchRequests(
      formId,
      (next) => {
        setRequests(next);
        setLoadingRequests(false);
      },
      (error) => {
        setRequestsError(friendlySnv2Error(error));
        setLoadingRequests(false);
      },
    );
    return unsub;
  }, [manager, formId]);

  const connect = useCallback(async (email: string, password: string) => {
    setConnecting(true);
    setConnectError(null);
    try {
      await snv2Requests.signIn(email, password);
    } catch (error) {
      setConnectError(friendlySnv2Error(error));
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await snv2Requests.signOut();
  }, []);

  const setDone = useCallback(
    async (requestId: string, done: boolean) => {
      if (formId) await snv2Requests.setDone(formId, requestId, done);
    },
    [formId],
  );

  return {
    configured,
    manager,
    initializing,
    connecting,
    connectError,
    requests,
    loadingRequests,
    requestsError,
    connect,
    disconnect,
    setDone,
  };
}
