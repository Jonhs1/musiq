import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { supabase } from './supabase';

const PENDING_KEY = 'musiq:pending-sessions:v1';
const FAILED_KEY = 'musiq:failed-sessions:v1';

export type PendingSession = {
  id: string;
  user_id: string;
  instrument_id: string;
  exercise_id: string;
  started_at: string;
  duration_seconds: number;
  bpm_start: number;
  bpm_max: number;
  notes: string | null;
};

// Quantas sessões estão aguardando envio (usado na tela inicial)
export const usePendingCount = create<{ count: number }>(() => ({ count: 0 }));

async function readList(key: string): Promise<PendingSession[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as PendingSession[]) : [];
  } catch {
    return [];
  }
}

async function writePending(list: PendingSession[]) {
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(list));
  usePendingCount.setState({ count: list.length });
}

export async function loadPendingCount() {
  const list = await readList(PENDING_KEY);
  usePendingCount.setState({ count: list.length });
}

export async function enqueueSession(session: PendingSession) {
  const list = await readList(PENDING_KEY);
  list.push(session);
  await writePending(list);
}

async function doSync(userId: string) {
  const xpById: Record<string, number> = {};
  const all = await readList(PENDING_KEY);
  const list = all.filter((s) => s.user_id === userId);
  const done = new Set<string>();
  const failed: PendingSession[] = [];
  let synced = 0;
  let lastError: string | null = null;

  for (const session of list) {
    let result;
    try {
      result = await supabase
        .from('practice_sessions')
        .insert(session)
        .select('xp_earned')
        .single();
    } catch (e) {
      lastError = `exceção: ${e instanceof Error ? e.message : String(e)}`;
      console.warn('Envio adiado (exceção):', lastError);
      break;
    }
    const { data, error } = result;

    if (!error) {
      synced++;
      done.add(session.id);
      xpById[session.id] = data.xp_earned as number;
      continue;
    }
    if (error.code === '23505') {
      // Já tinha sido enviada antes: não há o que fazer
      synced++;
      done.add(session.id);
      continue;
    }
    lastError = `${error.code || 'sem código'}: ${error.message}`;
    if (error.code?.startsWith('22') || error.code?.startsWith('23')) {
      // Dado inválido: nunca vai passar. Guarda à parte em vez de perder.
      console.warn('Sessão rejeitada pelo servidor:', lastError);
      failed.push(session);
      done.add(session.id);
      continue;
    }
    console.warn('Envio adiado:', lastError);
    break; // erro de rede ou de login: tenta de novo mais tarde
  }

  if (failed.length > 0) {
    const previous = await readList(FAILED_KEY);
    await AsyncStorage.setItem(FAILED_KEY, JSON.stringify([...previous, ...failed]));
  }
  if (done.size > 0) {
    // Relê a fila para não apagar sessões adicionadas durante o envio
    const current = await readList(PENDING_KEY);
    await writePending(current.filter((s) => !done.has(s.id)));
  }
  return {
    synced,
    xpById,
    attempted: list.length,
    otherUsers: all.length - list.length,
    lastError,
  };
}

// Execuções em série: nunca duas sincronizações ao mesmo tempo
let chain: Promise<unknown> = Promise.resolve();

export function syncPendingSessions(userId: string) {
  const run = chain.then(() => doSync(userId));
  chain = run.catch(() => undefined);
  return run;
}