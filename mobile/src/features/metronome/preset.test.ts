import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSignature } from './preset.ts';

test('aceita compassos simples e com espaços', () => {
  assert.deepEqual(parseSignature('4/4'), { beats: 4, unit: 4 });
  assert.deepEqual(parseSignature(' 7 / 8 '), { beats: 7, unit: 8 });
});

test('recusa compasso inválido, fora de faixa ou ausente', () => {
  for (const texto of ['13/4', '4/3', 'abc', '', null]) {
    assert.equal(parseSignature(texto), null, `deveria recusar ${String(texto)}`);
  }
});
