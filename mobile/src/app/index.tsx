import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../lib/theme';

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>MUSIQ</Text>
      <Text style={styles.tagline}>Pratique. Evolua. Domine.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  logo: { color: colors.primary, fontSize: 48, fontWeight: '800', letterSpacing: 4 },
  tagline: { color: colors.textMuted, fontSize: 16 },
});