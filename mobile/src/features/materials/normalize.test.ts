import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildDraft, titleKey, toSavePayload } from './normalize.ts';
import type { ImportResult } from './types.ts';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/importacao-apostila-pedal-duplo.json', import.meta.url), 'utf8'),
) as ImportResult;

const ex = (titulo: string, extra: Partial<ImportResult['exercicios'][number]> = {}) => ({
  pagina: 2,
  titulo,
  descricao: null,
  padrao: null,
  compasso: '4/4',
  objetivo: null,
  dificuldade: 1,
  bpm_recomendado: null,
  bpm_faixa: null,
  duracao_minutos: 5,
  depende_de_partitura: false,
  repete_exercicio: null,
  ...extra,
});
const base = (exercicios: ImportResult['exercicios']): ImportResult => ({ ...fixture, exercicios });

test('fixture: funde 8 exercícios em 4', () => {
  const d = buildDraft(fixture);
  assert.equal(d.exercises.length, 4);
});

test('fixture: Aquecimento junta as páginas 2 e 3', () => {
  const d = buildDraft(fixture);
  const aq = d.exercises.find((e) => e.title === 'Aquecimento');
  assert.deepEqual(aq?.sourcePages, [2, 3]);
});

test('fixture: Alternância contínua tem faixa, recomendado e meta sugerida desligada', () => {
  const d = buildDraft(fixture);
  const alt = d.exercises.find((e) => e.title === 'Alternância contínua');
  assert.equal(alt?.rangeMin, 60);
  assert.equal(alt?.rangeMax, 80);
  assert.equal(alt?.recommendedBpm, 60);
  assert.deepEqual(alt?.goalSuggestion, { startBpm: 60, targetBpm: 80, enabled: false });
});

test('fixture: Golpes duplos mantém o padrão', () => {
  const d = buildDraft(fixture);
  assert.equal(d.exercises.find((e) => e.title === 'Golpes duplos')?.pattern, 'D D E E | D D E E');
});

test('fixture: regras gerais (6, último com passo 5) e rotina (4 nomes)', () => {
  const d = buildDraft(fixture);
  assert.equal(d.generalRules.length, 6);
  assert.equal(d.generalRules[5].passo_bpm, 5);
  assert.equal(d.routine?.ordem.length, 4);
});

test('titleKey ignora caixa, acentos e espaços extras', () => {
  assert.equal(titleKey('  Aquecimento '), titleKey('AQUECIMENTO'));
  assert.equal(titleKey('Colcheias  Alternadas'), titleKey('colcheias alternadas'));
  assert.equal(titleKey('Alternância'), titleKey('alternancia'));
});

test('fusão tolerante a acento e caixa', () => {
  const d = buildDraft(
    base([ex('Alternância contínua'), ex('Outro', { repete_exercicio: 'ALTERNANCIA CONTINUA', pagina: 3 })]),
  );
  assert.equal(d.exercises.length, 1);
  assert.deepEqual(d.exercises[0].sourcePages, [2, 3]);
});

test('repete_exercicio que aponta para si mesmo, título inexistente ou ciclo não perde exercício', () => {
  const d = buildDraft(
    base([
      ex('Um', { repete_exercicio: 'Um' }),
      ex('Dois', { repete_exercicio: 'Nao existe' }),
      ex('Tres', { repete_exercicio: 'Quatro' }),
      ex('Quatro', { repete_exercicio: 'Tres' }),
    ]),
  );
  assert.equal(d.exercises.length, 4);
});

test('toSavePayload omite excluídos, usa faixa e recomendado, e exige instrumento', () => {
  const draft = buildDraft(fixture);
  draft.exercises[0].include = false;
  const payload = toSavePayload(draft) as { exercises: { title: string; bpm_range_min: number | null; recommended_bpm: number | null }[] };
  assert.equal(payload.exercises.length, 3);
  const alt = payload.exercises.find((e) => e.title === 'Alternância contínua');
  assert.equal(alt?.bpm_range_min, 60);
  assert.equal(alt?.recommended_bpm, 60);
  assert.throws(() => toSavePayload({ ...draft, instrumentId: null }), /instrumento/);
});
