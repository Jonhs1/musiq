import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { colors, fonts } from '../../../lib/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// Ícone com "pílula" roxa atrás quando a aba está ativa
function tabIcon(active: IconName, inactive: IconName) {
  return ({ focused }: { focused: boolean }) => (
    <View
      style={{
        width: 52,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? colors.primaryTint : 'transparent',
      }}
    >
      <Ionicons
        name={focused ? active : inactive}
        size={22}
        color={focused ? colors.primarySoft : colors.textDim}
      />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primarySoft,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: {
          backgroundColor: colors.backgroundDeep,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 10, fontFamily: fonts.bodyMedium },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Início', tabBarIcon: tabIcon('home', 'home-outline') }} />
      <Tabs.Screen name="plan" options={{ title: 'Plano', tabBarIcon: tabIcon('calendar', 'calendar-outline') }} />
      <Tabs.Screen name="challenges" options={{ title: 'Desafios', tabBarIcon: tabIcon('flag', 'flag-outline') }} />
      <Tabs.Screen name="community" options={{ title: 'Comunidade', tabBarIcon: tabIcon('people', 'people-outline') }} />
      <Tabs.Screen name="ranking" options={{ title: 'Ranking', tabBarIcon: tabIcon('trophy', 'trophy-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: tabIcon('person', 'person-outline') }} />
    </Tabs>
  );
}