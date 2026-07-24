
CREATE POLICY "auth read docs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documentos');
CREATE POLICY "auth upload docs" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documentos' AND auth.uid() IS NOT NULL);
CREATE POLICY "auth delete own docs" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documentos' AND owner = auth.uid());
