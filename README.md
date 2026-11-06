# 🐍 SnakeTune

> Seu parceiro de estudo musical: pratique todo dia, suba de nível e desafie a banda.

SnakeTune (repositório `musiq`) é um app mobile para quem toca **bateria, guitarra, baixo ou piano**. Ele transforma a prática diária em hábito com metrônomo, plano semanal, XP, sequência de dias, ranking e desafios entre amigos, tudo pensado para funcionar bem mesmo sem internet.

Nasceu para a banda **SnakeShot** treinar junta, e hoje roda em Android com atualizações automáticas.

---

## ✨ O que o app faz

**Praticar**
- 🥁 **Metrônomo** preciso, com andamento e compasso ajustáveis
- 📚 **80 exercícios** (20 por instrumento), com dificuldade de 1 a 5
- 🗓️ **Plano semanal** gerado de acordo com o seu instrumento e nível (iniciante, intermediário ou avançado)
- ⏱️ Sessões de prática registradas, com tempo total e sequência de dias seguidos

**Evoluir**
- ⭐ **XP e níveis** (o nível sobe conforme você pratica)
- 🏅 **Conquistas**, incluindo as de qualidade, como usar o metrônomo e manter a regularidade
- 🎯 **Desafios** semanais para manter o ritmo
- 🏆 **Ranking** geral, por instrumento e só entre amigos

**Tocar junto**
- 👥 **Amigos**: adicione por código ou busca
- 💬 **Chat 1:1** com texto, fotos e mensagens de áudio
- ⚔️ **Duelos**: desafie um amigo por minutos praticados ou sequência de dias (3, 7 ou 14 dias), com prêmio em XP
- 🔔 **Notificações push** para mensagens, desafios e pedidos de amizade

---

## 🧰 Tecnologias

| Camada | O que usamos |
| --- | --- |
| App | React Native + Expo (SDK 58), TypeScript |
| Navegação | Expo Router |
| Estado | Zustand + TanStack Query (com cache salvo no aparelho) |
| Animações | Reanimated |
| Backend | Supabase: Postgres, Auth, Realtime e Storage |
| Segurança | Row Level Security + funções `SECURITY DEFINER` |
| Builds e updates | EAS Build e EAS Update |
| Push | Expo Notifications + Firebase Cloud Messaging |

O projeto é **offline-first**: os dados ficam em cache e sincronizam quando a conexão volta. E a ideia é manter **custo zero**, usando só planos gratuitos.

---

## 🗂️ Estrutura

```
musiq/
├── mobile/                 # o app
│   └── src/
│       ├── app/            # telas (Expo Router)
│       ├── features/       # chat, duelos, plano, ranking, metrônomo...
│       ├── components/     # componentes compartilhados (ui.tsx, Avatar...)
│       └── lib/            # tema, auth, supabase, helpers
├── supabase/
│   └── migrations/         # todo o banco, versionado
└── .github/workflows/      # publicação automática de atualizações
```

---

## 🚀 Rodando localmente

**Pré-requisitos:** Node 20+, um projeto Supabase e o app Expo Go (ou um APK de desenvolvimento).

```bash
git clone https://github.com/Jonhs1/musiq.git
cd musiq/mobile
npm install
```

Crie o arquivo `mobile/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=sua-chave-publica
```

Depois:

```bash
npx expo start -c
```

> Use sempre a chave **pública** (anon/publishable) do Supabase no app. A `service_role` nunca vai para o cliente.

Para criar o banco, aplique os arquivos de `supabase/migrations/` em ordem (pelo Supabase CLI ou pelo SQL Editor).

> ⚠️ Notificações push e metrônomo com áudio nativo precisam de um build instalado, não funcionam no Expo Go.

---

## 📦 Gerando o app (Android)

```bash
cd mobile
eas build --platform android --profile preview
```

Isso gera um APK para instalar direto no celular, sem passar pela Play Store.

### Atualizações automáticas

Depois que o APK está instalado, mudanças de código **não precisam de novo APK**. A cada `push` na `main` que altere algo em `mobile/`, o GitHub Actions publica uma atualização (EAS Update). Quem abre o app baixa a novidade e ela vale na abertura seguinte.

Só é preciso um APK novo quando muda algo nativo, como instalar uma biblioteca com código nativo ou alterar o `app.json`.

Configuração necessária uma única vez:
- secret `EXPO_TOKEN` no GitHub (Settings → Secrets and variables → Actions)
- variáveis `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_KEY` no ambiente `preview` da EAS (`eas env:set`)

### Notificações push

1. Projeto no Firebase com um app Android `com.snakeshot.snaketune`
2. `google-services.json` na pasta `mobile/`
3. Chave de conta de serviço enviada com `eas credentials` (FCM V1)

> 🔒 O arquivo da chave de conta de serviço é secreto. Nunca coloque ele no repositório.

---

## 🧱 Como o banco funciona

- **Tudo é protegido por RLS.** O app só lê e escreve o que o usuário pode ver.
- Regras mais sensíveis (amizades, mensagens, duelos, ranking) vivem em **funções SQL** (`SECURITY DEFINER`), não no app.
- **Conquistas** são liberadas por gatilho quando uma sessão de prática é salva.
- **Duelos** são encerrados de forma preguiçosa: ao abrir a lista, os vencidos são finalizados e o XP é distribuído (empate divide o prêmio).
- **Push** sai direto do banco: gatilhos em mensagens, duelos e amizades chamam a API de push da Expo via `pg_net`.
- Fuso horário de referência: `America/Sao_Paulo`. A semana começa na segunda.
- XP vira nível por `floor(sqrt(xp / 100)) + 1`.

---

## 🎨 Visual

Tema escuro com roxo como cor principal, tipografia **Chakra Petch** nos títulos e **Inter** no texto. Os componentes base ficam em `mobile/src/components/ui.tsx` (`Screen`, `Card`, `Button`, `Chip`, `Reveal`...), e as cores e espaçamentos em `mobile/src/lib/theme.ts`.

---

## 🗺️ Ideias para o futuro

- Versão para iPhone (exige conta Apple Developer paga) ou uma versão web/PWA
- Mais exercícios e trilhas por gênero
- Gravar e comparar a própria prática
- Metas de banda, para a SnakeShot inteira treinar junta

---

## 🤘 Autor

**João Victor Miranda Oliveira**
