import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../../components/Avatar';
import { Screen } from '../../../components/ui';
import { INSTRUMENT_EMOJI, useInstruments } from '../../../features/profile/api';
import { GRACE_DAYS, useInstrumentLeaderboard, useLeaderboard } from '../../../features/ranking/api';
import { useAuth } from '../../../lib/auth';
import { colors, radius, spacing } from '../../../lib/theme';

const MEDAL_COLORS = [colors.gold, colors.silver, colors.bronze];

type Row = {
  key: string;
  position: number;
  nickname: string | null;
  avatar_url: string | null;
  main: string; // texto à direita
  sub: string; // texto abaixo do apelido
  idle: boolean; // pontuação reduzida por inatividade
};

export default function Ranking() {
  const { session } = useAuth();
  const { data: instruments } = useInstruments();
  const [instrumentId, setInstrumentId] = useState<string | null>(null); // null = geral

  const general = useLeaderboard(instrumentId === null);
  const byInstrument = useInstrumentLeaderboard(instrumentId);
  const active = instrumentId === null ? general : byInstrument;

  useFocusEffect(
    useCallback(() => {
      active.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [instrumentId]),
  );

  const rows: Row[] =
    instrumentId === null
      ? (general.data ?? []).map((row) => ({
          key: row.user_id,
          position: row.rank_position,
          nickname: row.nickname,
          avatar_url: row.avatar_url,
          main: `${row.xp} XP`,
          sub: `Nível ${row.level}`,
          idle: false,
        }))
      : (byInstrument.data ?? []).map((row) => {
          const idle = row.inactive_days > GRACE_DAYS;
          return {
            key: row.user_id,
            position: row.rank_position,
            nickname: row.nickname,
            avatar_url: row.avatar_url,
            main: `${row.score} pts`,
            sub: idle
              ? `${row.inactive_days} dias sem praticar · ${row.xp} XP`
              : `${row.xp} XP no instrumento`,
            idle,
          };
        });

  const userIds =
    instrumentId === null
      ? (general.data ?? []).map((row) => row.user_id)
      : (byInstrument.data ?? []).map((row) => row.user_id);

  return (
    <Screen>
      <Text style={styles.title}>Ranking</Text>

      <View style={styles.chips}>
        <Chip label="🏆 Geral" active={instrumentId === null} onPress={() => setInstrumentId(null)} />
        {instruments?.map((instrument) => (
          <Chip
            key={instrument.id}
            label={`${INSTRUMENT_EMOJI[instrument.id] ?? '🎵'} ${instrument.name}`}
            active={instrumentId === instrument.id}
            onPress={() => setInstrumentId(instrument.id)}
          />
        ))}
      </View>

      <Text style={styles.subtitle}>
        {instrumentId === null
          ? 'Classificação geral por XP.'
          : `Ranking permanente do instrumento. Depois de ${GRACE_DAYS} dias sem praticar, a pontuação cai 2% por dia (até −50%) e volta ao normal quando você pratica.`}
      </Text>

      {active.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {active.isError ? <Text style={styles.error}>Não foi possível carregar o ranking.</Text> : null}
      {!active.isLoading && !active.isError && rows.length === 0 ? (
        <Text style={styles.subtitle}>Ninguém no ranking ainda. Pratique para entrar!</Text>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        {rows.map((row, index) => {
          const isMe = userIds[index] === session?.user.id;
          const medal = MEDAL_COLORS[row.position - 1];
          return (
            <View key={row.key} style={[styles.row, isMe && styles.rowMe]}>
              <Text style={[styles.position, medal ? { color: medal } : null]}>{row.position}</Text>
              <Avatar uri={row.avatar_url} name={row.nickname} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.nickname}>
                  {row.nickname}
                  {isMe ? ' (você)' : ''}
                </Text>
                <Text style={[styles.sub, row.idle && styles.subIdle]}>{row.sub}</Text>
              </View>
              <Text style={[styles.main, row.idle && styles.mainIdle]}>{row.main}</Text>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 28, fontWeight: '700', marginTop: spacing.md },
  subtitle: { color: colors.textMuted, fontSize: 14 },
  error: { color: colors.danger },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 14 },
  chipTextActive: { color: colors.primary, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowMe: { borderColor: colors.primary },
  position: { color: colors.textMuted, fontSize: 18, fontWeight: '800', width: 28, textAlign: 'center' },
  nickname: { color: colors.text, fontSize: 16, fontWeight: '600' },
  sub: { color: colors.textMuted, fontSize: 12 },
  subIdle: { color: colors.danger },
  main: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  mainIdle: { color: colors.textMuted },
});