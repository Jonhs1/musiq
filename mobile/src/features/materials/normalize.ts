// Funções puras: monta o rascunho revisável a partir da resposta da IA. Sem React nem Supabase.
import type { ImportExercise, ImportResult } from './types.ts';

export type DraftExercise = {
  key: string;
  include: boolean;
  title: string;
  description: string;
  objective: string;
  difficulty: number | null;
  recommendedBpm: number | null;
  rangeMin: number | null;
  rangeMax: number | null;
  durationMinutes: number | null;
  pattern: string;
  timeSignature: string | null;
  sourcePages: number[];
  goalSuggestion: { startBpm: number; targetBpm: number; enabled: boolean } | null;
  dependsOnScore: boolean;
};

export type MaterialDraft = {
  title: string;
  instrumentId: string | null;
  level: string | null;
  generalRules: ImportResult['regras_gerais'];
  routine: ImportResult['rotina'];
  exercises: DraftExercise[];
};

// Chave de comparação: minúsculas, sem acento, espaços colapsados.
export function titleKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function toDraft(e: ImportExercise, index: number): DraftExercise {
  const faixa = e.bpm_faixa;
  return {
    key: `ex-${index}`,
    include: true,
    title: e.titulo,
    description: e.descricao ?? '',
    objective: e.objetivo ?? '',
    difficulty: e.dificuldade,
    recommendedBpm: e.bpm_recomendado ?? faixa?.[0] ?? null,
    rangeMin: faixa?.[0] ?? null,
    rangeMax: faixa?.[1] ?? null,
    durationMinutes: e.duracao_minutos,
    pattern: e.padrao ?? '',
    timeSignature: e.compasso,
    sourcePages: e.pagina != null ? [e.pagina] : [],
    goalSuggestion: faixa ? { startBpm: faixa[0], targetBpm: faixa[1], enabled: false } : null,
    dependsOnScore: e.depende_de_partitura,
  };
}

// Quem é o destino final de um exercício repetido; null se houver ciclo.
function rootOf(start: number, target: Map<number, number>): number | null {
  const seen = new Set<number>();
  let cur = start;
  while (target.has(cur)) {
    if (seen.has(cur)) return null;
    seen.add(cur);
    cur = target.get(cur) as number;
  }
  return cur;
}

// Funde exercícios marcados com repete_exercicio no principal (dados e páginas).
export function buildDraft(result: ImportResult): MaterialDraft {
  const drafts = result.exercicios.map(toDraft);
  const byKey = new Map<string, number>();
  drafts.forEach((d, i) => {
    const k = titleKey(d.title);
    if (!byKey.has(k)) byKey.set(k, i);
  });

  // i repete j (j diferente de i e existente)
  const target = new Map<number, number>();
  result.exercicios.forEach((e, i) => {
    if (!e.repete_exercicio) return;
    const j = byKey.get(titleKey(e.repete_exercicio));
    if (j !== undefined && j !== i) target.set(i, j);
  });

  const removed = new Set<number>();
  drafts.forEach((_, i) => {
    if (!target.has(i)) return;
    const root = rootOf(i, target);
    if (root === null || root === i) return;
    const main = drafts[root];
    const other = drafts[i];
    main.sourcePages = [...new Set([...main.sourcePages, ...other.sourcePages])].sort((a, b) => a - b);
    main.pattern = main.pattern || other.pattern;
    main.timeSignature = main.timeSignature ?? other.timeSignature;
    main.recommendedBpm = main.recommendedBpm ?? other.recommendedBpm;
    main.rangeMin = main.rangeMin ?? other.rangeMin;
    main.rangeMax = main.rangeMax ?? other.rangeMax;
    main.goalSuggestion = main.goalSuggestion ?? other.goalSuggestion;
    removed.add(i);
  });

  return {
    title: result.material.titulo ?? '',
    instrumentId: result.material.instrumento,
    level: result.material.nivel,
    generalRules: result.regras_gerais,
    routine: result.rotina,
    exercises: drafts.filter((_, i) => !removed.has(i)),
  };
}

// Monta o p_material da RPC save_imported_material. Exige instrumento.
export function toSavePayload(draft: MaterialDraft): object {
  if (!draft.instrumentId) throw new Error('instrumento');
  return {
    title: draft.title,
    instrument_id: draft.instrumentId,
    level: draft.level,
    general_rules: draft.generalRules,
    routine: draft.routine,
    exercises: draft.exercises
      .filter((e) => e.include)
      .map((e) => ({
        title: e.title,
        description: e.description || null,
        objective: e.objective || null,
        difficulty: e.difficulty,
        recommended_bpm: e.recommendedBpm,
        bpm_range_min: e.rangeMin,
        bpm_range_max: e.rangeMax,
        duration_minutes: e.durationMinutes,
        pattern: e.pattern || null,
        time_signature: e.timeSignature,
        source_page: e.sourcePages[0] ?? null,
      })),
  };
}
