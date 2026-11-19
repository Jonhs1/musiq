import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, onlineManager, QueryClient, useQueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ChakraPetch_600SemiBold, ChakraPetch_700Bold } from '@expo-google-fonts/chakra-petch';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, Image, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SyncManager } from '../components/SyncManager';
import { useProfile } from '../features/profile/api';
import { AuthProvider, useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const WEEK_MS = 1000 * 60 * 60 * 24 * 7;

// Informa ao React Query quando o aparelho está online
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
);

// Informa ao React Query quando o app está em primeiro plano. Sem isto ele usa a
// regra do navegador (que no celular nunca muda): as consultas que se atualizam
// sozinhas — conversas, desafios e pedidos de amizade — continuariam indo à rede
// a cada 30 segundos com o app fechado no bolso, gastando bateria e dados.
focusManager.setEventListener((setFocused) => {
  const subscription = AppState.addEventListener('change', (state) => setFocused(state === 'active'));
  return () => subscription.remove();
});

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

/**
 * O cache do React Query fica guardado no aparelho por uma semana. Se alguém sai
 * da conta e outra pessoa entra no mesmo celular, as respostas da conta anterior
 * (mensagens, exercícios, favoritos) ainda estariam no disco. Ao sair, limpa tudo.
 */
function SessionCleanup() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT') return;
      queryClient.clear();
      Promise.resolve(persister.removeClient()).catch(() => {});
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);
  return null;
}

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
    <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: WEEK_MS, buster: 'v1' }}
      >
        <AuthProvider>
          <StatusBar style="light" />
          <SessionCleanup />
          <SyncManager />
          <RootNavigator />
        </AuthProvider>
      </PersistQueryClientProvider>
    </KeyboardProvider>
  );
}