// Pedido enviado à IA junto com o arquivo. Prompt v2 validado no AI Studio,
// sem "trecho_original" e sem "confianca" (o app não usa esses campos).
export const PROMPT = `Você é o assistente de importação de um app de prática musical. Leia as páginas anexadas e converta SOMENTE o que está escrito nelas.

Regras:
- Não invente nada. O que não estiver escrito vira null.
- Copie literalmente padrões escritos em texto (ex.: "DEDE|DEDE") no campo "padrao". Padrões de notação simplificada escritos em texto também vão em "padrao". Não transcreva notas de partitura em imagem; nesse caso use "depende_de_partitura": true.
- O "titulo" do material é o título da capa ou do cabeçalho do documento, não o de uma seção.
- "objetivo" só se estiver escrito no material; senão null.
- Registre regras gerais do material (progressão de BPM, postura, uso do metrônomo) em "regras_gerais".
- Se o material descreve uma rotina (tempo total ou sequência), preencha "rotina".
- Se um exercício repete outro (mesma ideia em outra página), preencha "repete_exercicio" com o título do outro.
- Mantenha a ordem do material. Português do Brasil, linguagem direta. Páginas sem exercício não geram exercício.

Responda APENAS com JSON:
{
  "material": { "titulo": string|null, "instrumento": "drums"|"guitar"|"bass"|"piano"|"vocal"|null, "nivel": string|null },
  "regras_gerais": [ { "texto": string, "passo_bpm": number|null, "a_cada_segundos": number|null } ],
  "rotina": { "titulo": string|null, "duracao_total_minutos": number|null, "ordem": [string] } | null,
  "exercicios": [
    { "pagina": number, "titulo": string, "descricao": string, "padrao": string|null,
      "compasso": string|null, "objetivo": string|null, "dificuldade": 1-5|null,
      "bpm_recomendado": number|null, "bpm_faixa": [number, number]|null,
      "duracao_minutos": number|null, "depende_de_partitura": boolean,
      "repete_exercicio": string|null }
  ],
  "avisos": [string]
}
Não gere metas: apenas "bpm_faixa" quando houver faixa.`;

// Esquema da resposta (formato do Gemini: tipos em maiúsculas).
const num = { type: 'NUMBER', nullable: true };
const str = { type: 'STRING', nullable: true };

export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    material: {
      type: 'OBJECT',
      properties: {
        titulo: str,
        instrumento: { type: 'STRING', nullable: true, enum: ['drums', 'guitar', 'bass', 'piano', 'vocal'] },
        nivel: str,
      },
    },
    regras_gerais: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { texto: { type: 'STRING' }, passo_bpm: num, a_cada_segundos: num },
        required: ['texto'],
      },
    },
    rotina: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        titulo: str,
        duracao_total_minutos: num,
        ordem: { type: 'ARRAY', items: { type: 'STRING' } },
      },
    },
    exercicios: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          pagina: num,
          titulo: { type: 'STRING' },
          descricao: str,
          padrao: str,
          compasso: str,
          objetivo: str,
          dificuldade: num,
          bpm_recomendado: num,
          bpm_faixa: { type: 'ARRAY', nullable: true, items: { type: 'NUMBER' } },
          duracao_minutos: num,
          depende_de_partitura: { type: 'BOOLEAN' },
          repete_exercicio: str,
        },
        required: ['titulo', 'depende_de_partitura'],
      },
    },
    avisos: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['material', 'regras_gerais', 'exercicios', 'avisos'],
};
