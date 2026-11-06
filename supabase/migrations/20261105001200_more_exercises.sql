-- +56 exercícios (14 por instrumento), cobrindo dificuldades 1 a 5.
-- Antes só existiam níveis 1-3; o plano semanal de quem é "avançado" usa 3-5.

insert into public.exercises (instrument_id, title, description, objective, difficulty, recommended_bpm, duration_minutes)
select v.instrument_id, v.title, v.description, v.objective, v.difficulty, v.bpm, v.minutes
from (values
  -- BATERIA
  ('drums', 'Pulso em semínimas no chimbal', 'Toque semínimas no chimbal fechado em cima do clique, sem mexer o resto do corpo. Ouça se cada batida cai junto com o clique.', 'Pulso estável e relaxamento', 1, 70, 5),
  ('drums', 'Toque simples alternado na caixa', 'Alterne mão direita e esquerda em colcheias, mantendo a mesma altura de baqueta e o mesmo volume nas duas mãos.', 'Igualdade entre as mãos', 1, 70, 5),
  ('drums', 'Bumbo e caixa nos tempos fortes', 'Bumbo no 1 e no 3 e caixa no 2 e no 4. Quando estiver firme, acrescente o chimbal em semínimas.', 'Coordenação básica entre pés e mãos', 1, 70, 5),
  ('drums', 'Groove de rock com bumbo sincopado', 'Chimbal em colcheias e caixa no 2 e no 4, enquanto o bumbo toca no 1, no "e" do 2 e no 3.', 'Independência do bumbo', 2, 80, 10),
  ('drums', 'Flam e flam tap', 'Toque uma nota de apoio baixa logo antes da nota principal (flam). Depois combine com um toque simples (flam tap).', 'Rudimentos de ataque e controle de altura', 2, 70, 5),
  ('drums', 'Levada em compasso 3/4', 'Groove de valsa: bumbo no 1, caixa no 2 e no 3, chimbal em semínimas e depois em colcheias.', 'Sentir e contar compassos ternários', 2, 80, 10),
  ('drums', 'Groove de funk com notas fantasma', 'Toque notas fantasma bem baixas na caixa entre as principais, com chimbal em semicolcheias.', 'Dinâmica e feeling', 3, 75, 10),
  ('drums', 'Rulos fechados de 5 e 7 toques', 'Execute rulos de cinco e de sete toques terminando com um acento no tempo forte.', 'Rulo fechado e controle do rebote', 3, 60, 5),
  ('drums', 'Rock com chimbal aberto', 'Abra o chimbal no "e" do 4 e feche no 1 do compasso seguinte, sem atrapalhar o bumbo e a caixa.', 'Controle do pedal do chimbal', 3, 80, 10),
  ('drums', 'Paradiddle-diddle em viradas', 'Toque D E D D E E e passe a sequência pela caixa e pelos tons, em sextinas.', 'Rudimentos aplicados em viradas', 4, 70, 10),
  ('drums', 'Groove em 6/8', 'Levada em 6/8 com acento no 1 e no 4, bumbo e caixa dialogando e chimbal em colcheias.', 'Subdivisão ternária composta', 4, 70, 10),
  ('drums', 'Bumbo duplo em semicolcheias', 'Mantenha semicolcheias contínuas no bumbo duplo enquanto as mãos tocam um groove simples com prato.', 'Resistência e consistência dos pés', 4, 90, 10),
  ('drums', 'Groove em compasso 7/8', 'Conte 2+2+3, acentue o 1 de cada grupo e mantenha o chimbal constante em colcheias.', 'Compassos ímpares', 5, 80, 10),
  ('drums', 'Blast beat básico', 'Alterne bumbo e caixa em semicolcheias com o prato na mão. Comece bem devagar e só suba o BPM se estiver limpo.', 'Velocidade e resistência', 5, 120, 5),

  -- GUITARRA
  ('guitar', 'Troca de acordes abertos (Em, Am, D)', 'Troque de acorde a cada dois compassos, soando todas as cordas limpas, sem parar o pulso.', 'Formas de acorde e troca rápida', 1, 60, 10),
  ('guitar', 'Batida básica em semínimas', 'Bata para baixo em semínimas num acorde, mantendo o pulso e o volume iguais.', 'Ritmo e controle da mão direita', 1, 70, 5),
  ('guitar', 'Aranha cromática 1-3-2-4', 'Percorra as cordas com o padrão 1-3-2-4 nos trastes, um dedo por traste, subindo uma casa a cada repetição.', 'Independência dos dedos', 1, 60, 5),
  ('guitar', 'Palm mute em colcheias', 'Apoie a lateral da mão direita na ponte e toque colcheias na corda grave, alternando com acordes soltos.', 'Controle da mão direita', 2, 80, 5),
  ('guitar', 'Acordes com pestana (Fá e Si menor)', 'Treine a pestana com o dedo 1 e a troca entre os acordes de pestana e as formas abertas.', 'Força e limpeza da pestana', 2, 60, 10),
  ('guitar', 'Hammer-on e pull-off', 'Faça ligados em grupos de duas e de três notas, mantendo o volume igual entre notas ligadas e palhetadas.', 'Legato e força dos dedos', 2, 70, 5),
  ('guitar', 'Pentatônica menor: posições 1 e 2 ligadas', 'Conecte as duas posições com um slide e percorra tudo em colcheias.', 'Mapa do braço e transição entre posições', 3, 80, 10),
  ('guitar', 'Riff com power chords', 'Alterne power chords com palm mute em colcheias, trocando de posição sem olhar para o braço.', 'Precisão rítmica e troca de posição', 3, 90, 10),
  ('guitar', 'Slides e trinados', 'Faça slides entre notas e trinados rápidos com dois dedos, sem perder a afinação.', 'Técnica da mão esquerda', 3, 70, 5),
  ('guitar', 'Sweep picking de 3 cordas', 'Varra um arpejo de tríade em três cordas, uma nota por corda, com a mão esquerda sincronizada.', 'Sincronização entre as mãos', 4, 60, 10),
  ('guitar', 'Economy picking em escalas', 'Em escalas de 3 notas por corda, mude de corda usando a palhetada na mesma direção do movimento.', 'Eficiência e velocidade da palhetada', 4, 70, 10),
  ('guitar', 'Tapping com arpejo simples', 'Toque um arpejo de tríade com a mão direita no braço e a esquerda nas notas fixas, em colcheias.', 'Coordenação e clareza do tapping', 4, 70, 5),
  ('guitar', 'Sweep picking de 5 cordas', 'Estenda o sweep para cinco cordas, mantendo as notas separadas e sem ruído entre elas.', 'Domínio do sweep em arpejos longos', 5, 80, 10),
  ('guitar', 'Construção de velocidade com metrônomo', 'Escolha um trecho curto e suba 4 BPM a cada três repetições perfeitas. Se errar, volte um passo.', 'Velocidade com controle', 5, 100, 10),

  -- BAIXO
  ('bass', 'Notas soltas com abafamento', 'Toque as quatro cordas soltas em semínimas, abafando as cordas vizinhas com a mão esquerda e a direita.', 'Limpeza e controle de ruído', 1, 70, 5),
  ('bass', 'Oitavas em colcheias', 'Alterne a fundamental e a oitava em colcheias, mudando de nota a cada compasso.', 'Pulso e mapa do braço', 1, 80, 5),
  ('bass', 'Escala de Dó maior em uma posição', 'Suba e desça a escala sem mudar de posição, em semínimas e depois em colcheias.', 'Fluência na posição', 1, 70, 5),
  ('bass', 'Groove com fundamental e quinta', 'Alterne fundamental e quinta em semínimas numa progressão I-IV-V.', 'Linhas simples e eficientes', 2, 80, 10),
  ('bass', 'Colcheias constantes com palheta', 'Toque colcheias na mesma nota com palhetada alternada, mantendo o som igual do começo ao fim.', 'Resistência e consistência da palhetada', 2, 100, 5),
  ('bass', 'Slides e ligados no baixo', 'Faça slides e ligados curtos entre notas do acorde, mantendo o volume uniforme.', 'Expressividade e legato', 2, 70, 5),
  ('bass', 'Slap básico (polegar e pop)', 'Use o polegar nas notas graves e puxe a corda com o indicador (pop) nas agudas, em padrão de oitavas.', 'Introdução ao slap', 3, 80, 10),
  ('bass', 'Linhas de blues de 12 compassos', 'Construa uma linha com fundamental, terça, quinta e sexta, seguindo a forma do blues de 12 compassos.', 'Condução e forma harmônica', 3, 90, 10),
  ('bass', 'Groove sincopado em semicolcheias', 'Toque padrões com pausas e síncopes em semicolcheias, travando com o bumbo imaginado.', 'Precisão rítmica e groove', 3, 80, 10),
  ('bass', 'Walking bass com notas cromáticas', 'Faça linhas em semínimas usando notas de aproximação cromática para chegar à fundamental do próximo acorde.', 'Condução melódica da linha', 4, 110, 10),
  ('bass', 'Modos dórico e mixolídio', 'Toque os dois modos em uma oitava e crie um groove curto em cada um.', 'Vocabulário modal', 4, 80, 10),
  ('bass', 'Slap com notas fantasma e pops', 'Combine polegar, pops e notas fantasma em padrões de semicolcheias.', 'Controle de dinâmica no slap', 4, 90, 10),
  ('bass', 'Walking bass em tom menor com tensões', 'Conduza uma linha em tom menor passando por notas de tensão, mantendo o pulso firme.', 'Linhas jazzísticas mais elaboradas', 5, 130, 10),
  ('bass', 'Harmônicos e tapping', 'Toque harmônicos naturais nos trastes 5, 7 e 12 e combine com frases em tapping.', 'Técnicas expandidas', 5, 70, 10),

  -- PIANO
  ('piano', 'Cinco dedos na posição de Dó', 'Posicione um dedo por tecla, de Dó a Sol, e toque subindo e descendo com cada mão separada.', 'Posição das mãos e independência', 1, 60, 5),
  ('piano', 'Acordes de Dó, Fá e Sol', 'Monte os três acordes com a mão direita e troque entre eles a cada compasso.', 'Formas de acorde e troca', 1, 60, 5),
  ('piano', 'Melodia simples com a mão direita', 'Toque uma melodia curta em semínimas, lendo a partitura ou de ouvido, com pulso regular.', 'Leitura e pulso', 1, 60, 10),
  ('piano', 'Escala menor natural (Lá menor)', 'Percorra a escala em duas oitavas com mãos separadas e depois juntas.', 'Digitação em escalas menores', 2, 70, 10),
  ('piano', 'Baixo de Alberti', 'Com a mão esquerda, toque o padrão 1-5-3-5 do acorde, enquanto a direita toca uma melodia simples.', 'Acompanhamento com a mão esquerda', 2, 70, 10),
  ('piano', 'Acordes de sétima (maior e dominante)', 'Monte acordes de sétima maior e de sétima dominante em várias tonalidades, em semínimas.', 'Vocabulário harmônico', 2, 70, 10),
  ('piano', 'Progressão I-vi-IV-V em várias tonalidades', 'Toque a progressão com acordes na mão direita e fundamental na esquerda, em três tonalidades.', 'Harmonia popular e fluência', 3, 80, 10),
  ('piano', 'Acompanhamento em oitavas na mão esquerda', 'Toque oitavas na mão esquerda em colcheias, enquanto a direita faz acordes ou melodia.', 'Força e precisão da mão esquerda', 3, 80, 10),
  ('piano', 'Escalas menores harmônica e melódica', 'Percorra as duas escalas em duas oitavas, notando as diferenças ao subir e ao descer.', 'Sonoridade menor e digitação', 3, 70, 10),
  ('piano', 'Cadência ii-V-I em Dó, Fá e Sol', 'Toque a cadência com acordes de sétima e voice leading suave entre os acordes.', 'Harmonia do jazz e condução de vozes', 4, 80, 10),
  ('piano', 'Escalas em terças', 'Toque escalas maiores em terças paralelas com a mão direita, em uma e depois em duas oitavas.', 'Agilidade e coordenação dos dedos', 4, 70, 10),
  ('piano', 'Arpejos de sétima em duas oitavas', 'Toque arpejos de acordes de sétima subindo e descendo duas oitavas, com mãos juntas.', 'Fluência e flexibilidade da mão', 4, 80, 10),
  ('piano', 'Independência rítmica 4 contra 3', 'Toque quatro notas na mão direita enquanto a esquerda toca três, no mesmo tempo.', 'Polirritmia entre as mãos', 5, 60, 10),
  ('piano', 'Estudo a duas vozes', 'Toque duas linhas melódicas independentes, uma em cada mão, fazendo cada voz soar com clareza.', 'Polifonia e controle de dinâmica', 5, 60, 10)
) as v(instrument_id, title, description, objective, difficulty, bpm, minutes)
where not exists (
  select 1 from public.exercises e where e.instrument_id = v.instrument_id and e.title = v.title
);
