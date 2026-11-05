import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../lib/theme';
import { BeatEvent, Metronome, MetronomeConfig, MetronomeHandle, Subdivision } from './Metronome';

const SIGNATURES: Record<string, { beats: number; unit: 4 | 8 }> = {
  '4/4': { beats: 4, unit: 4 },
  '3/4': { beats: 3, unit: 4 },
  '2/4': { beats: 2, unit: 4 },
  '6/8': { beats: 6, unit: 8 },
};

const SUBDIVISIONS: { key: Subdivision; label: string }[] = [
  { key: 'none', label: 'Nenhuma' },
  { key: 'eighth', label: 'Colcheias' },
  { key: 'triplet', label: 'Tercinas' },
  { key: 'sixteenth', label: 'Semicolcheias' },
];

const MIN_BPM = 20;
const MAX_BPM = 300;

export type MetronomePanelHandle = { stop: () => boolean; resume: () => void };

type Props = {
  initialBpm: number;
  /** Chamado ao iniciar o metrônomo, com o BPM daquele momento */
  onStart?: (bpm: number) => void;
  /** Chamado sempre que o BPM efetivo muda (botões ou aumento automático) */
  onBpm?: (bpm: number) => void;
};

export const MetronomePanel = forwardRef<MetronomePanelHandle, Props>(function MetronomePanel(
  { initialBpm, onStart, onBpm },
  ref,
) {
  const engine = useRef<MetronomeHandle>(null);
  const lastReported = useRef(initialBpm);
  const runningRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [bpm, setBpm] = useState(Math.min(MAX_BPM, Math.max(MIN_BPM, initialBpm)));
  const [signature, setSignature] = useState('4/4');
  const [subdivision, setSubdivision] = useState<Subdivision>('none');
  const [accentFirst, setAccentFirst] = useState(true);
  const [countInBars, setCountInBars] = useState(0);
  const [volume, setVolume] = useState(80);

  const [advanced, setAdvanced] = useState(false);
  const [rampEnabled, setRampEnabled] = useState(false);
  const [rampEnd, setRampEnd] = useState(Math.min(MAX_BPM, initialBpm + 20));
  const [rampStep, setRampStep] = useState(5);
  const [rampEvery, setRampEvery] = useState(30);
  const [silentEnabled, setSilentEnabled] = useState(false);
  const [barsOn, setBarsOn] = useState(4);
  const [barsOff, setBarsOff] = useState(4);

  const [beat, setBeat] = useState<BeatEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { beats, unit } = SIGNATURES[signature];
  runningRef.current = running;

  function buildConfig(): MetronomeConfig {
    return {
      bpm,
      beatsPerBar: beats,
      beatUnit: unit,
      subdivision,
      accentFirst,
      countInBars,
      volume: volume / 100,
      ramp: { enabled: rampEnabled, startBpm: bpm, endBpm: rampEnd, step: rampStep, everySeconds: rampEvery },
      silent: { enabled: silentEnabled, barsOn, barsOff },
    };
  }

  function report(value: number) {
    if (value !== lastReported.current) {
      lastReported.current = value;
      onBpm?.(value);
    }
  }

  function stopEngine() {
    engine.current?.stop();
    setRunning(false);
    setBeat(null);
  }

    useImperativeHandle(ref, () => ({
    // Para o clique e informa se estava tocando (para religar no "Retomar")
    stop: () => {
      const wasRunning = runningRef.current;
      if (wasRunning) {
        // Com aumento automático, a retomada continua do BPM em que parou
        if (rampEnabled && beat) setBpm(beat.bpm);
        stopEngine();
      }
      return wasRunning;
    },
    resume: () => {
      if (runningRef.current) return;
      setBeat(null);
      engine.current?.start(buildConfig());
      setRunning(true);
    },
  }));

  // Se o app for para segundo plano o áudio para: a tela precisa refletir isso
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stopEngine();
    });
    return () => {
      sub.remove();
      engine.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aplica mudanças ao vivo enquanto toca
  useEffect(() => {
    if (running) engine.current?.update(buildConfig());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, signature, subdivision, accentFirst, volume, rampEnabled, rampEnd, rampStep, rampEvery, silentEnabled, barsOn, barsOff]);

  function changeBpm(delta: number) {
    const next = Math.min(MAX_BPM, Math.max(MIN_BPM, bpm + delta));
    setBpm(next);
    report(next);
  }

  function toggle() {
    if (running) {
      stopEngine();
      return;
    }
    setError(null);
    setBeat(null);
    engine.current?.start(buildConfig());
    setRunning(true);
    onStart?.(bpm);
    report(bpm);
  }

  function handleBeat(event: BeatEvent) {
    setBeat(event);
    report(event.bpm);
  }

  const shownBpm = running && beat ? beat.bpm : bpm;

  return (
    <View style={styles.box}>
      <Metronome
        ref={engine}
        onBeat={handleBeat}
        onStopped={() => setRunning(false)}
        onError={(message) => {
          setError(message);
          setRunning(false);
        }}
      />

      <Text style={styles.label}>Metrônomo</Text>

      <View style={styles.bpmRow}>
        <RoundButton label="−5" onPress={() => changeBpm(-5)} />
        <RoundButton label="−1" onPress={() => changeBpm(-1)} />
        <View style={styles.bpmCenter}>
          <Text style={styles.bpmValue}>{shownBpm}</Text>
          <Text style={styles.bpmUnit}>BPM · {signature}</Text>
        </View>
        <RoundButton label="+1" onPress={() => changeBpm(1)} />
        <RoundButton label="+5" onPress={() => changeBpm(5)} />
      </View>

      <View style={styles.dots}>
        {Array.from({ length: beats }).map((_, index) => {
          const active = running && beat?.pulse === index;
          return (
            <View
              key={index}
              style={[
                styles.dot,
                active && styles.dotActive,
                active && beat?.countIn && styles.dotCountIn,
                active && beat && !beat.audible && styles.dotSilent,
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.hint}>
        {!running
          ? 'Parado'
          : beat?.countIn
            ? 'Contagem de entrada'
            : beat && !beat.audible
              ? 'Compasso em silêncio'
              : 'Tocando'}
      </Text>

      <Pressable onPress={toggle} style={[styles.playButton, running && styles.playButtonOn]}>
        <Text style={[styles.playText, running && { color: colors.text }]}>
          {running ? 'Parar metrônomo' : 'Iniciar metrônomo'}
        </Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.section}>Compasso</Text>
      <Chips
        options={Object.keys(SIGNATURES).map((key) => ({ key, label: key }))}
        value={signature}
        onChange={setSignature}
      />

      <Text style={styles.section}>Subdivisão</Text>
      <Chips options={SUBDIVISIONS} value={subdivision} onChange={(key) => setSubdivision(key as Subdivision)} />

      <Pressable onPress={() => setAdvanced((value) => !value)} style={styles.advancedToggle}>
        <Text style={styles.advancedText}>Opções avançadas</Text>
        <Text style={styles.advancedText}>{advanced ? '▲' : '▼'}</Text>
      </Pressable>

      {advanced ? (
        <View style={{ gap: spacing.sm }}>
          <Stepper label="Volume" value={volume} onChange={setVolume} step={10} min={10} max={100} unit="%" />

          <Text style={styles.section}>Contagem de entrada (vale ao iniciar)</Text>
          <Chips
            options={[0, 1, 2].map((n) => ({ key: String(n), label: n === 0 ? 'Sem' : `${n} compasso${n > 1 ? 's' : ''}` }))}
            value={String(countInBars)}
            onChange={(key) => setCountInBars(Number(key))}
          />

          <Toggle label="Acentuar o primeiro tempo" value={accentFirst} onChange={setAccentFirst} />

          <Toggle label="Aumento automático de BPM" value={rampEnabled} onChange={setRampEnabled} />
          {rampEnabled ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={styles.groupHint}>Começa no BPM acima e sobe até o BPM final.</Text>
              <Stepper label="BPM final" value={rampEnd} onChange={setRampEnd} step={5} min={MIN_BPM} max={MAX_BPM} />
              <Stepper label="Sobe" value={rampStep} onChange={setRampStep} step={1} min={1} max={20} unit=" BPM" />
              <Stepper label="A cada" value={rampEvery} onChange={setRampEvery} step={5} min={5} max={300} unit=" s" />
            </View>
          ) : null}

          <Toggle label="Modo silencioso" value={silentEnabled} onChange={setSilentEnabled} />
          {silentEnabled ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={styles.groupHint}>Alterna compassos com clique e compassos sem clique.</Text>
              <Stepper label="Com clique" value={barsOn} onChange={setBarsOn} step={1} min={1} max={16} unit=" comp." />
              <Stepper label="Sem clique" value={barsOff} onChange={setBarsOff} step={1} min={1} max={16} unit=" comp." />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

function RoundButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.round, pressed && { opacity: 0.6 }]}>
      <Text style={styles.roundText}>{label}</Text>
    </Pressable>
  );
}

function Stepper({
  label,
  value,
  onChange,
  step,
  min,
  max,
  unit = '',
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step: number;
  min: number;
  max: number;
  unit?: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <RoundButton label={`−${step}`} onPress={() => onChange(clamp(value - step))} />
        <Text style={styles.stepperValue}>
          {value}
          {unit}
        </Text>
        <RoundButton label={`+${step}`} onPress={() => onChange(clamp(value + step))} />
      </View>
    </View>
  );
}

function Chips({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((option) => (
        <Pressable
          key={option.key}
          onPress={() => onChange(option.key)}
          style={[styles.chip, value === option.key && styles.chipActive]}
        >
          <Text style={[styles.chipText, value === option.key && styles.chipTextActive]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.toggle}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Text style={[styles.toggleState, value && { color: colors.primary }]}>{value ? 'Ligado' : 'Desligado'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  label: { color: colors.textMuted, fontSize: 13 },
  bpmRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bpmCenter: { alignItems: 'center', minWidth: 90 },
  bpmValue: { color: colors.text, fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  bpmUnit: { color: colors.textMuted, fontSize: 12 },
  dots: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  dot: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary },
  dotCountIn: { backgroundColor: colors.gold },
  dotSilent: { backgroundColor: colors.textMuted },
  hint: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  playButton: {
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  playButtonOn: { backgroundColor: colors.border },
  playText: { color: colors.background, fontSize: 16, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 13 },
  section: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: spacing.xs },
  round: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: 6,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 14 },
  chipTextActive: { color: colors.primary, fontWeight: '700' },
  advancedToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  advancedText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperLabel: { color: colors.textMuted, fontSize: 14 },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stepperValue: { color: colors.text, fontSize: 16, fontWeight: '700', minWidth: 70, textAlign: 'center' },
  toggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  toggleLabel: { color: colors.text, fontSize: 15 },
  toggleState: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  groupHint: { color: colors.textMuted, fontSize: 12 },
});