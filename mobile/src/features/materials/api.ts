import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { friendlyError, useCreateGoal } from '../training/api';
import { type MaterialDraft, toSavePayload } from './normalize';
import type { ImportResult } from './types';

export type ImportFile = { mime: 'application/pdf' | 'image/png' | 'image/jpeg'; data: string };

const IMPORT_MESSAGES: Array<[string, string]> = [
  ['limite_diario', 'Você já usou as 3 importações de hoje. Tente amanhã.'],
  ['arquivo_grande', 'O arquivo passa de 8 MB. Escolha menos páginas.'],
  ['arquivo_invalido', 'Esse arquivo não é aceito. Use um PDF ou fotos (PNG/JPG).'],
  ['ia_indisponivel', 'A leitura por IA está indisponível agora. Tente de novo em alguns minutos.'],
  ['resposta_invalida', 'Não consegui entender o material. Tente com menos páginas.'],
  ['material_invalido', 'Confira os dados do material.'],
];

// Traduz os códigos da importação e do salvamento; o resto vira mensagem genérica.
export function friendlyImportError(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  for (const [code, text] of IMPORT_MESSAGES) {
    if (message.includes(code)) return text;
  }
  return 'Não foi possível concluir. Verifique a conexão.';
}

// Lê o código de erro devolvido pela Edge Function (corpo JSON de respostas não 2xx).
async function functionErrorCode(error: unknown): Promise<string> {
  const context = (error as { context?: Response }).context;
  try {
    const body = await context?.json();
    return typeof body?.error === 'string' ? body.error : 'erro';
  } catch {
    return 'erro';
  }
}

export function useImportMaterial() {
  return useMutation({
    mutationFn: async (files: ImportFile[]) => {
      const { data, error } = await supabase.functions.invoke('import-material', { body: { files } });
      if (error) throw new Error(await functionErrorCode(error));
      if (!data?.ok) throw new Error(String(data?.error ?? 'erro'));
      return { result: data.result as ImportResult, remaining: Number(data.remaining) };
    },
  });
}

export function useSaveMaterial() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  const createGoal = useCreateGoal();
  return useMutation({
    mutationFn: async (draft: MaterialDraft) => {
      const payload = toSavePayload(draft) as object;
      const { data, error } = await supabase.rpc('save_imported_material', { p_material: payload });
      if (error) throw error;
      const saved = data as { material_id: string; exercise_ids: string[] };

      // metas sugeridas e habilitadas; "meta_duplicada" é ignorada
      const included = draft.exercises.filter((e) => e.include);
      for (let i = 0; i < included.length; i++) {
        const s = included[i].goalSuggestion;
        if (!s?.enabled) continue;
        try {
          await createGoal.mutateAsync({
            exerciseId: saved.exercise_ids[i],
            kind: 'bpm',
            startBpm: s.startBpm,
            targetBpm: s.targetBpm,
          });
        } catch (goalError) {
          if (!friendlyError(goalError).includes('meta ativa')) throw goalError;
        }
      }
      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials', userId] });
      queryClient.invalidateQueries({ queryKey: ['training-goals', userId] });
    },
  });
}

export type MaterialRow = {
  id: string;
  title: string;
  instrument_id: string;
  level: string | null;
  created_at: string;
  exercises: { count: number }[];
};

export function useMaterials() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['materials', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_materials')
        .select('id, title, instrument_id, level, created_at, exercises(count)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as MaterialRow[];
    },
  });
}

export function useMaterial(id: string) {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['material', userId, id],
    enabled: !!userId && !!id,
    queryFn: async () => {
      const [material, exercises] = await Promise.all([
        supabase
          .from('training_materials')
          .select('id, title, instrument_id, level, general_rules, routine')
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('exercises')
          .select(
            'id, title, instrument_id, difficulty, recommended_bpm, bpm_range_min, bpm_range_max, duration_minutes, source_page, sort_order, progress_step_bpm, progress_every_seconds',
          )
          .eq('material_id', id)
          .order('sort_order'),
      ]);
      if (material.error) throw material.error;
      if (exercises.error) throw exercises.error;
      if (!material.data) throw new Error('material_invalido');
      return { material: material.data, exercises: exercises.data ?? [] };
    },
  });
}

export function useDeleteMaterial() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async (materialId: string) => {
      const { error } = await supabase.rpc('delete_training_material', { p_id: materialId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials', userId] });
      queryClient.invalidateQueries({ queryKey: ['training-goals', userId] });
      queryClient.invalidateQueries({ queryKey: ['plan', userId] });
    },
  });
}

// Quantos exercícios entraram em Hoje.
export function useAddRoutineToToday() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: async (materialId: string) => {
      const { data, error } = await supabase.rpc('add_material_routine_to_today', { p_material: materialId });
      if (error) throw error;
      return Number(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', userId] });
    },
  });
}
