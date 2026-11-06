// Conversões entre frequência e nota musical (A4 = 440 Hz). Sem dependências de React/RN.

export const A4 = 440;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export type TuneString = { label: string; midi: number };

export type NoteReading = {
  name: string; // C, C#, D...
  octave: number;
  midi: number; // nota cromática mais próxima
  cents: number; // desvio em relação a essa nota (−50..+50)
  frequency: number; // frequência medida
  target: number; // frequência exata da nota mais próxima
};

export function midiToFrequency(midi: number): number {
  return A4 * Math.pow(2, (midi - 69) / 12);
}

export function midiToLabel(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function centsBetween(frequency: number, reference: number): number {
  return 1200 * Math.log2(frequency / reference);
}

export function frequencyToNote(frequency: number): NoteReading {
  const exact = 69 + 12 * Math.log2(frequency / A4);
  const midi = Math.round(exact);
  const target = midiToFrequency(midi);
  return {
    name: NOTE_NAMES[((midi % 12) + 12) % 12],
    octave: Math.floor(midi / 12) - 1,
    midi,
    cents: centsBetween(frequency, target),
    frequency,
    target,
  };
}

/** Corda mais próxima da frequência (em centavos); null se a afinação for cromática (sem cordas) */
export function nearestString(frequency: number, strings: TuneString[]): TuneString | null {
  let best: TuneString | null = null;
  let bestDistance = Infinity;
  for (const item of strings) {
    const distance = Math.abs(centsBetween(frequency, midiToFrequency(item.midi)));
    if (distance < bestDistance) {
      best = item;
      bestDistance = distance;
    }
  }
  return best;
}

export type Measurement = {
  label: string; // ex.: "E2"
  name: string;
  octave: number;
  cents: number; // desvio em relação ao alvo (pode passar de ±50 quando está longe)
  target: number; // frequência alvo em Hz
  string: TuneString | null; // corda alvo; null no modo cromático
  reliable: boolean; // false quando, no automático, o som não combina com nenhuma corda (ex.: duas cordas juntas)
};

// Entre duas cordas vizinhas o desvio chega a ~250 centavos; além disso não é uma corda.
const AUTO_MAX_CENTS = 300;

/**
 * O que a tela mostra: com cordas, o alvo é a corda fixada (ou a mais próxima, no automático);
 * sem cordas (cromático), o alvo é a nota mais próxima.
 */
export function measure(frequency: number, strings: TuneString[], fixed: TuneString | null): Measurement {
  const target = fixed ?? (strings.length > 0 ? nearestString(frequency, strings) : null);
  if (!target) {
    const note = frequencyToNote(frequency);
    return {
      label: `${note.name}${note.octave}`,
      name: note.name,
      octave: note.octave,
      cents: note.cents,
      target: note.target,
      string: null,
      reliable: true,
    };
  }
  const targetFrequency = midiToFrequency(target.midi);
  const cents = centsBetween(frequency, targetFrequency);
  return {
    label: target.label,
    name: NOTE_NAMES[((target.midi % 12) + 12) % 12],
    octave: Math.floor(target.midi / 12) - 1,
    cents,
    target: targetFrequency,
    string: target,
    reliable: fixed !== null || Math.abs(cents) <= AUTO_MAX_CENTS,
  };
}