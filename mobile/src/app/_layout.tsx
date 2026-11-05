import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SyncManager } from '../components/SyncManager';
import { useProfile } from '../features/profile/api';
import { AuthProvider, useAuth } from '../lib/auth';
import { colors } from '../lib/theme';

const WEEK_MS = 1000 * 60 * 60 * 24 * 7;

// Informa ao React Query quando o aparelho está online
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: WEEK_MS,
      staleTime: 1000 * 60 * 5,
      networkMode: 'offlineFirst',
      retry: 1,
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'musiq-query-cache',
});

function RootNavigator() {
  const { session, loading } = useAuth();
  const { data: profile, isLoading } = useProfile();

  if (loading || (session && isLoading)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const signedIn = !!session;
  // Perfil só é considerado completo quando o apelido existe
  const needsProfile = signedIn && !!profile && !profile.nickname;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={needsProfile}>
        <Stack.Screen name="profile-setup" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !needsProfile}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: WEEK_MS, buster: 'v1' }}
    >
      <AuthProvider>
        <StatusBar style="light" />
        <SyncManager />
        <RootNavigator />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}