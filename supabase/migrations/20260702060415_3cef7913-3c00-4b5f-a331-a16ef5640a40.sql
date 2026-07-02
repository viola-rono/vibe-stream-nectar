
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS feeling jsonb,
  ADD COLUMN IF NOT EXISTS location jsonb,
  ADD COLUMN IF NOT EXISTS song jsonb,
  ADD COLUMN IF NOT EXISTS theme text,
  ADD COLUMN IF NOT EXISTS tagged_users uuid[];
