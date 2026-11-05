-- Exercícios iniciais do sistema (created_by = null), por instrumento
insert into public.exercises (instrument_id, title, description, objective, difficulty, recommended_bpm, duration_minutes) values
  -- Bateria
  ('drums', 'Groove básico de rock em 4/4', 'Bumbo no 1 e no 3, caixa no 2 e no 4 e chimbal em colcheias. Mantenha o volume uniforme entre as mãos.', 'Estabilidade de tempo e coordenação básica', 1, 80, 10),
  ('drums', 'Paradiddle simples', 'Sequência D E D D E D E E na caixa. Comece devagar, com acentos claros no primeiro toque de cada grupo.', 'Controle de rudimentos e alternância de mãos', 2, 70, 5),
  ('drums', 'Rulo duplo (double stroke roll)', 'Dois toques por mão, alternando. Procure dois toques com o mesmo volume e o mesmo som.', 'Fluidez e controle do rebote', 2, 60, 5),
  ('drums', 'Independência de pés e mãos', 'Mantenha o groove nas mãos enquanto varia o padrão do bumbo a cada dois compassos.', 'Independência entre membros', 3, 70, 10),
  ('drums', 'Viradas em semicolcheias', 'Passe de caixa para tons e surdo em semicolcheias e volte ao groove no tempo 1 do compasso seguinte.', 'Transições limpas entre groove e virada', 3, 80, 10),
  ('drums', 'Pedal duplo alternado', 'Alterne os pés no bumbo em colcheias e depois em semicolcheias, sem acelerar.', 'Velocidade e consistência dos pés', 3, 70, 5),
  -- Guitarra
  ('guitar', 'Aquecimento cromático 1-2-3-4', 'Toque cada traste em uma corda, com um dedo por traste, subindo e descendo pelas seis cordas.', 'Coordenação, relaxamento e independência dos dedos', 1, 60, 5),
  ('guitar', 'Palhetada alternada em corda solta', 'Alterne palhetada para baixo e para cima em colcheias, depois em semicolcheias, com movimento curto e relaxado.', 'Precisão e velocidade da palhetada alternada', 2, 70, 5),
  ('guitar', 'Escala pentatônica menor (posição 1)', 'Suba e desça a escala em colcheias, mantendo a palhetada alternada.', 'Fundamentos de escalas e mapa do braço', 2, 80, 10),
  ('guitar', 'Arpejos de tríades maiores e menores', 'Toque as notas do acorde uma a uma, em colcheias, com palhetada alternada ou dedilhado.', 'Clareza de notas e troca de formas', 2, 70, 10),
  ('guitar', 'Bends e vibrato', 'Faça bends de tom inteiro afinados e finalize com vibrato controlado.', 'Afinação e expressividade', 3, 60, 5),
  ('guitar', 'Escala maior em três notas por corda', 'Percorra a escala em semínimas e depois em colcheias, mudando de posição com precisão.', 'Velocidade e domínio do braço', 3, 80, 10),
  -- Baixo
  ('bass', 'Alternância de dedos (indicador e médio)', 'Toque em corda solta em colcheias, alternando os dedos sem mudar o volume entre eles.', 'Igualdade de toque entre os dedos', 1, 70, 5),
  ('bass', 'Groove em semínimas na fundamental', 'Toque a fundamental de cada acorde de uma progressão simples, em cima do clique.', 'Pulso estável e atenção ao tempo', 1, 80, 10),
  ('bass', 'Escala maior e pentatônica', 'Suba e desça as escalas em colcheias, com dedilhado alternado.', 'Mapa do braço e fluência', 2, 80, 10),
  ('bass', 'Arpejos de tríades', 'Toque fundamental, terça e quinta em colcheias, mudando de acorde a cada compasso.', 'Visão harmônica e precisão', 2, 70, 10),
  ('bass', 'Groove com notas fantasma e ligados', 'Inclua notas abafadas entre as notas principais em semicolcheias, sem perder o pulso.', 'Feeling e controle rítmico', 3, 80, 10),
  ('bass', 'Walking bass básico', 'Construa linhas em semínimas passando pelas notas do acorde e por notas de aproximação.', 'Condução melódica da linha de baixo', 3, 100, 10),
  -- Piano
  ('piano', 'Escala de Dó maior com mãos separadas', 'Toque a escala em uma oitava, com a digitação correta e o polegar passando por baixo.', 'Digitação e regularidade', 1, 60, 5),
  ('piano', 'Escalas maiores com as duas mãos', 'Percorra duas oitavas com as mãos juntas, a uma oitava de distância uma da outra.', 'Coordenação entre as mãos', 2, 70, 10),
  ('piano', 'Arpejos de tríades', 'Toque as tríades maiores e menores em arpejo, subindo e descendo duas oitavas.', 'Fluência e flexibilidade da mão', 2, 70, 10),
  ('piano', 'Acordes e inversões', 'Toque cada acorde em estado fundamental e nas duas inversões, em semínimas.', 'Troca rápida de formas de acorde', 2, 70, 10),
  ('piano', 'Cadência I-IV-V-I', 'Toque a cadência em várias tonalidades, uma troca de acorde por compasso.', 'Harmonia funcional e fluência', 2, 80, 10),
  ('piano', 'Independência das mãos (3 contra 2)', 'A mão direita toca tercinas enquanto a esquerda toca colcheias, no mesmo compasso.', 'Independência rítmica entre as mãos', 3, 60, 10);
