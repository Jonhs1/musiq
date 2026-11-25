import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon, InstrumentTile } from '../../components/Icon';
import { Button, IconButton } from '../../components/ui';
import { localDateKey, type PlanItem } from '../plan/api';
import { colors, fonts, spacing } from '../../lib/theme';

// Lista de hoje: itens do plano com a data de hoje. Editar abre um menu simples.
export function TodayList({
  items,
  onRemove,
  onReplace,
  onAdd,
}: {
  items: PlanItem[];
  onRemove: (itemId: string) => void;
  onReplace: (itemId: string) => void;
  onAdd: () => void;
}) {
  const router = useRouter();
  const today = localDateKey(new Date());
  const todays = items.filter((item) => item.day_date === today);

  function menu(item: PlanItem) {
    Alert.alert(item.title, undefined, [
      { text: 'Trocar exercício', onPress: () => onReplace(item.item_id) },
      { text: 'Remover do dia', style: 'destructive', onPress: () => onRemove(item.item_id) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  if (todays.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Nenhum treino para hoje.</Text>
        <Button title="Adicionar exercício" variant="soft" icon="add" onPress={onAdd} />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {todays.map((item) => (
        <View key={item.item_id} style={styles.row}>
          <Pressable
            style={({ pressed }) => [styles.main, pressed && { opacity: 0.7 }]}
            onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: item.exercise_id } })}
          >
            <InstrumentTile id={item.instrument_id} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, item.done && styles.titleDone]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.meta}>
                {item.minutes ?? '—'} min
                {item.recommended_bpm ? ` · ${item.recommended_bpm} BPM` : ''}
              </Text>
            </View>
            <Icon
              name={item.done ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={item.done ? colors.green : colors.borderStrong}
            />
          </Pressable>
          <IconButton name="ellipsis-horizontal" size={36} onPress={() => menu(item)} />
        </View>
      ))}
      <Button title="Adicionar exercício" variant="soft" icon="add" onPress={onAdd} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 4 },
  title: { color: colors.text, fontSize: 15, fontFamily: fonts.bodySemi },
  titleDone: { color: colors.textDim, textDecorationLine: 'line-through' },
  meta: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.body },
  empty: { gap: spacing.md, paddingVertical: spacing.sm },
  emptyText: { color: colors.textDim, fontSize: 14, fontFamily: fonts.body },
});
