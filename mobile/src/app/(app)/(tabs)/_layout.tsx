import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '../../../lib/theme';

function icon(emoji: string) {
  return ({ focused }: { focused: boolean }) => (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 10 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Início', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="plan" options={{ title: 'Plano', tabBarIcon: icon('📅') }} />
      <Tabs.Screen name="challenges" options={{ title: 'Desafios', tabBarIcon: icon('🎯') }} />
      <Tabs.Screen name="achievements" options={{ title: 'Conquistas', tabBarIcon: icon('🏅') }} />
      <Tabs.Screen name="ranking" options={{ title: 'Ranking', tabBarIcon: icon('🏆') }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: icon('👤') }} />
    </Tabs>
  );
}