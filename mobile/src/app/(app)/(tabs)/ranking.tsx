import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../../components/Avatar';
import { Icon, InstrumentIcon } from '../../../components/Icon';
import { Chip, ErrorText, Reveal, Screen, Subtitle, Title } from '../../../components/ui';
import { useInstruments } from '../../../features/profile/api';
import { GRACE_DAYS, useInstrumentLeaderboard, useLeaderboard } from '../../../features/ranking/api';
import { useAuth } from '../../../lib/auth';
import { colors, fonts, gradients, radius, spacing } from '../../../lib/theme';

const MEDAL_COLORS = [colors.gold, colors.silver, colors.bronze];

type Row = {
  key: string;
  userId: string;
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
          userId: row.user_id,
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
            userId: row.user_id,
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

  return (
    <Screen>
      <Reveal index={0}>
        <Title>Ranking</Title>
      </Reveal>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={{ marginHorizontal: -spacing.lg, flexGrow: 0 }}
      >
        <View style={{ width: spacing.lg - spacing.sm }} />
        <Chip
          label="Geral"
          active={instrumentId === null}
          onPress={() => setInstrumentId(null)}
          icon={<Icon name="trophy" size={15} color={instrumentId === null ? colors.primarySoft : colors.textMuted} />}
        />
        {instruments?.map((instrument) => (
          <Chip
            key={instrument.id}
            label={instrument.name}
            active={instrumentId === instrument.id}
            onPress={() => setInstrumentId(instrument.id)}
            icon={
              <InstrumentIcon
                id={instrument.id}
                size={16}
                color={instrumentId === instrument.id ? colors.primarySoft : colors.textMuted}
              />
            }
          />
        ))}
        <View style={{ width: spacing.lg - spacing.sm }} />
      </ScrollView>

      <View style={styles.info}>
        <Icon name="time-outline" size={18} color={colors.textMuted} />
        <Text style={styles.infoText}>
          {instrumentId === null
            ? 'Classificação geral por XP.'
            : `Depois de ${GRACE_DAYS} dias sem praticar o instrumento, a pontuação cai 2% por dia (até −50%). Pratique para recuperar.`}
        </Text>
      </View>

      {active.isLoading ? <ActivityIndicator color={colors.primarySoft} /> : null}
      {active.isError ? <ErrorText>Não foi possível carregar o ranking.</ErrorText> : null}
      {!active.isLoading && !active.isError && rows.length === 0 ? (
        <Subtitle>Ninguém no ranking ainda. Pratique para entrar!</Subtitle>
      ) : null}

      <View style={{ gap: 10 }}>
        {rows.map((row, index) => {
          const isMe = row.userId === session?.user.id;
          const medal = MEDAL_COLORS[row.position - 1];
          const content = (
            <>
              <View style={styles.positionBox}>
                {medal ? (
                  <Icon name="medal" size={22} color={medal} />
                ) : (
                  <Text style={styles.position}>{row.position}</Text>
                )}
              </View>
              <View style={row.idle ? { opacity: 0.8 } : undefined}>
                <Avatar uri={row.avatar_url} name={row.nickname} size={42} ring={isMe} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nickname} numberOfLines={1}>
                  {row.nickname}
                  {isMe ? <Text style={styles.me}> · você</Text> : null}
                </Text>
                <Text style={[styles.sub, row.idle && styles.subIdle]} numberOfLines={1}>
                  {row.sub}
                </Text>
              </View>
              <Text style={[styles.main, row.idle && styles.mainIdle]}>{row.main}</Text>
            </>
          );
          return (
            <Reveal key={row.key} index={index + 1}>
              {isMe ? (
                <LinearGradient colors={gradients.me} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.row, styles.rowMe]}>
                  {content}
                </LinearGradient>
              ) : (
                <View style={[styles.row, styles.rowBase]}>{content}</View>
              )}
            </Reveal>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: { color: colors.textMuted, fontSize: 12, lineHeight: 17, fontFamily: fonts.body, flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: 1 },
  rowBase: { backgroundColor: colors.surface, borderColor: colors.border },
  rowMe: { borderColor: 'rgba(138,77,255,0.55)' },
  positionBox: { width: 28, alignItems: 'center' },
  position: { color: colors.textDim, fontSize: 18, fontFamily: fonts.titleBold },
  nickname: { color: colors.text, fontSize: 15, fontFamily: fonts.bodySemi },
  me: { color: colors.primarySoft, fontFamily: fonts.bodyMedium },
  sub: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.body },
  subIdle: { color: '#FF8CC6' },
  main: { color: colors.primarySoft, fontSize: 16, fontFamily: fonts.title },
  mainIdle: { color: colors.textDim },
});
