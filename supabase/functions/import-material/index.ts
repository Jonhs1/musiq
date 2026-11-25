// Edge Function: recebe o material, aplica a cota diária e chama o Gemini com a chave do projeto.
// Não guarda o arquivo nem registra o conteúdo dele ou a resposta da IA: só códigos de erro e duração.
import { PROMPT, RESPONSE_SCHEMA } from './prompt.ts';
import { checkFiles, sanitizeImport } from './sanitize.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const DAILY_LIMIT = 3;
const AI_TIMEOUT_MS = 90_000;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function fail(status: number, error: string) {
  console.log(JSON.stringify({ erro: error }));
  return json(status, { ok: false, error });
}

// Chama uma RPC do banco com o JWT do usuário (nunca service_role).
async function rpc(name: string, body: Record<string, unknown>, jwt: string) {
  const url = `${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/${name}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = '';
    try {
      message = String(JSON.parse(text).message ?? '');
    } catch {
      message = '';
    }
    return { ok: false as const, message };
  }
  return { ok: true as const, data: text ? JSON.parse(text) : null };
}

async function refund(jwt: string) {
  await rpc('refund_import_quota', {}, jwt);
}

// Chama a API do Gemini; uma nova tentativa após 2 s em 429/503. Timeout de 90 s.
async function callGemini(files: { mime: string; data: string }[], apiKey: string, model: string) {
  const body = {
    contents: [
      {
        parts: [
          ...files.map((f) => ({ inline_data: { mime_type: f.mime, data: f.data } })),
          { text: PROMPT },
        ],
      },
    ],
    generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (res.ok) return await res.json();
      if ((res.status === 429 || res.status === 503) && attempt === 0) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return fail(405, 'metodo_invalido');

  const started = Date.now();
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return fail(401, 'nao_autenticado');

  let body: { files?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'arquivo_invalido');
  }

  // 1) arquivo antes de qualquer cota ou chamada à IA
  const check = checkFiles(body.files);
  if (!check.ok) return fail(check.error === 'arquivo_grande' ? 413 : 400, check.error);
  const files = body.files as { mime: string; data: string }[];

  // 2) configuração da IA; sem ela, nada é consumido
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  const model = Deno.env.get('GEMINI_MODEL');
  if (!apiKey || !model) return fail(502, 'ia_indisponivel');

  // 3) cota diária (fuso de São Paulo, feita no banco)
  const quota = await rpc('consume_import_quota', { p_limit: DAILY_LIMIT }, jwt);
  if (!quota.ok) {
    if (quota.message.includes('limite_diario')) return fail(429, 'limite_diario');
    return fail(502, 'ia_indisponivel');
  }
  const remaining = Number(quota.data);

  // 4) IA; qualquer falha devolve a cota
  const ai = await callGemini(files, apiKey, model);
  if (!ai) {
    await refund(jwt);
    return fail(502, 'ia_indisponivel');
  }

  // 5) resposta: precisa ser JSON e trazer pelo menos um exercício
  let parsed: unknown;
  try {
    const text = (ai.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
    parsed = JSON.parse(text);
  } catch {
    await refund(jwt);
    return fail(502, 'resposta_invalida');
  }
  const result = sanitizeImport(parsed);
  if (result.exercicios.length === 0) {
    await refund(jwt);
    return fail(502, 'resposta_invalida');
  }

  console.log(JSON.stringify({ ok: true, ms: Date.now() - started, exercicios: result.exercicios.length }));
  return json(200, { ok: true, result, remaining });
});
