import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../lib/auth';
import { loadPendingCount, syncPendingSessions, usePendingCount } from '../lib/pendingSessions';

const RETRY_INTERVAL_MS = 15000;

export function SyncManager() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    loadPendingCount();
  }, []);

  useEffect(() => {
    if (!session) return;
    const userId = session.user.id;

    const run = async () => {
      try {
        const { synced } = await syncPendingSessions(userId);
        if (synced > 0) queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      } catch (e) {
        console.warn('sync error:', e);
      }
    };

    run();
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      if (state.isConnected) run();
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    // Reenvio periódico enquanto houver sessões na fila
    const interval = setInterval(() => {
      if (usePendingCount.getState().count > 0) run();
    }, RETRY_INTERVAL_MS);

    return () => {
      unsubscribeNet();
      appState.remove();
      clearInterval(interval);
    };
  }, [session, queryClient]);

  return null;
}