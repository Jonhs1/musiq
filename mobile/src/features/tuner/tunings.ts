import { midiToLabel, TuneString } from './notes';

export type Tuning = { id: string; label: string; strings: TuneString[] };

function strings(midis: number[]): TuneString[] {
  return midis.map((midi) => ({ midi, label: midiToLabel(midi) }));
}

const GUITAR: Tuning[] = [
  { id: 'guitar-standard', label: 'Padrão', strings: strings([40, 45, 50, 55, 59, 64]) },
  { id: 'guitar-dropd', label: 'Drop D', strings: strings([38, 45, 50, 55, 59, 64]) },
];

const BASS: Tuning[] = [
  { id: 'bass-4', label: '4 cordas', strings: strings([28, 33, 38, 43]) },
  { id: 'bass-5', label: '5 cordas', strings: strings([23, 28, 33, 38, 43]) },
];

const CHROMATIC: Tuning = { id: 'chromatic', label: 'Cromático', strings: [] };

/** Afinações disponíveis para o instrumento (piano, vocal e bateria usam o modo cromático) */
export function tuningsFor(instrumentId: string): Tuning[] {
  if (instrumentId === 'guitar') return GUITAR;
  if (instrumentId === 'bass') return BASS;
  return [CHROMATIC];
}

export function defaultTuningFor(instrumentId: string): Tuning {
  return tuningsFor(instrumentId)[0];
}

/** Todas as afinações (usado quando o afinador abre sem instrumento escolhido) */
export function allTunings(): Tuning[] {
  return [...GUITAR, ...BASS, CHROMATIC];
}