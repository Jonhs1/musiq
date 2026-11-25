import { Pressable, StyleSheet, Text, View } from 'react-native';
import { InstrumentTile } from '../../components/Icon';
import { Card } from '../../components/ui';
import { colors, fonts, spacing } from '../../lib/theme';
import type { MaterialRow } from './api';

export function MaterialCard({ material, onPress }: { material: MaterialRow; onPress: () => void }) {
  const count = material.exercises?.[0]?.count ?? 0;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>
      <Card>
        <View style={styles.row}>
          <InstrumentTile id={material.instrument_id} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {material.title}
            </Text>
            <Text style={styles.meta}>
              {count} {count === 1 ? 'exercício' : 'exercícios'}
              {material.level ? ` · ${material.level}` : ''}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { color: colors.text, fontSize: 16, fontFamily: fonts.title },
  meta: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.body },
});
