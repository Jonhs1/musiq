import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../../components/BackButton';
import { Button, Chip, Reveal, Screen, Subtitle, Title } from '../../components/ui';
import { FrequencyReadout } from '../../features/tuner/FrequencyReadout';
import { measure, TuneString } from '../../features/tuner/notes';
import { TunerMeter } from '../../features/tuner/TunerMeter';
import { allTunings, Tuning, tuningsFor } from '../../features/tuner/tunings';
import { useTuner } from '../../features/tuner/useTuner';
import { colors, fonts, radius, spacing } from '../../lib/theme';

const IN_TUNE_CENTS = 5;

export default function TunerScreen() {
  const { instrument } = useLocalSearchParams<{ instrument?: string }>();

  // com instrumento: as afinações dele; sem instrumento (vindo da Home): todas, começando no cromático
  const options = instrument ? tuningsFor(instrument) : allTunings();
  const [tuning, setTuning] = useState<Tuning>(instrument ? options[0] : options[options.length - 1]);
  const [fixed, setFixed] = useState<TuneString | null>(null);

  const { status, reading, retry } = useTuner(true);
  const measured = reading ? measure(reading.frequency, tuning.strings, fixed) : null;
  // duas cordas juntas (ou algo que não combina com nenhuma corda) não vira leitura
  const mixed = measured !== null && !measured.reliable;
  const result = mixed ? null : measured;
  const inTune = result !== null && Math.abs(result.cents) <= IN_TUNE_CENTS;

  function pickTuning(next: Tuning) {
    setTuning(next);
    setFixed(null);
  }

  return (
    <Screen>
      <BackButton />
      <Reveal index={0}>
        <Title>Afinador</Title>
        <Subtitle>Toque uma corda ou cante uma nota perto do microfone.</Subtitle>
      </Reveal>

      {status === 'idle' || status === 'requesting' ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primarySoft} />
          <Text style={styles.message}>Ligando o microfone…</Text>
        </View>
      ) : null}

      {status === 'denied' ? (
        <View style={styles.center}>
          <Text style={styles.message}>
            O afinador precisa do microfone. Se o pedido de permissão não aparecer, libere o microfone nas
            configurações do app.
          </Text>
          <Button title="Tentar de novo" onPress={retry} />
        </View>
      ) : null}

      {status === 'unavailable' ? (
        <View style={styles.center}>
          <Text style={styles.message}>
            O afinador precisa do app instalado (APK) em um Android. Ele não funciona no Expo Go.
          </Text>
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={styles.center}>
          <Text style={styles.message}>Não foi possível usar o microfone.</Text>
          <Button title="Tentar de novo" onPress={retry} />
        </View>
      ) : null}

      {status === 'listening' ? (
        <>
          <Reveal index={1} style={styles.noteBlock}>
            <View style={styles.noteRow}>
              <Text style={[styles.note, { color: inTune ? colors.green : colors.text }]}>
                {result ? result.name : '–'}
              </Text>
              {result ? <Text style={styles.octave}>{result.octave}</Text> : null}
            </View>
            <Text style={[styles.status, inTune && { color: colors.green }]}>
              {!result
                ? mixed
                  ? 'Toque uma corda de cada vez'
                  : 'Toque uma nota'
                : inTune
                  ? 'Afinado'
                  : `${result.cents > 0 ? 'Acima' : 'Abaixo'} · ${result.cents > 0 ? '+' : ''}${Math.round(result.cents)} centavos`}
            </Text>
          </Reveal>

          <Reveal index={2}>
            <TunerMeter cents={result ? result.cents : null} inTune={inTune} />
          </Reveal>

          <Reveal index={3}>
            <FrequencyReadout
              frequency={reading ? reading.frequency : null}
              target={result?.string ? result.target : null}
            />
          </Reveal>

          {tuning.strings.length > 0 ? (
            <Reveal index={4} style={styles.strings}>
              <Pressable
                onPress={() => setFixed(null)}
                style={[styles.string, fixed === null && styles.stringActive]}
              >
                <Text style={[styles.stringText, fixed === null && styles.stringTextActive]}>Auto</Text>
              </Pressable>
              {tuning.strings.map((item) => {
                const highlighted = fixed ? fixed.midi === item.midi : result?.string?.midi === item.midi;
                return (
                  <Pressable
                    key={item.midi}
                    onPress={() => setFixed(fixed?.midi === item.midi ? null : item)}
                    style={[styles.string, highlighted && styles.stringActive]}
                  >
                    <Text style={[styles.stringText, highlighted && styles.stringTextActive]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </Reveal>
          ) : null}
        </>
      ) : null}

      {options.length > 1 ? (
        <Reveal index={5} style={styles.tunings}>
          {options.map((item) => (
            <Chip
              key={item.id}
              label={
                instrument || item.id === 'chromatic'
                  ? item.label
                  : `${item.id.startsWith('guitar') ? 'Guitarra' : 'Baixo'} · ${item.label}`
              }
              active={item.id === tuning.id}
              onPress={() => pickTuning(item)}
            />
          ))}
        </Reveal>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  message: { color: colors.textMuted, fontSize: 14, lineHeight: 20, fontFamily: fonts.body, textAlign: 'center' },
  noteBlock: { alignItems: 'center', gap: 4, marginTop: spacing.sm },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  note: { fontSize: 88, lineHeight: 96, fontFamily: fonts.titleBold },
  octave: { color: colors.textMuted, fontSize: 24, lineHeight: 30, marginTop: 14, fontFamily: fonts.title },
  status: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.bodyMedium },
  strings: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm },
  string: {
    minWidth: 52,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stringActive: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  stringText: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.bodySemi },
  stringTextActive: { color: colors.primarySoft },
  tunings: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md },
});