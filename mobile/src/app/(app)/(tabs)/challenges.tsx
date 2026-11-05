import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Icon, IconName } from '../../../components/Icon';
import { TileBox } from '../../../components/Icon';
import { Card, ErrorText, ProgressBar, Reveal, Screen, Subtitle, Title } from '../../../components/ui';
import { Challenge, useChallenges } from '../../../features/challenges/api';
import { colors, fonts, spacing } from '../../../lib/theme';

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
      <Reveal index={0}>
        <Title>Desafios</Title>
        <Subtitle>Pratique com constância e ganhe XP extra.</Subtitle>
      </Reveal>

      {isLoading ? <ActivityIndicator color={colors.primarySoft} /> : null}
      {isError ? <ErrorText>Não foi possível carregar os desafios.</ErrorText> : null}

      {daily ? (
        <Reveal index={1}>
          <ChallengeCard challenge={daily} label="Diário" hint="Termina hoje" icon="sunny" />
        </Reveal>
      ) : null}
      {weekly ? (
        <Reveal index={2}>
          <ChallengeCard challenge={weekly} label="Semanal" hint="Termina no domingo" icon="calendar" />
        </Reveal>
      ) : null}
    </Screen>
  );
}

function ChallengeCard({
  challenge,
  label,
  hint,
  icon,
}: {
  challenge: Challenge;
  label: string;
  hint: string;
  icon: IconName;
}) {
  const done = challenge.completed_at !== null;
  const ratio = Math.min(1, challenge.progress / challenge.target);

  return (
    <Card highlight={!done} style={done && styles.cardDone}>
      <View style={styles.cardHeader}>
        <TileBox size={44}>
          <Icon name={done ? 'checkmark' : icon} size={22} color={done ? colors.green : colors.primarySoft} />
        </TileBox>
        <View style={{ flex: 1 }}>
          <Text style={styles.badge}>{label}</Text>
          <Text style={styles.hint}>{done ? 'Concluído' : hint}</Text>
        </View>
        <View style={[styles.reward, done && styles.rewardDone]}>
          <Icon name="flash" size={14} color={done ? colors.green : colors.gold} />
          <Text style={[styles.rewardText, done && { color: colors.green }]}>
            {done ? `+${challenge.xp_reward} recebidos` : `+${challenge.xp_reward} XP`}
          </Text>
        </View>
      </View>

      <Text style={styles.cardTitle}>{challenge.title}</Text>
      <Text style={styles.cardDescription}>{challenge.description}</Text>

      <ProgressBar ratio={ratio} color={done ? colors.green : colors.primary} height={10} />

      <Text style={styles.progress}>
        {challenge.progress}/{challenge.target}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardDone: { borderColor: 'rgba(61,220,151,0.35)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: {
    color: colors.primarySoft,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontFamily: fonts.title,
  },
  hint: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.body },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(242,184,75,0.12)',
  },
  rewardDone: { backgroundColor: 'rgba(61,220,151,0.12)' },
  rewardText: { color: colors.gold, fontSize: 12, fontFamily: fonts.bodySemi },
  cardTitle: { color: colors.text, fontSize: 20, lineHeight: 26, fontFamily: fonts.title, marginTop: spacing.xs },
  cardDescription: { color: colors.textMuted, fontSize: 14, lineHeight: 20, fontFamily: fonts.body },
  progress: { color: colors.text, fontSize: 14, fontFamily: fonts.titleBold },
});
