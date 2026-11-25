import assert from 'node:assert/strict';
import { test } from 'node:test';
import { goalSummary, idleLabel } from './format.ts';

const bpmGoal = {
  kind: 'bpm' as const,
  status: 'active' as const,
  start_bpm: 130,
  target_bpm: 200,
  best_bpm: 165,
  days_per_week: null,
  days_done_week: null,
};

test('meta BPM em andamento mostra o que falta', () => {
  assert.equal(goalSummary(bpmGoal), '165 de 200 BPM · faltam 35');
});

test('meta BPM concluída mostra a marca atingida', () => {
  assert.equal(goalSummary({ ...bpmGoal, status: 'done', best_bpm: 210 }), 'Meta atingida: 200 BPM');
});

test('meta de constância mostra os dias da semana', () => {
  const goal = {
    kind: 'consistency' as const,
    status: 'active' as const,
    start_bpm: null,
    target_bpm: null,
    best_bpm: null,
    days_per_week: 4,
    days_done_week: 2,
  };
  assert.equal(goalSummary(goal), '2 de 4 dias nesta semana');
});

test('rótulo de dias sem praticar', () => {
  assert.equal(idleLabel(null), 'Nunca praticado');
  assert.equal(idleLabel(0), 'Praticado hoje');
  assert.equal(idleLabel(1), 'Ontem');
  assert.equal(idleLabel(6), 'Há 6 dias');
});
