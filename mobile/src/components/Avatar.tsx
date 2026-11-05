import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../lib/theme';

export function Avatar({
  uri,
  name,
  size = 40,
  ring,
}: {
  uri?: string | null;
  name?: string | null;
  size?: number;
  ring?: boolean;
}) {
  const dimension = { width: size, height: size, borderRadius: size / 2 };
  const ringStyle = ring ? { borderWidth: 2, borderColor: colors.primary } : null;
  if (uri) return <Image source={{ uri }} style={[dimension, ringStyle]} />;
  return (
    <View style={[dimension, styles.fallback, ringStyle]}>
      <Text style={[styles.letter, { fontSize: size * 0.42 }]}>
        {(name ?? '?').charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { color: colors.text, fontFamily: fonts.titleBold },
});
