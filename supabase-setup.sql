-- ═══════════════════════════════════════════════════════════════
--  LAUGHTALE SMP WEBSTORE — Supabase Setup SQL
--  Jalankan di: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Buat bucket 'proofs' untuk bukti pembayaran customer
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proofs',
  'proofs',
  true,
  10485760, -- 10 MB
  ARRAY['image/jpeg','image/jpg','image/png','image/gif','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Buat bucket 'shop-images' untuk foto item toko (admin upload)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop-images',
  'shop-images',
  true,
  33554432, -- 32 MB
  ARRAY['image/jpeg','image/jpg','image/png','image/gif','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Policy: anon bisa upload ke bucket 'proofs'
DO $$ BEGIN
  CREATE POLICY "Anon upload proofs" ON storage.objects
    FOR INSERT TO anon WITH CHECK (bucket_id = 'proofs');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Policy: publik bisa baca semua file storage
DO $$ BEGIN
  CREATE POLICY "Public read all storage" ON storage.objects
    FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Policy: authenticated (admin) bisa upload ke 'shop-images'
DO $$ BEGIN
  CREATE POLICY "Auth upload shop-images" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'shop-images');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Policy: anon juga bisa upload ke 'shop-images' (untuk admin yang pakai anon key)
DO $$ BEGIN
  CREATE POLICY "Anon upload shop-images" ON storage.objects
    FOR INSERT TO anon WITH CHECK (bucket_id = 'shop-images');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6b. Policy: authenticated bisa UPDATE file di 'shop-images' (untuk upsert/replace)
DO $$ BEGIN
  CREATE POLICY "Auth update shop-images" ON storage.objects
    FOR UPDATE TO authenticated USING (bucket_id = 'shop-images');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6c. Policy: authenticated bisa DELETE file di 'shop-images'
DO $$ BEGIN
  CREATE POLICY "Auth delete shop-images" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'shop-images');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6d. Policy: anon bisa UPDATE file di 'shop-images'
DO $$ BEGIN
  CREATE POLICY "Anon update shop-images" ON storage.objects
    FOR UPDATE TO anon USING (bucket_id = 'shop-images');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6e. Policy: anon bisa DELETE file di 'shop-images'
DO $$ BEGIN
  CREATE POLICY "Anon delete shop-images" ON storage.objects
    FOR DELETE TO anon USING (bucket_id = 'shop-images');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. Orders: anon insert & select (sudah ada? skip)
DO $$ BEGIN
  CREATE POLICY "Anon insert orders" ON public.orders
    FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Anon select orders" ON public.orders
    FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
