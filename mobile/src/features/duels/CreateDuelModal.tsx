import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Button, ErrorText } from '../../components/ui';
import { colors, fonts, radius, spacing } from '../../lib/theme';
import { DuelFormat, FORMAT_LABEL, FORMAT_RULE, duelError, rewardFor, useCreateDuel } from './api';

const DAYS = [3, 7, 14];

export function CreateDuelModal({
  visible,
  onClose,
  friendId,
  friendName,
}: {
  visible: boolean;
  onClose: () => void;
  friendId: string;
  friendName: string;
}) {
  const [format, setFormat] = useState<DuelFormat>('minutes');
  const [days, setDays] = useState(7);
  const [sent, setSent] = useState(false);
  const create = useCreateDuel();

  function close() {
    setSent(false);
    create.reset();
    onClose();
  }

  function submit() {
    create.mutate({ friendId, format, days }, { onSuccess: () => setSent(true) });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        {sent ? (
          <View style={{ gap: spacing.md, alignItems: 'center', paddingVertical: spacing.md }}>
            <Icon name="flash" size={40} color={colors.gold} />
            <Text style={styles.title}>Desafio enviado!</Text>
            <Text style={styles.rule}>
              Assim que {friendName} aceitar, o duelo começa. Acompanhe na aba Desafios dos amigos.
            </Text>
            <Button title="Fechar" variant="soft" onPress={close} />
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            <Text style={styles.title}>Desafiar {friendName}</Text>

            <View style={{ gap: spacing.sm }}>
              {(['minutes', 'streak'] as const).map((item) => {
                const active = format === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setFormat(item)}
                    style={[styles.option, active && styles.optionActive]}
                  >
                    <Icon
                      name={item === 'minutes' ? 'time' : 'flame'}
                      size={22}
                      color={active ? colors.primarySoft : colors.textMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionTitle}>{FORMAT_LABEL[item]}</Text>
                      <Text style={styles.rule}>{FORMAT_RULE[item]}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View>
              <Text style={styles.label}>Duração</Text>
              <View style={styles.daysRow}>
                {DAYS.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => setDays(item)}
                    style={[styles.dayChip, days === item && styles.dayChipActive]}
                  >
                    <Text style={[styles.dayText, days === item && { color: colors.onPrimary }]}>{item} dias</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.reward}>
              <Icon name="flash" size={16} color={colors.gold} />
              <Text style={styles.rewardText}>Quem vencer ganha +{rewardFor(days)} XP (empate: metade para cada)</Text>
            </View>

            {create.isError ? <ErrorText>{duelError(create.error)}</ErrorText> : null}

            <Button title="Enviar desafio" icon="flash" onPress={submit} loading={create.isPending} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,7,12,0.7)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    paddingBottom: 36,
    gap: spacing.md,
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong },
  title: { color: colors.text, fontSize: 22, fontFamily: fonts.titleBold },
  rule: { color: colors.textMuted, fontSize: 13, lineHeight: 18, fontFamily: fonts.body },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  optionTitle: { color: colors.text, fontSize: 15, fontFamily: fonts.bodySemi },
  label: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.bodyMedium, marginBottom: 8 },
  daysRow: { flexDirection: 'row', gap: spacing.sm },
  dayChip: {
    flex: 1,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { color: colors.text, fontSize: 14, fontFamily: fonts.bodySemi },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(242,184,75,0.10)',
  },
  rewardText: { flex: 1, color: colors.gold, fontSize: 13, fontFamily: fonts.bodyMedium },
});