-- ════════════════════════════════════════════════════════════════
-- Supabase Storage: Setup bucket "glyph-sheets"
-- Jalankan di: Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════

-- 1. Buat bucket (jika belum ada)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'glyph-sheets',
  'glyph-sheets',
  true,             -- public: bisa diakses tanpa auth (untuk load gambar di client)
  2097152,          -- 2MB max per file
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152;

-- 2. RLS Policy: admin bisa upload/delete, semua bisa baca (SELECT)
-- Hapus policy lama jika ada
DROP POLICY IF EXISTS "admin_glyph_upload" ON storage.objects;
DROP POLICY IF EXISTS "public_glyph_read"  ON storage.objects;
DROP POLICY IF EXISTS "admin_glyph_delete" ON storage.objects;

-- Allow public read
CREATE POLICY "public_glyph_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'glyph-sheets');

-- Allow authenticated users (admin) to upload
CREATE POLICY "admin_glyph_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'glyph-sheets');

-- Allow authenticated users (admin) to overwrite (update)
CREATE POLICY "admin_glyph_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'glyph-sheets');

-- Allow authenticated users (admin) to delete
CREATE POLICY "admin_glyph_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'glyph-sheets');

-- ════════════════════════════════════════════════════════════════
-- DONE! 
-- Folder structure di storage: glyph-sheets/ranges/E7.png, E8.png, ...
-- URL contoh: https://<project>.supabase.co/storage/v1/object/public/glyph-sheets/ranges/E8.png
-- ════════════════════════════════════════════════════════════════
