import assert from 'node:assert/strict';
import { checkFiles, LIMITS, sanitizeImport } from './sanitize.ts';

const ex = (extra: Record<string, unknown> = {}) => ({ titulo: 'Exercício', ...extra });

Deno.test('entrada que não é objeto não lança e devolve lista vazia', () => {
  for (const raw of [null, 'texto', [1, 2], 42, {}, { outra: 1 }]) {
    const r = sanitizeImport(raw);
    assert.deepEqual(r.exercicios, []);
  }
});

Deno.test('campos extras são ignorados e instrumento desconhecido vira null', () => {
  const r = sanitizeImport({ material: { titulo: 'M', instrumento: 'ukulele', extra: 1 }, exercicios: [ex({ lixo: true })] });
  assert.equal(r.material.instrumento, null);
  assert.equal(r.exercicios.length, 1);
  assert.equal('lixo' in r.exercicios[0], false);
});

Deno.test('vocal vira vocals (id do app)', () => {
  assert.equal(sanitizeImport({ material: { instrumento: 'vocal' } }).material.instrumento, 'vocals');
});

Deno.test('valores inválidos viram null (Review Focus 1)', () => {
  const r = sanitizeImport({
    exercicios: [ex({ bpm_faixa: [80, 60], bpm_recomendado: 999, dificuldade: 9, duracao_minutos: -3 })],
  });
  const e = r.exercicios[0];
  assert.equal(e.bpm_faixa, null);
  assert.equal(e.bpm_recomendado, null);
  assert.equal(e.dificuldade, null);
  assert.equal(e.duracao_minutos, null);
});

Deno.test('faixa de BPM fora de 20–400 vira null', () => {
  const r = sanitizeImport({ exercicios: [ex({ bpm_faixa: [10, 500] })] });
  assert.equal(r.exercicios[0].bpm_faixa, null);
});

Deno.test('faixa válida é mantida', () => {
  const r = sanitizeImport({ exercicios: [ex({ bpm_faixa: [60, 80] })] });
  assert.deepEqual(r.exercicios[0].bpm_faixa, [60, 80]);
});

Deno.test('excesso de exercícios é cortado em 40 e exercício sem título é descartado', () => {
  const muitos = Array.from({ length: 100 }, (_, i) => ex({ titulo: `E${i}` }));
  const r = sanitizeImport({ exercicios: [{ descricao: 'sem título' }, ...muitos] });
  assert.equal(r.exercicios.length, LIMITS.exercicios);
  assert.equal(r.exercicios[0].titulo, 'E0');
});

Deno.test('título longo é cortado em 120 e padrão em 200', () => {
  const r = sanitizeImport({ exercicios: [ex({ titulo: 'a'.repeat(500), padrao: 'b'.repeat(900) })] });
  assert.equal(r.exercicios[0].titulo.length, LIMITS.titulo);
  assert.equal(r.exercicios[0].padrao?.length, LIMITS.padrao);
});

Deno.test('regras gerais limitadas a 20 e sem texto são descartadas', () => {
  const regras = Array.from({ length: 30 }, (_, i) => ({ texto: `r${i}`, passo_bpm: 5, a_cada_segundos: 30 }));
  const r = sanitizeImport({ regras_gerais: [{ texto: '   ' }, ...regras] });
  assert.equal(r.regras_gerais.length, LIMITS.regras);
  assert.equal(r.regras_gerais[0].texto, 'r0');
});

Deno.test('rotina com ordem limitada e nomes vazios descartados', () => {
  const r = sanitizeImport({ rotina: { titulo: 'R', duracao_total_minutos: 20, ordem: ['A', '', 'B'] } });
  assert.deepEqual(r.rotina?.ordem, ['A', 'B']);
  assert.equal(r.rotina?.duracao_total_minutos, 20);
});

Deno.test('checkFiles: casos de arquivo inválido', () => {
  const png = { mime: 'image/png', data: 'QUJD' };
  assert.deepEqual(checkFiles([]), { ok: false, error: 'arquivo_invalido' });
  assert.deepEqual(checkFiles([{ mime: 'application/zip', data: 'QUJD' }]), { ok: false, error: 'arquivo_invalido' });
  assert.deepEqual(checkFiles([{ mime: 'application/pdf', data: 'QUJD' }, png]), { ok: false, error: 'arquivo_invalido' });
  assert.deepEqual(checkFiles(Array(7).fill(png)), { ok: false, error: 'arquivo_invalido' });
  assert.deepEqual(checkFiles([{ mime: 'image/png', data: 'QU$D' }]), { ok: false, error: 'arquivo_invalido' });
});

Deno.test('checkFiles: acima de 8 MB estimados é arquivo_grande', () => {
  const grande = 'A'.repeat(Math.ceil((9 * 1024 * 1024 * 4) / 3));
  assert.deepEqual(checkFiles([{ mime: 'application/pdf', data: grande }]), { ok: false, error: 'arquivo_grande' });
});

Deno.test('checkFiles: PDF válido e até 6 imagens são aceitos', () => {
  assert.equal(checkFiles([{ mime: 'application/pdf', data: 'QUJD' }]).ok, true);
  assert.equal(checkFiles(Array(6).fill({ mime: 'image/jpeg', data: 'QUJD' })).ok, true);
});
