import { Stack } from 'expo-router';
import { useChatRealtime } from '../../features/chat/realtime';
import { usePushNotifications } from '../../features/notifications/usePushNotifications';
import { colors } from '../../lib/theme';

export default function AppLayout() {
  useChatRealtime();
  usePushNotifications();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="practice/[id]" options={{ animation: 'fade_from_bottom' }} />
    </Stack>
  );
}