import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../../components/ui';
import { Challenge, useChallenges } from '../../../features/challenges/api';
import { colors, radius, spacing } from '../../../lib/theme';

export default function Challenges() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useChallenges();

  // Ao abrir a aba, busca (e sorteia, se for um novo dia/semana) e atualiza o XP
  useFocusEffect(
    useCallback(() => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    }, [refetch, queryClient]),
  );

  const daily = data?.find((item) => item.period === 'daily');
  const weekly = data?.find((item) => item.period === 'weekly');

  return (
    <Screen>
      <Text style={styles.title}>Desafios</Text>
      <Text style={styles.subtitle}>Pratique com constância e ganhe XP extra.</Text>

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {isError ? <Text style={styles.error}>Não foi possível carregar os desafios.</Text> : null}

      {daily ? <ChallengeCard challenge={daily} label="Diário" hint="Termina hoje" /> : null}
      {weekly ? <ChallengeCard challenge={weekly} label="Semanal" hint="Termina no domingo" /> : null}
    </Screen>
  );
}

function ChallengeCard({ challenge, label, hint }: { challenge: Challenge; label: string; hint: string }) {
  const done = challenge.completed_at !== null;
  const percent = Math.min(100, Math.round((challenge.progress / challenge.target) * 100));

  return (
    <View style={[styles.card, done && styles.cardDone]}>
      <View style={styles.cardHeader}>
        <Text style={styles.badge}>{label}</Text>
        <Text style={styles.hint}>{done ? 'Concluído ✓' : hint}</Text>
      </View>

      <Text style={styles.cardTitle}>{challenge.title}</Text>
      <Text style={styles.cardDescription}>{challenge.description}</Text>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }, done && styles.fillDone]} />
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.progress}>
          {challenge.progress}/{challenge.target}
        </Text>
        <Text style={[styles.reward, done && { color: colors.textMuted }]}>
          {done ? `+${challenge.xp_reward} XP recebidos` : `+${challenge.xp_reward} XP`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 28, fontWeight: '700', marginTop: spacing.md },
  subtitle: { color: colors.textMuted, fontSize: 14 },
  error: { color: colors.danger },
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardDone: { borderColor: colors.primary },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { color: colors.primary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  hint: { color: colors.textMuted, fontSize: 12 },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  cardDescription: { color: colors.textMuted, fontSize: 14 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  fillDone: { backgroundColor: colors.primary },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  progress: { color: colors.text, fontSize: 14, fontWeight: '700' },
  reward: { color: colors.primary, fontSize: 14, fontWeight: '700' },
});