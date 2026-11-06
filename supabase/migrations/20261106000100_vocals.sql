-- Vocal como quinto instrumento + 20 exercícios oficiais
insert into public.instruments (id, name, sort_order)
select 'vocals', 'Vocal', coalesce((select sort_order + 1 from public.instruments where id = 'piano'), 5)
on conflict (id) do nothing;

insert into public.exercises (instrument_id, title, description, objective, difficulty, recommended_bpm, duration_minutes)
select 'vocals', v.title, v.description, v.objective, v.difficulty, v.bpm, v.minutes
from (values
  -- dificuldade 1
  ('Respiração diafragmática', 'Deitado ou em pé, inspire pelo nariz por 4 tempos expandindo a barriga, segure 2 e solte em "ssss" por 6. Os ombros ficam parados.', 'Controle de ar e apoio', 1::smallint, null::smallint, 5::smallint),
  ('Vibração de lábios (lip trill)', 'Faça os lábios vibrarem soltos enquanto desliza a voz de grave para agudo e volta, sem apertar a garganta.', 'Aquecimento e relaxamento da voz', 1::smallint, null::smallint, 5::smallint),
  ('Sirene suave', 'Deslize a voz em "uuu" do grave ao agudo e de volta, em um fôlego, com volume baixo e constante.', 'Passagem suave entre registros', 1::smallint, null::smallint, 5::smallint),
  ('Nota longa sustentada', 'Escolha uma nota confortável e sustente em "aaa" por 10 segundos, mantendo volume e afinação estáveis.', 'Estabilidade de afinação e fôlego', 1::smallint, 60::smallint, 5::smallint),
  -- dificuldade 2
  ('Escala de 5 notas em "mi-mi-mi"', 'Suba e desça as 5 primeiras notas da escala maior em "mi", subindo meio tom a cada repetição.', 'Afinação e transição entre notas', 2::smallint, 70::smallint, 8::smallint),
  ('Vogais puras em uma nota', 'Cante A-E-I-O-U sobre a mesma nota, sem mudar o formato da boca além do necessário e sem perder o volume.', 'Clareza das vogais e ressonância', 2::smallint, 60::smallint, 5::smallint),
  ('Intervalos de terça e quinta', 'Cante pares de notas em terça e em quinta ascendentes e descendentes, conferindo a afinação com um piano ou afinador.', 'Percepção e afinação de intervalos', 2::smallint, 70::smallint, 10::smallint),
  ('Dicção com trava-línguas', 'Repita trava-línguas devagar, exagerando as consoantes, e acelere aos poucos sem perder a clareza.', 'Articulação e clareza do texto', 2::smallint, 80::smallint, 5::smallint),
  -- dificuldade 3
  ('Escala maior completa em legato', 'Cante a escala maior inteira, subindo e descendo, ligando as notas sem cortar o som entre elas.', 'Legato e controle da respiração', 3::smallint, 70::smallint, 10::smallint),
  ('Dinâmica: crescendo e decrescendo', 'Sustente uma nota aumentando o volume por 5 tempos e diminuindo por 5, sem mudar a afinação.', 'Controle de dinâmica', 3::smallint, 60::smallint, 8::smallint),
  ('Ressonância "ng" para "a"', 'Comece em "ng" sentindo a vibração no nariz e abra para "aaa" mantendo a mesma sensação de frente da boca.', 'Ressonância e projeção sem esforço', 3::smallint, null::smallint, 8::smallint),
  ('Cantar no tempo com metrônomo', 'Cante uma frase curta de uma música conhecida em cima do metrônomo, acertando o início de cada sílaba no pulso.', 'Precisão rítmica ao cantar', 3::smallint, 80::smallint, 10::smallint),
  -- dificuldade 4
  ('Arpejo maior de uma oitava', 'Cante o arpejo (1-3-5-8-5-3-1) em "ah", subindo meio tom a cada rodada e mantendo as notas limpas.', 'Agilidade e afinação em saltos', 4::smallint, 80::smallint, 10::smallint),
  ('Passagem de registro (peito para cabeça)', 'Deslize de uma nota grave em voz de peito até uma aguda em voz de cabeça, suavizando a quebra sem apertar.', 'Transição entre registros', 4::smallint, null::smallint, 10::smallint),
  ('Staccato de notas repetidas', 'Cante notas curtas e secas em "ha-ha-ha" usando o diafragma, depois alterne com notas ligadas.', 'Apoio e articulação rítmica', 4::smallint, 90::smallint, 8::smallint),
  ('Frase longa em um fôlego', 'Escolha uma frase de 8 a 10 segundos de uma música e cante inteira em um fôlego, planejando onde respirar na próxima rodada.', 'Gestão de fôlego em frases longas', 4::smallint, 70::smallint, 10::smallint),
  -- dificuldade 5
  ('Vibrato controlado', 'Sustente uma nota e introduza uma oscilação regular e leve de altura, cerca de 5 a 6 por segundo, sem tremer a mandíbula.', 'Vibrato natural e estável', 5::smallint, 60::smallint, 10::smallint),
  ('Agilidade: runs de 5 notas', 'Cante passagens rápidas de 5 notas (melismas) devagar com metrônomo e acelere de 5 em 5 BPM, mantendo cada nota afinada.', 'Agilidade vocal', 5::smallint, 90::smallint, 10::smallint),
  ('Dinâmica extrema em frase musical', 'Cante uma frase de uma música indo do pianíssimo ao forte e de volta, mantendo a afinação e o timbre.', 'Expressividade e controle total do volume', 5::smallint, 70::smallint, 12::smallint),
  ('Música completa com interpretação', 'Cante uma música inteira no tempo, cuidando de respiração, afinação, dicção e dinâmica, e grave para ouvir depois.', 'Integrar todas as técnicas em performance', 5::smallint, 90::smallint, 15::smallint)
) as v(title, description, objective, difficulty, bpm, minutes)
where not exists (
  select 1 from public.exercises e where e.instrument_id = 'vocals' and e.title = v.title
);
