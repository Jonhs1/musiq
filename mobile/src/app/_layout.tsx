import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ChakraPetch_600SemiBold, ChakraPetch_700Bold } from '@expo-google-fonts/chakra-petch';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { SyncManager } from '../components/SyncManager';
import { useProfile } from '../features/profile/api';
import { AuthProvider, useAuth } from '../lib/auth';
import { colors } from '../lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

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
      <View style={{ flex: 1, backgroundColor: colors.backgroundDeep, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <Image
          source={require('../../assets/images/splash-icon.png')}
          style={{ width: 160, height: 220 }}
          resizeMode="contain"
        />
        <ActivityIndicator color={colors.primarySoft} />
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
  const [fontsLoaded] = useFonts({
    ChakraPetch_600SemiBold,
    ChakraPetch_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

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