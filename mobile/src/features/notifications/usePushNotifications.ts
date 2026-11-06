import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { getActiveChat } from './activeChat';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as { type?: string; friendId?: string } | undefined;
    const inThatChat = data?.type === 'message' && data.friendId === getActiveChat();
    return {
      shouldShowBanner: !inThatChat,
      shouldShowList: !inThatChat,
      shouldPlaySound: !inThatChat,
      shouldSetBadge: false,
    };
  },
});

async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) return null; // emulador não recebe push

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'SnakeTune',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8B5CF6',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}

/** Registra o aparelho para push e leva o usuário ao lugar certo quando toca na notificação. */
export function usePushNotifications() {
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    registerForPush()
      .then((token) => {
        if (cancelled || !token) return;
        return supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
      })
      .catch((e) => console.warn('push register error:', e));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    function open(response: Notifications.NotificationResponse | null) {
      const data = response?.notification.request.content.data as { type?: string; friendId?: string } | undefined;
      if (!data?.type) return;
      if (data.type === 'message' && data.friendId) {
        router.push({ pathname: '/chat/[id]', params: { id: data.friendId } });
      } else {
        router.push('/friends');
      }
    }
    // app fechado e aberto pela notificação
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [router]);
}

/** Chamar antes do signOut para este aparelho parar de receber as notificações da conta. */
export async function unregisterPush() {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId || !Device.isDevice) return;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.rpc('unregister_push_token', { p_token: data });
  } catch {
    // sem rede ou sem permissão: ignora
  }
}