import { useRouter } from 'expo-router';
import { IconButton } from './ui';
import { View } from 'react-native';

export function BackButton() {
  const router = useRouter();
  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <IconButton name="chevron-back" onPress={() => router.back()} />
    </View>
  );
}
