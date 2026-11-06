import { Stack } from 'expo-router';
import { colors } from '../../lib/theme';
import { useChatRealtime } from '../../features/chat/realtime';


export default function AppLayout() {
  useChatRealtime();
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
