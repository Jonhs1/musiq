-- Upsert no Storage (insert ... on conflict do update) exige também permissão de leitura
create policy "avatars: ler na própria pasta" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
