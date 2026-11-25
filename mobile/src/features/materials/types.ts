// Cópia dos tipos da resposta da função import-material (o app não importa de supabase/).
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
