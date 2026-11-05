import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../lib/theme';

export function BackButton({ label = 'Voltar' }: { label?: string }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.back()} hitSlop={12} style={styles.button}>
      <Text style={styles.text}>‹ {label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignSelf: 'flex-start' },
  text: { color: colors.primary, fontSize: 16 },
});