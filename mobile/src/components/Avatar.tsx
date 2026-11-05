import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../lib/theme';

export function Avatar({
  uri,
  name,
  size = 40,
}: {
  uri?: string | null;
  name?: string | null;
  size?: number;
}) {
  const dimension = { width: size, height: size, borderRadius: size / 2 };
  if (uri) return <Image source={{ uri }} style={dimension} />;
  return (
    <View style={[dimension, styles.fallback]}>
      <Text style={[styles.letter, { fontSize: size * 0.42 }]}>
        {(name ?? '?').charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { color: colors.primary, fontWeight: '700' },
});