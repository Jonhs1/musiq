import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, InstrumentIcon } from '../../../components/Icon';
import { Chip, Reveal, Subtitle, Title } from '../../../components/ui';
import { Order, Scope, useCommunityExercises } from '../../../features/community/api';
import { ExerciseCard } from '../../../features/community/ExerciseCard';
import { useInstruments } from '../../../features/profile/api';
import { colors, fonts, radius, spacing } from '../../../lib/theme';

const SCOPES: { id: Scope; label: string }[] = [
  { id: 'explore', label: 'Explorar' },
  { id: 'favorites', label: 'Favoritos' },
  { id: 'mine', label: 'Meus' },
];

const EMPTY: Record<Scope, string> = {
  explore: 'Ainda não há exercícios da comunidade por aqui. Que tal criar o primeiro?',
  favorites: 'Você ainda não favoritou nenhum exercício. Abra um exercício e toque na estrela para guardar aqui.',
  mine: 'Você ainda não criou nenhum exercício.',
};

export default function Community() {
  const router = useRouter();
  const { data: instruments } = useInstruments();
  const [instrument, setInstrument] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>('explore');
  const [order, setOrder] = useState<Order>('recent');
  const { data, isLoading, isError, refetch, isRefetching } = useCommunityExercises({ instrument, scope, order });

  const nameOf = (id: string) => instruments?.find((item) => item.id === id)?.name;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Reveal index={0}>
          <Title>Comunidade</Title>
          <Subtitle>Exercícios criados por quem pratica com você.</Subtitle>
        </Reveal>

        <View style={styles.segment}>
          {SCOPES.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setScope(item.id)}
              style={[styles.segmentItem, scope === item.id && styles.segmentItemActive]}
            >
              <Text style={[styles.segmentText, scope === item.id && styles.segmentTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={{ marginHorizontal: -spacing.lg, flexGrow: 0 }}
        >
          <View style={{ width: spacing.lg - spacing.sm }} />
          <Chip
            label="Todos"
            active={instrument === null}
            onPress={() => setInstrument(null)}
            icon={<Icon name="apps" size={15} color={instrument === null ? colors.primarySoft : colors.textMuted} />}
          />
          {instruments?.map((item) => (
            <Chip
              key={item.id}
              label={item.name}
              active={instrument === item.id}
              onPress={() => setInstrument(item.id)}
              icon={
                <InstrumentIcon
                  id={item.id}
                  size={16}
                  color={instrument === item.id ? colors.primarySoft : colors.textMuted}
                />
              }
            />
          ))}
          <View style={{ width: spacing.lg - spacing.sm }} />
        </ScrollView>

        <View style={styles.orderRow}>
          <Text style={styles.orderLabel}>Ordenar por</Text>
          <Chip label="Recentes" active={order === 'recent'} onPress={() => setOrder('recent')} />
          <Chip label="Mais curtidos" active={order === 'likes'} onPress={() => setOrder('likes')} />
        </View>

        {isLoading ? <ActivityIndicator color={colors.primarySoft} style={{ marginTop: spacing.lg }} /> : null}

        {isError ? (
          <View style={styles.message}>
            <Text style={styles.messageText}>Não foi possível carregar a comunidade.</Text>
            <Chip label={isRefetching ? 'Tentando…' : 'Tentar de novo'} onPress={() => refetch()} />
          </View>
        ) : null}

        {!isLoading && !isError && (data?.length ?? 0) === 0 ? (
          <View style={styles.message}>
            <Text style={styles.messageText}>{EMPTY[scope]}</Text>
          </View>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          {data?.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              instrumentName={nameOf(exercise.instrument_id)}
              onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: exercise.id } })}
            />
          ))}
        </View>
      </ScrollView>

      <Pressable
        onPress={() => router.push('/exercise-form')}
        style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.96 }] }]}
      >
        <Icon name="add" size={22} color={colors.onPrimary} />
        <Text style={styles.fabText}>Criar exercício</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 110, gap: spacing.md },
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.pill },
  segmentItemActive: { backgroundColor: colors.primaryTint },
  segmentText: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.bodyMedium },
  segmentTextActive: { color: colors.primarySoft, fontFamily: fonts.bodySemi },
  chips: { gap: spacing.sm, paddingVertical: 2 },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  orderLabel: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.body },
  message: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  messageText: { color: colors.textMuted, fontSize: 14, lineHeight: 20, fontFamily: fonts.body, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    shadowColor: '#7A3BEF',
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabText: { color: colors.onPrimary, fontSize: 15, fontFamily: fonts.bodySemi },
});