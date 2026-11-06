import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../lib/theme';

/** Telinha com a frequência detectada (e o alvo, quando houver) */
export function FrequencyReadout({ frequency, target }: { frequency: number | null; target: number | null }) {
  return (
    <View style={styles.box}>
      <Text style={styles.value}>{frequency !== null ? `${frequency.toFixed(1)} Hz` : '— Hz'}</Text>
      {target !== null ? <Text style={styles.target}>alvo {target.toFixed(1)} Hz</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignSelf: 'center',
    minWidth: 150,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  value: { color: colors.text, fontSize: 20, fontFamily: fonts.titleBold },
  target: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.body },
});