// Validação pura da resposta da IA e dos arquivos recebidos. Nunca lança exceção.

export type ImportExercise = {
  pagina: number | null;
  titulo: string;
  descricao: string | null;
  padrao: string | null;
  compasso: string | null;
  objetivo: string | null;
  dificuldade: number | null;
  bpm_recomendado: number | null;
  bpm_faixa: [number, number] | null;
  duracao_minutos: number | null;
  depende_de_partitura: boolean;
  repete_exercicio: string | null;
};

export type ImportResult = {
  material: {
    titulo: string | null;
    instrumento: 'drums' | 'guitar' | 'bass' | 'piano' | 'vocals' | null;
    nivel: string | null;
  };
  regras_gerais: { texto: string; passo_bpm: number | null; a_cada_segundos: number | null }[];
  rotina: { titulo: string | null; duracao_total_minutos: number | null; ordem: string[] } | null;
  exercicios: ImportExercise[];
  avisos: string[];
};

export const LIMITS = {
  exercicios: 40,
  titulo: 120,
  descricao: 1000,
  padrao: 200,
  objetivo: 300,
  regras: 20,
  regra_texto: 400,
  ordem: 40,
  avisos: 20,
  aviso_texto: 300,
  nivel: 40,
  compasso: 10,
  maxBytes: 8 * 1024 * 1024,
  maxImagens: 6,
} as const;

const INSTRUMENTOS = new Set(['drums', 'guitar', 'bass', 'piano', 'vocals']);

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Texto: sem espaços nas pontas, nulo se vazio, cortado no limite.
function texto(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t.slice(0, max);
}

// Inteiro dentro da faixa; qualquer outra coisa vira null.
function inteiro(v: unknown, min: number, max: number): number | null {
  if (typeof v !== 'number' || !Number.isInteger(v)) return null;
  return v < min || v > max ? null : v;
}

function lista<T>(v: unknown, max: number, mapear: (x: unknown) => T | null): T[] {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const item of v) {
    if (out.length >= max) break;
    const r = mapear(item);
    if (r !== null) out.push(r);
  }
  return out;
}

function instrumento(v: unknown): ImportResult['material']['instrumento'] {
  if (v === 'vocal') return 'vocals'; // a IA pode escrever "vocal"; o id do app é "vocals"
  return typeof v === 'string' && INSTRUMENTOS.has(v) ? (v as ImportResult['material']['instrumento']) : null;
}

function exercicio(raw: unknown): ImportExercise | null {
  if (!isObj(raw)) return null;
  const titulo = texto(raw.titulo, LIMITS.titulo);
  if (titulo === null) return null;

  let faixa: [number, number] | null = null;
  if (Array.isArray(raw.bpm_faixa) && raw.bpm_faixa.length === 2) {
    const a = inteiro(raw.bpm_faixa[0], 20, 400);
    const b = inteiro(raw.bpm_faixa[1], 20, 400);
    if (a !== null && b !== null && a < b) faixa = [a, b];
  }

  return {
    pagina: inteiro(raw.pagina, 1, 999),
    titulo,
    descricao: texto(raw.descricao, LIMITS.descricao),
    padrao: texto(raw.padrao, LIMITS.padrao),
    compasso: texto(raw.compasso, LIMITS.compasso),
    objetivo: texto(raw.objetivo, LIMITS.objetivo),
    dificuldade: inteiro(raw.dificuldade, 1, 5),
    bpm_recomendado: inteiro(raw.bpm_recomendado, 20, 400),
    bpm_faixa: faixa,
    duracao_minutos: inteiro(raw.duracao_minutos, 1, 180),
    depende_de_partitura: raw.depende_de_partitura === true,
    repete_exercicio: texto(raw.repete_exercicio, LIMITS.titulo),
  };
}

export function sanitizeImport(raw: unknown): ImportResult {
  const root: Obj = isObj(raw) ? raw : {};
  const mat: Obj = isObj(root.material) ? root.material : {};
  const rot: Obj | null = isObj(root.rotina) ? root.rotina : null;

  return {
    material: {
      titulo: texto(mat.titulo, LIMITS.titulo),
      instrumento: instrumento(mat.instrumento),
      nivel: texto(mat.nivel, LIMITS.nivel),
    },
    regras_gerais: lista(root.regras_gerais, LIMITS.regras, (r) => {
      if (!isObj(r)) return null;
      const t = texto(r.texto, LIMITS.regra_texto);
      if (t === null) return null;
      return {
        texto: t,
        passo_bpm: inteiro(r.passo_bpm, 1, 100),
        a_cada_segundos: inteiro(r.a_cada_segundos, 1, 3600),
      };
    }),
    rotina: rot
      ? {
          titulo: texto(rot.titulo, LIMITS.titulo),
          duracao_total_minutos: inteiro(rot.duracao_total_minutos, 1, 600),
          ordem: lista(rot.ordem, LIMITS.ordem, (n) => texto(n, LIMITS.titulo)),
        }
      : null,
    exercicios: lista(root.exercicios, LIMITS.exercicios, exercicio),
    avisos: lista(root.avisos, LIMITS.avisos, (a) => texto(a, LIMITS.aviso_texto)),
  };
}

const MIME_IMAGEM = new Set(['image/png', 'image/jpeg']);
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export type FileError = 'arquivo_invalido' | 'arquivo_grande';

// Valida o conjunto de arquivos sem decodificar o base64 (estima o tamanho pelo comprimento).
export function checkFiles(files: unknown): { ok: true; bytes: number } | { ok: false; error: FileError } {
  if (!Array.isArray(files) || files.length === 0) return { ok: false, error: 'arquivo_invalido' };

  const pdfs = files.filter((f) => isObj(f) && f.mime === 'application/pdf').length;
  if (pdfs > 0 && files.length !== 1) return { ok: false, error: 'arquivo_invalido' };
  if (pdfs === 0 && files.length > LIMITS.maxImagens) return { ok: false, error: 'arquivo_invalido' };

  let bytes = 0;
  for (const f of files) {
    if (!isObj(f) || typeof f.data !== 'string' || f.data.length === 0) {
      return { ok: false, error: 'arquivo_invalido' };
    }
    const mimeOk = f.mime === 'application/pdf' || MIME_IMAGEM.has(String(f.mime));
    if (!mimeOk) return { ok: false, error: 'arquivo_invalido' };
    bytes += Math.floor((f.data.length * 3) / 4);
  }
  if (bytes > LIMITS.maxBytes) return { ok: false, error: 'arquivo_grande' };

  for (const f of files as Obj[]) {
    if (!BASE64.test(f.data as string)) return { ok: false, error: 'arquivo_invalido' };
  }
  return { ok: true, bytes };
}
